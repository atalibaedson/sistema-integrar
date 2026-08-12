import { useEffect, useState } from 'react'
import { comExclusoes, primeiraGestaoIntegracao, setEstado, uid, useAppState } from '../store'
import { PAPEL_COR, PAPEL_LABEL, rotuloPapel, STATUS_ACESSO_LABEL, type AppState, type Papel, type Usuario } from '../types'
import { linkWhatsApp } from '../actions'
import { criariCiclo } from '../acesso'
import { registrarAuditoria } from '../auditoria'
import { toast } from '../toast'
import { IcoBusca, IcoCheck, IcoEditar, IcoLixeira, IcoMais, IcoWhats } from '../icones'
import { supabase } from '../supabaseClient'

// Muda o supervisor de `alvo`, com validação de ciclo e registro em auditoria.
// Usado tanto na seção de Hierarquia quanto no modal de edição.
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

function EscolherPapeis({ papeis, onMudar }: { papeis: Papel[]; onMudar: (novos: Papel[]) => void }) {
  function alternar(p: Papel) {
    const novos = papeis.includes(p) ? papeis.filter((x) => x !== p) : [...papeis, p]
    if (novos.length === 0) return
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

// ---- Modal de edição de membro ----

function ModalEditarMembro({ u, onFechar }: { u: Usuario; onFechar: () => void }) {
  const s = useAppState()
  const [dNome, setDNome] = useState(u.nome)
  const [dWhats, setDWhats] = useState(u.whatsapp)
  const [dPapeis, setDPapeis] = useState<Papel[]>(u.papeis)

  // Fecha com Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onFechar])

  function salvar() {
    if (!dNome.trim() || !dWhats.trim() || dPapeis.length === 0) return
    setEstado((st) => ({
      ...st,
      usuarios: st.usuarios.map((x) =>
        x.id === u.id ? { ...x, nome: dNome.trim(), whatsapp: dWhats.trim(), papeis: dPapeis } : x,
      ),
    }))
    toast('Membro salvo')
    onFechar()
  }

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

  function alternarAtivo() {
    setEstado((st) => ({
      ...st,
      usuarios: st.usuarios.map((x) => x.id === u.id ? { ...x, ativo: !u.ativo } : x),
    }))
    toast(u.ativo ? 'Membro desativado' : 'Membro reativado', 'info')
    onFechar()
  }

  async function remover() {
    if (!confirm(`Remover ${u.nome} da equipe? Esta ação não pode ser desfeita.`)) return
    const authUserId = u.authUserId
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
    if (authUserId && supabase) {
      try {
        await supabase.functions.invoke('deletar-usuario-auth', { body: { authUserId } })
      } catch {
        // falha silenciosa: o usuário já foi removido do app
      }
    }
    onFechar()
  }

  const conexao = s.conexoes.find((c) => c.id === u.conexaoId)

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>

        {/* Cabeçalho */}
        <div className="modal-cab">
          <div className="avatar" style={{ background: PAPEL_COR[u.papeis[0]], width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>
            {u.fotoUrl
              ? <img src={u.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : iniciais(u.nome)}
          </div>
          <h3>{u.nome}</h3>
          <button className="btn-icone" onClick={onFechar} title="Fechar" style={{ fontSize: 16, marginLeft: 4 }}>✕</button>
        </div>

        {/* Corpo */}
        <div className="modal-corpo">

          {/* Status de acesso */}
          {u.statusAcesso && u.statusAcesso !== 'sem_login' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <TagsPapeis u={u} />
              {!u.ativo && <span className="tag">Inativo</span>}
              {(u.statusAcesso === 'pendente_aprovacao' || u.statusAcesso === 'pendente_confirmacao_email') && (
                <span className="tag" style={{ background: '#f59e0b18', borderColor: '#f59e0b40', color: '#b47207' }}>
                  {STATUS_ACESSO_LABEL[u.statusAcesso]}
                </span>
              )}
              {u.statusAcesso === 'aprovado' && (
                <span className="tag" style={{ background: '#22c55e18', borderColor: '#22c55e40', color: '#15803d' }}>🔑 Com login</span>
              )}
            </div>
          )}

          {/* Campos com rascunho (salvos ao clicar Salvar) */}
          <label className="campo">
            <span>Nome</span>
            <input type="text" value={dNome} onChange={(e) => setDNome(e.target.value)} autoFocus />
          </label>

          <label className="campo">
            <span>WhatsApp</span>
            <input type="tel" value={dWhats} onChange={(e) => setDWhats(e.target.value)} />
          </label>

          <div className="campo">
            <span>Funções (marque todas que se aplicam)</span>
            <EscolherPapeis papeis={dPapeis} onMudar={setDPapeis} />
          </div>

          <hr className="modal-separador" />

          {/* Campos com efeito imediato */}
          {dPapeis.includes('lider') && (
            <label className="campo">
              <span>
                Grupo que lidera{' '}
                <em style={{ fontStyle: 'normal', color: 'var(--text-3)', fontWeight: 500 }}>(salvo na hora)</em>
              </span>
              <select value={u.conexaoId ?? ''} onChange={(e) => mudarConexao(e.target.value)}>
                <option value="">— sem grupo —</option>
                {s.conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {conexao && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Atual: {conexao.nome}</span>}
            </label>
          )}

          <label className="campo">
            <span>
              Supervisor{' '}
              <em style={{ fontStyle: 'normal', color: 'var(--text-3)', fontWeight: 500 }}>(salvo na hora)</em>
            </span>
            <select value={u.supervisorId ?? ''} onChange={(e) => definirSupervisor(s, u, e.target.value)}>
              <option value="">— ninguém acima —</option>
              {s.usuarios.filter((x) => x.id !== u.id && x.ativo).map((x) => (
                <option key={x.id} value={x.id}>{x.nome} · {x.papeis.map((p) => rotuloPapel(p)).join(', ')}</option>
              ))}
            </select>
          </label>

          <hr className="modal-separador" />

          {/* Zona de perigo */}
          <div className="modal-perigo">
            <span>{u.ativo ? 'Desativar bloqueia o acesso sem excluir o histórico.' : 'Membro está inativo.'}</span>
            <button className="btn btn-sec btn-mini" onClick={alternarAtivo}>
              {u.ativo ? '⏸ Desativar' : '▶ Reativar'}
            </button>
          </div>

          <div className="modal-perigo" style={{ marginTop: 0 }}>
            <span>Excluir remove permanentemente e libera o e-mail.</span>
            <button className="btn btn-mini" style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }} onClick={remover}>
              <IcoLixeira size={13} /> Excluir
            </button>
          </div>

        </div>

        {/* Rodapé */}
        <div className="modal-rodape">
          <button className="btn" onClick={salvar} disabled={!dNome.trim() || !dWhats.trim() || dPapeis.length === 0}>
            <IcoCheck size={14} /> Salvar alterações
          </button>
          <button className="btn btn-sec" onClick={onFechar}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ---- Área de equipe ----

export default function Equipe() {
  const s = useAppState()
  const papeis = Object.keys(PAPEL_LABEL) as Papel[]
  const [aba, setAba] = useState<Papel | 'todos'>(papeis[0])
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [novo, setNovo] = useState(false)
  const [pessoaEditando, setPessoaEditando] = useState<Usuario | null>(null)

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

  // Ao abrir o modal, usa o dado mais recente do estado global
  const pessoaAtualizada = pessoaEditando
    ? s.usuarios.find((u) => u.id === pessoaEditando.id) ?? null
    : null

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
                {g.membros.map((u) => (
                  <CartaoPessoa key={u.id} u={u} onEditar={() => setPessoaEditando(u)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {pessoaAtualizada && (
        <ModalEditarMembro u={pessoaAtualizada} onFechar={() => setPessoaEditando(null)} />
      )}
    </div>
  )
}

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
      const alvo = norm(`${c.nome} ${c.endereco ?? ''} ${c.bairro ?? ''} ${c.cidade ?? ''} ${c.perfil} ${c.diaHorario} ${nomeLider(c.liderId) ?? ''} ${nomeLider(c.lider2Id) ?? ''}`)
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
                    {[[c.bairro, c.cidade].filter(Boolean).join(' · '), c.perfil, c.diaHorario].filter(Boolean).join(' · ') || 'sem detalhes'}
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

function CartaoPessoa({ u, onEditar }: { u: Usuario; onEditar: () => void }) {
  const s = useAppState()
  const conexao = s.conexoes.find((c) => c.id === u.conexaoId)

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
      </div>
      <div className="cartao-acoes">
        <a className="btn-icone whats" href={linkWhatsApp(u.whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp"><IcoWhats /></a>
        <button className="btn-icone" onClick={onEditar} title="Editar"><IcoEditar /></button>
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
