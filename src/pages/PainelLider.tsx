import { useEffect, useRef, useState } from 'react'
import { lideres, templatePorGatilho, useAppState } from '../store'
import { estiloStatus, rotuloStatus, STATUS_COR, type Status, type Visitante } from '../types'
import { aplicarTemplate, linkWhatsApp, mudarStatus, normalizarTexto } from '../actions'
import { navegar } from '../router'
import { useUsuarioAtualId, usuarioAtual } from '../acesso'
import { IcoBusca, IcoCalendario, IcoCasa, IcoCheck, IcoEditar, IcoWhats } from '../icones'
import Avatar from '../Avatar'

// Filtros por TAREFA do líder (bolinha = cor da etapa, como na Jornada)
const GRUPOS: { id: string; rotulo: string; cor?: string; statuses: Status[] }[] = [
  { id: 'todos', rotulo: 'Todos', statuses: ['encaminhado_lider', 'visitou', 'transferido', 'batismo', 'integrado'] },
  { id: 'antes', rotulo: 'Falar antes da visita', cor: STATUS_COR.encaminhado_lider, statuses: ['encaminhado_lider'] },
  { id: 'confirmar', rotulo: 'Confirmar que assumiu', cor: STATUS_COR.visitou, statuses: ['visitou'] },
  { id: 'acompanhando', rotulo: 'Acompanhando', cor: STATUS_COR.transferido, statuses: ['transferido', 'batismo', 'integrado'] },
]

function oQueFazer(v: Visitante): string | undefined {
  if (v.status === 'batismo') {
    const jaFoi = v.situacaoBatismo === 'batizado_aqui' || v.situacaoBatismo === 'ja_batizado'
    return jaFoi ? 'Já batizado(a) — falta receber como membro' : 'Acompanhar até o batismo'
  }
  return ({
    encaminhado_lider: 'Falar com a pessoa ANTES da visita',
    visitou: 'Confirmar que você assumiu o acompanhamento',
    transferido: 'Acompanhar até o batismo ou a membresia',
    integrado: 'Jornada concluída',
  } as Partial<Record<Status, string>>)[v.status]
}

// Combobox de busca de líder (por nome ou nome da conexão)
function ComboLider({ ls, liderId, onSelecionar }: {
  ls: ReturnType<typeof lideres>
  liderId: string
  onSelecionar: (id: string) => void
}) {
  const s = useAppState()
  const liderAtual = ls.find((l) => l.id === liderId)
  const [texto, setTexto] = useState(liderAtual?.nome ?? '')
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
        setTexto(liderAtual?.nome ?? '')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [liderAtual?.nome])

  // Atualiza texto quando muda externamente
  useEffect(() => { setTexto(liderAtual?.nome ?? '') }, [liderAtual?.nome])

  const filtrados = ls.filter((l) => {
    if (!texto) return true
    const cx = s.conexoes.find((c) => c.id === l.conexaoId)?.nome ?? ''
    return `${l.nome} ${cx}`.toLowerCase().includes(texto.toLowerCase())
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="search-box" style={{ width: '100%' }}>
        <span className="search-icon"><IcoBusca /></span>
        <input
          type="text"
          value={texto}
          placeholder="Buscar líder ou conexão…"
          style={{ fontWeight: 600 }}
          onChange={(e) => { setTexto(e.target.value); setAberto(true) }}
          onFocus={() => { setTexto(''); setAberto(true) }}
        />
      </div>
      {aberto && filtrados.length > 0 && (
        <div className="combo-dropdown">
          {filtrados.map((l) => {
            const cx = s.conexoes.find((c) => c.id === l.conexaoId)?.nome
            return (
              <button
                key={l.id}
                className={`combo-item ${l.id === liderId ? 'sel' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelecionar(l.id)
                  setTexto(l.nome)
                  setAberto(false)
                }}
              >
                <span className="combo-item-nome">{l.nome}</span>
                {cx && <span className="combo-item-sub">{cx}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PainelLider() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const ls = eu?.papeis.includes('lider') ? lideres(s).filter((l) => l.id === eu.id) : lideres(s)
  const [liderId, setLiderId] = useState(ls[0]?.id ?? '')
  const [grupo, setGrupo] = useState('todos')
  const [busca, setBusca] = useState('')

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
    .filter((v) => !busca || normalizarTexto(v.nome).includes(normalizarTexto(busca)) || v.whatsapp.includes(busca))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  return (
    <div>
      <h1 className="titulo-pagina">Painel do líder de {s.config.termoGrupo}</h1>
      <p className="subtitulo">O que cada líder precisa fazer com os visitantes encaminhados a ele.</p>

      {/* Cabeçalho do líder selecionado */}
      <div className="card lider-cab">
        {lider ? <Avatar nome={lider.nome} tamanho="g" foto={lider.fotoUrl} /> : <Avatar nome="?" tamanho="g" tom="var(--text-3)" />}
        <div className="lider-cab-txt">
          <label className="campo" style={{ marginBottom: 6 }}>
            <span>Líder</span>
            {eu?.papeis.includes('lider') ? (
              <input type="text" value={lider?.nome ?? ''} readOnly style={{ fontWeight: 600, background: 'var(--surface2)' }} />
            ) : (
              <ComboLider
                ls={ls}
                liderId={liderId}
                onSelecionar={(id) => { setLiderId(id); setGrupo('todos') }}
              />
            )}
          </label>
          {lider && (
            <div className="pessoa-sub cartao-sub">
              <span><IcoWhats size={12} /> {lider.whatsapp}</span>
              {conexao && <span><IcoCasa size={12} /> {conexao.nome}</span>}
              {conexao && <span><IcoCalendario size={12} /> {conexao.diaHorario || 'dia a definir'}{conexao.perfil && ` · ${conexao.perfil}`}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Filtros por tarefa */}
      <div className="pilulas" role="tablist" aria-label="Filtrar por tarefa">
        {GRUPOS.map((gr) => {
          const n = contaGrupo(gr)
          if (gr.id !== 'todos' && n === 0) return null
          return (
            <button
              key={gr.id} type="button" role="tab" aria-selected={grupo === gr.id}
              className={`pilula ${grupo === gr.id ? 'sel' : ''}`} onClick={() => setGrupo(gr.id)}
            >
              {gr.cor && <i className="pilula-ponto" style={{ background: gr.cor }} />}
              {gr.rotulo}
              <span className="pilula-n">{n}</span>
            </button>
          )
        })}
      </div>

      <div className="vis-barra">
        <div className="search-box vis-busca">
          <span className="search-icon"><IcoBusca /></span>
          <input type="text" placeholder="Buscar por nome ou WhatsApp…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <span className="vis-total">{lista.length} {lista.length === 1 ? 'pessoa' : 'pessoas'}</span>
      </div>

      <div className="card vis-lista">
        <div className="vis-cab lider-linha" aria-hidden>
          <span /><span>Visitante</span><span>Etapa</span><span>O que fazer</span><span />
        </div>
        {lista.length === 0 ? (
          <div className="painel-vazio">
            {meus.length === 0 ? 'Nenhum visitante encaminhado a este líder ainda.' : 'Nada nesta etapa.'}
          </div>
        ) : (
          lista.map((v) => (
            <div
              key={v.id} className="vis-linha lider-linha" role="link" tabIndex={0}
              onClick={() => navegar(`/visitante/${v.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navegar(`/visitante/${v.id}`) }}
            >
              <Avatar nome={v.nome} tom={v.flagCuidado ? 'var(--danger)' : undefined} />
              <div className="vis-pessoa">
                <b>
                  {v.nome}
                  {v.flagCuidado && <span className="painel-chip painel-chip-crit">cuidado</span>}
                </b>
                <span>{v.whatsapp}</span>
              </div>
              <div className="vis-etapa">
                <span className="chip-etapa" style={estiloStatus(v.status)} title={rotuloStatus(v.status)}>{rotuloStatus(v.status)}</span>
              </div>
              <div className="vis-acao">{oQueFazer(v)}</div>
              <div className="lider-acoes" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <AcoesLider v={v} tplPreVisita={tplPreVisita} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function AcoesLider({ v, tplPreVisita }: { v: Visitante; tplPreVisita?: { texto: string } }) {
  // Registrar o que aconteceu (conversa, motivo de ainda não ter visitado…)
  // fica na ficha — este atalho só leva até lá.
  const registrar = (
    <button className="btn-icone" title="Registrar contato / novidade" onClick={() => navegar(`/visitante/${v.id}`)}>
      <IcoEditar />
    </button>
  )
  if (v.status === 'encaminhado_lider') {
    return (
      <span style={{ display: 'inline-flex', gap: 6 }}>
        <a className="btn-icone whats" title="Fazer contato pré-visita" target="_blank" rel="noreferrer"
          href={linkWhatsApp(v.whatsapp, tplPreVisita ? aplicarTemplate(tplPreVisita.texto, v) : undefined)}><IcoWhats /></a>
        {registrar}
        <button className="btn btn-mini" onClick={() => mudarStatus(v.id, 'visitou', 'Compareceu ao grupo')}>
          <IcoCheck size={13} /> Visitou
        </button>
      </span>
    )
  }
  if (v.status === 'visitou') {
    return (
      <span style={{ display: 'inline-flex', gap: 6 }}>
        {registrar}
        <button className="btn btn-mini" onClick={() => mudarStatus(v.id, 'transferido', 'Líder confirmou que assumiu o acompanhamento')}>
          <IcoCheck size={13} /> Assumi
        </button>
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <a className="btn-icone whats" href={linkWhatsApp(v.whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp"><IcoWhats /></a>
      {registrar}
    </span>
  )
}
