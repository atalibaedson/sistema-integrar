// Persistência (localStorage + nuvem opcional) + automações de prazo
import { useSyncExternalStore } from 'react'
import type { AppState, ConfigIgreja, CultoDef, EtapaFluxo, Exclusao, Interacao, RegistroAuditoria, Status, Template, Usuario, Visitante } from './types'
import { aplicarTransicao, diasDesde } from './machine'
import { diaSemanaDoCulto, gerarOcorrencias } from './cultos'
import { baixarEstado, enviarEstado, getConfigNuvem, setConfigNuvem, type ConfigNuvem } from './nuvem'
import { mesclarEstados } from './mesclar'
import { getUsuarioAtualId } from './acesso'

const STORAGE_KEY = 'ife-consolidacao-v1'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export const CONFIG_PADRAO: ConfigIgreja = {
  nomeIgreja: 'Igreja Família Extraordinária',
  subtitulo: 'Consolidação de visitantes',
  termoGrupo: 'Conexão',
  corPrimaria: '#E5A13C',
  corFundo: '#FAF7F1',
  corEscura: '#0042AA',
  prazoEsperaDias: 14,
  mesesMinimosConexao: 3,
  frequenciaMinimaConexao: 80,
  cultos: ['Domingo — manhã', 'Domingo — tarde', 'Domingo — noite', 'Quarta — noite'],
  cultosDef: [
    { nome: 'Domingo — manhã', diaSemana: 0, horario: '10:00', ocorrencias: gerarOcorrencias(0) },
    { nome: 'Domingo — tarde', diaSemana: 0, horario: '17:00', ocorrencias: gerarOcorrencias(0) },
    { nome: 'Domingo — noite', diaSemana: 0, horario: '19:00', ocorrencias: gerarOcorrencias(0) },
    { nome: 'Quarta — noite', diaSemana: 3, horario: '20:00', ocorrencias: gerarOcorrencias(3) },
  ],
  comoConheceuOpcoes: [
    'Convite de amigo(a)',
    'Convite de familiar',
    'Instagram / redes sociais',
    'YouTube',
    'Google / internet',
    'Passou em frente à igreja',
    'Evento / ação social',
    'Já frequentava outra unidade',
    'Outro',
  ],
  autocadastroUrl: 'https://visitante.ifamiliaextraordinaria.com.br',
  autocadastroTitulo: 'Foi uma alegria receber você! 🎉',
  autocadastroMensagem: 'Deixe seu contato — leva menos de um minuto — e nossa equipe vem falar com você em breve.',
  autocadastroMensagemFinal: 'Recebemos seus dados. Em breve alguém da nossa equipe vai falar com você pelo WhatsApp. Essa casa também é sua!',
  autocadastroMostrarSituacaoCivil: true,
  autocadastroMostrarEndereco: true,
  autocadastroMostrarBairro: true,
  autocadastroMostrarCidade: true,
  autocadastroPerguntarPrimeiraVez: true,
  autocadastroPerguntarMembroOutra: true,
  autocadastroPerguntarBatismo: true,
  autocadastroPerguntarComoConheceu: true,
  autocadastroPerguntarConexao: true,
  autocadastroPerguntarContato: true,
  autocadastroPerguntarOracao: true,
  rotulosStatus: {},
  rotulosPapel: {},
  datasBatismo: [],
  datasMembresia: [],
  sugestaoInfantil: 'crianças, adolescentes',
  sugestaoCasais: 'casais',
  sugestaoJovens: 'solteiros, jovens',
  sugestaoCoringa: 'família',
}

// Gatilhos usados pelos botões do fluxo — estes templates não podem ser excluídos
export const GATILHOS_FIXOS = [
  'segunda_aproximacao', 'quarta_conexao', 'sabado_celebracao',
  'pre_visita_lider', 'aviso_lider', 'reengajamento',
] as const

// Em qual etapa do fluxo cada gatilho fixo se encaixa (usado para agrupar
// mensagens extras junto das fixas, na mesma etapa).
export const GATILHO_ETAPA: Record<string, EtapaFluxo> = {
  segunda_aproximacao: 'aproximacao',
  quarta_conexao: 'conexao',
  sabado_celebracao: 'celebracao',
  pre_visita_lider: 'pre_visita',
  aviso_lider: 'aviso_lider',
  reengajamento: 'reengajamento',
}

function templatesPadrao(): Template[] {
  return [
    {
      id: 'tp1', gatilho: 'segunda_aproximacao', titulo: '1º Contato — Aproximação', etapa: 'aproximacao',
      texto: 'Olá, {{nome}}! Foi uma alegria receber você conosco. Ficamos felizes pela sua presença, gostaríamos de te conhecer melhor e queremos dizer que essa casa também é sua. Conte conosco para o que precisar.',
    },
    {
      id: 'tp2', gatilho: 'quarta_conexao', titulo: 'Convite para a Conexão', etapa: 'conexao',
      texto: 'Bom dia, tudo bem? Como está a sua semana? Gostaria de te apresentar um pouco sobre o nosso modelo de pastoreio. Você já ouviu falar sobre a {{nome_conexão}}?',
    },
    {
      id: 'tp3', gatilho: 'sabado_celebracao', titulo: 'Convite Celebração', etapa: 'celebracao',
      texto: 'Bom dia, tudo bem? Segue nossa programação, será um prazer ter você conosco novamente na próxima Celebração.',
    },
    {
      id: 'tp4', gatilho: 'pre_visita_lider', titulo: 'Líder — contato pré-visita', etapa: 'pre_visita',
      texto: 'Olá, {{nome}}! Que alegria saber que você quer nos visitar. Sou o líder do grupo e vai ser um prazer te receber. Posso te passar o endereço e os detalhes do nosso próximo encontro?',
    },
    {
      id: 'tp5', gatilho: 'aviso_lider', titulo: 'Aviso ao líder (handoff)', etapa: 'aviso_lider',
      texto: 'Olá! Estou te encaminhando o contato de {{nome}}, que aceitou o convite para conhecer o grupo. Pode fazer o primeiro contato antes da visita, para a pessoa já chegar acolhida?',
    },
    {
      id: 'tp6', gatilho: 'reengajamento', titulo: 'Reengajamento (voltou a responder)', etapa: 'reengajamento',
      texto: 'Oi, {{nome}}! Que alegria receber seu retorno. Como você está? Vamos combinar de nos ver na próxima celebração?',
    },
  ]
}

function estadoInicial(): AppState {
  return {
    config: { ...CONFIG_PADRAO },
    visitantes: [],
    interacoes: [],
    conexoes: [
      { id: 'cx1', nome: 'Conexão Casais Centro', bairro: 'Centro', cidade: '', perfil: 'Casais', diaHorario: 'Quinta, 20h', liderId: 'ld1' },
      { id: 'cx2', nome: 'Conexão Jovens Zona Sul', bairro: 'Zona Sul', cidade: '', perfil: 'Jovens / Solteiros', diaHorario: 'Sexta, 20h', liderId: 'ld2' },
    ],
    // Dados de exemplo genéricos (instalação nova/demonstração). Os cadastros
    // reais da igreja vivem na nuvem — a primeira sincronização os adota e a
    // mesclagem descarta estes exemplos se ninguém os estiver usando.
    usuarios: [
      { id: 'co1', nome: 'Gestão Integração', whatsapp: '(00) 90000-0100', papeis: ['coordenacao'], ativo: true, statusAcesso: 'sem_login' },
      { id: 'cs1', nome: 'Integrador(a) 1', whatsapp: '(00) 90000-0101', papeis: ['consolidador'], ativo: true, statusAcesso: 'sem_login' },
      { id: 'ld1', nome: 'Ana e Marcos', whatsapp: '(00) 90000-0001', papeis: ['lider'], ativo: true, conexaoId: 'cx1', statusAcesso: 'sem_login' },
      { id: 'ld2', nome: 'Beatriz', whatsapp: '(00) 90000-0002', papeis: ['lider'], ativo: true, conexaoId: 'cx2', statusAcesso: 'sem_login' },
    ],
    templates: templatesPadrao(),
    auditoria: [],
  }
}

// Migração de versões anteriores do formato de dados (preserva ids e referências)
function migrar(raw: any): AppState {
  const base = { ...raw }

  // v1 → v2: consolidadores/lideres separados viram `usuarios` com papel
  if (!base.usuarios) {
    const usuarios: any[] = [
      ...(base.consolidadores ?? []).map((c: any) => ({
        id: c.id, nome: c.nome, whatsapp: c.whatsapp, papel: 'consolidador' as const, ativo: c.ativo ?? true,
      })),
      ...(base.lideres ?? []).map((l: any) => ({
        id: l.id, nome: l.nome, whatsapp: l.whatsapp, papel: 'lider' as const, ativo: true, conexaoId: l.conexaoId,
      })),
    ]
    if (!usuarios.some((u) => u.papel === 'coordenacao')) {
      usuarios.unshift({ id: 'co1', nome: 'Gestão Integração', whatsapp: '(00) 90000-0100', papel: 'coordenacao', ativo: true })
    }
    base.usuarios = usuarios
    delete base.consolidadores
    delete base.lideres
  }

  // v2 → v3: configuração da igreja + templates novos do fluxo
  base.config = { ...CONFIG_PADRAO, ...(base.config ?? {}) }
  const gatilhosExistentes = new Set((base.templates ?? []).map((t: Template) => t.gatilho))
  base.templates = [
    ...(base.templates ?? []),
    ...templatesPadrao().filter((t) => !gatilhosExistentes.has(t.gatilho)),
  ]

  // v3 → v4: trilha de auditoria
  base.auditoria = base.auditoria ?? []

  // Blindagem: garante que as coleções existam antes de qualquer tela usá-las.
  // Sem isto, um estado antigo (ou um payload da nuvem anterior a um destes
  // campos) sem `interacoes`/`conexoes` derruba a ficha do visitante no primeiro
  // `.filter`. Barato e evita tela branca.
  base.visitantes = base.visitantes ?? []
  base.interacoes = base.interacoes ?? []
  base.conexoes = base.conexoes ?? []
  base.usuarios = base.usuarios ?? []

  // v4 → v5: mensagens ganham etapa do fluxo (fixas herdam do gatilho; extras viram "geral")
  base.templates = (base.templates as Template[]).map((t) => ({
    ...t,
    etapa: t.etapa ?? GATILHO_ETAPA[t.gatilho] ?? 'geral',
  }))

  // v5 → v6: lápides de exclusão (sincronização com mesclagem)
  base.excluidos = base.excluidos ?? []

  // Igrejas que ainda usam a lista de cultos padrão antiga ganham o culto da tarde
  const cultosPadraoAntigo = ['Domingo — manhã', 'Domingo — noite', 'Quarta — noite']
  if (JSON.stringify(base.config.cultos) === JSON.stringify(cultosPadraoAntigo)) {
    base.config = { ...base.config, cultos: [...CONFIG_PADRAO.cultos] }
  }

  // v6 → v7: cultos ganham cadastro estruturado (aba ⛪ Cultos). Reconcilia
  // cultosDef com a lista de rótulos — cobre dados antigos e edições feitas
  // por uma versão anterior do app, inferindo o dia da semana pelo nome.
  const nomesCultos: string[] = base.config.cultos
  const defsExistentes: CultoDef[] = Array.isArray(base.config.cultosDef) ? base.config.cultosDef : []
  if (defsExistentes.map((d) => d.nome).join(' ') !== nomesCultos.join(' ')) {
    base.config = {
      ...base.config,
      cultosDef: nomesCultos.map((n) =>
        defsExistentes.find((d) => d.nome === n) ?? { nome: n, diaSemana: diaSemanaDoCulto(n) },
      ),
    }
  }

  // v7 → v8: papel único vira lista de papéis (uma pessoa pode exercer várias
  // funções) + situação de acesso do login real. Idempotente e não destrutivo.
  base.usuarios = (base.usuarios as any[]).map((u: any) => {
    const { papel, ...resto } = u
    return {
      ...resto,
      papeis: Array.isArray(u.papeis) && u.papeis.length > 0 ? u.papeis : [papel ?? 'consolidador'],
      statusAcesso: u.statusAcesso ?? 'sem_login',
    }
  })

  // v8 → v9: batismo e membresia deixam de ser a mesma coisa.
  // O campo antigo `dataBatismoMembresia` guardava a data que CONCLUÍA a jornada,
  // sem dizer se tinha sido um batismo ou uma recepção como membro. Como o que
  // fecha a jornada é a membresia, ela vira `dataMembresia`; a situação de
  // batismo fica em branco (desconhecida) para a equipe preencher quando souber.
  base.visitantes = (base.visitantes ?? []).map((v: any) => {
    if (!v.dataBatismoMembresia || v.dataMembresia) return v
    const { dataBatismoMembresia, ...resto } = v
    return { ...resto, dataMembresia: dataBatismoMembresia }
  })

  // v9 → v10: a etapa entre "transferido" e "membro" passou a ser o BATISMO
  // (só para quem ainda não é batizado), no lugar da classe de membresia.
  // Renomeia o status no cadastro e no histórico, para não sobrar etapa órfã.
  base.visitantes = base.visitantes.map((v: any) => ({
    ...v,
    status: v.status === 'em_membresia' ? 'batismo' : v.status,
    historicoStatus: (v.historicoStatus ?? []).map((h: any) => ({
      ...h,
      de: h.de === 'em_membresia' ? 'batismo' : h.de,
      para: h.para === 'em_membresia' ? 'batismo' : h.para,
    })),
  }))

  // v10 → v11: cultos ganham lista de datas concretas (padrão do louvor). Quem
  // tem dia da semana mas ainda não tem `ocorrencias` recebe as datas geradas
  // (semanas recentes + próximas), para o cadastro do culto já vir preenchido.
  base.config.cultosDef = (base.config.cultosDef as CultoDef[] ?? []).map((c) =>
    c.diaSemana !== undefined && (!c.ocorrencias || c.ocorrencias.length === 0)
      ? { ...c, ocorrencias: gerarOcorrencias(c.diaSemana) }
      : c,
  )

  // v10 → v11: fluxo de mensagens deixa de usar dias fixos (segunda/quarta/
  // sábado). Renomeia só os títulos fixos que ainda estão no padrão antigo —
  // textos e títulos que a igreja já editou são preservados.
  const TITULOS_ANTIGOS: Record<string, string> = {
    segunda_aproximacao: 'Segunda — Aproximação',
    quarta_conexao: 'Quarta — Convite para o grupo',
    sabado_celebracao: 'Sábado — Celebração',
  }
  const TITULOS_NOVOS: Record<string, string> = {
    segunda_aproximacao: '1º Contato — Aproximação',
    quarta_conexao: 'Convite para a Conexão',
    sabado_celebracao: 'Convite Celebração',
  }
  base.templates = (base.templates as Template[]).map((t) =>
    TITULOS_ANTIGOS[t.gatilho] === t.titulo ? { ...t, titulo: TITULOS_NOVOS[t.gatilho] } : t,
  )

  // v11 → v12: Conexão troca "região" por endereço/bairro/cidade. O valor antigo
  // (usado como bairro/região na sugestão) migra para `bairro`.
  base.conexoes = (base.conexoes ?? []).map((c: any) => {
    if (c.regiao && !c.bairro) {
      const { regiao, ...resto } = c
      return { ...resto, bairro: regiao }
    }
    return c
  })

  return base as AppState
}

// Instalação nova: este navegador nunca salvou nada — o estado atual é só o
// dado de exemplo. Na primeira sincronização, a nuvem é adotada em vez de
// mesclada (senão os exemplos entrariam nos dados reais da igreja).
let estadoVirgem = false

function carregar(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrar(JSON.parse(raw))
  } catch {
    // dado corrompido: recomeça
  }
  estadoVirgem = true
  return estadoInicial()
}

// Ids dos dados de exemplo criados junto com uma instalação nova
const IDS_EXEMPLO = new Set(['co1', 'cs1', 'ld1', 'ld2', 'cx1', 'cx2'])

// Remove usuários/grupos de exemplo que ninguém está usando — aplicado antes
// de mesclar uma instalação nova com uma nuvem que já tem dados reais.
function semDadosDeExemplo(s: AppState): AppState {
  const emUso = new Set<string>()
  for (const v of s.visitantes) {
    if (v.responsavelId) emUso.add(v.responsavelId)
    if (v.liderConexaoId) emUso.add(v.liderConexaoId)
    if (v.conexaoId) emUso.add(v.conexaoId)
  }
  const remover = (id: string) => IDS_EXEMPLO.has(id) && !emUso.has(id)
  return {
    ...s,
    usuarios: s.usuarios.filter((u) => !remover(u.id)),
    conexoes: s.conexoes.filter((c) => !remover(c.id)),
  }
}

let estado: AppState = executarAutomacoes(carregar())
// Persiste imediatamente se a migração ou a automação mudou algo na carga
localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
const ouvintes = new Set<() => void>()

// ---- Estado da sincronização com a nuvem ----

export interface SnapNuvem {
  status: 'desligada' | 'sincronizando' | 'ok' | 'erro'
  ultimoSync: string // ISO ou ''
}

let snapNuvem: SnapNuvem = { status: getConfigNuvem() ? 'sincronizando' : 'desligada', ultimoSync: '' }

function setSnapNuvem(status: SnapNuvem['status'], ultimoSync?: string) {
  snapNuvem = { status, ultimoSync: ultimoSync ?? snapNuvem.ultimoSync }
  ouvintes.forEach((fn) => fn())
}

export function useNuvem(): SnapNuvem {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb)
      return () => ouvintes.delete(cb)
    },
    () => snapNuvem,
  )
}

let timerNuvem: ReturnType<typeof setTimeout> | undefined
let sincronizando = false
let temMudancaLocal = false // há alteração local ainda não enviada à nuvem
let sobrescreverProximoEnvio = false // zerar/importar: o próximo envio NÃO mescla

// Comparação de estados independente da ordem das chaves (o JSON que volta da
// nuvem pode ter as chaves em outra ordem — sem isso, todo ciclo "veria"
// diferença e regravaria a nuvem à toa).
function canonico(x: unknown): string {
  return JSON.stringify(x, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}

// Sincronização completa: baixa a nuvem, mescla com o estado local (os dados
// se somam — nada de "última gravação vence") e envia o resultado. É isto que
// permite dois computadores cadastrando ao mesmo tempo sem perder registros.
async function sincronizarComNuvem(): Promise<void> {
  const c = getConfigNuvem()
  if (!c || sincronizando) return
  sincronizando = true
  setSnapNuvem('sincronizando')
  try {
    let precisaEnviar = temMudancaLocal
    if (sobrescreverProximoEnvio) {
      precisaEnviar = true
      sobrescreverProximoEnvio = false
    } else {
      const remotoBruto = await baixarEstado(c)
      if (remotoBruto) {
        const remoto = migrar(remotoBruto)
        // Instalação nova sem edições adota a nuvem; com edições, mescla sem
        // levar junto os dados de exemplo que ninguém usou.
        const mesclado = executarAutomacoes(
          estadoVirgem && !temMudancaLocal
            ? remoto
            : mesclarEstados(estadoVirgem ? semDadosDeExemplo(estado) : estado, remoto),
        )
        estadoVirgem = false
        if (canonico(mesclado) !== canonico(estado)) {
          estado = mesclado
          localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
          ouvintes.forEach((fn) => fn())
        }
        // Grava apenas quando o conteúdo difere de verdade do que já está na
        // nuvem — evita reenvio em loop a cada ciclo (e o custo de gravação).
        precisaEnviar = canonico(mesclado) !== canonico(remoto)
        if (!precisaEnviar) temMudancaLocal = false // tudo daqui já está lá
      } else {
        precisaEnviar = true // nuvem vazia: sobe o estado local
      }
    }
    if (precisaEnviar) {
      const enviado = estado
      await enviarEstado(c, enviado)
      if (estado === enviado) temMudancaLocal = false // nada mudou durante o envio
    }
    setSnapNuvem('ok', new Date().toISOString())
  } catch {
    setSnapNuvem('erro')
  } finally {
    sincronizando = false
  }
}

// Envio com debounce: várias mudanças seguidas geram uma única sincronização
function agendarEnvioNuvem() {
  const c = getConfigNuvem()
  if (!c) return
  setSnapNuvem('sincronizando')
  clearTimeout(timerNuvem)
  timerNuvem = setTimeout(() => { void sincronizarComNuvem() }, 1200)
}

// Atualização contínua: puxa novidades dos outros computadores de tempos em
// tempos e sempre que a janela volta ao foco.
if (typeof window !== 'undefined') {
  setInterval(() => { void sincronizarComNuvem() }, 30_000)
  window.addEventListener('focus', () => { void sincronizarComNuvem() })
}

// Testa credenciais e devolve o que existe na nuvem (null = nuvem vazia)
export async function testarNuvem(c: ConfigNuvem): Promise<AppState | null> {
  return baixarEstado(c)
}

// Ativa a sincronização; se `remoto` vier preenchido, adota os dados da nuvem
export async function ativarNuvem(c: ConfigNuvem, remoto: AppState | null): Promise<void> {
  setConfigNuvem(c)
  if (remoto) {
    estado = executarAutomacoes(migrar(remoto))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
  }
  await enviarEstado(c, estado)
  setSnapNuvem('ok', new Date().toISOString())
}

export function desligarNuvem() {
  setConfigNuvem(null)
  clearTimeout(timerNuvem)
  setSnapNuvem('desligada')
}

// Na abertura do app: mescla o local com o que está na nuvem (não sobrescreve —
// alterações feitas offline e novidades de outros computadores se somam)
if (getConfigNuvem()) {
  void sincronizarComNuvem()
}

function salvar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
  temMudancaLocal = true
  ouvintes.forEach((fn) => fn())
  agendarEnvioNuvem()
}

export function getEstado(): AppState {
  return estado
}

export function setEstado(mutador: (s: AppState) => AppState) {
  const anterior = estado
  estado = mutador(estado)
  // Carimbo de edição da config: decide qual config vence na mesclagem
  if (estado.config !== anterior.config) {
    estado = { ...estado, configAtualizadaEm: new Date().toISOString() }
  }
  salvar()
}

// Registra lápides de exclusão — sem isso, a mesclagem com outro computador
// traria os registros apagados de volta.
export function comExclusoes(s: AppState, tipo: Exclusao['tipo'], ids: string[]): AppState {
  const em = new Date().toISOString()
  return {
    ...s,
    excluidos: [...(s.excluidos ?? []), ...ids.map((id) => ({ tipo, id, em }))],
  }
}

export function substituirEstado(novo: AppState) {
  estado = executarAutomacoes(migrar(novo))
  sobrescreverProximoEnvio = true // importação substitui a nuvem, não mescla
  salvar()
}

// Zerar apaga tudo, mas preserva a própria evidência de quem apagou (LGPD:
// ações destrutivas precisam deixar rastro mesmo depois de executadas).
export function zerarDados() {
  const antigo = estado
  const usuarioId = getUsuarioAtualId()
  const usuario = antigo.usuarios.find((u) => u.id === usuarioId)
  const registroZerar: RegistroAuditoria = {
    id: uid(),
    data: new Date().toISOString(),
    usuarioId: usuarioId ?? undefined,
    usuarioNome: usuario?.nome ?? 'Não identificado (modo aberto)',
    acao: '🗑️ Zerou todos os dados',
    detalhe: `${antigo.visitantes.length} visitante(s) apagados`,
  }
  localStorage.removeItem(STORAGE_KEY)
  const novo = { ...estadoInicial(), auditoria: [registroZerar] }
  // Lápides de tudo o que foi apagado, para o zerar valer também nos outros
  // computadores (sem elas, a mesclagem traria os dados de volta). Ids que
  // coincidem com os dados de exemplo recém-criados ficam de fora.
  const em = new Date().toISOString()
  const idsNovos = new Set([
    ...novo.usuarios.map((u) => u.id), ...novo.conexoes.map((c) => c.id), ...novo.templates.map((t) => t.id),
  ])
  const lapide = (tipo: Exclusao['tipo']) => (x: { id: string }): Exclusao => ({ tipo, id: x.id, em })
  novo.excluidos = [
    ...antigo.visitantes.map(lapide('visitante')),
    ...antigo.interacoes.map(lapide('interacao')),
    ...antigo.usuarios.map(lapide('usuario')),
    ...antigo.conexoes.map(lapide('conexao')),
    ...antigo.templates.map(lapide('template')),
  ].filter((t) => !idsNovos.has(t.id))
  estado = novo
  sobrescreverProximoEnvio = true
  salvar()
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb)
      return () => ouvintes.delete(cb)
    },
    () => estado,
  )
}

// ---- Consultas auxiliares ----

export function consolidadoresAtivos(s: AppState): Usuario[] {
  return s.usuarios.filter((u) => (u.papeis.includes('consolidador') || u.papeis.includes('coordenacao')) && u.ativo)
}

export function lideres(s: AppState): Usuario[] {
  return s.usuarios.filter((u) => u.papeis.includes('lider') && u.ativo)
}

// Supervisor padrão dos Integradores pós-culto: o primeiro gestor da
// Integração ativo (em ordem alfabética) — editável depois na Hierarquia.
export function primeiraGestaoIntegracao(s: AppState): Usuario | undefined {
  return s.usuarios
    .filter((u) => u.ativo && u.papeis.includes('coordenacao'))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))[0]
}

export function usuarioPorId(s: AppState, id?: string): Usuario | undefined {
  return s.usuarios.find((u) => u.id === id)
}

export function templatePorGatilho(s: AppState, gatilho: string): Template | undefined {
  return s.templates.find((t) => t.gatilho === gatilho)
}

// Todas as mensagens (fixa + extras) que podem ser usadas numa etapa do fluxo —
// permite que a igreja tenha mais de uma opção para o mesmo momento.
export function templatesPorEtapa(s: AppState, etapa: EtapaFluxo): Template[] {
  return s.templates.filter((t) => t.etapa === etapa)
}

export function interacoesDe(s: AppState, visitanteId: string): Interacao[] {
  return s.interacoes
    .filter((i) => i.visitanteId === visitanteId)
    .sort((a, b) => b.data.localeCompare(a.data))
}

export function ultimaRespostaOuCadastro(s: AppState, v: Visitante): string {
  const respostas = interacoesDe(s, v.id).filter((i) => i.respondeu)
  return respostas[0]?.data ?? v.dataCadastro
}

// ---- Contatos parados (sem atualização da equipe) ----

// Etapas em que alguém deveria estar mexendo na ficha
const STATUS_EM_ANDAMENTO: Status[] = [
  'novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou', 'transferido',
  // 'batismo' entra aqui: encaminhar ao batismo e esquecer é o esquecimento mais
  // fácil de acontecer — a pessoa "já está resolvida" na cabeça de todo mundo.
  'batismo',
]

// Dias desde a última movimentação da FICHA (edição ou contato registrado) —
// diferente de "sem resposta", que mede o silêncio do visitante.
export function diasSemAtualizacao(s: AppState, v: Visitante): number {
  const ultimaInteracao = interacoesDe(s, v.id)[0]?.data ?? ''
  const base = ultimaInteracao > v.atualizadoEm ? ultimaInteracao : v.atualizadoEm
  return diasDesde(base || v.dataCadastro)
}

// Alerta: ficha ativa parada há 7+ dias — pedir atualização ao consolidador
export const PRAZO_ATUALIZACAO_DIAS = 7

export function semAtualizacao(s: AppState, v: Visitante): boolean {
  return STATUS_EM_ANDAMENTO.includes(v.status) && diasSemAtualizacao(s, v) >= PRAZO_ATUALIZACAO_DIAS
}

// ---- Automações (seção 13) ----

// Contador de silêncio: N dias sem resposta → Em espera (prazo configurável)
export function executarAutomacoes(s: AppState): AppState {
  const prazo = s.config?.prazoEsperaDias ?? 14
  const visitantes = s.visitantes.map((v) => {
    if (v.status !== 'em_contato' && v.status !== 'aguardando_resposta') return v
    const base = s.interacoes
      .filter((i) => i.visitanteId === v.id && i.respondeu)
      .sort((a, b) => b.data.localeCompare(a.data))[0]?.data ?? v.dataCadastro
    if (diasDesde(base) >= prazo) {
      return aplicarTransicao(v, 'em_espera', `${prazo} dias sem resposta (automático)`, true)
    }
    return v
  })
  return { ...s, visitantes }
}
