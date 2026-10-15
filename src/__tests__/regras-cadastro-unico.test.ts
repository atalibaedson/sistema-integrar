import { describe, expect, it } from 'vitest'
import {
  avaliarLeitura, descreverConexao, divergencias, idadeEmAnos, lerSituacaoCU, linhaParticipacao, linkPerfilCheckife,
  mensagemDoErroCU, pendenciasCU, pessoaDasLinhas, type PessoaCU,
  fichaPodeLimpar, limparCopiasDaFicha, planoDeCopia, temCopiaNaFicha, type CadastroProprio,
} from '../regras-cadastro-unico'
import type { AppState, Conexao, Usuario } from '../types'
import { mesclarEstados } from '../mesclar'

const conexoes = [{ id: 'cx1', nome: 'Conexão Centro' }] as Conexao[]
const pessoa = (extra: Partial<PessoaCU> = {}): PessoaCU => ({ userId: 'U1', pessoaId: 'P1', ...extra })

describe('pessoaDasLinhas', () => {
  it('lê as colunas do Check-iFE e ignora valores fora do formato', () => {
    const p = pessoaDasLinhas(
      { id: 'P1', user_id: 'U1', nome: ' Ana ', telefone: '12999990000', data_nascimento: '1990-05-02T00:00:00', ativo: true },
      { estado_civil: 'uniao_estavel', conexao_situacao: 'participa', conexao_codigo: 'cx1', conexao_igreja: 'minha-igreja' },
    )!
    expect(p).toMatchObject({ nome: 'Ana', dataNascimento: '1990-05-02', estadoCivil: 'uniao_estavel', conexaoCodigo: 'cx1', conexaoIgreja: 'minha-igreja' })
    const ruim = pessoaDasLinhas({ id: 'P2', user_id: 'U2', data_nascimento: 'ontem' }, { estado_civil: 'noivo', conexao_situacao: 'talvez' })!
    expect(ruim.dataNascimento).toBeUndefined()
    expect(ruim.estadoCivil).toBeUndefined()
    expect(ruim.conexaoSituacao).toBeUndefined()
    expect(pessoaDasLinhas({ id: 'P3' })).toBeNull() // sem conta ligada não serve
  })
})

describe('idadeEmAnos', () => {
  it('conta anos completos', () => {
    const hoje = new Date(2026, 9, 14)
    expect(idadeEmAnos('1990-10-14', hoje)).toBe(36)
    expect(idadeEmAnos('1990-10-15', hoje)).toBe(35)
    expect(idadeEmAnos('xx', hoje)).toBeUndefined()
  })
})

describe('descreverConexao', () => {
  it('nome da conexão desta igreja; outra igreja; não participa; sem resposta', () => {
    expect(descreverConexao(pessoa({ conexaoSituacao: 'participa', conexaoCodigo: 'cx1', conexaoIgreja: 'minha-igreja' }), 'minha-igreja', conexoes).texto).toBe('Conexão Centro')
    expect(descreverConexao(pessoa({ conexaoSituacao: 'participa', conexaoCodigo: 'cx9', conexaoIgreja: 'ife-sjc' }), 'minha-igreja', conexoes).texto).toContain('outra igreja')
    expect(descreverConexao(pessoa({ conexaoSituacao: 'nao_participa' }), 'minha-igreja', conexoes, 'Célula')).toEqual({ texto: 'Ainda não participa de célula', tom: 'aviso' })
    expect(descreverConexao(undefined, 'minha-igreja', conexoes).tom).toBe('neutro')
    expect(descreverConexao(pessoa({ conexaoCodigo: 'sumiu' }), 'minha-igreja', conexoes).tom).toBe('aviso')
  })
})

describe('divergencias', () => {
  it('compara nome sem acento/caixa e telefone só pelos dígitos (com ou sem 55)', () => {
    const ficha = { nome: 'José da Silva', whatsapp: '(12) 99999-0000' }
    expect(divergencias(ficha, pessoa({ nome: 'jose da silva', telefone: '5512999990000' }))).toEqual([])
    expect(divergencias(ficha, pessoa({ nome: 'José da Silva Souza', telefone: '12988880000' }))).toEqual(['nome', 'whatsapp'])
    expect(divergencias(ficha, undefined)).toEqual([])
  })
})

describe('avaliarLeitura', () => {
  it('sem nenhuma outra pessoa vindo (de 2 ou mais pedidas) = falta o papel no Check-iFE', () => {
    expect(avaliarLeitura(['EU', 'A', 'B'], ['EU'], 'EU')).toBe('sem_permissao')
    expect(avaliarLeitura(['EU', 'A', 'B'], ['EU', 'A'], 'EU')).toBe('parcial')
    expect(avaliarLeitura(['EU', 'A'], ['EU'], 'EU')).toBe('parcial') // uma só: pode ser só falta de cadastro
    expect(avaliarLeitura(['A', 'B'], ['A', 'B'])).toBe('ok')
  })
})

describe('gravação da própria linha (fase B)', () => {
  it('traduz os erros do Check-iFE', () => {
    expect(mensagemDoErroCU({ code: '42501' })).toContain('Aceite o termo')
    expect(mensagemDoErroCU({ code: '22023' })).toContain('termo foi atualizado')
    expect(mensagemDoErroCU({ code: '23514' })).toContain('não é da igreja')
    expect(mensagemDoErroCU({ code: 'X', message: 'falhou' })).toBe('falhou')
    expect(mensagemDoErroCU(null)).toContain('Tente de novo')
  })
  it('participação respeita a regra do banco (participa = código + igreja; não participa = sem código)', () => {
    expect(linhaParticipacao('P1', 'cx1', 'ife-sjc')).toEqual({ pessoa_id: 'P1', conexao_situacao: 'participa', conexao_codigo: 'cx1', conexao_igreja: 'ife-sjc' })
    expect(linhaParticipacao('P1', 'nenhuma', 'ife-sjc')).toEqual({ pessoa_id: 'P1', conexao_situacao: 'nao_participa', conexao_codigo: null, conexao_igreja: null })
  })
  it('situação e pendências: só avisa (termo, conexão, campos da igreja)', () => {
    const s = lerSituacaoCU({ completo: false, falta: ['termo', 'conexao'], conexao_removida: true, campos_pendentes: ['sexo', 'extra:9'] })!
    expect(pendenciasCU(s)).toEqual([
      'aceitar o termo de privacidade', 'escolher de novo a sua conexão (a anterior foi removida)', 'completar 2 informações pedidas pela igreja',
    ])
    expect(pendenciasCU(lerSituacaoCU({ completo: true, falta: [], campos_pendentes: [] }))).toEqual([])
    expect(lerSituacaoCU('lixo')).toBeNull()
  })
  it('link do perfil no Check-iFE com volta ao Integrar', () => {
    const l = new URL(linkPerfilCheckife('https://integracaoifesjc.ifamiliaextraordinaria.com.br/#/meu-cadastro', 'conexao'))
    expect(l.host).toBe('checkife.ifamiliaextraordinaria.com.br')
    expect(l.searchParams.get('ir')).toBe('perfil')
    expect(l.searchParams.get('secao')).toBe('conexao')
    expect(l.searchParams.get('voltar')).toBe('https://integracaoifesjc.ifamiliaextraordinaria.com.br/#/meu-cadastro')
  })
})


describe('fase C: a ficha larga a cópia só depois de o cadastro único ter os dados', () => {
  const ficha = { id: 'u1', nome: 'Ana', whatsapp: '', papeis: ['consolidador'], ativo: true, statusAcesso: 'aprovado', authUserId: 'U1',
    dataNascimento: '1990-05-02', situacaoCivil: 'casado', bairro: 'Centro', conexaoParticipaId: 'cx1' } as Usuario
  const cuVazio: CadastroProprio = { userId: 'U1', pessoaId: 'P1' }

  it('copia só o que está vazio lá; sensíveis só com o termo', () => {
    const sem = planoDeCopia(ficha, cuVazio, { termoAceito: false, igrejaAtual: 'minha-igreja', conexaoExiste: true })
    expect(sem).toEqual({ pessoas: { data_nascimento: '1990-05-02' }, sensivel: null })
    const com = planoDeCopia(ficha, cuVazio, { termoAceito: true, igrejaAtual: 'minha-igreja', conexaoExiste: true })
    expect(com.sensivel).toEqual({ pessoa_id: 'P1', estado_civil: 'casado', bairro: 'Centro', conexao_situacao: 'participa', conexao_codigo: 'cx1', conexao_igreja: 'minha-igreja' })
    // o cadastro único vence: nada é sobrescrito
    const cheio: CadastroProprio = { ...cuVazio, dataNascimento: '1991-01-01', estadoCivil: 'solteiro', bairro: 'Vila', conexaoSituacao: 'nao_participa' }
    expect(planoDeCopia(ficha, cheio, { termoAceito: true, igrejaAtual: 'minha-igreja', conexaoExiste: true })).toEqual({ pessoas: null, sensivel: null })
  })
  it('só limpa quando cada dado tem lugar no cadastro único (conexão removida não segura)', () => {
    expect(fichaPodeLimpar(ficha, cuVazio, true)).toBe(false)
    const quase: CadastroProprio = { ...cuVazio, dataNascimento: '1990-05-02', estadoCivil: 'casado', bairro: 'Centro' }
    expect(fichaPodeLimpar(ficha, quase, true)).toBe(false)
    expect(fichaPodeLimpar(ficha, quase, false)).toBe(true)
  })
  it('ficha marcada perde a cópia, e a mesclagem com aparelho desatualizado não a traz de volta', () => {
    const limpa = limparCopiasDaFicha({ ...ficha, cadastroUnicoEm: '2026-10-14T00:00:00Z' })
    expect(limpa.dataNascimento).toBeUndefined()
    expect(limpa.conexaoParticipaId).toBeUndefined()
    expect(temCopiaNaFicha(limpa)).toBe(false)
    expect(temCopiaNaFicha(ficha)).toBe(true)
    const estado = (u: Usuario) => ({ config: {}, visitantes: [], interacoes: [], conexoes: [], usuarios: [u], templates: [], auditoria: [] }) as unknown as AppState
    // aparelho desatualizado (local, com a cópia) × nuvem já limpa
    const r = mesclarEstados(estado(ficha), estado(limpa))
    expect(r.usuarios[0].cadastroUnicoEm).toBe('2026-10-14T00:00:00Z')
    expect(r.usuarios[0].dataNascimento).toBeUndefined()
    expect(r.usuarios[0].situacaoCivil).toBeUndefined()
  })
})
