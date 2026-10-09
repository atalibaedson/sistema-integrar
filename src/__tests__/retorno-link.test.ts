import { describe, expect, it } from 'vitest'
import { interpretarRetornoLink, mensagemLinkInvalido, urlSemRetorno } from '../retornoLink'
import { urlDoAppParaHost } from '../urlApp'

describe('interpretarRetornoLink', () => {
  it('reconhece os três formatos do link', () => {
    expect(interpretarRetornoLink('?code=abc123', '')).toEqual({ tipo: 'pkce', code: 'abc123' })
    expect(interpretarRetornoLink('', '#access_token=tok&refresh_token=r&type=signup')).toEqual({ tipo: 'implicito', recuperacao: false })
    expect(interpretarRetornoLink('', '#access_token=tok&type=recovery')).toEqual({ tipo: 'implicito', recuperacao: true })
    expect(interpretarRetornoLink('?token_hash=h4sh&type=signup', '')).toEqual({ tipo: 'token_hash', tokenHash: 'h4sh', tipoOtp: 'signup' })
    expect(interpretarRetornoLink('?token_hash=h4sh&type=recovery', '')).toEqual({ tipo: 'token_hash', tokenHash: 'h4sh', tipoOtp: 'recovery' })
  })
  it('rotas normais do app não são retorno', () => {
    expect(interpretarRetornoLink('', '#/visitantes')).toEqual({ tipo: 'nenhum' })
    expect(interpretarRetornoLink('', '')).toEqual({ tipo: 'nenhum' })
    expect(interpretarRetornoLink('?x=1', '#/config?aba=avisos')).toEqual({ tipo: 'nenhum' })
  })
  it('token_hash com tipo desconhecido é ignorado', () => {
    expect(interpretarRetornoLink('?token_hash=h&type=qualquer', '')).toEqual({ tipo: 'nenhum' })
    expect(interpretarRetornoLink('?token_hash=h', '')).toEqual({ tipo: 'nenhum' })
  })
  it('link vencido volta com erro no #', () => {
    const r = interpretarRetornoLink('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    expect(r).toEqual({ tipo: 'erro', codigo: 'otp_expired', descricao: 'Email link is invalid or has expired' })
    expect(mensagemLinkInvalido('otp_expired')).toMatch(/expirou ou já foi usado/)
    expect(mensagemLinkInvalido('outro')).toMatch(/Não foi possível/)
  })
  it('limpa só os parâmetros do retorno da URL', () => {
    expect(urlSemRetorno('https://x.com/?code=abc#/entrar')).toBe('https://x.com/#/entrar')
    expect(urlSemRetorno('https://x.com/?token_hash=h&type=signup&ref=1')).toBe('https://x.com/?ref=1')
    expect(urlSemRetorno('https://x.com/#access_token=t&type=signup')).toBe('https://x.com/')
  })
})

describe('urlDoAppParaHost', () => {
  it('endereço público de visitante volta para o app da mesma igreja', () => {
    expect(urlDoAppParaHost('visitantesjc.ifamiliaextraordinaria.com.br', 'https://visitantesjc.ifamiliaextraordinaria.com.br'))
      .toBe('https://integracaoifesjc.ifamiliaextraordinaria.com.br')
    expect(urlDoAppParaHost('visitante.ifamiliaextraordinaria.com.br', 'https://visitante.ifamiliaextraordinaria.com.br'))
      .toBe('https://integracaoife.ifamiliaextraordinaria.com.br')
  })
  it('os apps usam o próprio endereço, sem barra final', () => {
    expect(urlDoAppParaHost('integracaoifesjc.ifamiliaextraordinaria.com.br', 'https://integracaoifesjc.ifamiliaextraordinaria.com.br'))
      .toBe('https://integracaoifesjc.ifamiliaextraordinaria.com.br')
    expect(urlDoAppParaHost('localhost', 'http://localhost:5173/')).toBe('http://localhost:5173')
  })
})
