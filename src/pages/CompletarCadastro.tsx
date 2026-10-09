import { useEffect, useState } from 'react'
import { carregarConexoesPublicas, useAppState } from '../store'
import type { ConexaoPublica } from '../nuvem'
import { type Papel } from '../types'
import { solicitarAcesso, supabase } from '../supabaseClient'
import { SeletorData } from '../campos'
import SeletorFuncoes from '../SeletorFuncoes'

// "Completar cadastro de integrante": para quem já tem conta de login (criada no
// Louvor, no Check-iFE…) e entrou no Integrar sem pedido de acesso. Pede só o que
// o Integrar precisa — funções e grupo — e cria o pedido, que a liderança aprova.
// Nome, telefone e nascimento vêm da própria conta, quando já existem.
export default function CompletarCadastro({ aoEnviar }: { aoEnviar: () => void }) {
  const termoGrupo = useAppState().config.termoGrupo?.trim() || 'Conexão'
  const [nome, setNome] = useState('')
  const [whats, setWhats] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [conexao, setConexao] = useState('')
  const [papeis, setPapeis] = useState<Papel[]>([])
  const [consentimento, setConsentimento] = useState(false)
  const [conexoes, setConexoes] = useState<ConexaoPublica[]>([])
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    void carregarConexoesPublicas().then((l) => { if (vivo && l) setConexoes(l) })
    // Dados que a conta já tem (padrão combinado entre os sistemas: nome, telefone, nascimento)
    void supabase?.auth.getUser().then(({ data }) => {
      const m = (data.user?.user_metadata ?? {}) as Record<string, unknown>
      if (!vivo) return
      if (typeof m.nome === 'string') setNome((x) => x || (m.nome as string))
      if (typeof m.telefone === 'string') setWhats((x) => x || (m.telefone as string))
      if (typeof m.nascimento === 'string') setNascimento((x) => x || (m.nascimento as string))
    })
    return () => { vivo = false }
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (nome.trim().length < 2 || whats.replace(/\D/g, '').length < 10) { setErro('Informe o nome completo e o WhatsApp com DDD.'); return }
    if (papeis.length === 0) { setErro('Marque pelo menos uma função que você exerce no ministério.'); return }
    if (!conexao) { setErro(`Escolha a ${termoGrupo} de que você participa — ou "Ainda não participo".`); return }
    if (!consentimento) { setErro('Para continuar, é preciso autorizar o uso dos seus dados.'); return }
    setErro('')
    setEnviando(true)
    const r = await solicitarAcesso({
      ficha: { nome, telefone: whats, nascimento, conexao, funcoes: papeis, consentimento: true },
    })
    setEnviando(false)
    if (!r.ok) { setErro(r.erro ?? 'Não foi possível enviar o pedido. Tente de novo.'); return }
    aoEnviar()
  }

  return (
    <form onSubmit={enviar} className="cad-form completar">
      <h1 className="ac-titulo-ok">Complete o seu cadastro</h1>
      <p className="ac-texto-ok">
        Você já tem uma conta, mas ainda não pediu acesso ao Integrar. Preencha abaixo; a liderança aprova em seguida.
      </p>
      {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}

      <label className="campo"><span>Nome completo *</span>
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <div className="ac-grupo">
        <label className="campo"><span>WhatsApp *</span>
          <input type="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(00) 90000-0000" />
        </label>
        <div className="campo"><span>Data de nascimento</span>
          <SeletorData value={nascimento} onChange={setNascimento} max={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>
      <label className="campo"><span>Você participa de uma {termoGrupo}? *</span>
        <select value={conexao} onChange={(e) => setConexao(e.target.value)}>
          <option value="">— escolher —</option>
          {conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          <option value="nenhuma">Ainda não participo de uma {termoGrupo}</option>
        </select>
      </label>

      <div className="wz-titulo-secao" style={{ marginTop: 14 }}>Quais funções você exerce? <em>marque todas que se aplicam</em></div>
      <SeletorFuncoes papeis={papeis} onMudar={setPapeis} />

      <div className="ac-lgpd">
        🔒 Seus dados serão usados apenas para a organização do ministério de consolidação e para o seu acesso ao sistema.
      </div>
      <label className="check">
        <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
        Autorizo o uso dos meus dados para esse fim. *
      </label>
      <div className="wz-acoes">
        <span />
        <button type="submit" className="btn ac-btn-enviar" disabled={enviando}>{enviando ? 'Enviando…' : 'Pedir acesso'}</button>
      </div>
    </form>
  )
}
