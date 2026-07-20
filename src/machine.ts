// Máquina de estados do visitante — seção 6 da especificação
import type { Status, Visitante } from './types'

// Transições permitidas (De → Para). 'recusou' pode ser atingido de qualquer status.
const TRANSICOES: Record<Status, Status[]> = {
  novo: ['em_contato', 'encerrado'],
  em_contato: ['aguardando_resposta', 'encaminhado_lider', 'em_espera', 'encerrado'],
  aguardando_resposta: ['em_contato', 'encaminhado_lider', 'em_espera', 'encerrado'],
  encaminhado_lider: ['visitou', 'em_contato', 'em_espera'],
  visitou: ['transferido', 'encaminhado_lider'],
  transferido: ['integrado'],
  integrado: [],
  em_espera: ['em_contato'],
  recusou: ['em_contato'], // porta segue aberta se a pessoa retornar (8.4)
  encerrado: [],
}

export function podeTransitar(de: Status, para: Status): boolean {
  if (para === 'recusou') return de !== 'recusou' // de qualquer status
  return TRANSICOES[de].includes(para)
}

export function transicoesDisponiveis(de: Status): Status[] {
  const alvos = [...TRANSICOES[de]]
  if (de !== 'recusou') alvos.push('recusou')
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
    transferenciaConfirmada: para === 'transferido' ? true : v.transferenciaConfirmada,
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
