import { useState } from 'react'
import { cadastrarVisitante } from '../actions'
import { useAppState } from '../store'
import { ocorrenciasRecentes } from '../cultos'
import { SITUACAO_CIVIL_LABEL, type SituacaoCivil } from '../types'

// Formulário público do QR code — sem menu, linguagem acolhedora
export default function Autocadastro() {
  const s = useAppState()
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [culto, setCulto] = useState('') // "data|culto" (últimos 7 dias) ou "|culto"
  const [comoConheceu, setComoConheceu] = useState('')
  const [situacao, setSituacao] = useState<SituacaoCivil | ''>('')
  const [bairro, setBairro] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

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
    const sep = culto.indexOf('|')
    const dataVisita = sep >= 0 ? culto.slice(0, sep) : ''
    const nomeCulto = sep >= 0 ? culto.slice(sep + 1) : culto
    cadastrarVisitante({
      nome, whatsapp,
      origem: 'qr_code',
      cultoPrimeiraVisita: nomeCulto || undefined,
      dataPrimeiraVisita: dataVisita || undefined,
      comoConheceu: comoConheceu || undefined,
      situacaoCivil: situacao || undefined,
      bairro: bairro || undefined,
      flagMenorIdade: false,
      flagOutraCidade: false,
      consentimentoLgpd: consentimento,
    })
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="ac-tela">
        <div className="ac-cartao ac-cartao-ok">
          <div className="ac-check">🎉</div>
          <h1 className="ac-titulo-ok">{s.config.nomeIgreja}</h1>
          <p className="ac-texto-ok">{s.config.autocadastroMensagemFinal}</p>
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
          <p className="ac-boas-vindas">{s.config.autocadastroTitulo}</p>
          <p className="ac-sub">{s.config.autocadastroMensagem}</p>
        </div>

        {erro && <div className="alerta alerta-warn">⚠️ <div>{erro}</div></div>}

        <form onSubmit={enviar} className="ac-form">
          <div className="ac-grupo">
            <label className="campo"><span>Seu nome *</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como podemos te chamar?" autoFocus />
            </label>
            <label className="campo"><span>Seu WhatsApp *</span>
              <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 90000-0000" />
            </label>
          </div>

          <div className="ac-grupo">
            <label className="campo"><span>Em qual culto você nos visitou?</span>
              <select value={culto} onChange={(e) => setCulto(e.target.value)}>
                <option value="">— selecionar —</option>
                {(() => {
                  const ocorrencias = ocorrenciasRecentes(s.config.cultosDef)
                  return (
                    <>
                      {ocorrencias.length > 0 && (
                        <optgroup label="Últimos dias">
                          {ocorrencias.map((o) => (
                            <option key={`${o.data}|${o.culto}`} value={`${o.data}|${o.culto}`}>{o.rotulo}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Faz mais tempo">
                        {s.config.cultosDef.map((c) => <option key={`|${c.nome}`} value={`|${c.nome}`}>{c.nome}</option>)}
                      </optgroup>
                    </>
                  )
                })()}
              </select>
            </label>
            <label className="campo"><span>Como você conheceu a {s.config.nomeIgreja}?</span>
              <select value={comoConheceu} onChange={(e) => setComoConheceu(e.target.value)}>
                <option value="">— selecionar —</option>
                {s.config.comoConheceuOpcoes.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>

          {(s.config.autocadastroMostrarSituacaoCivil || s.config.autocadastroMostrarBairro) && (
            <div className="ac-grupo">
              {s.config.autocadastroMostrarSituacaoCivil && (
                <label className="campo"><span>Situação civil (opcional)</span>
                  <select value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoCivil | '')}>
                    <option value="">— selecionar —</option>
                    {Object.entries(SITUACAO_CIVIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
              )}
              {s.config.autocadastroMostrarBairro && (
                <label className="campo"><span>Bairro (opcional)</span>
                  <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Seu bairro" />
                </label>
              )}
            </div>
          )}

          <div className="ac-lgpd">
            🔒 Seus dados serão usados apenas para que nossa equipe entre em contato e acompanhe você nessa jornada
            de acolhimento. Não compartilhamos suas informações com terceiros.
          </div>
          <label className="check">
            <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
            Autorizo o uso dos meus dados para esse acompanhamento. *
          </label>

          <button className="btn ac-btn-enviar" type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar ✨'}
          </button>
        </form>
      </div>
    </div>
  )
}
