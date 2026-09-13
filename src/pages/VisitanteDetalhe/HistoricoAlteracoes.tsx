import { useAppState } from '../../store'
import { papelVeTudo, useUsuarioAtualId, usuarioAtual } from '../../acesso'
import type { Visitante } from '../../types'
import { fmt } from './comum'

/* ================= Histórico de alterações da ficha =================
   Traz para a ficha o que a auditoria (LGPD) já registra sobre este visitante:
   quem fez cada alteração administrativa (mudou responsável, corrigiu status,
   registrou batismo/membresia, sinalizou cuidado, excluiu…) e quando.

   Restrito a gestão/pastores — os mesmos papéis com acesso à Auditoria. O log
   inclui ações sensíveis (cuidado/crise), então não pode ficar visível para
   toda a equipe. Recolhido por padrão, para não pesar a ficha. */
export default function HistoricoAlteracoes({ v }: { v: Visitante }) {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())

  if (!papelVeTudo(eu)) return null

  // A auditoria já vem do mais novo para o mais antigo (registrarAuditoria insere no topo).
  const registros = s.auditoria.filter((r) => r.alvoTipo === 'visitante' && r.alvoId === v.id)
  if (registros.length === 0) return null

  return (
    <details className="card">
      <summary className="hist-alt-sumario">
        🕓 Histórico de alterações <span className="hist-alt-cont">({registros.length})</span>
      </summary>
      <p className="descricao-secao" style={{ margin: '8px 0 12px' }}>
        Quem fez cada alteração administrativa nesta ficha. Visível só para gestão e pastores.
      </p>
      <div className="hist-alt-lista">
        {registros.map((r) => (
          <div key={r.id} className="hist-alt-item">
            <div className="hist-alt-topo">
              <span className="hist-alt-acao">{r.acao}</span>
              <span className="hist-alt-data">{fmt(r.data)}</span>
            </div>
            <div className="hist-alt-sub">
              por <b>{r.usuarioNome}</b>{r.detalhe ? <> · {r.detalhe}</> : null}
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}
