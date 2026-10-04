import { useEffect, useState } from 'react'
import { comExclusoes, primeiraGestaoIntegracao, setEstado, uid, useAppState } from '../store'
import { PAPEL_COR, PAPEL_LABEL, rotuloPapel, STATUS_ACESSO_LABEL, type AppState, type Papel, type Usuario } from '../types'
import { linkWhatsApp } from '../actions'
import { criariCiclo } from '../acesso'
import { registrarAuditoria } from '../auditoria'
import { toast } from '../toast'
import { confirmar } from '../confirmar'
import { IcoAlerta, IcoBusca, IcoCasa, IcoCheck, IcoEditar, IcoLixeira, IcoMais, IcoWhats, IcoX } from '../icones'
import Avatar from '../Avatar'
import { supabase } from '../supabaseClient'

// Muda o supervisor de `alvo`, com validação de ciclo e registro em auditoria.
// Usado tanto na seção de Hierarquia quanto no modal de edição.
export function definirSupervisor(s: AppState, alvo: Usuario, novoSupervisorId: string) {
  if (novoSupervisorId && criariCiclo(s, alvo.id, novoSupervisorId)) {
    toast(`Não é possível: ${alvo.nome} já supervisiona (direta ou indiretamente) essa pessoa. Isso criaria um ciclo na hierarquia.`, 'erro')
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

// Situação do acesso (login) — etiquetas semânticas, legíveis no claro e no escuro
function TagsAcesso({ u }: { u: Usuario }) {
  return (
    <>
      {!u.ativo && <span className="tag">Inativo</span>}
      {(u.statusAcesso === 'pendente_aprovacao' || u.statusAcesso === 'pendente_confirmacao_email') && (
        <span className="tag tag-warn">{STATUS_ACESSO_LABEL[u.statusAcesso]}</span>
      )}
      {u.statusAcesso === 'aprovado' && <span className="tag tag-ok">Com login</span>}
    </>
  )
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
    const mudou = [
      dNome.trim() !== u.nome ? `nome: "${u.nome}" → "${dNome.trim()}"` : '',
      dWhats.trim() !== u.whatsapp ? 'WhatsApp' : '',
      JSON.stringify([...dPapeis].sort()) !== JSON.stringify([...u.papeis].sort()) ? `funções: ${dPapeis.map((p) => rotuloPapel(p)).join(', ')}` : '',
    ].filter(Boolean).join(' · ')
    if (mudou) registrarAuditoria('✏️ Editou integrante', { alvoTipo: 'usuario', alvoId: u.id, alvoNome: dNome.trim(), detalhe: mudou })
    toast('Membro salvo')
    onFechar()
  }

  async function mudarConexao(novaId: string) {
    if (u.conexaoId && novaId && novaId !== u.conexaoId) {
      const atual = s.conexoes.find((c) => c.id === u.conexaoId)?.nome ?? 'outro grupo'
      const nova = s.conexoes.find((c) => c.id === novaId)?.nome ?? ''
      if (!(await confirmar({ titulo: 'Trocar o grupo do líder', mensagem: `${u.nome} já é líder de "${atual}".\n\nConfirmar a mudança para "${nova}"?`, confirmar: 'Confirmar mudança' }))) return
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
    registrarAuditoria(u.ativo ? '⏸ Desativou integrante' : '▶ Reativou integrante', {
      alvoTipo: 'usuario', alvoId: u.id, alvoNome: u.nome,
    })
    toast(u.ativo ? 'Membro desativado' : 'Membro reativado', 'info')
    onFechar()
  }

  // Visitantes que dependem desta pessoa (responsável ou líder designado)
  const dependentes = s.visitantes.filter((v) => v.responsavelId === u.id || v.liderConexaoId === u.id)

  async function remover() {
    const aviso = dependentes.length > 0
      ? `\n\n⚠️ ${u.nome} cuida de ${dependentes.length} visitante(s) — eles ficarão SEM responsável/líder e precisarão ser redistribuídos. Se a pessoa só saiu por um tempo, prefira "Desativar".`
      : ''
    if (!(await confirmar({ titulo: 'Remover integrante', mensagem: `Remover ${u.nome} da equipe? Esta ação não pode ser desfeita.${aviso}`, confirmar: 'Excluir', perigo: true }))) return
    const authUserId = u.authUserId
    const agora = new Date().toISOString()
    setEstado((st) => comExclusoes({
      ...st,
      usuarios: st.usuarios.filter((x) => x.id !== u.id),
      // Solta os vínculos de vez: visitante com responsável "fantasma" não
      // aparecia em nenhum filtro, e ninguém o reassumia.
      visitantes: st.visitantes.map((v) =>
        v.responsavelId === u.id || v.liderConexaoId === u.id
          ? {
            ...v,
            responsavelId: v.responsavelId === u.id ? undefined : v.responsavelId,
            liderConexaoId: v.liderConexaoId === u.id ? undefined : v.liderConexaoId,
            atualizadoEm: agora,
          }
          : v,
      ),
      conexoes: st.conexoes.map((c) => {
        let cx = c
        if (cx.liderId === u.id) cx = { ...cx, liderId: undefined }
        if (cx.lider2Id === u.id) cx = { ...cx, lider2Id: undefined }
        return cx
      }),
    }, 'usuario', [u.id]))
    registrarAuditoria('🗑️ Removeu integrante da equipe', {
      alvoTipo: 'usuario', alvoId: u.id, alvoNome: u.nome,
      detalhe: `Funções: ${u.papeis.map((p) => rotuloPapel(p)).join(', ')}` +
        (dependentes.length > 0 ? ` · ${dependentes.length} visitante(s) ficaram sem responsável/líder: ${dependentes.map((v) => v.nome).join(', ')}` : ''),
    })
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
          <Avatar nome={u.nome} tom={PAPEL_COR[u.papeis[0]]} foto={u.fotoUrl} />
          <h3>{u.nome}</h3>
          <button className="btn-icone" onClick={onFechar} title="Fechar" aria-label="Fechar"><IcoX size={16} /></button>
        </div>

        {/* Corpo */}
        <div className="modal-corpo">

          {/* Status de acesso */}
          {u.statusAcesso && u.statusAcesso !== 'sem_login' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <TagsPapeis u={u} />
              <TagsAcesso u={u} />
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
              {u.ativo ? 'Desativar' : 'Reativar'}
            </button>
          </div>

          <div className="modal-perigo" style={{ marginTop: 0 }}>
            <span>Excluir remove permanentemente e libera o e-mail.</span>
            <button className="btn btn-mini btn-perigo-forte" onClick={remover}>
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
    <div className="equipe">
      <div className="cab-detalhe">
        <div>
          <h1 className="titulo-pagina">Equipe</h1>
          <p className="subtitulo">Quem cuida dos visitantes, por função. Uma pessoa pode exercer mais de uma.</p>
        </div>
        <button className="btn" onClick={() => setNovo(!novo)}>{novo ? 'Fechar' : <><IcoMais size={15} /> Novo membro</>}</button>
      </div>

      {novo && (
        <div className="card">
          <h3>Novo membro</h3>
          <FormUsuario onPronto={() => setNovo(false)} />
        </div>
      )}

      {/* Filtro por função (com a cor de cada uma) */}
      <div className="pilulas" role="tablist" aria-label="Filtrar por função">
        {papeis.map((p) => (
          <button
            key={p} type="button" role="tab" aria-selected={aba === p}
            className={`pilula ${aba === p ? 'sel' : ''}`} onClick={() => setAba(p)}
          >
            <i className="pilula-ponto" style={{ background: PAPEL_COR[p] }} />
            {rotuloPapel(p)}
            <span className="pilula-n">{conta(p)}</span>
          </button>
        ))}
        <button type="button" role="tab" aria-selected={aba === 'todos'} className={`pilula ${aba === 'todos' ? 'sel' : ''}`} onClick={() => setAba('todos')}>
          Todos <span className="pilula-n">{s.usuarios.filter((u) => u.ativo).length}</span>
        </button>
      </div>

      <div className="vis-barra">
        <div className="search-box vis-busca">
          <span className="search-icon"><IcoBusca /></span>
          <input
            type="text"
            placeholder="Buscar por nome, WhatsApp ou grupo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {inativos > 0 && (
          <label className="check equipe-inativos">
            <input type="checkbox" checked={mostrarInativos} onChange={() => setMostrarInativos(!mostrarInativos)} />
            Mostrar inativos ({inativos})
          </label>
        )}
        <span className="vis-total">{lista.length} {lista.length === 1 ? 'pessoa' : 'pessoas'}</span>
      </div>

      {lista.length === 0 ? (
        <div className="card"><div className="painel-vazio">Ninguém encontrado com esse filtro.</div></div>
      ) : (
        grupos.map((g) => (
          <section key={g.papel} className="equipe-grupo">
            {aba === 'todos' && (
              <div className="painel-secao-cab">
                <h2><i className="pilula-ponto" style={{ background: PAPEL_COR[g.papel] }} /> {rotuloPapel(g.papel)} <span className="painel-contagem">{g.membros.length}</span></h2>
              </div>
            )}
            <div className="grade-cartoes">
              {g.membros.map((u) => (
                <CartaoPessoa key={u.id} u={u} onEditar={() => setPessoaEditando(u)} />
              ))}
            </div>
          </section>
        ))
      )}

      <details className="card equipe-hierarquia">
        <summary>Hierarquia — quem supervisiona quem</summary>
        <CardHierarquia />
      </details>

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
          <IcoAlerta size={16} /><div>{semSupervisor} pessoa(s) sem supervisor definido — elas só veem o próprio fluxo.</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ativos.map((u) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Avatar nome={u.nome} tom={PAPEL_COR[u.papeis[0]]} tamanho="p" foto={u.fotoUrl} />
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

function CartaoPessoa({ u, onEditar }: { u: Usuario; onEditar: () => void }) {
  const s = useAppState()
  const conexao = s.conexoes.find((c) => c.id === u.conexaoId)

  return (
    <div className={`cartao-pessoa ${u.ativo ? '' : 'inativo'}`}>
      <Avatar nome={u.nome} tom={PAPEL_COR[u.papeis[0]]} foto={u.fotoUrl} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pessoa-nome">{u.nome}</div>
        <div className="cartao-tags">
          <TagsPapeis u={u} />
          <TagsAcesso u={u} />
        </div>
        <div className="pessoa-sub cartao-sub">
          <span>{u.whatsapp}</span>
          {u.papeis.includes('lider') && (
            <span><IcoCasa size={12} /> {conexao ? conexao.nome : <em className="ficha-falta">sem grupo</em>}</span>
          )}
        </div>
      </div>
      <div className="cartao-acoes">
        <a className="btn-icone whats" href={linkWhatsApp(u.whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp" aria-label={`WhatsApp de ${u.nome}`}><IcoWhats /></a>
        <button className="btn-icone" onClick={onEditar} title="Editar" aria-label={`Editar ${u.nome}`}><IcoEditar /></button>
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
    registrarAuditoria('➕ Adicionou integrante à equipe', {
      alvoTipo: 'usuario', alvoId: id, alvoNome: nome.trim(),
      detalhe: `Funções: ${papeis.map((p) => rotuloPapel(p)).join(', ')}`,
    })
    onPronto()
  }

  return (
    <form onSubmit={adicionar}>
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
        Este cadastro rápido não cria login. Para a pessoa ter a própria senha, envie a ela o
        link <b>#/cadastro-integrante</b> — o acesso passa pela aprovação da liderança.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" type="submit">Adicionar à equipe</button>
        <button className="btn btn-sec" type="button" onClick={onPronto}>Cancelar</button>
      </div>
    </form>
  )
}
