import { useState } from 'react'
import { getEstado, interacoesDe, templatesPorEtapa, useAppState, usuarioPorId } from '../../store'
import {
  estiloStatus, GRAU_LABEL, rotuloStatus, rotuloTipoInteracao, TIPO_INTERACAO_LABEL,
  type EtapaFluxo, type GrauAbertura, type Status, type TipoInteracao, type Visitante,
} from '../../types'
import {
  aplicarTemplate, desfazerUltimaMudanca, encaminharParaBatismo, linkWhatsApp, mudarStatus,
  proximoTipoContato, registrarBatismoRealizado, registrarInteracao, type Classificacao,
} from '../../actions'
import { IcoCheck, IcoDesfazer, IcoEditar, IcoWhats } from '../../icones'
import { BotaoVirarMembro, CampoInicioConexao, fmtDia, SeletorData } from './comum'

const PASSO_DO_STATUS: Record<Status, number> = {
  novo: 2, em_contato: 2, aguardando_resposta: 2, em_espera: 2, recusou: 2, encerrado: 2,
  encaminhado_lider: 3, visitou: 4, transferido: 5, batismo: 6, integrado: 7,
}

export default function Roteiro({ v }: { v: Visitante }) {
  const passoAtual = PASSO_DO_STATUS[v.status]
  const concluido = v.status === 'integrado'
  const dataDe = (para: Status) => v.historicoStatus.find((h) => h.para === para)?.data

  const passos = [
    { n: 1, label: 'Cadastro', titulo: 'Cadastro realizado', quandoFeito: v.dataCadastro },
    { n: 2, label: '1ª semana', titulo: 'Primeira semana de contatos', quandoFeito: dataDe('encaminhado_lider') },
    { n: 3, label: 'Entrega', titulo: 'Entrega ao líder do grupo', quandoFeito: dataDe('visitou') },
    { n: 4, label: 'Visita', titulo: 'Visita ao grupo', quandoFeito: dataDe('visitou') },
    { n: 5, label: 'Líder assume', titulo: 'Líder assume o acompanhamento', quandoFeito: dataDe('transferido') },
    {
      n: 6,
      label: v.situacaoBatismo === 'ja_batizado' ? 'Batismo ✓' : 'Batismo',
      titulo: v.situacaoBatismo === 'ja_batizado' ? 'Batismo · dispensado' : 'Batismo',
      quandoFeito: v.dataBatismo ?? dataDe('batismo'),
    },
    { n: 7, label: 'Membro', titulo: 'Membro 🎉', quandoFeito: v.dataMembresia ?? dataDe('integrado') },
  ]

  const feito = (n: number) => concluido || n < passoAtual
  const atual = (n: number) => !concluido && n === passoAtual
  const passoAtualObj = passos[passoAtual - 1]

  const podeVoltar = (concluido || passoAtual > 2) && v.historicoStatus.length > 1
  const statusAnterior = v.historicoStatus[v.historicoStatus.length - 2]?.para

  return (
    <div className="card jornada-card">
      {/* Cabeçalho */}
      <div className="jornada-cab">
        <h3>Jornada de integração</h3>
        {concluido && <span className="badge" style={estiloStatus('integrado')}>Concluída 🎉</span>}
      </div>

      {/* Aviso de data de membresia faltando */}
      {concluido && !v.dataMembresia && (
        <div className="alerta alerta-warn" style={{ marginBottom: 14 }}>
          ⚠️ <div>Falta a <b>data em que {v.nome.split(' ')[0]} virou membro</b> — preencha em Dados abaixo.</div>
        </div>
      )}

      {/* Stepper horizontal */}
      <div className="stepper" style={{ padding: '8px 0 4px' }}>
        {passos.map((p, i) => (
          <div key={p.n} className={`step ${feito(p.n) ? 'feito' : ''} ${atual(p.n) ? 'atual' : ''}`}>
            <div className="step-bola">
              {feito(p.n) ? <IcoCheck size={13} /> : p.n}
            </div>
            <div className="step-rotulo">{p.label}</div>
            {i < passos.length - 1 && <div className="step-linha" />}
          </div>
        ))}
      </div>

      {/* Card da ação atual */}
      {!concluido && passoAtualObj && (
        <div className="jornada-acao-card">
          <div className="jornada-acao-etapa">Etapa {passoAtual} de {passos.length}</div>
          <h4 className="jornada-acao-titulo">{passoAtualObj.titulo}</h4>
          <PassoAtual v={v} passo={passoAtual} />
        </div>
      )}

      {/* Histórico de conclusão dos passos */}
      {passos.some((p) => feito(p.n) && p.quandoFeito) && (
        <div className="jornada-historico">
          {passos.filter((p) => feito(p.n) && p.quandoFeito).map((p) => (
            <div key={p.n} className="jornada-hist-item">
              <IcoCheck size={11} style={{ color: 'var(--ok)', flexShrink: 0 }} />
              <span>{p.titulo}</span>
              <span className="jornada-hist-data">{fmtDia(p.quandoFeito!)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Voltar etapa */}
      {podeVoltar && statusAnterior && (
        <button
          className="rot-voltar"
          onClick={() => {
            if (confirm(`Voltar ${v.nome.split(' ')[0]} para a etapa anterior ("${rotuloStatus(statusAnterior)}")?`)) {
              desfazerUltimaMudanca(v.id)
            }
          }}
        >
          <IcoDesfazer size={13} /> Voltar para a etapa anterior ({rotuloStatus(statusAnterior)})
        </button>
      )}
    </div>
  )
}

/* ================= Conteúdo do passo atual ================= */
function PassoAtual({ v, passo }: { v: Visitante; passo: number }) {
  const s = useAppState()
  const [registrando, setRegistrando] = useState(false)
  const [dataBatismo, setDataBatismo] = useState('')
  const [msgIdx, setMsgIdx] = useState(0)
  const [avisoIdx, setAvisoIdx] = useState(0)
  const [aguardando, setAguardando] = useState(false)
  const [motivoEspera, setMotivoEspera] = useState('')
  const [parou, setParou] = useState(false)
  const [motivoParou, setMotivoParou] = useState('')
  const lider = usuarioPorId(s, v.liderConexaoId)
  const primeiroNome = v.nome.split(' ')[0]
  const ints = interacoesDe(s, v.id)
  const fez = (t: TipoInteracao) => ints.some((i) => i.tipo === t)

  // Passo 2 — semana de contatos
  if (passo === 2) {
    const tipoSugerido = proximoTipoContato(s, v)
    const etapa: EtapaFluxo = tipoSugerido === 'aproximacao' ? 'aproximacao' : tipoSugerido === 'conexao' ? 'conexao' : tipoSugerido === 'celebracao' ? 'celebracao' : 'conexao'
    const candidatos = templatesPorEtapa(s, etapa)
    const idxAtual = Math.min(msgIdx, Math.max(candidatos.length - 1, 0))
    const template = candidatos[idxAtual]
    const texto = template ? aplicarTemplate(template.texto, v, s) : undefined

    if (v.status === 'encerrado') {
      return <div className="rot-sub">Cadastro encerrado na triagem — sem ações. Reative pela aba Acompanhamento se for engano.</div>
    }

    return (
      <div>
        {/* Progresso dos 3 contatos da semana */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className={`chip-num ${fez('aproximacao') ? 'feito' : ''}`}><span className="n">{fez('aproximacao') ? '✓' : '1'}</span>Seg · Aproximação</span>
          <span className={`chip-num ${fez('conexao') ? 'feito' : ''}`}><span className="n">{fez('conexao') ? '✓' : '2'}</span>Qua · Convite ao grupo</span>
          <span className={`chip-num ${fez('celebracao') ? 'feito' : ''}`}><span className="n">{fez('celebracao') ? '✓' : '3'}</span>Sáb · Celebração</span>
        </div>

        {v.status === 'em_espera' && (
          <div className="alerta alerta-warn" style={{ marginBottom: 10 }}>
            ⏸️ <div>Em espera ({s.config.prazoEsperaDias} dias sem resposta). Envie só informativos; ao responder, registre o contato.</div>
          </div>
        )}
        {v.status === 'recusou' && (
          <div className="alerta alerta-warn" style={{ marginBottom: 10 }}>
            ✋ <div>Pediu para não ser contatada. Se ela retornar, registre o contato.</div>
          </div>
        )}

        {!registrando && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {candidatos.length > 1 && v.status !== 'recusou' && (
              <select value={idxAtual} onChange={(e) => setMsgIdx(Number(e.target.value))} style={{ fontSize: 12.5, padding: '5px 8px', width: 'auto' }}>
                {candidatos.map((t, i) => <option key={t.id} value={i}>{t.titulo}</option>)}
              </select>
            )}
            {texto && v.status !== 'recusou' && <div className="msg-pronta">"{texto}"</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {texto && v.status !== 'recusou' && (
                <a className="btn btn-whats" href={linkWhatsApp(v.whatsapp, texto)} target="_blank" rel="noreferrer">
                  <IcoWhats size={15} /> 1. Enviar mensagem
                </a>
              )}
              <button className="btn" onClick={() => setRegistrando(true)}>
                <IcoEditar size={14} /> {v.status === 'recusou' ? 'Ela respondeu — registrar' : '2. Registrar o contato'}
              </button>
            </div>
          </div>
        )}
        {registrando && <RegistroGuiado v={v} onFechar={() => setRegistrando(false)} />}
      </div>
    )
  }

  // Passo 3 — entrega ao líder
  if (passo === 3) {
    const candidatosAviso = templatesPorEtapa(s, 'aviso_lider')
    const idxAviso = Math.min(avisoIdx, Math.max(candidatosAviso.length - 1, 0))
    const avisoLider = candidatosAviso[idxAviso]
    return (
      <div>
        <p className="rot-sub" style={{ marginBottom: 12 }}>
          {primeiroNome} aceitou o convite! Agora o líder {lider ? <b>{lider.nome}</b> : 'do grupo'} fala com ela <b>antes</b> da visita, para ela chegar esperada.
        </p>
        {candidatosAviso.length > 1 && (
          <select value={idxAviso} onChange={(e) => setAvisoIdx(Number(e.target.value))} style={{ marginBottom: 8, fontSize: 12.5, padding: '5px 8px', width: 'auto' }}>
            {candidatosAviso.map((t, i) => <option key={t.id} value={i}>{t.titulo}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {lider && (
            <a
              className="btn btn-whats"
              href={linkWhatsApp(lider.whatsapp, (avisoLider ? aplicarTemplate(avisoLider.texto, v, s) : `Encaminhando o contato de ${v.nome}.`) + ` WhatsApp: ${v.whatsapp}`)}
              target="_blank" rel="noreferrer"
            ><IcoWhats size={15} /> 1. Passar contato ao líder</a>
          )}
          <button className="btn" onClick={() => mudarStatus(v.id, 'visitou', 'Compareceu ao grupo')}>
            <IcoCheck size={14} /> 2. {primeiroNome} visitou o grupo
          </button>
        </div>
      </div>
    )
  }

  // Passo 4 — confirmação do líder
  if (passo === 4) {
    return (
      <div>
        <p className="rot-sub" style={{ marginBottom: 12 }}>
          {primeiroNome} já visitou o grupo ✔ — o líder confirma que assumiu o acompanhamento, ou sinaliza que ainda está aguardando.
        </p>
        {!aguardando && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => mudarStatus(v.id, 'transferido', 'Líder confirmou que assumiu o acompanhamento')}>
              <IcoCheck size={14} /> O líder confirmou que assumiu
            </button>
            <button className="btn btn-sec" onClick={() => setAguardando(true)}>
              ⏸️ Ainda não assumiu — aguardando
            </button>
          </div>
        )}
        {aguardando && (
          <div>
            <label className="campo" style={{ marginBottom: 8 }}>
              <span>Por que ainda está aguardando? *</span>
              <textarea rows={2} value={motivoEspera} onChange={(e) => setMotivoEspera(e.target.value)}
                placeholder="Ex.: visitou mas foi convidada para outras conexões, não retornou e não respondeu às mensagens."
                autoFocus />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" disabled={!motivoEspera.trim()}
                onClick={() => mudarStatus(v.id, 'em_espera', `Aguardando (líder): ${motivoEspera.trim()}`)}>
                <IcoCheck size={14} /> Marcar como aguardando
              </button>
              <button className="btn btn-sec" onClick={() => { setAguardando(false); setMotivoEspera('') }}>Cancelar</button>
            </div>
            <p className="rot-sub" style={{ marginTop: 8 }}>
              A pessoa fica <b>Em espera</b> e volta para o acompanhamento leve do time, com esse motivo salvo no histórico.
            </p>
          </div>
        )}
      </div>
    )
  }

  // Passo 5 — acompanhamento pelo líder
  if (passo === 5) {
    const jaBatizado = v.situacaoBatismo === 'ja_batizado' || v.situacaoBatismo === 'batizado_aqui'
    const receberComoMembro = <BotaoVirarMembro v={v} primaria={jaBatizado} />
    const encaminharBatismo = (
      <button className={jaBatizado ? 'btn btn-sec' : 'btn'} onClick={() => encaminharParaBatismo(v.id)}>
        💧 Encaminhar {primeiroNome} para o batismo
      </button>
    )

    return (
      <div>
        <p className="rot-sub" style={{ marginBottom: 12 }}>
          O líder cuida de {primeiroNome}; a consolidação fica de apoio.{' '}
          {jaBatizado
            ? <>Como {primeiroNome} <b>já é batizado(a)</b>, o próximo marco é ser recebido(a) como membro.</>
            : v.situacaoBatismo === 'nao_batizado'
              ? <>{primeiroNome} <b>ainda não é batizado(a)</b> — o próximo marco costuma ser o batismo.</>
              : <>Ainda <b>não sabemos</b> se {primeiroNome} é batizado(a). Vale perguntar: é isso que define o próximo passo.</>}
        </p>
        <div style={{ marginBottom: 12 }}>
          <CampoInicioConexao v={v} />
        </div>
        {jaBatizado ? receberComoMembro : encaminharBatismo}
        <div className="rot-ou">ou</div>
        {jaBatizado ? encaminharBatismo : receberComoMembro}
        <div className="rot-ou">ou</div>
        {!parou ? (
          <button className="btn btn-sec" onClick={() => setParou(true)}>
            <IcoDesfazer size={14} /> {primeiroNome} parou de frequentar
          </button>
        ) : (
          <div>
            <label className="campo" style={{ marginBottom: 8 }}>
              <span>O que aconteceu? <em className="campo-dica">(opcional)</em></span>
              <textarea rows={2} value={motivoParou} onChange={(e) => setMotivoParou(e.target.value)}
                placeholder="Ex.: deixou de aparecer nos encontros e não respondeu aos contatos do líder."
                autoFocus />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn"
                onClick={() => mudarStatus(v.id, 'em_contato', motivoParou.trim() ? `Parou de frequentar: ${motivoParou.trim()}` : 'Parou de frequentar — o time retoma o contato')}>
                <IcoCheck size={14} /> Voltar ao time para retomar o contato
              </button>
              <button className="btn btn-sec" onClick={() => { setParou(false); setMotivoParou('') }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Passo 6 — batismo
  if (passo === 6) {
    const batizado = v.situacaoBatismo === 'batizado_aqui' || v.situacaoBatismo === 'ja_batizado'
    return (
      <div>
        {!batizado ? (
          <>
            <p className="rot-sub" style={{ marginBottom: 12 }}>
              {primeiroNome} está encaminhado(a) para o batismo. Quando acontecer, registre a data aqui.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
              <SeletorData datas={s.config.datasBatismo} valor={dataBatismo} onMudar={setDataBatismo} rotulo="Data do batismo" />
              <button className="btn" disabled={!dataBatismo} onClick={() => registrarBatismoRealizado(v.id, dataBatismo)}>
                💧 Batizado(a)!
              </button>
            </div>
            <div className="rot-ou">ou</div>
          </>
        ) : (
          <p className="rot-sub" style={{ marginBottom: 12 }}>
            ✅ Batismo registrado{v.dataBatismo ? ` em ${fmtDia(v.dataBatismo)}` : ''}. Falta receber {primeiroNome} como membro.
          </p>
        )}
        <BotaoVirarMembro v={v} primaria={batizado} />
        <div className="rot-ou">ou</div>
        <button className="btn btn-sec"
          onClick={() => mudarStatus(v.id, 'transferido', batizado ? 'Membresia adiada — segue com o líder' : 'Batismo adiado — segue com o líder')}>
          <IcoDesfazer size={14} />{' '}
          {batizado ? 'Membresia vai demorar — volta ao acompanhamento do líder' : 'Adiou o batismo — volta ao acompanhamento do líder'}
        </button>
      </div>
    )
  }

  return null
}

/* ================= Assistente de registro de contato ================= */
function RegistroGuiado({ v, onFechar }: { v: Visitante; onFechar: () => void }) {
  const s = useAppState()
  const [classif, setClassif] = useState<Classificacao | null>(null)
  const [retorno, setRetorno] = useState('')
  const [grau, setGrau] = useState<GrauAbertura>('medio')
  const [passos, setPassos] = useState('')
  const [encam, setEncam] = useState('')
  const [tipo, setTipo] = useState<TipoInteracao>(proximoTipoContato(s, v))
  const [autor, setAutor] = useState<'consolidador' | 'lider'>('consolidador')
  const [resultado, setResultado] = useState('')
  const primeiroNome = v.nome.split(' ')[0]

  function salvar(cl: Classificacao) {
    const antes = v.status
    registrarInteracao({
      visitanteId: v.id, tipo, autorPapel: autor,
      respondeu: cl !== 'silencio',
      grauAbertura: cl === 'silencio' ? 'sem_resposta' : grau,
      retornoResumo: retorno, proximosPassos: passos, encaminhamentos: encam,
      classificacao: cl,
    })
    const depois = getEstado().visitantes.find((x) => x.id === v.id)!.status
    setResultado(
      antes !== depois
        ? `Registrado! ${primeiroNome} avançou: ${rotuloStatus(antes)} → ${rotuloStatus(depois)}.`
        : cl === 'cuidado'
          ? 'Registrado. Sinal de cuidado ativado — acione a liderança.'
          : 'Contato registrado no histórico.',
    )
  }

  if (resultado) {
    return (
      <div className="registro-ok">
        <IcoCheck size={18} /> <span style={{ flex: 1 }}>{resultado}</span>
        <button className="btn btn-sec btn-mini" onClick={onFechar}>Fechar</button>
      </div>
    )
  }

  if (!classif) {
    return (
      <div>
        <p className="pergunta">Como {primeiroNome} respondeu?</p>
        <div className="opcoes-grandes">
          <button className="opcao-grande" onClick={() => setClassif('pronto')}>
            <span className="op-emoji">✅</span>
            <span><span className="op-titulo">Quer visitar o grupo!</span>
            <div className="op-desc">Vai direto para o líder, que fala com ela antes da visita</div></span>
          </button>
          <button className="opcao-grande" onClick={() => setClassif('respondeu')}>
            <span className="op-emoji">💬</span>
            <span><span className="op-titulo">Respondeu, a conversa continua</span>
            <div className="op-desc">Segue no fluxo da semana normalmente</div></span>
          </button>
          <button className="opcao-grande" onClick={() => salvar('silencio')}>
            <span className="op-emoji">🔇</span>
            <span><span className="op-titulo">Não respondeu</span>
            <div className="op-desc">Registra a tentativa; tente de novo no próximo dia do fluxo</div></span>
          </button>
          <button className="opcao-grande" onClick={() => setClassif('recusa')}>
            <span className="op-emoji">🚫</span>
            <span><span className="op-titulo">Pediu para parar</span>
            <div className="op-desc">Encerra os contatos com gentileza — a porta segue aberta</div></span>
          </button>
          <button className="opcao-grande" onClick={() => setClassif('cuidado')}>
            <span className="op-emoji">🚨</span>
            <span><span className="op-titulo">Situação de cuidado/crise</span>
            <div className="op-desc">Sinaliza a liderança sem interromper o registro</div></span>
          </button>
        </div>
        <button className="btn btn-sec btn-mini" onClick={onFechar}>Cancelar</button>
      </div>
    )
  }

  return (
    <div>
      <p className="pergunta">
        {classif === 'recusa' ? 'Quer anotar algo sobre a recusa? (opcional)' : `O que ${primeiroNome} disse?`}
      </p>
      <label className="campo">
        <textarea value={retorno} onChange={(e) => setRetorno(e.target.value)} placeholder="Resumo da conversa…" autoFocus />
      </label>
      {classif !== 'recusa' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>Abertura:</span>
          {(['alto', 'medio', 'baixo'] as GrauAbertura[]).map((g) => (
            <button key={g} className={`chip ${grau === g ? 'sel' : ''}`} onClick={() => setGrau(g)}>{GRAU_LABEL[g]}</button>
          ))}
        </div>
      )}
      <label className="campo">
        <span>Próximo passo combinado (opcional)</span>
        <input type="text" value={passos} onChange={(e) => setPassos(e.target.value)} placeholder="ex.: vai pensar e responde sábado" />
      </label>
      <details style={{ marginBottom: 12 }}>
        <summary>Mais campos (encaminhamentos, tipo, quem fez)</summary>
        <div className="linha-campos" style={{ marginTop: 10 }}>
          <label className="campo"><span>Encaminhamentos realizados</span>
            <input type="text" value={encam} onChange={(e) => setEncam(e.target.value)} />
          </label>
          <label className="campo"><span>Tipo de contato</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoInteracao)}>
              {(Object.keys(TIPO_INTERACAO_LABEL) as TipoInteracao[]).map((k) => <option key={k} value={k}>{rotuloTipoInteracao(k)}</option>)}
            </select>
          </label>
        </div>
        <label className="campo"><span>Quem fez o contato</span>
          <select value={autor} onChange={(e) => setAutor(e.target.value as 'consolidador' | 'lider')}>
            <option value="consolidador">Integrador(a) pós-culto</option>
            <option value="lider">Líder do grupo</option>
          </select>
        </label>
      </details>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => salvar(classif)}><IcoCheck size={14} /> Salvar registro</button>
        <button className="btn btn-sec" onClick={() => setClassif(null)}>← Voltar</button>
      </div>
    </div>
  )
}
