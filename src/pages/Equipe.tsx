import { useState } from 'react'
import { comExclusoes, primeiraGestaoIntegracao, setEstado, uid, useAppState } from '../store'
import { PAPEL_COR, PAPEL_LABEL, rotuloPapel, STATUS_ACESSO_LABEL, type AppState, type Papel, type Usuario } from '../types'
import { linkWhatsApp } from '../actions'
import { criariCiclo } from '../acesso'
import { registrarAuditoria } from '../auditoria'
import { IcoBusca, IcoEditar, IcoLixeira, IcoMais, IcoWhats } from '../icones'

// Muda o supervisor de `alvo`, com validação de ciclo e registro em auditoria.
// Usado tanto na seção de Hierarquia quanto no card de edição da pessoa.
export function definirSupervisor(s: AppState, alvo: Usuario, novoSupervisorId: string) {
  if (novoSupervisorId && criariCiclo(s, alvo.id, novoSupervisorId)) {
    alert(`⚠️ Não é possível: ${alvo.nome} já supervisiona (direta ou indiretamente) essa pessoa. Isso criaria um ciclo na hierarquia.`)
    return
  }
  const novoSupervisor = s.usuarios.find((u) => u.id === novoSupervisorId)
  setEstado((st) => ({
    ...st,
    usuarios: st.usuarios.map((x) => x.id === alvo.id ? { ...x, supervisorId: novoSupervisorId || undefined } : x),
  }))
  registrarAuditoria('Alterou hierarquia', {
    alvoTipo: 'usuario', alvoId: alvo.id, alvoNome: alvo.nome,
    detalhe: novoSupervisor ? `Novo supervisor: ${novoSupervisor.nome}` : 'Removeu supervisor',
  })
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}

// Rótulos de todas as funções da pessoa, como tags coloridas
function TagsPapeis({ u }: { u: Usuario }) {
  return (
    <>
      {u.papeis.map((p) => (
        <span key={p} className="tag" style={{ background: PAPEL_COR[p] + '18', borderColor: PAPEL_COR[p] + '40', color: PAPEL_COR[p] }}>
          {rotuloPapel(p)}
        </span>
      ))}
    </>
  )
}

// Grupo de checkboxes para escolher as funções (uma pessoa pode ter várias)
function EscolherPapeis({ papeis, onMudar }: { papeis: Papel[]; onMudar: (novos: Papel[]) => void }) {
  function alternar(p: Papel) {
    const novos = papeis.includes(p) ? papeis.filter((x) => x !== p) : [...papeis, p]
    if (novos.length === 0) return // sempre pelo menos uma função
    onMudar(novos)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) => (
        <label key={p} className="check" style={{ fontSize: 13 }}>
          <input type="checkbox" checked={papeis.includes(p)} onChange={() => alternar(p)} />
          {rotuloPapel(p)}
        </label>
      ))}
    </div>
  )
}

// Área de usuários do sistema, dividida em abas por categoria. Quem exerce
// mais de uma função aparece em cada aba correspondente.
export default function Equipe() {
  const s = useAppState()
  const papeis = Object.keys(PAPEL_LABEL) as Papel[]
  const [aba, setAba] = useState<Papel | 'todos'>(papeis[0])
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [novo, setNovo] = useState(false)

  const nomeConexao = (id?: string) => s.conexoes.find((c) => c.id === id)?.nome

  const lista = s.usuarios
    .filter((u) => aba === 'todos' || u.papeis.includes(aba))
    .filter((u) => mostrarInativos || u.ativo)
    .filter((u) => {
      if (!busca) return true
      const alvo = `${u.nome} ${u.whatsapp} ${nomeConexao(u.conexaoId) ?? ''}`.toLowerCase()
      return alvo.includes(busca.toLowerCase())
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const conta = (p: Papel) => s.usuarios.filter((u) => u.papeis.includes(p) && u.ativo).length
  const inativos = s.usuarios.filter((u) => !u.ativo).length
  const grupos = aba === 'todos'
    ? papeis
        .map((p) => ({ papel: p, membros: lista.filter((u) => u.papeis.includes(p)) }))
        .filter((g) => g.membros.length > 0)
    : [{ papel: aba, membros: lista }]

  return (
    <div>
      <h1 className="titulo-pagina">Equipe</h1>
      <p className="subtitulo">Quem cuida dos visitantes, por categoria. Uma pessoa pode exercer mais de uma função.</p>

      {/* Abas por categoria */}
      <div className="grid-cards">
        {papeis.map((p) => (
          <button
            key={p}
            className="kpi kpi-btn"
            style={{ borderTop: `3px solid ${PAPEL_COR[p]}`, outline: aba === p ? `2px solid ${PAPEL_COR[p]}` : 'none' }}
            onClick={() => setAba(p)}
            title={`Ver só ${rotuloPapel(p)}`}
          >
            <div className="valor">{conta(p)}</div>
            <div className="rotulo">{rotuloPapel(p)}</div>
          </button>
        ))}
      </div>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>Hierarquia — quem supervisiona quem</summary>
        <CardHierarquia />
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
          {s.config.termoGrupo || 'Conexões'} — grupos e líderes ({s.conexoes.length})
        </summary>
        <CardConexoes />
      </details>

      <div className="card">
        <div className="card-cab">
          <h3>
            {aba === 'todos' ? 'Todos os membros' : rotuloPapel(aba)} ({lista.length})
          </h3>
          <button className="btn" onClick={() => setNovo(!novo)}>{novo ? 'Fechar' : <><IcoMais size={15} /> Novo membro</>}</button>
        </div>

        {novo && <FormUsuario onPronto={() => setNovo(false)} />}

        <div className="barra-lista">
          <div className="search-box" style={{ flex: 1 }}>
            <span className="search-icon"><IcoBusca /></span>
            <input
              type="text"
              placeholder="Buscar por nome, WhatsApp ou grupo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <button className={`chip ${aba === 'todos' ? 'sel' : ''}`} onClick={() => setAba(aba === 'todos' ? papeis[0] : 'todos')}>
            Todos
          </button>
          {inativos > 0 && (
            <button className={`chip ${mostrarInativos ? 'sel' : ''}`} onClick={() => setMostrarInativos(!mostrarInativos)}>
              Inativos ({inativos})
            </button>
          )}
        </div>

        {lista.length === 0 ? (
          <div className="vazio">Ninguém encontrado com esse filtro.</div>
        ) : (
          grupos.map((g) => (
            <div key={g.papel} style={{ marginBottom: 20 }}>
              {aba === 'todos' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PAPEL_COR[g.papel], display: 'inline-block' }} />
                  <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-2)' }}>
                    {rotuloPapel(g.papel)} ({g.membros.length})
                  </h4>
                </div>
              )}
              <div className="grade-cartoes">
                {g.membros.map((u) => <CartaoPessoa key={u.id} u={u} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Configuração explícita de quem supervisiona quem — nada fixo no código,
// tudo definido aqui pela coordenação. Quem supervisiona também acompanha
// o fluxo dos visitantes de quem está abaixo (veja Ajuda → Papéis da equipe).
function CardHierarquia() {
  const s = useAppState()
  const ativos = s.usuarios.filter((u) => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const semSupervisor = ativos.filter(
    (u) => !u.supervisorId && !u.papeis.includes('coordenacao') && !u.papeis.includes('pastor'),
  ).length

  return (
    <div style={{ marginTop: 10 }}>
      <p className="descricao-secao">
        Defina aqui a quem cada pessoa responde. O supervisor também enxerga o acompanhamento de quem está abaixo dele —
        você controla isso, nada vem fixo no sistema. Integradores pós-culto novos já entram supervisionados pela Gestão Integração.
      </p>
      {semSupervisor > 0 && (
        <div className="alerta alerta-warn" style={{ marginBottom: 12 }}>
          ⚠️ <div>{semSupervisor} pessoa(s) sem supervisor definido — elas só veem o próprio fluxo.</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ativos.map((u) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="avatar" style={{ background: PAPEL_COR[u.papeis[0]], width: 30, height: 30, fontSize: 11.5 }}>{iniciais(u.nome)}</div>
            <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 150 }}>{u.nome}</span>
            <TagsPapeis u={u} />
            <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>é supervisionado por</span>
            <select
              value={u.supervisorId ?? ''}
              style={{ width: 'auto', minWidth: 180, padding: '5px 10px', fontSize: 13 }}
              onChange={(e) => definirSupervisor(s, u, e.target.value)}
            >
              <option value="">— ninguém (topo) —</option>
              {ativos.filter((x) => x.id !== u.id).map((x) => (
                <option key={x.id} value={x.id}>{x.nome} · {x.papeis.map((p) => rotuloPapel(p)).join(', ')}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

// Consulta rápida das Conexões e seus líderes — para checar se um grupo já
// existe. Só leitura; criar/editar continua em Configurações → Grupos.
function CardConexoes() {
  const s = useAppState()
  const termo = s.config.termoGrupo || 'Conexão'
  const [busca, setBusca] = useState('')
  const nomeLider = (id?: string) => s.usuarios.find((u) => u.id === id)?.nome
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(busca.trim())
  const lista = s.conexoes
    .filter((c) => {
      if (!q) return true
      const alvo = norm(`${c.nome} ${c.regiao} ${c.perfil} ${c.diaHorario} ${nomeLider(c.liderId) ?? ''} ${nomeLider(c.lider2Id) ?? ''}`)
      return alvo.includes(q)
    })
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <div style={{ marginTop: 10 }}>
      <p className="descricao-secao">
        Consulte os grupos e seus líderes — útil para checar se um já existe.
        Para criar ou editar, vá em <a href="#/config">Configurações → Grupos</a>.
      </p>
      <div className="search-box" style={{ marginBottom: 12 }}>
        <span className="search-icon"><IcoBusca /></span>
        <input type="text" placeholder={`Buscar ${termo.toLowerCase()} por nome, região, perfil ou líder…`} value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {s.conexoes.length === 0 ? (
        <div className="vazio">Nenhum grupo cadastrado ainda.</div>
      ) : lista.length === 0 ? (
        <div className="vazio">Nenhum grupo encontrado para "{busca}".</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.map((c) => {
            const l1 = nomeLider(c.liderId), l2 = nomeLider(c.lider2Id)
            return (
              <div key={c.id} className="conexao-linha">
                <div className="conexao-linha-icone">🏠</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {[c.regiao, c.perfil, c.diaHorario].filter(Boolean).join(' · ') || 'sem detalhes'}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {(l1 || l2) ? <>👤 {[l1, l2].filter(Boolean).join(' · ')}</> : <span style={{ color: 'var(--warn)' }}>sem líder</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CartaoPessoa({ u }: { u: Usuario }) {
  const s = useAppState()
  const [editando, setEditando] = useState(false)
  const conexao = s.conexoes.find((c) => c.id === u.conexaoId)

  // Mover líder de grupo pede confirmação (evita troca acidental)
  function mudarConexao(novaId: string) {
    if (u.conexaoId && novaId && novaId !== u.conexaoId) {
      const atual = s.conexoes.find((c) => c.id === u.conexaoId)?.nome ?? 'outro grupo'
      const nova = s.conexoes.find((c) => c.id === novaId)?.nome ?? ''
      if (!confirm(`⚠️ ${u.nome} já é líder de "${atual}".\n\nConfirmar a mudança para "${nova}"?`)) return
    }
    setEstado((st) => ({
      ...st,
      usuarios: st.usuarios.map((x) => x.id === u.id ? { ...x, conexaoId: novaId || undefined } : x),
      conexoes: st.conexoes.map((c) => {
        let cx = c
        if (c.id === u.conexaoId) {
          if (cx.liderId === u.id) cx = { ...cx, liderId: undefined }
          if (cx.lider2Id === u.id) cx = { ...cx, lider2Id: undefined }
        }
        if (c.id === novaId) {
          if (!cx.liderId) cx = { ...cx, liderId: u.id }
          else if (!cx.lider2Id) cx = { ...cx, lider2Id: u.id }
        }
        return cx
      }),
    }))
  }

  function mudar(patch: Partial<Usuario>) {
    setEstado((st) => ({ ...st, usuarios: st.usuarios.map((x) => x.id === u.id ? { ...x, ...patch } : x) }))
  }

  function remover() {
    if (!confirm(`Remover ${u.nome} da equipe? Esta ação não pode ser desfeita.`)) return
    setEstado((st) => comExclusoes({
      ...st,
      usuarios: st.usuarios.filter((x) => x.id !== u.id),
      conexoes: st.conexoes.map((c) => {
        let cx = c
        if (cx.liderId === u.id) cx = { ...cx, liderId: undefined }
        if (cx.lider2Id === u.id) cx = { ...cx, lider2Id: undefined }
        return cx
      }),
    }, 'usuario', [u.id]))
  }

  return (
    <div className="cartao-pessoa" style={{ opacity: u.ativo ? 1 : 0.55 }}>
      {u.fotoUrl ? (
        <img src={u.fotoUrl} alt="" className="avatar" style={{ objectFit: 'cover' }} />
      ) : (
        <div className="avatar" style={{ background: PAPEL_COR[u.papeis[0]] }}>{iniciais(u.nome)}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pessoa-nome">{u.nome}</div>
        <div style={{ margin: '4px 0 2px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <TagsPapeis u={u} />
          {!u.ativo && <span className="tag">Inativo</span>}
          {(u.statusAcesso === 'pendente_aprovacao' || u.statusAcesso === 'pendente_confirmacao_email') && (
            <span className="tag" style={{ background: '#f59e0b18', borderColor: '#f59e0b40', color: '#b47207' }}>
              {STATUS_ACESSO_LABEL[u.statusAcesso]}
            </span>
          )}
          {u.statusAcesso === 'aprovado' && <span className="tag" style={{ background: '#22c55e18', borderColor: '#22c55e40', color: '#15803d' }}>🔑 Com login</span>}
        </div>
        <div className="pessoa-sub">
          📱 {u.whatsapp}
          {u.papeis.includes('lider') && (conexao ? <> · 🏠 {conexao.nome}</> : <> · <span style={{ color: 'var(--warn)' }}>sem grupo</span></>)}
        </div>

        {editando && (
          <div className="pessoa-edicao" style={{ marginTop: 10 }}>
            <label className="campo"><span>Nome</span>
              <input type="text" value={u.nome} onChange={(e) => mudar({ nome: e.target.value })} autoFocus />
            </label>
            <div className="campo"><span>Funções (marque todas que se aplicam)</span>
              <EscolherPapeis papeis={u.papeis} onMudar={(novos) => mudar({ papeis: novos })} />
            </div>
            {u.papeis.includes('lider') && (
              <label className="campo"><span>Grupo que lidera</span>
                <select value={u.conexaoId ?? ''} onChange={(e) => mudarConexao(e.target.value)}>
                  <option value="">— sem grupo —</option>
                  {s.conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
            )}
            <label className="campo"><span>WhatsApp</span>
              <input type="tel" value={u.whatsapp} onChange={(e) => mudar({ whatsapp: e.target.value })} />
            </label>
            <label className="campo"><span>Supervisor (quem está acima)</span>
              <select value={u.supervisorId ?? ''} onChange={(e) => definirSupervisor(s, u, e.target.value)}>
                <option value="">— ninguém acima —</option>
                {s.usuarios.filter((x) => x.id !== u.id && x.ativo).map((x) => (
                  <option key={x.id} value={x.id}>{x.nome} · {x.papeis.map((p) => rotuloPapel(p)).join(', ')}</option>
                ))}
              </select>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Também editável na seção "Hierarquia" acima.</span>
            </label>
            <button className="btn btn-sec btn-mini" onClick={() => mudar({ ativo: !u.ativo })}>
              {u.ativo ? '⏸️ Desativar' : '▶️ Reativar'}
            </button>
          </div>
        )}
      </div>
      <div className="cartao-acoes">
        <a className="btn-icone whats" href={linkWhatsApp(u.whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp"><IcoWhats /></a>
        <button className="btn-icone" onClick={() => setEditando(!editando)} title="Editar"><IcoEditar /></button>
        <button className="btn-icone perigo" onClick={remover} title="Remover"><IcoLixeira /></button>
      </div>
    </div>
  )
}

function FormUsuario({ onPronto }: { onPronto: () => void }) {
  const s = useAppState()
  const [nome, setNome] = useState('')
  const [whats, setWhats] = useState('')
  const [email, setEmail] = useState('')
  const [papeis, setPapeis] = useState<Papel[]>(['consolidador'])
  const [conexaoId, setConexaoId] = useState('')

  function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !whats.trim() || papeis.length === 0) return
    const id = uid()
    // Integrador pós-culto novo já entra supervisionado pela Gestão Integração
    const gestorPadrao = papeis.includes('consolidador') ? primeiraGestaoIntegracao(s) : undefined
    setEstado((st) => ({
      ...st,
      usuarios: [...st.usuarios, {
        id, nome: nome.trim(), whatsapp: whats.trim(), email: email.trim() || undefined,
        papeis, ativo: true, statusAcesso: 'sem_login',
        conexaoId: papeis.includes('lider') ? (conexaoId || undefined) : undefined,
        supervisorId: gestorPadrao?.id,
      }],
      conexoes: papeis.includes('lider') && conexaoId
        ? st.conexoes.map((c) => {
            if (c.id !== conexaoId) return c
            if (!c.liderId) return { ...c, liderId: id }
            if (!c.lider2Id) return { ...c, lider2Id: id }
            return c
          })
        : st.conexoes,
    }))
    onPronto()
  }

  return (
    <form className="bloco-form" onSubmit={adicionar}>
      <div className="linha-campos">
        <label className="campo"><span>Nome *</span>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        <label className="campo"><span>WhatsApp *</span>
          <input type="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(00) 90000-0000" />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>E-mail (opcional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div className="campo"><span>Funções * (marque todas que se aplicam)</span>
          <EscolherPapeis papeis={papeis} onMudar={setPapeis} />
        </div>
      </div>
      {papeis.includes('lider') && (
        <label className="campo"><span>Grupo do líder</span>
          <select value={conexaoId} onChange={(e) => setConexaoId(e.target.value)}>
            <option value="">— definir depois —</option>
            {s.conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      )}
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0' }}>
        💡 Este cadastro rápido não cria login. Para a pessoa ter a própria senha, envie a ela o
        link <b>#/cadastro-integrante</b> — o acesso passa por confirmação de e-mail e aprovação.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="submit">Adicionar à equipe</button>
        <button className="btn btn-sec" type="button" onClick={onPronto}>Cancelar</button>
      </div>
    </form>
  )
}
