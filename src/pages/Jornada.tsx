import { useState } from 'react'
import { semResponsavel, useAppState, ultimaRespostaOuCadastro, usuarioPorId } from '../store'
import { diasDesde, podeTransitar } from '../machine'
import { rotuloStatus, STATUS_COR, type Status } from '../types'
import { mudarStatus } from '../actions'
import { navegar } from '../router'
import { useUsuarioAtualId, usuarioAtual, visitantesVisiveis } from '../acesso'
import { IcoAlerta, IcoSino } from '../icones'
import { useAvisos } from '../avisos'
import Avatar from '../Avatar'

// Quadro Kanban da jornada: arraste o cartão para mudar a etapa.
// Transições inválidas são bloqueadas pela máquina de estados.

const COLUNAS_FLUXO: Status[] = [
  'novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou', 'transferido', 'batismo', 'integrado',
]
const COLUNAS_EXCECAO: Status[] = ['em_espera', 'recusou', 'encerrado']

export default function Jornada() {
  const s = useAppState()
  const { porVisitante: avisosPorVisitante } = useAvisos()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const visiveis = visitantesVisiveis(s, eu)
  const [erro, setErro] = useState('')
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [mostrarExcecoes, setMostrarExcecoes] = useState(false)

  function soltar(e: React.DragEvent, destino: Status) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setArrastando(null)
    const v = visiveis.find((x) => x.id === id)
    if (!v || v.status === destino) return
    if (!podeTransitar(v.status, destino)) {
      setErro(`"${rotuloStatus(v.status)}" não pode ir direto para "${rotuloStatus(destino)}". Para corrigir um engano, abra a ficha e use "Corrigir status".`)
      return
    }
    setErro('')
    mudarStatus(v.id, destino, `Movido no quadro da jornada (${rotuloStatus(v.status)} → ${rotuloStatus(destino)})`)
  }

  const colunas = mostrarExcecoes ? [...COLUNAS_FLUXO, ...COLUNAS_EXCECAO] : COLUNAS_FLUXO
  const naoExibidos = COLUNAS_EXCECAO.reduce((n, st) => n + visiveis.filter((v) => v.status === st).length, 0)

  return (
    <div className="jornada">
      <div className="cab-detalhe">
        <div>
          <h1 className="titulo-pagina">Jornada</h1>
          <p className="subtitulo">Arraste o cartão para avançar a etapa — ou clique para abrir a ficha.</p>
        </div>
        <button type="button" className={`pilula ${mostrarExcecoes ? 'sel' : ''}`} onClick={() => setMostrarExcecoes(!mostrarExcecoes)}>
          <i className="pilula-ponto" style={{ background: STATUS_COR.em_espera }} />
          {mostrarExcecoes ? 'Ocultar exceções' : 'Mostrar exceções'}
          <span className="pilula-n">{naoExibidos}</span>
        </button>
      </div>

      {erro && <div className="alerta alerta-warn"><IcoAlerta size={16} /><div>{erro}</div></div>}

      <div className="kanban">
        {colunas.map((st) => {
          const cards = visiveis.filter((v) => v.status === st)
          return (
            <div
              key={st}
              className="kanban-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => soltar(e, st)}
            >
              <div className="kanban-cab">
                <i className="pilula-ponto" style={{ background: STATUS_COR[st] }} />
                <span className="kanban-titulo" title={rotuloStatus(st)}>{rotuloStatus(st)}</span>
                <span className="kanban-n">{cards.length}</span>
              </div>
              <div className="kanban-corpo">
                {cards.map((v) => {
                  const dias = diasDesde(ultimaRespostaOuCadastro(s, v))
                  const mostraDias = ['em_contato', 'aguardando_resposta', 'em_espera'].includes(v.status)
                  const resp = semResponsavel(s, v) ? undefined : usuarioPorId(s, v.responsavelId)
                  return (
                    <div
                      key={v.id}
                      className={`kanban-card ${arrastando === v.id ? 'arrastando' : ''}`}
                      style={{ borderLeftColor: STATUS_COR[st] }}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', v.id)
                        setArrastando(v.id)
                      }}
                      onDragEnd={() => setArrastando(null)}
                      onClick={() => navegar(`/visitante/${v.id}`)}
                    >
                      <div className="kanban-topo">
                        <Avatar nome={v.nome} tom={v.flagCuidado ? 'var(--danger)' : undefined} />
                        <div className="kanban-txt">
                          <div className="kanban-nome">{v.nome}</div>
                          <div className="kanban-info">
                            {resp ? resp.nome.split(' ')[0] : <span className="vis-sem-resp">sem responsável</span>}
                          </div>
                        </div>
                      </div>
                      {(v.flagCuidado || v.flagMenorIdade || mostraDias || avisosPorVisitante.has(v.id)) && (
                        <div className="kanban-chips">
                          {avisosPorVisitante.has(v.id) && (
                            <span className="aviso-selo" title={avisosPorVisitante.get(v.id)!.map((a) => a.titulo).join(' · ')}>
                              <IcoSino size={11} /> aviso
                            </span>
                          )}
                          {v.flagCuidado && <span className="painel-chip painel-chip-crit">cuidado</span>}
                          {v.flagMenorIdade && <span className="painel-chip painel-chip-warn">menor</span>}
                          {mostraDias && (
                            <span className={`painel-chip ${dias >= 14 ? 'painel-chip-crit' : dias >= 10 ? 'painel-chip-warn' : 'kanban-chip-neutro'}`}>
                              {dias}d sem retorno
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {cards.length === 0 && <div className="kanban-vazio">Ninguém nesta etapa</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
