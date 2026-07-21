import { useMemo, useState } from 'react'
import { useAppState } from '../store'
import { useUsuarioAtualId, usuarioAtual, visitantesVisiveis } from '../acesso'
import { estiloStatus, ORIGEM_LABEL, SITUACAO_CIVIL_LABEL, STATUS_LABEL, type Status } from '../types'
import { IcoDownload, IcoImpressora } from '../icones'
import {
  atividadePorDia, desempenhoConexoes, desempenhoEquipe, distribuicao, engajamento,
  funil, interacoesDoPeriodo, velocidade, visitantesDoPeriodo, type Fatia, type Periodo,
} from '../relatorios'

// Área de relatórios de gestão — restrita a Gestão Integração e Pastores
// (bloqueio central em acesso.ts / App.tsx). Vários "ângulos" de análise num só
// lugar: funil, origem, equipe, conexões, engajamento, perfil e retenção.

type Aba = 'visao' | 'origem' | 'equipe' | 'conexoes' | 'engajamento' | 'perfil' | 'retencao'

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'visao', rotulo: 'Visão geral' },
  { chave: 'origem', rotulo: 'Origem & canais' },
  { chave: 'equipe', rotulo: 'Equipe' },
  { chave: 'conexoes', rotulo: 'Conexões' },
  { chave: 'engajamento', rotulo: 'Engajamento' },
  { chave: 'perfil', rotulo: 'Perfil dos visitantes' },
  { chave: 'retencao', rotulo: 'Retenção & perdas' },
]

// Presets de período rápido
function hojeISO() { return new Date().toISOString().slice(0, 10) }
function diasAtrasISO(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}

// ---- Componentes visuais reutilizáveis ----

function Stat({ valor, rotulo, cor, sufixo }: { valor: number | string | null; rotulo: string; cor?: string; sufixo?: string }) {
  return (
    <div className="rel-stat">
      <div className="rel-stat-valor" style={cor ? { color: cor } : undefined}>
        {valor == null ? '—' : valor}{valor != null && sufixo ? <span className="rel-stat-sufixo">{sufixo}</span> : null}
      </div>
      <div className="rel-stat-rotulo">{rotulo}</div>
    </div>
  )
}

function BarList({ fatias, corPadrao }: { fatias: Fatia[]; corPadrao?: string }) {
  const maior = Math.max(1, ...fatias.map((f) => f.valor))
  if (fatias.length === 0) return <div className="vazio">Sem dados no período.</div>
  return (
    <div className="rel-barlist">
      {fatias.map((f) => (
        <div className="rel-bar-row" key={f.rotulo}>
          <div className="rel-bar-rotulo" title={f.rotulo}>{f.rotulo}</div>
          <div className="rel-bar-trilho">
            <div className="rel-bar-fill" style={{ width: `${Math.max((f.valor / maior) * 100, 3)}%`, background: f.cor || corPadrao || 'var(--primary)' }} />
          </div>
          <div className="rel-bar-num">{f.valor} <span className="rel-bar-pct">· {f.pct}%</span></div>
        </div>
      ))}
    </div>
  )
}

export default function Relatorios() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const [aba, setAba] = useState<Aba>('visao')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [presetAtivo, setPresetAtivo] = useState<'tudo' | '30' | '90' | '365' | 'custom'>('tudo')

  const periodo: Periodo = { de, ate }

  function aplicarPreset(p: 'tudo' | '30' | '90' | '365') {
    setPresetAtivo(p)
    if (p === 'tudo') { setDe(''); setAte('') }
    else { setDe(diasAtrasISO(Number(p))); setAte(hojeISO()) }
  }

  // Base: só o que a identidade atual pode ver (gestão/pastor = tudo)
  const visiveis = useMemo(() => visitantesVisiveis(s, eu), [s, eu])
  const idsVisiveis = useMemo(() => new Set(visiveis.map((v) => v.id)), [visiveis])
  const interacoesVisiveis = useMemo(
    () => s.interacoes.filter((i) => idsVisiveis.has(i.visitanteId)),
    [s.interacoes, idsVisiveis],
  )

  const vs = useMemo(() => visitantesDoPeriodo(visiveis, periodo), [visiveis, de, ate])
  const is = useMemo(() => interacoesDoPeriodo(interacoesVisiveis, periodo), [interacoesVisiveis, de, ate])

  const temPeriodo = !!(de || ate)
  const rotuloPeriodo = temPeriodo
    ? `${de ? de.split('-').reverse().join('/') : 'início'} — ${ate ? ate.split('-').reverse().join('/') : 'hoje'}`
    : 'todo o período'

  function exportarCSV() {
    const linhas: string[][] = [['Nome', 'Status', 'Origem', 'Como conheceu', 'Conexão', 'Responsável', 'Cadastro']]
    const nome = (id?: string) => s.usuarios.find((u) => u.id === id)?.nome ?? ''
    const conexao = (id?: string) => s.conexoes.find((c) => c.id === id)?.nome ?? ''
    for (const v of vs) {
      linhas.push([
        v.nome, STATUS_LABEL[v.status], ORIGEM_LABEL[v.origem], v.comoConheceu ?? '',
        conexao(v.conexaoId), nome(v.responsavelId), v.dataCadastro.slice(0, 10),
      ])
    }
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `relatorio-visitantes-${hojeISO()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="rel-pagina">
      <div className="cab-detalhe" style={{ marginBottom: 6 }}>
        <div>
          <h1 className="titulo-pagina">Relatórios de gestão</h1>
          <p className="subtitulo" style={{ marginBottom: 0 }}>
            Analise a consolidação por diferentes ângulos — {rotuloPeriodo}.
          </p>
        </div>
        <div className="rel-acoes-topo">
          <button className="btn btn-sec btn-mini" onClick={exportarCSV}><IcoDownload size={14} /> Exportar CSV</button>
          <button className="btn btn-sec btn-mini" onClick={() => window.print()}><IcoImpressora size={14} /> Imprimir</button>
        </div>
      </div>

      {/* Filtro de período */}
      <div className="rel-periodo">
        <div className="filtros" style={{ marginBottom: 0 }}>
          {([['tudo', 'Tudo'], ['30', '30 dias'], ['90', '90 dias'], ['365', '12 meses']] as const).map(([p, r]) => (
            <button key={p} className={`chip ${presetAtivo === p ? 'sel' : ''}`} onClick={() => aplicarPreset(p)}>{r}</button>
          ))}
        </div>
        <div className="rel-periodo-datas">
          <label className="aud-periodo">De <input type="date" value={de} max={ate || undefined} onChange={(e) => { setDe(e.target.value); setPresetAtivo('custom') }} /></label>
          <label className="aud-periodo">Até <input type="date" value={ate} min={de || undefined} onChange={(e) => { setAte(e.target.value); setPresetAtivo('custom') }} /></label>
        </div>
      </div>

      {/* Seletor de relatório */}
      <div className="abas rel-abas">
        {ABAS.map((a) => (
          <button key={a.chave} className={`aba ${aba === a.chave ? 'ativa' : ''}`} onClick={() => setAba(a.chave)}>{a.rotulo}</button>
        ))}
      </div>

      {vs.length === 0 ? (
        <div className="card"><div className="vazio">Nenhum visitante cadastrado {temPeriodo ? 'neste período' : 'ainda'}.</div></div>
      ) : (
        <>
          {aba === 'visao' && <AbaVisao vs={vs} is={is} />}
          {aba === 'origem' && <AbaOrigem vs={vs} />}
          {aba === 'equipe' && <AbaEquipe s={s} vs={vs} is={is} />}
          {aba === 'conexoes' && <AbaConexoes s={s} vs={vs} />}
          {aba === 'engajamento' && <AbaEngajamento is={is} />}
          {aba === 'perfil' && <AbaPerfil vs={vs} />}
          {aba === 'retencao' && <AbaRetencao vs={vs} />}
        </>
      )}
    </div>
  )
}

// ======================= ABAS =======================

function AbaVisao({ vs, is }: { vs: import('../types').Visitante[]; is: import('../types').Interacao[] }) {
  const etapas = funil(vs)
  const vel = velocidade(vs)
  const integrados = etapas.find((e) => e.chave === 'integrado')?.total ?? 0
  const taxaGeral = vs.length ? Math.round((integrados / vs.length) * 100) : 0
  const atividade = atividadePorDia(vs, is, 14)
  const maxAtiv = Math.max(1, ...atividade.map((d) => Math.max(d.cadastros, d.interacoes)))

  return (
    <>
      <div className="rel-stats">
        <Stat valor={vs.length} rotulo="Visitantes no período" />
        <Stat valor={taxaGeral} sufixo="%" rotulo="Taxa de integração" cor="var(--ok)" />
        <Stat valor={integrados} rotulo="Integrados" cor="var(--ok)" />
        <Stat valor={vel.ateIntegracao} sufixo=" dias" rotulo="Tempo médio até integrar" />
        <Stat valor={vel.ateEncaminhado} sufixo=" dias" rotulo="Tempo médio até o líder" />
      </div>

      <div className="card">
        <h3>Funil de conversão</h3>
        <div className="rel-funil">
          {etapas.map((e, i) => (
            <div className="rel-funil-linha" key={e.chave}>
              <div className="rel-funil-rotulo">{e.rotulo}</div>
              <div className="rel-funil-barra-area">
                <div className="rel-funil-barra" style={{ width: `${Math.max(e.taxaDoTopo, 3)}%`, background: e.cor }}>
                  <b>{e.total}</b>
                </div>
                <span className="rel-funil-tag">{e.taxaDoTopo}% do topo{i > 0 && <> · <b>{e.taxaDaAnterior}%</b> da etapa anterior</>}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Atividade — últimos 14 dias</h3>
        <div className="rel-chart">
          {atividade.map((d) => (
            <div className="rel-chart-col" key={d.dia} title={`${d.rotulo}: ${d.cadastros} cadastro(s), ${d.interacoes} contato(s)`}>
              <div className="rel-chart-bars">
                <div className="rel-chart-bar" style={{ height: `${(d.cadastros / maxAtiv) * 100}%`, background: 'var(--primary)' }} />
                <div className="rel-chart-bar" style={{ height: `${(d.interacoes / maxAtiv) * 100}%`, background: '#0ea5e9' }} />
              </div>
              <div className="rel-chart-x">{d.rotulo}</div>
            </div>
          ))}
        </div>
        <div className="rel-legenda">
          <span><i style={{ background: 'var(--primary)' }} /> Cadastros</span>
          <span><i style={{ background: '#0ea5e9' }} /> Contatos registrados</span>
        </div>
      </div>
    </>
  )
}

function AbaOrigem({ vs }: { vs: import('../types').Visitante[] }) {
  const porOrigem = distribuicao(vs, (v) => ORIGEM_LABEL[v.origem])
  const porCanal = distribuicao(vs, (v) => v.comoConheceu)
  const porCulto = distribuicao(vs, (v) => v.cultoPrimeiraVisita)
  return (
    <div className="rel-2col">
      <div className="card"><h3>📣 Como conheceram a igreja</h3><BarList fatias={porCanal} /></div>
      <div className="card"><h3>Porta de entrada</h3><BarList fatias={porOrigem} corPadrao="#8b5cf6" /></div>
      <div className="card"><h3>⛪ Culto da primeira visita</h3><BarList fatias={porCulto} corPadrao="#14b8a6" /></div>
    </div>
  )
}

function AbaEquipe({ s, vs, is }: { s: import('../types').AppState; vs: import('../types').Visitante[]; is: import('../types').Interacao[] }) {
  const linhas = desempenhoEquipe(s, vs, is)
  if (linhas.length === 0) return <div className="card"><div className="vazio">Sem visitantes atribuídos a integradores no período.</div></div>
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Integrador(a)</th><th>Sob cuidado</th><th>Em andamento</th><th>Integrados</th><th>Perdidos</th><th>Taxa integração</th><th>Contatos</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.usuario.id}>
                <td className="cell-title">{l.usuario.nome}</td>
                <td>{l.total}</td>
                <td>{l.emAndamento}</td>
                <td style={{ color: 'var(--ok)', fontWeight: 700 }}>{l.integrados}</td>
                <td style={{ color: 'var(--text-2)' }}>{l.perdidos}</td>
                <td><div className="rel-mini-barra"><span style={{ width: `${l.taxaIntegracao}%` }} /></div>{l.taxaIntegracao}%</td>
                <td>{l.interacoes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AbaConexoes({ s, vs }: { s: import('../types').AppState; vs: import('../types').Visitante[] }) {
  const linhas = desempenhoConexoes(s, vs)
  if (linhas.length === 0) return <div className="card"><div className="vazio">Nenhum visitante encaminhado a Conexões no período.</div></div>
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Conexão</th><th>Líder</th><th>Encaminhados</th><th>Visitaram</th><th>Integrados</th><th>Taxa de visita</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td className="cell-title">{l.nome}</td>
                <td className="cell-sub">{l.liderNome}</td>
                <td>{l.encaminhados}</td>
                <td>{l.visitaram}</td>
                <td style={{ color: 'var(--ok)', fontWeight: 700 }}>{l.integrados}</td>
                <td><div className="rel-mini-barra"><span style={{ width: `${l.taxaVisita}%`, background: '#14b8a6' }} /></div>{l.taxaVisita}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AbaEngajamento({ is }: { is: import('../types').Interacao[] }) {
  const e = engajamento(is)
  return (
    <>
      <div className="rel-stats">
        <Stat valor={e.total} rotulo="Contatos registrados" />
        <Stat valor={e.responderam} rotulo="Com resposta" cor="#0ea5e9" />
        <Stat valor={e.taxaResposta} sufixo="%" rotulo="Taxa de resposta" cor="var(--ok)" />
      </div>
      <div className="rel-2col">
        <div className="card"><h3>Grau de abertura</h3><BarList fatias={e.porGrau} /></div>
        <div className="card"><h3>Tipo de contato</h3><BarList fatias={e.porTipo} corPadrao="#8b5cf6" /></div>
      </div>
    </>
  )
}

function AbaPerfil({ vs }: { vs: import('../types').Visitante[] }) {
  const porSituacao = distribuicao(vs, (v) => v.situacaoCivil ? SITUACAO_CIVIL_LABEL[v.situacaoCivil] : undefined)
  const porBairro = distribuicao(vs, (v) => v.bairro).slice(0, 10)
  const menores = vs.filter((v) => v.flagMenorIdade).length
  const outraCidade = vs.filter((v) => v.flagOutraCidade).length
  return (
    <>
      <div className="rel-stats">
        <Stat valor={vs.length} rotulo="Visitantes" />
        <Stat valor={menores} rotulo="Menores de idade" cor="#f59e0b" />
        <Stat valor={outraCidade} rotulo="De outra cidade" cor="#f59e0b" />
      </div>
      <div className="rel-2col">
        <div className="card"><h3>Situação civil</h3><BarList fatias={porSituacao} corPadrao="#8b5cf6" /></div>
        <div className="card"><h3>Bairros (top 10)</h3><BarList fatias={porBairro} corPadrao="#14b8a6" /></div>
      </div>
    </>
  )
}

function AbaRetencao({ vs }: { vs: import('../types').Visitante[] }) {
  const conta = (st: Status) => vs.filter((v) => v.status === st).length
  const emEspera = conta('em_espera')
  const recusou = conta('recusou')
  const encerrado = conta('encerrado')
  const perdidos = emEspera + recusou + encerrado
  const porStatus = distribuicao(vs, (v) => STATUS_LABEL[v.status]).map((f) => ({
    ...f,
    cor: estiloStatus((Object.keys(STATUS_LABEL) as Status[]).find((k) => STATUS_LABEL[k] === f.rotulo) ?? 'novo').color,
  }))
  return (
    <>
      <div className="rel-stats">
        <Stat valor={emEspera} rotulo="Em espera (silêncio)" cor="#94a3b8" />
        <Stat valor={recusou} rotulo="Recusaram" cor="#ef4444" />
        <Stat valor={encerrado} rotulo="Encerrados / inválidos" cor="#64748b" />
        <Stat valor={vs.length ? Math.round((perdidos / vs.length) * 100) : 0} sufixo="%" rotulo="Fora do fluxo ativo" />
      </div>
      <div className="card"><h3>Distribuição por status atual</h3><BarList fatias={porStatus} /></div>
      <p className="subtitulo" style={{ fontSize: 12.5, marginTop: 8 }}>
        "Em espera" volta ao fluxo assim que a pessoa responde; "Recusou" mantém a porta aberta para um retorno futuro.
      </p>
    </>
  )
}
