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

// "Domingo 27/07/2026" — dia da semana + data por extenso curto
export function fmtDataComDia(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia) return iso
  const d = new Date(ano, mes - 1, dia)
  return `${DIA_SEMANA_LABEL[d.getDay()]} ${p2(dia)}/${p2(mes)}/${ano}`
}

// Gera as datas concretas de um culto: `passado` semanas para trás e `futuro`
// semanas para frente, a partir da ocorrência mais próxima do dia da semana.
// Ex.: gerarOcorrencias(0, 4, 4) → 4 domingos recentes + próximos 4 (ordenadas).
export function gerarOcorrencias(diaSemana: number, passado = 4, futuro = 4): string[] {
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  // Recua até a ocorrência mais recente (hoje, se cair no dia)
  const base = new Date(hoje)
  while (base.getDay() !== diaSemana) base.setDate(base.getDate() - 1)
  const datas: string[] = []
  for (let i = -passado; i <= futuro; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i * 7)
    datas.push(isoDataLocal(d))
  }
  return [...new Set(datas)].sort()
}

// Gera mais `qtd` datas futuras do dia da semana, começando logo após a última
// data já existente (ou após hoje). Usado pelo botão "Gerar mais 8".
export function gerarMaisOcorrencias(diaSemana: number, existentes: string[], qtd = 8): string[] {
  const ultima = existentes.length > 0 ? [...existentes].sort().slice(-1)[0] : undefined
  const partida = ultima ? new Date(`${ultima}T12:00:00`) : new Date()
  partida.setHours(12, 0, 0, 0)
  const d = new Date(partida)
  // Avança para a próxima ocorrência do dia da semana, depois da data de partida
  do { d.setDate(d.getDate() + 1) } while (d.getDay() !== diaSemana)
  const novas: string[] = []
  for (let i = 0; i < qtd; i++) {
    novas.push(isoDataLocal(d))
    d.setDate(d.getDate() + 7)
  }
  return [...new Set([...existentes, ...novas])].sort()
}

export interface OcorrenciaCulto {
  culto: string // nome do culto
  data: string // yyyy-mm-dd
  horario?: string
  rotulo: string // ex.: "Celebração manhã · dom 02/08 · 10:00"
}

// Ocorrências oferecidas no cadastro do visitante: só as da última semana até
// hoje (janela [hoje-7, hoje]). Assim, num domingo aparecem o culto de hoje e o
// da semana passada; num sábado (culto de domingo) aparece só o de domingo
// passado. Usa as datas cadastradas (ocorrencias); se o culto não tiver lista,
// cai para a derivação pelo dia da semana — nada quebra em dados antigos.
export function ocorrenciasParaVisitante(cultos: CultoDef[]): OcorrenciaCulto[] {
  const hojeD = new Date()
  hojeD.setHours(12, 0, 0, 0)
  const hoje = isoDataLocal(hojeD)
  const limite = new Date(hojeD)
  limite.setDate(hojeD.getDate() - 7)
  const inicio = isoDataLocal(limite)

  const rotular = (culto: CultoDef, data: string): OcorrenciaCulto => ({
    culto: culto.nome,
    data,
    horario: culto.horario,
    rotulo: `${culto.nome} · ${fmtDataVisita(data)}${culto.horario ? ` · ${culto.horario}` : ''}`,
  })

  const out: OcorrenciaCulto[] = []
  for (const culto of cultos) {
    const lista = (culto.ocorrencias && culto.ocorrencias.length > 0)
      ? culto.ocorrencias
      : culto.diaSemana !== undefined
        ? gerarOcorrencias(culto.diaSemana, 1, 0) // deriva a última semana
        : []
    for (const data of lista) {
      if (data >= inicio && data <= hoje) out.push(rotular(culto, data))
    }
  }
  return out.sort((a, b) => b.data.localeCompare(a.data)) // mais recentes primeiro
}

// Cultos que aconteceram de hoje até `dias` dias atrás, mais recentes primeiro.
// Mantida para compatibilidade com telas que ainda derivam pelo dia da semana.
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
