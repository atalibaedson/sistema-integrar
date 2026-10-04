// Edge Function: avisos por push (notificação no celular / computador).
//
// Faz quatro coisas, escolhidas pelo campo `acao` do corpo (POST/JSON):
//   • saude   — (aberta) diz se as chaves de envio estão prontas
//   • chave   — devolve a chave pública VAPID (o app precisa dela para se inscrever)
//   • assinar — guarda a inscrição de push de UM aparelho de uma pessoa
//   • cancelar— apaga a inscrição de um aparelho
//   • testar  — manda uma notificação de teste aos aparelhos de quem chamou
//   • enviar  — (só a rotina agendada) calcula os avisos de cada pessoa e manda
//               os pushes: resumo diário + avisos imediatos
//
// As ações de pessoa exigem o token de login (auth.getUser); a identidade vem
// do TOKEN, nunca do corpo. A ação `enviar` exige o segredo `x-cron-secret`.
// As REGRAS dos avisos são as mesmas do app: _shared/alertas.ts é uma cópia
// gerada de src/alertas.ts (npm run sincronizar:servidor).
//
// Privacidade: o texto do push só tem CONTAGENS — nunca o nome de um visitante
// (a notificação aparece na tela bloqueada).
//
// Implantação e segredos: ver IMPLANTACAO-ALERTAS-PUSH.md. Esta função é
// publicada com verify_jwt = false (supabase/config.toml), porque a rotina
// agendada não tem JWT; por isso a validação é feita aqui dentro.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { alertasConfig, alertasDoUsuario, calcularAlertas, partesBR, textoPush, textoPushImediato } from '../_shared/alertas.ts'
import type { Alerta } from '../_shared/alertas.ts'
import type { AppState, Usuario } from '../_shared/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const resposta = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function texto(v: unknown): string | undefined {
  const t = typeof v === 'string' ? v.trim() : ''
  return t.length > 0 ? t : undefined
}

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const admin = createClient(URL_SUPABASE, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

// A biblioteca de push e as chaves são preparadas AQUI, dentro de try/catch: chave
// inválida (ex.: um texto de exemplo colado no lugar da chave) ou falha ao
// carregar a biblioteca não pode derrubar a função na partida — vira uma
// mensagem clara (ação `saude`, `chave` e `testar`) e o resto continua de pé.
// deno-lint-ignore no-explicit-any
let webpush: any = null
let vapidErro = ''
try {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) {
    vapidErro = 'faltam segredos (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou VAPID_SUBJECT)'
  } else {
    const mod = await import('npm:web-push@3.6.7')
    webpush = mod.default ?? mod
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  }
} catch (e) {
  webpush = null
  vapidErro = `chaves inválidas ou biblioteca indisponível (${(e as Error).message})`
}
const vapidPronto = webpush !== null && vapidErro === ''

// Segredos comparados sem atalho de tamanho/posição
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

async function usuarioDoToken(req: Request): Promise<{ id: string; email?: string } | null> {
  const comUsuario = createClient(URL_SUPABASE, ANON, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await comUsuario.auth.getUser()
  const u = data?.user
  if (error || !u || (u as { is_anonymous?: boolean }).is_anonymous) return null
  return { id: u.id, email: u.email ?? undefined }
}

interface Inscricao { id: string; igreja_id: string; usuario_id: string; endpoint: string; p256dh: string; auth: string }
interface Conteudo { titulo: string; corpo: string; tag: string; url?: string }

// 'ok' | 'morta' (404/410: o aparelho cancelou — apagar a inscrição) | 'erro'
async function enviarPush(sub: Inscricao, c: Conteudo): Promise<'ok' | 'morta' | 'erro'> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ titulo: c.titulo, corpo: c.corpo, tag: c.tag, url: c.url ?? '/#/avisos' }),
      { TTL: 6 * 3600, urgency: 'normal' },
    )
    return 'ok'
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    if (code === 404 || code === 410) return 'morta'
    console.error('falha no push', code ?? '', (e as Error).message)
    return 'erro'
  }
}

async function enviarParaTodas(subs: Inscricao[], c: Conteudo): Promise<{ ok: number; mortas: string[] }> {
  let ok = 0
  const mortas: string[] = []
  for (const sub of subs) {
    const r = await enviarPush(sub, c)
    if (r === 'ok') ok++
    else if (r === 'morta') mortas.push(sub.id)
  }
  return { ok, mortas }
}

async function apagarMortas(ids: string[]) {
  if (ids.length > 0) await admin.from('assinaturas_push').delete().in('id', ids)
}

async function carregarEstado(igrejaId: string): Promise<AppState | null> {
  const { data, error } = await admin.from('estados').select('dados').eq('igreja_id', igrejaId).maybeSingle()
  if (error || !data?.dados) return null
  const s = data.dados as AppState
  return { ...s, usuarios: s.usuarios ?? [], visitantes: s.visitantes ?? [], interacoes: s.interacoes ?? [], conexoes: s.conexoes ?? [] }
}

// ---- Ações da pessoa ----

async function acaoAssinar(user: { id: string; email?: string }, corpo: Record<string, unknown>) {
  const igrejaId = texto(corpo.igrejaId)
  const usuarioId = texto(corpo.usuarioId)
  const a = (corpo.assinatura ?? {}) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  const endpoint = texto(a.endpoint)
  const p256dh = texto(a.keys?.p256dh)
  const auth = texto(a.keys?.auth)
  if (!igrejaId || !usuarioId || !endpoint || !p256dh || !auth) return resposta({ error: 'Dados da inscrição incompletos.' }, 400)
  if (!endpoint.startsWith('https://') || endpoint.length > 1000) return resposta({ error: 'Endereço de push inválido.' }, 400)

  // Só quem é membro desta igreja (vínculo da RLS por igreja)
  const { data: vinculo } = await admin
    .from('membros_igreja').select('igreja_id').eq('auth_user_id', user.id).eq('igreja_id', igrejaId).maybeSingle()
  if (!vinculo) return resposta({ error: 'Sua conta não está vinculada a esta igreja.' }, 403)

  // E a ficha informada tem de ser DESTA pessoa (por login ou por e-mail)
  const estado = await carregarEstado(igrejaId)
  const ficha = estado?.usuarios.find((u: Usuario) => u.id === usuarioId)
  const email = (user.email ?? '').toLowerCase()
  const ehDela = !!ficha && ficha.ativo && (ficha.authUserId === user.id || (!!email && (ficha.email ?? '').trim().toLowerCase() === email))
  if (!ehDela) return resposta({ error: 'Não foi possível confirmar a sua ficha na equipe.' }, 403)

  const { error } = await admin.from('assinaturas_push').upsert(
    {
      igreja_id: igrejaId, auth_user_id: user.id, usuario_id: usuarioId, endpoint, p256dh, auth,
      aparelho: texto(corpo.aparelho)?.slice(0, 200) ?? null,
    },
    { onConflict: 'igreja_id,endpoint' },
  )
  if (error) return resposta({ error: `Não foi possível salvar a inscrição: ${error.message}` }, 500)
  return resposta({ ok: true })
}

async function acaoCancelar(user: { id: string }, corpo: Record<string, unknown>) {
  const endpoint = texto(corpo.endpoint)
  if (!endpoint) return resposta({ error: 'Aparelho não informado.' }, 400)
  await admin.from('assinaturas_push').delete().eq('auth_user_id', user.id).eq('endpoint', endpoint)
  return resposta({ ok: true })
}

async function acaoTestar(user: { id: string }, corpo: Record<string, unknown>) {
  const igrejaId = texto(corpo.igrejaId)
  if (!igrejaId) return resposta({ error: 'Igreja não identificada.' }, 400)
  if (!vapidPronto) return resposta({ error: `O servidor ainda não tem as chaves de notificação configuradas: ${vapidErro}.` }, 503)
  const { data } = await admin
    .from('assinaturas_push').select('id, igreja_id, usuario_id, endpoint, p256dh, auth')
    .eq('auth_user_id', user.id).eq('igreja_id', igrejaId)
  const subs = (data ?? []) as Inscricao[]
  const r = await enviarParaTodas(subs, {
    titulo: 'Teste de notificação', corpo: 'Está tudo certo: este aparelho vai receber os avisos do Sistema Integrar.', tag: 'teste',
  })
  await apagarMortas(r.mortas)
  return resposta({ ok: true, enviados: r.ok })
}

// ---- Rotina agendada ----

const JANELA_INICIO = 7 // nenhum push antes das 7h (Brasília)…
const JANELA_FIM = 21 // …nem a partir das 21h
const MAX_IMEDIATOS_DIA = 4 // por pessoa; o excedente entra no resumo

async function acaoEnviar(corpo: Record<string, unknown>) {
  const simular = corpo.simular === true // só calcula e devolve o plano, sem mandar nem registrar
  const agora = new Date()
  const { hora, diaSemana, data } = partesBR(agora)
  if (!simular && (hora < JANELA_INICIO || hora >= JANELA_FIM)) {
    return resposta({ ok: true, motivo: 'fora do horário de envio', hora })
  }
  if (!simular && !vapidPronto) return resposta({ error: `Chaves VAPID não configuradas: ${vapidErro}.` }, 503)

  const { data: linhas, error } = await admin.from('assinaturas_push').select('id, igreja_id, usuario_id, endpoint, p256dh, auth')
  if (error) return resposta({ error: `Falha ao ler as inscrições: ${error.message}` }, 500)
  const todas = (linhas ?? []) as Inscricao[]
  const porIgreja = new Map<string, Inscricao[]>()
  for (const s of todas) {
    const arr = porIgreja.get(s.igreja_id)
    if (arr) arr.push(s)
    else porIgreja.set(s.igreja_id, [s])
  }

  let imediatosEnviados = 0
  let resumosEnviados = 0
  const mortas: string[] = []
  const plano: Record<string, unknown>[] = []

  for (const [igrejaId, subsIgreja] of porIgreja) {
    const estado = await carregarEstado(igrejaId)
    if (!estado) continue
    const cfg = alertasConfig(estado.config)
    if (!cfg.ativo) continue
    const todos = calcularAlertas(estado, agora)

    // O que já foi enviado nos últimos dias (evita repetir)
    const { data: jaRows } = await admin
      .from('alertas_enviados').select('usuario_id, chave')
      .eq('igreja_id', igrejaId).gt('enviado_em', new Date(agora.getTime() - 3 * 86_400_000).toISOString())
    const enviados = new Set((jaRows ?? []).map((r: { usuario_id: string; chave: string }) => `${r.usuario_id}|${r.chave}`))
    const marcar: { igreja_id: string; usuario_id: string; chave: string }[] = []
    const marcarEnviado = (uid: string, chave: string) => {
      enviados.add(`${uid}|${chave}`)
      marcar.push({ igreja_id: igrejaId, usuario_id: uid, chave })
    }

    const subsPorUsuario = new Map<string, Inscricao[]>()
    for (const s of subsIgreja) {
      const arr = subsPorUsuario.get(s.usuario_id)
      if (arr) arr.push(s)
      else subsPorUsuario.set(s.usuario_id, [s])
    }

    for (const [usuarioId, subs] of subsPorUsuario) {
      const ficha = estado.usuarios.find((u: Usuario) => u.id === usuarioId)
      if (!ficha || !ficha.ativo) continue
      const { ativos } = alertasDoUsuario(estado, usuarioId, agora, todos)
      const jaEnviado = (a: Alerta) => enviados.has(`${usuarioId}|${a.chave}`)

      // 1) Imediatos (visitante novo para a pessoa, caso de cuidado): na hora, uma vez cada
      const novos = ativos.filter((a) => a.imediato && !jaEnviado(a))
      let imediatosHoje = 0
      for (const k of enviados) if (k.startsWith(`${usuarioId}|imediato:${data}:`)) imediatosHoje++
      if (novos.length > 0 && imediatosHoje < MAX_IMEDIATOS_DIA) {
        const t = textoPushImediato(novos)
        plano.push({ igreja: igrejaId, usuario: usuarioId, tipo: 'imediato', n: novos.length })
        if (!simular) {
          const r = await enviarParaTodas(subs, { ...t, tag: 'imediato' })
          mortas.push(...r.mortas)
          if (r.ok > 0) {
            imediatosEnviados++
            for (const a of novos) marcarEnviado(usuarioId, a.chave)
            marcarEnviado(usuarioId, `imediato:${data}:${imediatosHoje + 1}`)
          }
        }
      }

      // 2) Resumo do dia: uma vez por dia, a partir da hora configurada. Avisos
      // "semanais" (visão da Gestão) só nas segundas.
      if (hora >= cfg.horaResumo && !enviados.has(`${usuarioId}|resumo:${data}`)) {
        const itens = ativos.filter((a) => (!a.imediato || !jaEnviado(a)) && (!a.semanal || diaSemana === 1))
        if (itens.length > 0) {
          const t = textoPush(itens)
          plano.push({ igreja: igrejaId, usuario: usuarioId, tipo: 'resumo', n: itens.length, ...t })
          if (!simular) {
            const r = await enviarParaTodas(subs, { ...t, tag: 'resumo' })
            mortas.push(...r.mortas)
            if (r.ok > 0) {
              resumosEnviados++
              marcarEnviado(usuarioId, `resumo:${data}`)
            }
          }
        }
      }
    }

    if (!simular && marcar.length > 0) {
      const { error: e } = await admin.from('alertas_enviados').upsert(marcar.map((m) => ({ ...m, enviado_em: agora.toISOString() })), { onConflict: 'igreja_id,usuario_id,chave' })
      if (e) console.error('falha ao registrar envios', e.message)
    }
  }

  if (!simular) {
    await apagarMortas(mortas)
    // Faxina: registros de envio com mais de 30 dias
    await admin.from('alertas_enviados').delete().lt('enviado_em', new Date(agora.getTime() - 30 * 86_400_000).toISOString())
  }
  return resposta({ ok: true, simulacao: simular, hora, imediatos: imediatosEnviados, resumos: resumosEnviados, inscricoesMortas: mortas.length, plano: simular ? plano : undefined })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return resposta({ error: 'Método não permitido' }, 405)

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return resposta({ error: 'Requisição inválida' }, 400)
  }
  const acao = texto(corpo.acao)

  try {
    // Diagnóstico aberto: só diz se o envio está pronto (nenhum segredo vaza)
    if (acao === 'saude') {
      return resposta({ ok: true, vapid: vapidPronto, motivo: vapidPronto ? undefined : vapidErro, cron: CRON_SECRET.length > 0 })
    }

    // Rotina agendada: segredo próprio, sem usuário
    if (acao === 'enviar') {
      if (!iguais(req.headers.get('x-cron-secret') ?? '', CRON_SECRET)) return resposta({ error: 'Não autorizado.' }, 401)
      return await acaoEnviar(corpo)
    }

    // Demais ações: precisam de uma pessoa logada
    const user = await usuarioDoToken(req)
    if (!user) return resposta({ error: 'Sessão inválida.' }, 401)
    switch (acao) {
      case 'chave':
        if (!vapidPronto) return resposta({ error: `As notificações ainda não estão configuradas no servidor: ${vapidErro}.` }, 503)
        return resposta({ chave: VAPID_PUBLIC })
      case 'assinar': return await acaoAssinar(user, corpo)
      case 'cancelar': return await acaoCancelar(user, corpo)
      case 'testar': return await acaoTestar(user, corpo)
      default: return resposta({ error: 'Ação desconhecida.' }, 400)
    }
  } catch (e) {
    console.error('erro inesperado', (e as Error).message)
    return resposta({ error: 'Erro inesperado no servidor.' }, 500)
  }
})
