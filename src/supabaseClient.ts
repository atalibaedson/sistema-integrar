// Cliente Supabase compartilhado — autenticação (Supabase Auth) e Storage.
// A sincronização de dados (nuvem.ts) continua com fetch puro; daqui ela usa
// apenas o token da sessão, para satisfazer o RLS "somente autenticado".
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getConfigNuvem, marcarSessaoPronta, setTokenSessao } from './nuvem'

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

// Sessão real = login com e-mail/senha. A sessão anônima existe só para o RLS
// e nunca deve ser confundida com "alguém logado".
export interface SessaoReal {
  userId: string
  email?: string
}
let sessaoReal: SessaoReal | null = null
// Já sabemos se há (ou não) uma sessão restaurada? Começa falso e vira true na
// 1ª notificação do Supabase. Sem nuvem, não há nada a restaurar → já "pronto".
// Evita piscar a tela de login enquanto a sessão persistida ainda carrega.
let sessaoCarregada = !supabase
const ouvintes = new Set<() => void>()

// Fluxo "esqueci a senha": o link do e-mail devolve uma sessão especial e o
// Supabase avisa com o evento PASSWORD_RECOVERY. Enquanto isto for true, o app
// mostra só a tela de definir a nova senha.
let recuperandoSenha = false
export function getRecuperandoSenha(): boolean {
  return recuperandoSenha
}

supabase?.auth.onAuthStateChange((evento, sessao) => {
  if (evento === 'PASSWORD_RECOVERY') recuperandoSenha = true
  if (evento === 'SIGNED_OUT') recuperandoSenha = false
  // O token (anônimo ou real) é injetado no nuvem.ts, que o usa em cada
  // requisição de sync para satisfazer o RLS "somente autenticado".
  sessaoCarregada = true
  setTokenSessao(sessao?.access_token ?? null)
  const anonima = (sessao?.user as { is_anonymous?: boolean } | undefined)?.is_anonymous
  sessaoReal = sessao && !anonima
    ? { userId: sessao.user.id, email: sessao.user.email ?? undefined }
    : null
  ouvintes.forEach((f) => f())
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

// Garante que exista ALGUMA sessão (anônima serve) para o sync passar no RLS.
// Chamada uma vez no boot; silenciosa se o projeto ainda não permitir
// sessões anônimas (o sync então segue só com a apikey, como hoje).
export async function garantirSessao(): Promise<void> {
  if (!supabase) {
    marcarSessaoPronta()
    return
  }
  try {
    const { data } = await supabase.auth.getSession()
    let sessao = data.session
    if (!sessao) sessao = (await supabase.auth.signInAnonymously()).data.session
    // Injeta o token na hora, sem depender da ordem em que o onAuthStateChange
    // dispara — o sync que está esperando a sessão precisa dele já.
    if (sessao?.access_token) setTokenSessao(sessao.access_token)
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

// Envia o e-mail com o link de redefinição. O link volta para a raiz do site
// (o `#` da URL é usado pelo próprio Supabase para devolver a sessão), e o app
// reconhece o evento e abre a tela de nova senha.
export async function enviarLinkRedefinicaoSenha(email: string): Promise<string | null> {
  if (!supabase) return 'Sincronização online não configurada.'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${window.location.pathname}`,
  })
  return error ? error.message : null
}

export async function definirNovaSenha(senha: string): Promise<string | null> {
  if (!supabase) return 'Sincronização online não configurada.'
  const { error } = await supabase.auth.updateUser({ password: senha })
  if (!error) {
    recuperandoSenha = false
    ouvintes.forEach((f) => f())
  }
  return error ? error.message : null
}

export async function sairDaConta(): Promise<void> {
  await supabase?.auth.signOut()
  // Sem sessão nenhuma o sync para de passar no RLS até recarregar a página.
  // Recria a sessão anônima para o aparelho continuar sincronizando.
  await garantirSessao()
}
