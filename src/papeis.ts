// Descrição curta de cada função da equipe — usada onde a pessoa (ou a
// liderança) escolhe funções: cadastro de integrante e tela Equipe.
import type { Papel } from './types'

export const PAPEL_DESC: Record<Papel, string> = {
  coordenacao: 'Distribui os visitantes e acompanha o funil da consolidação.',
  consolidador: 'Faz os contatos pós-culto e registra o acompanhamento.',
  lider: 'Recebe o visitante na Conexão e acompanha até a integração.',
  pastor: 'Cobertura pastoral e casos de cuidado/crise.',
  acolhedor: 'Cadastra os visitantes no dia do culto — acesso só ao formulário de cadastro.',
}
