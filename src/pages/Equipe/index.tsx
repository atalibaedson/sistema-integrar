import { useState, type ReactNode } from 'react'
import { useAppState } from '../../store'
import { PAPEL_COR, PAPEL_LABEL, rotuloPapel, type Papel, type Usuario } from '../../types'
import { linkWhatsApp } from '../../actions'
import { navegar } from '../../router'
import { IcoAlerta, IcoBusca, IcoCasa, IcoEditar, IcoMais, IcoRelogio, IcoSeta, IcoUserCheck, IcoUsuarios, IcoWhats } from '../../icones'
import Avatar from '../../Avatar'
import { ChipAcesso, ChipsPapeis, primeiroNome, semSupervisor, supervisorAtivo, ehTopo } from './comum'
import EditarMembro from './EditarMembro'
import NovoMembro from './NovoMembro'
import Hierarquia from './Hierarquia'

type Visao = 'pessoas' | 'hierarquia'
type FiltroAcesso = 'todos' | 'com_acesso' | 'pendente' | 'sem_login'

const FILTROS_ACESSO: { id: FiltroAcesso; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos os acessos' },
  { id: 'com_acesso', rotulo: 'Com acesso' },
  { id: 'pendente', rotulo: 'Aguardando aprovação' },
  { id: 'sem_login', rotulo: 'Sem login' },
]

const passaAcesso = (u: Usuario, f: FiltroAcesso): boolean =>
  f === 'todos' ||
  (f === 'com_acesso' && u.statusAcesso === 'aprovado') ||
  (f === 'pendente' && (u.statusAcesso === 'pendente_aprovacao' || u.statusAcesso === 'pendente_confirmacao_email')) ||
  (f === 'sem_login' && u.statusAcesso === 'sem_login')

// Quadradinho do resumo no topo. Com `onClick` é um atalho (filtra ou leva à tela certa).
function Resumo({ icone, tom, valor, rotulo, dica, onClick }: {
  icone: ReactNode; tom: 'acc' | 'ok' | 'warn' | 'neutro'; valor: number; rotulo: string; dica?: string; onClick?: () => void
}) {
  const conteudo = (
    <>
      <span className={`painel-ico painel-ico-${tom}`}>{icone}</span>
      <span className="eq-resumo-txt">
        <b>{valor}</b>
        <span>{rotulo}</span>
        {dica && <small>{dica}</small>}
      </span>
      {onClick && <span className="painel-seta"><IcoSeta size={16} /></span>}
    </>
  )
  return onClick
    ? <button type="button" className="eq-resumo clicavel" onClick={onClick}>{conteudo}</button>
    : <div className="eq-resumo">{conteudo}</div>
}

// Equipe — quem cuida dos visitantes, por função, e a quem cada pessoa responde.
export default function Equipe() {
  const s = useAppState()
  const papeis = Object.keys(PAPEL_LABEL) as Papel[]
  const [visao, setVisao] = useState<Visao>('pessoas')
  const [aba, setAba] = useState<Papel | 'todos'>('todos')
  const [acesso, setAcesso] = useState<FiltroAcesso>('todos')
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [novo, setNovo] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const nomeConexao = (id?: string) => s.conexoes.find((c) => c.id === id)?.nome
  const ativos = s.usuarios.filter((u) => u.ativo)
  const inativos = s.usuarios.length - ativos.length
  const conta = (p: Papel) => ativos.filter((u) => u.papeis.includes(p)).length

  const termo = busca.trim().toLowerCase()
  const lista = s.usuarios
    .filter((u) => aba === 'todos' || u.papeis.includes(aba))
    .filter((u) => mostrarInativos || u.ativo)
    .filter((u) => passaAcesso(u, acesso))
    .filter((u) => !termo || `${u.nome} ${u.whatsapp} ${u.email ?? ''} ${nomeConexao(u.conexaoId) ?? ''}`.toLowerCase().includes(termo))
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'))

  const comAcesso = ativos.filter((u) => u.statusAcesso === 'aprovado').length
  const pendentes = ativos.filter((u) => u.statusAcesso === 'pendente_aprovacao' || u.statusAcesso === 'pendente_confirmacao_email').length
  const soltos = ativos.filter((u) => semSupervisor(s, u)).length
  const filtrando = aba !== 'todos' || acesso !== 'todos' || !!termo

  // A gaveta sempre mostra o dado mais recente do estado (a pessoa pode mudar por sincronização)
  const editando = editandoId ? s.usuarios.find((u) => u.id === editandoId) ?? null : null

  function limparFiltros() {
    setAba('todos'); setAcesso('todos'); setBusca('')
  }

  return (
    <div className="equipe">
      <div className="cab-detalhe">
        <div>
          <h1 className="titulo-pagina">Equipe</h1>
          <p className="subtitulo">Quem cuida dos visitantes, por função, e a quem cada pessoa responde.</p>
        </div>
        <div className="eq-cab-acoes">
          <div className="eq-segmento" role="tablist" aria-label="Visão da equipe">
            <button type="button" role="tab" aria-selected={visao === 'pessoas'} className={visao === 'pessoas' ? 'sel' : ''} onClick={() => setVisao('pessoas')}>
              <IcoUsuarios size={15} /> Pessoas
            </button>
            <button type="button" role="tab" aria-selected={visao === 'hierarquia'} className={visao === 'hierarquia' ? 'sel' : ''} onClick={() => setVisao('hierarquia')}>
              <IcoUserCheck size={15} /> Hierarquia
            </button>
          </div>
          <button type="button" className="btn" onClick={() => setNovo(true)}><IcoMais size={15} /> Novo membro</button>
        </div>
      </div>

      {/* Resumo: o retrato da equipe de relance, com atalho para o que pede ação */}
      <div className="eq-resumos">
        <Resumo
          icone={<IcoUsuarios size={18} />} tom="acc" valor={ativos.length} rotulo="Na equipe"
          dica={inativos > 0 ? `${inativos} ${inativos === 1 ? 'inativa' : 'inativas'}` : undefined}
          onClick={visao === 'pessoas' ? limparFiltros : undefined}
        />
        <Resumo
          icone={<IcoUserCheck size={18} />} tom="ok" valor={comAcesso} rotulo="Com acesso ao sistema"
          dica={ativos.length > comAcesso ? `${ativos.length - comAcesso} sem acesso` : 'Toda a equipe'}
          onClick={() => { setVisao('pessoas'); setAcesso('com_acesso') }}
        />
        <Resumo
          icone={<IcoRelogio size={18} />} tom={pendentes > 0 ? 'warn' : 'neutro'} valor={pendentes} rotulo="Aguardando aprovação"
          dica={pendentes > 0 ? 'Abrir Aprovações' : 'Nenhum pedido pendente'}
          onClick={pendentes > 0 ? () => navegar('/aprovacoes') : undefined}
        />
        <Resumo
          icone={<IcoAlerta size={18} />} tom={soltos > 0 ? 'warn' : 'neutro'} valor={soltos} rotulo="Sem supervisor"
          dica={soltos > 0 ? 'Ver a hierarquia' : 'Hierarquia completa'}
          onClick={soltos > 0 ? () => setVisao('hierarquia') : undefined}
        />
      </div>

      {visao === 'hierarquia' ? (
        <Hierarquia onAbrir={(u) => setEditandoId(u.id)} />
      ) : (
        <>
          {/* Filtro por função (com a cor de cada uma) */}
          <div className="pilulas" role="tablist" aria-label="Filtrar por função">
            <button type="button" role="tab" aria-selected={aba === 'todos'} className={`pilula ${aba === 'todos' ? 'sel' : ''}`} onClick={() => setAba('todos')}>
              Todos <span className="pilula-n">{ativos.length}</span>
            </button>
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
          </div>

          <div className="vis-barra">
            <div className="search-box vis-busca">
              <span className="search-icon"><IcoBusca /></span>
              <input
                type="text" placeholder="Buscar por nome, WhatsApp, e-mail ou grupo…"
                value={busca} onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <select className="vis-resp" value={acesso} onChange={(e) => setAcesso(e.target.value as FiltroAcesso)} aria-label="Filtrar por acesso">
              {FILTROS_ACESSO.map((f) => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
            </select>
            {inativos > 0 && (
              <label className="check equipe-inativos">
                <input type="checkbox" checked={mostrarInativos} onChange={() => setMostrarInativos(!mostrarInativos)} />
                Mostrar inativos ({inativos})
              </label>
            )}
            <span className="vis-total">{lista.length} {lista.length === 1 ? 'pessoa' : 'pessoas'}</span>
          </div>

          <div className="card vis-lista">
            <div className="vis-cab eq-grade" aria-hidden>
              <span /><span>Pessoa</span><span>Funções</span><span>Organização</span><span>Acesso</span><span />
            </div>
            {lista.length === 0 ? (
              <div className="painel-vazio">
                Ninguém encontrado com esse filtro.
                {filtrando && <> <button type="button" className="eq-limpar" onClick={limparFiltros}>Limpar filtros</button></>}
              </div>
            ) : lista.map((u) => {
              const sup = supervisorAtivo(s, u)
              const grupo = nomeConexao(u.conexaoId)
              return (
                <div
                  key={u.id} className={`vis-linha eq-grade eq-linha ${u.ativo ? '' : 'inativo'}`}
                  role="button" tabIndex={0} onClick={() => setEditandoId(u.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditandoId(u.id) }}
                >
                  <Avatar nome={u.nome} tom={PAPEL_COR[u.papeis[0]]} foto={u.fotoUrl} />
                  <div className="vis-pessoa">
                    <b>{u.nome}</b>
                    <span>{[u.whatsapp, u.email].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div className="eq-funcoes"><ChipsPapeis papeis={u.papeis} /></div>
                  <div className="eq-org">
                    {u.papeis.includes('lider') && (
                      <span><IcoCasa size={12} /> {grupo ?? <em className="vis-sem-resp">sem grupo</em>}</span>
                    )}
                    <span>
                      {sup
                        ? <>Supervisor: <b>{primeiroNome(sup.nome)}</b></>
                        : ehTopo(u) ? <em className="eq-topo">Topo da hierarquia</em> : <em className="vis-sem-resp">sem supervisor</em>}
                    </span>
                  </div>
                  <div className="eq-acesso"><ChipAcesso u={u} /></div>
                  <div className="eq-acoes">
                    <a
                      className="btn-icone whats" href={linkWhatsApp(u.whatsapp)} target="_blank" rel="noreferrer"
                      title="WhatsApp" aria-label={`WhatsApp de ${u.nome}`}
                      onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
                    ><IcoWhats /></a>
                    <span className="btn-icone" aria-hidden title="Editar"><IcoEditar /></span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {novo && <NovoMembro onFechar={() => setNovo(false)} />}
      {editando && <EditarMembro key={editando.id} u={editando} onFechar={() => setEditandoId(null)} />}
    </div>
  )
}
