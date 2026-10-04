import { describe, expect, it } from 'vitest'
import { alertasConfig, alertasDoUsuario, calcularAlertas, dispensaAtiva, idDispensa, partesBR, textoPush, textoPushImediato, type Alerta } from '../alertas'
import { mesclarEstados } from '../mesclar'
import type { AppState, ConfigIgreja, Dispensa, Interacao, Status, Usuario, Visitante } from '../types'

// Segunda-feira, meio-dia em Brasília
const AGORA = new Date('2026-10-05T12:00:00-03:00')
const atras = (dias: number): string => new Date(AGORA.getTime() - dias * 86_400_000).toISOString()

function usuario(id: string, papeis: Usuario['papeis'], extra: Partial<Usuario> = {}): Usuario {
  return { id, nome: `Pessoa ${id}`, whatsapp: '', papeis, ativo: true, statusAcesso: 'aprovado', ...extra }
}

function visitante(id: string, status: Status, dias: number, extra: Partial<Visitante> = {}): Visitante {
  const quando = atras(dias)
  return {
    id, nome: `Visitante ${id}`, whatsapp: '', dataCadastro: quando, origem: 'culto', status,
    flagMenorIdade: false, flagOutraCidade: false, flagCuidado: false, transferenciaConfirmada: false,
    consentimentoLgpd: true, historicoStatus: [{ de: null, para: status, data: quando, motivo: '', automatica: false }],
    criadoEm: quando, atualizadoEm: quando, ...extra,
  }
}

function contato(visitanteId: string, dias: number, extra: Partial<Interacao> = {}): Interacao {
  return {
    id: `i-${visitanteId}-${dias}`, visitanteId, autorId: 'ana', autorPapel: 'consolidador', data: atras(dias),
    canal: 'whatsapp', tipo: 'aproximacao', respondeu: false, grauAbertura: 'sem_resposta',
    retornoResumo: '', proximosPassos: '', encaminhamentos: '', flagCuidado: false, ...extra,
  }
}

function estado(parcial: Partial<AppState> = {}): AppState {
  return {
    config: { prazoEsperaDias: 14, cultosDef: [] } as unknown as ConfigIgreja,
    visitantes: [], interacoes: [], conexoes: [], templates: [], auditoria: [],
    usuarios: [
      usuario('gestor', ['coordenacao']),
      usuario('pastor', ['pastor']),
      usuario('chefe', ['consolidador']),
      usuario('ana', ['consolidador'], { supervisorId: 'chefe' }),
      usuario('lider', ['lider'], { supervisorId: 'chefe' }),
    ],
    ...parcial,
  }
}

// 'equipe_parada' depende do conjunto todo (sem contato recente em lugar nenhum) e
// entraria em quase todo cenário mínimo — fica de fora, exceto nos testes dela.
const tipos = (as: Alerta[]) => as.map((a) => a.tipo).filter((t) => t !== 'equipe_parada')
const de = (as: Alerta[], tipo: string) => as.find((a) => a.tipo === tipo)

describe('alertasConfig', () => {
  it('usa o padrão e ignora valores inválidos', () => {
    expect(alertasConfig().primeiroContatoDias).toBe(2)
    const c = alertasConfig({ alertas: { primeiroContatoDias: -3, intervaloContatoDias: NaN, cuidadoDias: 2, ativo: false } })
    expect(c.primeiroContatoDias).toBe(2)
    expect(c.intervaloContatoDias).toBe(4)
    expect(c.cuidadoDias).toBe(2)
    expect(c.ativo).toBe(false)
  })
  it('desligado não gera aviso nenhum', () => {
    const s = estado({ visitantes: [visitante('a', 'novo', 5)], config: { prazoEsperaDias: 14, cultosDef: [], alertas: { ativo: false } } as unknown as ConfigIgreja })
    expect(calcularAlertas(s, AGORA)).toEqual([])
  })
})

describe('visitante novo', () => {
  it('sem responsável há 1+ dia vai para a Gestão', () => {
    const s = estado({ visitantes: [visitante('a', 'novo', 1)] })
    const a = de(calcularAlertas(s, AGORA), 'sem_responsavel')!
    expect(a.destinatarios).toEqual(['gestor'])
    expect(a.chave).toBe('sem_responsavel:a')
  })
  it('cadastrado hoje ainda não é aviso', () => {
    expect(tipos(calcularAlertas(estado({ visitantes: [visitante('a', 'novo', 0)] }), AGORA))).toEqual([])
  })
  it('responsável fora da equipe (inativo) conta como sem responsável', () => {
    const s = estado({ visitantes: [visitante('a', 'novo', 2, { responsavelId: 'fantasma' })] })
    expect(tipos(calcularAlertas(s, AGORA))).toEqual(['sem_responsavel'])
  })
  it('atribuído e recente: aviso imediato para o responsável', () => {
    const s = estado({ visitantes: [visitante('a', 'novo', 0, { responsavelId: 'ana', desejaContato: true, melhorHorarioContato: 'noite' })] })
    const a = de(calcularAlertas(s, AGORA), 'novo_para_voce')!
    expect(a.destinatarios).toEqual(['ana'])
    expect(a.imediato).toBe(true)
    expect(a.detalhe).toContain('noite')
  })
})

describe('1º contato atrasado e escalonamento', () => {
  const com = (dias: number) => estado({ visitantes: [visitante('a', 'novo', dias, { responsavelId: 'ana' })] })
  it('nível 0: só o responsável', () => {
    const a = de(calcularAlertas(com(2), AGORA), 'primeiro_contato')!
    expect([a.nivel, a.destinatarios]).toEqual([0, ['ana']])
  })
  it('nível 1 (após 2 dias de atraso): o supervisor também', () => {
    const a = de(calcularAlertas(com(4), AGORA), 'primeiro_contato')!
    expect(a.nivel).toBe(1)
    expect(new Set(a.destinatarios)).toEqual(new Set(['ana', 'chefe']))
  })
  it('nível 2 (após 5 dias de atraso): chega à Gestão', () => {
    const a = de(calcularAlertas(com(7), AGORA), 'primeiro_contato')!
    expect(a.nivel).toBe(2)
    expect(new Set(a.destinatarios)).toEqual(new Set(['ana', 'chefe', 'gestor']))
  })
  it('o prazo vem da configuração da igreja', () => {
    const s = com(2)
    s.config = { ...s.config, alertas: { primeiroContatoDias: 5 } }
    expect(tipos(calcularAlertas(s, AGORA))).toEqual(['novo_para_voce'])
  })
})

describe('acompanhamento em andamento', () => {
  it('contato vencido: passou o intervalo desde o último registro', () => {
    const s = estado({ visitantes: [visitante('a', 'em_contato', 8, { responsavelId: 'ana' })], interacoes: [contato('a', 4)] })
    expect(tipos(calcularAlertas(s, AGORA))).toEqual(['contato_vencido'])
    const ok = estado({ visitantes: [visitante('a', 'em_contato', 8, { responsavelId: 'ana' })], interacoes: [contato('a', 3)] })
    expect(tipos(calcularAlertas(ok, AGORA))).toEqual([])
  })
  it('perto de "Em espera" substitui o aviso de contato vencido', () => {
    const s = estado({
      visitantes: [visitante('a', 'aguardando_resposta', 20, { responsavelId: 'ana' })],
      interacoes: [contato('a', 12)], // silêncio de 20 dias desde o cadastro → 14 dias de prazo já passaria; usa resposta
    })
    // sem resposta registrada, o silêncio conta desde o cadastro (20d ≥ 14): já deveria estar em espera → nenhum "quase"
    expect(tipos(calcularAlertas(s, AGORA))).toEqual(['contato_vencido'])
    const quase = estado({
      visitantes: [visitante('b', 'em_contato', 12, { responsavelId: 'ana' })],
      interacoes: [contato('b', 5)],
    })
    const r = calcularAlertas(quase, AGORA)
    expect(tipos(r)).toEqual(['quase_em_espera'])
    expect(de(r, 'quase_em_espera')!.titulo).toContain('2 dias')
  })
  it('resposta registrada por outra pessoa avisa o responsável', () => {
    const s = estado({
      visitantes: [visitante('a', 'em_contato', 6, { responsavelId: 'ana' })],
      interacoes: [contato('a', 1, { autorId: 'lider', autorPapel: 'lider', respondeu: true })],
    })
    const a = de(calcularAlertas(s, AGORA), 'resposta_recebida')!
    expect(a.destinatarios).toEqual(['ana'])
    // a própria pessoa registrando a resposta não se avisa
    const eu = estado({
      visitantes: [visitante('a', 'em_contato', 6, { responsavelId: 'ana' })],
      interacoes: [contato('a', 1, { respondeu: true })],
    })
    expect(tipos(calcularAlertas(eu, AGORA))).not.toContain('resposta_recebida')
  })
  it('líder que não fez contato: aviso ao líder, e o responsável entra ao subir', () => {
    const base = (dias: number) => estado({
      conexoes: [{ id: 'cx', nome: 'Grupo', liderId: 'lider', perfil: '', diaHorario: '' }],
      visitantes: [visitante('a', 'encaminhado_lider', dias, { responsavelId: 'ana', conexaoId: 'cx' })],
    })
    const a0 = de(calcularAlertas(base(3), AGORA), 'lider_sem_contato')!
    expect(a0.destinatarios).toEqual(['lider'])
    const a1 = de(calcularAlertas(base(6), AGORA), 'lider_sem_contato')!
    expect(new Set(a1.destinatarios)).toEqual(new Set(['lider', 'chefe', 'ana']))
    // depois que o líder registra contato, o aviso some
    const feito = base(6)
    feito.interacoes = [contato('a', 1, { autorId: 'lider', autorPapel: 'lider' })]
    expect(tipos(calcularAlertas(feito, AGORA))).not.toContain('lider_sem_contato')
  })
  it('sem líder definido avisa o responsável', () => {
    const s = estado({ visitantes: [visitante('a', 'encaminhado_lider', 4, { responsavelId: 'ana' })] })
    const a = de(calcularAlertas(s, AGORA), 'lider_sem_contato')!
    expect(a.titulo).toContain('sem líder')
    expect(a.destinatarios).toContain('ana')
  })
})

describe('cuidado / crise', () => {
  it('só pastores e o responsável; aviso imediato; substitui os avisos de rotina', () => {
    const s = estado({ visitantes: [visitante('a', 'aguardando_resposta', 9, { responsavelId: 'ana', flagCuidado: true })] })
    const r = calcularAlertas(s, AGORA)
    expect(tipos(r)).toEqual(['cuidado'])
    const c = de(r, 'cuidado')!
    expect(new Set(c.destinatarios)).toEqual(new Set(['pastor', 'ana']))
    expect(c.imediato).toBe(true)
    expect(c.destinatarios).not.toContain('gestor') // coordenação sem ser pastor não vê cuidado
  })
  it('com registro recente, não avisa', () => {
    const s = estado({
      visitantes: [visitante('a', 'em_contato', 3, { responsavelId: 'ana', flagCuidado: true })],
      interacoes: [contato('a', 0)],
    })
    expect(tipos(calcularAlertas(s, AGORA))).toEqual([])
  })
})

describe('não abastecimento', () => {
  it('equipe parada: ninguém registrou contato há 5+ dias', () => {
    const s = estado({
      visitantes: [visitante('a', 'em_contato', 9, { responsavelId: 'ana' })],
      interacoes: [contato('a', 6)],
    })
    const a = de(calcularAlertas(s, AGORA), 'equipe_parada')!
    expect(new Set(a.destinatarios)).toEqual(new Set(['gestor', 'pastor']))
    expect(a.semanal).toBe(true)
    const ok = estado({ visitantes: s.visitantes, interacoes: [contato('a', 4)] })
    expect(de(calcularAlertas(ok, AGORA), 'equipe_parada')).toBeUndefined()
  })
  it('pessoa com 3+ fichas paradas avisa a Gestão e o supervisor', () => {
    const vs = ['a', 'b', 'c'].map((id) => visitante(id, 'em_contato', 8, { responsavelId: 'ana' }))
    const s = estado({ visitantes: vs, interacoes: vs.map((v) => contato(v.id, 4)) })
    const a = de(calcularAlertas(s, AGORA), 'acolhedor_parado')
    // fichas com contato há 4 dias NÃO são paradas (7+)
    expect(a).toBeUndefined()
    const paradas = estado({ visitantes: vs.map((v) => ({ ...v, atualizadoEm: atras(8) })), interacoes: vs.map((v) => contato(v.id, 8)) })
    const b = de(calcularAlertas(paradas, AGORA), 'acolhedor_parado')!
    expect(new Set(b.destinatarios)).toEqual(new Set(['gestor', 'pastor', 'chefe']))
    expect(b.titulo).toContain('3 fichas')
  })
  it('culto que passou sem nenhum cadastro; com cadastro não avisa', () => {
    const cfg = { prazoEsperaDias: 14, cultosDef: [{ nome: 'Domingo — manhã', diaSemana: 0, ocorrencias: ['2026-09-27', '2026-10-04', '2026-10-11'] }] } as unknown as ConfigIgreja
    const sem = estado({ config: cfg })
    const a = calcularAlertas(sem, AGORA).filter((x) => x.tipo === 'culto_sem_cadastro')
    expect(a.map((x) => x.chave)).toEqual(['culto_sem_cadastro:Domingo — manhã:2026-10-04']) // 27/09 é antigo, 11/10 é futuro
    const com = estado({
      config: cfg,
      visitantes: [visitante('a', 'novo', 1, { responsavelId: 'ana', cultoPrimeiraVisita: 'Domingo — manhã', dataPrimeiraVisita: '2026-10-04' })],
    })
    expect(tipos(calcularAlertas(com, AGORA))).not.toContain('culto_sem_cadastro')
  })
})

describe('por pessoa, adiados e push', () => {
  const s0 = () => estado({ visitantes: [visitante('a', 'novo', 4, { responsavelId: 'ana' })] })
  it('cada um só vê o que lhe cabe', () => {
    expect(alertasDoUsuario(s0(), 'ana', AGORA).ativos).toHaveLength(1)
    expect(alertasDoUsuario(s0(), 'pastor', AGORA).ativos).toHaveLength(0)
    expect(alertasDoUsuario(s0(), undefined, AGORA).ativos).toHaveLength(0)
  })
  it('adiado some até a data e volta depois', () => {
    const s = s0()
    s.dispensas = [{ id: idDispensa('ana', 'primeiro_contato:a'), usuarioId: 'ana', chave: 'primeiro_contato:a', ate: atras(-1), em: AGORA.toISOString() }]
    const r = alertasDoUsuario(s, 'ana', AGORA)
    expect(r.ativos).toHaveLength(0)
    expect(r.adiados).toHaveLength(1)
    // para outra pessoa que recebe o mesmo aviso, continua ativo
    expect(alertasDoUsuario(s, 'chefe', AGORA).ativos).toHaveLength(1)
    expect(alertasDoUsuario(s, 'ana', new Date(AGORA.getTime() + 2 * 86_400_000)).ativos).toHaveLength(1)
    expect(dispensaAtiva(s.dispensas, 'ana', 'primeiro_contato:a', AGORA)).toBeDefined()
  })
  it('o texto do push só tem contagens — nunca nomes', () => {
    const s = estado({
      visitantes: [visitante('a', 'novo', 4, { responsavelId: 'ana' }), visitante('b', 'em_contato', 8, { responsavelId: 'ana' })],
      interacoes: [contato('b', 5)],
    })
    const { ativos } = alertasDoUsuario(s, 'ana', AGORA)
    const t = textoPush(ativos)
    expect(t.titulo).toBe('Você tem 2 avisos')
    expect(t.corpo).not.toMatch(/Visitante/)
    const cuidado = textoPushImediato([{ tipo: 'cuidado' } as Alerta])
    expect(cuidado.corpo).not.toMatch(/Visitante/)
  })
  it('partesBR lê hora e dia no fuso de Brasília', () => {
    expect(partesBR(AGORA)).toEqual({ hora: 12, diaSemana: 1, data: '2026-10-05' })
    // 01:30 UTC de terça = 22:30 de segunda em Brasília
    expect(partesBR(new Date('2026-10-06T01:30:00Z'))).toEqual({ hora: 22, diaSemana: 1, data: '2026-10-05' })
  })
})

describe('mesclagem das dispensas entre aparelhos', () => {
  const futuro = new Date(Date.now() + 3 * 86_400_000).toISOString()
  const dispensa = (em: string, ate: string): Dispensa => ({ id: 'ana|x', usuarioId: 'ana', chave: 'x', ate, em })
  it('une os dois lados e vence a mais recente (reativar vence o adiamento)', () => {
    const adiou = estado({ dispensas: [dispensa('2026-10-05T10:00:00Z', futuro)] })
    const reativou = estado({ dispensas: [dispensa('2026-10-05T11:00:00Z', new Date(Date.now() - 1000).toISOString())] })
    // a reativação (mais recente) vale, qualquer que seja o lado
    for (const m of [mesclarEstados(adiou, reativou), mesclarEstados(reativou, adiou)]) {
      expect(m.dispensas).toHaveLength(1)
      expect(m.dispensas![0].em).toBe('2026-10-05T11:00:00Z')
      expect(dispensaAtiva(m.dispensas, 'ana', 'x')).toBeUndefined() // não está mais adiado
    }
    const so = mesclarEstados(adiou, estado())
    expect(so.dispensas).toHaveLength(1)
  })
  it('descarta as vencidas há mais de 1 dia', () => {
    const velha = estado({ dispensas: [dispensa('2026-01-01T10:00:00Z', '2026-01-02T10:00:00Z')] })
    expect(mesclarEstados(velha, estado()).dispensas).toEqual([])
  })
})
