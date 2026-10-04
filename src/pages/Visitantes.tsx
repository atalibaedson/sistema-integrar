import { useState } from 'react'
import { consolidadoresAtivos, diasSemAtualizacao, semAtualizacao, semResponsavel, useAppState, ultimaRespostaOuCadastro, usuarioPorId } from '../store'
import { diasDesde } from '../machine'
import { estiloStatus, rotuloStatus, STATUS_COR, type Status, type Visitante } from '../types'
import { linkWhatsApp, normalizarTexto, proximaAcao } from '../actions'
import { navegar } from '../router'
import { IcoBusca, IcoRelogio, IcoSino, IcoWhats } from '../icones'
import { useAvisos } from '../avisos'
import Avatar from '../Avatar'
import { useUsuarioAtualId, usuarioAtual, visitantesVisiveis } from '../acesso'

// Filtros por ETAPA da jornada (o modelo mental do fluxo), não por status técnico.
// `cor` = bolinha da pílula (a mesma cor da etapa na Jornada e no Painel).
const GRUPOS: { id: string; rotulo: string; cor?: string; statuses?: Status[]; soCuidado?: boolean; soParados?: boolean }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'consolidacao', rotulo: 'Em consolidação', cor: STATUS_COR.em_contato, statuses: ['novo', 'em_contato', 'aguardando_resposta'] },
  { id: 'lider', rotulo: 'Com o líder', cor: STATUS_COR.encaminhado_lider, statuses: ['encaminhado_lider', 'visitou'] },
  { id: 'acompanhando', rotulo: 'Acompanhando', cor: STATUS_COR.transferido, statuses: ['transferido'] },
  { id: 'batismo', rotulo: 'Batismo', cor: STATUS_COR.batismo, statuses: ['batismo'] },
  { id: 'integrados', rotulo: 'Membros', cor: STATUS_COR.integrado, statuses: ['integrado'] },
  { id: 'parados', rotulo: 'Parados', cor: STATUS_COR.em_espera, statuses: ['em_espera', 'recusou', 'encerrado'] },
  { id: 'sem_atualizacao', rotulo: 'Sem atualização 7d+', cor: 'var(--warn)', soParados: true },
  { id: 'cuidado', rotulo: 'Cuidado', cor: 'var(--danger)', soCuidado: true },
]

// Filtro inicial pelo endereço (#/visitantes?grupo=cuidado&resp=sem) — é como os
// itens do Painel ("Para resolver hoje") abrem a lista já filtrada.
function parametroDoEndereco(nome: string): string | null {
  const q = window.location.hash.split('?')[1]
  return q ? new URLSearchParams(q).get(nome) : null
}

export default function Visitantes() {
  const s = useAppState()
  const [grupo, setGrupo] = useState(() => {
    const g = parametroDoEndereco('grupo')
    return GRUPOS.some((x) => x.id === g) ? (g as string) : 'todos'
  })
  const [busca, setBusca] = useState('')
  // '' = todos · 'sem' = sem responsável · id
  // (id de pessoa vem dos avisos: "fulano tem 3 fichas paradas")
  const [consolidador, setConsolidador] = useState(() => {
    const r = parametroDoEndereco('resp')
    return r === 'sem' || (r && s.usuarios.some((u) => u.id === r)) ? r! : ''
  })
  const { porVisitante: avisosPorVisitante } = useAvisos()
  const consolidadores = consolidadoresAtivos(s)

  // Base: só os visitantes que a identidade atual pode ver
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const base = visitantesVisiveis(s, eu)

  const g = GRUPOS.find((x) => x.id === grupo)!
  // "Sem responsável" inclui quem tem um responsável removido/inativo — a
  // ficha já mostra "sem responsável" nesses casos; o filtro tem de bater.
  const passaConsolidador = (v: Visitante) =>
    consolidador === '' || (consolidador === 'sem' ? semResponsavel(s, v) : v.responsavelId === consolidador)
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
      if (busca && !normalizarTexto(v.nome).includes(normalizarTexto(busca)) && !v.whatsapp.includes(busca)) return false
      return true
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  const abrir = (v: Visitante) => navegar(`/visitante/${v.id}`)

  return (
    <div className="vis">
      <h1 className="titulo-pagina">Visitantes</h1>
      <p className="subtitulo">Cada pessoa em uma etapa da jornada — e o que fazer com ela agora.</p>

      {/* Filtros por etapa da jornada */}
      <div className="pilulas" role="tablist" aria-label="Filtrar por etapa">
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
          <input
            type="text"
            placeholder="Buscar por nome ou WhatsApp…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select
          className="vis-resp"
          value={consolidador}
          onChange={(e) => setConsolidador(e.target.value)}
          title="Filtrar pelo consolidador responsável"
        >
          <option value="">Todos os consolidadores</option>
          <option value="sem">— Sem responsável —</option>
          {consolidadores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <span className="vis-total">{lista.length} {lista.length === 1 ? 'pessoa' : 'pessoas'}</span>
      </div>

      <div className="card vis-lista">
        <div className="vis-cab" aria-hidden>
          <span /><span>Visitante</span><span>Etapa</span><span>Próxima ação</span><span>Sem retorno</span><span />
        </div>
        {lista.length === 0 ? (
          <div className="painel-vazio">
            {busca ? 'Ninguém encontrado com essa busca.' : `Nenhum visitante ${grupo === 'todos' ? 'cadastrado ainda' : 'nesta etapa'}.`}
          </div>
        ) : (
          lista.map((v) => {
            const acao = proximaAcao(s, v)
            const dias = diasDesde(ultimaRespostaOuCadastro(s, v))
            const mostraDias = ['em_contato', 'aguardando_resposta', 'em_espera'].includes(v.status)
            const parado = semAtualizacao(s, v)
            const resp = semResponsavel(s, v) ? undefined : usuarioPorId(s, v.responsavelId)
            return (
              <div
                key={v.id} className="vis-linha" role="link" tabIndex={0}
                onClick={() => abrir(v)}
                onKeyDown={(e) => { if (e.key === 'Enter') abrir(v) }}
              >
                <Avatar nome={v.nome} tom={v.flagCuidado ? 'var(--danger)' : undefined} />
                <div className="vis-pessoa">
                  <b>
                    {v.nome}
                    {v.flagCuidado && <span className="painel-chip painel-chip-crit">cuidado</span>}
                    {v.flagMenorIdade && <span className="painel-chip painel-chip-warn">menor</span>}
                    {avisosPorVisitante.has(v.id) && (
                      <span className="aviso-selo" title={avisosPorVisitante.get(v.id)!.map((a) => a.titulo).join(' · ')}>
                        <IcoSino size={11} /> aviso
                      </span>
                    )}
                  </b>
                  <span>
                    {v.whatsapp}
                    {' · '}
                    {resp ? resp.nome.split(' ')[0] : <em className="vis-sem-resp">sem responsável</em>}
                  </span>
                </div>
                <div className="vis-etapa">
                  <span className="chip-etapa" style={estiloStatus(v.status)} title={rotuloStatus(v.status)}>{rotuloStatus(v.status)}</span>
                </div>
                <div className={`vis-acao ${acao.urgente ? 'painel-urgente' : ''}`}>
                  {parado && (
                    <span className="vis-parado"><IcoRelogio size={13} /> {diasSemAtualizacao(s, v)} dias sem atualização</span>
                  )}
                  {acao.titulo}
                </div>
                <div className="vis-dias">
                  {mostraDias ? (
                    <span className={dias >= 14 ? 'painel-chip painel-chip-crit' : dias >= 10 ? 'painel-chip painel-chip-warn' : 'vis-dias-n'}>
                      {dias}d
                    </span>
                  ) : <span className="vis-dias-n">—</span>}
                </div>
                <a
                  className="btn-icone whats vis-whats" href={linkWhatsApp(v.whatsapp)} target="_blank" rel="noreferrer"
                  title="WhatsApp" aria-label={`WhatsApp de ${v.nome}`}
                  onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
                ><IcoWhats /></a>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
