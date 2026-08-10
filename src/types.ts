// Modelo de dados — seção 5 da especificação

export type Status =
  | 'novo'
  | 'em_contato'
  | 'aguardando_resposta'
  | 'encaminhado_lider'
  | 'visitou'
  | 'transferido'
  | 'batismo'
  | 'integrado'
  | 'em_espera'
  | 'recusou'
  | 'encerrado'

export type Origem = 'culto' | 'qr_code'

export type SituacaoCivil = 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'outro'

export type HorarioContato = 'manha' | 'tarde' | 'noite'

// Situação de batismo — atributo da PESSOA, paralelo ao funil (não é etapa dele).
// Nem todo visitante precisa ser batizado: muitos já chegam batizados. Saber isso
// cedo evita convidar para o batismo quem já é batizado — e separa, no relatório,
// "quantos batizamos aqui" de "quantos chegaram batizados".
export type SituacaoBatismo = 'nao_batizado' | 'ja_batizado' | 'batizado_aqui'

export const SITUACAO_BATISMO_LABEL: Record<SituacaoBatismo, string> = {
  nao_batizado: 'Ainda não é batizado(a)',
  ja_batizado: 'Já era batizado(a) quando chegou',
  batizado_aqui: 'Batizado(a) aqui na igreja',
}

// Versão curta, para pílulas de escolha em formulários públicos
export const SITUACAO_BATISMO_CURTO: Record<SituacaoBatismo, string> = {
  nao_batizado: 'Ainda não',
  ja_batizado: 'Sim, já sou batizado(a)',
  batizado_aqui: 'Fui batizado(a) aqui',
}

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
  // Datas concretas do culto (yyyy-mm-dd) — mesmo padrão do cadastro de culto do
  // sistema do louvor: ao cadastrar, o sistema gera as ocorrências recentes e as
  // próximas; a equipe pode adicionar datas avulsas e gerar mais. No cadastro do
  // visitante só aparecem as ocorrências da última semana (ver cultos.ts).
  ocorrencias?: string[]
}

// Configuração da igreja — torna o sistema white-label (multi-igreja)
export interface ConfigIgreja {
  nomeIgreja: string
  subtitulo: string
  termoGrupo: string // como a igreja chama o grupo pequeno: Conexão, Célula, PG…

  // ---- Paleta (mesmo vocabulário da área de configuração do site da igreja) ----
  // Os tons derivados (mais claros/escuros) são calculados sozinhos no CSS.
  corPrimaria: string // destaques, botões
  corFundo: string // "papel" — fundo das telas
  corEscura: string // fundos escuros, títulos, rodapé

  prazoEsperaDias: number // silêncio até mover para "Em espera" (padrão 14)

  // Requisitos para receber como membro — a liderança do grupo confirma, antes
  // de concluir a jornada, que a pessoa já frequenta há tempo suficiente e com
  // boa presença. 0 em qualquer um deles desliga aquela exigência.
  mesesMinimosConexao: number // tempo mínimo frequentando o grupo (padrão 3)
  frequenciaMinimaConexao: number // % de presença esperada nesse período (padrão 80)

  cultos: string[] // rótulos dos cultos — mantido em sincronia com cultosDef (compatibilidade)
  cultosDef: CultoDef[] // cadastro estruturado dos cultos (aba ⛪ Cultos)
  comoConheceuOpcoes: string[] // opções de "como conheceu a igreja"

  // Personalização da página pública de autocadastro (QR code)
  autocadastroUrl: string // link público divulgado (ex.: https://visitante.suaigreja.com.br)
  autocadastroTitulo: string // título de boas-vindas
  autocadastroMensagem: string // texto de introdução, abaixo do título
  autocadastroMensagemFinal: string // mensagem exibida após o envio
  // Quais campos aparecem no formulário público. Nome, contato e data de
  // nascimento são sempre exibidos — o resto a igreja liga/desliga aqui.
  autocadastroMostrarSituacaoCivil: boolean
  autocadastroMostrarEndereco: boolean
  autocadastroMostrarBairro: boolean
  autocadastroMostrarCidade: boolean
  autocadastroPerguntarPrimeiraVez: boolean
  autocadastroPerguntarMembroOutra: boolean
  autocadastroPerguntarBatismo: boolean
  autocadastroPerguntarComoConheceu: boolean
  autocadastroPerguntarConexao: boolean
  autocadastroPerguntarContato: boolean
  autocadastroPerguntarOracao: boolean

  // Nomes das etapas e das funções, do jeito que ESTA igreja fala.
  // Só guarda o que foi personalizado — o que ficar de fora usa o padrão.
  rotulosStatus?: Partial<Record<Status, string>>
  rotulosPapel?: Partial<Record<Papel, string>>

  // Datas marcadas no calendário da igreja (yyyy-mm-dd). O batismo e a recepção
  // de membros não acontecem em qualquer dia: são eventos com data marcada. A
  // equipe escolhe numa lista em vez de digitar — menos erro de digitação.
  datasBatismo: string[]
  datasMembresia: string[]
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
  dataInicioConexao?: string // yyyy-mm-dd — quando começou a frequentar o grupo (preenchido pelo líder)
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

  // ---- Batismo (atributo da pessoa) × Membresia (marco que fecha a jornada) ----
  // São eventos diferentes e independentes: a pessoa pode virar membro já sendo
  // batizada, e pode ser batizada muito antes de concluir a membresia.
  situacaoBatismo?: SituacaoBatismo
  dataBatismo?: string // yyyy-mm-dd — quando foi batizada (se souber)
  dataMembresia?: string // yyyy-mm-dd — recepção como membro; é o que conclui a jornada
  /** @deprecated Campo antigo que misturava batismo e membresia numa data só.
   *  Migrado para `dataMembresia` em store.ts — mantido apenas para a leitura
   *  dos estados salvos antes dessa separação. Não usar em código novo. */
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
  // Onde o grupo se reúne — usado para sugerir a Conexão pela proximidade do
  // bairro do visitante. Substituiu o antigo campo "região" (migrado para bairro).
  endereco?: string
  bairro?: string
  cidade?: string
  perfil: string // ex.: solteiros, casais, jovens
  diaHorario: string // derivado de diasSemana + horario, ou texto livre legado
  diasSemana?: string[] // ex.: ['quinta', 'sábado']
  horario?: string // ex.: '20:00'
  atualizadoEm?: string // ISO — para resolver conflito de merge (quem editou por último ganha)
  /** @deprecated Campo antigo — migrado para `bairro`. Mantido só para leitura de estados salvos. */
  regiao?: string
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

// Rótulos base das etapas do fluxo (sem dias fixos da semana). Para o termo do
// grupo aparecer com o nome da igreja (Conexão/Célula/PG…), use rotuloEtapa().
export const ETAPA_LABEL: Record<EtapaFluxo, string> = {
  aproximacao: '1º Contato — Aproximação',
  conexao: 'Convite para a Conexão',
  celebracao: 'Convite Celebração',
  pre_visita: 'Líder — contato pré-visita',
  aviso_lider: 'Aviso ao líder (handoff)',
  reengajamento: 'Reengajamento',
  geral: 'Geral / contato livre',
}

/** Rótulo da etapa aplicando o termo do grupo da igreja. Use nas telas. */
export function rotuloEtapa(e: EtapaFluxo): string {
  if (e === 'conexao') return `Convite para ${termoGrupoAtual}`
  if (e === 'aviso_lider') return `Aviso ao líder de ${termoGrupoAtual} (handoff)`
  return ETAPA_LABEL[e]
}

export interface Template {
  id: string
  gatilho: string // ex.: 'segunda_aproximacao'
  titulo: string
  texto: string // aceita {{nome}} e {{nome_conexão}} (nome do grupo do visitante)
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
  batismo: 'Batismo',
  integrado: 'Membro',
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
  batismo: '#84cc16',
  integrado: '#22c55e',
  em_espera: '#94a3b8',
  recusou: '#ef4444',
  encerrado: '#64748b',
}

// ---- Rótulos configuráveis (Configurações → Nomes das etapas) ----
//
// Cada igreja fala do próprio jeito: o que aqui é "Conexão" lá é "Célula", e o
// que é "Integrador" pode ser "Consolidador". Os nomes ficam guardados aqui, em
// módulo, e não passados de tela em tela, porque são usados em componentes bem
// fundos onde carregar a config inteira só para exibir um rótulo não se paga.
// App.tsx mantém estes valores em dia a partir das Configurações.
let termoGrupoAtual = 'Conexão'
let rotulosStatusAtuais: Partial<Record<Status, string>> = {}
let rotulosPapelAtuais: Partial<Record<Papel, string>> = {}

export function aplicarRotulos(cfg: {
  termoGrupo: string
  rotulosStatus?: Partial<Record<Status, string>>
  rotulosPapel?: Partial<Record<Papel, string>>
}): void {
  termoGrupoAtual = cfg.termoGrupo.trim() || 'Conexão'
  rotulosStatusAtuais = cfg.rotulosStatus ?? {}
  rotulosPapelAtuais = cfg.rotulosPapel ?? {}
}

/**
 * Rótulo do status para exibição. Use SEMPRE esta função nas telas, no lugar de
 * STATUS_LABEL: só ela aplica o nome personalizado da igreja e o termo do grupo.
 */
export function rotuloStatus(st: Status): string {
  const personalizado = rotulosStatusAtuais[st]?.trim()
  if (personalizado) return personalizado
  if (st === 'encaminhado_lider') return `Encaminhado ao líder de ${termoGrupoAtual}`
  return STATUS_LABEL[st]
}

/** Idem para as funções da equipe. Use no lugar de PAPEL_LABEL nas telas. */
export function rotuloPapel(p: Papel): string {
  return rotulosPapelAtuais[p]?.trim() || PAPEL_LABEL[p]
}

/** O rótulo padrão de fábrica — mostrado como placeholder na configuração. */
export function rotuloStatusPadrao(st: Status): string {
  if (st === 'encaminhado_lider') return `Encaminhado ao líder de ${termoGrupoAtual}`
  return STATUS_LABEL[st]
}

// Badge "suave" (fundo claro + texto colorido), padrão visual dos sistemas iFE
export function estiloStatus(st: Status): { background: string; color: string } {
  const c = STATUS_COR[st]
  return { background: c + '22', color: c }
}

export const TIPO_INTERACAO_LABEL: Record<TipoInteracao, string> = {
  aproximacao: '1º Contato — Aproximação',
  conexao: 'Convite para a Conexão',
  celebracao: 'Convite Celebração',
  livre: 'Contato livre',
  lider_pre_visita: 'Líder — pré-visita',
}

/** Rótulo do tipo de interação aplicando o termo do grupo da igreja. */
export function rotuloTipoInteracao(t: TipoInteracao): string {
  if (t === 'conexao') return `Convite para ${termoGrupoAtual}`
  return TIPO_INTERACAO_LABEL[t]
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
