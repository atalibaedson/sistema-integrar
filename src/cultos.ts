// Ocorrências recentes de cultos — mesma ideia do cadastro de culto do sistema
// do louvor (dia da semana → datas concretas). O culto é cadastrado de forma
// estruturada na aba ⛪ Cultos das Configurações (nome + dia + horário); aqui
// o dia da semana vira as datas de hoje até 7 dias atrás, oferecidas no
// cadastro do visitante para registrar culto E data da visita de uma vez.
import type { CultoDef } from './types'

export const DIA_SEMANA_LABEL = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado',
]

const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// Infere o dia da semana a partir do NOME do culto (ex.: "Domingo — manhã").
// Usado só na migração de listas antigas, em que o culto era um texto livre.
const DIA_POR_NOME: [RegExp, number][] = [
  [/domingo/, 0], [/segunda/, 1], [/terca/, 2], [/quarta/, 3],
  [/quinta/, 4], [/sexta/, 5], [/sabado/, 6],
]

export function diaSemanaDoCulto(nome: string): number | undefined {
  const n = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  for (const [re, dia] of DIA_POR_NOME) if (re.test(n)) return dia
  return undefined
}

// yyyy-mm-dd no fuso local (toISOString mudaria o dia perto da meia-noite)
function isoDataLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function fmtDataVisita(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia) return iso
  const d = new Date(ano, mes - 1, dia)
  return `${DIA_CURTO[d.getDay()]} ${p2(dia)}/${p2(mes)}`
}

function p2(n: number): string {
  return String(n).padStart(2, '0')
}

export interface OcorrenciaCulto {
  culto: string // nome do culto
  data: string // yyyy-mm-dd
  rotulo: string // ex.: "Domingo — manhã · dom 12/07"
}

// Cultos que aconteceram de hoje até `dias` dias atrás, mais recentes primeiro
export function ocorrenciasRecentes(cultos: CultoDef[], dias = 7): OcorrenciaCulto[] {
  const hoje = new Date()
  const out: OcorrenciaCulto[] = []
  for (let off = 0; off <= dias; off++) {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() - off)
    for (const culto of cultos) {
      if (culto.diaSemana !== d.getDay()) continue
      const data = isoDataLocal(d)
      const quando = off === 0 ? `hoje (${p2(d.getDate())}/${p2(d.getMonth() + 1)})` : fmtDataVisita(data)
      out.push({ culto: culto.nome, data, rotulo: `${culto.nome} · ${quando}` })
    }
  }
  return out
}
