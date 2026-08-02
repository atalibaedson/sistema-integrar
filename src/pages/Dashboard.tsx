import { useEffect, useRef, useState } from 'react'
import { semAtualizacao, useAppState, ultimaRespostaOuCadastro } from '../store'
import { diasDesde } from '../machine'
import { estiloStatus, rotuloStatus, STATUS_COR, type Status } from '../types'
import { aplicarTemplate, linkWhatsApp, proximaAcao } from '../actions'
import { navegar } from '../router'
import { podeVerCuidado, useUsuarioAtualId, usuarioAtual, visitantesVisiveis } from '../acesso'
import { funil } from '../relatorios'
import { IcoUsuarios, IcoWhats, IcoUserCheck, IcoJornada } from '../icones'

// Ordem de exibição da barra empilhada de status (do início do fluxo ao fim)
const ORDEM_STATUS: Status[] = [
  'novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou',
  'transferido', 'batismo', 'integrado', 'em_espera', 'recusou', 'encerrado',
]

// Por onde os visitantes chegam: termômetro dos canais de divulgação
function CardComoConheceu({ vs }: { vs: import('../types').Visitante[] }) {
  const total = vs.length
  const contagem = new Map<string, number>()
  let naoInformado = 0
  for (const v of vs) {
    if (v.comoConheceu) contagem.set(v.comoConheceu, (contagem.get(v.comoConheceu) ?? 0) + 1)
    else naoInformado++
  }
  const linhas = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  const maior = linhas[0]?.[1] ?? 0

  return (
    <div className="card">
      <h3>📣 Como conheceram a igreja</h3>
      {linhas.length === 0 ? (
        <div className="vazio" style={{ padding: 20 }}>
          O campo "Como conheceu?" do cadastro alimenta este relatório.
        </div>
      ) : (
        <div className="rel-barlist">
          {linhas.slice(0, 6).map(([canal, n]) => {
            const pct = total ? Math.round((n / total) * 100) : 0
            return (
              <div className="rel-bar-row" key={canal}>
                <div className="rel-bar-rotulo" title={canal}>{canal}</div>
                <div className="rel-bar-trilho">
                  <div className="rel-bar-fill" style={{ width: `${Math.max((n / maior) * 100, 3)}%` }} />
                </div>
                <div className="rel-bar-num">{n} <span className="rel-bar-pct">· {pct}%</span></div>
              </div>
            )
          })}
          {naoInformado > 0 && (
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0' }}>
              {naoInformado} sem essa informação.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Blocos do painel que a pessoa pode reordenar arrastando. A ordem fica salva
// neste navegador (por usuário não precisa: é preferência de visualização).
const BLOCOS_PADRAO = ['kpis', 'status', 'funil', 'canais', 'acoes'] as const
type BlocoId = typeof BLOCOS_PADRAO[number]
const ORDEM_KEY = 'ife-dash-ordem-v1'

function carregarOrdem(): BlocoId[] {
  try {
    const raw = localStorage.getItem(ORDEM_KEY)
    if (raw) {
      const arr = (JSON.parse(raw) as string[]).filter((x): x is BlocoId => (BLOCOS_PADRAO as readonly string[]).includes(x))
      const faltando = BLOCOS_PADRAO.filter((x) => !arr.includes(x))
      return [...arr, ...faltando]
    }
  } catch { /* preferência corrompida: usa o padrão */ }
  return [...BLOCOS_PADRAO]
}

// Um quadro do painel, com alça (⠿) para arrastar e reordenar
function BlocoArrastavel({ id, arrastando, onIniciar, onEntrar, onFim, children }: {
  id: BlocoId
  arrastando: BlocoId | null
  onIniciar: (id: BlocoId) => void
  onEntrar: (id: BlocoId) => void
  onFim: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={`dash-bloco ${arrastando === id ? 'arrastando' : ''} ${arrastando && arrastando !== id ? 'alvo' : ''}`}
      onDragOver={(e) => { e.preventDefault(); onEntrar(id) }}
      onDrop={(e) => e.preventDefault()}
    >
      <button
        type="button" className="dash-bloco-alca" title="Arraste para reordenar" aria-label="Arraste para reordenar"
        draggable
        onDragStart={(e) => {
          if (ref.current) e.dataTransfer.setDragImage(ref.current, 24, 18)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', id)
          onIniciar(id)
        }}
        onDragEnd={onFim}
      >⠿</button>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const vs = visitantesVisiveis(s, eu) // só o que a identidade atual pode ver

  const porStatus = (st: Status) => vs.filter((v) => v.status === st).length
  const emAcompanhamento = porStatus('novo') + porStatus('em_contato') + porStatus('aguardando_resposta')
  const comLider = porStatus('encaminhado_lider') + porStatus('visitou')
  const integrados = porStatus('integrado')
  const taxaIntegracao = vs.length ? Math.round((integrados / vs.length) * 100) : 0

  // Alertas (seção 13) — cuidado respeita a restrição extra do pastor/responsável
  const cuidado = vs.filter((v) => v.flagCuidado && podeVerCuidado(s, eu, v))
  const semResponsavel = vs.filter(
    (v) => !v.responsavelId && !['encerrado', 'recusou', 'integrado', 'batismo', 'transferido'].includes(v.status),
  )
  const transferenciaPendente = vs.filter((v) => v.status === 'visitou' && !v.transferenciaConfirmada)
  const semAtualizar = vs.filter((v) => semAtualizacao(s, v))

  // Ações de hoje: visitantes ativos ordenados por urgência
  const ativos = vs
    .filter((v) => ['novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou'].includes(v.status) || v.flagCuidado)
    .map((v) => ({ v, acao: proximaAcao(s, v), dias: diasDesde(ultimaRespostaOuCadastro(s, v)) }))
    .sort((a, b) => Number(b.acao.urgente ?? false) - Number(a.acao.urgente ?? false) || b.dias - a.dias)

  // Ordem dos quadros (arrastável) — salva neste navegador
  const [ordem, setOrdem] = useState<BlocoId[]>(carregarOrdem)
  const [arrastando, setArrastando] = useState<BlocoId | null>(null)
  useEffect(() => { localStorage.setItem(ORDEM_KEY, JSON.stringify(ordem)) }, [ordem])

  function aoEntrar(alvo: BlocoId) {
    setArrastando((atual) => {
      if (!atual || atual === alvo) return atual
      setOrdem((prev) => {
        const nova = prev.filter((x) => x !== atual)
        nova.splice(nova.indexOf(alvo), 0, atual)
        return nova
      })
      return atual
    })
  }

  const etapasFunil = funil(vs)
  const totalStack = vs.length || 1
  const segmentos = ORDEM_STATUS.map((st) => ({ st, n: porStatus(st) })).filter((x) => x.n > 0)

  const kpis = [
    { rotulo: 'Total cadastrados', valor: vs.length, cor: '#6366f1', icone: <IcoUsuarios size={15} />, nota: 'visitantes na sua visão' },
    { rotulo: 'Em acompanhamento', valor: emAcompanhamento, cor: '#0ea5e9', icone: <IcoWhats size={15} />, nota: 'na semana de consolidação' },
    { rotulo: 'Com o líder', valor: comLider, cor: '#8b5cf6', icone: <IcoUserCheck size={15} />, nota: 'encaminhados ou visitando' },
    { rotulo: 'Em espera', valor: porStatus('em_espera'), cor: '#94a3b8', icone: <IcoJornada size={15} />, nota: 'silêncio prolongado' },
    { rotulo: 'Membros', valor: integrados, cor: '#22c55e', icone: <IcoUserCheck size={15} />, nota: `${taxaIntegracao}% de conversão` },
  ]

  // Conteúdo de cada quadro reordenável. `null` = quadro sem conteúdo (não aparece).
  const conteudo: Record<BlocoId, React.ReactNode> = {
    kpis: (
      <div className="dash-kpis">
        {kpis.map((k) => (
          <div className="dash-kpi" key={k.rotulo}>
            <div className="dash-kpi-top">
              <span className="dash-kpi-icone" style={{ background: k.cor }}>{k.icone}</span>
              {k.rotulo}
            </div>
            <div className="dash-kpi-valor" style={{ color: k.cor }}>{k.valor}</div>
            <div className="dash-kpi-nota">{k.nota}</div>
          </div>
        ))}
      </div>
    ),
    status: vs.length > 0 ? (
      <div className="card">
        <h3>Distribuição por status</h3>
        <div className="dash-stack">
          {segmentos.map(({ st, n }) => (
            <div
              key={st}
              className="dash-stack-seg"
              style={{ width: `${(n / totalStack) * 100}%`, background: STATUS_COR[st] }}
            >
              <span className="dash-stack-tip">
                {rotuloStatus(st)} · <b>{Math.round((n / totalStack) * 100)}%</b>
              </span>
            </div>
          ))}
        </div>
        <div className="dash-stack-legenda">
          {segmentos.map(({ st, n }) => (
            <span key={st}><i style={{ background: STATUS_COR[st] }} />{rotuloStatus(st)} <b>{n}</b></span>
          ))}
        </div>
      </div>
    ) : null,
    funil: (
      <div className="card">
        <h3>Funil de consolidação</h3>
        {vs.length === 0 ? (
          <div className="vazio">Nenhum visitante ainda. Cadastre em <a href="#/novo">Novo visitante</a>.</div>
        ) : (
          <div className="rel-barlist">
            {etapasFunil.map((e) => (
              <div className="rel-bar-row" key={e.chave}>
                <div className="rel-bar-rotulo" title={e.rotulo}>{e.rotulo}</div>
                <div className="rel-bar-trilho">
                  <div className="rel-bar-fill" style={{ width: `${Math.max(e.taxaDoTopo, 3)}%`, background: e.cor }} />
                </div>
                <div className="rel-bar-num">{e.total} <span className="rel-bar-pct">· {e.taxaDoTopo}%</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    canais: <CardComoConheceu vs={vs} />,
    acoes: (
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 18px 0' }}><h3 style={{ marginBottom: 0 }}>✅ Ações de hoje ({ativos.length})</h3></div>
        {ativos.length === 0 ? (
          <div className="vazio">Nenhuma ação pendente. 🎉</div>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Visitante</th><th>Status</th><th>O que fazer</th><th></th></tr></thead>
              <tbody>
                {ativos.slice(0, 12).map(({ v, acao }) => {
                  const template = acao.gatilhoTemplate ? s.templates.find((t) => t.gatilho === acao.gatilhoTemplate) : undefined
                  return (
                    <tr key={v.id}>
                      <td className="clicavel cell-title" onClick={() => navegar(`/visitante/${v.id}`)}>
                        {v.nome}{v.flagCuidado && ' 🚨'}
                      </td>
                      <td><span className="badge" style={estiloStatus(v.status)}>{rotuloStatus(v.status)}</span></td>
                      <td style={{ fontSize: 13 }}>{acao.urgente ? <b>{acao.titulo}</b> : acao.titulo}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {template && (
                          <a
                            className="btn btn-whats btn-mini"
                            href={linkWhatsApp(v.whatsapp, aplicarTemplate(template.texto, v, s))}
                            target="_blank" rel="noreferrer"
                            style={{ marginRight: 6 }}
                          >💬 Enviar</a>
                        )}
                        <button className="btn btn-sec btn-mini" onClick={() => navegar(`/visitante/${v.id}`)}>Abrir</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    ),
  }

  return (
    <div>
      <div className="dash-cab">
        <div>
          <h1 className="titulo-pagina">Painel da Consolidação</h1>
          <p className="subtitulo" style={{ marginBottom: 0 }}>Visão geral da jornada — do primeiro contato à integração.</p>
        </div>
        <div className="dash-dica-arrastar">⠿ Arraste os quadros pela alça para reorganizar</div>
      </div>

      <div style={{ height: 16 }} />

      {(cuidado.length > 0 || semResponsavel.length > 0 || transferenciaPendente.length > 0 || semAtualizar.length > 0) && (
        <div className="dash-alertas">
          {cuidado.length > 0 && (
            <div className="alerta alerta-perigo">
              🚨 <div><b>Cuidado/Crise ativo:</b> {cuidado.map((v) => v.nome).join(', ')} — acione a liderança/pastor.</div>
            </div>
          )}
          {semResponsavel.length > 0 && (
            <div className="alerta alerta-warn">
              ⚠️ <div><b>Sem responsável:</b> {semResponsavel.map((v) => v.nome).join(', ')} — atribua um consolidador na ficha.</div>
            </div>
          )}
          {transferenciaPendente.length > 0 && (
            <div className="alerta alerta-warn">
              ⏳ <div><b>Aguardando confirmação do líder:</b> {transferenciaPendente.map((v) => v.nome).join(', ')}.</div>
            </div>
          )}
          {semAtualizar.length > 0 && (
            <div className="alerta alerta-warn">
              🕐 <div>
                <b>Sem atualização há 7+ dias:</b> {semAtualizar.map((v) => v.nome).join(', ')} —{' '}
                <a href="#/visitantes" style={{ color: 'inherit', fontWeight: 700 }}>ver na lista</a>.
              </div>
            </div>
          )}
        </div>
      )}

      <div className="dash-blocos">
        {ordem.map((id) => conteudo[id] && (
          <BlocoArrastavel
            key={id} id={id} arrastando={arrastando}
            onIniciar={setArrastando} onEntrar={aoEntrar} onFim={() => setArrastando(null)}
          >
            {conteudo[id]}
          </BlocoArrastavel>
        ))}
      </div>
    </div>
  )
}
