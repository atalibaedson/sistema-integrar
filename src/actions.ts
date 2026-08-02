// Operações de negócio — fluxo principal (seção 7) e exceções (seção 8)
import type { AppState, HorarioContato, Interacao, Origem, Papel, SituacaoBatismo, SituacaoCivil, Status, StatusAcesso, Usuario, Visitante } from './types'
import { rotuloPapel, SITUACAO_BATISMO_LABEL } from './types'
import { aplicarTransicao, mesesDesde } from './machine'
import { comExclusoes, consolidadoresAtivos, getEstado, interacoesDe, primeiraGestaoIntegracao, setEstado, uid } from './store'
import { registrarAuditoria } from './auditoria'
import { getUsuarioAtualId, usuarioAtual } from './acesso'
import { supabase } from './supabaseClient'

export interface NovoVisitanteInput {
  nome: string
  whatsapp: string
  email?: string
  origem: Origem
  cultoPrimeiraVisita?: string
  dataPrimeiraVisita?: string // yyyy-mm-dd
  comoConheceu?: string
  situacaoCivil?: SituacaoCivil
  dataNascimento?: string
  endereco?: string
  bairro?: string
  cidade?: string
  primeiraVez?: boolean
  membroOutraIgreja?: boolean
  desejaConexao?: string
  desejaContato?: boolean
  melhorHorarioContato?: HorarioContato
  pedidoOracao?: string
  situacaoBatismo?: SituacaoBatismo
  flagMenorIdade: boolean
  flagOutraCidade: boolean
  observacoes?: string
  consentimentoLgpd: boolean // autorização para uso dos dados (LGPD) — obrigatória
}

export interface ResultadoTriagem {
  visitante: Visitante
  avisos: string[]
  duplicadoDe?: Visitante
}

export function normalizarWhats(w: string): string {
  return w.replace(/\D/g, '')
}

function normalizarTexto(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Sugestão de Conexão por pontuação: proximidade (bairro/região) pesa mais,
// depois compatibilidade de público com a situação civil / idade (regra 4).
export function sugerirConexao(
  s: AppState,
  bairro?: string,
  situacao?: SituacaoCivil,
  menorIdade?: boolean,
) {
  const palavrasBairro = normalizarTexto(bairro ?? '')
    .split(/[\s,]+/)
    .filter((w) => w.length > 3)

  let melhor = s.conexoes[0]
  let melhorPts = -Infinity

  for (const c of s.conexoes) {
    const local = normalizarTexto(`${c.bairro ?? ''} ${c.endereco ?? ''} ${c.cidade ?? ''} ${c.regiao ?? ''}`)
    const perfil = normalizarTexto(c.perfil ?? '')
    let pts = 0

    // 1) Proximidade: bairro do visitante aparece no endereço/bairro/cidade do grupo
    if (palavrasBairro.some((w) => local.includes(w))) pts += 4

    // 2) Público-alvo compatível
    const infantil = /crianc|adolesc/.test(perfil)
    if (menorIdade) {
      if (infantil) pts += 3
    } else if (infantil) {
      pts -= 10 // nunca sugerir grupo infantil para adulto
    }
    if (situacao === 'casado' && /casa/.test(perfil)) pts += 2
    if (situacao === 'solteiro' && /solteir|jovem|jovens/.test(perfil)) pts += 2

    // 3) "Família" acolhe qualquer perfil — leve preferência como coringa
    if (/famil/.test(perfil)) pts += 1

    if (pts > melhorPts) {
      melhorPts = pts
      melhor = c
    }
  }
  return melhor
}

// Duplicidade: mesmo WhatsApp (chave principal) ou mesmo e-mail
export function buscarDuplicado(s: AppState, whatsapp: string, email?: string): Visitante | undefined {
  const w = whatsapp.replace(/\D/g, '')
  const e = (email ?? '').trim().toLowerCase()
  return s.visitantes.find(
    (v) =>
      (w.length >= 10 && normalizarWhats(v.whatsapp) === w) ||
      (e !== '' && (v.email ?? '').trim().toLowerCase() === e),
  )
}

// Fase 0 — Entrada e triagem
export function cadastrarVisitante(input: NovoVisitanteInput): ResultadoTriagem {
  const s = getEstado()
  const avisos: string[] = []
  const agora = new Date().toISOString()
  const whats = normalizarWhats(input.whatsapp)

  // Triagem: WhatsApp válido?
  const whatsValido = whats.length >= 10
  if (!whatsValido) avisos.push('WhatsApp inválido — visitante entra como Encerrado/Inválido.')

  // Triagem: duplicado? WhatsApp igual encerra; e-mail igual só avisa
  const duplicadoDe = s.visitantes.find(
    (v) => normalizarWhats(v.whatsapp) === whats && whats.length >= 10,
  )
  if (duplicadoDe) avisos.push(`Possível duplicado de "${duplicadoDe.nome}" (mesmo WhatsApp).`)
  const emailNorm = (input.email ?? '').trim().toLowerCase()
  const mesmoEmail = emailNorm !== '' &&
    s.visitantes.find((v) => (v.email ?? '').trim().toLowerCase() === emailNorm)
  if (mesmoEmail && !duplicadoDe) {
    avisos.push(`Atenção: o e-mail informado já está no cadastro de "${mesmoEmail.nome}".`)
  }

  if (input.flagMenorIdade) avisos.push('Menor de idade — o contato deve ser feito com o responsável.')
  if (input.flagOutraCidade) avisos.push('Visitante de passagem — acolhimento pontual, sem entrar na semana.')

  const encerrar = !whatsValido || !!duplicadoDe || input.flagOutraCidade
  // Prioriza quem está cadastrando (se for consolidador/coordenação ativo) como
  // responsável — do contrário, a pessoa perde o acesso à própria ficha ao salvar.
  const euAtual = usuarioAtual(s, getUsuarioAtualId())
  const responsavel = (euAtual && (euAtual.papeis.includes('consolidador') || euAtual.papeis.includes('coordenacao')))
    ? euAtual
    : consolidadoresAtivos(s)[0]
  const conexao = sugerirConexao(s, input.bairro, input.situacaoCivil, input.flagMenorIdade)

  const visitante: Visitante = {
    id: uid(),
    nome: input.nome.trim(),
    whatsapp: input.whatsapp.trim(),
    email: input.email?.trim() || undefined,
    dataCadastro: agora,
    origem: input.origem,
    cultoPrimeiraVisita: input.cultoPrimeiraVisita,
    dataPrimeiraVisita: input.dataPrimeiraVisita,
    comoConheceu: input.comoConheceu,
    status: encerrar ? 'encerrado' : 'novo',
    responsavelId: encerrar ? undefined : responsavel?.id,
    conexaoId: encerrar ? undefined : conexao?.id,
    liderConexaoId: encerrar ? undefined : conexao?.liderId,
    situacaoCivil: input.situacaoCivil,
    dataNascimento: input.dataNascimento || undefined,
    endereco: input.endereco?.trim() || undefined,
    bairro: input.bairro?.trim() || undefined,
    cidade: input.cidade?.trim() || undefined,
    primeiraVez: input.primeiraVez,
    membroOutraIgreja: input.membroOutraIgreja,
    desejaConexao: input.desejaConexao || undefined,
    desejaContato: input.desejaContato,
    melhorHorarioContato: input.melhorHorarioContato,
    pedidoOracao: input.pedidoOracao?.trim() || undefined,
    situacaoBatismo: input.situacaoBatismo,
    flagMenorIdade: input.flagMenorIdade,
    flagOutraCidade: input.flagOutraCidade,
    flagCuidado: false,
    transferenciaConfirmada: false,
    consentimentoLgpd: input.consentimentoLgpd,
    consentimentoLgpdData: input.consentimentoLgpd ? agora : undefined,
    observacoes: input.observacoes?.trim() || undefined,
    historicoStatus: [
      {
        de: null,
        para: encerrar ? 'encerrado' : 'novo',
        data: agora,
        motivo: encerrar ? `Triagem: ${avisos.join(' ')}` : 'Cadastro realizado',
        automatica: encerrar,
      },
    ],
    criadoEm: agora,
    atualizadoEm: agora,
  }

  if (!responsavel && !encerrar) {
    avisos.push('Nenhum consolidador ativo — visitante sem responsável! Avise a coordenação.')
  }

  setEstado((st) => ({ ...st, visitantes: [visitante, ...st.visitantes] }))
  registrarAuditoria('Cadastrou visitante', {
    alvoTipo: 'visitante', alvoId: visitante.id, alvoNome: visitante.nome,
    detalhe: encerrar ? `Encerrado na triagem: ${avisos.join(' ')}` : undefined,
  })
  return { visitante, avisos, duplicadoDe }
}

export type Classificacao = 'pronto' | 'respondeu' | 'silencio' | 'recusa' | 'cuidado'

export interface NovaInteracaoInput {
  visitanteId: string
  tipo: Interacao['tipo']
  autorPapel: 'consolidador' | 'lider'
  respondeu: boolean
  grauAbertura: Interacao['grauAbertura']
  retornoResumo: string
  proximosPassos: string
  encaminhamentos: string
  classificacao: Classificacao
}

// Registro obrigatório após cada contato (seção 11) + classificação em 4 caminhos (seção 8)
export function registrarInteracao(input: NovaInteracaoInput) {
  const agora = new Date().toISOString()
  const nomeVisitante = getEstado().visitantes.find((v) => v.id === input.visitanteId)?.nome ?? '?'
  const interacao: Interacao = {
    id: uid(),
    visitanteId: input.visitanteId,
    autorPapel: input.autorPapel,
    data: agora,
    canal: 'whatsapp',
    tipo: input.tipo,
    respondeu: input.respondeu,
    grauAbertura: input.grauAbertura,
    retornoResumo: input.retornoResumo.trim(),
    proximosPassos: input.proximosPassos.trim(),
    encaminhamentos: input.encaminhamentos.trim(),
    flagCuidado: input.classificacao === 'cuidado',
  }

  setEstado((s) => {
    const visitantes = s.visitantes.map((v) => {
      if (v.id !== input.visitanteId) return v
      let novo = v

      switch (input.classificacao) {
        case 'pronto':
          // PRONTO (8.1): atalho direto para o handoff ao líder
          if (v.status === 'novo') novo = aplicarTransicao(novo, 'em_contato', 'Primeiro contato realizado')
          if (novo.status === 'em_contato' || novo.status === 'aguardando_resposta' || novo.status === 'em_espera') {
            if (novo.status === 'em_espera') novo = aplicarTransicao(novo, 'em_contato', 'Pessoa sinalizou presença')
            novo = aplicarTransicao(novo, 'encaminhado_lider', 'Aceitou o convite para a Conexão — handoff antecipado')
          }
          break
        case 'respondeu':
          if (v.status === 'novo') novo = aplicarTransicao(novo, 'em_contato', 'Primeiro contato realizado')
          else if (v.status === 'aguardando_resposta') novo = aplicarTransicao(novo, 'em_contato', 'Pessoa respondeu')
          else if (v.status === 'em_espera') novo = aplicarTransicao(novo, 'em_contato', 'Pessoa sinalizou presença — reengajamento')
          else if (v.status === 'recusou') novo = aplicarTransicao(novo, 'em_contato', 'Pessoa retornou — porta aberta')
          break
        case 'silencio':
          // SILÊNCIO (8.2): registrar sem retorno e tentar no próximo dia do fluxo
          if (v.status === 'novo') novo = aplicarTransicao(novo, 'em_contato', 'Primeiro contato realizado')
          if (novo.status === 'em_contato') novo = aplicarTransicao(novo, 'aguardando_resposta', 'Contato enviado, sem retorno')
          break
        case 'recusa':
          // RECUSA (8.4): encerrar com gentileza e parar os contatos
          novo = aplicarTransicao(novo, 'recusou', 'Pediu para não ser contatado')
          break
        case 'cuidado':
          // CUIDADO/CRISE (8.5): flag transversal, não muda o status
          novo = { ...novo, flagCuidado: true, atualizadoEm: agora }
          break
      }
      return novo
    })
    return { ...s, visitantes, interacoes: [interacao, ...s.interacoes] }
  })
  registrarAuditoria('Registrou contato', {
    alvoTipo: 'visitante', alvoId: input.visitanteId, alvoNome: nomeVisitante,
    detalhe: `Classificação: ${input.classificacao}${input.classificacao === 'cuidado' ? ' 🚨' : ''}`,
  })
}

export function mudarStatus(visitanteId: string, para: Visitante['status'], motivo: string) {
  const nome = getEstado().visitantes.find((v) => v.id === visitanteId)?.nome ?? '?'
  setEstado((s) => ({
    ...s,
    visitantes: s.visitantes.map((v) =>
      v.id === visitanteId ? aplicarTransicao(v, para, motivo) : v,
    ),
  }))
  registrarAuditoria('Mudou status', { alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome, detalhe: `→ ${para} (${motivo})` })
}

export function atualizarVisitante(visitanteId: string, patch: Partial<Visitante>) {
  setEstado((s) => ({
    ...s,
    visitantes: s.visitantes.map((v) =>
      v.id === visitanteId ? { ...v, ...patch, atualizadoEm: new Date().toISOString() } : v,
    ),
  }))
}

// Apaga um cadastro feito por engano (duplicado, teste, pessoa errada). Diferente
// de "encerrado" — some da lista de vez, mas fica registrado na auditoria.
export function excluirVisitante(visitanteId: string, motivo?: string) {
  const nome = getEstado().visitantes.find((v) => v.id === visitanteId)?.nome ?? '?'
  setEstado((s) => {
    const interacoesRemovidas = s.interacoes.filter((i) => i.visitanteId === visitanteId).map((i) => i.id)
    return comExclusoes(
      comExclusoes(
        {
          ...s,
          visitantes: s.visitantes.filter((v) => v.id !== visitanteId),
          interacoes: s.interacoes.filter((i) => i.visitanteId !== visitanteId),
        },
        'visitante', [visitanteId],
      ),
      'interacao', interacoesRemovidas,
    )
  })
  registrarAuditoria('🗑️ Excluiu cadastro de visitante', {
    alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome, detalhe: motivo || undefined,
  })
}

export function sinalizarCuidado(visitanteId: string) {
  const nome = getEstado().visitantes.find((v) => v.id === visitanteId)?.nome ?? '?'
  atualizarVisitante(visitanteId, { flagCuidado: true })
  registrarAuditoria('🚨 Sinalizou cuidado/crise', { alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome })
}

export function resolverCuidado(visitanteId: string) {
  const nome = getEstado().visitantes.find((v) => v.id === visitanteId)?.nome ?? '?'
  atualizarVisitante(visitanteId, { flagCuidado: false })
  registrarAuditoria('Resolveu sinalização de cuidado', { alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome })
}

// ---- Correção de status ----

// Desfaz a última mudança de status (marcada por engano), restaurando o anterior.
export function desfazerUltimaMudanca(visitanteId: string) {
  const v0 = getEstado().visitantes.find((v) => v.id === visitanteId)
  const nome = v0?.nome ?? '?'
  const desfeita = v0?.historicoStatus[v0.historicoStatus.length - 1]
  setEstado((s) => ({
    ...s,
    visitantes: s.visitantes.map((v) => {
      if (v.id !== visitanteId || v.historicoStatus.length < 2) return v
      const desfeita = v.historicoStatus[v.historicoStatus.length - 1]
      const hist = v.historicoStatus.slice(0, -1)
      return {
        ...v,
        status: hist[hist.length - 1].para,
        transferenciaConfirmada: desfeita.para === 'transferido' ? false : v.transferenciaConfirmada,
        // Desfazer a conclusão limpa a data de membresia. O batismo NÃO é tocado:
        // é um fato da pessoa, independente da etapa em que ela está no funil.
        dataMembresia: desfeita.para === 'integrado' ? undefined : v.dataMembresia,
        historicoStatus: [
          ...hist,
          // registra a correção sem apagar a trilha de auditoria
        ],
        atualizadoEm: new Date().toISOString(),
      }
    }),
  }))
  if (desfeita) {
    registrarAuditoria('↩️ Desfez última mudança de status', { alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome, detalhe: `Cancelou: ${desfeita.de ?? '∅'} → ${desfeita.para}` })
  }
}

// Correção manual: permite definir QUALQUER status, fora da máquina de estados,
// desde que com motivo — tudo fica registrado no histórico como correção.
export function corrigirStatus(visitanteId: string, para: Status, motivo: string) {
  const agora = new Date().toISOString()
  const nome = getEstado().visitantes.find((v) => v.id === visitanteId)?.nome ?? '?'
  setEstado((s) => ({
    ...s,
    visitantes: s.visitantes.map((v) => {
      if (v.id !== visitanteId || v.status === para) return v
      return {
        ...v,
        status: para,
        transferenciaConfirmada: para === 'transferido' ? true
          : para === 'batismo' || para === 'integrado' ? v.transferenciaConfirmada
            : false,
        historicoStatus: [
          ...v.historicoStatus,
          { de: v.status, para, data: agora, motivo: `✏️ Correção manual: ${motivo || 'sem motivo informado'}`, automatica: false },
        ],
        atualizadoEm: agora,
      }
    }),
  }))
  registrarAuditoria('✏️ Correção manual de status', { alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome, detalhe: `→ ${para}. Motivo: ${motivo || '—'}` })
}

// ---- WhatsApp ----

export function linkWhatsApp(numero: string, texto?: string): string {
  let digitos = numero.replace(/\D/g, '')
  if (digitos.length <= 11) digitos = '55' + digitos // assume Brasil
  return `https://wa.me/${digitos}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

// Nome do grupo (Conexão/Célula/PG…) ligado ao visitante: primeiro a conexão
// dele; se não tiver, a conexão liderada pelo líder encaminhado.
export function nomeConexaoDoVisitante(s: AppState, v: Visitante): string {
  const direta = s.conexoes.find((c) => c.id === v.conexaoId)
  if (direta) return direta.nome
  const lider = s.usuarios.find((u) => u.id === v.liderConexaoId)
  const doLider = lider && s.conexoes.find((c) => c.id === lider.conexaoId)
  return doLider?.nome ?? ''
}

/**
 * Substitui as variáveis do template. Aceita:
 *  - {{nome}}          → primeiro nome do visitante
 *  - {{nome_conexão}}  → nome do grupo do visitante (com ou sem acento)
 * `alvo` pode ser o visitante (com estado, para resolver a Conexão) ou só o nome.
 */
export function aplicarTemplate(texto: string, alvo: Visitante | string, s?: AppState): string {
  const nome = typeof alvo === 'string' ? alvo : alvo.nome
  const estado = s ?? getEstado()
  const nomeConexao = typeof alvo === 'string' ? '' : nomeConexaoDoVisitante(estado, alvo)
  const termo = estado.config.termoGrupo || 'Conexão'
  return texto
    .replace(/\{\{\s*nome\s*\}\}/g, nome.split(' ')[0])
    .replace(/\{\{\s*nome[_ ]conex[ãa]o\s*\}\}/gi, nomeConexao || `sua ${termo}`)
}

// ---- Próxima ação sugerida (guia o usuário em cada etapa) ----

export interface AcaoSugerida {
  titulo: string
  detalhe: string
  gatilhoTemplate?: string // template a usar no botão de WhatsApp
  urgente?: boolean
}

export function proximaAcao(s: AppState, v: Visitante): AcaoSugerida {
  if (v.flagCuidado) {
    return { titulo: 'Acionar a liderança (cuidado/crise)', detalhe: 'Saia do roteiro, acione o pastor e registre o encaminhamento.', urgente: true }
  }
  const ints = interacoesDe(s, v.id)
  const fez = (t: Interacao['tipo']) => ints.some((i) => i.tipo === t)
  switch (v.status) {
    case 'novo':
      return { titulo: 'Fazer o 1º contato (Aproximação)', detalhe: 'Acolher e dizer que a casa também é dela.', gatilhoTemplate: 'segunda_aproximacao', urgente: true }
    case 'em_contato':
    case 'aguardando_resposta': {
      if (!fez('aproximacao'))
        return { titulo: 'Enviar mensagem de 1º contato (Aproximação)', detalhe: 'Primeiro contato de acolhimento.', gatilhoTemplate: 'segunda_aproximacao' }
      if (!fez('conexao'))
        return { titulo: 'Convidar para o grupo', detalhe: 'Apresentar o modelo de pastoreio e convidar.', gatilhoTemplate: 'quarta_conexao' }
      if (!fez('celebracao'))
        return { titulo: 'Enviar convite para a Celebração', detalhe: 'Reforçar o convite para a próxima celebração.', gatilhoTemplate: 'sabado_celebracao' }
      return { titulo: 'Manter contato e reforçar o convite', detalhe: 'Adapte a abordagem ao perfil da pessoa.', gatilhoTemplate: 'quarta_conexao' }
    }
    case 'encaminhado_lider':
      return { titulo: 'Líder: fazer contato ANTES da visita', detalhe: 'A pessoa não pode chegar "de paraquedas" — o líder inicia o vínculo.', urgente: true }
    case 'visitou':
      return { titulo: 'Cobrar confirmação do líder', detalhe: 'A transferência só se conclui quando o líder confirma que assumiu.' }
    case 'transferido':
      return { titulo: 'Acompanhar com o líder', detalhe: 'Consolidação em suporte até a integração se confirmar.' }
    case 'batismo':
      // Dentro da etapa há dois momentos bem diferentes: antes e depois do
      // batismo acontecer. Mandar "acompanhar até o batismo" para quem já foi
      // batizado faz o time perder tempo com o passo errado.
      return v.situacaoBatismo === 'batizado_aqui' || v.situacaoBatismo === 'ja_batizado'
        ? { titulo: 'Receber como membro', detalhe: 'Já foi batizado(a) — falta a recepção como membro para concluir a jornada.' }
        : { titulo: 'Acompanhar até o batismo', detalhe: 'Encaminhada ao batismo — depois dele, receber como membro.' }
    case 'em_espera':
      return { titulo: 'Enviar informativo da celebração', detalhe: 'Acompanhamento leve. Reabrir contato pessoal quando sinalizar presença.', gatilhoTemplate: 'sabado_celebracao' }
    case 'recusou':
      return { titulo: 'Não contatar', detalhe: 'Respeitar é não ser invasivo. A porta segue aberta se a pessoa retornar.' }
    case 'integrado':
      return { titulo: 'Jornada concluída 🎉', detalhe: 'Recebida como membro e integrada à vida da igreja.' }
    case 'encerrado':
      return { titulo: 'Sem ação', detalhe: 'Cadastro encerrado na triagem.' }
  }
}

// Tipo de contato sugerido para o próximo registro (Seg/Qua/Sáb do fluxo)
export function proximoTipoContato(s: AppState, v: Visitante): Interacao['tipo'] {
  const a = proximaAcao(s, v)
  switch (a.gatilhoTemplate) {
    case 'segunda_aproximacao': return 'aproximacao'
    case 'quarta_conexao': return 'conexao'
    case 'sabado_celebracao': return 'celebracao'
    default: return 'livre'
  }
}

// ---- Cadastro de integrante do ministério (login real) ----

export interface NovoIntegranteInput {
  nome: string
  whatsapp: string
  email: string // obrigatório — vira a conta de login
  senha: string
  dataNascimento?: string
  situacaoCivil?: SituacaoCivil
  conexaoId?: string // de qual Conexão/grupo a pessoa faz parte
  fotoArquivo?: File
  papeis: Papel[]
  loginPreferido: 'email' | 'whatsapp'
  consentimentoLgpd: boolean
}

export interface ResultadoCadastroIntegrante {
  ok: boolean
  erro?: string
  usuarioId?: string
}

// Autocadastro completo: cria/atualiza o Usuario, sobe a foto, cria a conta no
// Supabase Auth (que envia o e-mail de confirmação) e deixa o acesso pendente.
export async function cadastrarIntegrante(input: NovoIntegranteInput): Promise<ResultadoCadastroIntegrante> {
  if (!supabase) return { ok: false, erro: 'Sincronização online não configurada — o cadastro com senha precisa dela.' }
  const s = getEstado()
  const whats = normalizarWhats(input.whatsapp)
  const email = input.email.trim().toLowerCase()

  // Dedup: quem já é da equipe (cadastrado pela liderança) é atualizado no
  // lugar; quem já tem conta de login é orientado a entrar.
  const existente = s.usuarios.find(
    (u) =>
      (whats.length >= 10 && normalizarWhats(u.whatsapp) === whats) ||
      (u.email ?? '').trim().toLowerCase() === email,
  )
  if (existente?.authUserId) {
    return { ok: false, erro: 'Já existe uma conta com esse WhatsApp ou e-mail. Use a tela "Entrar" — ou "Esqueci a senha".' }
  }

  // 1) Conta no Supabase Auth — dispara o e-mail de confirmação.
  //    O redirect volta para a RAIZ do site (sem #/rota): o token vem no hash
  //    e o supabase-js o consome antes de o roteador enxergar.
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.senha,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) {
    const msg = /already registered/i.test(error.message)
      ? 'Esse e-mail já tem uma conta. Use a tela "Entrar".'
      : `Não foi possível criar a conta: ${error.message}`
    return { ok: false, erro: msg }
  }

  // 2) Foto de perfil (opcional) — bucket público "avatares"
  let fotoUrl: string | undefined
  if (input.fotoArquivo) {
    try {
      const ext = (input.fotoArquivo.name.split('.').pop() || 'jpg').toLowerCase()
      const caminho = `${existente?.id ?? uid()}-${Date.now()}.${ext}`
      const up = await supabase.storage.from('avatares').upload(caminho, input.fotoArquivo, { upsert: true })
      if (!up.error) fotoUrl = supabase.storage.from('avatares').getPublicUrl(caminho).data.publicUrl
    } catch {
      // foto é opcional: falha no upload não impede o cadastro
    }
  }

  const agora = new Date().toISOString()
  const dados: Partial<Usuario> = {
    nome: input.nome.trim(),
    whatsapp: input.whatsapp.trim(),
    email,
    dataNascimento: input.dataNascimento || undefined,
    situacaoCivil: input.situacaoCivil,
    conexaoId: input.conexaoId || undefined,
    fotoUrl,
    authUserId: data.user?.id,
    statusAcesso: 'pendente_confirmacao_email' as StatusAcesso,
    loginPreferido: input.loginPreferido,
    cadastroCompletoEm: agora,
  }

  let usuarioId: string
  if (existente) {
    usuarioId = existente.id
    setEstado((st) => ({
      ...st,
      usuarios: st.usuarios.map((u) =>
        u.id === existente.id
          ? { ...u, ...dados, papeis: [...new Set([...u.papeis, ...input.papeis])] }
          : u,
      ),
    }))
  } else {
    usuarioId = uid()
    const gestor = input.papeis.includes('consolidador') ? primeiraGestaoIntegracao(s) : undefined
    const novo: Usuario = {
      id: usuarioId,
      papeis: input.papeis,
      ativo: true,
      supervisorId: gestor?.id,
      ...(dados as Omit<Usuario, 'id' | 'papeis' | 'ativo'>),
    } as Usuario
    setEstado((st) => ({ ...st, usuarios: [...st.usuarios, novo] }))
  }
  registrarAuditoria('📝 Integrante fez o autocadastro', {
    alvoTipo: 'usuario', alvoId: usuarioId, alvoNome: input.nome.trim(),
    detalhe: `Funções: ${input.papeis.join(', ')} · aguardando confirmação de e-mail`,
  })
  return { ok: true, usuarioId }
}

// Chamado quando uma sessão real aparece com e-mail confirmado no Auth:
// avança o status para "aguardando aprovação".
export function marcarEmailConfirmado(usuarioId: string) {
  const agora = new Date().toISOString()
  const u0 = getEstado().usuarios.find((u) => u.id === usuarioId)
  if (!u0 || u0.statusAcesso !== 'pendente_confirmacao_email') return
  setEstado((s) => ({
    ...s,
    usuarios: s.usuarios.map((u) =>
      u.id === usuarioId ? { ...u, statusAcesso: 'pendente_aprovacao', emailConfirmadoEm: agora } : u,
    ),
  }))
  registrarAuditoria('✅ Integrante confirmou o e-mail', { alvoTipo: 'usuario', alvoId: usuarioId, alvoNome: u0.nome })
}

// ---- Bootstrap do primeiro administrador ----
// Sem o modo aberto ("Vendo como"), aprovar a 1ª conta seria um ovo-e-galinha:
// para aprovar alguém é preciso já ser Pastor/Gestão aprovado. Enquanto NÃO
// existir nenhum administrador aprovado, a própria pessoa pode ativar seu acesso
// como Gestão Integração — a partir daí, todo mundo entra pelo fluxo normal.
export function existeAdminAprovado(s: AppState): boolean {
  return s.usuarios.some(
    (u) => u.ativo && u.statusAcesso === 'aprovado' && (u.papeis.includes('pastor') || u.papeis.includes('coordenacao')),
  )
}

export function ativarPrimeiroAdmin(usuarioId: string): boolean {
  const s = getEstado()
  if (existeAdminAprovado(s)) return false // já há admin — não é mais bootstrap
  const alvo = s.usuarios.find((u) => u.id === usuarioId)
  if (!alvo) return false
  const agora = new Date().toISOString()
  setEstado((st) => ({
    ...st,
    usuarios: st.usuarios.map((u) =>
      u.id === usuarioId
        ? { ...u, ativo: true, statusAcesso: 'aprovado' as StatusAcesso, papeis: [...new Set<Papel>([...u.papeis, 'coordenacao'])], aprovadoPorId: u.id, aprovadoEm: agora, motivoRejeicao: undefined }
        : u,
    ),
  }))
  registrarAuditoria('🔓 Ativou a 1ª conta de administrador (bootstrap)', { alvoTipo: 'usuario', alvoId: usuarioId, alvoNome: alvo.nome })
  return true
}

// Aprovação: somente Pastores/Gestão Ministerial e Gestão Integração (a tela
// de Aprovações já é restrita a esses papéis; aqui fica o registro de quem fez).
// `papeisFinais` (opcional): funções confirmadas/ajustadas pela liderança no
// momento da aprovação. Se vier preenchido, substitui o que a pessoa pediu no
// cadastro — assim ninguém se autoconcede um papel (ex.: Pastor) sem revisão.
export function aprovarIntegrante(usuarioId: string, aprovadorId?: string, papeisFinais?: Papel[]) {
  const agora = new Date().toISOString()
  const alvo = getEstado().usuarios.find((u) => u.id === usuarioId)
  const nome = alvo?.nome ?? '?'
  const papeis = papeisFinais && papeisFinais.length > 0 ? papeisFinais : undefined
  setEstado((s) => ({
    ...s,
    usuarios: s.usuarios.map((u) =>
      u.id === usuarioId
        ? { ...u, statusAcesso: 'aprovado', aprovadoPorId: aprovadorId, aprovadoEm: agora, motivoRejeicao: undefined, ...(papeis ? { papeis } : {}) }
        : u,
    ),
  }))
  const ajustou = papeis && alvo && JSON.stringify([...papeis].sort()) !== JSON.stringify([...alvo.papeis].sort())
  registrarAuditoria('🔓 Aprovou acesso de integrante', {
    alvoTipo: 'usuario', alvoId: usuarioId, alvoNome: nome,
    detalhe: ajustou ? `Funções ajustadas para: ${papeis.map((p) => rotuloPapel(p)).join(', ')}` : undefined,
  })
}

export function rejeitarIntegrante(usuarioId: string, rejeitadorId: string | undefined, motivo: string) {
  const agora = new Date().toISOString()
  const nome = getEstado().usuarios.find((u) => u.id === usuarioId)?.nome ?? '?'
  setEstado((s) => ({
    ...s,
    usuarios: s.usuarios.map((u) =>
      u.id === usuarioId
        ? { ...u, statusAcesso: 'rejeitado', rejeitadoPorId: rejeitadorId, rejeitadoEm: agora, motivoRejeicao: motivo || undefined }
        : u,
    ),
  }))
  registrarAuditoria('🚫 Rejeitou acesso de integrante', {
    alvoTipo: 'usuario', alvoId: usuarioId, alvoNome: nome, detalhe: motivo || undefined,
  })
}

// ---- Fase 4 — Batismo (opcional) e Membro (o que conclui a jornada) ----
//
// Depois que o líder assume, há dois caminhos, decididos pela situação de
// batismo da pessoa:
//
//   Transferido → Batismo → Membro    (quem ainda NÃO é batizado)
//   Transferido → Membro              (quem JÁ chegou batizado)
//
// O batismo é etapa de quem precisa dele; quem já é batizado não repete. Em
// qualquer um dos caminhos, é virar MEMBRO que fecha a jornada.

// Encaminhou para o batismo (etapa só de quem ainda não é batizado).
export function encaminharParaBatismo(visitanteId: string) {
  const nome = getEstado().visitantes.find((v) => v.id === visitanteId)?.nome ?? '?'
  setEstado((s) => ({
    ...s,
    visitantes: s.visitantes.map((v) =>
      v.id === visitanteId && v.status === 'transferido'
        ? aplicarTransicao(v, 'batismo', 'Encaminhado(a) para o batismo')
        : v,
    ),
  }))
  registrarAuditoria('💧 Encaminhou para o batismo', { alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome })
}

// O batismo aconteceu: grava a data e marca que foi batizado AQUI. Não conclui
// a jornada — a pessoa segue na etapa até ser recebida como membro.
export function registrarBatismoRealizado(visitanteId: string, dataBatismo: string) {
  const nome = getEstado().visitantes.find((v) => v.id === visitanteId)?.nome ?? '?'
  setEstado((s) => ({
    ...s,
    visitantes: s.visitantes.map((v) =>
      v.id === visitanteId
        ? { ...v, situacaoBatismo: 'batizado_aqui', dataBatismo, atualizadoEm: new Date().toISOString() }
        : v,
    ),
  }))
  registrarAuditoria('💧 Registrou o batismo', {
    alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome, detalhe: `Batizado(a) em ${dataBatismo}`,
  })
}

// Prontidão para virar membro — os requisitos que a liderança do grupo confere
// antes de concluir a jornada (tempo de casa no grupo + presença). É só leitura:
// a frequência mínima é uma confirmação do líder (o sistema não registra
// presença encontro a encontro), enquanto o tempo é calculado da data de início.
export interface ProntidaoMembro {
  regraAtiva: boolean // há alguma exigência configurada?
  exigeTempo: boolean
  mesesMinimos: number
  temDataInicio: boolean
  meses: number | null // meses no grupo (null se a data de início não foi preenchida)
  tempoOk: boolean
  exigeFrequencia: boolean
  frequenciaMinima: number
}

export function prontidaoMembro(s: AppState, v: Visitante): ProntidaoMembro {
  const mesesMinimos = Math.max(0, s.config.mesesMinimosConexao ?? 0)
  const frequenciaMinima = Math.max(0, s.config.frequenciaMinimaConexao ?? 0)
  const exigeTempo = mesesMinimos > 0
  const exigeFrequencia = frequenciaMinima > 0
  const temDataInicio = !!v.dataInicioConexao
  const meses = temDataInicio ? mesesDesde(v.dataInicioConexao!) : null
  const tempoOk = !exigeTempo || (meses !== null && meses >= mesesMinimos)
  return {
    regraAtiva: exigeTempo || exigeFrequencia,
    exigeTempo, mesesMinimos, temDataInicio, meses, tempoOk,
    exigeFrequencia, frequenciaMinima,
  }
}

// Recebida como membro — conclui a jornada (status "integrado"). `obs` guarda no
// histórico o que a liderança confirmou na hora (frequência, exceção ao tempo).
export function marcarMembresia(visitanteId: string, dataMembresia: string, obs?: string) {
  const nome = getEstado().visitantes.find((v) => v.id === visitanteId)?.nome ?? '?'
  setEstado((s) => ({
    ...s,
    visitantes: s.visitantes.map((v) => {
      if (v.id !== visitanteId) return v
      // Aceita vir do batismo OU direto do líder (quem já chegou batizado).
      const novo = v.status === 'transferido' || v.status === 'batismo'
        ? aplicarTransicao(v, 'integrado', 'Recebido(a) como membro')
        : v
      return { ...novo, dataMembresia, atualizadoEm: new Date().toISOString() }
    }),
  }))
  registrarAuditoria('🎉 Recebido(a) como membro', {
    alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome,
    detalhe: `Membro desde ${dataMembresia}${obs ? ` · ${obs}` : ''}`,
  })
}

// Situação de batismo — atributo da pessoa, registrável em QUALQUER etapa e
// independente do funil. Não altera o status.
export function registrarBatismo(
  visitanteId: string,
  situacao: SituacaoBatismo | undefined,
  dataBatismo?: string,
) {
  const nome = getEstado().visitantes.find((v) => v.id === visitanteId)?.nome ?? '?'
  setEstado((s) => ({
    ...s,
    visitantes: s.visitantes.map((v) =>
      v.id === visitanteId
        ? {
          ...v,
          situacaoBatismo: situacao,
          // Sem batismo não há data de batismo a guardar.
          dataBatismo: situacao && situacao !== 'nao_batizado' ? dataBatismo || undefined : undefined,
          atualizadoEm: new Date().toISOString(),
        }
        : v,
    ),
  }))
  registrarAuditoria('💧 Atualizou a situação de batismo', {
    alvoTipo: 'visitante', alvoId: visitanteId, alvoNome: nome,
    detalhe: situacao ? SITUACAO_BATISMO_LABEL[situacao] : 'Não informada',
  })
}
