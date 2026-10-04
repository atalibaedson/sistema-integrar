import type { ReactNode } from 'react'
import { semAtualizacao, semResponsavel as semResponsavelDef, useAppState, ultimaRespostaOuCadastro } from '../store'
import { diasDesde } from '../machine'
import { estiloStatus, rotuloStatus, STATUS_COR, type Status, type Visitante } from '../types'
import { aplicarTemplate, linkWhatsApp, proximaAcao } from '../actions'
import { navegar } from '../router'
import { podeAcessarRota, podeVerCuidado, useUsuarioAtualId, usuarioAtual, visitantesVisiveis } from '../acesso'
import {
  IcoAlerta, IcoCasa, IcoGota, IcoJornada, IcoQr, IcoRelatorios, IcoRelogio, IcoSeta,
  IcoUserCheck, IcoUserPlus, IcoUsuarios, IcoWhats,
} from '../icones'
import Avatar from '../Avatar'

// Painel — padrão da família iFE (Louvor / Check-iFE): a saudação fica no topo,
// e o conteúdo responde "onde estão as pessoas" (Jornada), "o que resolver"
// (pendências e ações de hoje) e "quem precisa de atenção" (cuidado, recém-
// chegados). Tudo é calculado só sobre o que a identidade atual pode ver.

// Etapas ativas da jornada mostradas no quadro "Jornada" (do início ao grupo)
const ETAPAS_JORNADA: Status[] = ['novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou', 'transferido']

// "Ana, Bruno, Carla +2"
function nomes(vs: { nome: string }[], max = 3): string {
  const primeiros = vs.slice(0, max).map((v) => v.nome.trim().split(/\s+/)[0])
  return primeiros.join(', ') + (vs.length > max ? ` +${vs.length - max}` : '')
}

function quando(iso: string): string {
  const d = diasDesde(iso)
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`
}

function Secao({ titulo, acao, extra, classe, children }: {
  titulo: ReactNode; acao?: { rotulo: string; rota: string }; extra?: ReactNode; classe?: string; children: ReactNode
}) {
  return (
    <section className={`painel-secao ${classe ?? ''}`}>
      <div className="painel-secao-cab">
        <h2>{titulo}{extra}</h2>
        {acao && <a href={`#${acao.rota}`}>{acao.rotulo}</a>}
      </div>
      {children}
    </section>
  )
}

type Tom = 'crit' | 'warn' | 'gold' | 'acc'
interface Pendencia { chave: string; tom: Tom; icone: ReactNode; titulo: string; sub: string; n: number; ir: () => void }

// Por onde os visitantes chegam: termômetro dos canais de divulgação
function ComoConheceram({ vs }: { vs: Visitante[] }) {
  const total = vs.length
  const contagem = new Map<string, number>()
  let naoInformado = 0
  for (const v of vs) {
    if (v.comoConheceu) contagem.set(v.comoConheceu, (contagem.get(v.comoConheceu) ?? 0) + 1)
    else naoInformado++
  }
  const linhas = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  const maior = linhas[0]?.[1] ?? 0
  return (
    <div className="card">
      {linhas.length === 0 ? (
        <div className="painel-vazio">O campo "Como conheceu?" do cadastro alimenta este quadro.</div>
      ) : (
        <div className="rel-barlist">
          {linhas.slice(0, 6).map(([canal, n]) => (
            <div className="rel-bar-row" key={canal}>
              <div className="rel-bar-rotulo" title={canal}>{canal}</div>
              <div className="rel-bar-trilho"><div className="rel-bar-fill" style={{ width: `${Math.max((n / maior) * 100, 3)}%` }} /></div>
              <div className="rel-bar-num">{n} <span className="rel-bar-pct">· {total ? Math.round((n / total) * 100) : 0}%</span></div>
            </div>
          ))}
          {naoInformado > 0 && <p className="painel-nota">{naoInformado} sem essa informação.</p>}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const vs = visitantesVisiveis(s, eu) // só o que a identidade atual pode ver

  const porStatus = (st: Status) => vs.filter((v) => v.status === st).length
  const emAcompanhamento = porStatus('novo') + porStatus('em_contato') + porStatus('aguardando_resposta')
  const integrados = porStatus('integrado')
  const taxaIntegracao = vs.length ? Math.round((integrados / vs.length) * 100) : 0

  // Alertas — cuidado respeita a restrição extra do pastor/responsável
  const cuidado = vs.filter((v) => v.flagCuidado && podeVerCuidado(s, eu, v))
  const semResponsavel = vs.filter(
    (v) => semResponsavelDef(s, v) && !['encerrado', 'recusou', 'integrado', 'batismo', 'transferido'].includes(v.status),
  )
  const transferenciaPendente = vs.filter((v) => v.status === 'visitou' && !v.transferenciaConfirmada)
  const semAtualizar = vs.filter((v) => semAtualizacao(s, v))
  const pendentesAprovacao = podeAcessarRota('/aprovacoes', eu)
    ? s.usuarios.filter((u) => u.statusAcesso === 'pendente_aprovacao')
    : []

  // Ações de hoje: visitantes ativos ordenados por urgência
  const ativos = vs
    .filter((v) => ['novo', 'em_contato', 'aguardando_resposta', 'encaminhado_lider', 'visitou'].includes(v.status) || v.flagCuidado)
    .map((v) => ({ v, acao: proximaAcao(s, v), dias: diasDesde(ultimaRespostaOuCadastro(s, v)) }))
    .sort((a, b) => Number(b.acao.urgente ?? false) - Number(a.acao.urgente ?? false) || b.dias - a.dias)

  // Chegaram nos últimos 7 dias (mais recentes primeiro)
  const recentes = vs
    .filter((v) => diasDesde(v.dataCadastro) <= 7)
    .sort((a, b) => b.dataCadastro.localeCompare(a.dataCadastro))

  // Batismo: próxima data marcada nas Configurações + quem está nessa etapa
  const hoje = new Date().toISOString().slice(0, 10)
  const proximoBatismo = [...(s.config.datasBatismo ?? [])].filter((d) => d >= hoje).sort()[0]
  const noBatismo = porStatus('batismo')

  // Abre a ficha quando é uma pessoa só; senão, a lista já filtrada
  const abrir = (lista: { id: string }[], rota: string) => () =>
    navegar(lista.length === 1 ? `/visitante/${lista[0].id}` : rota)

  const pendencias: Pendencia[] = []
  if (semResponsavel.length > 0) pendencias.push({
    chave: 'sem-resp', tom: 'crit', icone: <IcoAlerta size={18} />, n: semResponsavel.length,
    titulo: `${semResponsavel.length} sem responsável`,
    sub: `${nomes(semResponsavel)} — atribua um responsável na ficha`,
    ir: abrir(semResponsavel, '/visitantes?resp=sem'),
  })
  if (semAtualizar.length > 0) pendencias.push({
    chave: 'parados', tom: 'warn', icone: <IcoRelogio size={18} />, n: semAtualizar.length,
    titulo: `${semAtualizar.length} ${semAtualizar.length === 1 ? 'ficha parada' : 'fichas paradas'} há 7+ dias`,
    sub: `${nomes(semAtualizar)} — peça atualização a quem acompanha`,
    ir: abrir(semAtualizar, '/visitantes?grupo=sem_atualizacao'),
  })
  if (transferenciaPendente.length > 0) pendencias.push({
    chave: 'lider', tom: 'gold', icone: <IcoCasa size={18} />, n: transferenciaPendente.length,
    titulo: `${transferenciaPendente.length} aguardando o líder confirmar`,
    sub: `${nomes(transferenciaPendente)} — visitaram o grupo; falta o líder assumir`,
    ir: abrir(transferenciaPendente, '/visitantes?grupo=lider'),
  })
  if (pendentesAprovacao.length > 0) pendencias.push({
    chave: 'aprov', tom: 'acc', icone: <IcoUserCheck size={18} />, n: pendentesAprovacao.length,
    titulo: `${pendentesAprovacao.length} ${pendentesAprovacao.length === 1 ? 'conta aguardando' : 'contas aguardando'} aprovação`,
    sub: `${nomes(pendentesAprovacao)} — integrantes novos pediram acesso`,
    ir: () => navegar('/aprovacoes'),
  })

  const maxEtapa = Math.max(1, ...ETAPAS_JORNADA.map(porStatus))
  const atalhos = [
    { rota: '/novo', icone: <IcoUserPlus size={20} />, rotulo: 'Novo visitante' },
    { rota: '/jornada', icone: <IcoJornada size={20} />, rotulo: 'Jornada' },
    { rota: '/visitantes', icone: <IcoUsuarios size={20} />, rotulo: 'Visitantes' },
    { rota: '/relatorios', icone: <IcoRelatorios size={20} />, rotulo: 'Relatórios' },
    { rota: '/equipe', icone: <IcoUserCheck size={20} />, rotulo: 'Equipe' },
    { rota: '/config?aba=autocadastro', icone: <IcoQr size={20} />, rotulo: 'QR do cadastro' },
  ].filter((a) => podeAcessarRota(a.rota, eu))

  return (
    <div className="painel">
      <div className="painel-grade">
        <div className="painel-col">
          {/* ---- Jornada: onde cada pessoa está agora ---- */}
          <Secao titulo="Jornada" acao={{ rotulo: 'Abrir jornada', rota: '/jornada' }} classe="ordem-jornada">
            <div className="card painel-jornada">
              {vs.length === 0 ? (
                <div className="painel-vazio">Nenhum visitante ainda. Cadastre em <a href="#/novo">Novo visitante</a>.</div>
              ) : (
                <>
                  <div className="painel-funil">
                    {ETAPAS_JORNADA.map((st) => {
                      const n = porStatus(st)
                      return (
                        <button type="button" key={st} className="painel-etapa" onClick={() => navegar('/jornada')} title={rotuloStatus(st)}>
                          <span className="painel-etapa-n">{n}</span>
                          <span className="painel-etapa-barra">
                            <i style={{ height: `${n ? 14 + (86 * n) / maxEtapa : 4}%`, background: STATUS_COR[st] }} />
                          </span>
                          <span className="painel-etapa-rotulo">{rotuloStatus(st)}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="painel-jornada-pe">
                    <span>{vs.length} na sua visão · {emAcompanhamento} em acompanhamento · {integrados} {integrados === 1 ? 'membro' : 'membros'}</span>
                    <span className="painel-chip painel-chip-ok">{taxaIntegracao}% de conversão</span>
                  </div>
                </>
              )}
            </div>
          </Secao>

          {/* ---- Para resolver hoje ---- */}
          <Secao titulo="Para resolver hoje" acao={{ rotulo: 'Ver visitantes', rota: '/visitantes' }} classe="ordem-resolver">
            <div className="card painel-lista">
              {pendencias.length === 0 ? (
                <div className="painel-vazio">Tudo em dia por aqui. 🎉</div>
              ) : pendencias.map((p) => (
                <button type="button" key={p.chave} className="painel-linha painel-linha-clicavel" onClick={p.ir}>
                  <span className={`painel-ico painel-ico-${p.tom}`}>{p.icone}</span>
                  <span className="painel-linha-txt"><b>{p.titulo}</b><span>{p.sub}</span></span>
                  <span className={`painel-chip painel-chip-${p.tom}`}>{p.n}</span>
                  <span className="painel-seta"><IcoSeta size={16} /></span>
                </button>
              ))}
            </div>
          </Secao>

          {/* ---- Atalhos ---- */}
          {atalhos.length > 0 && (
            <nav className="painel-atalhos ordem-atalhos" aria-label="Atalhos">
              {atalhos.map((a) => (
                <a key={a.rota} href={`#${a.rota}`} className="painel-atalho">{a.icone}<span>{a.rotulo}</span></a>
              ))}
            </nav>
          )}

          {/* ---- Ações de hoje (com mensagem pronta no WhatsApp) ---- */}
          <Secao
            titulo="Ações de hoje" extra={<span className="painel-contagem">{ativos.length}</span>}
            acao={{ rotulo: 'Ver todos', rota: '/visitantes' }} classe="ordem-acoes"
          >
            <div className="card painel-lista">
              {ativos.length === 0 ? (
                <div className="painel-vazio">Nenhuma ação pendente. 🎉</div>
              ) : ativos.slice(0, 8).map(({ v, acao }) => {
                const template = acao.gatilhoTemplate ? s.templates.find((t) => t.gatilho === acao.gatilhoTemplate) : undefined
                return (
                  <div className="painel-linha" key={v.id}>
                    <Avatar nome={v.nome} tom={v.flagCuidado ? 'var(--danger)' : undefined} />
                    <button type="button" className="painel-linha-txt painel-linha-link" onClick={() => navegar(`/visitante/${v.id}`)}>
                      <b>{v.nome}</b>
                      <span className={acao.urgente ? 'painel-urgente' : ''}>{acao.titulo}</span>
                    </button>
                    <span className="badge painel-status" style={estiloStatus(v.status)}>{rotuloStatus(v.status)}</span>
                    {template && (
                      <a
                        className="btn btn-whats btn-mini painel-whats"
                        href={linkWhatsApp(v.whatsapp, aplicarTemplate(template.texto, v, s))}
                        target="_blank" rel="noreferrer" title="Enviar a mensagem pronta no WhatsApp"
                      ><IcoWhats size={14} /> <span>Enviar</span></a>
                    )}
                  </div>
                )
              })}
            </div>
          </Secao>
        </div>

        <div className="painel-col">
          {/* ---- Cuidado pastoral ---- */}
          {cuidado.length > 0 && (
            <Secao titulo="Cuidado pastoral" acao={{ rotulo: 'Ver lista', rota: '/visitantes?grupo=cuidado' }} classe="ordem-cuidado">
              <div className="card painel-lista painel-cuidado">
                {cuidado.map((v) => (
                  <button type="button" key={v.id} className="painel-linha painel-linha-clicavel" onClick={() => navegar(`/visitante/${v.id}`)}>
                    <Avatar nome={v.nome} tom="var(--danger)" />
                    <span className="painel-linha-txt">
                      <b>{v.nome}</b>
                      <span>{v.pedidoOracao?.trim() || 'Acione a liderança / pastor'}</span>
                    </span>
                    <span className="painel-chip painel-chip-crit">Cuidado</span>
                  </button>
                ))}
              </div>
            </Secao>
          )}

          {/* ---- Chegaram esta semana ---- */}
          <Secao titulo="Chegaram esta semana" acao={{ rotulo: 'Visitantes', rota: '/visitantes' }} classe="ordem-recentes">
            <div className="card painel-lista">
              {recentes.length === 0 ? (
                <div className="painel-vazio">Nenhum cadastro nos últimos 7 dias.</div>
              ) : recentes.slice(0, 6).map((v) => (
                <button type="button" key={v.id} className="painel-linha painel-linha-clicavel" onClick={() => navegar(`/visitante/${v.id}`)}>
                  <Avatar nome={v.nome} />
                  <span className="painel-linha-txt">
                    <b>{v.nome}</b>
                    <span>{[v.cultoPrimeiraVisita, v.origem === 'qr_code' ? 'QR code' : null, quando(v.dataCadastro)].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="badge painel-status" style={estiloStatus(v.status)}>{rotuloStatus(v.status)}</span>
                </button>
              ))}
            </div>
          </Secao>

          {/* ---- Batismo ---- */}
          {(proximoBatismo || noBatismo > 0) && (
            <div className="card painel-destaque ordem-batismo">
              <span className="painel-ico painel-ico-acc"><IcoGota size={18} /></span>
              <span className="painel-linha-txt">
                <b>
                  {proximoBatismo
                    ? `Próximo batismo · ${new Date(proximoBatismo + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`
                    : rotuloStatus('batismo')}
                </b>
                <span>{noBatismo} {noBatismo === 1 ? 'pessoa nesta etapa' : 'pessoas nesta etapa'}</span>
              </span>
              <a className="btn btn-sec btn-mini" href="#/visitantes?grupo=batismo">Ver</a>
            </div>
          )}

          {/* ---- Como conheceram ---- */}
          <Secao titulo="Como conheceram a igreja" classe="ordem-canais">
            <ComoConheceram vs={vs} />
          </Secao>
        </div>
      </div>
    </div>
  )
}
