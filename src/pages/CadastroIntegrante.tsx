import { useRef, useState } from 'react'
import { cadastrarIntegrante } from '../actions'
import { useAppState } from '../store'
import { PAPEL_COR, PAPEL_LABEL, rotuloPapel, SITUACAO_CIVIL_LABEL, type Papel, type SituacaoCivil } from '../types'

// Descrição curta de cada função, para a pessoa escolher com segurança.
const PAPEL_DESC: Record<Papel, string> = {
  coordenacao: 'Distribui os visitantes e acompanha o funil da consolidação.',
  consolidador: 'Faz os contatos pós-culto e registra o acompanhamento.',
  lider: 'Recebe o visitante na Conexão e acompanha até a integração.',
  pastor: 'Cobertura pastoral e casos de cuidado/crise.',
  acolhedor: 'Cadastra os visitantes no dia do culto — acesso só ao formulário de cadastro.',
}

const ETAPAS = ['Seus dados', 'Funções e foto', 'Seu acesso'] as const

// Cadastro público de integrante — assistente em 3 passos.
// Fluxo: preencher → confirmar e-mail → aguardar aprovação da liderança.
export default function CadastroIntegrante() {
  const s = useAppState()
  const termoGrupo = s.config.termoGrupo?.trim() || 'Conexão'
  const [etapa, setEtapa] = useState(1) // 1, 2, 3
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [situacao, setSituacao] = useState<SituacaoCivil | ''>('')
  const [conexaoId, setConexaoId] = useState('')
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

  // Valida uma etapa; devolve a mensagem de erro ou null se estiver ok.
  function validar(n: number): string | null {
    if (n === 1) {
      if (!nome.trim() || !whatsapp.trim() || !email.trim())
        return 'Preencha nome, WhatsApp e e-mail — o e-mail é a sua conta de acesso.'
      if (!/.+@.+\..+/.test(email.trim())) return 'Esse e-mail não parece válido. Confira, por favor.'
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
    const r = await cadastrarIntegrante({
      nome, whatsapp, email, senha,
      dataNascimento: dataNascimento || undefined,
      situacaoCivil: situacao || undefined,
      conexaoId: conexaoId || undefined,
      fotoArquivo: foto,
      papeis,
      loginPreferido,
      consentimentoLgpd: consentimento,
    })
    setEnviando(false)
    if (!r.ok) { setErro(r.erro ?? 'Não foi possível concluir o cadastro. Tente novamente.'); return }
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
      <div className="ac-cartao ac-cartao-lg">
        <div className="ac-cab">
          <div className="ac-selo">{s.config.nomeIgreja.trim().slice(0, 1).toUpperCase() || '🙏'}</div>
          <h1>{s.config.nomeIgreja}</h1>
          <p className="ac-boas-vindas">Criar sua conta de integrante</p>
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
                <label className="campo"><span>Data de nascimento</span>
                  <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
                </label>
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
                <label className="campo"><span>De qual {termoGrupo} você faz parte?</span>
                  <select value={conexaoId} onChange={(e) => setConexaoId(e.target.value)}>
                    <option value="">— selecionar —</option>
                    {s.conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* ---------- Etapa 2 — Funções e foto ---------- */}
          {etapa === 2 && (
            <div className="wz-secao">
              <div className="wz-titulo-secao">Quais funções você exerce? <em>marque todas que se aplicam</em></div>
              <div className="wz-papeis">
                {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) => {
                  const sel = papeis.includes(p)
                  return (
                    <button
                      type="button" key={p}
                      className={`wz-papel ${sel ? 'sel' : ''}`}
                      onClick={() => alternarPapel(p)}
                      style={sel ? { borderColor: PAPEL_COR[p], background: PAPEL_COR[p] + '12' } : undefined}
                    >
                      <span className="wz-papel-dot" style={{ background: PAPEL_COR[p] }} />
                      <span className="wz-papel-txt">
                        <b>{rotuloPapel(p)}</b>
                        <small>{PAPEL_DESC[p]}</small>
                      </span>
                      <span className="wz-papel-check" style={sel ? { background: PAPEL_COR[p], borderColor: PAPEL_COR[p] } : undefined}>
                        {sel ? '✓' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>

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
    </div>
  )
}
