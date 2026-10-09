// Retorno dos links de e-mail (confirmar cadastro, redefinir senha, convite).
// O link traz a pessoa de volta à raiz do site em um de três formatos, conforme o
// modelo de e-mail e o fluxo do Supabase:
//   • ?code=…                 — fluxo PKCE (o supabase-js troca o código por sessão);
//   • #access_token=…         — fluxo implícito (o supabase-js lê o # sozinho);
//   • ?token_hash=…&type=…    — link direto do modelo de e-mail (precisa de verifyOtp).
// E, quando o link expirou ou já foi usado (comum: antivírus de e-mail "clica"
// antes da pessoa), volta com #error=…&error_code=otp_expired.
// Este módulo só INTERPRETA a URL (puro, testado); quem age é supabaseClient.ts.

export type TipoOtp = 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' | 'email'
const TIPOS_OTP: TipoOtp[] = ['signup', 'recovery', 'invite', 'magiclink', 'email_change', 'email']

export type RetornoLink =
  | { tipo: 'nenhum' }
  | { tipo: 'pkce'; code: string }
  | { tipo: 'implicito'; recuperacao: boolean }
  | { tipo: 'token_hash'; tokenHash: string; tipoOtp: TipoOtp }
  | { tipo: 'erro'; codigo: string; descricao: string }

function params(texto: string): URLSearchParams {
  return new URLSearchParams(texto.replace(/^[?#]/, ''))
}

export function interpretarRetornoLink(search: string, hash: string): RetornoLink {
  // O app usa rotas no #, mas o retorno do Supabase também chega no # (ex.: "#access_token=…").
  // Rotas do app começam com "#/" — não são retorno.
  const h = hash.startsWith('#/') ? new URLSearchParams() : params(hash)
  const q = params(search)

  // Erro vem no # (#error=access_denied&error_code=otp_expired&error_description=…); algumas versões usam ?
  const erro = h.get('error') ?? q.get('error')
  if (erro) {
    const codigo = h.get('error_code') ?? q.get('error_code') ?? erro
    const descricao = (h.get('error_description') ?? q.get('error_description') ?? '').replace(/\+/g, ' ')
    return { tipo: 'erro', codigo, descricao }
  }
  if (h.get('access_token')) return { tipo: 'implicito', recuperacao: h.get('type') === 'recovery' }

  const tokenHash = q.get('token_hash')
  const tipoOtp = q.get('type') as TipoOtp | null
  if (tokenHash && tipoOtp && TIPOS_OTP.includes(tipoOtp)) return { tipo: 'token_hash', tokenHash, tipoOtp }

  const code = q.get('code')
  if (code) return { tipo: 'pkce', code }
  return { tipo: 'nenhum' }
}

/** Mensagem para a pessoa quando o link não funcionou. */
export function mensagemLinkInvalido(codigo: string): string {
  if (/otp_expired|expired/i.test(codigo)) {
    return 'O link expirou ou já foi usado. Se você já confirmou o e-mail, é só entrar com a sua senha; se não, peça um novo link.'
  }
  return 'Não foi possível concluir pelo link do e-mail. Entre com a sua senha ou peça um novo link.'
}

// A URL sem os parâmetros do retorno (para não repetir o processamento ao recarregar)
export function urlSemRetorno(href: string): string {
  const u = new URL(href)
  for (const k of ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description']) u.searchParams.delete(k)
  const hash = u.hash && !u.hash.startsWith('#/') ? '' : u.hash
  return `${u.origin}${u.pathname}${u.searchParams.toString() ? `?${u.searchParams}` : ''}${hash}`
}
