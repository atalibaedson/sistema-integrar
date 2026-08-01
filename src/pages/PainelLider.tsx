import { useEffect, useState } from 'react'
import { lideres, templatePorGatilho, useAppState } from '../store'
import { estiloStatus, rotuloStatus, type Status, type Visitante } from '../types'
import { aplicarTemplate, linkWhatsApp, mudarStatus } from '../actions'
import { navegar } from '../router'
import { iniciais } from './Equipe'
import { useUsuarioAtualId, usuarioAtual } from '../acesso'
import { IcoBusca, IcoCheck, IcoWhats } from '../icones'

// Filtros por tarefa do líder (mesmo padrão de chips da página Visitantes)
const GRUPOS: { id: string; rotulo: string; statuses: Status[] }[] = [
  { id: 'todos', rotulo: 'Todos', statuses: ['encaminhado_lider', 'visitou', 'transferido', 'batismo', 'integrado'] },
  { id: 'antes', rotulo: '🤝 Falar antes da visita', statuses: ['encaminhado_lider'] },
  { id: 'confirmar', rotulo: '⏳ Confirmar que assumiu', statuses: ['visitou'] },
  { id: 'acompanhando', rotulo: '🌱 Acompanhando', statuses: ['transferido', 'batismo', 'integrado'] },
]

// O que o líder precisa fazer. Depende do status e, na etapa do batismo, também
// de o batismo já ter acontecido ou não — são dois momentos bem diferentes.
function oQueFazer(v: Visitante): string | undefined {
  if (v.status === 'batismo') {
    const jaFoi = v.situacaoBatismo === 'batizado_aqui' || v.situacaoBatismo === 'ja_batizado'
    return jaFoi ? 'Já batizado(a) — falta receber como membro' : 'Acompanhar até o batismo'
  }
  return ({
    encaminhado_lider: 'Falar com a pessoa ANTES da visita',
    visitou: 'Confirmar que você assumiu o acompanhamento',
    transferido: 'Acompanhar até o batismo ou a membresia',
    integrado: 'Jornada concluída 🎉',
  } as Partial<Record<Status, string>>)[v.status]
}

// Painel do líder de Conexão (requisito 11): seus visitantes encaminhados/transferidos
export default function PainelLider() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  // Um líder só vê o próprio painel — os demais líderes não aparecem na lista.
  const ls = eu?.papeis.includes('lider') ? lideres(s).filter((l) => l.id === eu.id) : lideres(s)
  const [liderId, setLiderId] = useState(ls[0]?.id ?? '')
  const [grupo, setGrupo] = useState('todos')
  const [busca, setBusca] = useState('')

  // Se a identidade "Vendo como" mudar (ou a lista ficar restrita a 1 líder), acompanha.
  useEffect(() => {
    if (ls.length > 0 && !ls.some((l) => l.id === liderId)) setLiderId(ls[0].id)
  }, [ls, liderId])

  const lider = ls.find((l) => l.id === liderId)
  const conexao = s.conexoes.find((c) => c.id === lider?.conexaoId)
  const tplPreVisita = templatePorGatilho(s, 'pre_visita_lider')

  const meus = s.visitantes.filter(
    (v) => v.liderConexaoId === liderId &&
      ['encaminhado_lider', 'visitou', 'transferido', 'batismo', 'integrado'].includes(v.status),
  )

  const contaGrupo = (g: typeof GRUPOS[number]) => meus.filter((v) => g.statuses.includes(v.status)).length

  const g = GRUPOS.find((x) => x.id === grupo)!
  const lista = meus
    .filter((v) => g.statuses.includes(v.status))
    .filter((v) => !busca || v.nome.toLowerCase().includes(busca.toLowerCase()) || v.whatsapp.includes(busca))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  return (
    <div>
      <h1 className="titulo-pagina">Painel do líder de {s.config.termoGrupo}</h1>
      <p className="subtitulo">O que cada líder precisa fazer com os visitantes encaminhados a ele.</p>

      {/* Cabeçalho do líder selecionado */}
      <div className="card">
        <div className="cartao-pessoa" style={{ border: 'none', padding: 0 }}>
          <div className="avatar avatar-g" style={{ background: 'var(--primary)' }}>{lider ? iniciais(lider.nome) : '?'}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="campo" style={{ marginBottom: 4 }}>
              <span>Líder</span>
              {eu?.papeis.includes('lider') ? (
                <input type="text" value={lider?.nome ?? ''} readOnly style={{ fontWeight: 600, background: 'var(--surface2)' }} />
              ) : (
                <select value={liderId} onChange={(e) => { setLiderId(e.target.value); setGrupo('todos') }} style={{ fontWeight: 600 }}>
                  {ls.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}{s.conexoes.find((c) => c.id === l.conexaoId) ? ` — ${s.conexoes.find((c) => c.id === l.conexaoId)!.nome}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {lider && (
              <div className="pessoa-sub">
                📱 {lider.whatsapp}
                {conexao && <> · 🏠 {conexao.nome} · {conexao.diaHorario || 'dia a definir'} {conexao.perfil && `· ${conexao.perfil}`}</>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filtros por tarefa */}
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
          <input type="text" placeholder="Buscar por nome ou WhatsApp…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Visitante</th><th>Etapa</th><th>O que fazer</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-2)', padding: 32 }}>
                    {meus.length === 0 ? 'Nenhum visitante encaminhado a este líder ainda.' : 'Nada nesta etapa. 👍'}
                  </td>
                </tr>
              ) : (
                lista.map((v) => (
                  <tr key={v.id} className="clicavel" onClick={() => navegar(`/visitante/${v.id}`)}>
                    <td>
                      <div className="cell-title">{v.nome}{v.flagCuidado && ' 🚨'}</div>
                      <div className="cell-sub">{v.whatsapp}</div>
                    </td>
                    <td><span className="badge" style={estiloStatus(v.status)}>{rotuloStatus(v.status)}</span></td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-2)', maxWidth: 240 }}>{oQueFazer(v)}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <AcoesLider v={v} tplPreVisita={tplPreVisita} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AcoesLider({ v, tplPreVisita }: { v: Visitante; tplPreVisita?: { texto: string } }) {
  if (v.status === 'encaminhado_lider') {
    return (
      <span style={{ display: 'inline-flex', gap: 6 }}>
        <a className="btn-icone whats" title="Fazer contato pré-visita" target="_blank" rel="noreferrer"
          href={linkWhatsApp(v.whatsapp, tplPreVisita ? aplicarTemplate(tplPreVisita.texto, v.nome) : undefined)}><IcoWhats /></a>
        <button className="btn btn-mini" onClick={() => mudarStatus(v.id, 'visitou', 'Compareceu ao grupo')}>
          <IcoCheck size={13} /> Visitou
        </button>
      </span>
    )
  }
  if (v.status === 'visitou') {
    return (
      <button className="btn btn-mini" onClick={() => mudarStatus(v.id, 'transferido', 'Líder confirmou que assumiu o acompanhamento')}>
        <IcoCheck size={13} /> Assumi
      </button>
    )
  }
  return <a className="btn-icone whats" href={linkWhatsApp(v.whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp"><IcoWhats /></a>
}
