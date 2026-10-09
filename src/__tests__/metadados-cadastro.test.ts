import { describe, expect, it } from 'vitest'
import { montarMetadadosCadastro } from '../metadadosCadastro'
import { lerSolicitacao } from '../regras-membros'

const base = {
  nome: '  Maria Souza ', whatsapp: '(12) 99999-0000', dataNascimento: '1990-05-17', conexao: 'k3j2h1',
  papeis: ['consolidador' as const], loginPreferido: 'email' as const, consentimentoLgpd: true, igrejaId: 'ife-sjc',
  agora: new Date('2026-10-09T12:00:00Z'),
}

describe('metadados do signUp', () => {
  it('segue o padrão combinado: origem, nome, telefone, nascimento, conexao', () => {
    const m = montarMetadadosCadastro(base)
    expect(m).toMatchObject({ origem: 'integrar', nome: 'Maria Souza', telefone: '12999990000', nascimento: '1990-05-17', conexao: 'k3j2h1' })
    expect(Object.keys(m).sort()).toEqual(['conexao', 'integrar', 'nascimento', 'nome', 'origem', 'telefone'])
  })
  it("sem conexão escolhida vira 'nenhuma'; sem nascimento, vazio", () => {
    const m = montarMetadadosCadastro({ ...base, conexao: '', dataNascimento: undefined })
    expect(m.conexao).toBe('nenhuma')
    expect(m.nascimento).toBe('')
  })
  it('o servidor consegue ler de volta exatamente o que o app mandou', () => {
    const r = lerSolicitacao(montarMetadadosCadastro(base), undefined, { igrejaId: 'ife-sjc', automatico: true, agora: base.agora })
    expect(r.ok && r.solicitacao).toMatchObject({
      nome: 'Maria Souza', whatsapp: '(12) 99999-0000', dataNascimento: '1990-05-17', conexaoParticipaId: 'k3j2h1', papeis: ['consolidador'],
    })
  })
  it('sem a autorização LGPD o pedido não passa', () => {
    const r = lerSolicitacao(montarMetadadosCadastro({ ...base, consentimentoLgpd: false }), undefined, { igrejaId: 'ife-sjc', automatico: true })
    expect(r.ok).toBe(false)
  })
})
