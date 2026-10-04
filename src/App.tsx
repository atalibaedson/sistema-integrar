import { Suspense, useEffect, useState } from 'react'
import { useRota } from './router'
import { useAppState, useNuvem, tentarSincronizarAgora } from './store'
import { setUsuarioAtualId, useUsuarioAtualId, podeVerCuidado, podeAcessarRota, soAcolhedor, soLider, useSessaoReal, useSessaoCarregada, usuarioDaSessao } from './acesso'
import { garantirSessao, sairDaConta } from './supabaseClient'
import { confirmar } from './confirmar'
import { getModoTema, alternarModoTema } from './tema-modo'
import { useIgrejasDoUsuario, useVinculos, type IgrejaAcesso, trocarIgreja, lembrarNomeIgreja, igrejaAtivaId } from './igrejas'
import { getIgrejaAtiva } from './nuvem'
import { garantirFichaMembroRede } from './actions'
import { aplicarRotulos, rotuloPapel, type Usuario } from './types'
import { corDeContraste } from './tema'
import { IcoAjuda, IcoAuditoria, IcoCasa, IcoConfig, IcoJornada, IcoLua, IcoMais, IcoMenu, IcoPainel, IcoRelatorios, IcoSair, IcoSol, IcoTrocar, IcoUserCheck, IcoUserPlus, IcoUsuarios } from './icones'
import { lazyComRecarga } from './carregar'
import Dashboard from './pages/Dashboard'
import Visitantes from './pages/Visitantes'
import VisitanteDetalhe from './pages/VisitanteDetalhe'
import NovoVisitante from './pages/NovoVisitante'
import Autocadastro from './pages/Autocadastro'
import Entrar from './pages/Entrar'
import NovaSenha from './pages/NovaSenha'
import AguardandoAprovacao from './pages/AguardandoAprovacao'

// Telas de uso menos frequente carregam sob demanda: a abertura do app (e a
// página pública do visitante) baixa só o essencial.
const Jornada = lazyComRecarga(() => import('./pages/Jornada'))
const PainelLider = lazyComRecarga(() => import('./pages/PainelLider'))
const Equipe = lazyComRecarga(() => import('./pages/Equipe'))
const Configuracoes = lazyComRecarga(() => import('./pages/Configuracoes'))
const Ajuda = lazyComRecarga(() => import('./pages/Ajuda'))
const Auditoria = lazyComRecarga(() => import('./pages/Auditoria'))
const CadastroIntegrante = lazyComRecarga(() => import('./pages/CadastroIntegrante'))
const Aprovacoes = lazyComRecarga(() => import('./pages/Aprovacoes'))
const Relatorios = lazyComRecarga(() => import('./pages/Relatorios'))
const VisitanteDados = lazyComRecarga(() => import('./pages/VisitanteDados'))

type ItemMenu = { rota: string; icone: (p: { size?: number }) => JSX.Element; rotulo: string }

const MENU: { secao: string; itens: ItemMenu[] }[] = [
  {
    secao: 'Acompanhamento',
    itens: [
      { rota: '/', icone: IcoPainel, rotulo: 'Painel' },
      { rota: '/jornada', icone: IcoJornada, rotulo: 'Jornada' },
      { rota: '/visitantes', icone: IcoUsuarios, rotulo: 'Visitantes' },
      { rota: '/novo', icone: IcoUserPlus, rotulo: 'Novo visitante' },
      { rota: '/lideres', icone: IcoUserCheck, rotulo: 'Painel do líder' },
    ],
  },
  {
    secao: 'Gestão',
    itens: [
      { rota: '/equipe', icone: IcoUsuarios, rotulo: 'Equipe' },
      { rota: '/aprovacoes', icone: IcoUserCheck, rotulo: 'Aprovações' },
      { rota: '/relatorios', icone: IcoRelatorios, rotulo: 'Relatórios' },
      { rota: '/auditoria', icone: IcoAuditoria, rotulo: 'Auditoria' },
    ],
  },
  {
    secao: 'Igreja',
    itens: [
      { rota: '/config', icone: IcoConfig, rotulo: 'Configurações' },
      { rota: '/ajuda', icone: IcoAjuda, rotulo: 'Ajuda' },
    ],
  },
]

// Navegação inferior (celular): principais na zona do polegar + "Mais"
const NAV_PRINCIPAL: (ItemMenu & { destaque?: boolean })[] = [
  { rota: '/', icone: IcoPainel, rotulo: 'Painel' },
  { rota: '/jornada', icone: IcoJornada, rotulo: 'Jornada' },
  { rota: '/novo', icone: IcoUserPlus, rotulo: 'Novo', destaque: true },
  { rota: '/visitantes', icone: IcoUsuarios, rotulo: 'Visitantes' },
]
const NAV_MAIS: ItemMenu[] = [
  { rota: '/lideres', icone: IcoUserCheck, rotulo: 'Painel do líder' },
  { rota: '/relatorios', icone: IcoRelatorios, rotulo: 'Relatórios' },
  { rota: '/equipe', icone: IcoUsuarios, rotulo: 'Equipe' },
  { rota: '/aprovacoes', icone: IcoUserCheck, rotulo: 'Aprovações' },
  { rota: '/auditoria', icone: IcoAuditoria, rotulo: 'Auditoria' },
  { rota: '/config', icone: IcoConfig, rotulo: 'Configurações' },
  { rota: '/ajuda', icone: IcoAjuda, rotulo: 'Ajuda' },
]

function rotaAtiva(rota: string, atual: string): boolean {
  return rota === '/' ? atual === '/' : atual.startsWith(rota)
}

// Sigla da igreja para o quadradinho do logo
function sigla(nome: string): string {
  const p = nome.trim().split(/\s+/).filter((w) => w.length > 2)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'IG'
}

// Splash rápido enquanto a sessão persistida é restaurada no boot
function TelaCarregando({ nome }: { nome: string }) {
  return (
    <div className="ac-tela">
      <div className="carregando">
        <div className="ac-selo">{nome.trim().slice(0, 1).toUpperCase() || '🙏'}</div>
        <div className="carregando-spin" />
        <p>Carregando…</p>
      </div>
    </div>
  )
}

// Sair da conta (barra lateral no computador, folha "Mais" no celular)
async function sairConfirmando() {
  if (!(await confirmar({ mensagem: 'Sair da sua conta?', confirmar: 'Sair' }))) return
  setUsuarioAtualId(null)
  void sairDaConta()
}

// Saudação pela hora do dia — o topo é o "cumprimento" do sistema, como no
// Louvor e no Check-iFE.
function saudacao(): string {
  const h = new Date().getHours()
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

// Seletor de igreja (visão de rede) — só aparece para quem é membro de 2+
// igrejas. É um <select> nativo transparente por cima do rótulo: no celular
// abre o seletor do próprio sistema.
function SeletorIgreja({ igrejas, ativa, classe }: { igrejas: IgrejaAcesso[]; ativa: string; classe: string }) {
  if (igrejas.length < 2) return null
  const atual = igrejas.find((i) => i.id === ativa)
  return (
    <label className={`seletor-igreja ${classe}`} title="Trocar de igreja">
      <IcoCasa size={15} />
      <span className="seletor-igreja-txt">
        <b>{atual?.nome ?? 'Igreja'}</b>
        <small>trocar de igreja</small>
      </span>
      <IcoTrocar size={14} />
      <select value={ativa} onChange={(e) => trocarIgreja(e.target.value)} aria-label="Igreja ativa">
        {igrejas.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
      </select>
    </label>
  )
}

// Topo: saudação + data, estado da sincronização, tema e o atalho principal
function Topo({ eu, seletorCelular, podeNovo }: { eu?: Usuario; seletorCelular: JSX.Element | null; podeNovo: boolean }) {
  const nuvem = useNuvem()
  const [modo, setModo] = useState(getModoTema())
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dataFmt = data.charAt(0).toUpperCase() + data.slice(1)
  const chip = {
    desligada: { classe: 'st-local', rotulo: 'Somente neste aparelho' },
    sincronizando: { classe: 'st-sincronizando', rotulo: 'Sincronizando…' },
    ok: { classe: 'st-ok', rotulo: 'Sincronizado' },
    erro: { classe: 'st-erro', rotulo: 'Sem conexão' },
  }[nuvem.status]
  const ultimo = nuvem.ultimoSync
    ? `Última sincronização: ${new Date(nuvem.ultimoSync).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
    : ''
  const primeiroNome = (eu?.nome ?? '').trim().split(/\s+/)[0]
  return (
    <header className="topbar">
      <div className="topbar-saudacao">
        <h1>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}</h1>
        <p>{dataFmt}</p>
        {seletorCelular}
      </div>
      <div className="topbar-acoes">
        {nuvem.status === 'erro' ? (
          // Erro tem saída: mostra o motivo e um "tentar de novo".
          <button
            type="button"
            className={`chip-status ${chip.classe}`}
            onClick={tentarSincronizarAgora}
            title={`Não foi possível sincronizar. ${ultimo || 'Toque para tentar de novo.'}`}
          >
            <span className="ponto" />{chip.rotulo} · tentar ⟳
          </button>
        ) : (
          <span className={`chip-status ${chip.classe}`} title={ultimo}>
            <span className="ponto" />{chip.rotulo}
          </span>
        )}
        <button
          type="button" className="topbar-icone"
          onClick={() => setModo(alternarModoTema())}
          title={modo === 'escuro' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          aria-label={modo === 'escuro' ? 'Tema claro' : 'Tema escuro'}
        >
          {modo === 'escuro' ? <IcoSol size={18} /> : <IcoLua size={18} />}
        </button>
        {podeNovo && (
          <a className="btn topbar-novo" href="#/novo"><IcoMais size={15} /> Novo visitante</a>
        )}
      </div>
    </header>
  )
}

export default function App() {
  // Rota sem os parâmetros (#/visitantes?grupo=cuidado → /visitantes): os
  // parâmetros só pré-selecionam filtros dentro da tela.
  const rotaCompleta = useRota()
  const rota = rotaCompleta.split('?')[0]
  const estado = useAppState()
  const sessao = useSessaoReal()
  const sessaoCarregada = useSessaoCarregada()
  const atualId = useUsuarioAtualId()
  const [maisAberto, setMaisAberto] = useState(false)

  // Garante uma sessão Supabase (anônima serve) para o sync passar no RLS
  useEffect(() => { void garantirSessao() }, [])

  // Aplica a identidade configurável da igreja (white-label). As três cores são
  // as mesmas da área de configuração do site: papel, escura e primária — todos
  // os tons derivados saem delas por color-mix, no CSS.
  useEffect(() => {
    const raiz = document.documentElement.style
    raiz.setProperty('--primary', estado.config.corPrimaria)
    raiz.setProperty('--papel', estado.config.corFundo)
    raiz.setProperty('--escura', estado.config.corEscura)
    // O texto que fica EM CIMA da cor primária não pode ser fixo: branco sobre
    // um dourado claro fica ilegível. Decide pela luminância da própria cor.
    raiz.setProperty('--primary-contraste', corDeContraste(estado.config.corPrimaria))
    raiz.setProperty('--escura-contraste', corDeContraste(estado.config.corEscura))
    document.title = `${estado.config.subtitulo} — ${estado.config.nomeIgreja}`
    // Memoriza o nome desta igreja para o seletor de rede exibir nomes (e não ids)
    // mesmo antes de visitar a outra igreja.
    lembrarNomeIgreja(igrejaAtivaId(), estado.config.nomeIgreja)
  }, [
    estado.config.corPrimaria, estado.config.corFundo, estado.config.corEscura,
    estado.config.nomeIgreja, estado.config.subtitulo,
  ])

  // Nomes das etapas e funções, do jeito que a igreja fala (Configurações).
  // Aplicado DURANTE o render, não em useEffect: os rótulos são lidos pelos
  // componentes filhos nesta mesma passada, e um efeito rodaria tarde demais
  // (sem mudar estado, nada re-renderizaria para corrigir).
  aplicarRotulos(estado.config)

  // Fecha a folha "Mais" ao navegar
  useEffect(() => { setMaisAberto(false) }, [rota])

  // Login real: quando a conta aprovada aparece na sessão, assume a identidade.
  const usuarioSessao = usuarioDaSessao(estado, sessao)
  const contaLiberada = !!usuarioSessao && usuarioSessao.statusAcesso === 'aprovado' && usuarioSessao.ativo
  useEffect(() => {
    if (!sessao || !usuarioSessao) return
    if (contaLiberada && atualId !== usuarioSessao.id) setUsuarioAtualId(usuarioSessao.id)
    // Conta que deixou de estar liberada (desativada/rejeitada) solta a identidade
    if (!contaLiberada && atualId === usuarioSessao.id) setUsuarioAtualId(null)
  }, [sessao, usuarioSessao, contaLiberada, atualId])

  // Visão de rede: quando a pessoa TROCOU para outra igreja (override ativo) e é
  // membro dela mas ainda não tem ficha ali, provisiona uma ficha de pastor
  // aprovado — o vínculo (membros_igreja, só via SQL do dono) é a autorização.
  // Estritamente restrito ao override: o login na igreja de casa não passa aqui.
  const { ids: vinculos } = useVinculos()
  const { igrejas, ativa } = useIgrejasDoUsuario()
  const overrideAtivo = getIgrejaAtiva() != null
  const ehMembroRede = !!vinculos && vinculos.includes(igrejaAtivaId())
  useEffect(() => {
    if (sessao && overrideAtivo && !usuarioSessao && ehMembroRede) {
      garantirFichaMembroRede(sessao.userId, sessao.email)
    }
  }, [sessao, overrideAtivo, usuarioSessao, ehMembroRede])

  // Rotas públicas — sem menu/sidebar (não exigem login)
  // Subdomínio público do visitante (ex.: visitante.suaigreja.com.br): a raiz já
  // abre o formulário de autocadastro — URL limpa para divulgar/colocar no site.
  const hostAutocadastro = typeof window !== 'undefined' &&
    (window.location.hostname.startsWith('visitante') || window.location.hostname.startsWith('cadastro'))
  if (rota.startsWith('/autocadastro') || (hostAutocadastro && rota === '/')) return <Autocadastro />
  if (rota.startsWith('/cadastro-integrante')) return <Suspense fallback={<Carregando />}><CadastroIntegrante /></Suspense>
  // Login real (Supabase) — e-mail/WhatsApp + senha
  if (rota.startsWith('/entrar')) return <Entrar />
  // Redefinição de senha (chegada pelo link "Esqueci a senha" do e-mail)
  if (rota.startsWith('/nova-senha')) return <NovaSenha />

  // Enquanto a sessão persistida ainda está sendo restaurada, mostra um
  // "carregando" — evita piscar a tela de login para quem já está logado.
  if (!sessaoCarregada) return <TelaCarregando nome={estado.config.nomeIgreja} />
  // Login obrigatório: sem sessão real (anônima não conta), vai para a tela de entrar.
  if (!sessao) return <Entrar />
  // Logado, mas a conta ainda não pode usar (pendente, rejeitada ou DESATIVADA)
  // → tela de espera (com bootstrap do 1º admin)
  if (!usuarioSessao || !contaLiberada) {
    // Numa igreja trocada (override): espera o vínculo carregar / a ficha de rede
    // ser criada antes de decidir "aguardando" — senão pisca a tela de espera.
    if (overrideAtivo && !usuarioSessao && (vinculos === null || ehMembroRede)) {
      return <TelaCarregando nome={estado.config.nomeIgreja} />
    }
    return <AguardandoAprovacao usuario={usuarioSessao} />
  }
  // A identidade usada pelas telas (permissões, auditoria) vem do mesmo id da
  // sessão. Até o efeito acima alinhar os dois, não renderiza as telas — senão
  // elas passariam um instante sem identidade (ou com a de outra pessoa).
  if (atualId !== usuarioSessao.id) return <TelaCarregando nome={estado.config.nomeIgreja} />

  // Identidade = a pessoa logada (sessão real aprovada)
  const eu = usuarioSessao
  // Página inicial: acolhedor "puro" cai direto no cadastro; líder "puro", na
  // sua área reservada (painel do líder); os demais, no Painel.
  const paginaInicial = soAcolhedor(eu) ? <NovoVisitante /> : soLider(eu) ? <PainelLider /> : <Dashboard />

  let pagina: JSX.Element
  if (rota === '/') pagina = paginaInicial
  else if (rota === '/jornada') pagina = <Jornada />
  // key: parâmetros novos (filtro vindo do Painel) remontam a lista com eles
  else if (rota === '/visitantes') pagina = <Visitantes key={rotaCompleta} />
  else if (rota.startsWith('/visitante/') && rota.endsWith('/dados')) pagina = <VisitanteDados id={rota.split('/')[2]} />
  else if (rota.startsWith('/visitante/')) pagina = <VisitanteDetalhe id={rota.split('/')[2]} />
  else if (rota === '/novo') pagina = <NovoVisitante />
  else if (rota === '/lideres') pagina = <PainelLider />
  else if (rota === '/equipe') pagina = <Equipe />
  else if (rota === '/aprovacoes') pagina = <Aprovacoes />
  else if (rota === '/relatorios') pagina = <Relatorios />
  else if (rota === '/auditoria') pagina = <Auditoria />
  else if (rota === '/config') pagina = <Configuracoes />
  else if (rota === '/ajuda') pagina = <Ajuda />
  else pagina = paginaInicial

  // Bloqueio central de rota: sem permissão → volta à página inicial da pessoa
  if (!podeAcessarRota(rota, eu)) pagina = paginaInicial

  // Para o líder "puro", a raiz É o painel do líder — realça o item certo no menu.
  const rotaMenu = soLider(eu) && rota === '/' ? '/lideres' : rota

  const cuidados = estado.visitantes.filter((v) => v.flagCuidado && podeVerCuidado(estado, eu, v)).length
  const aprovacoesPendentes = estado.usuarios.filter((u) => u.statusAcesso === 'pendente_aprovacao').length

  // Menu e navegação filtrados pelo mapa de permissões (esconde o que a pessoa não acessa)
  const menu = MENU
    .map((g) => ({ ...g, itens: g.itens.filter((m) => podeAcessarRota(m.rota, eu)) }))
    .filter((g) => g.itens.length > 0)
  // Líder "puro": barra inferior direta (painel + ajuda), sem a folha "Mais" —
  // no filtro genérico ele ficaria só com o botão "Mais", escondendo tudo.
  const navPrincipal: (ItemMenu & { destaque?: boolean })[] = soLider(eu)
    ? [
        { rota: '/lideres', icone: IcoUserCheck, rotulo: 'Meu painel' },
        { rota: '/ajuda', icone: IcoAjuda, rotulo: 'Ajuda' },
      ]
    : NAV_PRINCIPAL.filter((m) => podeAcessarRota(m.rota, eu))
  const navMais = soLider(eu) ? [] : NAV_MAIS.filter((m) => podeAcessarRota(m.rota, eu))
  const emMais = navMais.some((m) => rotaAtiva(m.rota, rotaMenu))

  const inicial = eu.nome.trim().slice(0, 1).toUpperCase() || 'V'

  return (
    <div className="layout">
      {/* Barra lateral (computador) — padrão da família iFE */}
      <nav className="sidebar">
        <div className="marca">
          <span className="marca-logo">{sigla(estado.config.nomeIgreja)}</span>
          <span className="marca-txt">
            <b>{estado.config.nomeIgreja}</b>
            <small>{estado.config.subtitulo}</small>
          </span>
        </div>
        <SeletorIgreja igrejas={igrejas} ativa={ativa} classe="seletor-igreja-lateral" />
        <div className="sidebar-menu">
          {menu.map((grupo) => (
            <div key={grupo.secao}>
              <div className="menu-secao">{grupo.secao}</div>
              {grupo.itens.map((m) => (
                <a key={m.rota} href={`#${m.rota}`} className={rotaAtiva(m.rota, rotaMenu) ? 'ativo' : ''}>
                  <m.icone size={18} /> {m.rotulo}
                  {m.rota === '/' && cuidados > 0 && <span className="contador">{cuidados}</span>}
                  {m.rota === '/aprovacoes' && aprovacoesPendentes > 0 && (
                    <span className="contador contador-aviso">{aprovacoesPendentes}</span>
                  )}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-pe">
          <div className="quem">
            <span className="quem-avatar">{inicial}</span>
            <span className="quem-txt">
              <b>{eu.nome}</b>
              <small>{eu.papeis.map((p) => rotuloPapel(p)).join(' · ')}</small>
            </span>
            <button type="button" className="quem-sair" onClick={() => void sairConfirmando()} title="Sair da conta" aria-label="Sair da conta">
              <IcoSair size={17} />
            </button>
          </div>
          <div className="versao">Integração · v{__APP_VERSION__}</div>
        </div>
      </nav>

      <div className="principal">
        <Topo
          eu={eu}
          podeNovo={podeAcessarRota('/novo', eu)}
          seletorCelular={<SeletorIgreja igrejas={igrejas} ativa={ativa} classe="seletor-igreja-celular" />}
        />
        <main className="conteudo"><Suspense fallback={<Carregando />}>{pagina}</Suspense></main>
      </div>

      {/* Navegação inferior — aparece só no celular */}
      <nav className="bottomnav">
        {navPrincipal.map((m) => (
          <a
            key={m.rota}
            href={`#${m.rota}`}
            className={`${rotaAtiva(m.rota, rotaMenu) ? 'ativo' : ''} ${m.destaque ? 'destaque' : ''}`}
          >
            <span className="icone">
              {m.destaque ? <IcoMais size={24} /> : <m.icone size={21} />}
              {m.rota === '/' && cuidados > 0 && <span className="ponto-alerta" />}
            </span>
            {m.rotulo}
          </a>
        ))}
        {/* "Mais" sempre existe: além das outras telas, é onde fica o "Sair" */}
        <button className={maisAberto || emMais ? 'ativo' : ''} onClick={() => setMaisAberto(!maisAberto)}>
          <span className="icone"><IcoMenu size={21} /></span>
          Mais
        </button>
      </nav>

      {/* Folha "Mais" (celular) */}
      {maisAberto && (
        <>
          <div className="sheet-fundo" onClick={() => setMaisAberto(false)} />
          <div className="sheet">
            <div className="sheet-alca" />
            {navMais.length > 0 && <div className="sheet-titulo">Mais opções</div>}
            <div className="sheet-lista">
              {navMais.map((m) => (
                <a key={m.rota} href={`#${m.rota}`} className={rotaAtiva(m.rota, rotaMenu) ? 'ativo' : ''}>
                  <m.icone size={20} /> <span>{m.rotulo}</span>
                  {m.rota === '/aprovacoes' && aprovacoesPendentes > 0 && (
                    <span className="contador contador-aviso">{aprovacoesPendentes}</span>
                  )}
                </a>
              ))}
              <button type="button" className="sheet-sair" onClick={() => { setMaisAberto(false); void sairConfirmando() }}>
                <IcoSair size={20} /> <span>Sair da conta</span>
              </button>
            </div>
            <div className="sheet-versao">Integração · v{__APP_VERSION__}</div>
          </div>
        </>
      )}
    </div>
  )
}

// Enquanto uma tela carregada sob demanda chega (frações de segundo)
function Carregando() {
  return <div className="vazio carregando-tela" role="status">Carregando…</div>
}
