import { useAppState } from '../store'
import { ativarPrimeiroAdmin, existeAdminAprovado } from '../actions'
import { sairDaConta } from '../supabaseClient'
import type { Usuario } from '../types'

// Tela de espera do login real: a pessoa está autenticada, mas a conta ainda
// não pode usar o sistema (e-mail não confirmado, aprovação pendente, rejeição
// ou cadastro ainda não sincronizado neste aparelho).
export default function AguardandoAprovacao({ usuario }: { usuario?: Usuario }) {
  const s = useAppState()
  // Bootstrap: enquanto não há NENHUM administrador aprovado, a 1ª pessoa que
  // confirmou o e-mail pode ativar o próprio acesso (senão não há quem aprove).
  const podeSerPrimeiroAdmin = usuario?.statusAcesso === 'pendente_aprovacao' && !existeAdminAprovado(s)

  let icone = '⏳'
  let titulo = 'Aguardando liberação'
  let texto: React.ReactNode =
    'Sua conta foi criada, mas ainda não está liberada. Se você acabou de se cadastrar, aguarde alguns instantes — os dados podem estar sincronizando.'

  if (usuario?.statusAcesso === 'pendente_confirmacao_email') {
    icone = '📬'
    titulo = 'Confirme seu e-mail'
    texto = <>Enviamos um link de confirmação para <b>{usuario.email}</b>. Abra o e-mail e clique no link para continuar.</>
  } else if (usuario?.statusAcesso === 'pendente_aprovacao') {
    icone = '🤝'
    titulo = `Quase lá, ${usuario.nome.split(' ')[0]}!`
    texto = 'Seu e-mail foi confirmado. Agora a liderança (Pastores e Gestão Ministerial ou Gestão Integração) precisa aprovar o seu acesso — você será liberado(a) em breve.'
  } else if (usuario?.statusAcesso === 'rejeitado') {
    icone = '🚫'
    titulo = 'Acesso não liberado'
    texto = (
      <>
        Seu acesso não foi aprovado pela liderança.
        {usuario.motivoRejeicao && <> Motivo informado: <b>{usuario.motivoRejeicao}</b>.</>}
        {' '}Se acha que houve um engano, fale com a coordenação do ministério.
      </>
    )
  }

  return (
    <div className="ac-tela">
      <div className="ac-cartao ac-cartao-ok">
        <div className="ac-check">{icone}</div>
        <h1 className="ac-titulo-ok">{titulo}</h1>
        <p className="ac-texto-ok">{texto}</p>

        {podeSerPrimeiroAdmin && usuario && (
          <div className="ac-bootstrap">
            <p>
              🔑 <b>Você é o primeiro a acessar.</b> Como ainda não há nenhum administrador
              aprovado, ative o seu acesso como <b>Gestão Integração</b> para começar a usar o
              sistema e aprovar o restante da equipe.
            </p>
            <button
              className="btn"
              onClick={() => {
                if (confirm('Ativar a SUA conta como administrador (Gestão Integração)? Faça isso apenas se você é o responsável pela configuração do sistema.')) {
                  ativarPrimeiroAdmin(usuario.id)
                }
              }}
            >
              Ativar meu acesso como administrador
            </button>
          </div>
        )}

        <p style={{ fontSize: 13, textAlign: 'center', marginTop: 16 }}>
          {s.config.nomeIgreja} ·{' '}
          <a href="#/" onClick={(e) => { e.preventDefault(); void sairDaConta() }}>Sair da conta</a>
        </p>
      </div>
    </div>
  )
}
