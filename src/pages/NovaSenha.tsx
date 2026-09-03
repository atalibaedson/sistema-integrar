import { useState } from 'react'
import { useAppState } from '../store'
import { supabase } from '../supabaseClient'
import { useSessaoReal } from '../acesso'

// Tela de redefinição de senha. A pessoa chega aqui pelo link "Esqueci a senha"
// recebido por e-mail: o token do link vira uma sessão (supabaseClient.ts) e o
// evento PASSWORD_RECOVERY navega para cá. Com a sessão ativa, basta gravar a
// nova senha com updateUser.
export default function NovaSenha() {
  const s = useAppState()
  const sessao = useSessaoReal()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErro('A senha e a confirmação não estão iguais.')
      return
    }
    if (!supabase) {
      setErro('Sincronização online não configurada — a troca de senha precisa dela.')
      return
    }
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) {
      if (/should be different/i.test(error.message)) {
        setErro('A nova senha precisa ser diferente da anterior.')
      } else {
        setErro(`Não foi possível salvar a nova senha: ${error.message}`)
      }
      return
    }
    // Mesmo padrão do login: recarrega na raiz para o app subir já com a
    // sessão restaurada, sem corrida entre o roteador (hash) e o login.
    alert('Senha alterada com sucesso! Você já está conectado(a).')
    window.location.hash = '/'
    window.location.reload()
  }

  return (
    <div className="ac-tela">
      <div className="ac-cartao">
        <div className="ac-cab">
          <div className="ac-selo">{s.config.nomeIgreja.trim().slice(0, 1).toUpperCase() || '🙏'}</div>
          <h1>{s.config.nomeIgreja}</h1>
          <p className="ac-boas-vindas">Definir nova senha</p>
          <p className="ac-sub">Escolha a senha que você vai usar para entrar no sistema.</p>
        </div>

        {!sessao ? (
          <>
            <div className="alerta alerta-warn">
              ⚠️ <div>Este link de redefinição é inválido ou já expirou. Peça um novo na tela de entrada, usando "Esqueci a senha".</div>
            </div>
            <p style={{ fontSize: 13, textAlign: 'center', marginTop: 10 }}>
              <a href="#/entrar">Voltar para a tela de entrada</a>
            </p>
          </>
        ) : (
          <>
            {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}
            <form onSubmit={salvar} className="ac-form">
              <label className="campo"><span>Nova senha</span>
                <input
                  type="password" value={senha} autoFocus
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="campo"><span>Confirmar nova senha</span>
                <input
                  type="password" value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <button className="btn ac-btn-enviar" type="submit" disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
