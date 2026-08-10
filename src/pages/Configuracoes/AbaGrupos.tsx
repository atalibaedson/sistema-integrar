import { useState } from 'react'
import { comExclusoes, lideres, setEstado, uid, useAppState } from '../../store'
import { type Conexao } from '../../types'
import { toast } from '../../toast'
import { IcoBusca, IcoCheck, IcoEditar, IcoLixeira, IcoMais } from '../../icones'
import { salvarConfig, semAcento, useRascunho } from './comum'

/* ---------------- Aba: Grupos ---------------- */

const DIAS_SEMANA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

function parsearDiaHorario(diaHorario: string): { dias: string[]; horario: string } {
  const partes = diaHorario.split('·')
  const diasStr = (partes[0] ?? '').trim()
  const horario = (partes[1] ?? '').trim()
  const dias = DIAS_SEMANA.filter((d) => diasStr.toLowerCase().includes(d.toLowerCase()))
  return { dias, horario }
}

function derivarDiaHorario(dias: string[], hora: string): string {
  const label = dias.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
  if (label && hora) return `${label} · ${hora}`
  return label || hora
}

export default function AbaGrupos() {
  const s = useAppState()
  const termo = s.config.termoGrupo || 'Conexão'
  const [novo, setNovo] = useState(false)
  const [busca, setBusca] = useState('')

  const nomeLider = (id?: string) => s.usuarios.find((u) => u.id === id)?.nome
  const q = semAcento(busca)
  const filtradas = s.conexoes
    .filter((c) => {
      if (!q) return true
      const alvo = semAcento(`${c.nome} ${c.endereco ?? ''} ${c.bairro ?? ''} ${c.cidade ?? ''} ${c.perfil} ${c.diaHorario} ${nomeLider(c.liderId) ?? ''} ${nomeLider(c.lider2Id) ?? ''}`)
      return alvo.includes(q)
    })
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const semLiderQtd = s.conexoes.filter((c) => !c.liderId && !c.lider2Id).length

  return (
    <>
      <ConfigSugestao />

      <div className="card">
        <div className="card-cab">
          <div>
            <h3 style={{ marginBottom: 2 }}>Grupos de {termo}</h3>
            <p className="descricao-secao" style={{ margin: 0 }}>
              Cada grupo pode ter até 2 líderes (ex.: um casal liderando junto).
            </p>
          </div>
          <button className="btn" onClick={() => setNovo(!novo)}>
            {novo ? 'Fechar' : <><IcoMais size={15} /> Novo grupo</>}
          </button>
        </div>

        <div className="grupos-resumo">
          <span><b>{s.conexoes.length}</b> {s.conexoes.length === 1 ? 'grupo' : 'grupos'}</span>
          {semLiderQtd > 0 && <span className="grupos-resumo-warn">⚠️ {semLiderQtd} sem líder</span>}
        </div>

        {novo && <FormConexao onPronto={() => setNovo(false)} />}

        {s.conexoes.length === 0 ? (
          <div className="vazio">Nenhum grupo cadastrado ainda.</div>
        ) : (
          <>
            <div className="search-box" style={{ margin: '4px 0 16px' }}>
              <span className="search-icon"><IcoBusca /></span>
              <input
                type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder={`Buscar ${termo.toLowerCase()} por nome, região, perfil ou líder…`}
              />
            </div>
            {filtradas.length === 0 ? (
              <div className="vazio">Nenhum grupo encontrado para "{busca}".</div>
            ) : (
              <div className="grade-cartoes">
                {filtradas.map((c) => <CartaoConexao key={c.id} c={c} />)}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

/* ---- Sugestão automática: palavras-chave de perfil configuráveis ---- */

function ConfigSugestao() {
  const cfg = useAppState().config
  const r = useRascunho({
    sugestaoInfantil: cfg.sugestaoInfantil ?? 'crianças, adolescentes',
    sugestaoCasais:   cfg.sugestaoCasais   ?? 'casais',
    sugestaoJovens:   cfg.sugestaoJovens   ?? 'solteiros, jovens',
    sugestaoCoringa:  cfg.sugestaoCoringa  ?? 'família',
  })

  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
        Sugestão automática de grupo
      </summary>
      <p className="descricao-secao" style={{ marginTop: 10 }}>
        Quando um visitante é cadastrado, o sistema pontua cada grupo pelo campo <b>Perfil</b> e
        sugere o mais compatível. Configure aqui quais palavras identificam cada tipo de grupo.
        Separe múltiplas opções por vírgula.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 4 }}>
        <label className="campo" style={{ marginBottom: 0 }}>
          <span>Grupo infantil / adolescente</span>
          <input
            type="text"
            value={r.d.sugestaoInfantil}
            onChange={(e) => r.set({ sugestaoInfantil: e.target.value })}
            placeholder="crianças, adolescentes"
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, display: 'block' }}>
            Exclui adultos; favorece menores de idade.
          </span>
        </label>
        <label className="campo" style={{ marginBottom: 0 }}>
          <span>Grupo de casais</span>
          <input
            type="text"
            value={r.d.sugestaoCasais}
            onChange={(e) => r.set({ sugestaoCasais: e.target.value })}
            placeholder="casais"
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, display: 'block' }}>
            Favorece visitantes casados.
          </span>
        </label>
        <label className="campo" style={{ marginBottom: 0 }}>
          <span>Grupo de jovens / solteiros</span>
          <input
            type="text"
            value={r.d.sugestaoJovens}
            onChange={(e) => r.set({ sugestaoJovens: e.target.value })}
            placeholder="solteiros, jovens"
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, display: 'block' }}>
            Favorece visitantes solteiros.
          </span>
        </label>
        <label className="campo" style={{ marginBottom: 0 }}>
          <span>Grupo coringa (acolhe qualquer perfil)</span>
          <input
            type="text"
            value={r.d.sugestaoCoringa}
            onChange={(e) => r.set({ sugestaoCoringa: e.target.value })}
            placeholder="família"
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, display: 'block' }}>
            Leve preferência quando nenhum outro grupo pontua.
          </span>
        </label>
      </div>
      <div style={{ marginTop: 14 }}>
        <button
          className="btn"
          disabled={!r.pendente}
          onClick={() => { salvarConfig(r.d); toast('Sugestão automática salva') }}
        >
          Salvar
        </button>
      </div>
    </details>
  )
}

function CamposDiaHorario({ diasSemana, horario, onDias, onHorario }: {
  diasSemana: string[]
  horario: string
  onDias: (v: string[]) => void
  onHorario: (v: string) => void
}) {
  function toggleDia(d: string) {
    onDias(diasSemana.includes(d) ? diasSemana.filter((x) => x !== d) : [...diasSemana, d])
  }
  return (
    <div>
      <div className="campo">
        <span>Dias da semana</span>
        <div className="dias-chips">
          {DIAS_SEMANA.map((d) => (
            <button
              key={d}
              type="button"
              className={`chip ${diasSemana.includes(d) ? 'sel' : ''}`}
              onClick={() => toggleDia(d)}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <label className="campo">
        <span>Horário</span>
        <input type="time" value={horario} onChange={(e) => onHorario(e.target.value)} />
      </label>
    </div>
  )
}

function CartaoConexao({ c }: { c: Conexao }) {
  const s = useAppState()
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(c.nome)
  const [endereco, setEndereco] = useState(c.endereco ?? '')
  const [bairro, setBairro] = useState(c.bairro ?? '')
  const [cidade, setCidade] = useState(c.cidade ?? '')
  const [perfil, setPerfil] = useState(c.perfil)
  const [diasSemana, setDiasSemana] = useState<string[]>(() => {
    if (c.diasSemana && c.diasSemana.length > 0) return c.diasSemana
    if (c.diaHorario) return parsearDiaHorario(c.diaHorario).dias
    return []
  })
  const [horario, setHorario] = useState(() => {
    if (c.horario) return c.horario
    if (c.diaHorario) return parsearDiaHorario(c.diaHorario).horario
    return ''
  })

  function abrirEdicao() {
    setNome(c.nome); setEndereco(c.endereco ?? ''); setBairro(c.bairro ?? '')
    setCidade(c.cidade ?? ''); setPerfil(c.perfil)
    const parsed = parsearDiaHorario(c.diaHorario ?? '')
    setDiasSemana(c.diasSemana && c.diasSemana.length > 0 ? c.diasSemana : parsed.dias)
    setHorario(c.horario ?? parsed.horario)
    setEditando(true)
  }

  function salvar() {
    if (!nome.trim()) return
    const diaHorario = derivarDiaHorario(diasSemana, horario)
    setEstado((st) => ({
      ...st,
      conexoes: st.conexoes.map((x) => x.id === c.id
        ? {
            ...x,
            nome: nome.trim(),
            endereco: endereco.trim() || undefined,
            bairro: bairro.trim() || undefined,
            cidade: cidade.trim() || undefined,
            perfil: perfil.trim(),
            diaHorario,
            diasSemana: diasSemana.length > 0 ? diasSemana : undefined,
            horario: horario || undefined,
            atualizadoEm: new Date().toISOString(),
          }
        : x),
    }))
    setEditando(false)
    toast('Grupo salvo')
  }

  function mudarLider(campo: 'liderId' | 'lider2Id', novoId: string) {
    const outroCampo = campo === 'liderId' ? 'lider2Id' : 'liderId'
    if (novoId && novoId === (c as any)[outroCampo]) {
      alert('⚠️ Essa pessoa já foi escolhida como o outro líder deste grupo.')
      return
    }
    const novoLider = s.usuarios.find((u) => u.id === novoId)
    if (novoLider?.conexaoId && novoLider.conexaoId !== c.id) {
      const outro = s.conexoes.find((x) => x.id === novoLider.conexaoId)?.nome ?? 'outro grupo'
      if (!confirm(`⚠️ ${novoLider.nome} já é líder de "${outro}".\n\nConfirmar como líder de "${c.nome}" também?`)) return
    }
    setEstado((st) => ({
      ...st,
      conexoes: st.conexoes.map((x) => x.id === c.id ? { ...x, [campo]: novoId || undefined, atualizadoEm: new Date().toISOString() } : x),
      usuarios: novoId
        ? st.usuarios.map((u) => u.id === novoId ? { ...u, conexaoId: c.id } : u)
        : st.usuarios,
    }))
    toast('Líder atualizado')
  }

  function remover() {
    if (!confirm(`Remover o grupo "${c.nome}"? Visitantes ligados a ele ficam sem grupo.`)) return
    setEstado((st) => comExclusoes({
      ...st,
      conexoes: st.conexoes.filter((x) => x.id !== c.id),
      usuarios: st.usuarios.map((u) => u.conexaoId === c.id ? { ...u, conexaoId: undefined } : u),
    }, 'conexao', [c.id]))
    toast('Grupo removido', 'info')
  }

  const opcoesLider = (excluirId?: string) => lideres(s)
    .filter((l) => l.id !== excluirId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const lider1 = s.usuarios.find((u) => u.id === c.liderId)?.nome
  const lider2 = s.usuarios.find((u) => u.id === c.lider2Id)?.nome
  const semLider = !c.liderId && !c.lider2Id
  const local = [c.endereco, [c.bairro, c.cidade].filter(Boolean).join(' · ')].filter(Boolean).join(' — ')

  if (editando) {
    return (
      <div className="grupo-card editando">
        <label className="campo"><span>Nome do grupo</span>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        <label className="campo"><span>Endereço <em className="campo-dica">(onde o grupo se reúne)</em></span>
          <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua e número" />
        </label>
        <div className="linha-campos">
          <label className="campo"><span>Bairro</span>
            <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Usado para sugerir o grupo" />
          </label>
          <label className="campo"><span>Cidade</span>
            <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </label>
        </div>
        <label className="campo"><span>Perfil</span>
          <input type="text" value={perfil} onChange={(e) => setPerfil(e.target.value)} placeholder="ex.: casais, jovens" />
        </label>
        <CamposDiaHorario
          diasSemana={diasSemana} horario={horario}
          onDias={setDiasSemana} onHorario={setHorario}
        />
        {/* Mostrar valor legado se ainda não houver estruturado */}
        {c.diaHorario && diasSemana.length === 0 && !horario && (
          <p className="descricao-secao" style={{ marginTop: 0 }}>
            Valor anterior: <b>{c.diaHorario}</b> — selecione os dias acima para substituir.
          </p>
        )}
        <div className="linha-campos">
          <label className="campo" style={{ marginBottom: 0 }}><span>Líder 1</span>
            <select value={c.liderId ?? ''} onChange={(e) => mudarLider('liderId', e.target.value)}>
              <option value="">— sem líder —</option>
              {opcoesLider(c.lider2Id).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
          <label className="campo" style={{ marginBottom: 0 }}><span>Líder 2 (opcional)</span>
            <select value={c.lider2Id ?? ''} onChange={(e) => mudarLider('lider2Id', e.target.value)}>
              <option value="">—</option>
              {opcoesLider(c.liderId).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-mini" onClick={salvar}><IcoCheck size={14} /> Salvar</button>
          <button className="btn btn-sec btn-mini" onClick={() => setEditando(false)}>Fechar</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`grupo-card ${semLider ? 'sem-lider' : ''}`}>
      <div className="grupo-card-top">
        <div className="grupo-icone">🏠</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="grupo-nome">{c.nome}</div>
          {c.perfil && <span className="grupo-tag">{c.perfil}</span>}
        </div>
        <div className="cartao-acoes">
          <button className="btn-icone" onClick={abrirEdicao} title="Editar"><IcoEditar /></button>
          <button className="btn-icone perigo" onClick={remover} title="Remover"><IcoLixeira /></button>
        </div>
      </div>
      <div className="grupo-linhas">
        <div className="grupo-linha"><span className="grupo-linha-ic">📍</span>{local || <span style={{ color: 'var(--text-3)' }}>local não informado</span>}</div>
        <div className="grupo-linha"><span className="grupo-linha-ic">🗓️</span>{c.diaHorario || <span style={{ color: 'var(--text-3)' }}>dia a definir</span>}</div>
        <div className="grupo-linha">
          <span className="grupo-linha-ic">👤</span>
          {semLider ? <span className="grupo-semlider">Sem líder definido</span> : [lider1, lider2].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
  )
}

function FormConexao({ onPronto }: { onPronto: () => void }) {
  const s = useAppState()
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [perfil, setPerfil] = useState('')
  const [diasSemana, setDiasSemana] = useState<string[]>([])
  const [horario, setHorario] = useState('')
  const [liderId, setLiderId] = useState('')
  const [lider2Id, setLider2Id] = useState('')

  const nomeNorm = semAcento(nome)
  const duplicado = nomeNorm ? s.conexoes.find((c) => semAcento(c.nome) === nomeNorm) : undefined
  const parecidos = nomeNorm.length >= 3
    ? s.conexoes.filter((c) => !duplicado && semAcento(c.nome).includes(nomeNorm))
    : []

  function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    if (duplicado) { alert(`Já existe um grupo chamado "${duplicado.nome}". Escolha outro nome.`); return }
    const id = uid()
    const diaHorario = derivarDiaHorario(diasSemana, horario)
    setEstado((st) => ({
      ...st,
      conexoes: [...st.conexoes, {
        id, nome: nome.trim(),
        endereco: endereco.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cidade: cidade.trim() || undefined,
        perfil: perfil.trim(),
        diaHorario,
        diasSemana: diasSemana.length > 0 ? diasSemana : undefined,
        horario: horario || undefined,
        liderId: liderId || undefined,
        lider2Id: lider2Id || undefined,
        atualizadoEm: new Date().toISOString(),
      }],
      usuarios: st.usuarios.map((u) => (u.id === liderId || u.id === lider2Id) ? { ...u, conexaoId: id } : u),
    }))
    toast('Grupo criado')
    onPronto()
  }

  return (
    <form className="bloco-form" onSubmit={adicionar}>
      <label className="campo"><span>Nome do grupo *</span>
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Conexão Casais Centro" autoFocus />
      </label>
      {duplicado && (
        <div className="alerta alerta-warn" style={{ marginTop: 0 }}>
          ⚠️ <div>Já existe um grupo com esse nome: <b>{duplicado.nome}</b>. Escolha outro nome.</div>
        </div>
      )}
      {!duplicado && parecidos.length > 0 && (
        <div className="alerta alerta-info" style={{ marginTop: 0 }}>
          💡 <div>Grupos parecidos já cadastrados: {parecidos.map((c) => c.nome).join(', ')}. Confira se não é o mesmo.</div>
        </div>
      )}
      <label className="campo"><span>Endereço <em className="campo-dica">(onde o grupo se reúne)</em></span>
        <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua e número" />
      </label>
      <div className="linha-campos">
        <label className="campo"><span>Bairro</span>
          <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Usado para sugerir o grupo" />
        </label>
        <label className="campo"><span>Cidade</span>
          <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </label>
      </div>
      <label className="campo"><span>Perfil</span>
        <input type="text" value={perfil} onChange={(e) => setPerfil(e.target.value)} placeholder="ex.: casais, jovens" />
      </label>
      <CamposDiaHorario
        diasSemana={diasSemana} horario={horario}
        onDias={setDiasSemana} onHorario={setHorario}
      />
      <div className="linha-campos">
        <label className="campo"><span>Líder 1</span>
          <select value={liderId} onChange={(e) => setLiderId(e.target.value)}>
            <option value="">— definir depois —</option>
            {lideres(s).filter((l) => l.id !== lider2Id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <label className="campo"><span>Líder 2 (opcional)</span>
          <select value={lider2Id} onChange={(e) => setLider2Id(e.target.value)}>
            <option value="">—</option>
            {lideres(s).filter((l) => l.id !== liderId).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="submit" disabled={!nome.trim() || !!duplicado}>Adicionar grupo</button>
        <button className="btn btn-sec" type="button" onClick={onPronto}>Cancelar</button>
      </div>
    </form>
  )
}
