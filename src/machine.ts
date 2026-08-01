// Máquina de estados do visitante — seção 6 da especificação
import type { Status, Visitante } from './types'

// Transições permitidas (De → Para). 'recusou' pode ser atingido de qualquer status.
const TRANSICOES: Record<Status, Status[]> = {
  novo: ['em_contato', 'encerrado'],
  em_contato: ['aguardando_resposta', 'encaminhado_lider', 'em_espera', 'encerrado'],
  aguardando_resposta: ['em_contato', 'encaminhado_lider', 'em_espera', 'encerrado'],
  encaminhado_lider: ['visitou', 'em_contato', 'em_espera'],
  // 'em_espera': visitou mas ainda não engajou (líder sinaliza "aguardando")
  visitou: ['transferido', 'encaminhado_lider', 'em_espera'],
  // 'em_contato': parou de frequentar depois de transferido — o time retoma o contato
  // 'batismo': etapa OPCIONAL, só para quem ainda não é batizado. Quem já chegou
  // batizado vai de 'transferido' direto para 'integrado' (membro) — é por isso
  // que os dois destinos existem aqui.
  transferido: ['batismo', 'integrado', 'em_contato'],
  // A caminho do batismo: depois dele a pessoa é recebida como membro. Volta ao
  // líder se desistir, ou ao time se parar de frequentar.
  batismo: ['integrado', 'transferido', 'em_contato'],
  integrado: [],
  em_espera: ['em_contato'],
  recusou: ['em_contato'], // porta segue aberta se a pessoa retornar (8.4)
  encerrado: [],
}

// "Recusou" é a porta de saída de quem está SENDO acompanhado (8.4) — não se
// aplica a quem já chegou ao fim do caminho. Sem isso, arrastar um cartão errado
// no quadro da Jornada tira um membro da contagem sem ninguém perceber; e um
// cadastro encerrado (inválido/duplicado) "recusar contato" não quer dizer nada.
const FIM_DE_LINHA: Status[] = ['integrado', 'recusou', 'encerrado']

export function podeTransitar(de: Status, para: Status): boolean {
  if (para === 'recusou') return !FIM_DE_LINHA.includes(de)
  return TRANSICOES[de].includes(para)
}

export function transicoesDisponiveis(de: Status): Status[] {
  const alvos = [...TRANSICOES[de]]
  if (!FIM_DE_LINHA.includes(de)) alvos.push('recusou')
  return alvos
}

export function aplicarTransicao(
  v: Visitante,
  para: Status,
  motivo: string,
  automatica = false,
): Visitante {
  if (!podeTransitar(v.status, para)) {
    throw new Error(`Transição inválida: ${v.status} → ${para}`)
  }
  const agora = new Date().toISOString()
  return {
    ...v,
    status: para,
    // Confirmada só enquanto está "transferido"; ao integrar, preserva; ao voltar
    // para etapas do time (ex.: "parou de frequentar"), zera para não deixar rastro.
    transferenciaConfirmada:
      para === 'transferido' ? true
        : para === 'batismo' || para === 'integrado' ? v.transferenciaConfirmada
          : false,
    historicoStatus: [
      ...v.historicoStatus,
      { de: v.status, para, data: agora, motivo, automatica },
    ],
    atualizadoEm: agora,
  }
}

// Dias sem retorno: base para a automação de 2 semanas (regra 6)
export function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// Meses completos desde uma data (yyyy-mm-dd ou ISO) até hoje. Usa contagem de
// calendário — "3 meses" é do dia 10/jan ao dia 10/abr, não 90 dias corridos.
// Data só-dia é lida como meia-noite local (senão o fuso do Brasil joga para o
// dia anterior). Nunca negativo: data futura conta como 0.
export function mesesDesde(iso: string): number {
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  const inicio = soData ? new Date(`${iso}T00:00:00`) : new Date(iso)
  const agora = new Date()
  let meses = (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth())
  if (agora.getDate() < inicio.getDate()) meses -= 1
  return Math.max(0, meses)
}
