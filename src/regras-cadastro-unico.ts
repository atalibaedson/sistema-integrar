// Regras PURAS do cadastro único (Check-iFE) do lado do Integrar — sem navegador.
//
// Etapa 2, fase A: o Integrar LÊ nome, telefone, nascimento, estado civil e conexão das
// tabelas `pessoas` / `pessoas_sensivel` do Check-iFE (quem pode ler é decidido pelas
// regras do banco DELE: a própria pessoa, o admin, e `pastor`/`integracao` da mesma igreja).
// A ficha do Integrar continua como reserva: se a leitura não vier, a tela usa a ficha.
// Ver PLANO-ETAPA-2-CADASTRO-UNICO.md (seções 1, 2 e 15).
import type { Conexao, Usuario } from './types'

export type EstadoCivilCU = 'solteiro' | 'casado' | 'uniao_estavel' | 'divorciado' | 'viuvo' | 'outro'

export const ESTADO_CIVIL_CU_LABEL: Record<EstadoCivilCU, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  uniao_estavel: 'União estável',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  outro: 'Outro',
}

/** O que o Integrar usa do cadastro único de uma conta. */
export interface PessoaCU {
  userId: string
  pessoaId: string
  nome?: string
  email?: string
  telefone?: string
  dataNascimento?: string // AAAA-MM-DD
  ativo?: boolean
  estadoCivil?: EstadoCivilCU
  conexaoSituacao?: 'participa' | 'nao_participa' // ausente = ainda não respondeu
  conexaoCodigo?: string // id da Conexão no Integrar
  conexaoIgreja?: string // igreja dessa Conexão (minha-igreja, ife-sjc…)
}

const txt = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** Monta a pessoa a partir das linhas do banco (lidas pela API), ignorando o que vier fora do formato. */
export function pessoaDasLinhas(p: Record<string, unknown>, s?: Record<string, unknown>): PessoaCU | null {
  const userId = txt(p.user_id)
  const pessoaId = txt(p.id)
  if (!userId || !pessoaId) return null
  const ec = txt(s?.estado_civil)
  const sit = txt(s?.conexao_situacao)
  const nasc = txt(p.data_nascimento)
  return {
    userId,
    pessoaId,
    nome: txt(p.nome),
    email: txt(p.email),
    telefone: txt(p.telefone),
    dataNascimento: nasc && /^\d{4}-\d{2}-\d{2}/.test(nasc) ? nasc.slice(0, 10) : undefined,
    ativo: typeof p.ativo === 'boolean' ? p.ativo : undefined,
    estadoCivil: ec && ec in ESTADO_CIVIL_CU_LABEL ? (ec as EstadoCivilCU) : undefined,
    conexaoSituacao: sit === 'participa' || sit === 'nao_participa' ? sit : undefined,
    conexaoCodigo: txt(s?.conexao_codigo),
    conexaoIgreja: txt(s?.conexao_igreja),
  }
}

/** Idade em anos completos (ou undefined se a data não serve). */
export function idadeEmAnos(data?: string, agora: Date = new Date()): number | undefined {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return undefined
  const [a, m, d] = data.split('-').map(Number)
  let anos = agora.getFullYear() - a
  if (agora.getMonth() + 1 < m || (agora.getMonth() + 1 === m && agora.getDate() < d)) anos--
  return anos >= 0 && anos < 130 ? anos : undefined
}

/** Texto da participação em Conexão, do jeito que a igreja chama o grupo. */
export function descreverConexao(
  p: PessoaCU | undefined, igrejaAtual: string, conexoes: Conexao[], termoGrupo = 'Conexão',
): { texto: string; tom: 'ok' | 'neutro' | 'aviso' } {
  const termo = termoGrupo.toLowerCase()
  if (!p || (!p.conexaoSituacao && !p.conexaoCodigo)) return { texto: `Ainda não respondeu sobre ${termo}`, tom: 'neutro' }
  if (p.conexaoSituacao === 'nao_participa') return { texto: `Ainda não participa de ${termo}`, tom: 'aviso' }
  if (p.conexaoIgreja && igrejaAtual && p.conexaoIgreja !== igrejaAtual) return { texto: `Participa de ${termo} de outra igreja`, tom: 'neutro' }
  const c = conexoes.find((x) => x.id === p.conexaoCodigo)
  if (c) return { texto: c.nome, tom: 'ok' }
  return { texto: `${termoGrupo} não encontrada (pode ter sido removida)`, tom: 'aviso' }
}

const soDigitos = (t?: string) => (t ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
const normNome = (t?: string) => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Onde a ficha (cópia do Integrar) está diferente do cadastro único — para a liderança atualizar a ficha. */
export function divergencias(ficha: Pick<Usuario, 'nome' | 'whatsapp'>, p: PessoaCU | undefined): ('nome' | 'whatsapp')[] {
  if (!p) return []
  const r: ('nome' | 'whatsapp')[] = []
  if (p.nome && normNome(p.nome) !== normNome(ficha.nome)) r.push('nome')
  if (p.telefone && soDigitos(p.telefone) && soDigitos(p.telefone) !== soDigitos(ficha.whatsapp)) r.push('whatsapp')
  return r
}

export type SituacaoLeitura = 'ok' | 'parcial' | 'sem_permissao'

/**
 * Como foi a leitura em lote. As regras do Check-iFE devolvem SÓ o que a pessoa pode ver
 * (sem erro): se pedimos outras pessoas e não veio nenhuma, é o papel que falta no Check-iFE.
 * "parcial" = algumas contas ainda não têm cadastro lá (ex.: e-mail não confirmado).
 */
export function avaliarLeitura(pedidas: string[], recebidas: string[], minhaConta?: string): SituacaoLeitura {
  const outras = pedidas.filter((id) => id !== minhaConta)
  const recebidasOutras = recebidas.filter((id) => id !== minhaConta)
  // com uma só pessoa pedida não dá para distinguir "sem papel" de "ainda sem cadastro"
  if (outras.length >= 2 && recebidasOutras.length === 0) return 'sem_permissao'
  return recebidas.length < pedidas.length ? 'parcial' : 'ok'
}

// ---- Gravação da própria linha (fase B) ----

/** Mensagem em português para os erros que o banco do Check-iFE devolve ao gravar o próprio cadastro. */
export function mensagemDoErroCU(e: { code?: string; message?: string } | null | undefined): string {
  switch (e?.code) {
    case '42501': return 'Aceite o termo do cadastro único antes de preencher estes dados.'
    case '22023': return 'O termo foi atualizado. Leia a versão nova e aceite de novo.'
    case '23514': return 'Essa conexão não é da igreja escolhida. Escolha de novo.'
    case 'P0002': return 'Seu cadastro único ainda não foi criado. Ele aparece quando o e-mail da conta está confirmado.'
    default: return e?.message?.trim() || 'Não foi possível salvar agora. Tente de novo.'
  }
}

/** Situação do cadastro único da pessoa (checkife_cadastro_completo), lida de forma defensiva. */
export interface SituacaoCU { completo: boolean; falta: string[]; conexaoRemovida: boolean; camposPendentes: string[] }
export function lerSituacaoCU(r: unknown): SituacaoCU | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return { completo: o.completo === true, falta: lista(o.falta), conexaoRemovida: o.conexao_removida === true, camposPendentes: lista(o.campos_pendentes) }
}

/** O que mostrar no aviso "complete o seu cadastro" (vazio = nada a avisar). Não bloqueia nada no Integrar. */
export function pendenciasCU(s: SituacaoCU | null, termoGrupo = 'Conexão'): string[] {
  if (!s) return []
  const r: string[] = []
  if (s.falta.includes('termo')) r.push('aceitar o termo de privacidade')
  if (s.falta.includes('conexao')) r.push(s.conexaoRemovida ? `escolher de novo a sua ${termoGrupo.toLowerCase()} (a anterior foi removida)` : `responder sobre a ${termoGrupo.toLowerCase()}`)
  if (s.camposPendentes.length > 0) r.push(s.camposPendentes.length === 1 ? 'completar 1 informação pedida pela igreja' : `completar ${s.camposPendentes.length} informações pedidas pela igreja`)
  return r
}

/** Linha de `pessoas_sensivel` para a participação em Conexão (respeita a regra do banco). */
export function linhaParticipacao(pessoaId: string, escolha: string, igreja: string): Record<string, unknown> {
  if (escolha === 'nenhuma') return { pessoa_id: pessoaId, conexao_situacao: 'nao_participa', conexao_codigo: null, conexao_igreja: null }
  return { pessoa_id: pessoaId, conexao_situacao: 'participa', conexao_codigo: escolha, conexao_igreja: igreja }
}

/** Link para o perfil no Check-iFE, com "Voltar ao Integrar". */
export function linkPerfilCheckife(voltarPara: string, secao?: 'conexao'): string {
  const u = new URL('https://checkife.ifamiliaextraordinaria.com.br/')
  u.searchParams.set('ir', 'perfil')
  if (secao) u.searchParams.set('secao', secao)
  if (voltarPara) u.searchParams.set('voltar', voltarPara)
  return u.toString()
}
