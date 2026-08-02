import { useEffect, useRef, useState } from 'react'
import {
  ativarNuvem, comExclusoes, desligarNuvem, GATILHOS_FIXOS, getEstado, lideres, setEstado,
  substituirEstado, testarNuvem, uid, useAppState, useNuvem, zerarDados,
} from '../store'
import { getConfigNuvem } from '../nuvem'
import {
  PAPEL_LABEL, rotuloEtapa, rotuloStatusPadrao,
  type ConfigIgreja, type CultoDef, type EtapaFluxo, type Papel, type Status, type Template,
} from '../types'
import { DIA_SEMANA_LABEL, fmtDataComDia, gerarMaisOcorrencias, gerarOcorrencias } from '../cultos'
import { PALETAS } from '../tema'
import { registrarAuditoria } from '../auditoria'
import { toast } from '../toast'
import { BotaoSalvar, SeletorData } from '../campos'
import { IcoBusca, IcoCheck, IcoCopiar, IcoDownload, IcoEditar, IcoImpressora, IcoLixeira, IcoMais, IcoOlho, IcoX } from '../icones'

type Aba = 'igreja' | 'jornada' | 'cultos' | 'grupos' | 'mensagens' | 'autocadastro' | 'dados'

const ABAS: { id: Aba; rotulo: string; dica: string }[] = [
  { id: 'igreja', rotulo: '⛪ Igreja', dica: 'Identidade, cores e regras gerais' },
  { id: 'jornada', rotulo: '🗺️ Jornada', dica: 'Nomes das etapas e datas marcadas' },
  { id: 'cultos', rotulo: '📅 Cultos', dica: 'Cultos fixos e suas datas' },
  { id: 'grupos', rotulo: '🏠 Grupos', dica: 'Conexões e seus líderes' },
  { id: 'mensagens', rotulo: '💬 Mensagens', dica: 'Textos do fluxo de contato' },
  { id: 'autocadastro', rotulo: '📱 Autocadastro', dica: 'Página pública do QR code' },
  { id: 'dados', rotulo: '💾 Dados & Nuvem', dica: 'Backup e sincronização' },
]

export default function Configuracoes() {
  const [aba, setAba] = useState<Aba>('igreja')
  const atual = ABAS.find((a) => a.id === aba)!

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

      <p className="descricao-secao" style={{ margin: '0 0 16px', fontStyle: 'italic' }}>{atual.dica}</p>

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

/* ---------------- Rascunho + Salvar ----------------
   Guarda as edições localmente e só grava ao clicar em "Salvar" — assim a pessoa
   tem certeza do que foi salvo. Adota mudanças externas (nuvem) só quando não há
   edição pendente, para não descartar o que está sendo digitado. */
function useRascunho<T extends object>(atual: T) {
  const [d, setD] = useState<T>(atual)
  const ref = useRef(JSON.stringify(atual))
  const atualKey = JSON.stringify(atual)
  useEffect(() => {
    if (atualKey !== ref.current) {
      setD((x) => (JSON.stringify(x) === ref.current ? atual : x))
      ref.current = atualKey
    }
  }, [atualKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const pendente = JSON.stringify(d) !== atualKey
  return { d, set: (p: Partial<T>) => setD((x) => ({ ...x, ...p })), pendente }
}

function salvarConfig(patch: Partial<ConfigIgreja>) {
  setEstado((st) => ({ ...st, config: { ...st.config, ...patch } }))
}

/* ---------------- Aba: Igreja ---------------- */

function AbaIgreja() {
  const cfg = useAppState().config
  const id = useRascunho({ nomeIgreja: cfg.nomeIgreja, subtitulo: cfg.subtitulo, termoGrupo: cfg.termoGrupo })
  const regras = useRascunho({ prazoEsperaDias: cfg.prazoEsperaDias })

  return (
    <>
      <div className="card">
        <h3>Identidade</h3>
        <p className="descricao-secao">Nome e termos que aparecem no menu, no formulário público de autocadastro e nos relatórios.</p>
        <div className="linha-campos">
          <label className="campo"><span>Nome da igreja</span>
            <input type="text" value={id.d.nomeIgreja} onChange={(e) => id.set({ nomeIgreja: e.target.value })} />
          </label>
          <label className="campo"><span>Subtítulo</span>
            <input type="text" value={id.d.subtitulo} onChange={(e) => id.set({ subtitulo: e.target.value })} />
          </label>
        </div>
        <label className="campo"><span>Como vocês chamam o grupo pequeno?</span>
          <input type="text" value={id.d.termoGrupo} onChange={(e) => id.set({ termoGrupo: e.target.value })} placeholder="Conexão, Célula, PG, GC…" />
        </label>
        <BotaoSalvar pendente={id.pendente} onSalvar={() => { salvarConfig(id.d); toast('Identidade salva') }} />
      </div>

      <Cores />

      <div className="card">
        <h3>Regras do fluxo</h3>
        <p className="descricao-secao">Prazos que controlam as automações do acompanhamento.</p>
        <label className="campo" style={{ maxWidth: 380 }}>
          <span>Dias sem resposta até mover para "Em espera"</span>
          <input
            type="number" min={1} max={90} value={regras.d.prazoEsperaDias}
            onChange={(e) => regras.set({ prazoEsperaDias: Math.max(1, Number(e.target.value) || 14) })}
          />
        </label>
        <BotaoSalvar pendente={regras.pendente} onSalvar={() => { salvarConfig(regras.d); toast('Regras salvas') }} />
      </div>

      <ListaEditavel
        titulo={'Opções de "Como conheceu a igreja?"'}
        descricao="Aparecem no cadastro manual e no autocadastro do QR code. Ótimas para medir quais canais trazem mais visitantes."
        itens={cfg.comoConheceuOpcoes}
        placeholder="ex.: Rádio local"
        onChange={(comoConheceuOpcoes) => { salvarConfig({ comoConheceuOpcoes }); toast('Opções salvas') }}
      />
    </>
  )
}

/* ---------------- Cores (aplicadas na hora, com prévia ao vivo) ---------------- */

function Cores() {
  const cfg = useAppState().config

  function mudar(patch: Partial<ConfigIgreja>) {
    salvarConfig(patch)
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
        As cores do sistema inteiro — aplicadas e salvas na hora, para você ver o resultado ao vivo.
        Os tons derivados (mais claros/escuros) são calculados sozinhos, inclusive a cor do texto sobre os botões.
      </p>

      <div className="ac-secao" style={{ paddingTop: 0, borderTop: 'none' }}>
        <div className="ac-secao-titulo">Paletas prontas</div>
        <div className="ac-opcoes">
          {PALETAS.map((p) => (
            <button
              type="button" key={p.nome} title={p.descricao}
              className={`ac-opcao ${paletaAtiva?.nome === p.nome ? 'sel' : ''}`}
              onClick={() => { mudar({ corFundo: p.corFundo, corEscura: p.corEscura, corPrimaria: p.corPrimaria }); toast(`Paleta "${p.nome}" aplicada`) }}
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

/* ---------------- Aba: Jornada (nomes das etapas + datas marcadas) ---------- */

const STATUS_DA_JORNADA: Status[] = [
  'novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider',
  'visitou', 'transferido', 'batismo', 'integrado',
]
const STATUS_DE_PAUSA: Status[] = ['em_espera', 'recusou', 'encerrado']

function AbaJornada() {
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

/* ---------------- Aba: Cultos (padrão do cadastro de culto do louvor) ----------
   Cada culto tem nome + dia da semana + horário e uma lista de datas concretas.
   Ao cadastrar, o sistema já gera as ocorrências recentes e as próximas; a equipe
   adiciona datas avulsas e gera mais. No cadastro do visitante só aparecem as
   ocorrências da última semana — mas todas ficam guardadas aqui. */
function AbaCultos() {
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

/* ---------------- Lista editável (opções de texto) ---------------- */

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

/* ---------------- Aba: Grupos ---------------- */

// normaliza texto para busca (sem acento, minúsculo)
function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function AbaGrupos() {
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
    <div className="card">
      <div className="card-cab">
        <div>
          <h3 style={{ marginBottom: 2 }}>Grupos de {termo}</h3>
          <p className="descricao-secao" style={{ margin: 0 }}>
            O sistema sugere o grupo do visitante por proximidade (região) + perfil.
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
  )
}

function CartaoConexao({ c }: { c: import('../types').Conexao }) {
  const s = useAppState()
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(c.nome)
  const [endereco, setEndereco] = useState(c.endereco ?? '')
  const [bairro, setBairro] = useState(c.bairro ?? '')
  const [cidade, setCidade] = useState(c.cidade ?? '')
  const [perfil, setPerfil] = useState(c.perfil)
  const [dia, setDia] = useState(c.diaHorario)

  function abrirEdicao() {
    setNome(c.nome); setEndereco(c.endereco ?? ''); setBairro(c.bairro ?? '')
    setCidade(c.cidade ?? ''); setPerfil(c.perfil); setDia(c.diaHorario)
    setEditando(true)
  }

  function salvar() {
    if (!nome.trim()) return
    setEstado((st) => ({
      ...st,
      conexoes: st.conexoes.map((x) => x.id === c.id
        ? { ...x, nome: nome.trim(), endereco: endereco.trim() || undefined, bairro: bairro.trim() || undefined, cidade: cidade.trim() || undefined, perfil: perfil.trim(), diaHorario: dia.trim() }
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
      conexoes: st.conexoes.map((x) => x.id === c.id ? { ...x, [campo]: novoId || undefined } : x),
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

  const opcoesLider = (excluirId?: string) => lideres(s).filter((l) => l.id !== excluirId)
  const lider1 = s.usuarios.find((u) => u.id === c.liderId)?.nome
  const lider2 = s.usuarios.find((u) => u.id === c.lider2Id)?.nome
  const semLider = !c.liderId && !c.lider2Id
  // Linha de local: "Endereço — Bairro · Cidade" (só o que estiver preenchido)
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
        <div className="linha-campos">
          <label className="campo"><span>Perfil</span>
            <input type="text" value={perfil} onChange={(e) => setPerfil(e.target.value)} placeholder="ex.: casais, jovens" />
          </label>
          <label className="campo"><span>Dia/horário</span>
            <input type="text" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="ex.: Quinta, 20h" />
          </label>
        </div>
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

/* ---------------- Aba: Autocadastro (QR code) ---------------- */

function AbaAutocadastro() {
  const s = useAppState()
  const cfg = s.config
  const [copiado, setCopiado] = useState(false)

  const url = (cfg.autocadastroUrl || '').trim() || `${window.location.origin}${window.location.pathname}#/autocadastro`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=16&data=${encodeURIComponent(url)}`

  // Rascunhos: link, textos e campos visíveis
  const link = useRascunho({ autocadastroUrl: cfg.autocadastroUrl })
  const textos = useRascunho({
    autocadastroTitulo: cfg.autocadastroTitulo,
    autocadastroMensagem: cfg.autocadastroMensagem,
    autocadastroMensagemFinal: cfg.autocadastroMensagemFinal,
  })

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
      <html><head><title>Cadastro Visitante - ${cfg.nomeIgreja}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        h1 { color: ${cfg.corPrimaria}; }
        img { width: 340px; height: 340px; margin: 24px 0; }
        p { font-size: 18px; color: #333; }
      </style></head>
      <body>
        <h1>${cfg.nomeIgreja}</h1>
        <p>Foi uma alegria receber você! 🎉<br>Aponte a câmera e deixe seu contato:</p>
        <img src="${qrUrl}" />
        <p style="font-size:13px;color:#888">${url}</p>
      </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  // Campos que a igreja liga/desliga (nome, contato e nascimento são fixos)
  const camposOpcionais: { chave: keyof ConfigIgreja; rotulo: string }[] = [
    { chave: 'autocadastroMostrarSituacaoCivil', rotulo: 'Estado civil' },
    { chave: 'autocadastroMostrarEndereco', rotulo: 'Endereço' },
    { chave: 'autocadastroMostrarBairro', rotulo: 'Bairro' },
    { chave: 'autocadastroMostrarCidade', rotulo: 'Cidade' },
    { chave: 'autocadastroPerguntarPrimeiraVez', rotulo: 'É a primeira vez na igreja?' },
    { chave: 'autocadastroPerguntarMembroOutra', rotulo: 'É membro de outra igreja?' },
    { chave: 'autocadastroPerguntarBatismo', rotulo: 'Já é batizado(a)?' },
    { chave: 'autocadastroPerguntarComoConheceu', rotulo: 'Como conheceu a igreja?' },
    { chave: 'autocadastroPerguntarConexao', rotulo: `Quer fazer parte de uma ${cfg.termoGrupo || 'Conexão'}?` },
    { chave: 'autocadastroPerguntarContato', rotulo: 'Quer que a equipe entre em contato? (+ horário)' },
    { chave: 'autocadastroPerguntarOracao', rotulo: 'Pedido de oração' },
  ]

  return (
    <>
      <div className="card">
        <h3>QR code e link público</h3>
        <p className="descricao-secao">
          Imprima o QR e deixe nas mesas/telão, ou divulgue o link. O visitante preenche sozinho e o
          cadastro cai direto no sistema com a triagem automática.
        </p>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <img
            src={qrUrl} alt="QR code do autocadastro"
            style={{ width: 200, height: 200, border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <label className="campo"><span>Link público divulgado</span>
              <input
                type="text" value={link.d.autocadastroUrl}
                onChange={(e) => link.set({ autocadastroUrl: e.target.value })}
                placeholder="https://visitante.suaigreja.com.br"
              />
            </label>
            <p className="descricao-secao" style={{ marginTop: -4 }}>
              É o endereço que aparece no QR e no botão de copiar. Aponte esse domínio para este app na hospedagem (Netlify).
            </p>
            <BotaoSalvar pendente={link.pendente} onSalvar={() => { salvarConfig({ autocadastroUrl: link.d.autocadastroUrl.trim() }); toast('Link salvo') }} rotulo="Salvar link" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button className="btn" onClick={imprimir}><IcoImpressora size={15} /> Imprimir QR</button>
              <button className="btn btn-sec" onClick={copiar}>{copiado ? <><IcoCheck size={15} /> Copiado!</> : <><IcoCopiar size={15} /> Copiar link</>}</button>
              <a className="btn btn-sec" href="#/autocadastro" target="_blank" rel="noreferrer"><IcoOlho size={15} /> Prévia</a>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Campos do formulário</h3>
        <p className="descricao-secao">
          Escolha o que perguntar ao visitante. <b>Nome, contato e data de nascimento</b> são sempre exibidos —
          o restante você liga ou desliga aqui.
        </p>
        <div className="grade-toggles">
          {camposOpcionais.map((f) => (
            <label className="check toggle-item" key={f.chave as string}>
              <input
                type="checkbox" checked={Boolean(cfg[f.chave])}
                onChange={(e) => { salvarConfig({ [f.chave]: e.target.checked } as Partial<ConfigIgreja>); toast(e.target.checked ? `"${f.rotulo}" ativado` : `"${f.rotulo}" desativado`) }}
              />
              {f.rotulo}
            </label>
          ))}
        </div>
        <p className="descricao-secao" style={{ marginTop: 12, marginBottom: 0 }}>
          A pergunta do batismo é sem pressão — serve para a equipe não convidar ao batismo quem já é batizado.
        </p>
      </div>

      <div className="card">
        <h3>Textos da página</h3>
        <p className="descricao-secao">O que o visitante lê ao abrir e ao terminar o formulário.</p>
        <label className="campo"><span>Título de boas-vindas</span>
          <input type="text" value={textos.d.autocadastroTitulo} onChange={(e) => textos.set({ autocadastroTitulo: e.target.value })} />
        </label>
        <label className="campo"><span>Mensagem de introdução</span>
          <textarea value={textos.d.autocadastroMensagem} onChange={(e) => textos.set({ autocadastroMensagem: e.target.value })} />
        </label>
        <label className="campo"><span>Mensagem final (após enviar)</span>
          <textarea value={textos.d.autocadastroMensagemFinal} onChange={(e) => textos.set({ autocadastroMensagemFinal: e.target.value })} />
        </label>
        <BotaoSalvar pendente={textos.pendente} onSalvar={() => { salvarConfig(textos.d); toast('Textos salvos') }} />
      </div>
    </>
  )
}

/* ---------------- Sincronização online (Supabase) ---------------- */

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
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState(''); const [bairro, setBairro] = useState(''); const [cidade, setCidade] = useState('')
  const [perfil, setPerfil] = useState(''); const [dia, setDia] = useState('')
  const [liderId, setLiderId] = useState(''); const [lider2Id, setLider2Id] = useState('')

  // Já existe um grupo com esse nome? (checagem de duplicado, sem acento)
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
    setEstado((st) => ({
      ...st,
      conexoes: [...st.conexoes, {
        id, nome: nome.trim(),
        endereco: endereco.trim() || undefined, bairro: bairro.trim() || undefined, cidade: cidade.trim() || undefined,
        perfil: perfil.trim(), diaHorario: dia.trim(),
        liderId: liderId || undefined, lider2Id: lider2Id || undefined,
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
        <button className="btn" type="submit" disabled={!nome.trim() || !!duplicado}>Adicionar grupo</button>
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
  const etapasComExtra = (Object.keys(ETAPAS_ORDEM) as EtapaFluxo[]).filter((e) => extras.some((t) => t.etapa === e))

  function editar(id: string, patch: Partial<Template>) {
    setEstado((st) => ({
      ...st,
      templates: st.templates.map((x) => x.id === id ? { ...x, ...patch } : x),
    }))
  }

  return (
    <>
      <div className="card">
        <h3>💡 Variáveis disponíveis</h3>
        <p className="descricao-secao" style={{ marginBottom: 8 }}>
          Escreva o texto e use estas marcações — elas são trocadas pelos dados reais na hora de enviar:
        </p>
        <div className="ac-opcoes">
          <span className="tag" style={{ fontFamily: 'monospace' }}>{'{{nome}}'} → primeiro nome do visitante</span>
          <span className="tag" style={{ fontFamily: 'monospace' }}>{'{{nome_conexão}}'} → nome da {s.config.termoGrupo || 'Conexão'} do visitante</span>
        </div>
      </div>

      <div className="card">
        <h3>Mensagens do fluxo</h3>
        <p className="descricao-secao">
          Usadas pelos botões "💬 Enviar" do sistema. Estas não podem ser excluídas (fazem parte do fluxo),
          mas o texto é todo seu. Edite e clique em <b>Salvar</b> em cada uma.
        </p>
        {fixos.map((t) => <MensagemFixaEditor key={t.id} t={t} onSalvar={editar} />)}
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
              {rotuloEtapa(etapa)}
            </h4>
            {extras.filter((t) => t.etapa === etapa).map((t) => (
              <div key={t.id} style={{ marginBottom: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div className="linha-campos">
                  <label className="campo"><span>Título</span>
                    <input type="text" value={t.titulo} onChange={(e) => editar(t.id, { titulo: e.target.value })} />
                  </label>
                  <label className="campo"><span>Etapa do fluxo</span>
                    <select value={t.etapa} onChange={(e) => editar(t.id, { etapa: e.target.value as EtapaFluxo })}>
                      {(Object.keys(ETAPAS_ORDEM) as EtapaFluxo[]).map((e) => <option key={e} value={e}>{rotuloEtapa(e)}</option>)}
                    </select>
                  </label>
                </div>
                <label className="campo" style={{ marginBottom: 6 }}>
                  <span>Texto (use {'{{nome}}'} e {'{{nome_conexão}}'})</span>
                  <textarea value={t.texto} onChange={(e) => editar(t.id, { texto: e.target.value })} />
                </label>
                <button
                  className="btn btn-sec btn-mini"
                  onClick={() => { setEstado((st) => comExclusoes({ ...st, templates: st.templates.filter((x) => x.id !== t.id) }, 'template', [t.id])); toast('Mensagem excluída', 'info') }}
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
              {(Object.keys(ETAPAS_ORDEM) as EtapaFluxo[]).map((e) => <option key={e} value={e}>{rotuloEtapa(e)}</option>)}
            </select>
          </label>
        </div>
        <label className="campo"><span>Texto (use {'{{nome}}'} e {'{{nome_conexão}}'})</span>
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
            toast('Mensagem adicionada')
          }}
        ><IcoMais size={14} /> Adicionar mensagem</button>
      </div>
    </>
  )
}

// Ordem das etapas nos seletores (mantém o fluxo legível)
const ETAPAS_ORDEM: Record<EtapaFluxo, true> = {
  aproximacao: true, conexao: true, celebracao: true, pre_visita: true, aviso_lider: true, reengajamento: true, geral: true,
}

// Editor de uma mensagem fixa: rascunho + botão salvar (segurança de "salvou?")
function MensagemFixaEditor({ t, onSalvar }: { t: Template; onSalvar: (id: string, patch: Partial<Template>) => void }) {
  const [texto, setTexto] = useState(t.texto)
  const pendente = texto !== t.texto
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="campo" style={{ marginBottom: 4 }}>
        <span>{t.titulo} <span className="tag" style={{ marginLeft: 6 }}>{rotuloEtapa(t.etapa)}</span></span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <BotaoSalvar pendente={pendente} onSalvar={() => { onSalvar(t.id, { texto }); toast('Mensagem salva') }} rotulo="Salvar mensagem" />
    </div>
  )
}

/* ---------------- Aba: Dados & Nuvem ---------------- */

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
