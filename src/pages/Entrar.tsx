import { useState } from 'react'
import { normalizarWhats } from '../actions'
import { useAppState } from '../store'
import { supabase } from '../supabaseClient'
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
  const [mostrarSenha, setMostrarSenha] = useState(false)
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
    // Recarrega na raiz para o app subir já com a sessão restaurada — evita a
    // tela em branco por corrida entre o roteador (hash) e o estado de login.
    window.location.hash = '/'
    window.location.reload()
  }

  async function esqueciSenha() {
    setErro('')
    setAviso('')
    if (!supabase) {
      setErro('Sincronização online não configurada — o login precisa dela.')
      return
    }
    const email = resolverEmail()
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Volta para a raiz do site: o app detecta o token de recuperação e
      // abre a tela de nova senha (ver supabaseClient.ts).
      redirectTo: window.location.origin + window.location.pathname,
    })
    // E-mail mascarado: quando a pessoa digita o WhatsApp, não expomos o
    // e-mail completo da conta encontrada.
    setAviso(
      error
        ? `Não foi possível enviar o link: ${error.message}`
        : `Enviamos um link de redefinição de senha para ${mascarar(email)}. Procure na caixa de entrada (ou no spam).`,
    )
  }

  return (
    <div className="ac-tela">
      <div className="ac-cartao login-cartao">
        {/* Marca da igreja */}
        <div className="login-marca">
          <div className="ac-selo">{s.config.nomeIgreja.trim().slice(0, 1).toUpperCase() || '🙏'}</div>
          <div>
            <div className="login-igreja">{s.config.nomeIgreja}</div>
            <div className="login-sub2">{s.config.subtitulo}</div>
          </div>
        </div>

        <h1 className="login-titulo">Entrar</h1>
        <p className="login-intro">Acesse com o e-mail ou o WhatsApp da sua conta.</p>

        {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}
        {aviso && <div className="alerta">ℹ️ <div>{aviso}</div></div>}

        <form onSubmit={entrar} className="login-form">
          <label className="campo"><span>E-mail ou WhatsApp</span>
            <input
              type="text" value={identificador} autoFocus
              onChange={(e) => { setIdentificador(e.target.value); setOpcoes([]); setEmailEscolhido('') }}
              placeholder="voce@exemplo.com ou (00) 90000-0000"
              autoComplete="username"
            />
          </label>

          {opcoes.length > 1 && (
            <div className="campo"><span>Encontramos mais de uma conta com esse WhatsApp — qual é você?</span>
              <div className="login-opcoes">
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

          <label className="campo">
            <span className="login-senha-rot">
              Senha
              <a href="#/" onClick={(e) => { e.preventDefault(); void esqueciSenha() }}>Esqueci a senha</a>
            </span>
            <div className="login-senha-campo">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button" className="login-olho"
                onClick={() => setMostrarSenha((v) => !v)}
                title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          <button className="btn ac-btn-enviar login-btn" type="submit" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="login-rodape">
          Ainda não tem conta? <a href="#/cadastro-integrante">Criar meu acesso</a>
        </div>
      </div>
    </div>
  )
}
