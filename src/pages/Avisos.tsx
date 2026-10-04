import { useEffect, useState, type ReactNode } from 'react'
import { useAppState } from '../store'
import { useUsuarioAtualId, usuarioAtual } from '../acesso'
import { alertasConfig, type Alerta } from '../alertas'
import { dispensarAviso, ICONE_ALERTA, reativarAviso, textoNivel, useAvisos } from '../avisos'
import { ativarPush, desativarPush, lerEstadoPush, testarPush, type EstadoPush } from '../push'
import { navegar } from '../router'
import { toast } from '../toast'
import { IcoCelular, IcoCheck, IcoSino } from '../icones'

// Central de avisos: o que precisa de ação de quem está logado. Os avisos são
// calculados pelas regras de alertas.ts (as mesmas do push); aqui só se mostram
// e se tratam — abrir a ficha, "já resolvi" ou adiar.

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ---- Notificações no celular ----

function CartaoNotificacoes({ usuarioId, hora }: { usuarioId: string; hora: number }) {
  const [estado, setEstado] = useState<EstadoPush>('carregando')
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => { void lerEstadoPush().then(setEstado) }, [])

  async function ligar() {
    setOcupado(true)
    const r = await ativarPush(usuarioId)
    setOcupado(false)
    if (!r.ok) toast(r.erro, 'erro')
    else toast('Notificações ativadas neste aparelho')
    setEstado(await lerEstadoPush())
  }
  async function desligar() {
    setOcupado(true)
    const r = await desativarPush()
    setOcupado(false)
    toast(r.ok ? 'Notificações desativadas neste aparelho' : r.erro, r.ok ? 'ok' : 'erro')
    setEstado(await lerEstadoPush())
  }
  async function testar() {
    setOcupado(true)
    const r = await testarPush()
    setOcupado(false)
    toast(r.ok ? 'Teste enviado — a notificação deve chegar em instantes' : r.erro, r.ok ? 'ok' : 'erro')
  }

  if (estado === 'carregando' || estado === 'indisponivel') return null

  let corpo: ReactNode
  switch (estado) {
    case 'ligado':
      corpo = (
        <>
          <p>Ativadas <b>neste aparelho</b>. Você recebe um resumo por dia (por volta das {hora}h) e, na hora, avisos de visitante novo para você e de casos de cuidado.</p>
          <div className="aviso-push-acoes">
            <button type="button" className="btn btn-sec btn-mini" disabled={ocupado} onClick={() => void testar()}>Enviar notificação de teste</button>
            <button type="button" className="btn btn-sec btn-mini" disabled={ocupado} onClick={() => void desligar()}>Desativar</button>
          </div>
        </>
      )
      break
    case 'precisa_instalar':
      corpo = (
        <p>No iPhone e no iPad, as notificações só funcionam com o sistema na <b>Tela de Início</b>. Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>; abra o sistema por esse ícone e volte aqui para ativar.</p>
      )
      break
    case 'negado':
      corpo = <p>As notificações estão <b>bloqueadas</b> neste aparelho. Libere nas configurações do navegador (ou do app instalado) e volte aqui.</p>
      break
    case 'nao_suportado':
      corpo = <p>Este navegador não permite notificações. Os avisos continuam aparecendo aqui e no sino do topo.</p>
      break
    default:
      corpo = (
        <>
          <p>Receba um resumo por dia (por volta das {hora}h) e, na hora, avisos de visitante novo para você e de casos de cuidado — mesmo com o sistema fechado. A notificação nunca mostra o nome de visitantes.</p>
          <div className="aviso-push-acoes">
            <button type="button" className="btn" disabled={ocupado} onClick={() => void ligar()}>
              <IcoSino size={15} /> {ocupado ? 'Ativando…' : 'Ativar notificações'}
            </button>
          </div>
        </>
      )
  }
  return (
    <div className="card aviso-push">
      <span className="painel-ico painel-ico-acc"><IcoCelular size={18} /></span>
      <div className="aviso-push-txt">
        <h3>Notificações no celular</h3>
        {corpo}
      </div>
    </div>
  )
}

// ---- Uma linha de aviso ----

function LinhaAviso({ a }: { a: Alerta }) {
  const Icone = ICONE_ALERTA[a.tipo]
  const nivel = textoNivel(a)
  return (
    <div className="painel-linha aviso-linha">
      <span className={`painel-ico painel-ico-${a.gravidade}`}><Icone size={18} /></span>
      <button type="button" className="painel-linha-txt painel-linha-link aviso-txt" onClick={() => navegar(a.rota)}>
        <b>{a.titulo}</b>
        <span>{a.detalhe}</span>
        {nivel && <em className="aviso-nivel">{nivel}</em>}
      </button>
      <div className="aviso-acoes">
        <button type="button" className="btn btn-mini" onClick={() => navegar(a.rota)}>Abrir</button>
        <button
          type="button" className="btn btn-sec btn-mini"
          title="Já cuidei disso — o aviso some por 14 dias e volta só se a situação continuar"
          onClick={() => { dispensarAviso(a.chave, 14); toast('Marcado como resolvido') }}
        ><IcoCheck size={13} /> Já resolvi</button>
        <select
          className="aviso-adiar" value="" aria-label="Adiar este aviso"
          onChange={(e) => { const d = Number(e.target.value); if (d) { dispensarAviso(a.chave, d); toast(`Adiado por ${d === 7 ? '1 semana' : d === 1 ? '1 dia' : `${d} dias`}`) } }}
        >
          <option value="">Adiar…</option>
          <option value="1">1 dia</option>
          <option value="3">3 dias</option>
          <option value="7">1 semana</option>
        </select>
      </div>
    </div>
  )
}

export default function Avisos() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const { ativos, adiados } = useAvisos()
  const cfg = alertasConfig(s.config)

  return (
    <div className="avisos">
      <h1 className="titulo-pagina">Avisos</h1>
      <p className="subtitulo">O que precisa da sua atenção para que ninguém fique sem acompanhamento.</p>

      {!cfg.ativo && (
        <div className="card"><div className="painel-vazio">Os avisos estão desligados nas Configurações da igreja.</div></div>
      )}

      {cfg.ativo && eu && <CartaoNotificacoes usuarioId={eu.id} hora={cfg.horaResumo} />}

      {cfg.ativo && (
        <>
          <div className="painel-secao-cab aviso-secao">
            <h2>Precisam de ação <span className="painel-contagem">{ativos.length}</span></h2>
          </div>
          <div className="card painel-lista">
            {ativos.length === 0 ? (
              <div className="painel-vazio aviso-vazio"><IcoCheck size={22} /><b>Tudo em dia</b>Nenhum aviso para você agora.</div>
            ) : ativos.map((a) => <LinhaAviso key={a.chave} a={a} />)}
          </div>

          {adiados.length > 0 && (
            <details className="aviso-adiados">
              <summary>Adiados e resolvidos <span className="painel-contagem">{adiados.length}</span></summary>
              <div className="card painel-lista">
                {adiados.map(({ alerta, ate }) => {
                  const Icone = ICONE_ALERTA[alerta.tipo]
                  return (
                    <div className="painel-linha aviso-linha aviso-linha-adiada" key={alerta.chave}>
                      <span className="painel-ico painel-ico-acc"><Icone size={18} /></span>
                      <span className="painel-linha-txt"><b>{alerta.titulo}</b><span>Volta a aparecer em {dataCurta(ate)} se a situação continuar.</span></span>
                      <button type="button" className="btn btn-sec btn-mini" onClick={() => reativarAviso(alerta.chave)}>Reativar</button>
                    </div>
                  )
                })}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
