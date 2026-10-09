import { useEffect, useRef, useState } from 'react'
import { criarContaIntegrante } from '../actions'
import { carregarConexoesPublicas, carregarConfigPublica, estadoEhVirgem, useAppState } from '../store'
import type { ConexaoPublica } from '../nuvem'
import { SITUACAO_CIVIL_LABEL, type Papel, type SituacaoCivil } from '../types'
import { SeletorData } from '../campos'
import SeletorFuncoes from '../SeletorFuncoes'
import { supabase } from '../supabaseClient'
import { urlDoApp } from '../urlApp'
import { IcoEmail } from '../icones'
import TelaPublica from '../TelaPublica'

const ETAPAS = ['Seus dados', 'Funções e foto', 'Seu acesso'] as const

// Cadastro público de integrante — assistente em 3 passos.
// Fluxo: preencher → confirmar o e-mail (quando a confirmação está ligada no projeto)
// → aguardar a aprovação da liderança. Ver criarContaIntegrante em actions.ts.
export default function CadastroIntegrante() {
  const s = useAppState()
  const termoGrupo = s.config.termoGrupo?.trim() || 'Conexão'

  // Quem se cadastra ainda não está logado, e o RLS não entrega o estado da
  // igreja a anônimos. Nome/cores/termos e a lista de grupos vêm dos canais
  // públicos da igreja DESTE endereço — antes, num aparelho novo, a tela
  // mostrava o nome padrão e os grupos de exemplo.
  const [conexoesPub, setConexoesPub] = useState<ConexaoPublica[] | null>(null)
  useEffect(() => {
    let vivo = true
    void carregarConfigPublica()
    void carregarConexoesPublicas().then((l) => { if (vivo) setConexoesPub(l) })
    return () => { vivo = false }
  }, [])
  // Sem a lista pública (função ainda não criada ou sem rede): usa os grupos do
  // aparelho só se ele já tiver os dados reais da igreja — nunca os de exemplo.
  const conexoes: ConexaoPublica[] = conexoesPub ?? (estadoEhVirgem() ? [] : s.conexoes)
  const [etapa, setEtapa] = useState(1) // 1, 2, 3
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [situacao, setSituacao] = useState<SituacaoCivil | ''>('')
  const [conexao, setConexao] = useState('') // id, 'nenhuma' ou '' (ainda não escolheu)
  const [papeis, setPapeis] = useState<Papel[]>([])
  const [loginPreferido, setLoginPreferido] = useState<'email' | 'whatsapp'>('email')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [foto, setFoto] = useState<File | undefined>()
  const [fotoPreview, setFotoPreview] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState<'confirmar' | 'pedido' | null>(null)
  const [erro, setErro] = useState('')
  const [reenvio, setReenvio] = useState<{ msg: string; ate: number }>({ msg: '', ate: 0 })
  const [agora, setAgora] = useState(Date.now())
  const fotoInput = useRef<HTMLInputElement>(null)

  // relógio só para a espera do "reenviar e-mail"
  useEffect(() => {
    if (reenvio.ate <= Date.now()) return
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [reenvio.ate])

  function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setFoto(f)
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoPreview(f ? URL.createObjectURL(f) : '')
  }

  // Valida uma etapa; devolve a mensagem de erro ou null se estiver ok.
  function validar(n: number): string | null {
    if (n === 1) {
      if (!nome.trim() || !whatsapp.trim() || !email.trim())
        return 'Preencha nome, WhatsApp e e-mail — o e-mail é a sua conta de acesso.'
      if (!/.+@.+\..+/.test(email.trim())) return 'Esse e-mail não parece válido. Confira, por favor.'
      if (!conexao) return `Escolha a ${termoGrupo} de que você participa — ou "Ainda não participo".`
    }
    if (n === 2) {
      if (papeis.length === 0) return 'Marque pelo menos uma função que você exerce no ministério.'
    }
    if (n === 3) {
      if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
      if (senha !== confirmarSenha) return 'A senha e a confirmação não estão iguais.'
      if (!consentimento) return 'Para continuar, é preciso autorizar o uso dos seus dados (marque a caixinha).'
    }
    return null
  }

  function avancar() {
    const e = validar(etapa)
    if (e) { setErro(e); return }
    setErro('')
    setEtapa((n) => Math.min(3, n + 1))
  }
  function voltar() { setErro(''); setEtapa((n) => Math.max(1, n - 1)) }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    for (const n of [1, 2, 3]) {
      const msg = validar(n)
      if (msg) { setErro(msg); setEtapa(n); return }
    }
    setErro('')
    setEnviando(true)
    const r = await criarContaIntegrante({
      nome, whatsapp, email, senha,
      dataNascimento: dataNascimento || undefined,
      situacaoCivil: situacao || undefined,
      conexao: conexao || 'nenhuma',
      fotoArquivo: foto,
      papeis,
      loginPreferido,
      consentimentoLgpd: consentimento,
    })
    setEnviando(false)
    if (!r.ok) { setErro(r.erro ?? 'Não foi possível concluir o cadastro. Tente novamente.'); return }
    setEnviado(r.precisaConfirmar ? 'confirmar' : 'pedido')
    setReenvio({ msg: '', ate: Date.now() + 60_000 })
  }

  async function reenviarEmail() {
    if (!supabase || reenvio.ate > Date.now()) return
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: urlDoApp() } })
    setReenvio({
      msg: error ? `Não foi possível reenviar agora: ${error.message}` : 'Enviamos o link de novo. Veja também a caixa de spam.',
      ate: Date.now() + 60_000,
    })
  }

  if (enviado === 'confirmar') {
    const espera = Math.max(0, Math.ceil((reenvio.ate - agora) / 1000))
    return (
      <TelaPublica>
        <div className="ac-cartao ac-cartao-ok">
          <div className="ac-check"><IcoEmail size={34} /></div>
          <h1 className="ac-titulo-ok">Confirme seu e-mail</h1>
          <p className="ac-texto-ok">
            Enviamos um link para <b>{email.trim().toLowerCase()}</b>. Confirme para entrar — depois disso, a liderança
            precisa aprovar o seu acesso.
          </p>
          <div className="alerta">
            <div>Não chegou? Veja a caixa de <b>spam</b> ou lixo eletrônico. O link só vale por um tempo.</div>
          </div>
          {reenvio.msg && <p className="ac-texto-ok" style={{ fontSize: 13 }}>{reenvio.msg}</p>}
          <div className="wz-acoes" style={{ justifyContent: 'center', gap: 10 }}>
            <button type="button" className="btn btn-sec" disabled={espera > 0} onClick={() => void reenviarEmail()}>
              {espera > 0 ? `Reenviar e-mail (${espera}s)` : 'Reenviar e-mail'}
            </button>
            <a className="btn" href="#/entrar" style={{ textDecoration: 'none' }}>Já confirmei — entrar</a>
          </div>
        </div>
      </TelaPublica>
    )
  }

  if (enviado === 'pedido') {
    return (
      <TelaPublica>
        <div className="ac-cartao ac-cartao-ok">
          <div className="ac-check">🤝</div>
          <h1 className="ac-titulo-ok">Cadastro recebido!</h1>
          <p className="ac-texto-ok">
            Seu pedido foi enviado para a liderança. Assim que for aprovado, você já poderá
            entrar no sistema com o e-mail <b>{email.trim().toLowerCase()}</b> e a senha escolhida.
          </p>
          <div className="wz-acoes" style={{ justifyContent: 'center' }}>
            <a className="btn" href="#/entrar" style={{ textDecoration: 'none' }}>Entrar</a>
          </div>
        </div>
      </TelaPublica>
    )
  }

  return (
    <TelaPublica larga>
      <div className="ac-cartao ac-cartao-lg">
        <div className="ac-cab">
          <h1 className="ac-boas-vindas">Criar meu acesso</h1>
          <p className="ac-sub">Leva 3 passos. Depois você confirma o e-mail, a liderança aprova e você já pode entrar.</p>
        </div>

        {/* Progresso */}
        <div className="wz-stepper">
          {ETAPAS.map((rotulo, i) => {
            const num = i + 1
            const estado = num < etapa ? 'feito' : num === etapa ? 'ativo' : ''
            return (
              <div key={rotulo} className={`wz-step ${estado}`}>
                <span className="wz-num">{num < etapa ? '✓' : num}</span>
                <span className="wz-rotulo">{rotulo}</span>
              </div>
            )
          })}
        </div>

        {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}

        <form onSubmit={enviar} className="cad-form">
          {/* ---------- Etapa 1 — Dados ---------- */}
          {etapa === 1 && (
            <div className="wz-secao">
              <label className="campo"><span>Nome completo *</span>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
              </label>
              <div className="ac-grupo">
                <label className="campo"><span>WhatsApp *</span>
                  <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 90000-0000" />
                </label>
                <div className="campo"><span>Data de nascimento</span>
                  <SeletorData value={dataNascimento} onChange={setDataNascimento} max={new Date().toISOString().slice(0, 10)} />
                </div>
              </div>
              <label className="campo"><span>E-mail * <em className="campo-dica">(será sua conta de acesso)</em></span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
              </label>
              <div className="ac-grupo">
                <label className="campo"><span>Situação civil</span>
                  <select value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoCivil | '')}>
                    <option value="">— selecionar —</option>
                    {Object.entries(SITUACAO_CIVIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                <label className="campo"><span>Você participa de uma {termoGrupo}? *</span>
                  <select value={conexao} onChange={(e) => setConexao(e.target.value)}>
                    <option value="">— escolher —</option>
                    {conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    <option value="nenhuma">Ainda não participo de uma {termoGrupo}</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* ---------- Etapa 2 — Funções e foto ---------- */}
          {etapa === 2 && (
            <div className="wz-secao">
              <div className="wz-titulo-secao">Quais funções você exerce? <em>marque todas que se aplicam</em></div>
              <SeletorFuncoes papeis={papeis} onMudar={setPapeis} />

              <div className="wz-titulo-secao" style={{ marginTop: 22 }}>Foto de perfil <em>opcional</em></div>
              <div className="wz-foto">
                {fotoPreview
                  ? <img src={fotoPreview} alt="Prévia da foto" className="wz-foto-img" />
                  : <span className="wz-foto-vazia">{(nome.trim()[0] || '🙂').toUpperCase()}</span>}
                <div>
                  <button type="button" className="btn btn-sec" onClick={() => fotoInput.current?.click()}>
                    {fotoPreview ? 'Trocar foto' : 'Escolher foto'}
                  </button>
                  <p className="campo-dica" style={{ margin: '6px 0 0' }}>JPG ou PNG, quadrada de preferência.</p>
                </div>
                <input ref={fotoInput} type="file" accept="image/*" onChange={escolherFoto} style={{ display: 'none' }} />
              </div>
            </div>
          )}

          {/* ---------- Etapa 3 — Acesso ---------- */}
          {etapa === 3 && (
            <div className="wz-secao">
              <div className="campo"><span>Como você prefere entrar no sistema?</span>
                <div className="wz-radios">
                  <label className={`wz-radio ${loginPreferido === 'email' ? 'sel' : ''}`}>
                    <input type="radio" name="loginPreferido" checked={loginPreferido === 'email'} onChange={() => setLoginPreferido('email')} />
                    Com o e-mail
                  </label>
                  <label className={`wz-radio ${loginPreferido === 'whatsapp' ? 'sel' : ''}`}>
                    <input type="radio" name="loginPreferido" checked={loginPreferido === 'whatsapp'} onChange={() => setLoginPreferido('whatsapp')} />
                    Com o WhatsApp
                  </label>
                </div>
              </div>
              <div className="ac-grupo">
                <label className="campo"><span>Senha * <em className="campo-dica">(mín. 8 caracteres)</em></span>
                  <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
                </label>
                <label className="campo"><span>Confirmar senha *</span>
                  <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} autoComplete="new-password" />
                </label>
              </div>
              <div className="ac-lgpd">
                🔒 Seus dados serão usados apenas para a organização do ministério de consolidação e para o
                seu acesso ao sistema. Não compartilhamos suas informações com terceiros.
              </div>
              <label className="check">
                <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
                Autorizo o uso dos meus dados para esse fim. *
              </label>
            </div>
          )}

          {/* ---------- Ações ---------- */}
          <div className="wz-acoes">
            {etapa > 1
              ? <button type="button" className="btn btn-sec" onClick={voltar}>← Voltar</button>
              : <span />}
            {etapa < 3
              ? <button type="button" className="btn" onClick={avancar}>Continuar →</button>
              : <button type="submit" className="btn ac-btn-enviar" disabled={enviando}>
                  {enviando ? 'Criando sua conta…' : 'Criar minha conta ✨'}
                </button>}
          </div>
        </form>

        <p className="ac-rodape-link">Já tem conta? <a href="#/entrar">Entrar</a></p>
      </div>
    </TelaPublica>
  )
}
