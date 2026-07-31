import { useMemo, useState } from 'react'
import { useAppState } from '../store'
import { setUsuarioAtualId } from '../acesso'
import { registrarAuditoria } from '../auditoria'
import { PAPEL_LABEL, type Usuario } from '../types'
import { iniciais } from './Equipe'

// Login PROVISÓRIO — enquanto o Supabase Auth não está ligado (ver SUPABASE-AUTH.md),
// a pessoa entra apenas escolhendo o próprio nome, sem senha. Assim que o login real
// (Entrar.tsx) estiver ativo, esta tela é substituída.
export default function EntrarProvisorio() {
  const s = useAppState()
  const [busca, setBusca] = useState('')

  const ativos = useMemo(
    () => s.usuarios.filter((u) => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [s.usuarios],
  )
  const termo = busca.trim().toLowerCase()
  const resultados = termo
    ? ativos.filter((u) => u.nome.toLowerCase().includes(termo)).slice(0, 8)
    : []

  function entrar(u: Usuario) {
    registrarAuditoria('🔑 Entrou (acesso provisório por nome)', {
      alvoTipo: 'usuario', alvoId: u.id, alvoNome: u.nome,
    })
    setUsuarioAtualId(u.id)
    // Recarrega na raiz para o app subir já com a identidade aplicada — evita a
    // tela em branco por corrida entre o roteador (hash) e o estado.
    window.location.hash = '/'
    window.location.reload()
  }

  return (
    <div className="ac-tela">
      <div className="ac-cartao">
        <div className="ac-cab">
          <div className="ac-selo">{s.config.nomeIgreja.trim().slice(0, 1).toUpperCase() || '🙏'}</div>
          <h1>{s.config.nomeIgreja}</h1>
          <p className="ac-boas-vindas">Entrar no sistema</p>
          <p className="ac-sub">Encontre o seu nome para acessar.</p>
        </div>

        <div className="ac-aviso-prov">
          🔓 <div>Acesso provisório: por enquanto, é só achar o seu nome — sem senha. Em breve o acesso passa a ter senha.</div>
        </div>

        <label className="campo"><span>Seu nome</span>
          <input
            type="text" value={busca} autoFocus
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Comece a digitar o seu nome…"
            autoComplete="off"
          />
        </label>

        {termo.length > 0 && (
          <div className="ac-lista">
            {resultados.length === 0 ? (
              <p className="ac-lista-vazia">Nenhum nome encontrado. Confira a digitação ou <a href="#/cadastro-integrante">crie a sua conta</a>.</p>
            ) : (
              resultados.map((u) => (
                <button key={u.id} type="button" className="ac-pessoa" onClick={() => entrar(u)}>
                  {u.fotoUrl
                    ? <img src={u.fotoUrl} alt="" className="ac-pessoa-foto" />
                    : <span className="ac-pessoa-ini">{iniciais(u.nome)}</span>}
                  <span className="ac-pessoa-info">
                    <b>{u.nome}</b>
                    <small>{u.papeis.map((p) => PAPEL_LABEL[p]).join(' · ')}</small>
                  </span>
                  <span className="ac-pessoa-seta">→</span>
                </button>
              ))
            )}
          </div>
        )}

        <p className="ac-rodape-link">
          Ainda não tem cadastro? <a href="#/cadastro-integrante">Criar minha conta</a>
        </p>
      </div>
    </div>
  )
}
