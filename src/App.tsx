import { useEffect, useState } from 'react'
import { useRota } from './router'
import { useAppState, useNuvem } from './store'
import { getUsuarioAtualId, setUsuarioAtualId, useUsuarioAtualId, usuarioAtual, podeVerCuidado, podeAcessarRota, soAcolhedor, useSessaoReal, useSessaoCarregada, usuarioDaSessao } from './acesso'
import { marcarEmailConfirmado } from './actions'
import { garantirSessao, sairDaConta } from './supabaseClient'
import { PAPEL_LABEL, type Usuario } from './types'
import { IcoAjuda, IcoAuditoria, IcoConfig, IcoJornada, IcoMenu, IcoPainel, IcoRelatorios, IcoUserCheck, IcoUserPlus, IcoUsuarios } from './icones'
import Dashboard from './pages/Dashboard'
import Jornada from './pages/Jornada'
import Visitantes from './pages/Visitantes'
import VisitanteDetalhe from './pages/VisitanteDetalhe'
import NovoVisitante from './pages/NovoVisitante'
import PainelLider from './pages/PainelLider'
import Equipe from './pages/Equipe'
import Configuracoes from './pages/Configuracoes'
import Autocadastro from './pages/Autocadastro'
import Ajuda from './pages/Ajuda'
import Auditoria from './pages/Auditoria'
import CadastroIntegrante from './pages/CadastroIntegrante'
import Entrar from './pages/Entrar'
import AguardandoAprovacao from './pages/AguardandoAprovacao'
import Aprovacoes from './pages/Aprovacoes'
// EntrarProvisorio (login por nome, sem senha) foi aposentado com o login obrigatório.
import Relatorios from './pages/Relatorios'

type ItemMenu = { rota: string; icone: (p: { size?: number }) => JSX.Element; rotulo: string }

const MENU: { secao: string; itens: ItemMenu[] }[] = [
  {
    secao: 'Principal',
    itens: [
      { rota: '/', icone: IcoPainel, rotulo: 'Painel' },
      { rota: '/jornada', icone: IcoJornada, rotulo: 'Jornada' },
      { rota: '/visitantes', icone: IcoUsuarios, rotulo: 'Visitantes' },
      { rota: '/novo', icone: IcoUserPlus, rotulo: 'Novo visitante' },
    ],
  },
  {
    secao: 'Gestão',
    itens: [
      { rota: '/lideres', icone: IcoUserCheck, rotulo: 'Painel do líder' },
      { rota: '/relatorios', icone: IcoRelatorios, rotulo: 'Relatórios' },
      { rota: '/equipe', icone: IcoUsuarios, rotulo: 'Equipe' },
      { rota: '/aprovacoes', icone: IcoUserCheck, rotulo: 'Aprovações' },
      { rota: '/auditoria', icone: IcoAuditoria, rotulo: 'Auditoria' },
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

// Chips do topo: quem está logado + status da nuvem + data + sair
function ChipsTopo({ eu }: { eu?: Usuario }) {
  const nuvem = useNuvem()
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dataFmt = data.charAt(0).toUpperCase() + data.slice(1)
  const chip = {
    desligada: { classe: '', ponto: '#93A1B0', rotulo: 'Somente neste aparelho' },
    sincronizando: { classe: 'st-sincronizando', ponto: '#f59e0b', rotulo: 'Sincronizando…' },
    ok: { classe: 'st-ok', ponto: '#22c55e', rotulo: 'Sincronizado' },
    erro: { classe: 'st-erro', ponto: '#ef4444', rotulo: 'Erro de sincronização' },
  }[nuvem.status]
  function sair() {
    if (!confirm('Sair da sua conta?')) return
    setUsuarioAtualId(null)
    void sairDaConta()
  }
  return (
    <div className="cab-chips">
      <span className="chip-status" style={{ gap: 6 }}>
        👤 <b style={{ color: 'var(--primary)' }}>{eu?.nome ?? 'Você'}</b>
        {eu && <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>· {eu.papeis.map((p) => PAPEL_LABEL[p]).join(', ')}</span>}
      </span>
      <span className={`chip-status ${chip.classe}`}><span className="ponto" style={{ background: chip.ponto }} />{chip.rotulo}</span>
      <span className="chip-status">📅 {dataFmt}</span>
      <button type="button" className="chip-sair" onClick={sair}>🚪 Sair</button>
    </div>
  )
}

export default function App() {
  const rota = useRota()
  const estado = useAppState()
  const sessao = useSessaoReal()
  const sessaoCarregada = useSessaoCarregada()
  const [maisAberto, setMaisAberto] = useState(false)

  // Garante uma sessão Supabase (anônima serve) para o sync passar no RLS
  useEffect(() => { void garantirSessao() }, [])

  // Aplica a identidade configurável da igreja (white-label)
  useEffect(() => {
    document.documentElement.style.setProperty('--primary', estado.config.corPrimaria)
    document.title = `${estado.config.subtitulo} — ${estado.config.nomeIgreja}`
  }, [estado.config.corPrimaria, estado.config.nomeIgreja, estado.config.subtitulo])

  // Fecha a folha "Mais" ao navegar
  useEffect(() => { setMaisAberto(false) }, [rota])

  // Login real: quando uma sessão com e-mail confirmado aparece, avança o
  // status; quando a conta está aprovada, assume a identidade automaticamente.
  const usuarioSessao = usuarioDaSessao(estado, sessao)
  useEffect(() => {
    if (!sessao || !usuarioSessao) return
    if (usuarioSessao.statusAcesso === 'pendente_confirmacao_email') {
      // Com a confirmação de e-mail ligada, só existe sessão APÓS confirmar
      marcarEmailConfirmado(usuarioSessao.id)
    }
    if (usuarioSessao.statusAcesso === 'aprovado' && usuarioSessao.ativo && getUsuarioAtualId() !== usuarioSessao.id) {
      setUsuarioAtualId(usuarioSessao.id)
    }
  }, [sessao, usuarioSessao])

  // Rotas públicas — sem menu/sidebar (não exigem login)
  // Subdomínio público de autocadastro (ex.: cadastro.suaigreja.com.br): a raiz
  // já abre o formulário do visitante — URL limpa para divulgar/colocar no site.
  const hostAutocadastro = typeof window !== 'undefined' && window.location.hostname.startsWith('cadastro.')
  if (rota.startsWith('/autocadastro') || (hostAutocadastro && rota === '/')) return <Autocadastro />
  if (rota.startsWith('/cadastro-integrante')) return <CadastroIntegrante />
  // Login real (Supabase) — e-mail/WhatsApp + senha
  if (rota.startsWith('/entrar')) return <Entrar />

  // Enquanto a sessão persistida ainda está sendo restaurada, mostra um
  // "carregando" — evita piscar a tela de login para quem já está logado.
  if (!sessaoCarregada) return <TelaCarregando nome={estado.config.nomeIgreja} />
  // Login obrigatório: sem sessão real (anônima não conta), vai para a tela de entrar.
  if (!sessao) return <Entrar />
  // Logado, mas a conta ainda não pode usar → tela de espera (com bootstrap do 1º admin)
  if (!usuarioSessao || usuarioSessao.statusAcesso !== 'aprovado') {
    return <AguardandoAprovacao usuario={usuarioSessao} />
  }

  // Identidade = a pessoa logada (sessão real aprovada)
  const eu = usuarioSessao
  // Página inicial: acolhedor "puro" cai direto no cadastro; os demais, no Painel.
  const paginaInicial = soAcolhedor(eu) ? <NovoVisitante /> : <Dashboard />

  let pagina: JSX.Element
  if (rota === '/') pagina = paginaInicial
  else if (rota === '/jornada') pagina = <Jornada />
  else if (rota === '/visitantes') pagina = <Visitantes />
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

  const cuidados = estado.visitantes.filter((v) => v.flagCuidado && podeVerCuidado(estado, eu, v)).length
  const aprovacoesPendentes = estado.usuarios.filter((u) => u.statusAcesso === 'pendente_aprovacao').length

  // Menu e navegação filtrados pelo mapa de permissões (esconde o que a pessoa não acessa)
  const menu = MENU
    .map((g) => ({ ...g, itens: g.itens.filter((m) => podeAcessarRota(m.rota, eu)) }))
    .filter((g) => g.itens.length > 0)
  const navPrincipal = NAV_PRINCIPAL.filter((m) => podeAcessarRota(m.rota, eu))
  const navMais = NAV_MAIS.filter((m) => podeAcessarRota(m.rota, eu))
  const emMais = navMais.some((m) => rotaAtiva(m.rota, rota))

  return (
    <div className="layout">
      {/* Menu lateral (desktop) / barra de marca (celular) */}
      <nav className="sidebar">
        <div className="marca">
          <span className="marca-logo">{sigla(estado.config.nomeIgreja)}</span>
          <span>
            {estado.config.nomeIgreja}
            <small>{estado.config.subtitulo}</small>
          </span>
        </div>
        {menu.map((grupo) => (
          <div key={grupo.secao}>
            <div className="menu-secao">{grupo.secao}</div>
            {grupo.itens.map((m) => (
              <a key={m.rota} href={`#${m.rota}`} className={rotaAtiva(m.rota, rota) ? 'ativo' : ''}>
                <m.icone size={16} /> {m.rotulo}
                {m.rota === '/' && cuidados > 0 && (
                  <span className="badge" style={{ background: '#ef4444', marginLeft: 'auto' }}>{cuidados}</span>
                )}
                {m.rota === '/aprovacoes' && aprovacoesPendentes > 0 && (
                  <span className="badge" style={{ background: '#f59e0b', marginLeft: 'auto' }}>{aprovacoesPendentes}</span>
                )}
              </a>
            ))}
          </div>
        ))}
        <div className="rodape">"Não estamos falando de um produto, e sim de pessoas."</div>
      </nav>

      <main className="conteudo">
        <ChipsTopo eu={eu} />
        {pagina}
      </main>

      {/* Navegação inferior — aparece só no celular */}
      <nav className="bottomnav">
        {navPrincipal.map((m) => (
          <a
            key={m.rota}
            href={`#${m.rota}`}
            className={`${rotaAtiva(m.rota, rota) ? 'ativo' : ''} ${m.destaque ? 'destaque' : ''}`}
          >
            <span className="icone">
              <m.icone size={m.destaque ? 24 : 21} />
              {m.rota === '/' && cuidados > 0 && <span className="ponto-alerta" />}
            </span>
            {m.rotulo}
          </a>
        ))}
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
            {navMais.map((m) => (
              <a key={m.rota} href={`#${m.rota}`} className={rotaAtiva(m.rota, rota) ? 'ativo' : ''}>
                <m.icone size={20} /> {m.rotulo}
                {m.rota === '/aprovacoes' && aprovacoesPendentes > 0 && (
                  <span className="badge" style={{ background: '#f59e0b', marginLeft: 'auto' }}>{aprovacoesPendentes}</span>
                )}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
