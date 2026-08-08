import { useState } from 'react'
import { useAppState } from '../../store'
import { PAPEL_LABEL, rotuloStatusPadrao, type Papel, type Status } from '../../types'
import { BotaoSalvar, SeletorData } from '../../campos'
import { toast } from '../../toast'
import { IcoMais, IcoX } from '../../icones'
import { salvarConfig, useRascunho } from './comum'

/* ---------------- Aba: Jornada (nomes das etapas + datas marcadas) ---------- */

const STATUS_DA_JORNADA: Status[] = [
  'novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider',
  'visitou', 'transferido', 'batismo', 'integrado',
]
const STATUS_DE_PAUSA: Status[] = ['em_espera', 'recusou', 'encerrado']

export default function AbaJornada() {
  const cfg = useAppState().config
  const nomes = useRascunho({
    rotulosStatus: cfg.rotulosStatus ?? {},
    rotulosPapel: cfg.rotulosPapel ?? {},
  })
  const req = useRascunho({
    mesesMinimosConexao: cfg.mesesMinimosConexao,
    frequenciaMinimaConexao: cfg.frequenciaMinimaConexao,
  })

  function renomearStatus(st: Status, nome: string) {
    nomes.set({ rotulosStatus: { ...nomes.d.rotulosStatus, [st]: nome } })
  }
  function renomearPapel(p: Papel, nome: string) {
    nomes.set({ rotulosPapel: { ...nomes.d.rotulosPapel, [p]: nome } })
  }

  const algumRenomeado =
    Object.values(nomes.d.rotulosStatus).some((x) => x?.trim()) ||
    Object.values(nomes.d.rotulosPapel).some((x) => x?.trim())

  const linhaNome = (chave: string, padrao: string, valor: string, onMudar: (v: string) => void) => (
    <label className="campo" key={chave}>
      <span>{padrao}</span>
      <input type="text" value={valor} placeholder={padrao} onChange={(e) => onMudar(e.target.value)} />
    </label>
  )

  return (
    <>
      <div className="card">
        <div className="card-cab">
          <h3>Nomes das etapas</h3>
          {algumRenomeado && (
            <button
              className="btn btn-sec btn-mini"
              onClick={() => {
                if (!confirm('Voltar todos os nomes para o padrão do sistema?')) return
                nomes.set({ rotulosStatus: {}, rotulosPapel: {} })
              }}
            >
              Restaurar padrão
            </button>
          )}
        </div>
        <p className="descricao-secao">
          Cada igreja fala do seu jeito. Troque aqui e, ao salvar, o nome muda no sistema inteiro —
          filtros, painel, relatórios e histórico. Deixe em branco para usar o padrão
          (mostrado em cinza dentro do campo).
        </p>

        <div className="ac-secao" style={{ paddingTop: 0, borderTop: 'none' }}>
          <div className="ac-secao-titulo">🗺️ O caminho do visitante</div>
          <div className="ac-grupo">
            {STATUS_DA_JORNADA.map((st) =>
              linhaNome(st, rotuloStatusPadrao(st), nomes.d.rotulosStatus[st] ?? '', (v) => renomearStatus(st, v)))}
          </div>
        </div>

        <div className="ac-secao">
          <div className="ac-secao-titulo">💤 Quando o caminho para</div>
          <div className="ac-grupo">
            {STATUS_DE_PAUSA.map((st) =>
              linhaNome(st, rotuloStatusPadrao(st), nomes.d.rotulosStatus[st] ?? '', (v) => renomearStatus(st, v)))}
          </div>
        </div>

        <div className="ac-secao">
          <div className="ac-secao-titulo">👥 Funções da equipe</div>
          <div className="ac-grupo">
            {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) =>
              linhaNome(p, PAPEL_LABEL[p], nomes.d.rotulosPapel[p] ?? '', (v) => renomearPapel(p, v)))}
          </div>
        </div>

        <BotaoSalvar pendente={nomes.pendente} onSalvar={() => { salvarConfig(nomes.d); toast('Nomes das etapas salvos') }} />
      </div>

      <ListaDatas
        titulo="💧 Datas de batismo"
        descricao="As datas em que a igreja batiza. Na ficha do visitante a equipe escolhe uma delas, em vez de digitar — menos erro na pressa."
        datas={cfg.datasBatismo}
        onMudar={(datasBatismo) => { salvarConfig({ datasBatismo }); toast('Datas de batismo salvas') }}
      />

      <ListaDatas
        titulo="🎉 Datas de recepção de membros"
        descricao="Os dias em que a igreja recebe novos membros. É a data que conclui a jornada do visitante."
        datas={cfg.datasMembresia}
        onMudar={(datasMembresia) => { salvarConfig({ datasMembresia }); toast('Datas de recepção salvas') }}
      />

      <div className="card">
        <h3>✅ Requisitos para receber como membro</h3>
        <p className="descricao-secao">
          Antes de concluir a jornada, o líder de {cfg.termoGrupo || 'Conexão'} confirma que a pessoa
          já frequenta o grupo há tempo suficiente e com boa presença. Deixe em <b>0</b> para não exigir aquele item.
        </p>
        <div className="linha-campos">
          <label className="campo" style={{ maxWidth: 300 }}>
            <span>Tempo mínimo na {cfg.termoGrupo || 'Conexão'} (meses)</span>
            <input
              type="number" min={0} max={36} value={req.d.mesesMinimosConexao}
              onChange={(e) => req.set({ mesesMinimosConexao: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
          </label>
          <label className="campo" style={{ maxWidth: 300 }}>
            <span>Frequência mínima esperada (%)</span>
            <input
              type="number" min={0} max={100} value={req.d.frequenciaMinimaConexao}
              onChange={(e) => req.set({ frequenciaMinimaConexao: Math.min(100, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}
            />
          </label>
        </div>
        <BotaoSalvar pendente={req.pendente} onSalvar={() => { salvarConfig(req.d); toast('Requisitos salvos') }} />
      </div>
    </>
  )
}

// Calendário simples de datas marcadas (batismo / recepção de membros)
function ListaDatas({ titulo, descricao, datas, onMudar }: {
  titulo: string
  descricao: string
  datas: string[]
  onMudar: (datas: string[]) => void
}) {
  const [nova, setNova] = useState('')
  const hoje = new Date().toISOString().slice(0, 10)
  const ordenadas = [...new Set(datas)].filter(Boolean).sort()

  function adicionar() {
    if (!nova) return
    onMudar([...new Set([...datas, nova])].sort())
    setNova('')
  }

  return (
    <div className="card">
      <h3>{titulo}</h3>
      <p className="descricao-secao">{descricao}</p>

      {ordenadas.length === 0 ? (
        <div className="alerta alerta-info" style={{ marginBottom: 12 }}>
          💡 <div>
            Nenhuma data cadastrada ainda — enquanto isso, a equipe digita a data à mão na ficha.
            Cadastrando aqui, ela passa a escolher numa lista.
          </div>
        </div>
      ) : (
        <div className="ac-opcoes" style={{ marginBottom: 14 }}>
          {ordenadas.map((d) => (
            <span key={d} className={`tag ${d < hoje ? 'tag-passada' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {d.split('-').reverse().join('/')}
              {d < hoje && <em style={{ fontStyle: 'normal', color: 'var(--text-3)' }}>· já passou</em>}
              <button
                className="btn-icone btn-icone-mini" title="Remover esta data"
                onClick={() => onMudar(datas.filter((x) => x !== d))}
              >
                <IcoX size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="campo" style={{ marginBottom: 0, maxWidth: 200 }}>
          <span>Nova data</span>
          <SeletorData value={nova} onChange={setNova} />
        </div>
        <button className="btn" onClick={adicionar} disabled={!nova}><IcoMais size={15} /> Adicionar</button>
      </div>
    </div>
  )
}
