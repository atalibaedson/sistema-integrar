import { useState } from 'react'
import { consolidadoresAtivos, diasSemAtualizacao, semAtualizacao, useAppState, ultimaRespostaOuCadastro } from '../store'
import { diasDesde } from '../machine'
import { estiloStatus, STATUS_LABEL, type Status, type Visitante } from '../types'
import { linkWhatsApp, proximaAcao } from '../actions'
import { navegar } from '../router'
import { IcoBusca, IcoMais, IcoWhats } from '../icones'
import { useUsuarioAtualId, usuarioAtual, visitantesVisiveis } from '../acesso'

// Filtros por ETAPA da jornada (o modelo mental do fluxo), não por status técnico
const GRUPOS: { id: string; rotulo: string; statuses?: Status[]; soCuidado?: boolean; soParados?: boolean }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'consolidacao', rotulo: '🤝 Em consolidação', statuses: ['novo', 'em_contato', 'aguardando_resposta'] },
  { id: 'lider', rotulo: '👥 Com o líder', statuses: ['encaminhado_lider', 'visitou'] },
  { id: 'acompanhando', rotulo: '🌱 Acompanhando', statuses: ['transferido'] },
  { id: 'integrados', rotulo: '🎉 Integrados', statuses: ['integrado'] },
  { id: 'parados', rotulo: '💤 Parados', statuses: ['em_espera', 'recusou', 'encerrado'] },
  { id: 'sem_atualizacao', rotulo: '🕐 Sem atualização 7d+', soParados: true },
  { id: 'cuidado', rotulo: '🚨 Cuidado', soCuidado: true },
]

export default function Visitantes() {
  const s = useAppState()
  const [grupo, setGrupo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [consolidador, setConsolidador] = useState('') // '' = todos · 'sem' = sem responsável · id
  const consolidadores = consolidadoresAtivos(s)

  // Base: só os visitantes que a identidade atual pode ver
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const base = visitantesVisiveis(s, eu)

  const g = GRUPOS.find((x) => x.id === grupo)!
  const passaConsolidador = (v: Visitante) =>
    consolidador === '' || (consolidador === 'sem' ? !v.responsavelId : v.responsavelId === consolidador)
  const contaGrupo = (gr: typeof GRUPOS[number]) =>
    base.filter((v) => {
      if (!passaConsolidador(v)) return false
      if (gr.soCuidado) return v.flagCuidado
      if (gr.soParados) return semAtualizacao(s, v)
      return gr.statuses ? gr.statuses.includes(v.status) : true
    }).length

  const lista = base
    .filter((v) => {
      if (g.soCuidado && !v.flagCuidado) return false
      if (g.soParados && !semAtualizacao(s, v)) return false
      if (g.statuses && !g.statuses.includes(v.status)) return false
      if (!passaConsolidador(v)) return false
      if (busca && !v.nome.toLowerCase().includes(busca.toLowerCase()) && !v.whatsapp.includes(busca)) return false
      return true
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  return (
    <div>
      <h1 className="titulo-pagina">Visitantes</h1>
      <p className="subtitulo">Cada pessoa em uma etapa da jornada — e o que fazer com ela agora.</p>

      {/* Filtros por etapa da jornada */}
      <div className="filtros">
        {GRUPOS.map((gr) => {
          const n = contaGrupo(gr)
          if (gr.id !== 'todos' && n === 0) return null
          return (
            <button key={gr.id} className={`chip ${grupo === gr.id ? 'sel' : ''}`} onClick={() => setGrupo(gr.id)}>
              {gr.rotulo} ({n})
            </button>
          )
        })}
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ flex: 1, maxWidth: 320 }}>
          <span className="search-icon"><IcoBusca /></span>
          <input
            type="text"
            placeholder="Buscar por nome ou WhatsApp…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select
          value={consolidador}
          onChange={(e) => setConsolidador(e.target.value)}
          title="Filtrar pelo consolidador responsável"
          style={{ maxWidth: 230 }}
        >
          <option value="">👤 Todos os consolidadores</option>
          <option value="sem">— Sem responsável —</option>
          {consolidadores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <button className="btn" onClick={() => navegar('/novo')}><IcoMais size={15} /> Novo visitante</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Visitante</th><th>Etapa</th><th>Próxima ação</th><th>Sem resposta</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-2)', padding: 32 }}>
                    Nenhum visitante {grupo === 'todos' ? 'cadastrado ainda' : 'nesta etapa'}.
                  </td>
                </tr>
              ) : (
                lista.map((v) => {
                  const acao = proximaAcao(s, v)
                  const dias = diasDesde(ultimaRespostaOuCadastro(s, v))
                  const mostraDias = ['em_contato', 'aguardando_resposta', 'em_espera'].includes(v.status)
                  const parado = semAtualizacao(s, v)
                  return (
                    <tr key={v.id} className="clicavel" onClick={() => navegar(`/visitante/${v.id}`)}>
                      <td>
                        <div className="cell-title">
                          {v.nome}
                          {v.flagCuidado && ' 🚨'}
                          {v.flagMenorIdade && <span className="badge-flag" style={{ marginLeft: 6 }}>menor</span>}
                        </div>
                        <div className="cell-sub">{v.whatsapp}</div>
                      </td>
                      <td><span className="badge" style={estiloStatus(v.status)}>{STATUS_LABEL[v.status]}</span></td>
                      <td style={{ fontSize: 12.5, color: acao.urgente ? 'var(--danger)' : 'var(--text-2)', fontWeight: acao.urgente ? 700 : 400, maxWidth: 260 }}>
                        {parado && (
                          <div style={{ color: 'var(--warn)', fontWeight: 700, marginBottom: 2 }}>
                            🕐 {diasSemAtualizacao(s, v)} dias sem atualização
                          </div>
                        )}
                        {acao.titulo}
                      </td>
                      <td>{mostraDias ? (
                        <span style={{ color: dias >= 14 ? 'var(--danger)' : dias >= 10 ? 'var(--warn)' : 'inherit', fontWeight: dias >= 10 ? 700 : 400 }}>
                          {dias}d
                        </span>
                      ) : '—'}</td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                        <a className="btn-icone whats" href={linkWhatsApp(v.whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp"><IcoWhats /></a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
