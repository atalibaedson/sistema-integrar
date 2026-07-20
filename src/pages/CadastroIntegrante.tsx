import { useRef, useState } from 'react'
import { cadastrarIntegrante } from '../actions'
import { useAppState } from '../store'
import { PAPEL_LABEL, SITUACAO_CIVIL_LABEL, type Papel, type SituacaoCivil } from '../types'

// Cadastro público de integrante do ministério — cria a conta de acesso.
// Fluxo: preencher → confirmar e-mail → aguardar aprovação da liderança.
export default function CadastroIntegrante() {
  const s = useAppState()
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [bairro, setBairro] = useState('')
  const [situacao, setSituacao] = useState<SituacaoCivil | ''>('')
  const [comoConheceu, setComoConheceu] = useState('')
  const [papeis, setPapeis] = useState<Papel[]>([])
  const [loginPreferido, setLoginPreferido] = useState<'email' | 'whatsapp'>('email')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [foto, setFoto] = useState<File | undefined>()
  const [fotoPreview, setFotoPreview] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const fotoInput = useRef<HTMLInputElement>(null)

  function alternarPapel(p: Papel) {
    setPapeis((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setFoto(f)
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoPreview(f ? URL.createObjectURL(f) : '')
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !whatsapp.trim() || !email.trim()) {
      setErro('Preencha nome, WhatsApp e e-mail — o e-mail é a sua conta de acesso.')
      return
    }
    if (!/.+@.+\..+/.test(email.trim())) {
      setErro('Esse e-mail não parece válido. Confira, por favor.')
      return
    }
    if (papeis.length === 0) {
      setErro('Marque pelo menos uma função que você exerce no ministério.')
      return
    }
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirmarSenha) {
      setErro('A senha e a confirmação não estão iguais.')
      return
    }
    if (!consentimento) {
      setErro('Para continuar, é preciso autorizar o uso dos seus dados (marque a caixinha abaixo).')
      return
    }
    setErro('')
    setEnviando(true)
    const r = await cadastrarIntegrante({
      nome, whatsapp, email, senha,
      dataNascimento: dataNascimento || undefined,
      bairro: bairro || undefined,
      situacaoCivil: situacao || undefined,
      comoConheceu: comoConheceu || undefined,
      fotoArquivo: foto,
      papeis,
      loginPreferido,
      consentimentoLgpd: consentimento,
    })
    setEnviando(false)
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível concluir o cadastro. Tente novamente.')
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="ac-tela">
        <div className="ac-cartao ac-cartao-ok">
          <div className="ac-check">📬</div>
          <h1 className="ac-titulo-ok">Quase lá!</h1>
          <p className="ac-texto-ok">
            Enviamos um link de confirmação para <b>{email}</b>. Abra o e-mail e clique no link para
            confirmar sua conta. Depois disso, a liderança vai revisar e liberar o seu acesso — você
            será avisado(a) quando estiver tudo pronto.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ac-tela">
      <div className="ac-cartao">
        <div className="ac-cab">
          <div className="ac-selo">{s.config.nomeIgreja.trim().slice(0, 1).toUpperCase() || '🙏'}</div>
          <h1>{s.config.nomeIgreja}</h1>
          <p className="ac-boas-vindas">Cadastro de integrante do ministério</p>
          <p className="ac-sub">
            Preencha seus dados e crie sua senha. Você vai confirmar o e-mail e, em seguida,
            a liderança libera o seu acesso ao sistema.
          </p>
        </div>

        {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}

        <form onSubmit={enviar} className="ac-form">
          <div className="ac-grupo">
            <label className="campo"><span>Nome completo *</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </label>
            <label className="campo"><span>WhatsApp *</span>
              <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 90000-0000" />
            </label>
          </div>

          <div className="ac-grupo">
            <label className="campo"><span>E-mail * (será sua conta de acesso)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
            </label>
            <label className="campo"><span>Data de nascimento</span>
              <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
            </label>
          </div>

          <div className="ac-grupo">
            <label className="campo"><span>Bairro</span>
              <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Seu bairro" />
            </label>
            <label className="campo"><span>Situação civil</span>
              <select value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoCivil | '')}>
                <option value="">— selecionar —</option>
                {Object.entries(SITUACAO_CIVIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>

          <label className="campo"><span>Como você chegou ao ministério?</span>
            <select value={comoConheceu} onChange={(e) => setComoConheceu(e.target.value)}>
              <option value="">— selecionar —</option>
              {s.config.comoConheceuOpcoes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>

          <div className="campo"><span>Funções que você exerce * (marque todas que se aplicam)</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) => (
                <label key={p} className="check">
                  <input type="checkbox" checked={papeis.includes(p)} onChange={() => alternarPapel(p)} />
                  {PAPEL_LABEL[p]}
                </label>
              ))}
            </div>
          </div>

          <div className="campo"><span>Foto de perfil (opcional)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              {fotoPreview && (
                <img src={fotoPreview} alt="Prévia da foto" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
              )}
              <input ref={fotoInput} type="file" accept="image/*" onChange={escolherFoto} />
            </div>
          </div>

          <div className="campo"><span>Como você prefere entrar no sistema?</span>
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              <label className="check">
                <input type="radio" name="loginPreferido" checked={loginPreferido === 'email'} onChange={() => setLoginPreferido('email')} />
                Com o e-mail
              </label>
              <label className="check">
                <input type="radio" name="loginPreferido" checked={loginPreferido === 'whatsapp'} onChange={() => setLoginPreferido('whatsapp')} />
                Com o WhatsApp
              </label>
            </div>
          </div>

          <div className="ac-grupo">
            <label className="campo"><span>Senha * (mínimo 8 caracteres)</span>
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

          <button className="btn ac-btn-enviar" type="submit" disabled={enviando}>
            {enviando ? 'Criando sua conta…' : 'Criar minha conta ✨'}
          </button>
          <p style={{ fontSize: 13, textAlign: 'center', marginTop: 10 }}>
            Já tem conta? <a href="#/entrar">Entrar</a>
          </p>
        </form>
      </div>
    </div>
  )
}
