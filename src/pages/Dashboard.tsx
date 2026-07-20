import { semAtualizacao, useAppState, ultimaRespostaOuCadastro } from '../store'
import { diasDesde } from '../machine'
import { estiloStatus, STATUS_LABEL, type Status } from '../types'
import { aplicarTemplate, linkWhatsApp, proximaAcao } from '../actions'
import { navegar } from '../router'
import { podeVerCuidado, useUsuarioAtualId, usuarioAtual, visitantesVisiveis } from '../acesso'

// Funil de consolidação (seção 14): cada etapa conta quem chegou ATÉ ela
const ETAPAS_FUNIL: { rotulo: string; statuses: Status[] }[] = [
  { rotulo: 'Novos (cadastrados)', statuses: ['novo', 'em_contato', 'aguardando_resposta', 'em_espera', 'encaminhado_lider', 'visitou', 'transferido', 'integrado'] },
  { rotulo: 'Em contato', statuses: ['em_contato', 'aguardando_resposta', 'em_espera', 'encaminhado_lider', 'visitou', 'transferido', 'integrado'] },
  { rotulo: 'Encaminhados ao líder', statuses: ['encaminhado_lider', 'visitou', 'transferido', 'integrado'] },
  { rotulo: 'Visitaram a Conexão', statuses: ['visitou', 'transferido', 'integrado'] },
  { rotulo: 'Transferidos', statuses: ['transferido', 'integrado'] },
  { rotulo: 'Integrados', statuses: ['integrado'] },
]

const CORES_FUNIL = ['#6366f1', '#0ea5e9', '#8b5cf6', '#14b8a6', '#10b981', '#22c55e']

// Por onde os visitantes chegam: termômetro dos canais de divulgação
function CardComoConheceu() {
  const s = useAppState()
  const total = s.visitantes.length

  const contagem = new Map<string, number>()
  let naoInformado = 0
  for (const v of s.visitantes) {
    if (v.comoConheceu) contagem.set(v.comoConheceu, (contagem.get(v.comoConheceu) ?? 0) + 1)
    else naoInformado++
  }
  const linhas = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  const maior = linhas[0]?.[1] ?? 0

  return (
    <div className="card">
      <h3>📣 Como os visitantes conheceram a igreja</h3>
      {linhas.length === 0 ? (
        <div className="vazio">
          Ainda sem respostas. O campo "Como conheceu?" do cadastro e do autocadastro alimenta este relatório.
        </div>
      ) : (
        <>
          {linhas.map(([canal, n]) => {
            const pct = total ? Math.round((n / total) * 100) : 0
            return (
              <div className="funil-etapa" key={canal}>
                <div className="funil-rotulo">{canal}</div>
                <div className="funil-barra-area">
                  <div
                    className="funil-barra"
                    style={{ width: `${Math.max((n / maior) * 100, 8)}%`, background: 'var(--primary)' }}
                  >
                    {n} ({pct}%)
                  </div>
                </div>
              </div>
            )
          })}
          {naoInformado > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
              {naoInformado} visitante(s) sem essa informação no cadastro.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default function Dashboard() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const vs = visitantesVisiveis(s, eu) // só o que a identidade atual pode ver

  const noFunil = (sts: Status[]) => vs.filter((v) => sts.includes(v.status)).length
  const total = noFunil(ETAPAS_FUNIL[0].statuses)
  const porStatus = (st: Status) => vs.filter((v) => v.status === st).length

  // Alertas (seção 13) — cuidado respeita a restrição extra do pastor/responsável
  const cuidado = vs.filter((v) => v.flagCuidado && podeVerCuidado(s, eu, v))
  const semResponsavel = vs.filter(
    (v) => !v.responsavelId && !['encerrado', 'recusou', 'integrado', 'transferido'].includes(v.status),
  )
  const transferenciaPendente = vs.filter((v) => v.status === 'visitou' && !v.transferenciaConfirmada)
  const semAtualizar = vs.filter((v) => semAtualizacao(s, v))

  // Ações de hoje: visitantes ativos ordenados por urgência
  const ativos = vs
    .filter((v) => ['novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou'].includes(v.status) || v.flagCuidado)
    .map((v) => ({ v, acao: proximaAcao(s, v), dias: diasDesde(ultimaRespostaOuCadastro(s, v)) }))
    .sort((a, b) => Number(b.acao.urgente ?? false) - Number(a.acao.urgente ?? false) || b.dias - a.dias)

  const hoje = new Date().getDay()
  const diaFluxo = hoje === 1 ? 'Segunda — Aproximação' : hoje === 3 ? 'Quarta — Conexão' : hoje === 6 ? 'Sábado — Celebração' : null

  return (
    <div>
      <h1 className="titulo-pagina">Painel da Consolidação</h1>
      <p className="subtitulo">
        Visão geral da jornada — do primeiro contato à integração.
        {diaFluxo && <> Hoje é dia de contato: <b>{diaFluxo}</b>.</>}
      </p>

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
            <b>Sem atualização há 7+ dias:</b> {semAtualizar.map((v) => v.nome).join(', ')} —
            abra a ficha e peça a atualização ao consolidador responsável.{' '}
            <a href="#/visitantes" style={{ color: 'inherit', fontWeight: 700 }}>Ver na lista</a>
          </div>
        </div>
      )}

      <div className="grid-cards">
        <div className="kpi"><div className="valor">{vs.length}</div><div className="rotulo">Total cadastrados</div></div>
        <div className="kpi"><div className="valor">{porStatus('em_contato') + porStatus('aguardando_resposta') + porStatus('novo')}</div><div className="rotulo">Em acompanhamento</div></div>
        <div className="kpi"><div className="valor">{porStatus('encaminhado_lider') + porStatus('visitou')}</div><div className="rotulo">Com o líder</div></div>
        <div className="kpi"><div className="valor">{porStatus('em_espera')}</div><div className="rotulo">Em espera</div></div>
        <div className="kpi"><div className="valor" style={{ color: 'var(--ok)' }}>{porStatus('integrado')}</div><div className="rotulo">Integrados</div></div>
      </div>

      <div className="card">
        <h3>✅ Ações de hoje ({ativos.length})</h3>
        {ativos.length === 0 ? (
          <div className="vazio">Nenhuma ação pendente. 🎉</div>
        ) : (
          <table>
            <thead><tr><th>Visitante</th><th>Status</th><th>O que fazer</th><th></th></tr></thead>
            <tbody>
              {ativos.map(({ v, acao }) => {
                const template = acao.gatilhoTemplate ? s.templates.find((t) => t.gatilho === acao.gatilhoTemplate) : undefined
                return (
                  <tr key={v.id}>
                    <td className="clicavel" onClick={() => navegar(`/visitante/${v.id}`)}>
                      <b>{v.nome}</b>{v.flagCuidado && ' 🚨'}
                    </td>
                    <td><span className="badge" style={estiloStatus(v.status)}>{STATUS_LABEL[v.status]}</span></td>
                    <td style={{ fontSize: 13 }}>{acao.urgente ? <b>{acao.titulo}</b> : acao.titulo}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {template && (
                        <a
                          className="btn btn-whats btn-mini"
                          href={linkWhatsApp(v.whatsapp, aplicarTemplate(template.texto, v.nome))}
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
        )}
      </div>

      <CardComoConheceu />

      <div className="card">
        <h3>Funil de consolidação</h3>
        {total === 0 ? (
          <div className="vazio">Nenhum visitante no funil ainda. Cadastre o primeiro em <a href="#/novo">Novo visitante</a>.</div>
        ) : (
          ETAPAS_FUNIL.map((etapa, i) => {
            const n = noFunil(etapa.statuses)
            const pct = total ? Math.max((n / total) * 100, 4) : 0
            return (
              <div className="funil-etapa" key={etapa.rotulo}>
                <div className="funil-rotulo">{etapa.rotulo}</div>
                <div className="funil-barra-area">
                  <div className="funil-barra" style={{ width: `${pct}%`, background: CORES_FUNIL[i] }}>{n}</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
