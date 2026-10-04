// Central de avisos no app: liga as regras puras (alertas.ts) ao estado, ao
// usuário logado e às ações de "adiar" / "já resolvi". As regras em si ficam em
// alertas.ts, que roda igual no servidor (push).
import { useEffect, useMemo, useState } from 'react'
import { setEstado, useAppState } from './store'
import { getUsuarioAtualId, useUsuarioAtualId, usuarioAtual } from './acesso'
import { alertasDoUsuario, calcularAlertas, idDispensa, type Alerta, type TipoAlerta } from './alertas'
import { IcoAlerta, IcoCalendario, IcoCasa, IcoMensagem, IcoRelogio, IcoUserPlus, IcoUsuario, IcoUsuarios, IcoWhats } from './icones'
import type { AppState, Dispensa } from './types'

export interface AvisosDoUsuario {
  ativos: Alerta[]
  adiados: { alerta: Alerta; ate: string }[]
  porVisitante: Map<string, Alerta[]> // avisos ativos, por ficha (selo nas listas)
}

// Recalcula quando o estado muda e a cada 10 minutos (virada do dia com o app aberto)
function useRelogio(): number {
  const [t, setT] = useState(() => Math.floor(Date.now() / 600_000))
  useEffect(() => {
    const id = window.setInterval(() => setT(Math.floor(Date.now() / 600_000)), 600_000)
    return () => window.clearInterval(id)
  }, [])
  return t
}

// Vários componentes usam os avisos ao mesmo tempo (menu, Painel, listas): o
// resultado é guardado por (estado, pessoa, relógio) para calcular uma vez só.
let cache: { s: AppState; uid?: string; rel: number; r: AvisosDoUsuario } | null = null

function calcular(s: AppState, uid: string | undefined, rel: number): AvisosDoUsuario {
  if (cache && cache.s === s && cache.uid === uid && cache.rel === rel) return cache.r
  const { ativos, adiados } = alertasDoUsuario(s, uid, new Date(), calcularAlertas(s))
  const porVisitante = new Map<string, Alerta[]>()
  for (const a of ativos) {
    if (!a.visitanteId) continue
    const arr = porVisitante.get(a.visitanteId)
    if (arr) arr.push(a)
    else porVisitante.set(a.visitanteId, [a])
  }
  const r = { ativos, adiados, porVisitante }
  cache = { s, uid, rel, r }
  return r
}

export function useAvisos(): AvisosDoUsuario {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const relogio = useRelogio()
  return useMemo(() => calcular(s, eu?.id, relogio), [s, eu?.id, relogio])
}

const DIA_MS = 86_400_000

// Silencia o aviso só para a pessoa logada, por `dias` dias. "Já resolvi" usa um
// prazo longo: se a causa continuar de pé depois disso, o aviso volta.
export function dispensarAviso(chave: string, dias: number): void {
  const usuarioId = getUsuarioAtualId()
  if (!usuarioId) return
  gravarDispensa(usuarioId, chave, Date.now() + dias * DIA_MS)
}

// Traz de volta um aviso adiado (a dispensa vence agora e, sendo a mais recente, vence na mesclagem)
export function reativarAviso(chave: string): void {
  const usuarioId = getUsuarioAtualId()
  if (!usuarioId) return
  gravarDispensa(usuarioId, chave, Date.now() - 1000)
}

function gravarDispensa(usuarioId: string, chave: string, ateMs: number): void {
  const id = idDispensa(usuarioId, chave)
  const nova: Dispensa = { id, usuarioId, chave, ate: new Date(ateMs).toISOString(), em: new Date().toISOString() }
  const corte = Date.now() - DIA_MS
  setEstado((st) => ({
    ...st,
    dispensas: [...(st.dispensas ?? []).filter((d) => d.id !== id && new Date(d.ate).getTime() > corte), nova],
  }))
}

// ---- Apresentação dos avisos (ícone e rótulo de nível), usada pelo Painel e pela central ----

export const ICONE_ALERTA: Record<TipoAlerta, (p: { size?: number }) => JSX.Element> = {
  sem_responsavel: IcoAlerta,
  novo_para_voce: IcoUserPlus,
  primeiro_contato: IcoWhats,
  contato_vencido: IcoRelogio,
  lider_sem_contato: IcoCasa,
  resposta_recebida: IcoMensagem,
  quase_em_espera: IcoRelogio,
  cuidado: IcoAlerta,
  equipe_parada: IcoUsuarios,
  acolhedor_parado: IcoUsuario,
  culto_sem_cadastro: IcoCalendario,
}

export function textoNivel(a: Alerta): string | null {
  return a.nivel === 2 ? 'Escalado à Gestão' : a.nivel === 1 ? 'Escalado ao líder' : null
}

