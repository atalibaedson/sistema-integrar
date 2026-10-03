// Modo demonstração (npm run dev:demo): o app roda SEM nuvem, com uma sessão e
// uma igreja fictícias — para ver e conferir as telas internas sem tocar na
// produção (o `npm run dev` comum grava no Supabase real).
//
// Só existe no servidor de desenvolvimento: no build, import.meta.env.DEV é
// `false`, o MODO_DEMO vira `false` e todo este módulo sai do pacote.
// Todos os nomes abaixo são INVENTADOS — nunca use pessoas reais aqui.
import type { AppState, Conexao, Interacao, Status, Usuario, Visitante } from './types'

export const MODO_DEMO: boolean = import.meta.env.DEV && import.meta.env.MODE === 'demo'

// Sessão fingida do modo demo (casa com o usuário "Marcos Andrade" abaixo)
export const SESSAO_DEMO = { userId: 'demo-auth', email: 'demo@exemplo.com' }

function diasAtras(d: number, hora = 10): string {
  const x = new Date()
  x.setDate(x.getDate() - d)
  x.setHours(hora, 0, 0, 0)
  return x.toISOString()
}

const usuarios: Usuario[] = [
  { id: 'u-marcos', nome: 'Marcos Andrade', whatsapp: '(00) 90000-0001', email: SESSAO_DEMO.email, papeis: ['coordenacao', 'pastor'], ativo: true, statusAcesso: 'aprovado', authUserId: SESSAO_DEMO.userId },
  { id: 'u-ana', nome: 'Ana Paula Rocha', whatsapp: '(00) 90000-0002', papeis: ['consolidador'], ativo: true, statusAcesso: 'aprovado' },
  { id: 'u-joao', nome: 'João Vitor Mendes', whatsapp: '(00) 90000-0003', papeis: ['consolidador'], ativo: true, statusAcesso: 'aprovado' },
  { id: 'u-carla', nome: 'Carla e Rodrigo Teles', whatsapp: '(00) 90000-0004', papeis: ['lider'], ativo: true, statusAcesso: 'aprovado', conexaoId: 'cx-centro' },
  { id: 'u-felipe', nome: 'Felipe Costa', whatsapp: '(00) 90000-0005', papeis: ['lider'], ativo: true, statusAcesso: 'aprovado', conexaoId: 'cx-norte' },
  { id: 'u-sofia', nome: 'Sofia Martins', whatsapp: '(00) 90000-0006', email: 'sofia@exemplo.com', papeis: ['consolidador'], ativo: true, statusAcesso: 'pendente_aprovacao' },
]

const conexoes: Conexao[] = [
  { id: 'cx-centro', nome: 'Conexão Família Centro', bairro: 'Centro', cidade: '', perfil: 'Casais', diaHorario: 'Quinta, 20h', liderId: 'u-carla' },
  { id: 'cx-norte', nome: 'Conexão Jovens Norte', bairro: 'Zona Norte', cidade: '', perfil: 'Jovens / Solteiros', diaHorario: 'Sexta, 20h', liderId: 'u-felipe' },
  { id: 'cx-vida', nome: 'Conexão Vida Nova', bairro: 'Jardim', cidade: '', perfil: 'Misto', diaHorario: 'Terça, 20h' },
]

function visitante(id: string, nome: string, status: Status, dias: number, extra: Partial<Visitante> = {}): Visitante {
  const quando = diasAtras(dias, 19)
  return {
    id, nome, whatsapp: `(00) 98000-${id.slice(-4).padStart(4, '0')}`,
    dataCadastro: quando, origem: dias % 2 ? 'qr_code' : 'culto',
    cultoPrimeiraVisita: dias % 3 ? 'Domingo — noite' : 'Domingo — manhã',
    status, flagMenorIdade: false, flagOutraCidade: false, flagCuidado: false,
    transferenciaConfirmada: false, consentimentoLgpd: true, consentimentoLgpdData: quando,
    historicoStatus: [{ de: null, para: status, data: quando, motivo: 'Cadastro (demonstração)', automatica: false }],
    criadoEm: quando, atualizadoEm: quando,
    ...extra,
  }
}

const visitantes: Visitante[] = [
  visitante('v-0001', 'Camila Duarte', 'novo', 1),
  visitante('v-0002', 'Bruno Albuquerque', 'novo', 2),
  visitante('v-0003', 'Rafael e Lívia Lima', 'em_contato', 3, { responsavelId: 'u-ana', situacaoCivil: 'casado' }),
  visitante('v-0004', 'Beatriz Nunes', 'em_contato', 4, { responsavelId: 'u-joao' }),
  visitante('v-0005', 'Juliana Ramos', 'aguardando_resposta', 5, { responsavelId: 'u-ana', flagCuidado: true, pedidoOracao: 'Pela família (demonstração).' }),
  visitante('v-0006', 'Lucas Ferreira', 'encaminhado_lider', 9, { responsavelId: 'u-joao', conexaoId: 'cx-norte', liderConexaoId: 'u-felipe' }),
  visitante('v-0007', 'Patrícia Gomes', 'encaminhado_lider', 11, { responsavelId: 'u-ana', conexaoId: 'cx-centro', liderConexaoId: 'u-carla' }),
  visitante('v-0008', 'Daniel Moraes', 'visitou', 16, { responsavelId: 'u-joao', conexaoId: 'cx-centro', liderConexaoId: 'u-carla' }),
  visitante('v-0009', 'Mariana Lopes', 'transferido', 30, { responsavelId: 'u-ana', conexaoId: 'cx-norte', liderConexaoId: 'u-felipe', transferenciaConfirmada: true }),
  visitante('v-0010', 'Gustavo Pires', 'batismo', 45, { responsavelId: 'u-joao', conexaoId: 'cx-centro', liderConexaoId: 'u-carla', transferenciaConfirmada: true }),
  visitante('v-0011', 'Helena Castro', 'integrado', 90, { responsavelId: 'u-ana', conexaoId: 'cx-vida', transferenciaConfirmada: true }),
  visitante('v-0012', 'Pedro Henrique Silva', 'em_espera', 20, { responsavelId: 'u-joao' }),
]

const interacoes: Interacao[] = [
  { id: 'i-1', visitanteId: 'v-0003', autorId: 'u-ana', autorPapel: 'consolidador', data: diasAtras(2, 11), canal: 'whatsapp', tipo: 'aproximacao', respondeu: true, grauAbertura: 'alto', retornoResumo: 'Gostaram muito do culto.', proximosPassos: 'Convidar para a Conexão de casais.', encaminhamentos: '', flagCuidado: false },
  { id: 'i-2', visitanteId: 'v-0005', autorId: 'u-ana', autorPapel: 'consolidador', data: diasAtras(4, 15), canal: 'whatsapp', tipo: 'aproximacao', respondeu: true, grauAbertura: 'medio', retornoResumo: 'Passa por um momento difícil.', proximosPassos: 'Pastor ligar esta semana.', encaminhamentos: 'Cuidado pastoral', flagCuidado: true },
]

// Monta o estado da igreja fictícia a partir do estado inicial do app
// (config padrão, mensagens etc.), trocando só os dados.
export function dadosDemo(base: AppState): AppState {
  return {
    ...base,
    config: { ...base.config, nomeIgreja: 'Igreja Exemplo', subtitulo: 'Integração de visitantes', cidade: 'Cidade Exemplo', estado: 'SP' },
    usuarios, conexoes, visitantes, interacoes,
  }
}
