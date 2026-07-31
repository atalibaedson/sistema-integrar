import { useState } from 'react'
import { normalizarWhats } from '../actions'
import { useAppState } from '../store'
import { supabase } from '../supabaseClient'
import { navegar } from '../router'
import type { Usuario } from '../types'

// Mascara o e-mail para a desambiguação de WhatsApp compartilhado
function mascarar(email?: string): string {
  if (!email) return '(sem e-mail)'
  const [antes, depois] = email.split('@')
  return `${antes.slice(0, 2)}***@${depois ?? ''}`
}

// Login para quem já tem conta: aceita e-mail OU WhatsApp como identificador.
export default function Entrar() {
  const s = useAppState()
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [opcoes, setOpcoes] = useState<Usuario[]>([]) // WhatsApp compartilhado
  const [emailEscolhido, setEmailEscolhido] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  // Resolve o identificador digitado para o e-mail da conta
  function resolverEmail(): string | null {
    const id = identificador.trim()
    if (id.includes('@')) return id.toLowerCase()
    const digitos = normalizarWhats(id)
    if (digitos.length < 10) {
      setErro('Digite seu e-mail ou um número de WhatsApp com DDD.')
      return null
    }
    const comConta = s.usuarios.filter(
      (u) => u.authUserId && normalizarWhats(u.whatsapp) === digitos && u.email,
    )
    if (comConta.length === 0) {
      const semConta = s.usuarios.some((u) => normalizarWhats(u.whatsapp) === digitos)
      setErro(
        semConta
          ? 'Esse WhatsApp está na equipe, mas ainda não tem conta com senha. Faça o cadastro primeiro — ou entre com o e-mail.'
          : 'Não encontramos esse WhatsApp. Tente entrar com o e-mail, ou faça o cadastro. (Se você acabou de se cadastrar em outro aparelho, aguarde uns instantes e tente de novo.)',
      )
      return null
    }
    if (comConta.length > 1 && !emailEscolhido) {
      setOpcoes(comConta)
      setAviso('Encontramos mais de uma pessoa com esse WhatsApp — confirme qual é você.')
      return null
    }
    return (emailEscolhido || comConta[0].email!).toLowerCase()
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setAviso('')
    if (!supabase) {
      setErro('Sincronização online não configurada — o login precisa dela.')
      return
    }
    const email = resolverEmail()
    if (!email) return
    if (!senha) {
      setErro('Digite a sua senha.')
      return
    }
    setEntrando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEntrando(false)
    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        setErro('Seu e-mail ainda não foi confirmado. Procure o link na sua caixa de entrada (ou no spam).')
      } else if (/invalid login credentials/i.test(error.message)) {
        setErro('E-mail/WhatsApp ou senha incorretos.')
      } else {
        setErro(`Não foi possível entrar: ${error.message}`)
      }
      return
    }
    // O App.tsx assume a identidade automaticamente quando a sessão aparecer
    navegar('/')
  }

  async function reenviarConfirmacao() {
    const email = resolverEmail()
    if (!email || !supabase) return
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setAviso(error ? `Não foi possível reenviar: ${error.message}` : `Reenviamos o link de confirmação para ${email}.`)
  }

  return (
    <div className="ac-tela">
      <div className="ac-cartao">
        <div className="ac-cab">
          <div className="ac-selo">{s.config.nomeIgreja.trim().slice(0, 1).toUpperCase() || '🙏'}</div>
          <h1>{s.config.nomeIgreja}</h1>
          <p className="ac-boas-vindas">Entrar no sistema</p>
          <p className="ac-sub">Use o e-mail ou o WhatsApp da sua conta.</p>
        </div>

        {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}
        {aviso && <div className="alerta">ℹ️ <div>{aviso}</div></div>}

        <form onSubmit={entrar} className="ac-form">
          <label className="campo"><span>E-mail ou WhatsApp</span>
            <input
              type="text" value={identificador} autoFocus
              onChange={(e) => { setIdentificador(e.target.value); setOpcoes([]); setEmailEscolhido('') }}
              placeholder="voce@exemplo.com ou (00) 90000-0000"
              autoComplete="username"
            />
          </label>

          {opcoes.length > 1 && (
            <div className="campo"><span>Qual é você?</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {opcoes.map((u) => (
                  <label key={u.id} className="check">
                    <input
                      type="radio" name="quem"
                      checked={emailEscolhido === u.email}
                      onChange={() => setEmailEscolhido(u.email!)}
                    />
                    {u.nome} · {mascarar(u.email)}
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="campo"><span>Senha</span>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
          </label>

          <button className="btn ac-btn-enviar" type="submit" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>

          <p style={{ fontSize: 13, textAlign: 'center', marginTop: 10 }}>
            Ainda não tem conta? <a href="#/cadastro-integrante">Cadastre-se</a>
            {' · '}
            <a href="#/" onClick={(e) => { e.preventDefault(); void reenviarConfirmacao() }}>Reenviar confirmação</a>
          </p>
        </form>
      </div>
    </div>
  )
}
