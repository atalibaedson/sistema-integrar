// Cálculos dos relatórios de gestão (área restrita a Gestão Integração e Pastores).
// Funções puras sobre o AppState — sem efeitos colaterais, fáceis de testar e
// reaproveitadas tanto na área de Relatórios quanto no Painel.
import type { AppState, GrauAbertura, Interacao, Status, Usuario, Visitante } from './types'

// ---- Período ----

export interface Periodo {
  de: string  // AAAA-MM-DD (inclusive) ou ''
  ate: string // AAAA-MM-DD (inclusive) ou ''
}

export function dentroDoPeriodo(iso: string | undefined, p: Periodo): boolean {
  if (!iso) return false
  const dia = iso.slice(0, 10)
  if (p.de && dia < p.de) return false
  if (p.ate && dia > p.ate) return false
  return true
}

// Visitantes cadastrados dentro do período escolhido
export function visitantesDoPeriodo(vs: Visitante[], p: Periodo): Visitante[] {
  if (!p.de && !p.ate) return vs
  return vs.filter((v) => dentroDoPeriodo(v.dataCadastro, p))
}

// Interações registradas dentro do período
export function interacoesDoPeriodo(is: Interacao[], p: Periodo): Interacao[] {
  if (!p.de && !p.ate) return is
  return is.filter((i) => dentroDoPeriodo(i.data, p))
}

// ---- Alcance de etapas (usa o status atual E o histórico) ----

// A pessoa já esteve em algum destes status em algum momento?
export function jaAlcancou(v: Visitante, statuses: Status[]): boolean {
  if (statuses.includes(v.status)) return true
  return v.historicoStatus.some((h) => statuses.includes(h.para))
}

// Data em que a pessoa entrou pela primeira vez num status (ou undefined)
export function dataDoStatus(v: Visitante, status: Status): string | undefined {
  return v.historicoStatus.find((h) => h.para === status)?.data
}

// ---- Funil de conversão ----

export interface EtapaFunil {
  chave: string
  rotulo: string
  statuses: Status[]
  cor: string
  total: number
  taxaDoTopo: number     // % em relação aos cadastrados
  taxaDaAnterior: number // % de conversão vindo da etapa anterior
}

const DEF_FUNIL: { chave: string; rotulo: string; statuses: Status[]; cor: string }[] = [
  { chave: 'cadastrados', rotulo: 'Cadastrados', statuses: ['novo', 'em_contato', 'aguardando_resposta', 'em_espera', 'encaminhado_lider', 'visitou', 'transferido', 'batismo', 'integrado', 'recusou'], cor: '#6366f1' },
  { chave: 'contato', rotulo: 'Fizeram 1º contato', statuses: ['em_contato', 'aguardando_resposta', 'em_espera', 'encaminhado_lider', 'visitou', 'transferido', 'batismo', 'integrado'], cor: '#0ea5e9' },
  { chave: 'encaminhado', rotulo: 'Encaminhados ao líder', statuses: ['encaminhado_lider', 'visitou', 'transferido', 'batismo', 'integrado'], cor: '#8b5cf6' },
  { chave: 'visitou', rotulo: 'Visitaram a Conexão', statuses: ['visitou', 'transferido', 'batismo', 'integrado'], cor: '#14b8a6' },
  { chave: 'transferido', rotulo: 'Transferidos ao líder', statuses: ['transferido', 'batismo', 'integrado'], cor: '#10b981' },
  // O batismo NÃO entra no funil: é etapa opcional (só de quem não é batizado),
  // então contá-lo aqui faria a taxa de conversão mentir para quem já chegou
  // batizado. Ele tem bloco próprio — ver `resumoBatismo`.
  { chave: 'integrado', rotulo: 'Viraram membros', statuses: ['integrado'], cor: '#22c55e' },
]

// ---- Batismo: quantos batizamos AQUI × quantos já chegaram batizados ----
// Duas coisas que o campo antigo (batismo+membresia numa data só) não separava.
export interface ResumoBatismo {
  batizadosAqui: number
  jaBatizados: number
  naoBatizados: number // candidatos ao batismo
  naoInformado: number
}

export function resumoBatismo(vs: Visitante[]): ResumoBatismo {
  const conta = (s: Visitante['situacaoBatismo']) => vs.filter((v) => v.situacaoBatismo === s).length
  return {
    batizadosAqui: conta('batizado_aqui'),
    jaBatizados: conta('ja_batizado'),
    naoBatizados: conta('nao_batizado'),
    naoInformado: vs.filter((v) => !v.situacaoBatismo).length,
  }
}

export function funil(vs: Visitante[]): EtapaFunil[] {
  const topo = vs.length || 1
  let anterior = vs.length
  return DEF_FUNIL.map((e, i) => {
    const total = vs.filter((v) => jaAlcancou(v, e.statuses)).length
    const etapa: EtapaFunil = {
      ...e,
      total,
      taxaDoTopo: Math.round((total / topo) * 100),
      taxaDaAnterior: i === 0 ? 100 : anterior ? Math.round((total / anterior) * 100) : 0,
    }
    anterior = total
    return etapa
  })
}

// ---- Distribuição genérica (contagem por chave) ----

export interface Fatia {
  rotulo: string
  valor: number
  pct: number
  cor?: string
}

export function distribuicao<T>(
  itens: T[],
  chave: (t: T) => string | undefined,
  rotuloVazio = 'Não informado',
): Fatia[] {
  const mapa = new Map<string, number>()
  for (const it of itens) {
    const k = chave(it) || rotuloVazio
    mapa.set(k, (mapa.get(k) ?? 0) + 1)
  }
  const total = itens.length || 1
  return [...mapa.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor, pct: Math.round((valor / total) * 100) }))
    .sort((a, b) => b.valor - a.valor)
}

// ---- Desempenho por Integrador (consolidador) ----

export interface LinhaEquipe {
  usuario: Usuario
  total: number
  emAndamento: number
  integrados: number
  perdidos: number // recusou + encerrado + em espera
  taxaIntegracao: number // integrados / total
  interacoes: number
}

const STATUS_ANDAMENTO: Status[] = ['novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou', 'transferido', 'batismo']
const STATUS_PERDIDO: Status[] = ['recusou', 'encerrado', 'em_espera']

export function desempenhoEquipe(s: AppState, vs: Visitante[], is: Interacao[]): LinhaEquipe[] {
  const consolidadores = s.usuarios.filter((u) => u.papeis.includes('consolidador') || u.papeis.includes('coordenacao'))
  const idsVisiveis = new Set(vs.map((v) => v.id))
  return consolidadores
    .map((usuario) => {
      const meus = vs.filter((v) => v.responsavelId === usuario.id)
      const total = meus.length
      const integrados = meus.filter((v) => v.status === 'integrado').length
      const interacoes = is.filter((i) => i.autorId === usuario.id && (!i.visitanteId || idsVisiveis.has(i.visitanteId))).length
      return {
        usuario,
        total,
        emAndamento: meus.filter((v) => STATUS_ANDAMENTO.includes(v.status)).length,
        integrados,
        perdidos: meus.filter((v) => STATUS_PERDIDO.includes(v.status)).length,
        taxaIntegracao: total ? Math.round((integrados / total) * 100) : 0,
        interacoes,
      }
    })
    .filter((l) => l.total > 0 || l.interacoes > 0)
    .sort((a, b) => b.total - a.total)
}

// ---- Desempenho por Conexão / líder ----

export interface LinhaConexao {
  id: string
  nome: string
  liderNome: string
  encaminhados: number
  visitaram: number
  integrados: number
  taxaVisita: number // visitaram / encaminhados
}

export function desempenhoConexoes(s: AppState, vs: Visitante[]): LinhaConexao[] {
  const nomeUsuario = (id?: string) => s.usuarios.find((u) => u.id === id)?.nome
  return s.conexoes
    .map((c) => {
      const daConexao = vs.filter((v) => v.conexaoId === c.id)
      const encaminhados = daConexao.filter((v) => jaAlcancou(v, ['encaminhado_lider', 'visitou', 'transferido', 'batismo', 'integrado'])).length
      const visitaram = daConexao.filter((v) => jaAlcancou(v, ['visitou', 'transferido', 'batismo', 'integrado'])).length
      const integrados = daConexao.filter((v) => v.status === 'integrado').length
      const lider = [nomeUsuario(c.liderId), nomeUsuario(c.lider2Id)].filter(Boolean).join(' & ')
      return {
        id: c.id,
        nome: c.nome,
        liderNome: lider || '—',
        encaminhados,
        visitaram,
        integrados,
        taxaVisita: encaminhados ? Math.round((visitaram / encaminhados) * 100) : 0,
      }
    })
    .filter((l) => l.encaminhados > 0 || l.visitaram > 0 || l.integrados > 0)
    .sort((a, b) => b.integrados - a.integrados || b.visitaram - a.visitaram)
}

// ---- Engajamento (interações) ----

export interface Engajamento {
  total: number
  responderam: number
  taxaResposta: number
  porGrau: Fatia[]
  porTipo: Fatia[]
}

const GRAU_ROTULO: Record<GrauAbertura, string> = {
  alto: 'Abertura alta', medio: 'Abertura média', baixo: 'Abertura baixa', sem_resposta: 'Sem resposta',
}
const GRAU_COR: Record<GrauAbertura, string> = {
  alto: '#22c55e', medio: '#0ea5e9', baixo: '#f59e0b', sem_resposta: '#94a3b8',
}

export function engajamento(is: Interacao[]): Engajamento {
  const total = is.length
  const responderam = is.filter((i) => i.respondeu).length
  const porGrau = (['alto', 'medio', 'baixo', 'sem_resposta'] as GrauAbertura[])
    .map((g) => {
      const valor = is.filter((i) => i.grauAbertura === g).length
      return { rotulo: GRAU_ROTULO[g], valor, pct: total ? Math.round((valor / total) * 100) : 0, cor: GRAU_COR[g] }
    })
    .filter((f) => f.valor > 0)
  return {
    total,
    responderam,
    taxaResposta: total ? Math.round((responderam / total) * 100) : 0,
    porGrau,
    porTipo: distribuicao(is, (i) => i.tipo),
  }
}

// ---- Velocidade / tempo médio ----

function mediaDias(valores: number[]): number | null {
  if (valores.length === 0) return null
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length)
}

function diasEntre(a?: string, b?: string): number | null {
  if (!a || !b) return null
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000))
}

export interface Velocidade {
  ateContato: number | null
  ateEncaminhado: number | null
  ateIntegracao: number | null
  integradosCount: number
}

export function velocidade(vs: Visitante[]): Velocidade {
  const contato: number[] = []
  const encaminhado: number[] = []
  const integracao: number[] = []
  for (const v of vs) {
    const dc = diasEntre(v.dataCadastro, dataDoStatus(v, 'em_contato'))
    if (dc != null) contato.push(dc)
    const de = diasEntre(v.dataCadastro, dataDoStatus(v, 'encaminhado_lider'))
    if (de != null) encaminhado.push(de)
    const di = diasEntre(v.dataCadastro, dataDoStatus(v, 'integrado'))
    if (di != null) integracao.push(di)
  }
  return {
    ateContato: mediaDias(contato),
    ateEncaminhado: mediaDias(encaminhado),
    ateIntegracao: mediaDias(integracao),
    integradosCount: integracao.length,
  }
}

// ---- Atividade por dia (últimos N dias) ----

export interface DiaAtividade {
  dia: string     // AAAA-MM-DD
  rotulo: string  // dd/mm
  cadastros: number
  interacoes: number
}

export function atividadePorDia(vs: Visitante[], is: Interacao[], dias = 14): DiaAtividade[] {
  const hoje = new Date()
  const out: DiaAtividade[] = []
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() - i)
    const chave = d.toISOString().slice(0, 10)
    out.push({
      dia: chave,
      rotulo: `${chave.slice(8, 10)}/${chave.slice(5, 7)}`,
      cadastros: vs.filter((v) => v.dataCadastro.slice(0, 10) === chave).length,
      interacoes: is.filter((x) => x.data.slice(0, 10) === chave).length,
    })
  }
  return out
}
