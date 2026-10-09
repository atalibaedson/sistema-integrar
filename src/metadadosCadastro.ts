// Metadados da conta no signUp (`options.data` → `user_metadata`) — o padrão
// combinado entre os três sistemas (Integrar, Louvor e Check-iFE):
//   { origem, nome, telefone, nascimento: 'AAAA-MM-DD', conexao: '<id da conexão>' | 'nenhuma' }
// O que só o Integrar usa vai dentro de `integrar` (os outros sistemas ignoram).
// São só um PEDIDO: o servidor valida tudo e quem libera o acesso é a liderança.
import type { Papel, SituacaoCivil } from './types'

export interface EntradaMetadados {
  nome: string
  whatsapp: string
  dataNascimento?: string
  situacaoCivil?: SituacaoCivil
  conexao: string // id da conexão, ou 'nenhuma'
  papeis: Papel[]
  loginPreferido: 'email' | 'whatsapp'
  consentimentoLgpd: boolean
  igrejaId: string
  fotoUrl?: string
  agora?: Date
}

export function montarMetadadosCadastro(i: EntradaMetadados): Record<string, unknown> {
  return {
    origem: 'integrar',
    nome: i.nome.trim(),
    telefone: i.whatsapp.replace(/\D/g, ''),
    nascimento: i.dataNascimento || '',
    conexao: i.conexao || 'nenhuma',
    integrar: {
      igreja: i.igrejaId,
      funcoes: i.papeis,
      loginPreferido: i.loginPreferido,
      situacaoCivil: i.situacaoCivil ?? '',
      fotoUrl: i.fotoUrl ?? '',
      consentimentoEm: i.consentimentoLgpd ? (i.agora ?? new Date()).toISOString() : '',
    },
  }
}
