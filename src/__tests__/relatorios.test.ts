import { describe, it, expect } from 'vitest'
import { diaLocal, dentroDoPeriodo, jaAlcancou, funil, distribuicao } from '../relatorios'
import type { Visitante } from '../types'

function vis(status: Visitante['status'], historico: Visitante['status'][] = []): Visitante {
  const agora = '2026-01-01T00:00:00.000Z'
  return {
    id: Math.random().toString(36).slice(2), nome: 'x', whatsapp: '1', dataCadastro: agora,
    origem: 'culto', status, flagMenorIdade: false, flagOutraCidade: false, flagCuidado: false,
    transferenciaConfirmada: false, consentimentoLgpd: true,
    historicoStatus: historico.map((para) => ({ de: null, para, data: agora, motivo: '', automatica: false })),
    criadoEm: agora, atualizadoEm: agora,
  }
}

describe('relatórios (puros)', () => {
  it('diaLocal mantém datas só-dia e converte ISO para o dia local', () => {
    expect(diaLocal('2026-08-01')).toBe('2026-08-01')
    expect(diaLocal('2026-08-01T10:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('dentroDoPeriodo respeita os limites inclusivos', () => {
    const p = { de: '2026-01-01', ate: '2026-01-31' }
    expect(dentroDoPeriodo('2026-01-15T12:00:00.000Z', p)).toBe(true)
    expect(dentroDoPeriodo('2026-02-01T12:00:00.000Z', p)).toBe(false)
    expect(dentroDoPeriodo(undefined, p)).toBe(false)
  })

  it('jaAlcancou olha status atual e histórico', () => {
    expect(jaAlcancou(vis('transferido'), ['visitou'])).toBe(false) // não passou por visitou
    expect(jaAlcancou(vis('transferido', ['visitou', 'transferido']), ['visitou'])).toBe(true)
    expect(jaAlcancou(vis('integrado'), ['integrado'])).toBe(true)
  })

  it('funil é monotônico decrescente do topo ao fim', () => {
    const vs = [
      vis('integrado', ['em_contato', 'encaminhado_lider', 'visitou', 'transferido', 'integrado']),
      vis('visitou', ['em_contato', 'encaminhado_lider', 'visitou']),
      vis('novo'),
    ]
    const etapas = funil(vs)
    const cadastrados = etapas.find((e) => e.chave === 'cadastrados')!
    const integrados = etapas.find((e) => e.chave === 'integrado')!
    expect(cadastrados.total).toBe(3)
    expect(integrados.total).toBe(1)
    for (let i = 1; i < etapas.length; i++) {
      expect(etapas[i].total).toBeLessThanOrEqual(etapas[i - 1].total)
    }
  })

  it('distribuicao conta e calcula porcentagem', () => {
    const d = distribuicao(['a', 'a', 'b', undefined], (x) => x, 'sem')
    const a = d.find((f) => f.rotulo === 'a')!
    expect(a.valor).toBe(2)
    expect(a.pct).toBe(50)
    expect(d.find((f) => f.rotulo === 'sem')!.valor).toBe(1)
  })
})
