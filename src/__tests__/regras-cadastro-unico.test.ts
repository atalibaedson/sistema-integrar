import { describe, expect, it } from 'vitest'
import { avaliarLeitura, descreverConexao, divergencias, idadeEmAnos, pessoaDasLinhas, type PessoaCU } from '../regras-cadastro-unico'
import type { Conexao } from '../types'

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
