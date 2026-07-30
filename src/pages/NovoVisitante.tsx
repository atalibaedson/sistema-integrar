import { useState } from 'react'
import { buscarDuplicado, cadastrarVisitante, sugerirConexao } from '../actions'
import { useAppState } from '../store'
import { ocorrenciasRecentes } from '../cultos'
import { SITUACAO_CIVIL_LABEL, STATUS_LABEL, type SituacaoCivil } from '../types'
import { soAcolhedor, useUsuarioAtualId, usuarioAtual } from '../acesso'
import { navegar } from '../router'

export default function NovoVisitante() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  // Culto e data juntos: valor "data|culto" (ocorrência dos últimos 7 dias)
  // ou "|culto" (outra data — abre o campo de data manual)
  const [cultoSel, setCultoSel] = useState('')
  const [dataManual, setDataManual] = useState('')
  const [comoConheceu, setComoConheceu] = useState('')
  const [situacao, setSituacao] = useState<SituacaoCivil | ''>('')
  const [bairro, setBairro] = useState('')
  const [menor, setMenor] = useState(false)
  const [outraCidade, setOutraCidade] = useState(false)
  const [obs, setObs] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [avisos, setAvisos] = useState<string[]>([])
  const [sucesso, setSucesso] = useState<string | null>(null) // nome do último cadastrado (acolhedor)

  function limparForm() {
    setNome(''); setWhatsapp(''); setEmail(''); setCultoSel(''); setDataManual('')
    setComoConheceu(''); setSituacao(''); setBairro(''); setMenor(false)
    setOutraCidade(false); setObs(''); setConsentimento(false); setAvisos([])
  }

  const conexaoSugerida = sugerirConexao(s, bairro, situacao || undefined, menor)
  // Alerta de duplicado em tempo real, enquanto digita (WhatsApp ou e-mail)
  const duplicado = buscarDuplicado(s, whatsapp, email)

  const ocorrencias = ocorrenciasRecentes(s.config.cultosDef)
  const [dataVisitaSel, cultoNome] = [
    cultoSel.slice(0, cultoSel.indexOf('|')),
    cultoSel.slice(cultoSel.indexOf('|') + 1),
  ]

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !whatsapp.trim()) {
      setAvisos(['Nome e WhatsApp são obrigatórios.'])
      return
    }
    if (!consentimento) {
      setAvisos(['Confirme que a pessoa autorizou o uso dos dados antes de cadastrar.'])
      return
    }
    const r = cadastrarVisitante({
      nome, whatsapp, email: email || undefined,
      origem: 'culto',
      cultoPrimeiraVisita: cultoNome || undefined,
      dataPrimeiraVisita: dataVisitaSel || dataManual || undefined,
      comoConheceu: comoConheceu || undefined,
      situacaoCivil: situacao || undefined,
      bairro: bairro || undefined,
      flagMenorIdade: menor,
      flagOutraCidade: outraCidade,
      observacoes: obs || undefined,
      consentimentoLgpd: consentimento,
    })
    // Acolhedor não abre a ficha (não tem acesso): mostra confirmação e limpa o
    // formulário para o próximo cadastro. Os demais vão direto para a ficha.
    if (soAcolhedor(eu)) {
      const nomeCad = r.visitante.nome
      limparForm()
      setSucesso(nomeCad)
      return
    }
    navegar(`/visitante/${r.visitante.id}`)
  }

  if (sucesso) {
    return (
      <div>
        <h1 className="titulo-pagina">Novo visitante</h1>
        <div className="card" style={{ maxWidth: 640, textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
          <h3 style={{ fontSize: 18 }}>{sucesso} foi cadastrado(a)!</h3>
          <p style={{ color: 'var(--text-2)', maxWidth: 380, margin: '6px auto 20px' }}>
            Prontinho — a equipe de consolidação assume daqui e faz o primeiro contato. Obrigado por acolher! 🙏
          </p>
          <button className="btn" onClick={() => setSucesso(null)}>Cadastrar outro visitante</button>
        </div>
      </div>
    )
  }


  return (
    <div>
      <h1 className="titulo-pagina">Novo visitante</h1>
      <p className="subtitulo">Cadastro manual (abordagem no culto). A triagem da Fase 0 é aplicada automaticamente.</p>

      {avisos.map((a, i) => (
        <div className="alerta alerta-warn" key={i}>⚠️ <div>{a}</div></div>
      ))}

      <form onSubmit={enviar} className="card" style={{ maxWidth: 640 }}>
        <div className="form-secao">
          <h4>👤 Contato</h4>
          <div className="linha-campos">
            <label className="campo"><span>Nome *</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </label>
            <label className="campo"><span>WhatsApp *</span>
              <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 90000-0000" />
            </label>
          </div>
          <div className="linha-campos">
            <label className="campo"><span>E-mail (opcional)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="campo"><span>Bairro / região</span>
              <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Usado para sugerir a Conexão" />
            </label>
          </div>

          {duplicado && (
            <div className="alerta alerta-warn">
              ⚠️ <div>
                <b>Já existe um cadastro com esse {duplicado.whatsapp.replace(/\D/g, '') === whatsapp.replace(/\D/g, '') ? 'WhatsApp' : 'e-mail'}:</b>{' '}
                {duplicado.nome} (status: {STATUS_LABEL[duplicado.status]}).{' '}
                <a href={`#/visitante/${duplicado.id}`} style={{ color: 'inherit', fontWeight: 700 }}>Abrir a ficha existente</a> em vez de cadastrar de novo.
              </div>
            </div>
          )}
        </div>

        <div className="form-secao">
          <h4>🙏 Sobre a visita</h4>
          <div className="linha-campos">
            <label className="campo"><span>Em qual culto visitou pela 1ª vez?</span>
              <select value={cultoSel} onChange={(e) => { setCultoSel(e.target.value); setDataManual('') }}>
                <option value="">— selecionar —</option>
                {ocorrencias.length > 0 && (
                  <optgroup label="Últimos 7 dias">
                    {ocorrencias.map((o) => (
                      <option key={`${o.data}|${o.culto}`} value={`${o.data}|${o.culto}`}>{o.rotulo}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Outra data (informar ao lado)">
                  {s.config.cultosDef.map((c) => <option key={`|${c.nome}`} value={`|${c.nome}`}>{c.nome}</option>)}
                </optgroup>
              </select>
            </label>
            {cultoSel !== '' && !dataVisitaSel && (
              <label className="campo"><span>Data da visita</span>
                <input type="date" value={dataManual} onChange={(e) => setDataManual(e.target.value)} />
              </label>
            )}
            <label className="campo"><span>Como conheceu a igreja?</span>
              <select value={comoConheceu} onChange={(e) => setComoConheceu(e.target.value)}>
                <option value="">— selecionar —</option>
                {s.config.comoConheceuOpcoes.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>
          <div className="linha-campos">
            <label className="campo"><span>Situação civil</span>
              <select value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoCivil | '')}>
                <option value="">— selecionar —</option>
                {Object.entries(SITUACAO_CIVIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className="campo"><span>Observações</span>
              <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} />
            </label>
          </div>
          {conexaoSugerida && (
            <div className="alerta alerta-info" style={{ marginTop: 4 }}>
              💡 <div>{s.config.termoGrupo} sugerida (proximidade + situação civil): <b>{conexaoSugerida.nome}</b> — {conexaoSugerida.regiao}, {conexaoSugerida.perfil}</div>
            </div>
          )}
        </div>

        <div className="form-secao">
          <h4>⚠️ Sinalizações</h4>
          <label className="check">
            <input type="checkbox" checked={menor} onChange={(e) => setMenor(e.target.checked)} />
            Menor de idade (contato será com o responsável)
          </label>
          <label className="check">
            <input type="checkbox" checked={outraCidade} onChange={(e) => setOutraCidade(e.target.checked)} />
            De outra cidade / visitante de passagem
          </label>
        </div>

        <div className="form-secao form-secao-ultima">
          <h4>🔒 Consentimento (LGPD)</h4>
          <label className="check">
            <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
            Expliquei que os dados são usados só para este acompanhamento, e a pessoa autorizou. *
          </label>
        </div>

        <button className="btn" type="submit" style={{ marginTop: 4 }}>Cadastrar visitante</button>
      </form>

      <div className="card" style={{ maxWidth: 640 }}>
        <p style={{ color: 'var(--text-2)', margin: 0, fontSize: 13.5 }}>
          📱 Quer que os visitantes se cadastrem sozinhos via QR code no culto?
          O código e o link para impressão ficam em <a href="#/config">Configurações → Autocadastro</a>.
        </p>
      </div>
    </div>
  )
}
