import { useEffect, useRef, useState } from 'react'
import { ativarPrimeiroAdmin, pedirAcessoAutomatico } from '../actions'
import { garantirVinculoIgreja, sairDaConta, supabase, useAcessoConta } from '../supabaseClient'
import { igrejaAtivaId } from '../igrejas'
import { APPS_DAS_IGREJAS, igrejaDoCadastroSeOutra } from '../urlApp'
import { tentarSincronizarAgora } from '../store'
import { confirmar } from '../confirmar'
import { setUsuarioAtualId, useSessaoReal } from '../acesso'
import type { Usuario } from '../types'
import TelaPublica from '../TelaPublica'
import CompletarCadastro from './CompletarCadastro'

// Tela de espera do login real: a pessoa está autenticada, mas ainda não pode usar o
// sistema. Quem diz em que pé está o acesso é o SERVIDOR (função `acesso-membro`):
// conta pendente não lê o bloco da igreja, então não dá para olhar a ficha aqui.
//   sem pedido     → cria o pedido sozinho (cadastro feito neste site) ou pede os dados que faltam
//   aguardando     → espera a liderança; confere de tempos em tempos
//   aprovada       → o vínculo já existe: baixa os dados e entra
//   recusada / desativada → mostra o motivo
const INTERVALO_CONFERENCIA_MS = 15_000

export default function AguardandoAprovacao({ usuario }: { usuario?: Usuario }) {
  const acesso = useAcessoConta()
  const sessao = useSessaoReal()
  const [pedindo, setPedindo] = useState(false)
  const [completar, setCompletar] = useState(false)
  const [erro, setErro] = useState('')
  const [ativando, setAtivando] = useState(false)
  const pediuAutomatico = useRef(false)
  // Cadastro feito para OUTRA igreja (o link do e-mail pode cair no endereço padrão):
  // undefined = ainda conferindo; null = é esta mesma (ou não dá para saber)
  const [outraIgreja, setOutraIgreja] = useState<string | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!sessao || !supabase) { setOutraIgreja(null); return }
    let vivo = true
    supabase.auth.getUser()
      .then(({ data }) => { if (vivo) setOutraIgreja(igrejaDoCadastroSeOutra(data.user?.user_metadata, igrejaAtivaId())) })
      .catch(() => { if (vivo) setOutraIgreja(null) })
    return () => { vivo = false }
  }, [sessao?.userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ainda não perguntamos ao servidor (ex.: a sessão acabou de chegar)
  useEffect(() => {
    if (sessao && !acesso.carregado) void garantirVinculoIgreja(sessao.userId)
  }, [sessao, acesso.carregado])

  // Conta sem pedido: tenta criar o pedido a partir do cadastro feito neste site
  useEffect(() => {
    // na igreja errada não pede nada sozinho: a tela oferece ir para a igreja do cadastro
    if (acesso.status !== 'sem_ficha' || pediuAutomatico.current || outraIgreja !== null) return
    pediuAutomatico.current = true
    setPedindo(true)
    void pedirAcessoAutomatico(sessao?.email).then((r) => {
      setPedindo(false)
      if (r.ok) return // o status vira "aguardando" sozinho
      if (r.semDados) setCompletar(true) // conta criada em outro sistema: pede os dados
      else setErro(r.erro ?? 'Não foi possível enviar o seu pedido.')
    })
  }, [acesso.status, sessao?.email, outraIgreja])

  // Aguardando ou recém-aprovada: confere o servidor e, havendo vínculo, baixa os dados
  useEffect(() => {
    if (acesso.status === 'aprovado' && acesso.vinculado) tentarSincronizarAgora()
    if (!sessao || (acesso.status !== 'pendente_aprovacao' && acesso.status !== 'aprovado')) return
    const id = window.setInterval(() => {
      void garantirVinculoIgreja(sessao.userId, true)
      if (acesso.status === 'aprovado') tentarSincronizarAgora()
    }, INTERVALO_CONFERENCIA_MS)
    return () => window.clearInterval(id)
  }, [acesso.status, acesso.vinculado, sessao])

  function sair() {
    setUsuarioAtualId(null)
    void sairDaConta()
  }

  const rodape = (
    <p style={{ fontSize: 13, textAlign: 'center', marginTop: 16 }}>
      <a href="#/" onClick={(e) => { e.preventDefault(); sair() }}>Sair da conta</a>
    </p>
  )

  // Ainda consultando
  if (!acesso.carregado || (acesso.status === 'sem_ficha' && (pedindo || outraIgreja === undefined))) {
    return (
      <TelaPublica>
        <div className="ac-cartao ac-cartao-ok">
          <div className="carregando-spin" style={{ margin: '0 auto 14px' }} />
          <p className="ac-texto-ok">{pedindo ? 'Enviando o seu pedido de acesso…' : 'Verificando o seu acesso…'}</p>
          {rodape}
        </div>
      </TelaPublica>
    )
  }

  // Não conseguiu falar com o servidor
  if (acesso.falhou && !acesso.status) {
    return (
      <TelaPublica>
        <div className="ac-cartao ac-cartao-ok">
          <div className="ac-check">📡</div>
          <h1 className="ac-titulo-ok">Sem conexão</h1>
          <p className="ac-texto-ok">Não foi possível verificar o seu acesso agora. Confira a internet e tente de novo.</p>
          <div className="wz-acoes" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => sessao && void garantirVinculoIgreja(sessao.userId, true)}>Tentar de novo</button>
          </div>
          {rodape}
        </div>
      </TelaPublica>
    )
  }

  // Cadastro feito para outra igreja: leva ao endereço certo (ou, se quiser mesmo, pede aqui)
  if (acesso.status === 'sem_ficha' && outraIgreja && !completar) {
    const destino = APPS_DAS_IGREJAS[outraIgreja]
    const aqui = APPS_DAS_IGREJAS[igrejaAtivaId()]?.nome ?? 'esta igreja'
    return (
      <TelaPublica larga>
        <div className="ac-cartao ac-cartao-lg">
          <div className="ac-check">⛪</div>
          <h1 className="ac-titulo-ok">Seu cadastro é da {destino.nome}</h1>
          <p className="ac-texto-ok">
            Você abriu o endereço da <b>{aqui}</b>. Para o seu pedido chegar à liderança certa, entre
            pelo endereço da <b>{destino.nome}</b> com o mesmo e-mail e senha.
          </p>
          <div className="wz-acoes" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="btn" href={destino.url}>Ir para a {destino.nome}</a>
            <button className="btn btn-sec" onClick={() => setCompletar(true)}>Quero pedir acesso à {aqui}</button>
          </div>
          {rodape}
        </div>
      </TelaPublica>
    )
  }

  // Conta sem pedido e os dados do cadastro não vieram (conta criada em outro sistema)
  if (acesso.status === 'sem_ficha') {
    return (
      <TelaPublica larga>
        <div className="ac-cartao ac-cartao-lg">
          {completar
            ? <CompletarCadastro aoEnviar={() => { if (sessao) void garantirVinculoIgreja(sessao.userId, true) }} />
            : (
              <>
                <div className="ac-check">⚠️</div>
                <h1 className="ac-titulo-ok">Não foi possível enviar o pedido</h1>
                <p className="ac-texto-ok">{erro || 'Tente de novo em instantes.'}</p>
                <div className="wz-acoes" style={{ justifyContent: 'center' }}>
                  <button className="btn" onClick={() => { pediuAutomatico.current = false; setErro(''); setCompletar(true) }}>Preencher meus dados</button>
                </div>
              </>
            )}
          {rodape}
        </div>
      </TelaPublica>
    )
  }

  let icone = '⏳'
  let titulo = 'Aguardando liberação'
  let texto: React.ReactNode = 'Sua conta foi criada, mas ainda não está liberada.'
  const primeiro = (acesso.nome ?? usuario?.nome ?? '').split(' ')[0]

  if (acesso.status === 'inativo') {
    icone = '⏸'
    titulo = 'Acesso desativado'
    texto = 'Sua conta foi desativada pela liderança. Se você voltou ao ministério ou acha que foi um engano, fale com a coordenação para reativar.'
  } else if (acesso.status === 'pendente_aprovacao') {
    icone = '🤝'
    titulo = primeiro ? `Quase lá, ${primeiro}!` : 'Quase lá!'
    texto = 'Seu cadastro foi recebido! A liderança (Pastores e Gestão Ministerial ou Gestão Integração) precisa aprovar o seu acesso — você será liberado(a) em breve. Pode fechar esta página: quando entrar de novo, já estará liberado.'
  } else if (acesso.status === 'rejeitado') {
    const motivo = acesso.motivo ?? usuario?.motivoRejeicao
    icone = '🚫'
    titulo = 'Acesso não liberado'
    texto = (
      <>
        Seu acesso não foi aprovado pela liderança.
        {motivo && <> Motivo informado: <b>{motivo}</b>.</>}
        {' '}Se acha que houve um engano, fale com a coordenação do ministério.
      </>
    )
  } else if (acesso.status === 'aprovado') {
    icone = '✅'
    titulo = 'Acesso liberado!'
    texto = 'Estamos carregando os dados da igreja…'
  }

  return (
    <TelaPublica>
      <div className="ac-cartao ac-cartao-ok">
        <div className="ac-check">{icone}</div>
        <h1 className="ac-titulo-ok">{titulo}</h1>
        <p className="ac-texto-ok">{texto}</p>

        {acesso.status === 'pendente_aprovacao' && acesso.podePrimeiroAdmin && (
          <div className="ac-bootstrap">
            <p>
              🔑 <b>Você é o primeiro a acessar.</b> Como ainda não há nenhum administrador
              aprovado, ative o seu acesso como <b>Gestão Integração</b> para começar a usar o
              sistema e aprovar o restante da equipe.
            </p>
            {erro && <div className="alerta alerta-warn" style={{ marginBottom: 10 }}>⚠️ <div>{erro}</div></div>}
            <button
              className="btn" disabled={ativando}
              onClick={async () => {
                if (!(await confirmar({
                  titulo: 'Ativar seu acesso como administrador',
                  mensagem: 'Ative a SUA conta como Gestão Integração apenas se você é o responsável pela configuração do sistema.',
                  confirmar: 'Ativar meu acesso',
                }))) return
                setAtivando(true)
                const r = await ativarPrimeiroAdmin()
                setAtivando(false)
                if (!r.ok) setErro(r.erro ?? 'Não foi possível ativar o acesso.')
              }}
            >
              {ativando ? 'Ativando…' : 'Ativar meu acesso como administrador'}
            </button>
          </div>
        )}
        {rodape}
      </div>
    </TelaPublica>
  )
}
