import { useRef, useState } from 'react'
import {
  ativarNuvem, comExclusoes, desligarNuvem, GATILHOS_FIXOS, getEstado, lideres, setEstado,
  substituirEstado, testarNuvem, uid, useAppState, useNuvem, zerarDados,
} from '../store'
import { getConfigNuvem } from '../nuvem'
import {
  ETAPA_LABEL, PAPEL_LABEL, rotuloStatusPadrao,
  type ConfigIgreja, type CultoDef, type EtapaFluxo, type Papel, type Status, type Template,
} from '../types'
import { DIA_SEMANA_LABEL, ocorrenciasRecentes } from '../cultos'
import { PALETAS } from '../tema'
import { registrarAuditoria } from '../auditoria'
import { IcoCheck, IcoCopiar, IcoDownload, IcoEditar, IcoImpressora, IcoLixeira, IcoMais, IcoOlho, IcoX } from '../icones'

type Aba = 'igreja' | 'jornada' | 'cultos' | 'grupos' | 'mensagens' | 'autocadastro' | 'dados'

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'igreja', rotulo: '⛪ Minha igreja' },
  { id: 'jornada', rotulo: '🗺️ Jornada' },
  { id: 'cultos', rotulo: '📅 Cultos' },
  { id: 'grupos', rotulo: '🏠 Grupos' },
  { id: 'mensagens', rotulo: '💬 Mensagens' },
  { id: 'autocadastro', rotulo: '📱 Autocadastro (QR)' },
  { id: 'dados', rotulo: '💾 Dados' },
]

export default function Configuracoes() {
  const [aba, setAba] = useState<Aba>('igreja')

  return (
    <div>
      <h1 className="titulo-pagina">Configurações</h1>
      <p className="subtitulo">Adapte o sistema à realidade da sua igreja.</p>

      <div className="abas">
        {ABAS.map((a) => (
          <button key={a.id} className={`aba ${aba === a.id ? 'ativa' : ''}`} onClick={() => setAba(a.id)}>
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'igreja' && <AbaIgreja />}
      {aba === 'jornada' && <AbaJornada />}
      {aba === 'cultos' && <AbaCultos />}
      {aba === 'grupos' && <AbaGrupos />}
      {aba === 'mensagens' && <AbaMensagens />}
      {aba === 'autocadastro' && <AbaAutocadastro />}
      {aba === 'dados' && <AbaDados />}
    </div>
  )
}

/* ---------------- Cores: as três que mandam no sistema inteiro ----------------
   Mesmo vocabulário da área de configuração do site da igreja (papel, escura,
   primária). Os tons derivados — bordas, superfícies, texto — são calculados
   sozinhos, então basta acertar estas três. */

function Cores() {
  const cfg = useAppState().config

  function mudar(patch: Partial<ConfigIgreja>) {
    setEstado((st) => ({ ...st, config: { ...st.config, ...patch } }))
  }

  const campos: { chave: 'corFundo' | 'corEscura' | 'corPrimaria'; rotulo: string; dica: string }[] = [
    { chave: 'corFundo', rotulo: 'Cor de fundo (papel)', dica: 'O fundo das telas' },
    { chave: 'corEscura', rotulo: 'Cor escura (fundos, títulos)', dica: 'Títulos e o fundo das telas públicas' },
    { chave: 'corPrimaria', rotulo: 'Cor primária (destaques, botões)', dica: 'Botões e destaques' },
  ]

  const paletaAtiva = PALETAS.find(
    (p) => p.corFundo.toLowerCase() === cfg.corFundo.toLowerCase() &&
      p.corEscura.toLowerCase() === cfg.corEscura.toLowerCase() &&
      p.corPrimaria.toLowerCase() === cfg.corPrimaria.toLowerCase(),
  )

  return (
    <div className="card">
      <h3>Cores</h3>
      <p className="descricao-secao">
        As cores do sistema inteiro. Os tons derivados (mais claros/escuros) são calculados sozinhos —
        inclusive a cor do texto em cima dos botões, para nunca ficar ilegível.
      </p>

      <div className="ac-secao" style={{ paddingTop: 0, borderTop: 'none' }}>
        <div className="ac-secao-titulo">Paletas prontas</div>
        <div className="ac-opcoes">
          {PALETAS.map((p) => (
            <button
              type="button" key={p.nome} title={p.descricao}
              className={`ac-opcao ${paletaAtiva?.nome === p.nome ? 'sel' : ''}`}
              onClick={() => mudar({ corFundo: p.corFundo, corEscura: p.corEscura, corPrimaria: p.corPrimaria })}
            >
              <span style={{ display: 'inline-flex', gap: 3, marginRight: 7, verticalAlign: '-2px' }}>
                {[p.corFundo, p.corEscura, p.corPrimaria].map((c) => (
                  <i key={c} style={{ width: 10, height: 10, borderRadius: 3, background: c, border: '1px solid rgba(0,0,0,.15)' }} />
                ))}
              </span>
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="ac-secao">
        <div className="ac-secao-titulo">Ajuste fino</div>
        {campos.map((c) => (
          <label className="campo" key={c.chave}>
            <span>{c.rotulo} <em className="campo-dica">({c.dica})</em></span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color" value={cfg[c.chave]}
                onChange={(e) => mudar({ [c.chave]: e.target.value })}
                style={{ width: 46, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
              />
              <code style={{ fontSize: 13 }}>{cfg[c.chave]}</code>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Aba: Jornada (nomes das etapas + datas marcadas) ----------
   Duas coisas que mudam de igreja para igreja e não deveriam exigir programador:
   como cada etapa se chama, e em que datas acontecem batismo e recepção de
   membros. */

// Ordem de exibição: primeiro o caminho, depois as saídas do caminho.
const STATUS_DA_JORNADA: Status[] = [
  'novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider',
  'visitou', 'transferido', 'batismo', 'integrado',
]
const STATUS_DE_PAUSA: Status[] = ['em_espera', 'recusou', 'encerrado']

function AbaJornada() {
  const cfg = useAppState().config

  function mudar(patch: Partial<ConfigIgreja>) {
    setEstado((st) => ({ ...st, config: { ...st.config, ...patch } }))
  }
  function renomearStatus(st: Status, nome: string) {
    mudar({ rotulosStatus: { ...cfg.rotulosStatus, [st]: nome } })
  }
  function renomearPapel(p: Papel, nome: string) {
    mudar({ rotulosPapel: { ...cfg.rotulosPapel, [p]: nome } })
  }

  const algumRenomeado =
    Object.values(cfg.rotulosStatus ?? {}).some((x) => x?.trim()) ||
    Object.values(cfg.rotulosPapel ?? {}).some((x) => x?.trim())

  const linhaNome = (chave: string, padrao: string, valor: string, onMudar: (v: string) => void) => (
    <label className="campo" key={chave}>
      <span>{padrao}</span>
      <input
        type="text" value={valor} placeholder={padrao}
        onChange={(e) => onMudar(e.target.value)}
      />
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
                mudar({ rotulosStatus: {}, rotulosPapel: {} })
              }}
            >
              Restaurar padrão
            </button>
          )}
        </div>
        <p className="descricao-secao">
          Cada igreja fala do seu jeito. Troque aqui e o nome muda no sistema inteiro —
          filtros, painel, relatórios e histórico. Deixe em branco para usar o padrão
          (mostrado em cinza dentro do campo).
        </p>

        <div className="ac-secao" style={{ paddingTop: 0, borderTop: 'none' }}>
          <div className="ac-secao-titulo">🗺️ O caminho do visitante</div>
          <div className="ac-grupo">
            {STATUS_DA_JORNADA.map((st) =>
              linhaNome(st, rotuloStatusPadrao(st), cfg.rotulosStatus?.[st] ?? '', (v) => renomearStatus(st, v)))}
          </div>
        </div>

        <div className="ac-secao">
          <div className="ac-secao-titulo">💤 Quando o caminho para</div>
          <div className="ac-grupo">
            {STATUS_DE_PAUSA.map((st) =>
              linhaNome(st, rotuloStatusPadrao(st), cfg.rotulosStatus?.[st] ?? '', (v) => renomearStatus(st, v)))}
          </div>
        </div>

        <div className="ac-secao">
          <div className="ac-secao-titulo">👥 Funções da equipe</div>
          <div className="ac-grupo">
            {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) =>
              linhaNome(p, PAPEL_LABEL[p], cfg.rotulosPapel?.[p] ?? '', (v) => renomearPapel(p, v)))}
          </div>
        </div>
      </div>

      <ListaDatas
        titulo="💧 Datas de batismo"
        descricao="As datas em que a igreja batiza. Na ficha do visitante a equipe escolhe uma delas, em vez de digitar — menos erro na pressa."
        datas={cfg.datasBatismo}
        onMudar={(datasBatismo) => mudar({ datasBatismo })}
      />

      <ListaDatas
        titulo="🎉 Datas de recepção de membros"
        descricao="Os dias em que a igreja recebe novos membros. É a data que conclui a jornada do visitante."
        datas={cfg.datasMembresia}
        onMudar={(datasMembresia) => mudar({ datasMembresia })}
      />

      <div className="card">
        <h3>✅ Requisitos para receber como membro</h3>
        <p className="descricao-secao">
          Antes de concluir a jornada, o líder de {cfg.termoGrupo || 'Conexão'} confirma que a pessoa
          já frequenta o grupo há tempo suficiente e com boa presença. O tempo é calculado a partir da
          data em que ela começou a frequentar; a frequência é uma confirmação do líder. Deixe em <b>0</b>
          para não exigir aquele item.
        </p>
        <div className="linha-campos">
          <label className="campo" style={{ maxWidth: 300 }}>
            <span>Tempo mínimo na {cfg.termoGrupo || 'Conexão'} (meses)</span>
            <input
              type="number" min={0} max={36} value={cfg.mesesMinimosConexao}
              onChange={(e) => mudar({ mesesMinimosConexao: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
          </label>
          <label className="campo" style={{ maxWidth: 300 }}>
            <span>Frequência mínima esperada (%)</span>
            <input
              type="number" min={0} max={100} value={cfg.frequenciaMinimaConexao}
              onChange={(e) => mudar({ frequenciaMinimaConexao: Math.min(100, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}
            />
          </label>
        </div>
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
        <label className="campo" style={{ marginBottom: 0, maxWidth: 200 }}>
          <span>Nova data</span>
          <input type="date" value={nova} onChange={(e) => setNova(e.target.value)} />
        </label>
        <button className="btn" onClick={adicionar} disabled={!nova}><IcoMais size={15} /> Adicionar</button>
      </div>
    </div>
  )
}

/* ---------------- Aba: Minha igreja ---------------- */

function AbaIgreja() {
  const s = useAppState()
  const cfg = s.config

  function mudar(patch: Partial<ConfigIgreja>) {
    setEstado((st) => ({ ...st, config: { ...st.config, ...patch } }))
  }

  return (
    <>
      <div className="card">
        <h3>Identidade</h3>
        <p className="descricao-secao">Nome e aparência que aparecem no menu, no formulário público de autocadastro e nos relatórios.</p>
        <div className="linha-campos">
          <label className="campo"><span>Nome da igreja</span>
            <input type="text" value={cfg.nomeIgreja} onChange={(e) => mudar({ nomeIgreja: e.target.value })} />
          </label>
          <label className="campo"><span>Subtítulo</span>
            <input type="text" value={cfg.subtitulo} onChange={(e) => mudar({ subtitulo: e.target.value })} />
          </label>
        </div>
        <label className="campo"><span>Como vocês chamam o grupo pequeno?</span>
          <input type="text" value={cfg.termoGrupo} onChange={(e) => mudar({ termoGrupo: e.target.value })} placeholder="Conexão, Célula, PG, GC…" />
        </label>
      </div>

      <Cores />

      <div className="card">
        <h3>Regras do fluxo</h3>
        <p className="descricao-secao">Prazos que controlam as automações do acompanhamento.</p>
        <label className="campo" style={{ maxWidth: 380 }}>
          <span>Dias sem resposta até mover para "Em espera"</span>
          <input
            type="number" min={1} max={90} value={cfg.prazoEsperaDias}
            onChange={(e) => mudar({ prazoEsperaDias: Math.max(1, Number(e.target.value) || 14) })}
          />
        </label>
      </div>

      <ListaEditavel
        titulo={'Opções de "Como conheceu a igreja?"'}
        descricao="Aparecem no cadastro manual e no autocadastro do QR code. Ótimas para medir quais canais trazem mais visitantes."
        itens={cfg.comoConheceuOpcoes}
        placeholder="ex.: Rádio local"
        onChange={(comoConheceuOpcoes) => mudar({ comoConheceuOpcoes })}
      />
    </>
  )
}

function ListaEditavel({ titulo, descricao, itens, placeholder, onChange }: {
  titulo: string
  descricao: string
  itens: string[]
  placeholder: string
  onChange: (itens: string[]) => void
}) {
  const [novo, setNovo] = useState('')
  const [editIdx, setEditIdx] = useState(-1)
  const [editTexto, setEditTexto] = useState('')

  function salvarEdicao(i: number) {
    const t = editTexto.trim()
    if (t) onChange(itens.map((x, j) => j === i ? t : x))
    setEditIdx(-1)
  }

  return (
    <div className="card">
      <h3>{titulo}</h3>
      <p className="descricao-secao">{descricao}</p>
      {itens.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          {editIdx === i ? (
            <>
              <input
                type="text" value={editTexto} autoFocus
                onChange={(e) => setEditTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') salvarEdicao(i); if (e.key === 'Escape') setEditIdx(-1) }}
                style={{ flex: 1 }}
              />
              <button className="btn-icone ok" onClick={() => salvarEdicao(i)} title="Salvar"><IcoCheck /></button>
              <button className="btn-icone" onClick={() => setEditIdx(-1)} title="Cancelar"><IcoX /></button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, background: 'var(--bg)', padding: '8px 12px', borderRadius: 8, fontSize: 13.5 }}>{item}</span>
              <button className="btn-icone" onClick={() => { setEditIdx(i); setEditTexto(item) }} title="Editar"><IcoEditar /></button>
              <button className="btn-icone perigo" onClick={() => onChange(itens.filter((_, j) => j !== i))} title="Remover"><IcoLixeira /></button>
            </>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          type="text" value={novo} placeholder={placeholder}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && novo.trim()) { onChange([...itens, novo.trim()]); setNovo('') } }}
          style={{ maxWidth: 320 }}
        />
        <button
          className="btn btn-mini"
          onClick={() => {
            if (!novo.trim()) return
            onChange([...itens, novo.trim()])
            setNovo('')
          }}
        ><IcoMais size={14} /> Adicionar</button>
      </div>
    </div>
  )
}

/* ---------------- Aba: Cultos ---------------- */

// Cadastro estruturado de cultos (nome + dia da semana + horário), no mesmo
// padrão do sistema do louvor. O dia da semana gera as datas dos últimos 7
// dias oferecidas no cadastro do visitante — aqui não é preciso agendar datas
// futuras, porque a visita registrada já aconteceu.
function AbaCultos() {
  const s = useAppState()
  const defs = s.config.cultosDef
  const [nome, setNome] = useState('')
  const [dia, setDia] = useState(0)
  const [horario, setHorario] = useState('')

  // Mantém o cadastro estruturado e a lista de rótulos sempre juntos
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
    salvar([...defs, { nome: n, diaSemana: dia, horario: horario || undefined }])
    setNome('')
    setHorario('')
  }

  function mudarCulto(i: number, patch: Partial<CultoDef>) {
    salvar(defs.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  }

  function remover(i: number) {
    if (!confirm(`Remover o culto "${defs[i].nome}"? Visitantes já cadastrados nele não são alterados.`)) return
    salvar(defs.filter((_, j) => j !== i))
  }

  return (
    <>
      <div className="card">
        <h3>📅 Cadastrar culto</h3>
        <p className="descricao-secao">
          Registre os cultos fixos do calendário. No cadastro do visitante, cada culto aparece com as
          datas em que aconteceu nos últimos 7 dias (ex.: "{defs[0]?.nome ?? 'Domingo — manhã'} · dom 12/07").
        </p>
        <form onSubmit={cadastrar}>
          <div className="linha-campos">
            <label className="campo"><span>Nome do culto *</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Celebração de Domingo" />
            </label>
            <label className="campo"><span>Dia da semana</span>
              <select value={dia} onChange={(e) => setDia(Number(e.target.value))}>
                {DIA_SEMANA_LABEL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </label>
            <label className="campo"><span>Horário (opcional)</span>
              <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </label>
          </div>
          <button className="btn" type="submit"><IcoMais size={15} /> Cadastrar culto</button>
        </form>
      </div>

      <div className="card">
        <h3>Cultos cadastrados</h3>
        {defs.length === 0 ? (
          <div className="vazio">Nenhum culto cadastrado ainda.</div>
        ) : (
          defs.map((c, i) => {
            const ultima = ocorrenciasRecentes([c])[0]
            return (
              <div key={i} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', padding: '12px 0' }}>
                <div className="linha-campos" style={{ alignItems: 'flex-end' }}>
                  <label className="campo"><span>Nome</span>
                    <input type="text" value={c.nome} onChange={(e) => mudarCulto(i, { nome: e.target.value })} />
                  </label>
                  <label className="campo" style={{ maxWidth: 180 }}><span>Dia da semana</span>
                    <select value={c.diaSemana ?? ''} onChange={(e) => mudarCulto(i, { diaSemana: e.target.value === '' ? undefined : Number(e.target.value) })}>
                      <option value="">— sem dia —</option>
                      {DIA_SEMANA_LABEL.map((d, j) => <option key={j} value={j}>{d}</option>)}
                    </select>
                  </label>
                  <label className="campo" style={{ maxWidth: 130 }}><span>Horário</span>
                    <input type="time" value={c.horario ?? ''} onChange={(e) => mudarCulto(i, { horario: e.target.value || undefined })} />
                  </label>
                  <button className="btn-icone perigo" onClick={() => remover(i)} title="Remover" style={{ marginBottom: 6 }}><IcoLixeira /></button>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '6px 0 0' }}>
                  {c.diaSemana === undefined
                    ? '⚠️ Sem dia da semana — aparece no cadastro sem sugestão de data.'
                    : ultima
                      ? <>No cadastro aparece como: <b>{ultima.rotulo}</b></>
                      : `Aparece no cadastro com as datas de ${DIA_SEMANA_LABEL[c.diaSemana].toLowerCase()} dos últimos 7 dias.`}
                </p>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

/* ---------------- Aba: Grupos ---------------- */

function AbaGrupos() {
  const s = useAppState()
  const [novo, setNovo] = useState(false)
  return (
    <div className="card">
      <div className="card-cab">
        <div>
          <h3 style={{ marginBottom: 2 }}>{s.config.termoGrupo} — grupos cadastrados</h3>
          <p className="descricao-secao" style={{ margin: 0 }}>
            O sistema sugere o grupo do visitante por proximidade (região) + situação civil (perfil).
            Cada grupo pode ter até 2 líderes (ex.: um casal liderando junto).
          </p>
        </div>
        <button className="btn" onClick={() => setNovo(!novo)}>{novo ? 'Fechar' : <><IcoMais size={15} /> Novo {s.config.termoGrupo.toLowerCase()}</>}</button>
      </div>

      {novo && <FormConexao onPronto={() => setNovo(false)} />}

      {s.conexoes.length === 0 ? (
        <div className="vazio">Nenhum grupo cadastrado ainda.</div>
      ) : (
        <div className="grade-cartoes">
          {s.conexoes.map((c) => <CartaoConexao key={c.id} c={c} />)}
        </div>
      )}
    </div>
  )
}

function nomeUsuario(s: ReturnType<typeof useAppState>, id?: string): string | undefined {
  return s.usuarios.find((u) => u.id === id)?.nome
}

function CartaoConexao({ c }: { c: import('../types').Conexao }) {
  const s = useAppState()
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(c.nome)
  const [regiao, setRegiao] = useState(c.regiao)
  const [perfil, setPerfil] = useState(c.perfil)
  const [dia, setDia] = useState(c.diaHorario)

  function abrirEdicao() {
    setNome(c.nome); setRegiao(c.regiao); setPerfil(c.perfil); setDia(c.diaHorario)
    setEditando(true)
  }

  function salvar() {
    if (!nome.trim()) return
    setEstado((st) => ({
      ...st,
      conexoes: st.conexoes.map((x) => x.id === c.id
        ? { ...x, nome: nome.trim(), regiao: regiao.trim(), perfil: perfil.trim(), diaHorario: dia.trim() }
        : x),
    }))
    setEditando(false)
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
      conexoes: st.conexoes.map((x) => x.id === c.id ? { ...x, [campo]: novoId || undefined } : x),
      usuarios: novoId
        ? st.usuarios.map((u) => u.id === novoId ? { ...u, conexaoId: c.id } : u)
        : st.usuarios,
    }))
  }

  function remover() {
    if (!confirm(`Remover o grupo "${c.nome}"? Visitantes ligados a ele ficam sem grupo.`)) return
    setEstado((st) => comExclusoes({
      ...st,
      conexoes: st.conexoes.filter((x) => x.id !== c.id),
      usuarios: st.usuarios.map((u) => u.conexaoId === c.id ? { ...u, conexaoId: undefined } : u),
    }, 'conexao', [c.id]))
  }

  const opcoesLider = (excluirId?: string) => lideres(s).filter((l) => l.id !== excluirId)

  return (
    <div className="cartao-pessoa" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editando ? (
          <div className="pessoa-edicao" style={{ marginTop: 0 }}>
            <label className="campo"><span>Nome do grupo</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </label>
            <div className="linha-campos">
              <label className="campo"><span>Região</span>
                <input type="text" value={regiao} onChange={(e) => setRegiao(e.target.value)} />
              </label>
              <label className="campo"><span>Perfil</span>
                <input type="text" value={perfil} onChange={(e) => setPerfil(e.target.value)} placeholder="ex.: casais" />
              </label>
            </div>
            <label className="campo"><span>Dia/horário</span>
              <input type="text" value={dia} onChange={(e) => setDia(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-mini" onClick={salvar}><IcoCheck size={14} /> Salvar</button>
              <button className="btn btn-sec btn-mini" onClick={() => setEditando(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="pessoa-nome">{c.nome}</div>
            <div className="pessoa-sub">🧭 {c.regiao || '—'} · {c.perfil || '—'}{c.diaHorario && <> · 🗓️ {c.diaHorario}</>}</div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <label className="campo" style={{ marginBottom: 0, minWidth: 170 }}>
            <span>Líder 1</span>
            <select value={c.liderId ?? ''} onChange={(e) => mudarLider('liderId', e.target.value)}>
              <option value="">—</option>
              {opcoesLider(c.lider2Id).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
          <label className="campo" style={{ marginBottom: 0, minWidth: 170 }}>
            <span>Líder 2 (opcional)</span>
            <select value={c.lider2Id ?? ''} onChange={(e) => mudarLider('lider2Id', e.target.value)}>
              <option value="">—</option>
              {opcoesLider(c.liderId).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
        </div>
        {!c.liderId && !c.lider2Id && (
          <p style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 6 }}>⚠️ Grupo sem líder definido.</p>
        )}
      </div>
      <div className="cartao-acoes">
        {!editando && <button className="btn-icone" onClick={abrirEdicao} title="Editar"><IcoEditar /></button>}
        <button className="btn-icone perigo" onClick={remover} title="Remover"><IcoLixeira /></button>
      </div>
    </div>
  )
}

/* ---------------- Aba: Autocadastro (QR code) ---------------- */

function AbaAutocadastro() {
  const s = useAppState()
  const [copiado, setCopiado] = useState(false)
  const url = `${window.location.origin}${window.location.pathname}#/autocadastro`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=16&data=${encodeURIComponent(url)}`

  function copiar() {
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  function imprimir() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>QR Autocadastro — ${s.config.nomeIgreja}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        h1 { color: ${s.config.corPrimaria}; }
        img { width: 340px; height: 340px; margin: 24px 0; }
        p { font-size: 18px; color: #333; }
      </style></head>
      <body>
        <h1>${s.config.nomeIgreja}</h1>
        <p>Foi uma alegria receber você! 🎉<br>Aponte a câmera e deixe seu contato:</p>
        <img src="${qrUrl}" />
        <p style="font-size:13px;color:#888">${url}</p>
      </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  function mudar(patch: Partial<ConfigIgreja>) {
    setEstado((st) => ({ ...st, config: { ...st.config, ...patch } }))
  }

  return (
    <>
      <div className="card">
        <h3>QR code para o culto</h3>
        <p className="descricao-secao">
          Imprima e deixe nas mesas/telão. O visitante aponta a câmera, preenche sozinho, e o cadastro
          cai direto no sistema com a triagem automática.
        </p>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <img
            src={qrUrl} alt="QR code do autocadastro"
            style={{ width: 200, height: 200, border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <label className="campo"><span>Link do formulário público</span>
              <input type="text" value={url} readOnly onFocus={(e) => e.target.select()} />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={imprimir}><IcoImpressora size={15} /> Imprimir QR</button>
              <button className="btn btn-sec" onClick={copiar}>{copiado ? <><IcoCheck size={15} /> Copiado!</> : <><IcoCopiar size={15} /> Copiar link</>}</button>
              <a className="btn btn-sec" href="#/autocadastro" target="_blank" rel="noreferrer"><IcoOlho size={15} /> Prévia</a>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Personalizar a página</h3>
        <p className="descricao-secao">Textos e campos que aparecem para o visitante ao preencher o formulário.</p>
        <label className="campo"><span>Título de boas-vindas</span>
          <input type="text" value={s.config.autocadastroTitulo} onChange={(e) => mudar({ autocadastroTitulo: e.target.value })} />
        </label>
        <label className="campo"><span>Mensagem de introdução</span>
          <textarea value={s.config.autocadastroMensagem} onChange={(e) => mudar({ autocadastroMensagem: e.target.value })} />
        </label>
        <label className="campo"><span>Mensagem final (após enviar)</span>
          <textarea value={s.config.autocadastroMensagemFinal} onChange={(e) => mudar({ autocadastroMensagemFinal: e.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.config.autocadastroMostrarBairro} onChange={(e) => mudar({ autocadastroMostrarBairro: e.target.checked })} />
          Perguntar o bairro
        </label>
        <label className="check">
          <input type="checkbox" checked={s.config.autocadastroMostrarSituacaoCivil} onChange={(e) => mudar({ autocadastroMostrarSituacaoCivil: e.target.checked })} />
          Perguntar a situação civil
        </label>
        <label className="check">
          <input type="checkbox" checked={s.config.autocadastroPerguntarBatismo} onChange={(e) => mudar({ autocadastroPerguntarBatismo: e.target.checked })} />
          Perguntar se já é batizado(a)
        </label>
        <p className="descricao-secao" style={{ marginTop: 6, marginBottom: 0 }}>
          A pergunta do batismo é opcional e sem pressão — serve para a equipe não convidar ao
          batismo quem já é batizado. Se preferir descobrir isso na conversa, desligue aqui: a
          equipe pode registrar a qualquer momento na ficha da pessoa.
        </p>
      </div>

      <div className="card">
        <h3>Dica de uso</h3>
        <p className="descricao-secao" style={{ margin: 0 }}>
          Quando publicar o sistema online (veja SUPABASE.md), este link passa a ser público e o mesmo QR
          funciona de qualquer celular, sem depender de estar na mesma rede. Enquanto roda só na sua máquina,
          o QR só abre em aparelhos conectados ao mesmo Wi-Fi.
        </p>
      </div>
    </>
  )
}

/* Sincronização online (Supabase) — fase 1 do modo multi-dispositivo */
function CardNuvem() {
  const nuvem = useNuvem()
  const salva = getConfigNuvem()
  const [url, setUrl] = useState(salva?.url ?? '')
  const [anonKey, setAnonKey] = useState(salva?.anonKey ?? '')
  const [igrejaId, setIgrejaId] = useState(salva?.igrejaId ?? 'minha-igreja')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const conectada = nuvem.status !== 'desligada'

  async function conectar() {
    if (!url.trim() || !anonKey.trim() || !igrejaId.trim()) {
      setErro('Preencha os três campos (URL, chave e identificador da igreja).')
      return
    }
    setOcupado(true)
    setErro('')
    try {
      const cfg = { url: url.trim(), anonKey: anonKey.trim(), igrejaId: igrejaId.trim() }
      const remoto = await testarNuvem(cfg)
      const usarRemoto = remoto !== null &&
        confirm('Já existem dados salvos na nuvem para esta igreja.\n\nOK = usar os dados da NUVEM (substitui os deste navegador)\nCancelar = enviar os dados LOCAIS para a nuvem (substitui os de lá)')
      await ativarNuvem(cfg, usarRemoto ? remoto : null)
    } catch (e) {
      const detalhe = e instanceof Error ? e.message : String(e)
      setErro(`Não foi possível conectar. ${detalhe} — veja o guia SUPABASE.md.`)
    } finally {
      setOcupado(false)
    }
  }

  const rotuloStatus: Record<string, string> = {
    sincronizando: '🟡 Sincronizando…',
    ok: '🟢 Conectada e sincronizada',
    erro: '🔴 Erro na última sincronização — verifique a conexão',
  }

  return (
    <div className="card" style={{ borderTop: '3px solid var(--primary)' }}>
      <h3>🌐 Sincronização online</h3>
      <p className="descricao-secao">
        Sem a nuvem, os dados vivem só neste navegador. Conectando ao Supabase (gratuito para começar),
        tudo é salvo online automaticamente e você acessa de qualquer dispositivo. O passo a passo está
        no arquivo <b>SUPABASE.md</b> do projeto.
      </p>

      {conectada ? (
        <>
          <p style={{ fontSize: 14, marginBottom: 4 }}>{rotuloStatus[nuvem.status]}</p>
          {nuvem.ultimoSync && (
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 10 }}>
              Última sincronização: {new Date(nuvem.ultimoSync).toLocaleString('pt-BR')}
            </p>
          )}
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 10 }}>
            Igreja: <b>{salva?.igrejaId}</b> · {salva?.url}
          </p>
          <button className="btn btn-sec btn-mini" onClick={() => { desligarNuvem(); }}>
            Desconectar da nuvem (os dados locais permanecem)
          </button>
        </>
      ) : (
        <>
          {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}
          <div className="linha-campos">
            <label className="campo"><span>URL do projeto Supabase</span>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
            </label>
            <label className="campo"><span>Chave da API (publishable ou anon)</span>
              <input type="text" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="sb_publishable_… ou eyJ…" />
            </label>
          </div>
          <label className="campo" style={{ maxWidth: 320 }}><span>Identificador da igreja</span>
            <input type="text" value={igrejaId} onChange={(e) => setIgrejaId(e.target.value)} placeholder="ex.: ife-matriz" />
          </label>
          <button className="btn" onClick={conectar} disabled={ocupado}>
            {ocupado ? 'Conectando…' : '🌐 Conectar e sincronizar'}
          </button>
        </>
      )}
    </div>
  )
}

function FormConexao({ onPronto }: { onPronto: () => void }) {
  const s = useAppState()
  const [nome, setNome] = useState(''); const [regiao, setRegiao] = useState('')
  const [perfil, setPerfil] = useState(''); const [dia, setDia] = useState('')
  const [liderId, setLiderId] = useState(''); const [lider2Id, setLider2Id] = useState('')

  function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    const id = uid()
    setEstado((st) => ({
      ...st,
      conexoes: [...st.conexoes, {
        id, nome: nome.trim(), regiao: regiao.trim(), perfil: perfil.trim(), diaHorario: dia.trim(),
        liderId: liderId || undefined, lider2Id: lider2Id || undefined,
      }],
      usuarios: st.usuarios.map((u) => (u.id === liderId || u.id === lider2Id) ? { ...u, conexaoId: id } : u),
    }))
    onPronto()
  }

  return (
    <form className="bloco-form" onSubmit={adicionar}>
      <div className="linha-campos">
        <label className="campo"><span>Nome do grupo *</span>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Conexão Casais Centro" autoFocus />
        </label>
        <label className="campo"><span>Região</span>
          <input type="text" value={regiao} onChange={(e) => setRegiao(e.target.value)} />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Perfil</span>
          <input type="text" value={perfil} onChange={(e) => setPerfil(e.target.value)} placeholder="ex.: casais, jovens" />
        </label>
        <label className="campo"><span>Dia/horário</span>
          <input type="text" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="ex.: Quinta, 20h" />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Líder 1</span>
          <select value={liderId} onChange={(e) => setLiderId(e.target.value)}>
            <option value="">— definir depois —</option>
            {lideres(s).filter((l) => l.id !== lider2Id).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <label className="campo"><span>Líder 2 (opcional)</span>
          <select value={lider2Id} onChange={(e) => setLider2Id(e.target.value)}>
            <option value="">—</option>
            {lideres(s).filter((l) => l.id !== liderId).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="submit">Adicionar grupo</button>
        <button className="btn btn-sec" type="button" onClick={onPronto}>Cancelar</button>
      </div>
    </form>
  )
}

/* ---------------- Aba: Mensagens ---------------- */

function AbaMensagens() {
  const s = useAppState()
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [etapaNova, setEtapaNova] = useState<EtapaFluxo>('geral')

  const fixos = s.templates.filter((t) => (GATILHOS_FIXOS as readonly string[]).includes(t.gatilho))
  const extras = s.templates.filter((t) => !(GATILHOS_FIXOS as readonly string[]).includes(t.gatilho))
  const etapasComExtra = (Object.keys(ETAPA_LABEL) as EtapaFluxo[]).filter((e) => extras.some((t) => t.etapa === e))

  function editar(id: string, patch: Partial<Template>) {
    setEstado((st) => ({
      ...st,
      templates: st.templates.map((x) => x.id === id ? { ...x, ...patch } : x),
    }))
  }

  return (
    <>
      <div className="card">
        <h3>Mensagens do fluxo</h3>
        <p className="descricao-secao">
          Usadas pelos botões "💬 Enviar" do sistema. Use {'{{nome}}'} para inserir o primeiro nome do visitante.
          Estas não podem ser excluídas (fazem parte do fluxo), mas o texto é todo seu. Quando houver mais de uma
          mensagem para a mesma etapa (veja "Minhas mensagens" abaixo), quem for enviar escolhe qual usar.
        </p>
        {fixos.map((t) => (
          <div key={t.id} style={{ marginBottom: 10 }}>
            <label className="campo" style={{ marginBottom: 4 }}>
              <span>{t.titulo} <span className="tag" style={{ marginLeft: 6 }}>{ETAPA_LABEL[t.etapa]}</span></span>
              <textarea value={t.texto} onChange={(e) => editar(t.id, { texto: e.target.value })} />
            </label>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Minhas mensagens ({extras.length})</h3>
        <p className="descricao-secao">
          Mensagens extras da sua igreja. Escolha em qual etapa do fluxo cada uma pode ser usada — se houver mais de
          uma na mesma etapa, o botão de enviar mostra uma opção para selecionar qual mandar.
        </p>

        {extras.length === 0 && <div className="vazio" style={{ padding: '14px 0' }}>Nenhuma mensagem extra ainda.</div>}

        {etapasComExtra.map((etapa) => (
          <div key={etapa} style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-2)', marginBottom: 8 }}>
              {ETAPA_LABEL[etapa]}
            </h4>
            {extras.filter((t) => t.etapa === etapa).map((t) => (
              <div key={t.id} style={{ marginBottom: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div className="linha-campos">
                  <label className="campo"><span>Título</span>
                    <input type="text" value={t.titulo} onChange={(e) => editar(t.id, { titulo: e.target.value })} />
                  </label>
                  <label className="campo"><span>Etapa do fluxo</span>
                    <select value={t.etapa} onChange={(e) => editar(t.id, { etapa: e.target.value as EtapaFluxo })}>
                      {(Object.keys(ETAPA_LABEL) as EtapaFluxo[]).map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
                    </select>
                  </label>
                </div>
                <label className="campo" style={{ marginBottom: 6 }}>
                  <span>Texto (use {'{{nome}}'})</span>
                  <textarea value={t.texto} onChange={(e) => editar(t.id, { texto: e.target.value })} />
                </label>
                <button
                  className="btn btn-sec btn-mini"
                  onClick={() => setEstado((st) => comExclusoes({ ...st, templates: st.templates.filter((x) => x.id !== t.id) }, 'template', [t.id]))}
                >🗑️ Excluir</button>
              </div>
            ))}
          </div>
        ))}

        <hr style={{ margin: '14px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
        <h4 style={{ fontSize: 13, marginBottom: 8 }}>Nova mensagem</h4>
        <div className="linha-campos">
          <label className="campo"><span>Título da nova mensagem</span>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ex.: Convite para o batismo" />
          </label>
          <label className="campo"><span>Etapa do fluxo</span>
            <select value={etapaNova} onChange={(e) => setEtapaNova(e.target.value as EtapaFluxo)}>
              {(Object.keys(ETAPA_LABEL) as EtapaFluxo[]).map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
            </select>
          </label>
        </div>
        <label className="campo"><span>Texto (use {'{{nome}}'})</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Olá, {{nome}}! …" />
        </label>
        <button
          className="btn"
          onClick={() => {
            if (!titulo.trim() || !texto.trim()) return
            setEstado((st) => ({
              ...st,
              templates: [...st.templates, { id: uid(), gatilho: `custom_${uid()}`, titulo: titulo.trim(), texto: texto.trim(), etapa: etapaNova }],
            }))
            setTitulo(''); setTexto(''); setEtapaNova('geral')
          }}
        >➕ Adicionar mensagem</button>
      </div>
    </>
  )
}

/* ---------------- Aba: Dados ---------------- */

function AbaDados() {
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  function exportar() {
    const estadoAtual = getEstado()
    const blob = new Blob([JSON.stringify(estadoAtual, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `consolidacao-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Backup exportado — guarde o arquivo em local seguro.')
    registrarAuditoria('⬇️ Exportou backup completo', { alvoTipo: 'sistema', detalhe: `${estadoAtual.visitantes.length} visitante(s)` })
  }

  function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0]
    if (!arq) return
    arq.text().then((textoArq) => {
      try {
        const dados = JSON.parse(textoArq)
        if (!Array.isArray(dados.visitantes)) throw new Error('formato inválido')
        substituirEstado(dados)
        setMsg('Backup restaurado com sucesso.')
        registrarAuditoria('⬆️ Restaurou backup (substituiu os dados)', { alvoTipo: 'sistema' })
      } catch {
        setMsg('Arquivo inválido — nada foi alterado.')
      }
    })
    e.target.value = ''
  }

  return (
    <>
      {msg && <div className="alerta alerta-info">ℹ️ <div>{msg}</div></div>}

      <CardNuvem />

      <div className="card">
        <h3>Backup</h3>
        <p className="descricao-secao">
          Os dados ficam salvos neste navegador. Exporte um backup regularmente — ele também serve para levar os dados para outro computador.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportar}><IcoDownload size={15} /> Exportar backup (.json)</button>
          <button className="btn btn-sec" onClick={() => arquivoRef.current?.click()}>Restaurar backup</button>
          <input ref={arquivoRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importar} />
        </div>
      </div>

      <div className="card" style={{ borderColor: '#fecaca' }}>
        <h3 style={{ color: 'var(--danger)' }}>Zona de perigo</h3>
        <p className="descricao-secao">
          Apaga todos os visitantes, contatos e cadastros deste navegador. Não tem volta (a menos que você tenha um backup).
        </p>
        <button
          className="btn btn-perigo"
          onClick={() => {
            if (confirm('Tem certeza? Todos os dados serão apagados. Exportou um backup antes?')) {
              zerarDados()
              setMsg('Dados zerados.')
            }
          }}
        >🗑️ Zerar todos os dados</button>
      </div>
    </>
  )
}
