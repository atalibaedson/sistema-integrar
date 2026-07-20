import { useState } from 'react'
import { useAppState } from '../store'
import { papelVeTudo, useUsuarioAtualId, usuarioAtual } from '../acesso'
import { IcoBusca } from '../icones'
import { navegar } from '../router'

const LIMITE_TELA = 200

export default function Auditoria() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const [busca, setBusca] = useState('')

  // Restrito a coordenação/pastor — em modo aberto (fase de teste), qualquer um vê.
  if (eu && !papelVeTudo(eu)) {
    return (
      <div className="vazio" style={{ maxWidth: 460, margin: '40px auto' }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <p style={{ marginTop: 8 }}>A auditoria é restrita à coordenação e à liderança.</p>
        <a href="#/" style={{ color: 'var(--primary)' }}>← Voltar ao painel</a>
      </div>
    )
  }

  const b = busca.trim().toLowerCase()
  const registros = s.auditoria
    .filter((r) => !b || `${r.usuarioNome} ${r.acao} ${r.detalhe ?? ''} ${r.alvoNome ?? ''}`.toLowerCase().includes(b))
    .slice(0, LIMITE_TELA)

  return (
    <div>
      <h1 className="titulo-pagina">Auditoria</h1>
      <p className="subtitulo">Quem fez o quê, e quando — registro automático das ações sensíveis do sistema.</p>

      <div className="alerta alerta-info" style={{ marginBottom: 16 }}>
        ℹ️ <div><b>Fase de teste:</b> a identidade vem do seletor "Vendo como" (sem senha ainda). Quando o login chegar,
        estes mesmos registros passam a valer com identidade verificada.</div>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ flex: 1, maxWidth: 360 }}>
          <span className="search-icon"><IcoBusca /></span>
          <input type="text" placeholder="Buscar por pessoa, ação ou visitante…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Alvo</th><th>Detalhe</th></tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-2)', padding: 32 }}>
                  {s.auditoria.length === 0 ? 'Nenhum registro ainda — as ações sensíveis vão aparecer aqui.' : 'Nada encontrado.'}
                </td></tr>
              ) : (
                registros.map((r) => (
                  <tr
                    key={r.id}
                    className={r.alvoTipo === 'visitante' ? 'clicavel' : ''}
                    onClick={() => r.alvoTipo === 'visitante' && r.alvoId && navegar(`/visitante/${r.alvoId}`)}
                  >
                    <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: 'var(--text-2)' }}>
                      {new Date(r.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="cell-title">{r.usuarioNome}</td>
                    <td style={{ fontSize: 13 }}>{r.acao}</td>
                    <td className="cell-sub">{r.alvoNome ?? '—'}</td>
                    <td className="cell-sub" style={{ maxWidth: 260 }}>{r.detalhe ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {s.auditoria.length > LIMITE_TELA && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
          Mostrando os {LIMITE_TELA} registros mais recentes de {s.auditoria.length}.
        </p>
      )}
    </div>
  )
}
