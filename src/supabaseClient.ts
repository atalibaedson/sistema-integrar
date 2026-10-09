// Cliente Supabase compartilhado — autenticação (Supabase Auth) e Storage.
// A sincronização de dados (nuvem.ts) continua com fetch puro; daqui ela usa
// apenas o token da sessão, para satisfazer o RLS "somente autenticado".
import { useSyncExternalStore } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getConfigNuvem, marcarSessaoPronta, setTokenSessao } from './nuvem'
import { MODO_DEMO, SESSAO_DEMO } from './demo'
import { interpretarRetornoLink, mensagemLinkInvalido, urlSemRetorno, type RetornoLink } from './retornoLink'

function criar(): SupabaseClient | null {
  const c = getConfigNuvem()
  if (!c) return null
  return createClient(c.url, c.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Consome o #access_token=... que o link de confirmação de e-mail traz
      // e limpa o hash ANTES de o roteador (também hash-based) renderizar.
      detectSessionInUrl: true,
    },
  })
}

export const supabase = criar()

// ---- Acesso à igreja (vínculo `membros_igreja`) — decidido pelo SERVIDOR ----
//
// O vínculo libera a leitura do bloco da igreja (cuidado pastoral, crises…), então
// só nasce quando a liderança aprova a pessoa — e quem confere é a Edge Function
// `acesso-membro`, nunca este navegador. Conta pendente não lê o bloco: vê a tela
// "aguardando aprovação", cujo status vem da função (só a situação da própria conta).
export type StatusConta = 'sem_ficha' | 'pendente_aprovacao' | 'aprovado' | 'rejeitado' | 'inativo'

export interface AcessoConta {
  carregado: boolean // já perguntamos ao servidor nesta sessão?
  status?: StatusConta
  vinculado: boolean // a conta tem vínculo com a igreja (pode ler o bloco)
  nome?: string
  motivo?: string // motivo da rejeição
  podePrimeiroAdmin: boolean // a igreja ainda não tem nenhum administrador aprovado
  falhou?: string // não foi possível consultar (sem rede…)
}

const ACESSO_VAZIO: AcessoConta = { carregado: false, vinculado: false, podePrimeiroAdmin: false }
let acesso: AcessoConta = ACESSO_VAZIO
let acessoEmCurso: { userId: string; promessa: Promise<void> } | null = null
const ouvintesAcesso = new Set<() => void>()

export function getAcessoConta(): AcessoConta {
  return acesso
}
export function assinarAcesso(cb: () => void): () => void {
  ouvintesAcesso.add(cb)
  return () => ouvintesAcesso.delete(cb)
}
function definirAcesso(a: AcessoConta) {
  acesso = a
  ouvintesAcesso.forEach((f) => f())
}

export interface ResultadoServidor { ok: boolean; erro?: string; semDados?: boolean; dados?: Record<string, unknown> }

// Chama a Edge Function acesso-membro (com o token da sessão). A mensagem de erro
// do servidor vem em português no corpo da resposta.
async function chamarAcesso(acao: string, extra: Record<string, unknown> = {}): Promise<ResultadoServidor> {
  const igrejaId = getConfigNuvem()?.igrejaId
  if (!supabase || !igrejaId) return { ok: false, erro: 'Sincronização online não configurada.' }
  try {
    const { data, error } = await supabase.functions.invoke('acesso-membro', { body: { acao, igrejaId, ...extra } })
    if (error) {
      let msg = 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.'
      try {
        const ctx = (error as { context?: Response }).context
        const j = ctx ? await ctx.json() : null
        if (j?.error) msg = String(j.error)
      } catch { /* mantém a mensagem genérica */ }
      return { ok: false, erro: msg }
    }
    const d = (data ?? {}) as Record<string, unknown>
    if (d.ok === false) return { ok: false, erro: String(d.error ?? 'Não foi possível concluir.'), semDados: d.semDados === true }
    return { ok: true, dados: d }
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor. Tente de novo.' }
  }
}

// Pergunta ao servidor a situação desta conta (e, se já aprovada, ele garante o
// vínculo). Uma consulta por usuário; `forcar` refaz (depois de pedir acesso, ou
// para a tela de espera perceber a aprovação).
export function garantirVinculoIgreja(userId: string, forcar = false): Promise<void> {
  if (!supabase) return Promise.resolve()
  // outra conta entrou neste aparelho: não herda a resposta da anterior
  if (acessoEmCurso && acessoEmCurso.userId !== userId) definirAcesso(ACESSO_VAZIO)
  if (!forcar && acessoEmCurso?.userId === userId) return acessoEmCurso.promessa
  const registro: { userId: string; promessa: Promise<void> } = { userId, promessa: Promise.resolve() }
  acessoEmCurso = registro
  registro.promessa = (async () => {
    const r = await chamarAcesso('status')
    if (!r.ok || !r.dados) {
      // falhou: libera para tentar de novo numa próxima chamada
      if (acessoEmCurso === registro) acessoEmCurso = null
      definirAcesso({ ...acesso, carregado: true, falhou: r.erro ?? 'Falha ao consultar.' })
      return
    }
    const d = r.dados
    definirAcesso({
      carregado: true,
      status: d.status as StatusConta,
      vinculado: d.vinculado === true,
      nome: typeof d.nome === 'string' ? d.nome : undefined,
      motivo: typeof d.motivo === 'string' ? d.motivo : undefined,
      podePrimeiroAdmin: d.podePrimeiroAdmin === true,
    })
  })()
  return registro.promessa
}

// Aguarda a resposta, mas nunca mais que `limiteMs` (sem rede, a função pode
// demorar — o app não pode ficar parado por causa disso).
export function aguardarVinculoIgreja(userId: string, limiteMs = 4000): Promise<void> {
  return Promise.race([
    garantirVinculoIgreja(userId),
    new Promise<void>((r) => setTimeout(r, limiteMs)),
  ])
}

/** Cria a ficha PENDENTE desta conta no servidor (dos metadados do cadastro, ou do que a pessoa confirmou). */
export async function solicitarAcesso(
  opcoes: { automatico?: boolean; ficha?: Record<string, unknown> } = {},
): Promise<ResultadoServidor> {
  const r = await chamarAcesso('solicitar', {
    ...(opcoes.automatico ? { automatico: true } : {}),
    ...(opcoes.ficha ? { ficha: opcoes.ficha } : {}),
  })
  if (r.ok) {
    const id = sessaoReal?.userId
    if (id) await garantirVinculoIgreja(id, true)
  }
  return r
}

/** A liderança libera o vínculo de outra conta (o servidor confere que quem chama pode aprovar). */
export function aprovarNoServidor(authUserId: string): Promise<ResultadoServidor> {
  return chamarAcesso('aprovar', { authUserId })
}

/**
 * A liderança retira o vínculo de quem foi desativado na Equipe (o servidor confere quem chama).
 * Sem nuvem (modo local/demonstração) não há vínculo a retirar.
 */
export async function revogarNoServidor(authUserId: string): Promise<ResultadoServidor> {
  if (!supabase) return { ok: true }
  return chamarAcesso('revogar', { authUserId })
}

/** Enquanto a igreja não tem administrador aprovado, a própria pessoa ativa o seu acesso. */
export async function virarPrimeiroAdminNoServidor(): Promise<ResultadoServidor> {
  const r = await chamarAcesso('primeiro_admin')
  if (r.ok) {
    const id = sessaoReal?.userId
    if (id) await garantirVinculoIgreja(id, true)
  }
  return r
}

export function useAcessoConta(): AcessoConta {
  return useSyncExternalStore(assinarAcesso, getAcessoConta)
}

// Sessão real = login com e-mail/senha. A sessão anônima existe só para o RLS
// e nunca deve ser confundida com "alguém logado".
export interface SessaoReal {
  userId: string
  email?: string
}
// No modo demonstração (sem nuvem) a sessão é fingida — ver demo.ts.
let sessaoReal: SessaoReal | null = MODO_DEMO ? SESSAO_DEMO : null
// Já sabemos se há (ou não) uma sessão restaurada? Começa falso e vira true na
// 1ª notificação do Supabase. Sem nuvem, não há nada a restaurar → já "pronto".
// Evita piscar a tela de login enquanto a sessão persistida ainda carrega.
let sessaoCarregada = !supabase
const ouvintes = new Set<() => void>()

supabase?.auth.onAuthStateChange((evento, sessao) => {
  // O token (anônimo ou real) é injetado no nuvem.ts, que o usa em cada
  // requisição de sync para satisfazer o RLS "somente autenticado".
  sessaoCarregada = true
  setTokenSessao(sessao?.access_token ?? null)
  const anonima = (sessao?.user as { is_anonymous?: boolean } | undefined)?.is_anonymous
  sessaoReal = sessao && !anonima
    ? { userId: sessao.user.id, email: sessao.user.email ?? undefined }
    : null
  ouvintes.forEach((f) => f())
  // Sessão real: garante o vínculo com a igreja deste site (RLS por igreja).
  if (sessao && !anonima) void garantirVinculoIgreja(sessao.user.id)
  // Link "Esqueci a senha": o token do e-mail já virou sessão (consumido do #
  // da URL acima); leva a pessoa direto para a tela de definir a nova senha.
  if (evento === 'PASSWORD_RECOVERY') window.location.hash = '/nova-senha'
})

export function getSessaoReal(): SessaoReal | null {
  return sessaoReal
}

// A verificação inicial de sessão (restaurar a persistida) já terminou?
export function getSessaoCarregada(): boolean {
  return sessaoCarregada
}

export function assinarSessao(cb: () => void): () => void {
  ouvintes.add(cb)
  return () => ouvintes.delete(cb)
}

// ---- Retorno dos links de e-mail (confirmar cadastro, redefinir senha) ----
//
// O link traz a pessoa de volta à RAIZ do site em um de três formatos (?code=,
// #access_token= ou ?token_hash=&type=); ver retornoLink.ts. O `#access_token` e o
// `?code=` com verificador o próprio supabase-js trata (detectSessionInUrl). Aqui
// ficam o `?token_hash=` (verifyOtp), o `?code=` que não pôde ser concluído e o
// erro de link vencido — com um aviso claro na tela de entrada.
const CHAVE_AVISO_LINK = 'ife-aviso-link'

/** Aviso deixado pelo retorno de um link com problema (lido uma vez pela tela de entrada). */
export function lerAvisoDoLink(): string {
  try {
    const m = sessionStorage.getItem(CHAVE_AVISO_LINK) ?? ''
    if (m) sessionStorage.removeItem(CHAVE_AVISO_LINK)
    return m
  } catch {
    return ''
  }
}

function avisarLink(mensagem: string) {
  try { sessionStorage.setItem(CHAVE_AVISO_LINK, mensagem) } catch { /* sem storage: a pessoa só não vê o aviso */ }
  window.location.hash = '/entrar'
}

async function tratarRetorno(r: RetornoLink): Promise<void> {
  if (!supabase) return
  switch (r.tipo) {
    case 'erro':
      history.replaceState(null, '', urlSemRetorno(window.location.href))
      avisarLink(mensagemLinkInvalido(r.codigo))
      return
    case 'token_hash': {
      const { error } = await supabase.auth.verifyOtp({ token_hash: r.tokenHash, type: r.tipoOtp })
      history.replaceState(null, '', urlSemRetorno(window.location.href))
      if (error) avisarLink(mensagemLinkInvalido(error.message))
      else if (r.tipoOtp === 'recovery') window.location.hash = '/nova-senha'
      else window.location.hash = '/'
      return
    }
    case 'pkce': {
      // Se há verificador, o supabase-js troca o código sozinho ao iniciar; esperamos isso
      // acabar. Se mesmo assim não houver sessão, o link foi aberto em outro navegador.
      const { data } = await supabase.auth.getSession()
      history.replaceState(null, '', urlSemRetorno(window.location.href))
      if (!data.session) avisarLink('Abra o link no mesmo navegador em que fez o pedido, ou entre com a sua senha.')
      return
    }
    default:
      return // implícito: já tratado pelo supabase-js; nenhum: nada a fazer
  }
}

const retornoDoLink: Promise<void> = (typeof window !== 'undefined' && supabase)
  ? tratarRetorno(interpretarRetornoLink(window.location.search, window.location.hash)).catch(() => undefined)
  : Promise.resolve()

// Garante que exista ALGUMA sessão (anônima serve) para o sync passar no RLS.
// Chamada uma vez no boot; silenciosa se o projeto ainda não permitir
// sessões anônimas (o sync então segue só com a apikey, como hoje).
export async function garantirSessao(): Promise<void> {
  if (!supabase) {
    marcarSessaoPronta()
    return
  }
  try {
    await retornoDoLink // o retorno de um link de e-mail pode estar criando a sessão agora
    const { data } = await supabase.auth.getSession()
    let sessao = data.session
    if (!sessao) sessao = (await supabase.auth.signInAnonymously()).data.session
    // Injeta o token na hora, sem depender da ordem em que o onAuthStateChange
    // dispara — o sync que está esperando a sessão precisa dele já.
    if (sessao?.access_token) setTokenSessao(sessao.access_token)
    // Sessão real: o vínculo com a igreja precisa existir ANTES da 1ª leitura —
    // com o RLS por igreja, ler sem ele volta vazio e gravar é recusado.
    const anonima = (sessao?.user as { is_anonymous?: boolean } | undefined)?.is_anonymous
    if (sessao && !anonima) await aguardarVinculoIgreja(sessao.user.id)
  } catch {
    // sem rede ou anônimo desabilitado: o app continua funcionando offline
  } finally {
    // Garante que o app saia do "carregando" mesmo se o onAuthStateChange
    // não disparar (ex.: anônimo desabilitado e sem sessão a restaurar).
    sessaoCarregada = true
    ouvintes.forEach((f) => f())
    marcarSessaoPronta() // libera a primeira sincronização
  }
}

export async function sairDaConta(): Promise<void> {
  await supabase?.auth.signOut()
  acessoEmCurso = null
  definirAcesso(ACESSO_VAZIO)
  // Sem sessão nenhuma o sync para de passar no RLS até recarregar a página.
  // Recria a sessão anônima para o aparelho continuar sincronizando.
  await garantirSessao()
}
