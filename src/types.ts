// Modelo de dados — seção 5 da especificação

export type Status =
  | 'novo'
  | 'em_contato'
  | 'aguardando_resposta'
  | 'encaminhado_lider'
  | 'visitou'
  | 'transferido'
  | 'integrado'
  | 'em_espera'
  | 'recusou'
  | 'encerrado'

export type Origem = 'culto' | 'qr_code'

export type SituacaoCivil = 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'outro'

export type HorarioContato = 'manha' | 'tarde' | 'noite'

// Opções da pergunta "quer fazer parte de uma Conexão?" (formulário de acolhimento)
export const OPCOES_DESEJA_CONEXAO = [
  'Sim, claro!',
  'Por enquanto não',
  'Ainda preciso entender melhor o que é uma Conexão',
  'Já estou visitando uma',
] as const

export type PerfilAbordagem =
  | 'pouca_interacao'
  | 'abriu_nao_visitou'
  | 'nao_se_abriu'

export type TipoInteracao =
  | 'aproximacao'
  | 'conexao'
  | 'celebracao'
  | 'livre'
  | 'lider_pre_visita'

export type GrauAbertura = 'alto' | 'medio' | 'baixo' | 'sem_resposta'

// Culto fixo do calendário da igreja — mesmo padrão do cadastro de culto do
// sistema do louvor (nome + dia da semana + horário). O dia da semana gera as
// datas dos últimos 7 dias oferecidas no cadastro do visitante.
export interface CultoDef {
  nome: string
  diaSemana?: number // 0=domingo … 6=sábado
  horario?: string // ex.: "10:00" (exibição)
}

// Configuração da igreja — torna o sistema white-label (multi-igreja)
export interface ConfigIgreja {
  nomeIgreja: string
  subtitulo: string
  termoGrupo: string // como a igreja chama o grupo pequeno: Conexão, Célula, PG…
  corPrimaria: string
  prazoEsperaDias: number // silêncio até mover para "Em espera" (padrão 14)
  cultos: string[] // rótulos dos cultos — mantido em sincronia com cultosDef (compatibilidade)
  cultosDef: CultoDef[] // cadastro estruturado dos cultos (aba ⛪ Cultos)
  comoConheceuOpcoes: string[] // opções de "como conheceu a igreja"

  // Personalização da página pública de autocadastro (QR code)
  autocadastroTitulo: string // título de boas-vindas
  autocadastroMensagem: string // texto de introdução, abaixo do título
  autocadastroMensagemFinal: string // mensagem exibida após o envio
  autocadastroMostrarBairro: boolean
  autocadastroMostrarSituacaoCivil: boolean
}

export interface MudancaStatus {
  de: Status | null
  para: Status
  data: string // ISO
  motivo: string
  automatica: boolean
}

export interface Visitante {
  id: string
  nome: string
  whatsapp: string
  email?: string
  dataCadastro: string // ISO
  origem: Origem
  cultoPrimeiraVisita?: string // em qual culto a pessoa veio pela primeira vez
  dataPrimeiraVisita?: string // yyyy-mm-dd — dia em que a pessoa de fato visitou (pode diferir do dia do preenchimento)
  comoConheceu?: string // como a pessoa conheceu a igreja
  status: Status
  perfilAbordagem?: PerfilAbordagem
  responsavelId?: string // Consolidador dono do acompanhamento
  liderConexaoId?: string
  conexaoId?: string
  situacaoCivil?: SituacaoCivil
  dataNascimento?: string // yyyy-mm-dd
  endereco?: string // rua / logradouro (opcional)
  bairro?: string
  cidade?: string
  // Campos do formulário de acolhimento (autocadastro) — seção "sobre a caminhada"
  primeiraVez?: boolean          // é a 1ª vez na igreja?
  membroOutraIgreja?: boolean    // já é membro de outra igreja?
  desejaConexao?: string         // interesse em participar de uma Conexão (resposta livre/opção)
  desejaContato?: boolean        // quer que a equipe entre em contato?
  melhorHorarioContato?: HorarioContato
  pedidoOracao?: string          // "pelo que podemos orar por você?"
  flagMenorIdade: boolean
  flagOutraCidade: boolean
  flagCuidado: boolean // flag transversal Cuidado/Crise (seção 6)
  transferenciaConfirmada: boolean // líder confirmou que assumiu (regra 9)
  consentimentoLgpd: boolean // autorizou o uso dos dados para o acompanhamento
  consentimentoLgpdData?: string // ISO — quando o consentimento foi dado
  dataBatismoMembresia?: string
  observacoes?: string
  historicoStatus: MudancaStatus[]
  criadoEm: string
  atualizadoEm: string
}

export interface Interacao {
  id: string
  visitanteId: string
  autorId?: string
  autorPapel: 'consolidador' | 'lider'
  data: string // ISO
  canal: 'whatsapp'
  tipo: TipoInteracao
  respondeu: boolean
  grauAbertura: GrauAbertura
  retornoResumo: string
  proximosPassos: string
  encaminhamentos: string
  flagCuidado: boolean
}

export interface Conexao {
  id: string
  nome: string
  liderId?: string
  lider2Id?: string // 2º líder (opcional) — casais que lideram juntos, dupla de liderança etc.
  regiao: string
  perfil: string // ex.: solteiros, casais, jovens
  diaHorario: string
}

// Usuários do sistema, por categoria (papel) — seção 3 da especificação
export type Papel = 'coordenacao' | 'consolidador' | 'lider' | 'pastor' | 'acolhedor'

// Situação da conta de acesso (login real). Os integrantes cadastrados pela
// equipe antes do login existir ficam como 'sem_login' e seguem usando o
// modo aberto ("Vendo como") normalmente.
export type StatusAcesso =
  | 'sem_login'
  | 'pendente_confirmacao_email'
  | 'pendente_aprovacao'
  | 'aprovado'
  | 'rejeitado'

export const STATUS_ACESSO_LABEL: Record<StatusAcesso, string> = {
  sem_login: 'Sem login (equipe)',
  pendente_confirmacao_email: 'Aguardando confirmação de e-mail',
  pendente_aprovacao: 'Aguardando aprovação',
  aprovado: 'Acesso aprovado',
  rejeitado: 'Acesso rejeitado',
}

export interface Usuario {
  id: string
  nome: string
  whatsapp: string
  email?: string
  papeis: Papel[] // uma pessoa pode exercer várias funções ao mesmo tempo
  ativo: boolean
  conexaoId?: string // apenas para líderes
  supervisorId?: string // quem está acima na hierarquia (vê o fluxo desta pessoa)

  // Cadastro completo (autocadastro de integrante)
  dataNascimento?: string // yyyy-mm-dd
  bairro?: string
  situacaoCivil?: SituacaoCivil
  comoConheceu?: string
  fotoUrl?: string // Supabase Storage (bucket "avatares")

  // Login real + fluxo de aprovação
  authUserId?: string // id do usuário no Supabase Auth
  statusAcesso: StatusAcesso
  loginPreferido?: 'email' | 'whatsapp'
  cadastroCompletoEm?: string // ISO
  emailConfirmadoEm?: string // ISO
  aprovadoPorId?: string
  aprovadoEm?: string // ISO
  rejeitadoPorId?: string
  rejeitadoEm?: string // ISO
  motivoRejeicao?: string
}

// Em qual momento do fluxo a mensagem pode ser usada. Várias mensagens podem
// dividir a mesma etapa — quem envia escolhe qual delas mandar.
export type EtapaFluxo =
  | 'aproximacao' | 'conexao' | 'celebracao' | 'pre_visita' | 'aviso_lider' | 'reengajamento' | 'geral'

export const ETAPA_LABEL: Record<EtapaFluxo, string> = {
  aproximacao: 'Seg · Aproximação (1º contato)',
  conexao: 'Qua · Convite para o grupo',
  celebracao: 'Sáb · Celebração',
  pre_visita: 'Líder · Contato pré-visita',
  aviso_lider: 'Aviso ao líder (handoff)',
  reengajamento: 'Reengajamento',
  geral: 'Geral / contato livre',
}

export interface Template {
  id: string
  gatilho: string // ex.: 'segunda_aproximacao'
  titulo: string
  texto: string // com {{nome}}
  etapa: EtapaFluxo // em qual parte do fluxo esta mensagem pode ser usada
}

// Trilha de auditoria: quem fez o quê, quando — essencial para a proteção
// de dados (LGPD), sobretudo em acessos a dados sensíveis (cuidado/crise).
export interface RegistroAuditoria {
  id: string
  data: string // ISO
  usuarioId?: string // quem estava "logado" (Vendo como) no momento
  usuarioNome: string // congelado no registro — sobrevive se o usuário for removido
  acao: string
  detalhe?: string
  alvoTipo?: 'visitante' | 'usuario' | 'sistema'
  alvoId?: string
  alvoNome?: string
}

// Lápide de exclusão: registra o que foi apagado para que a mesclagem entre
// dispositivos não "ressuscite" registros excluídos em outro computador.
export interface Exclusao {
  tipo: 'visitante' | 'interacao' | 'usuario' | 'conexao' | 'template'
  id: string
  em: string // ISO
}

export interface AppState {
  config: ConfigIgreja
  configAtualizadaEm?: string // ISO — última edição da config (decide quem vence na mesclagem)
  visitantes: Visitante[]
  interacoes: Interacao[]
  conexoes: Conexao[]
  usuarios: Usuario[]
  templates: Template[]
  auditoria: RegistroAuditoria[]
  excluidos?: Exclusao[]
}

// ---- Rótulos para exibição (pt-BR) ----

export const STATUS_LABEL: Record<Status, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  aguardando_resposta: 'Aguardando resposta',
  encaminhado_lider: 'Encaminhado ao líder',
  visitou: 'Visitou',
  transferido: 'Transferido',
  integrado: 'Integrado',
  em_espera: 'Em espera',
  recusou: 'Recusou',
  encerrado: 'Encerrado / Inválido',
}

export const STATUS_COR: Record<Status, string> = {
  novo: '#6366f1',
  em_contato: '#0ea5e9',
  aguardando_resposta: '#f59e0b',
  encaminhado_lider: '#8b5cf6',
  visitou: '#14b8a6',
  transferido: '#10b981',
  integrado: '#22c55e',
  em_espera: '#94a3b8',
  recusou: '#ef4444',
  encerrado: '#64748b',
}

// Badge "suave" (fundo claro + texto colorido), padrão visual dos sistemas iFE
export function estiloStatus(st: Status): { background: string; color: string } {
  const c = STATUS_COR[st]
  return { background: c + '22', color: c }
}

export const TIPO_INTERACAO_LABEL: Record<TipoInteracao, string> = {
  aproximacao: 'Aproximação (segunda)',
  conexao: 'Conexão (quarta)',
  celebracao: 'Celebração (sábado)',
  livre: 'Contato livre',
  lider_pre_visita: 'Líder — pré-visita',
}

export const GRAU_LABEL: Record<GrauAbertura, string> = {
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
  sem_resposta: 'Sem resposta',
}

export const PERFIL_LABEL: Record<PerfilAbordagem, string> = {
  pouca_interacao: 'Pouca interação / sem líder definido',
  abriu_nao_visitou: 'Abriu-se, mas não visitou',
  nao_se_abriu: 'Ainda não se abriu',
}

export const ORIGEM_LABEL: Record<Origem, string> = {
  culto: 'Culto',
  qr_code: 'QR Code',
}

export const PAPEL_LABEL: Record<Papel, string> = {
  coordenacao: 'Gestão Integração',
  consolidador: 'Integradores pós-culto',
  lider: 'Líder de Conexão',
  pastor: 'Pastores e Gestão Ministerial',
  acolhedor: 'Acolhedores',
}

export const PAPEL_COR: Record<Papel, string> = {
  coordenacao: '#8b5cf6',
  consolidador: '#0ea5e9',
  lider: '#10b981',
  pastor: '#f59e0b',
  acolhedor: '#ec4899',
}

export const SITUACAO_CIVIL_LABEL: Record<SituacaoCivil, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  outro: 'Outro',
}

export const HORARIO_CONTATO_LABEL: Record<HorarioContato, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}
