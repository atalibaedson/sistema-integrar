// Cliente Supabase compartilhado — autenticação (Supabase Auth) e Storage.
// A sincronização de dados (nuvem.ts) continua com fetch puro; daqui ela usa
// apenas o token da sessão, para satisfazer o RLS "somente autenticado".
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getConfigNuvem, marcarSessaoPronta, setTokenSessao } from './nuvem'
import { MODO_DEMO, SESSAO_DEMO } from './demo'

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

// Garante o vínculo da conta com a igreja deste site (RLS por igreja). Roda
// uma vez por usuário logado — cobre login, cadastro, recuperação de senha e a
// restauração de sessão no boot. Assim, quem o backfill inicial não pegou (ex.:
// id da ficha ≠ id de login) se autocorrige só de abrir o app. A Edge Function
// registrar-membro só deixa a pessoa se ligar à igreja do próprio site.
// Best-effort: falha (sem rede, função ausente) não atrapalha o uso do app.
// Devolve uma promessa COMPARTILHADA por usuário: quem precisa do vínculo antes
// de gravar (boot, cadastro de integrante) pode aguardá-la — com o RLS por
// igreja ativo, gravar antes do vínculo existir seria recusado pelo banco.
let vinculoEmCurso: { userId: string; promessa: Promise<void> } | null = null
export function garantirVinculoIgreja(userId: string): Promise<void> {
  if (!supabase) return Promise.resolve()
  if (vinculoEmCurso?.userId === userId) return vinculoEmCurso.promessa
  const cliente = supabase
  // O registro existe ANTES de a função começar: se ela terminar de forma
  // síncrona (sem igreja configurada), o finally já o encontra.
  const registro: { userId: string; promessa: Promise<void> } = { userId, promessa: Promise.resolve() }
  vinculoEmCurso = registro
  registro.promessa = (async () => {
    let ok = false
    try {
      const igrejaId = getConfigNuvem()?.igrejaId
      if (!igrejaId) return
      const { error } = await cliente.functions.invoke('registrar-membro', { body: { igrejaId } })
      // functions.invoke devolve {error} SEM lançar em respostas 4xx/5xx.
      ok = !error
    } catch {
      ok = false
    } finally {
      // Falhou: libera para tentar de novo numa próxima sessão/chamada.
      if (!ok && vinculoEmCurso === registro) vinculoEmCurso = null
    }
  })()
  return registro.promessa
}

// Aguarda o vínculo, mas nunca mais que `limiteMs` (sem rede, a função pode
// demorar — o app não pode ficar parado por causa disso).
export function aguardarVinculoIgreja(userId: string, limiteMs = 4000): Promise<void> {
  return Promise.race([
    garantirVinculoIgreja(userId),
    new Promise<void>((r) => setTimeout(r, limiteMs)),
  ])
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
  // Sem sessão nenhuma o sync para de passar no RLS até recarregar a página.
  // Recria a sessão anônima para o aparelho continuar sincronizando.
  await garantirSessao()
}
