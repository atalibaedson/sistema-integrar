import { useState } from 'react'
import { setEstado, useAppState } from '../../store'
import { type CultoDef } from '../../types'
import { DIA_SEMANA_LABEL, fmtDataComDia, gerarMaisOcorrencias, gerarOcorrencias } from '../../cultos'
import { SeletorData } from '../../campos'
import { toast } from '../../toast'
import { IcoMais, IcoX } from '../../icones'

/* ---------------- Aba: Cultos (padrão do cadastro de culto do louvor) ----------
   Cada culto tem nome + dia da semana + horário e uma lista de datas concretas.
   Ao cadastrar, o sistema já gera as ocorrências recentes e as próximas; a equipe
   adiciona datas avulsas e gera mais. No cadastro do visitante só aparecem as
   ocorrências da última semana — mas todas ficam guardadas aqui. */
export default function AbaCultos() {
  const defs = useAppState().config.cultosDef
  const [nome, setNome] = useState('')
  const [dia, setDia] = useState(0)
  const [horario, setHorario] = useState('10:00')

  function salvar(novos: CultoDef[]) {
    setEstado((st) => ({
      ...st,
      config: { ...st.config, cultosDef: novos, cultos: novos.map((c) => c.nome) },
    }))
  }

  function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    const n = nome.trim()
    if (!n) return
    if (defs.some((d) => d.nome === n)) {
      alert('Já existe um culto com esse nome.')
      return
    }
    salvar([...defs, { nome: n, diaSemana: dia, horario: horario || undefined, ocorrencias: gerarOcorrencias(dia) }])
    setNome('')
    setHorario('10:00')
    setDia(0)
    toast('Culto cadastrado com as datas geradas')
  }

  return (
    <div className="grid-cultos">
      <div className="card">
        <h3>📅 Cadastrar culto</h3>
        <p className="descricao-secao">
          Registre um culto fixo do calendário. O sistema já gera as datas recentes e as próximas —
          você pode adicionar datas avulsas depois.
        </p>
        <form onSubmit={cadastrar}>
          <label className="campo"><span>Nome do culto *</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Celebração de Domingo" />
          </label>
          <div className="linha-campos">
            <label className="campo"><span>Dia da semana</span>
              <select value={dia} onChange={(e) => setDia(Number(e.target.value))}>
                {DIA_SEMANA_LABEL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </label>
            <label className="campo"><span>Horário</span>
              <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </label>
          </div>
          <button className="btn w100" type="submit"><IcoMais size={15} /> Cadastrar culto</button>
        </form>
      </div>

      <div className="card">
        <h3>Cultos cadastrados</h3>
        {defs.length === 0 ? (
          <div className="vazio">Nenhum culto cadastrado ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {defs.map((c, i) => (
              <CartaoCulto
                key={i} culto={c}
                onMudar={(patch) => salvar(defs.map((d, j) => (j === i ? { ...d, ...patch } : d)))}
                onRemover={() => {
                  if (!confirm(`Remover o culto "${c.nome}"? Visitantes já cadastrados nele não são alterados.`)) return
                  salvar(defs.filter((_, j) => j !== i))
                  toast('Culto removido', 'info')
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CartaoCulto({ culto, onMudar, onRemover }: {
  culto: CultoDef
  onMudar: (patch: Partial<CultoDef>) => void
  onRemover: () => void
}) {
  const [novaData, setNovaData] = useState('')
  const hoje = new Date().toISOString().slice(0, 10)
  const ocorrencias = [...(culto.ocorrencias ?? [])].sort()

  function adicionarData() {
    if (!novaData) { toast('Selecione uma data', 'erro'); return }
    onMudar({ ocorrencias: [...new Set([...(culto.ocorrencias ?? []), novaData])].sort() })
    setNovaData('')
    toast('Data adicionada')
  }

  function removerData(d: string) {
    onMudar({ ocorrencias: (culto.ocorrencias ?? []).filter((x) => x !== d) })
  }

  function gerarMais() {
    if (culto.diaSemana === undefined) { toast('Defina o dia da semana primeiro', 'erro'); return }
    onMudar({ ocorrencias: gerarMaisOcorrencias(culto.diaSemana, culto.ocorrencias ?? [], 8) })
    toast('Mais 8 datas geradas')
  }

  return (
    <div className="culto-card">
      <div className="culto-card-cab">
        <div className="culto-avatar">📅</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="culto-nome">{culto.nome || 'Culto sem nome'}</div>
          <div className="culto-sub">
            {culto.diaSemana !== undefined ? DIA_SEMANA_LABEL[culto.diaSemana] : 'sem dia'}
            {culto.horario ? ` · ${culto.horario}` : ''}
          </div>
        </div>
        <button className="btn-icone perigo" onClick={onRemover} title="Remover culto"><IcoX size={14} /></button>
      </div>

      <div className="linha-campos" style={{ marginTop: 4 }}>
        <label className="campo"><span>Nome</span>
          <input type="text" value={culto.nome} onChange={(e) => onMudar({ nome: e.target.value })} />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Dia da semana</span>
          <select
            value={culto.diaSemana ?? ''}
            onChange={(e) => onMudar({ diaSemana: e.target.value === '' ? undefined : Number(e.target.value) })}
          >
            <option value="">— sem dia —</option>
            {DIA_SEMANA_LABEL.map((d, j) => <option key={j} value={j}>{d}</option>)}
          </select>
        </label>
        <label className="campo"><span>Horário</span>
          <input type="time" value={culto.horario ?? ''} onChange={(e) => onMudar({ horario: e.target.value || undefined })} />
        </label>
      </div>

      <div className="ac-secao-titulo" style={{ margin: '6px 0 8px' }}>Datas</div>
      {ocorrencias.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '0 0 10px' }}>Nenhuma data agendada.</p>
      ) : (
        <div className="ac-opcoes" style={{ marginBottom: 12 }}>
          {ocorrencias.map((d) => (
            <span key={d} className={`tag ${d < hoje ? 'tag-passada' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {fmtDataComDia(d)}
              <button className="btn-icone btn-icone-mini" title="Remover data" onClick={() => removerData(d)}><IcoX size={12} /></button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="campo" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
          <span>Nova data</span>
          <SeletorData value={novaData} onChange={setNovaData} />
        </div>
        <button className="btn btn-sec btn-mini" onClick={adicionarData}><IcoMais size={14} /> Adicionar</button>
        <button className="btn btn-sec btn-mini" onClick={gerarMais}>🔄 Gerar mais 8</button>
      </div>
    </div>
  )
}
