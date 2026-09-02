import { useState } from 'react'
import { useAppState } from '../store'
import { definirNovaSenha, sairDaConta } from '../supabaseClient'
import { navegar } from '../router'

// Tela aberta pelo link de "esqueci a senha": a pessoa já chega autenticada
// por uma sessão temporária e só precisa escolher a senha nova.
export default function NovaSenha() {
  const s = useAppState()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (senha !== confirmar) { setErro('A senha e a confirmação não estão iguais.'); return }
    setErro('')
    setSalvando(true)
    const falha = await definirNovaSenha(senha)
    setSalvando(false)
    if (falha) { setErro(`Não foi possível salvar a nova senha: ${falha}`); return }
    setPronto(true)
  }

  return (
    <div className="ac-tela">
      <div className="ac-cartao">
        <div className="ac-cab">
          <div className="ac-selo">{s.config.nomeIgreja.trim().slice(0, 1).toUpperCase() || '🙏'}</div>
          <h1>{s.config.nomeIgreja}</h1>
          <p className="ac-boas-vindas">{pronto ? 'Senha atualizada!' : 'Definir nova senha'}</p>
          {!pronto && <p className="ac-sub">Escolha a senha que você vai usar para entrar.</p>}
        </div>

        {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}

        {pronto ? (
          <div style={{ textAlign: 'center' }}>
            <p className="ac-texto-ok">Pronto — sua senha foi trocada. Você já está conectado(a).</p>
            <button className="btn ac-btn-enviar" onClick={() => { navegar('/'); window.location.reload() }}>
              Entrar no sistema
            </button>
          </div>
        ) : (
          <form onSubmit={salvar} className="ac-form">
            <label className="campo"><span>Nova senha <em className="campo-dica">(mín. 8 caracteres)</em></span>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" autoFocus />
            </label>
            <label className="campo"><span>Confirmar nova senha</span>
              <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
            </label>
            <button className="btn ac-btn-enviar" type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar nova senha'}
            </button>
            <p style={{ fontSize: 13, textAlign: 'center', marginTop: 10 }}>
              <a href="#/" onClick={(e) => { e.preventDefault(); void sairDaConta().then(() => navegar('/entrar')) }}>Cancelar</a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
