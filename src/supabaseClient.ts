// Cliente Supabase compartilhado — autenticação (Supabase Auth) e Storage.
// A sincronização de dados (nuvem.ts) continua com fetch puro; daqui ela usa
// apenas o token da sessão, para satisfazer o RLS "somente autenticado".
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getConfigNuvem, setTokenSessao } from './nuvem'

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
const ouvintes = new Set<() => void>()

supabase?.auth.onAuthStateChange((_evento, sessao) => {
  // O token (anônimo ou real) é injetado no nuvem.ts, que o usa em cada
  // requisição de sync para satisfazer o RLS "somente autenticado".
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

export function assinarSessao(cb: () => void): () => void {
  ouvintes.add(cb)
  return () => ouvintes.delete(cb)
}

// Garante que exista ALGUMA sessão (anônima serve) para o sync passar no RLS.
// Chamada uma vez no boot; silenciosa se o projeto ainda não permitir
// sessões anônimas (o sync então segue só com a apikey, como hoje).
export async function garantirSessao(): Promise<void> {
  if (!supabase) return
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) await supabase.auth.signInAnonymously()
  } catch {
    // sem rede ou anônimo desabilitado: o app continua funcionando offline
  }
}

export async function sairDaConta(): Promise<void> {
  await supabase?.auth.signOut()
}
