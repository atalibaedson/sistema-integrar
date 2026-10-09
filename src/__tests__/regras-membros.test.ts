import { describe, expect, it } from 'vitest'
import {
  acharFicha, aplicarSolicitacao, chamadorPodeAprovar, contaTemFicha, desativarFichaDaConta, deveTerVinculo, ehAdminAprovado, existeAdminAprovado, ligarFichaAConta,
  formatarTelefone, lerSolicitacao, podeRevogarVinculo, podeSerPrimeiroAdmin, servidorNegaAcesso, statusDaConta, type ContaAuth, type Solicitacao,
} from '../regras-membros'
import type { AppState, ConfigIgreja, Usuario } from '../types'

const FOTO = 'https://x.supabase.co/storage/v1/object/public/avatares/'
const AGORA = new Date('2026-10-09T15:00:00Z')

function usuario(id: string, extra: Partial<Usuario> = {}): Usuario {
  return { id, nome: `Pessoa ${id}`, whatsapp: '', papeis: ['consolidador'], ativo: true, statusAcesso: 'sem_login', ...extra }
}
function estado(usuarios: Usuario[], extra: Partial<AppState> = {}): AppState {
  return {
    config: {} as unknown as ConfigIgreja, visitantes: [], interacoes: [], conexoes: [], templates: [], auditoria: [],
    usuarios, ...extra,
  }
}
const conta = (id: string, email?: string, emailConfirmado = true): ContaAuth => ({ id, email, emailConfirmado })
const admin = usuario('adm', { papeis: ['pastor'], statusAcesso: 'aprovado', authUserId: 'A1' })

describe('acharFicha', () => {
  it('acha pelo id da conta', () => {
    expect(acharFicha([admin], conta('A1'))?.id).toBe('adm')
  })
  it('acha pelo e-mail só se a ficha não tem conta e o e-mail está confirmado', () => {
    const f = usuario('f', { email: 'Ana@Exemplo.com' })
    expect(acharFicha([f], conta('X', 'ana@exemplo.com'))?.id).toBe('f')
    expect(acharFicha([f], conta('X', 'ana@exemplo.com', false))).toBeUndefined()
    // ficha que já pertence a outra conta não pode ser herdada por e-mail
    expect(acharFicha([{ ...f, authUserId: 'OUTRA' }], conta('X', 'ana@exemplo.com'))).toBeUndefined()
  })
  it('sem e-mail na conta não acha por e-mail', () => {
    expect(acharFicha([usuario('f', { email: '' })], conta('X', ''))).toBeUndefined()
  })
})

describe('statusDaConta', () => {
  it('mapeia a situação da ficha', () => {
    expect(statusDaConta(undefined)).toBe('sem_ficha')
    expect(statusDaConta(usuario('a', { statusAcesso: 'sem_login' }))).toBe('sem_ficha')
    expect(statusDaConta(usuario('a', { statusAcesso: 'pendente_aprovacao' }))).toBe('pendente_aprovacao')
    expect(statusDaConta(usuario('a', { statusAcesso: 'aprovado' }))).toBe('aprovado')
    expect(statusDaConta(usuario('a', { statusAcesso: 'rejeitado' }))).toBe('rejeitado')
    expect(statusDaConta(usuario('a', { statusAcesso: 'aprovado', ativo: false }))).toBe('inativo')
  })
})

describe('quem pode aprovar', () => {
  it('só pastor/gestão ativos e aprovados', () => {
    expect(ehAdminAprovado(admin)).toBe(true)
    expect(ehAdminAprovado({ ...admin, papeis: ['coordenacao'] })).toBe(true)
    expect(ehAdminAprovado({ ...admin, papeis: ['lider'] })).toBe(false)
    expect(ehAdminAprovado({ ...admin, statusAcesso: 'pendente_aprovacao' })).toBe(false)
    expect(ehAdminAprovado({ ...admin, ativo: false })).toBe(false)
    expect(ehAdminAprovado(undefined)).toBe(false)
  })
  it('chamadorPodeAprovar confere a conta, não o corpo da chamada', () => {
    expect(chamadorPodeAprovar([admin], conta('A1'))).toBe(true)
    expect(chamadorPodeAprovar([admin], conta('B2'))).toBe(false)
    expect(chamadorPodeAprovar([usuario('l', { papeis: ['lider'], statusAcesso: 'aprovado', authUserId: 'L1' })], conta('L1'))).toBe(false)
  })
  it('poder de aprovar nunca vem só de coincidência de e-mail', () => {
    const antigo = usuario('velho', { papeis: ['pastor'], statusAcesso: 'aprovado', email: 'pr@igreja.com' }) // sem authUserId
    expect(chamadorPodeAprovar([antigo], conta('QUALQUER', 'pr@igreja.com'))).toBe(false)
    // depois de ligar a ficha à conta no primeiro acesso, passa a valer
    const ligado = ligarFichaAConta(estado([antigo]), 'velho', 'P9').usuarios
    expect(chamadorPodeAprovar(ligado, conta('P9', 'pr@igreja.com'))).toBe(true)
    expect(chamadorPodeAprovar(ligado, conta('OUTRA', 'pr@igreja.com'))).toBe(false)
  })
  it('ligarFichaAConta não troca a conta de uma ficha que já tem dona', () => {
    const base = estado([admin])
    expect(ligarFichaAConta(base, 'adm', 'INTRUSO').usuarios[0].authUserId).toBe('A1')
  })
  it('primeiro administrador: só sem nenhum aprovado e com ficha pendente', () => {
    const pendente = usuario('p', { statusAcesso: 'pendente_aprovacao', authUserId: 'P1' })
    expect(podeSerPrimeiroAdmin([pendente], conta('P1'))).toBe(true)
    expect(podeSerPrimeiroAdmin([pendente, admin], conta('P1'))).toBe(false)
    expect(podeSerPrimeiroAdmin([pendente], conta('SEM-FICHA'))).toBe(false)
    expect(existeAdminAprovado([pendente])).toBe(false)
  })
  it('a ficha do alvo precisa existir', () => {
    expect(contaTemFicha([admin], 'A1')).toBe(true)
    expect(contaTemFicha([admin], 'ZZ')).toBe(false)
  })
})

describe('lerSolicitacao', () => {
  const meta = {
    origem: 'integrar', nome: 'Maria Souza', telefone: '(12) 99999-0000', nascimento: '1990-05-17', conexao: 'cx1',
    integrar: { igreja: 'ife-sjc', funcoes: ['consolidador', 'acolhedor'], loginPreferido: 'whatsapp', situacaoCivil: 'casado', consentimentoEm: '2026-10-09T12:00:00Z', fotoUrl: `${FOTO}a.jpg` },
  }
  const opc = { igrejaId: 'ife-sjc', prefixoFoto: FOTO, agora: AGORA, automatico: true }

  it('lê o padrão combinado entre os sistemas', () => {
    const r = lerSolicitacao(meta, undefined, opc)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.solicitacao).toMatchObject({
      nome: 'Maria Souza', whatsapp: '(12) 99999-0000', dataNascimento: '1990-05-17', conexaoParticipaId: 'cx1',
      papeis: ['consolidador', 'acolhedor'], loginPreferido: 'whatsapp', situacaoCivil: 'casado', fotoUrl: `${FOTO}a.jpg`,
    })
  })
  it("conexão 'nenhuma' não vira conexão", () => {
    const r = lerSolicitacao({ ...meta, conexao: 'nenhuma' }, undefined, opc)
    expect(r.ok && r.solicitacao.conexaoParticipaId).toBeUndefined()
  })
  it('só automático quando o cadastro foi feito neste Integrar e nesta igreja', () => {
    expect(lerSolicitacao({ ...meta, origem: 'checkife' }, undefined, opc)).toMatchObject({ ok: false, semDados: true })
    expect(lerSolicitacao(meta, undefined, { ...opc, igrejaId: 'minha-igreja' })).toMatchObject({ ok: false, semDados: true })
    expect(lerSolicitacao({}, undefined, opc)).toMatchObject({ ok: false, semDados: true })
  })
  it('a tela "Completar cadastro" (explícita) vale para conta de outro sistema', () => {
    const r = lerSolicitacao(
      { origem: 'checkife', nome: 'Pedro Lima', telefone: '12988887777' },
      { funcoes: ['lider'], conexao: 'cx2', consentimento: true },
      { ...opc, automatico: false },
    )
    expect(r.ok && r.solicitacao).toMatchObject({ nome: 'Pedro Lima', papeis: ['lider'], conexaoParticipaId: 'cx2', loginPreferido: 'email' })
  })
  it('exige consentimento, nome, telefone e ao menos uma função válida', () => {
    expect(lerSolicitacao({ ...meta, integrar: { ...meta.integrar, consentimentoEm: '' } }, undefined, opc)).toMatchObject({ ok: false })
    expect(lerSolicitacao({ ...meta, nome: 'A' }, undefined, opc)).toMatchObject({ ok: false })
    expect(lerSolicitacao({ ...meta, telefone: '123' }, undefined, opc)).toMatchObject({ ok: false })
    expect(lerSolicitacao({ ...meta, integrar: { ...meta.integrar, funcoes: ['presidente'] } }, undefined, opc)).toMatchObject({ ok: false })
  })
  it('rejeita data de nascimento inválida ou no futuro', () => {
    expect(lerSolicitacao({ ...meta, nascimento: '2999-01-01' }, undefined, opc)).toMatchObject({ ok: false })
    expect(lerSolicitacao({ ...meta, nascimento: '1990-02-31' }, undefined, opc)).toMatchObject({ ok: false })
    expect(lerSolicitacao({ ...meta, nascimento: '' }, undefined, opc)).toMatchObject({ ok: true })
  })
  it('ignora foto de fora do bucket do projeto e limpa caracteres de controle', () => {
    const r = lerSolicitacao({ ...meta, nome: 'Maria\u0000 Souza', integrar: { ...meta.integrar, fotoUrl: 'https://mal.com/x.jpg' } }, undefined, opc)
    expect(r.ok && r.solicitacao.fotoUrl).toBeUndefined()
    expect(r.ok && r.solicitacao.nome).toBe('Maria Souza')
  })
})

describe('aplicarSolicitacao', () => {
  const sol: Solicitacao = {
    nome: 'Maria Souza', whatsapp: '(12) 99999-0000', papeis: ['consolidador'], loginPreferido: 'email',
    conexaoParticipaId: 'cx1', consentimentoLgpdEm: AGORA.toISOString(),
  }
  const gerar = () => 'aud-1'
  const gestao = usuario('g', { nome: 'Zélia', papeis: ['coordenacao'], statusAcesso: 'aprovado', authUserId: 'G1' })

  it('cria a ficha PENDENTE, com id previsível e supervisor padrão', () => {
    const r = aplicarSolicitacao(estado([gestao]), conta('NOVA', 'Maria@Ex.com'), sol, gerar, AGORA)
    expect(r.resultado).toBe('criada')
    expect(r.usuarioId).toBe('u-NOVA')
    const u = r.estado.usuarios.find((x) => x.id === 'u-NOVA')!
    expect(u).toMatchObject({ statusAcesso: 'pendente_aprovacao', authUserId: 'NOVA', email: 'maria@ex.com', supervisorId: 'g', conexaoParticipaId: 'cx1', ativo: true })
    expect(r.estado.auditoria[0]).toMatchObject({ id: 'aud-1', acao: '📝 Integrante pediu acesso', alvoId: 'u-NOVA' })
  })
  it('nunca aprova: o status é sempre pendente, mesmo se o pedido pedir pastor', () => {
    const r = aplicarSolicitacao(estado([]), conta('N2', 'a@a.com'), { ...sol, papeis: ['pastor'] }, gerar, AGORA)
    expect(r.estado.usuarios[0].statusAcesso).toBe('pendente_aprovacao')
  })
  it('é idempotente: a conta que já tem ficha não muda nada', () => {
    const base = estado([admin])
    const r = aplicarSolicitacao(base, conta('A1', 'adm@x.com'), sol, gerar, AGORA)
    expect(r.resultado).toBe('ja_existe')
    expect(r.estado).toBe(base)
  })
  it('reivindica a ficha criada pela liderança (mesmo e-mail confirmado), somando as funções', () => {
    const feita = usuario('f1', { email: 'maria@ex.com', papeis: ['lider'], supervisorId: 'g' })
    const r = aplicarSolicitacao(estado([gestao, feita]), conta('NOVA', 'maria@ex.com'), sol, gerar, AGORA)
    expect(r.resultado).toBe('reivindicada')
    expect(r.estado.usuarios).toHaveLength(2)
    expect(r.estado.usuarios.find((u) => u.id === 'f1')).toMatchObject({
      authUserId: 'NOVA', statusAcesso: 'pendente_aprovacao', supervisorId: 'g',
    })
    expect(r.estado.usuarios.find((u) => u.id === 'f1')!.papeis.sort()).toEqual(['consolidador', 'lider'])
  })
  it('e-mail NÃO confirmado não reivindica a ficha de outra pessoa: cria uma nova', () => {
    const feita = usuario('f1', { email: 'maria@ex.com' })
    const r = aplicarSolicitacao(estado([feita]), conta('NOVA', 'maria@ex.com', false), sol, gerar, AGORA)
    expect(r.resultado).toBe('criada')
    expect(r.estado.usuarios).toHaveLength(2)
  })
  it('limpa a lápide de um cadastro antigo com o mesmo id', () => {
    const base = estado([], { excluidos: [{ tipo: 'usuario', id: 'u-NOVA', em: '2026-01-01T00:00:00Z' }, { tipo: 'visitante', id: 'v1', em: '2026-01-01T00:00:00Z' }] })
    const r = aplicarSolicitacao(base, conta('NOVA', 'a@a.com'), sol, gerar, AGORA)
    expect(r.estado.excluidos).toEqual([{ tipo: 'visitante', id: 'v1', em: '2026-01-01T00:00:00Z' }])
  })
})

describe('formatarTelefone', () => {
  it('formata só dígitos e respeita o que já vem formatado', () => {
    expect(formatarTelefone('12999990000')).toBe('(12) 99999-0000')
    expect(formatarTelefone('1233334444')).toBe('(12) 3333-4444')
    expect(formatarTelefone('5512999990000')).toBe('(12) 99999-0000')
    expect(formatarTelefone('(12) 99999-0000')).toBe('(12) 99999-0000')
    expect(formatarTelefone('+1 202 555 0100')).toBe('+1 202 555 0100')
  })
})

describe('retirar o vínculo de quem foi desativado', () => {
  const alvo = usuario('alvo', { statusAcesso: 'aprovado', authUserId: 'T1' })
  it('só Pastor/Gestão aprovado pode retirar', () => {
    expect(podeRevogarVinculo([admin, alvo], conta('A1'), 'T1')).toEqual({ ok: true })
    const lider = usuario('l', { papeis: ['lider'], statusAcesso: 'aprovado', authUserId: 'L1' })
    expect(podeRevogarVinculo([admin, alvo, lider], conta('L1'), 'T1').ok).toBe(false)
    expect(podeRevogarVinculo([admin, alvo], conta('DESCONHECIDA'), 'T1').ok).toBe(false)
  })
  it('ninguém retira o próprio acesso, e o alvo precisa ter cadastro na igreja', () => {
    expect(podeRevogarVinculo([admin, alvo], conta('A1'), 'A1').ok).toBe(false)
    expect(podeRevogarVinculo([admin, alvo], conta('A1'), 'SEM-CADASTRO').ok).toBe(false)
  })
  it('desativarFichaDaConta inativa só a ficha daquela conta', () => {
    const novo = desativarFichaDaConta(estado([admin, alvo]), 'T1').usuarios
    expect(novo.find((u) => u.id === 'alvo')?.ativo).toBe(false)
    expect(novo.find((u) => u.id === 'adm')?.ativo).toBe(true)
  })
  it('só ficha inativa perde o vínculo; pendente (1º administrador) e sem ficha (pastor de rede) mantêm', () => {
    expect(deveTerVinculo({ ...alvo, ativo: false })).toBe(false)
    expect(deveTerVinculo(alvo)).toBe(true)
    expect(deveTerVinculo(usuario('p', { statusAcesso: 'pendente_aprovacao' }))).toBe(true)
    expect(deveTerVinculo(undefined)).toBe(true)
  })
})

describe('servidorNegaAcesso (a ficha do aparelho não vale contra o servidor)', () => {
  it('nega conta sem acesso, pendente, inativa ou rejeitada que o servidor já respondeu', () => {
    for (const status of ['sem_ficha', 'pendente_aprovacao', 'inativo', 'rejeitado'] as const) {
      expect(servidorNegaAcesso({ carregado: true, status, vinculado: false })).toBe(true)
    }
  })
  it('libera aprovada, e quem tem vínculo (pastor de rede)', () => {
    expect(servidorNegaAcesso({ carregado: true, status: 'aprovado', vinculado: true })).toBe(false)
    expect(servidorNegaAcesso({ carregado: true, status: 'sem_ficha', vinculado: true })).toBe(false)
  })
  it('sem resposta do servidor (offline) não nega', () => {
    expect(servidorNegaAcesso({ carregado: false, vinculado: false })).toBe(false)
    expect(servidorNegaAcesso({ carregado: true, vinculado: false })).toBe(false)
  })
})
