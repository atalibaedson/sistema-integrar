import { useState } from 'react'
import { useAppState, ultimaRespostaOuCadastro } from '../store'
import { diasDesde, podeTransitar } from '../machine'
import { rotuloStatus, STATUS_COR, type Status } from '../types'
import { mudarStatus } from '../actions'
import { navegar } from '../router'
import { useUsuarioAtualId, usuarioAtual, visitantesVisiveis } from '../acesso'

// Quadro Kanban da jornada: arraste o cartão para mudar a etapa.
// Transições inválidas são bloqueadas pela máquina de estados.

const COLUNAS_FLUXO: Status[] = [
  'novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou', 'transferido', 'batismo', 'integrado',
]
const COLUNAS_EXCECAO: Status[] = ['em_espera', 'recusou', 'encerrado']

export default function Jornada() {
  const s = useAppState()
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
    <div>
      <div className="cab-detalhe">
        <div>
          <h1 className="titulo-pagina">Jornada</h1>
          <p className="subtitulo">Arraste o cartão para avançar a etapa — ou clique para abrir a ficha.</p>
        </div>
        <button className="btn btn-sec" onClick={() => setMostrarExcecoes(!mostrarExcecoes)}>
          {mostrarExcecoes ? 'Ocultar exceções' : `Mostrar exceções (${naoExibidos})`}
        </button>
      </div>

      {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}

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
              <div className="kanban-cab" style={{ borderTopColor: STATUS_COR[st] }}>
                <span>{rotuloStatus(st)}</span>
                <span className="kanban-n">{cards.length}</span>
              </div>
              <div className="kanban-corpo">
                {cards.map((v) => {
                  const dias = diasDesde(ultimaRespostaOuCadastro(s, v))
                  const mostraDias = ['em_contato', 'aguardando_resposta', 'em_espera'].includes(v.status)
                  return (
                    <div
                      key={v.id}
                      className={`kanban-card ${arrastando === v.id ? 'arrastando' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', v.id)
                        setArrastando(v.id)
                      }}
                      onDragEnd={() => setArrastando(null)}
                      onClick={() => navegar(`/visitante/${v.id}`)}
                    >
                      <div className="kanban-nome">
                        {v.nome}
                        {v.flagCuidado && <span title="Cuidado/Crise"> 🚨</span>}
                        {v.flagMenorIdade && <span title="Menor de idade"> 🧒</span>}
                      </div>
                      <div className="kanban-info">
                        {v.whatsapp}
                        {mostraDias && (
                          <span className={dias >= 14 ? 'dias-critico' : dias >= 10 ? 'dias-alerta' : ''}>
                            {' '}· {dias}d sem resposta
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {cards.length === 0 && <div className="kanban-vazio">—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
