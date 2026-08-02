import { useEffect, useState } from 'react'
import { cadastrarVisitante } from '../actions'
import { useAppState } from '../store'
import { Escolha, SeletorData, SIM_NAO } from '../campos'
import {
  HORARIO_CONTATO_LABEL, OPCOES_DESEJA_CONEXAO, SITUACAO_BATISMO_CURTO, SITUACAO_CIVIL_LABEL,
  type HorarioContato, type SituacaoBatismo, type SituacaoCivil,
} from '../types'

// Formulário público de acolhimento (QR code) — sem menu, em seções claras,
// no padrão do formulário da igreja. Cada campo (menos nome, contato e data de
// nascimento) pode ser ligado/desligado em Configurações → Autocadastro.
export default function Autocadastro() {
  const s = useAppState()
  const cfg = s.config
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [situacao, setSituacao] = useState<SituacaoCivil | ''>('')
  const [endereco, setEndereco] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [primeiraVez, setPrimeiraVez] = useState('')
  const [membroOutra, setMembroOutra] = useState('')
  const [comoConheceu, setComoConheceu] = useState('')
  const [batismo, setBatismo] = useState('')
  const [desejaConexao, setDesejaConexao] = useState('')
  const [desejaContato, setDesejaContato] = useState('')
  const [horario, setHorario] = useState('')
  const [pedidoOracao, setPedidoOracao] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  // Título da aba do navegador: "Cadastro Visitante - Nome da Igreja"
  useEffect(() => {
    const anterior = document.title
    document.title = `Cadastro Visitante - ${cfg.nomeIgreja}`
    return () => { document.title = anterior }
  }, [cfg.nomeIgreja])

  const temEndereco = cfg.autocadastroMostrarEndereco || cfg.autocadastroMostrarBairro || cfg.autocadastroMostrarCidade
  const temCaminhada = cfg.autocadastroPerguntarPrimeiraVez || cfg.autocadastroPerguntarMembroOutra ||
    cfg.autocadastroPerguntarBatismo || cfg.autocadastroPerguntarComoConheceu || cfg.autocadastroPerguntarConexao
  const temContato = cfg.autocadastroPerguntarContato || cfg.autocadastroPerguntarOracao

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !whatsapp.trim()) {
      setErro('Por favor, preencha seu nome e WhatsApp.')
      return
    }
    if (!consentimento) {
      setErro('Para continuar, é preciso autorizar o uso dos seus dados (marque a caixinha abaixo).')
      return
    }
    setErro('')
    setEnviando(true)
    cadastrarVisitante({
      nome, whatsapp,
      origem: 'qr_code',
      dataNascimento: dataNascimento || undefined,
      situacaoCivil: situacao || undefined,
      endereco: endereco || undefined,
      bairro: bairro || undefined,
      cidade: cidade || undefined,
      primeiraVez: primeiraVez ? primeiraVez === 'sim' : undefined,
      membroOutraIgreja: membroOutra ? membroOutra === 'sim' : undefined,
      situacaoBatismo: (batismo || undefined) as SituacaoBatismo | undefined,
      comoConheceu: comoConheceu || undefined,
      desejaConexao: desejaConexao || undefined,
      desejaContato: desejaContato ? desejaContato === 'sim' : undefined,
      melhorHorarioContato: (horario || undefined) as HorarioContato | undefined,
      pedidoOracao: pedidoOracao || undefined,
      flagMenorIdade: false,
      flagOutraCidade: false,
      consentimentoLgpd: consentimento,
    })
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="ac-tela ife-site">
        <div className="ac-cartao ac-cartao-ok">
          <div className="ac-check">🎉</div>
          <div className="ac-eyebrow">{cfg.nomeIgreja}</div>
          <h1 className="ac-titulo-ok">Recebemos você! <span className="ac-faisca">✦</span></h1>
          <p className="ac-texto-ok">{cfg.autocadastroMensagemFinal}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ac-tela ife-site">
      <div className="ac-cartao ac-cartao-lg">
        <div className="ac-cab">
          <div className="ac-selo">{cfg.nomeIgreja.trim().slice(0, 1).toUpperCase() || '🙏'}</div>
          <div className="ac-eyebrow">{cfg.nomeIgreja}</div>
          <p className="ac-boas-vindas">{cfg.autocadastroTitulo} <span className="ac-faisca">✦</span></p>
          <p className="ac-sub">{cfg.autocadastroMensagem}</p>
        </div>

        {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}

        <form onSubmit={enviar} className="ac-form">
          {/* ---------- Seus dados ---------- */}
          <div className="ac-secao">
            <div className="ac-secao-titulo">👤 Seus dados</div>
            <label className="campo"><span>Qual é o seu nome? *</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
            </label>
            <div className="ac-grupo">
              <label className="campo"><span>Contato / WhatsApp *</span>
                <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 90000-0000" />
              </label>
              <div className="campo"><span>Data de nascimento</span>
                <SeletorData value={dataNascimento} onChange={setDataNascimento} max={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>
            {cfg.autocadastroMostrarSituacaoCivil && (
              <label className="campo"><span>Estado civil</span>
                <select value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoCivil | '')}>
                  <option value="">— selecionar —</option>
                  {Object.entries(SITUACAO_CIVIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
            )}
          </div>

          {/* ---------- Onde você mora ---------- */}
          {temEndereco && (
            <div className="ac-secao">
              <div className="ac-secao-titulo">📍 Onde você mora</div>
              {cfg.autocadastroMostrarEndereco && (
                <label className="campo"><span>Endereço <em className="campo-dica">(opcional)</em></span>
                  <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua e número" />
                </label>
              )}
              <div className="ac-grupo">
                {cfg.autocadastroMostrarBairro && (
                  <label className="campo"><span>Bairro</span>
                    <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Seu bairro" />
                  </label>
                )}
                {cfg.autocadastroMostrarCidade && (
                  <label className="campo"><span>Cidade</span>
                    <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Sua cidade" />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ---------- Sobre sua caminhada ---------- */}
          {temCaminhada && (
            <div className="ac-secao">
              <div className="ac-secao-titulo">⛪ Sobre sua caminhada</div>
              {cfg.autocadastroPerguntarPrimeiraVez && (
                <div className="campo"><span>É a sua primeira vez na {cfg.nomeIgreja}?</span>
                  <Escolha valor={primeiraVez} opcoes={SIM_NAO} onEscolher={setPrimeiraVez} />
                </div>
              )}
              {cfg.autocadastroPerguntarMembroOutra && (
                <div className="campo"><span>Atualmente é membro de outra igreja?</span>
                  <Escolha valor={membroOutra} opcoes={SIM_NAO} onEscolher={setMembroOutra} />
                </div>
              )}
              {cfg.autocadastroPerguntarBatismo && (
                <div className="campo"><span>Você já é batizado(a)? <em className="campo-dica">(opcional)</em></span>
                  <Escolha
                    valor={batismo}
                    opcoes={[
                      { v: 'ja_batizado', rotulo: SITUACAO_BATISMO_CURTO.ja_batizado },
                      { v: 'nao_batizado', rotulo: SITUACAO_BATISMO_CURTO.nao_batizado },
                    ]}
                    onEscolher={setBatismo}
                  />
                </div>
              )}
              {cfg.autocadastroPerguntarComoConheceu && (
                <div className="campo"><span>Como você conheceu a {cfg.nomeIgreja}?</span>
                  <Escolha
                    valor={comoConheceu}
                    opcoes={cfg.comoConheceuOpcoes.map((o) => ({ v: o, rotulo: o }))}
                    onEscolher={setComoConheceu}
                  />
                </div>
              )}
              {cfg.autocadastroPerguntarConexao && (
                <div className="campo"><span>Quer fazer parte de uma {cfg.termoGrupo || 'Conexão'}?</span>
                  <Escolha
                    valor={desejaConexao}
                    opcoes={OPCOES_DESEJA_CONEXAO.map((o) => ({ v: o, rotulo: o }))}
                    onEscolher={setDesejaConexao}
                  />
                </div>
              )}
            </div>
          )}

          {/* ---------- Contato e oração ---------- */}
          {temContato && (
            <div className="ac-secao">
              <div className="ac-secao-titulo">💬 Contato e oração</div>
              {cfg.autocadastroPerguntarContato && (
                <>
                  <div className="campo"><span>Gostaria que alguém da nossa família entrasse em contato com você?</span>
                    <Escolha valor={desejaContato} opcoes={SIM_NAO} onEscolher={setDesejaContato} />
                  </div>
                  {desejaContato === 'sim' && (
                    <div className="campo"><span>Qual o melhor horário para entrarmos em contato?</span>
                      <Escolha
                        valor={horario}
                        opcoes={(Object.keys(HORARIO_CONTATO_LABEL) as HorarioContato[]).map((h) => ({ v: h, rotulo: HORARIO_CONTATO_LABEL[h] }))}
                        onEscolher={setHorario}
                      />
                    </div>
                  )}
                </>
              )}
              {cfg.autocadastroPerguntarOracao && (
                <label className="campo"><span>Pelo que podemos orar por você hoje? <em className="campo-dica">(opcional)</em></span>
                  <textarea rows={3} value={pedidoOracao} onChange={(e) => setPedidoOracao(e.target.value)} placeholder="Compartilhe um pedido de oração, se quiser." />
                </label>
              )}
            </div>
          )}

          {/* ---------- Consentimento ---------- */}
          <div className="ac-secao">
            <div className="ac-lgpd">
              🔒 Seus dados serão usados apenas para que nossa equipe entre em contato e acompanhe você nessa jornada
              de acolhimento. Não compartilhamos suas informações com terceiros.
            </div>
            <label className="check">
              <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
              Autorizo o uso dos meus dados para esse acompanhamento. *
            </label>
          </div>

          <button className="btn ac-btn-enviar" type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar ✨'}
          </button>
          <p className="ac-fim">Obrigado por preencher — estamos aqui para te servir em amor! 💙</p>
        </form>
      </div>
    </div>
  )
}
