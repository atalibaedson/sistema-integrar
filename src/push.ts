// Notificações push (aviso no celular/computador mesmo com o app fechado).
//
// Como funciona: o aparelho se inscreve no serviço de push do navegador (chave
// pública VAPID, pedida à função `alertas-push`) e entrega a inscrição à mesma
// função, que a guarda no servidor. A cada 30 minutos o servidor calcula os
// avisos de cada pessoa (alertas.ts) e manda o push. O service worker
// (public/sw.js) só mostra a notificação e abre o app ao tocar.
import { supabase } from './supabaseClient'
import { igrejaAtivaId } from './igrejas'
import { MODO_DEMO } from './demo'

const SW_URL = '/sw.js'

export type EstadoPush =
  | 'carregando'
  | 'indisponivel' // sem nuvem (uso só neste aparelho) ou demonstração
  | 'nao_suportado' // navegador sem push
  | 'precisa_instalar' // iPhone/iPad: só funciona com o app na Tela de Início
  | 'negado' // a pessoa bloqueou nas configurações do navegador
  | 'desligado'
  | 'ligado'

function ehIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function instalado(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
}

function pushSuportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function lerEstadoPush(): Promise<EstadoPush> {
  if (MODO_DEMO) return 'desligado'
  if (!supabase) return 'indisponivel'
  if (!pushSuportado()) return ehIos() && !instalado() ? 'precisa_instalar' : 'nao_suportado'
  if (Notification.permission === 'denied') return 'negado'
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL)
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub && Notification.permission === 'granted' ? 'ligado' : 'desligado'
  } catch {
    return 'desligado'
  }
}

// Chamada à Edge Function alertas-push (autenticada com a sessão da pessoa)
async function chamar<T extends Record<string, unknown>>(acao: string, corpo: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('Sincronização online não configurada.')
  const { data, error } = await supabase.functions.invoke('alertas-push', {
    body: { acao, igrejaId: igrejaAtivaId(), ...corpo },
  })
  if (error) {
    // O corpo do erro (JSON da função) traz a mensagem em português
    let msg = error.message
    try {
      const ctx = (error as { context?: Response }).context
      const j = ctx ? await ctx.json() : null
      if (j?.error) msg = String(j.error)
    } catch { /* mantém a mensagem genérica */ }
    throw new Error(msg)
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) throw new Error(String((data as { error: unknown }).error))
  return (data ?? {}) as T
}

function chaveParaBytes(base64Url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const bin = atob((base64Url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export type ResultadoPush = { ok: true } | { ok: false; erro: string }

async function inscrever(usuarioId: string, pedirPermissao: boolean): Promise<ResultadoPush> {
  try {
    if (!pushSuportado()) return { ok: false, erro: 'Este navegador não suporta notificações.' }
    if (pedirPermissao) {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        return { ok: false, erro: 'A permissão não foi concedida. Se bloqueou sem querer, libere as notificações nas configurações do navegador.' }
      }
    } else if (Notification.permission !== 'granted') {
      return { ok: false, erro: 'Sem permissão.' }
    }
    const reg = await navigator.serviceWorker.register(SW_URL)
    await navigator.serviceWorker.ready
    const { chave } = await chamar<{ chave: string }>('chave')
    if (!chave) return { ok: false, erro: 'O servidor ainda não está preparado para enviar notificações (chaves não configuradas).' }
    const opcoes = { userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe(opcoes)
    }
    await chamar('assinar', { usuarioId, assinatura: sub.toJSON(), aparelho: navigator.userAgent.slice(0, 200) })
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível ativar as notificações.' }
  }
}

// Ligar: precisa vir de um toque da pessoa (o navegador exige para pedir permissão)
export function ativarPush(usuarioId: string): Promise<ResultadoPush> {
  if (MODO_DEMO) return Promise.resolve({ ok: false, erro: 'Indisponível na demonstração.' })
  return inscrever(usuarioId, true)
}

export async function desativarPush(): Promise<ResultadoPush> {
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL)
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) {
      await chamar('cancelar', { endpoint: sub.endpoint }).catch(() => undefined) // o servidor também limpa sozinho inscrições mortas
      await sub.unsubscribe()
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível desativar.' }
  }
}

// Notificação de teste: o servidor manda um push só para os aparelhos desta pessoa
export async function testarPush(): Promise<ResultadoPush> {
  try {
    const r = await chamar<{ enviados?: number }>('testar')
    return (r.enviados ?? 0) > 0
      ? { ok: true }
      : { ok: false, erro: 'O servidor não encontrou aparelho inscrito. Desative e ative de novo.' }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha no teste.' }
  }
}

// Ao abrir o app já com a permissão dada, renova a inscrição no servidor (o
// aparelho pode ter trocado de endereço de push, ou o servidor ter perdido a linha).
let renovado = false
export function renovarAssinaturaPush(usuarioId: string): void {
  if (renovado || MODO_DEMO || !supabase || !pushSuportado() || Notification.permission !== 'granted') return
  renovado = true
  void navigator.serviceWorker.getRegistration(SW_URL).then((reg) => {
    if (reg) void inscrever(usuarioId, false)
  })
}
