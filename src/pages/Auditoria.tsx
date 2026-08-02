import { useState } from 'react'
import { useAppState } from '../store'
import { SeletorData } from '../campos'
import { IcoBusca } from '../icones'
import { navegar } from '../router'

// O acesso a esta página é controlado centralmente no App (mapa de permissões).
const LIMITE_TELA = 200

export default function Auditoria() {
  const s = useAppState()
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState('')   // AAAA-MM-DD
  const [ate, setAte] = useState('') // AAAA-MM-DD

  const b = busca.trim().toLowerCase()
  const filtrados = s.auditoria.filter((r) => {
    const dia = r.data.slice(0, 10)
    if (de && dia < de) return false
    if (ate && dia > ate) return false
    if (b && !`${r.usuarioNome} ${r.acao} ${r.detalhe ?? ''} ${r.alvoNome ?? ''}`.toLowerCase().includes(b)) return false
    return true
  })
  const registros = filtrados.slice(0, LIMITE_TELA)
  const temFiltro = !!(b || de || ate)

  function limpar() { setBusca(''); setDe(''); setAte('') }

  return (
    <div>
      <h1 className="titulo-pagina">Auditoria</h1>
      <p className="subtitulo">Quem fez o quê, e quando — registro automático das ações sensíveis do sistema.</p>

      <div className="filter-bar" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
          <span className="search-icon"><IcoBusca /></span>
          <input type="text" placeholder="Buscar por pessoa, ação ou visitante…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <span className="aud-periodo">De <SeletorData compacto value={de} max={ate || undefined} onChange={setDe} /></span>
        <span className="aud-periodo">Até <SeletorData compacto value={ate} min={de || undefined} onChange={setAte} /></span>
        {temFiltro && <button className="btn btn-sec" onClick={limpar}>Limpar filtros</button>}
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
                  {s.auditoria.length === 0
                    ? 'Nenhum registro ainda — as ações sensíveis vão aparecer aqui.'
                    : 'Nada encontrado para os filtros selecionados.'}
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

      <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
        {temFiltro
          ? `${filtrados.length} registro(s) no filtro${filtrados.length > LIMITE_TELA ? ` — mostrando os ${LIMITE_TELA} mais recentes` : ''}.`
          : filtrados.length > LIMITE_TELA
            ? `Mostrando os ${LIMITE_TELA} registros mais recentes de ${s.auditoria.length}.`
            : `${s.auditoria.length} registro(s).`}
      </p>
    </div>
  )
}
