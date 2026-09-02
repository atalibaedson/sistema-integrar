import { describe, it, expect } from 'vitest'
import { mesclarEstados } from '../mesclar'
import type { AppState, Usuario, Visitante } from '../types'

// Fábricas mínimas — só o suficiente para exercitar a mesclagem.
function estado(over: Partial<AppState> = {}): AppState {
  return {
    config: { termoGrupo: 'Conexão' } as AppState['config'],
    visitantes: [], interacoes: [], conexoes: [], usuarios: [],
    templates: [], auditoria: [], excluidos: [],
    ...over,
  }
}
function vis(id: string, over: Partial<Visitante> = {}): Visitante {
  const agora = '2026-01-01T00:00:00.000Z'
  return {
    id, nome: id, whatsapp: '11999999999', dataCadastro: agora, origem: 'culto',
    status: 'novo', flagMenorIdade: false, flagOutraCidade: false, flagCuidado: false,
    transferenciaConfirmada: false, consentimentoLgpd: true,
    historicoStatus: [], criadoEm: agora, atualizadoEm: agora, ...over,
  }
}
function user(id: string, over: Partial<Usuario> = {}): Usuario {
  return { id, nome: id, whatsapp: '11900000000', papeis: ['consolidador'], ativo: true, statusAcesso: 'sem_login', ...over }
}

describe('mesclagem local × nuvem', () => {
  it('une visitantes por id (os dois lados somam)', () => {
    const local = estado({ visitantes: [vis('a')] })
    const remoto = estado({ visitantes: [vis('b')] })
    const r = mesclarEstados(local, remoto)
    expect(r.visitantes.map((v) => v.id).sort()).toEqual(['a', 'b'])
  })

  it('mesmo id: vence a versão com atualizadoEm mais novo', () => {
    const local = estado({ visitantes: [vis('a', { nome: 'Antigo', atualizadoEm: '2026-01-01T00:00:00.000Z' })] })
    const remoto = estado({ visitantes: [vis('a', { nome: 'Novo', atualizadoEm: '2026-02-01T00:00:00.000Z' })] })
    expect(mesclarEstados(local, remoto).visitantes[0].nome).toBe('Novo')
  })

  it('lápide de exclusão remove o registro dos dois lados', () => {
    const local = estado({ excluidos: [{ tipo: 'visitante', id: 'a', em: '2026-03-01T00:00:00.000Z' }] })
    const remoto = estado({ visitantes: [vis('a')] })
    expect(mesclarEstados(local, remoto).visitantes).toHaveLength(0)
  })

  it('conta aprovada na nuvem não é sobrescrita por ficha sem login local (blindagem do incidente)', () => {
    const local = estado({ usuarios: [user('u1', { statusAcesso: 'sem_login', ativo: true })] })
    const remoto = estado({ usuarios: [user('u1', { statusAcesso: 'aprovado', authUserId: 'auth-1', email: 'a@b.com' })] })
    const u = mesclarEstados(local, remoto).usuarios[0]
    expect(u.statusAcesso).toBe('aprovado')
    expect(u.authUserId).toBe('auth-1')
  })

  it('interações órfãs (sem visitante) são descartadas', () => {
    const local = estado({
      visitantes: [vis('a')],
      interacoes: [
        { id: 'i1', visitanteId: 'a', autorPapel: 'consolidador', data: '2026-01-02T00:00:00.000Z', canal: 'whatsapp', tipo: 'livre', respondeu: true, grauAbertura: 'medio', retornoResumo: '', proximosPassos: '', encaminhamentos: '', flagCuidado: false },
        { id: 'i2', visitanteId: 'zzz', autorPapel: 'consolidador', data: '2026-01-02T00:00:00.000Z', canal: 'whatsapp', tipo: 'livre', respondeu: true, grauAbertura: 'medio', retornoResumo: '', proximosPassos: '', encaminhamentos: '', flagCuidado: false },
      ],
    })
    const r = mesclarEstados(local, estado())
    expect(r.interacoes.map((i) => i.id)).toEqual(['i1'])
  })

  it('config: vence quem editou por último (configAtualizadaEm)', () => {
    const local = estado({ config: { termoGrupo: 'Local' } as AppState['config'], configAtualizadaEm: '2026-01-01T00:00:00.000Z' })
    const remoto = estado({ config: { termoGrupo: 'Remoto' } as AppState['config'], configAtualizadaEm: '2026-05-01T00:00:00.000Z' })
    expect(mesclarEstados(local, remoto).config.termoGrupo).toBe('Remoto')
  })
})
