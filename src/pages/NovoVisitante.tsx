import { useState } from 'react'
import { buscarDuplicado, cadastrarVisitante, sugerirConexao } from '../actions'
import { useAppState } from '../store'
import { ocorrenciasRecentes } from '../cultos'
import {
  HORARIO_CONTATO_LABEL, OPCOES_DESEJA_CONEXAO, SITUACAO_BATISMO_CURTO, SITUACAO_CIVIL_LABEL,
  rotuloStatus, type HorarioContato, type SituacaoBatismo, type SituacaoCivil,
} from '../types'
import { Escolha, SIM_NAO } from '../campos'
import { soAcolhedor, useUsuarioAtualId, usuarioAtual } from '../acesso'
import { navegar } from '../router'

// Cadastro feito pela equipe (abordagem no culto). Segue o MESMO padrão do
// autocadastro — seções, pílulas de escolha e os mesmos campos — para que as
// duas portas de entrada gerem fichas comparáveis. O que é exclusivo daqui:
// o culto da 1ª visita, as sinalizações de triagem e as observações da equipe.
export default function NovoVisitante() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [situacao, setSituacao] = useState<SituacaoCivil | ''>('')
  const [endereco, setEndereco] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  // Culto e data juntos: valor "data|culto" (ocorrência dos últimos 7 dias)
  // ou "|culto" (outra data — abre o campo de data manual)
  const [cultoSel, setCultoSel] = useState('')
  const [dataManual, setDataManual] = useState('')
  const [primeiraVez, setPrimeiraVez] = useState('')
  const [membroOutra, setMembroOutra] = useState('')
  const [batismo, setBatismo] = useState('')
  const [comoConheceu, setComoConheceu] = useState('')
  const [desejaConexao, setDesejaConexao] = useState('')
  const [desejaContato, setDesejaContato] = useState('')
  const [horario, setHorario] = useState('')
  const [pedidoOracao, setPedidoOracao] = useState('')
  const [menor, setMenor] = useState(false)
  const [outraCidade, setOutraCidade] = useState(false)
  const [obs, setObs] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [avisos, setAvisos] = useState<string[]>([])
  const [sucesso, setSucesso] = useState<string | null>(null) // nome do último cadastrado (acolhedor)

  function limparForm() {
    setNome(''); setWhatsapp(''); setEmail(''); setDataNascimento(''); setSituacao('')
    setEndereco(''); setBairro(''); setCidade(''); setCultoSel(''); setDataManual('')
    setPrimeiraVez(''); setMembroOutra(''); setBatismo(''); setComoConheceu('')
    setDesejaConexao(''); setDesejaContato(''); setHorario(''); setPedidoOracao('')
    setMenor(false); setOutraCidade(false); setObs(''); setConsentimento(false); setAvisos([])
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
      dataNascimento: dataNascimento || undefined,
      endereco: endereco || undefined,
      bairro: bairro || undefined,
      cidade: cidade || undefined,
      primeiraVez: primeiraVez ? primeiraVez === 'sim' : undefined,
      membroOutraIgreja: membroOutra ? membroOutra === 'sim' : undefined,
      situacaoBatismo: (batismo || undefined) as SituacaoBatismo | undefined,
      desejaConexao: desejaConexao || undefined,
      desejaContato: desejaContato ? desejaContato === 'sim' : undefined,
      melhorHorarioContato: (horario || undefined) as HorarioContato | undefined,
      pedidoOracao: pedidoOracao || undefined,
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
        {/* ---------- Dados da pessoa ---------- */}
        <div className="ac-secao">
          <div className="ac-secao-titulo">👤 Dados da pessoa</div>
          <label className="campo"><span>Nome *</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
          </label>
          <div className="ac-grupo">
            <label className="campo"><span>WhatsApp *</span>
              <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 90000-0000" />
            </label>
            <label className="campo"><span>Data de nascimento</span>
              <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
            </label>
          </div>
          <div className="ac-grupo">
            <label className="campo"><span>E-mail <em className="campo-dica">(opcional)</em></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@exemplo.com" />
            </label>
            <label className="campo"><span>Estado civil</span>
              <select value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoCivil | '')}>
                <option value="">— selecionar —</option>
                {Object.entries(SITUACAO_CIVIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>

          {duplicado && (
            <div className="alerta alerta-warn">
              ⚠️ <div>
                <b>Já existe um cadastro com esse {duplicado.whatsapp.replace(/\D/g, '') === whatsapp.replace(/\D/g, '') ? 'WhatsApp' : 'e-mail'}:</b>{' '}
                {duplicado.nome} (status: {rotuloStatus(duplicado.status)}).{' '}
                <a href={`#/visitante/${duplicado.id}`} style={{ color: 'inherit', fontWeight: 700 }}>Abrir a ficha existente</a> em vez de cadastrar de novo.
              </div>
            </div>
          )}
        </div>

        {/* ---------- Onde mora ---------- */}
        <div className="ac-secao">
          <div className="ac-secao-titulo">📍 Onde mora</div>
          <label className="campo"><span>Endereço <em className="campo-dica">(opcional)</em></span>
            <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua e número" />
          </label>
          <div className="ac-grupo">
            <label className="campo"><span>Bairro</span>
              <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Usado para sugerir a Conexão" />
            </label>
            <label className="campo"><span>Cidade</span>
              <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </label>
          </div>
        </div>

        {/* ---------- Sobre a visita ---------- */}
        <div className="ac-secao">
          <div className="ac-secao-titulo">⛪ Sobre a visita</div>
          <div className="ac-grupo">
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
          </div>
          <div className="campo"><span>É a primeira vez na {s.config.nomeIgreja}?</span>
            <Escolha valor={primeiraVez} opcoes={SIM_NAO} onEscolher={setPrimeiraVez} />
          </div>
          <label className="campo"><span>Como conheceu a {s.config.nomeIgreja}?</span>
            <select value={comoConheceu} onChange={(e) => setComoConheceu(e.target.value)}>
              <option value="">— selecionar —</option>
              {s.config.comoConheceuOpcoes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <div className="campo"><span>Quer fazer parte de uma {s.config.termoGrupo || 'Conexão'}?</span>
            <Escolha
              valor={desejaConexao}
              opcoes={OPCOES_DESEJA_CONEXAO.map((o) => ({ v: o, rotulo: o }))}
              onEscolher={setDesejaConexao}
            />
          </div>
          {conexaoSugerida && (
            <div className="alerta alerta-info" style={{ marginTop: 4 }}>
              💡 <div>{s.config.termoGrupo} sugerida (proximidade + situação civil): <b>{conexaoSugerida.nome}</b> — {conexaoSugerida.regiao}, {conexaoSugerida.perfil}</div>
            </div>
          )}
        </div>

        {/* ---------- Caminhada de fé ---------- */}
        <div className="ac-secao">
          <div className="ac-secao-titulo">🙏 Caminhada de fé</div>
          <div className="campo"><span>É membro de outra igreja?</span>
            <Escolha valor={membroOutra} opcoes={SIM_NAO} onEscolher={setMembroOutra} />
          </div>
          <div className="campo">
            <span>Já é batizado(a)? <em className="campo-dica">(se souber — dá para registrar depois)</em></span>
            <Escolha
              valor={batismo}
              opcoes={[
                { v: 'ja_batizado', rotulo: SITUACAO_BATISMO_CURTO.ja_batizado },
                { v: 'nao_batizado', rotulo: SITUACAO_BATISMO_CURTO.nao_batizado },
              ]}
              onEscolher={setBatismo}
            />
          </div>
        </div>

        {/* ---------- Contato e oração ---------- */}
        <div className="ac-secao">
          <div className="ac-secao-titulo">💬 Contato e oração</div>
          <div className="campo"><span>Quer que alguém da equipe entre em contato?</span>
            <Escolha valor={desejaContato} opcoes={SIM_NAO} onEscolher={setDesejaContato} />
          </div>
          {desejaContato === 'sim' && (
            <div className="campo"><span>Qual o melhor horário?</span>
              <Escolha
                valor={horario}
                opcoes={(Object.keys(HORARIO_CONTATO_LABEL) as HorarioContato[]).map((h) => ({ v: h, rotulo: HORARIO_CONTATO_LABEL[h] }))}
                onEscolher={setHorario}
              />
            </div>
          )}
          <label className="campo"><span>Pedido de oração <em className="campo-dica">(opcional)</em></span>
            <textarea rows={2} value={pedidoOracao} onChange={(e) => setPedidoOracao(e.target.value)} placeholder="O que a pessoa pediu para orarmos." />
          </label>
        </div>

        {/* ---------- Sinalizações (só no cadastro da equipe) ---------- */}
        <div className="ac-secao">
          <div className="ac-secao-titulo">⚠️ Sinalizações</div>
          <label className="check">
            <input type="checkbox" checked={menor} onChange={(e) => setMenor(e.target.checked)} />
            Menor de idade (contato será com o responsável)
          </label>
          <label className="check">
            <input type="checkbox" checked={outraCidade} onChange={(e) => setOutraCidade(e.target.checked)} />
            De outra cidade / visitante de passagem
          </label>
          <label className="campo" style={{ marginTop: 12 }}><span>Observações da equipe <em className="campo-dica">(opcional)</em></span>
            <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Algo que ajude quem for fazer o contato." />
          </label>
        </div>

        {/* ---------- Consentimento ---------- */}
        <div className="ac-secao">
          <div className="ac-lgpd">
            🔒 Os dados são usados apenas para que a equipe entre em contato e acompanhe a pessoa
            nessa jornada de acolhimento. Não são compartilhados com terceiros.
          </div>
          <label className="check">
            <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
            Expliquei que os dados são usados só para este acompanhamento, e a pessoa autorizou. *
          </label>
        </div>

        <button className="btn ac-btn-enviar" type="submit">Cadastrar visitante</button>
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
