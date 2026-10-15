// Metadados da conta no signUp (`options.data` → `user_metadata`) — o padrão
// combinado entre os três sistemas (Integrar, Louvor e Check-iFE):
//   { origem, nome, telefone, nascimento: 'AAAA-MM-DD', conexao: '<id da conexão>' | 'nenhuma',
//     conexao_igreja, estado_civil, consentimento_versao }
// `estado_civil` usa o vocabulário do Check-iFE (o mesmo do Integrar); `consentimento_versao` só vai
// se a pessoa marcou o aceite do termo do CADASTRO ÚNICO (versão lida de checkife_termo()).
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
  termoCadastroUnico?: string // versão do termo do cadastro único que a pessoa aceitou na tela
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
    ...(i.conexao && i.conexao !== 'nenhuma' ? { conexao_igreja: i.igrejaId } : {}),
    ...(i.situacaoCivil ? { estado_civil: i.situacaoCivil } : {}),
    ...(i.termoCadastroUnico ? { consentimento_versao: i.termoCadastroUnico } : {}),
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
