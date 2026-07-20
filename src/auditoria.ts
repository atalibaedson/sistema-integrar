// Trilha de auditoria: registra quem fez o quê, quando — parte da proteção
// de dados (LGPD), sobretudo para acessos e mudanças em dados sensíveis
// (cuidado/crise) e correções manuais de histórico.
import { getEstado, setEstado, uid } from './store'
import { getUsuarioAtualId } from './acesso'
import type { RegistroAuditoria } from './types'

// Mantém a lista com um teto — evita crescer sem limite dentro do JSON da nuvem.
const LIMITE_REGISTROS = 500

export function registrarAuditoria(
  acao: string,
  opts?: {
    detalhe?: string
    alvoTipo?: RegistroAuditoria['alvoTipo']
    alvoId?: string
    alvoNome?: string
  },
): void {
  const s = getEstado()
  const usuarioId = getUsuarioAtualId()
  const usuario = s.usuarios.find((u) => u.id === usuarioId)

  const registro: RegistroAuditoria = {
    id: uid(),
    data: new Date().toISOString(),
    usuarioId: usuarioId ?? undefined,
    usuarioNome: usuario?.nome ?? 'Não identificado (modo aberto)',
    acao,
    detalhe: opts?.detalhe,
    alvoTipo: opts?.alvoTipo,
    alvoId: opts?.alvoId,
    alvoNome: opts?.alvoNome,
  }

  setEstado((st) => ({
    ...st,
    auditoria: [registro, ...st.auditoria].slice(0, LIMITE_REGISTROS),
  }))
}
