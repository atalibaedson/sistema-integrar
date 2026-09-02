import { describe, it, expect } from 'vitest'
import { podeTransitar, transicoesDisponiveis, aplicarTransicao, mesesDesde, diasDesde } from '../machine'
import type { Visitante } from '../types'

function visitante(status: Visitante['status']): Visitante {
  const agora = new Date().toISOString()
  return {
    id: 'v1', nome: 'Teste', whatsapp: '11999999999', dataCadastro: agora,
    origem: 'culto', status,
    flagMenorIdade: false, flagOutraCidade: false, flagCuidado: false,
    transferenciaConfirmada: false, consentimentoLgpd: true,
    historicoStatus: [{ de: null, para: status, data: agora, motivo: 'x', automatica: false }],
    criadoEm: agora, atualizadoEm: agora,
  }
}

describe('máquina de estados', () => {
  it('permite transições válidas do funil', () => {
    expect(podeTransitar('novo', 'em_contato')).toBe(true)
    expect(podeTransitar('em_contato', 'encaminhado_lider')).toBe(true)
    expect(podeTransitar('transferido', 'batismo')).toBe(true)
    expect(podeTransitar('transferido', 'integrado')).toBe(true)
  })

  it('bloqueia saltos inválidos', () => {
    expect(podeTransitar('novo', 'integrado')).toBe(false)
    expect(podeTransitar('novo', 'transferido')).toBe(false)
    expect(podeTransitar('integrado', 'em_contato')).toBe(false)
  })

  it('"recusou" só a partir de quem ainda está no acompanhamento', () => {
    expect(podeTransitar('em_contato', 'recusou')).toBe(true)
    expect(podeTransitar('visitou', 'recusou')).toBe(true)
    expect(podeTransitar('integrado', 'recusou')).toBe(false)
    expect(podeTransitar('encerrado', 'recusou')).toBe(false)
    expect(podeTransitar('recusou', 'recusou')).toBe(false)
  })

  it('transicoesDisponiveis inclui "recusou" fora do fim de linha', () => {
    expect(transicoesDisponiveis('em_contato')).toContain('recusou')
    expect(transicoesDisponiveis('integrado')).not.toContain('recusou')
    expect(transicoesDisponiveis('integrado')).toHaveLength(0)
  })

  it('aplicarTransicao grava histórico e joga erro em transição inválida', () => {
    const v = visitante('novo')
    const depois = aplicarTransicao(v, 'em_contato', 'primeiro contato')
    expect(depois.status).toBe('em_contato')
    expect(depois.historicoStatus).toHaveLength(2)
    expect(depois.historicoStatus[1]).toMatchObject({ de: 'novo', para: 'em_contato' })
    expect(() => aplicarTransicao(visitante('novo'), 'integrado', 'x')).toThrow()
  })

  it('transferenciaConfirmada acompanha o status', () => {
    expect(aplicarTransicao(visitante('visitou'), 'transferido', 'x').transferenciaConfirmada).toBe(true)
    // ao voltar para o time, zera
    expect(aplicarTransicao(visitante('transferido'), 'em_contato', 'x').transferenciaConfirmada).toBe(false)
  })

  it('mesesDesde conta por calendário e nunca fica negativo', () => {
    const hoje = new Date()
    const tresMeses = new Date(hoje.getFullYear(), hoje.getMonth() - 3, hoje.getDate())
    expect(mesesDesde(tresMeses.toISOString().slice(0, 10))).toBe(3)
    const futuro = new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate())
    expect(mesesDesde(futuro.toISOString().slice(0, 10))).toBe(0)
  })

  it('diasDesde conta dias corridos', () => {
    const dezDias = new Date(Date.now() - 10 * 86_400_000).toISOString()
    expect(diasDesde(dezDias)).toBe(10)
  })
})
