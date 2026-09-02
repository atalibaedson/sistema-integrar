import { describe, it, expect } from 'vitest'
import { diaSemanaDoCulto, gerarOcorrencias, fmtDataVisita } from '../cultos'
import { corDeContraste } from '../tema'

describe('cultos', () => {
  it('infere o dia da semana pelo nome (com e sem acento)', () => {
    expect(diaSemanaDoCulto('Domingo — manhã')).toBe(0)
    expect(diaSemanaDoCulto('Quarta — noite')).toBe(3)
    expect(diaSemanaDoCulto('Sábado à noite')).toBe(6)
    expect(diaSemanaDoCulto('Reunião especial')).toBeUndefined()
  })

  it('gerarOcorrencias devolve datas únicas e ordenadas, todas no dia certo', () => {
    const datas = gerarOcorrencias(0, 2, 2) // domingos
    expect(datas).toEqual([...datas].sort())
    expect(new Set(datas).size).toBe(datas.length)
    for (const d of datas) {
      const [a, m, dia] = d.split('-').map(Number)
      expect(new Date(a, m - 1, dia).getDay()).toBe(0)
    }
  })

  it('fmtDataVisita formata como "dia dd/mm"', () => {
    expect(fmtDataVisita('2026-08-02')).toMatch(/^\w{3} 02\/08$/)
  })
})

describe('tema — cor de contraste', () => {
  it('escolhe texto escuro sobre cores claras e branco sobre escuras', () => {
    expect(corDeContraste('#FFFFFF')).toBe('#1A1206')
    expect(corDeContraste('#E5A13C')).toBe('#1A1206') // dourado claro → texto escuro
    expect(corDeContraste('#0042AA')).toBe('#FFFFFF') // azul royal → texto branco
    expect(corDeContraste('#000000')).toBe('#FFFFFF')
  })

  it('cor inválida é tratada como escura (texto branco)', () => {
    expect(corDeContraste('#zzz')).toBe('#FFFFFF')
  })
})
