import { useEffect, useRef, useState } from 'react'
import { consolidadoresAtivos, getEstado, interacoesDe, templatesPorEtapa, useAppState, usuarioPorId } from '../store'
import {
  estiloStatus, GRAU_LABEL, ORIGEM_LABEL, PERFIL_LABEL, SITUACAO_CIVIL_LABEL,
  STATUS_COR, STATUS_LABEL, TIPO_INTERACAO_LABEL,
  type EtapaFluxo, type GrauAbertura, type PerfilAbordagem, type SituacaoCivil, type Status, type TipoInteracao, type Visitante,
} from '../types'
import {
  aplicarTemplate, atualizarVisitante, corrigirStatus, desfazerUltimaMudanca,
  excluirVisitante, linkWhatsApp, marcarIntegracao, mudarStatus, proximoTipoContato,
  registrarInteracao, resolverCuidado, sinalizarCuidado, type Classificacao,
} from '../actions'
import { transicoesDisponiveis } from '../machine'
import { fmtDataVisita } from '../cultos'
import { iniciais } from './Equipe'
import { podeVerCuidado, podeVerVisitante, useUsuarioAtualId, usuarioAtual } from '../acesso'
import { registrarAuditoria } from '../auditoria'
import { navegar } from '../router'
import { IcoAlerta, IcoCheck, IcoDesfazer, IcoEditar, IcoEnviar, IcoHistorico, IcoLixeira, IcoUsuario, IcoConfig, IcoWhats } from '../icones'

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

type AbaFicha = 'atividade' | 'dados' | 'acompanhamento'

export default function VisitanteDetalhe({ id }: { id: string }) {
  const s = useAppState()
  const v = s.visitantes.find((x) => x.id === id)
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const [aba, setAba] = useState<AbaFicha>('atividade')

  // Auditoria: acesso a ficha com cuidado/crise ativo é o mais sensível — registrado.
  // (Hooks vêm ANTES de qualquer return: a ficha pode sumir no meio do uso se o
  // visitante for excluído em outro computador e chegar pela sincronização.)
  const idsRegistrados = useRef(new Set<string>())
  useEffect(() => {
    if (v && v.flagCuidado && !idsRegistrados.current.has(v.id)) {
      idsRegistrados.current.add(v.id)
      registrarAuditoria('👁️ Acessou ficha com cuidado/crise ativo', {
        alvoTipo: 'visitante', alvoId: v.id, alvoNome: v.nome,
      })
    }
  }, [v?.id, v?.flagCuidado, v?.nome])

  if (!v) return <div className="vazio">Visitante não encontrado. <a href="#/visitantes">Voltar</a></div>

  // Trava de acesso por hierarquia (fase de teste)
  if (!podeVerVisitante(s, eu, v)) {
    return (
      <div className="vazio" style={{ maxWidth: 460, margin: '40px auto' }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <p style={{ marginTop: 8 }}>Você não tem acesso à ficha desta pessoa.</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Só quem acompanha o visitante (ou está acima na hierarquia) pode ver as conversas.</p>
        <a href="#/visitantes" style={{ color: 'var(--primary)' }}>← Voltar</a>
      </div>
    )
  }

  const verCuidado = podeVerCuidado(s, eu, v)
  const conexao = s.conexoes.find((c) => c.id === v.conexaoId)
  const responsavel = usuarioPorId(s, v.responsavelId)

  return (
    <div className="ficha-wrap">
      <a href="#/visitantes" style={{ color: 'var(--primary)', fontSize: 13 }}>← Visitantes</a>

      {/* ---- Herói: quem é a pessoa ---- */}
      <div className="card" style={{ marginTop: 8 }}>
        <div className="hero-top">
          <div className="avatar avatar-hero" style={{ background: STATUS_COR[v.status] }}>{iniciais(v.nome)}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 19, fontWeight: 700 }}>{v.nome}</span>
              <span className="badge" style={estiloStatus(v.status)}>{STATUS_LABEL[v.status]}</span>
              {v.flagCuidado && verCuidado && <span className="badge-flag">🚨 cuidado</span>}
              {v.flagMenorIdade && <span className="badge-flag">menor</span>}
            </div>
            <div className="pessoa-sub" style={{ marginTop: 3 }}>
              📱 {v.whatsapp} · 🏠 {conexao?.nome ?? 'sem grupo'} · 👤 {responsavel?.nome.split(' ')[0] ?? 'sem responsável'}
              {v.cultoPrimeiraVisita && (
                <> · ⛪ {v.cultoPrimeiraVisita}{v.dataPrimeiraVisita ? ` (${fmtDataVisita(v.dataPrimeiraVisita)})` : ''}</>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="btn btn-whats" href={linkWhatsApp(v.whatsapp)} target="_blank" rel="noreferrer">
              <IcoWhats size={15} /> WhatsApp
            </a>
            {verCuidado && (v.flagCuidado ? (
              <button className="btn btn-sec" onClick={() => resolverCuidado(v.id)}><IcoCheck size={15} /> Resolver</button>
            ) : (
              <button className="btn-icone perigo" style={{ width: 36, height: 36 }} title="Sinalizar cuidado/crise"
                onClick={() => sinalizarCuidado(v.id)}><IcoAlerta size={16} /></button>
            ))}
          </div>
        </div>
      </div>

      {v.flagCuidado && verCuidado && (
        <div className="alerta alerta-perigo">
          🚨 <div><b>Protocolo de cuidado:</b> saia do roteiro, acione a liderança/pastor, registre o encaminhamento.
          Nunca prometa nada em nome da igreja nem aja sozinho.</div>
        </div>
      )}
      {v.flagMenorIdade && (
        <div className="alerta alerta-warn">⚠️ <div>Menor de idade — todo contato deve ser feito com o <b>responsável</b>.</div></div>
      )}

      {/* ---- O roteiro: passo a passo da jornada, com as ações dentro do passo atual ---- */}
      <Roteiro v={v} />

      {/* ---- Abas: detalhes sem poluir o fluxo ---- */}
      <div className="abas">
        <button className={`aba ${aba === 'atividade' ? 'ativa' : ''}`} onClick={() => setAba('atividade')}>
          <IcoHistorico size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />Atividade
        </button>
        <button className={`aba ${aba === 'dados' ? 'ativa' : ''}`} onClick={() => setAba('dados')}>
          <IcoUsuario size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />Dados
        </button>
        <button className={`aba ${aba === 'acompanhamento' ? 'ativa' : ''}`} onClick={() => setAba('acompanhamento')}>
          <IcoConfig size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />Acompanhamento
        </button>
      </div>

      {aba === 'atividade' && <AbaAtividade v={v} />}
      {aba === 'dados' && <AbaDados v={v} />}
      {aba === 'acompanhamento' && <AbaAcompanhamento v={v} />}
    </div>
  )
}

/* ================= Roteiro da jornada ================= */

// Em qual passo (1-6) cada status se encontra
const PASSO_DO_STATUS: Record<Status, number> = {
  novo: 2, em_contato: 2, aguardando_resposta: 2, em_espera: 2, recusou: 2, encerrado: 2,
  encaminhado_lider: 3, visitou: 4, transferido: 5, integrado: 6,
}

function Roteiro({ v }: { v: Visitante }) {
  const s = useAppState()
  const passoAtual = PASSO_DO_STATUS[v.status]
  const concluido = v.status === 'integrado'

  // Data em que cada passo foi concluído (pelo histórico)
  const dataDe = (para: Status) => v.historicoStatus.find((h) => h.para === para)?.data

  const passos: { n: number; titulo: string; quandoFeito?: string; explicacao: string }[] = [
    { n: 1, titulo: 'Cadastro realizado', quandoFeito: v.dataCadastro, explicacao: '' },
    { n: 2, titulo: 'Primeira semana de contatos', quandoFeito: dataDe('encaminhado_lider'), explicacao: 'Mensagens de segunda, quarta e sábado até a pessoa aceitar o convite.' },
    { n: 3, titulo: 'Entrega ao líder do grupo', quandoFeito: dataDe('visitou'), explicacao: 'Acontece quando a pessoa aceita visitar o grupo — o líder fala com ela ANTES da visita.' },
    { n: 4, titulo: 'Visita ao grupo', quandoFeito: dataDe('visitou'), explicacao: 'A pessoa participa de um encontro do grupo, já esperada pelo líder.' },
    { n: 5, titulo: 'Líder assume o acompanhamento', quandoFeito: dataDe('transferido'), explicacao: 'Depois da visita, o líder confirma que assumiu. A consolidação fica de apoio.' },
    { n: 6, titulo: 'Integrado 🎉', quandoFeito: dataDe('integrado'), explicacao: 'Frequência firme + batismo ou recepção como membro concluem a jornada.' },
  ]

  // "Voltar etapa" = desfazer a última mudança de status. Só faz sentido depois
  // da 1ª semana (passo > 2) ou com a jornada concluída, e havendo o que desfazer.
  const podeVoltar = (concluido || passoAtual > 2) && v.historicoStatus.length > 1
  const statusAnterior = v.historicoStatus[v.historicoStatus.length - 2]?.para

  return (
    <div className="card">
      <div className="card-cab">
        <h3>Passo a passo da jornada</h3>
        {concluido && <span className="badge" style={estiloStatus('integrado')}>Jornada concluída</span>}
      </div>
      {passos.map((p) => {
        const feito = concluido || p.n < passoAtual
        const atual = !concluido && p.n === passoAtual
        return (
          <div className={`rot-passo ${feito ? 'feito' : ''} ${atual ? 'atual' : ''} ${!feito && !atual ? 'futuro' : ''}`} key={p.n}>
            <div className="rot-num">{feito ? <IcoCheck size={15} /> : p.n}</div>
            <div className="rot-corpo">
              <div className="rot-titulo">
                {p.titulo}
                {feito && p.quandoFeito && <span style={{ fontWeight: 500, color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>{fmtDia(p.quandoFeito)}</span>}
              </div>
              {!atual && !feito && <div className="rot-sub">{p.explicacao}</div>}
              {atual && <PassoAtual v={v} passo={p.n} />}
            </div>
          </div>
        )
      })}
      {podeVoltar && statusAnterior && (
        <button
          className="rot-voltar"
          onClick={() => {
            if (confirm(`Voltar ${v.nome.split(' ')[0]} para a etapa anterior ("${STATUS_LABEL[statusAnterior]}")?`)) {
              desfazerUltimaMudanca(v.id)
            }
          }}
        >
          <IcoDesfazer size={13} /> Voltar para a etapa anterior ({STATUS_LABEL[statusAnterior]})
        </button>
      )}
    </div>
  )
}

/* Conteúdo do passo em andamento — as ações moram AQUI */
function PassoAtual({ v, passo }: { v: Visitante; passo: number }) {
  const s = useAppState()
  const [registrando, setRegistrando] = useState(false)
  const [dataBatismo, setDataBatismo] = useState(new Date().toISOString().slice(0, 10))
  const [msgIdx, setMsgIdx] = useState(0)
  const [avisoIdx, setAvisoIdx] = useState(0)
  const [aguardando, setAguardando] = useState(false)   // líder: visitou mas ainda não assumiu
  const [motivoEspera, setMotivoEspera] = useState('')
  const [parou, setParou] = useState(false)             // pessoa parou de frequentar após transferida
  const [motivoParou, setMotivoParou] = useState('')
  const lider = usuarioPorId(s, v.liderConexaoId)
  const primeiroNome = v.nome.split(' ')[0]
  const ints = interacoesDe(s, v.id)
  const fez = (t: TipoInteracao) => ints.some((i) => i.tipo === t)

  // Passo 2 — semana de contatos (inclui pausas: em espera / recusou / encerrado)
  if (passo === 2) {
    const tipoSugerido = proximoTipoContato(s, v)
    const etapa: EtapaFluxo = tipoSugerido === 'aproximacao' ? 'aproximacao' : tipoSugerido === 'conexao' ? 'conexao' : tipoSugerido === 'celebracao' ? 'celebracao' : 'conexao'
    const candidatos = templatesPorEtapa(s, etapa)
    const idxAtual = Math.min(msgIdx, Math.max(candidatos.length - 1, 0))
    const template = candidatos[idxAtual]
    const texto = template ? aplicarTemplate(template.texto, v.nome) : undefined

    if (v.status === 'encerrado') {
      return <div className="rot-sub">Cadastro encerrado na triagem — sem ações. Reative pela aba Acompanhamento se for engano.</div>
    }

    return (
      <div className="rot-caixa">
        {/* Os 3 contatos da semana como sequência numerada */}
        <div style={{ marginBottom: 10 }}>
          <span className={`chip-num ${fez('aproximacao') ? 'feito' : ''}`}><span className="n">{fez('aproximacao') ? '✓' : '1'}</span>Seg · Aproximação</span>
          <span className={`chip-num ${fez('conexao') ? 'feito' : ''}`}><span className="n">{fez('conexao') ? '✓' : '2'}</span>Qua · Convite ao grupo</span>
          <span className={`chip-num ${fez('celebracao') ? 'feito' : ''}`}><span className="n">{fez('celebracao') ? '✓' : '3'}</span>Sáb · Celebração</span>
        </div>

        {v.status === 'em_espera' && (
          <p className="rot-sub" style={{ marginBottom: 10 }}>⏸️ Em espera ({s.config.prazoEsperaDias} dias sem resposta). Envie só informativos; ao responder, registre o contato que o fluxo reativa sozinho.</p>
        )}
        {v.status === 'recusou' && (
          <p className="rot-sub" style={{ marginBottom: 10 }}>✋ Pediu para não ser contatada. Se ela retornar, registre o contato que o fluxo reabre.</p>
        )}

        {!registrando && (
          <>
            {candidatos.length > 1 && v.status !== 'recusou' && (
              <select
                value={idxAtual} onChange={(e) => setMsgIdx(Number(e.target.value))}
                style={{ marginBottom: 6, fontSize: 12.5, padding: '5px 8px', width: 'auto' }}
              >
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
          </>
        )}
        {registrando && <RegistroGuiado v={v} onFechar={() => setRegistrando(false)} />}
      </div>
    )
  }

  // Passo 3 — entrega ao líder (contato pré-visita)
  if (passo === 3) {
    const candidatosAviso = templatesPorEtapa(s, 'aviso_lider')
    const idxAviso = Math.min(avisoIdx, Math.max(candidatosAviso.length - 1, 0))
    const avisoLider = candidatosAviso[idxAviso]
    return (
      <div className="rot-caixa">
        <p className="rot-sub" style={{ marginBottom: 10 }}>
          {primeiroNome} aceitou o convite! Agora o líder {lider ? <b>{lider.nome}</b> : 'do grupo'} fala com ela <b>antes</b> da visita, para ela chegar esperada.
        </p>
        {candidatosAviso.length > 1 && (
          <select
            value={idxAviso} onChange={(e) => setAvisoIdx(Number(e.target.value))}
            style={{ marginBottom: 8, fontSize: 12.5, padding: '5px 8px', width: 'auto' }}
          >
            {candidatosAviso.map((t, i) => <option key={t.id} value={i}>{t.titulo}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {lider && (
            <a
              className="btn btn-whats"
              href={linkWhatsApp(lider.whatsapp, (avisoLider ? aplicarTemplate(avisoLider.texto, v.nome) : `Encaminhando o contato de ${v.nome}.`) + ` WhatsApp: ${v.whatsapp}`)}
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

  // Passo 4 — visita feita; o líder confirma que assumiu OU sinaliza que ainda
  // não assumiu (pessoa visitou mas não engajou/não respondeu) com o motivo.
  if (passo === 4) {
    return (
      <div className="rot-caixa">
        <p className="rot-sub" style={{ marginBottom: 10 }}>
          {primeiroNome} já visitou o grupo ✔ — o líder confirma que assumiu o acompanhamento,
          ou sinaliza que ainda está aguardando.
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
              <textarea
                rows={2} value={motivoEspera} onChange={(e) => setMotivoEspera(e.target.value)}
                placeholder="Ex.: visitou mas foi convidada para outras conexões, não retornou e não respondeu às mensagens."
                autoFocus
              />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn" disabled={!motivoEspera.trim()}
                onClick={() => mudarStatus(v.id, 'em_espera', `Aguardando (líder): ${motivoEspera.trim()}`)}
              >
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

  // Passo 5 — acompanhamento até a integração (ou volta ao time se parou de frequentar)
  if (passo === 5) {
    return (
      <div className="rot-caixa">
        <p className="rot-sub" style={{ marginBottom: 10 }}>
          O líder cuida de {primeiroNome}; a consolidação fica de apoio. Quando houver batismo ou recepção como membro, conclua a jornada.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <label className="campo" style={{ marginBottom: 0, maxWidth: 210 }}>
            <span>Data do batismo / membresia</span>
            <input type="date" value={dataBatismo} onChange={(e) => setDataBatismo(e.target.value)} />
          </label>
          <button className="btn" onClick={() => marcarIntegracao(v.id, dataBatismo)}>🕊️ Concluir: integrado!</button>
        </div>

        <div className="rot-ou">ou</div>

        {!parou ? (
          <button className="btn btn-sec" onClick={() => setParou(true)}>
            <IcoDesfazer size={14} /> {primeiroNome} parou de frequentar
          </button>
        ) : (
          <div>
            <label className="campo" style={{ marginBottom: 8 }}>
              <span>O que aconteceu? <em className="campo-dica">(opcional — ajuda o time a retomar)</em></span>
              <textarea
                rows={2} value={motivoParou} onChange={(e) => setMotivoParou(e.target.value)}
                placeholder="Ex.: deixou de aparecer nos encontros e não respondeu aos contatos do líder."
                autoFocus
              />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={() => mudarStatus(
                  v.id, 'em_contato',
                  motivoParou.trim() ? `Parou de frequentar: ${motivoParou.trim()}` : 'Parou de frequentar — o time retoma o contato',
                )}
              >
                <IcoCheck size={14} /> Voltar ao time para retomar o contato
              </button>
              <button className="btn btn-sec" onClick={() => { setParou(false); setMotivoParou('') }}>Cancelar</button>
            </div>
            <p className="rot-sub" style={{ marginTop: 8 }}>
              A pessoa volta para <b>Em contato</b> e reaparece nas ações do time, que retoma a conversa para entender o que aconteceu.
            </p>
          </div>
        )}
      </div>
    )
  }

  return null
}

/* Assistente de registro: uma pergunta por vez, status muda sozinho */
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
        ? `Registrado! ${primeiroNome} avançou: ${STATUS_LABEL[antes]} → ${STATUS_LABEL[depois]}.`
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
              {Object.entries(TIPO_INTERACAO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
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

/* ================= Aba: Atividade (linha do tempo unificada) ================= */

function AbaAtividade({ v }: { v: Visitante }) {
  const s = useAppState()
  const interacoes = interacoesDe(s, v.id)

  type Evento = { data: string; tipo: 'contato' | 'status'; contato?: typeof interacoes[number]; mudanca?: Visitante['historicoStatus'][number] }
  const eventos: Evento[] = [
    ...interacoes.map((i) => ({ data: i.data, tipo: 'contato' as const, contato: i })),
    ...v.historicoStatus.map((h) => ({ data: h.data, tipo: 'status' as const, mudanca: h })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="card">
      <h3>Linha do tempo ({interacoes.length} contato{interacoes.length === 1 ? '' : 's'})</h3>
      {eventos.length === 0 && <div className="vazio">Nada registrado ainda.</div>}
      {eventos.map((e, idx) => (
        <div className="interacao-item" key={idx}>
          <div className="interacao-meta">
            {fmt(e.data)}
            {e.tipo === 'contato' && <> · {TIPO_INTERACAO_LABEL[e.contato!.tipo]} · por {e.contato!.autorPapel === 'lider' ? 'líder' : 'consolidador'}</>}
            {e.tipo === 'status' && e.mudanca!.automatica && ' · automático'}
          </div>
          {e.tipo === 'contato' ? (
            <div className="interacao-corpo">
              <p>
                <b>{e.contato!.respondeu ? '💬 Respondeu' : '🔇 Sem resposta'}</b>
                {e.contato!.respondeu && <> · abertura {GRAU_LABEL[e.contato!.grauAbertura].toLowerCase()}</>}
                {e.contato!.flagCuidado && <span className="badge-flag" style={{ marginLeft: 6 }}>🚨 cuidado</span>}
              </p>
              {e.contato!.retornoResumo && <p>{e.contato!.retornoResumo}</p>}
              {e.contato!.proximosPassos && <p><b>Próximo passo:</b> {e.contato!.proximosPassos}</p>}
              {e.contato!.encaminhamentos && <p><b>Encaminhamentos:</b> {e.contato!.encaminhamentos}</p>}
            </div>
          ) : (
            <div className="interacao-corpo">
              <p>
                {e.mudanca!.de && <><span className="badge" style={estiloStatus(e.mudanca!.de)}>{STATUS_LABEL[e.mudanca!.de]}</span>{' → '}</>}
                <span className="badge" style={estiloStatus(e.mudanca!.para)}>{STATUS_LABEL[e.mudanca!.para]}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 12.5, marginLeft: 8 }}>{e.mudanca!.motivo}</span>
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ================= Aba: Dados (editável) ================= */

function AbaDados({ v }: { v: Visitante }) {
  const s = useAppState()
  const m = (patch: Partial<Visitante>) => atualizarVisitante(v.id, patch)

  return (
    <div className="card">
      <h3>Dados do visitante</h3>
      <p className="descricao-secao">Alterações são salvas automaticamente.</p>
      <div className="linha-campos">
        <label className="campo"><span>Nome</span>
          <input type="text" value={v.nome} onChange={(e) => m({ nome: e.target.value })} />
        </label>
        <label className="campo"><span>WhatsApp</span>
          <input type="tel" value={v.whatsapp} onChange={(e) => m({ whatsapp: e.target.value })} />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>E-mail</span>
          <input type="email" value={v.email ?? ''} onChange={(e) => m({ email: e.target.value || undefined })} />
        </label>
        <label className="campo"><span>Bairro / região</span>
          <input type="text" value={v.bairro ?? ''} onChange={(e) => m({ bairro: e.target.value || undefined })} />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Situação civil</span>
          <select value={v.situacaoCivil ?? ''} onChange={(e) => m({ situacaoCivil: (e.target.value || undefined) as SituacaoCivil | undefined })}>
            <option value="">—</option>
            {Object.entries(SITUACAO_CIVIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="campo"><span>1ª visita (culto)</span>
          <select value={v.cultoPrimeiraVisita ?? ''} onChange={(e) => m({ cultoPrimeiraVisita: e.target.value || undefined })}>
            <option value="">—</option>
            {s.config.cultos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Data da 1ª visita</span>
          <input type="date" value={v.dataPrimeiraVisita ?? ''} onChange={(e) => m({ dataPrimeiraVisita: e.target.value || undefined })} />
        </label>
        <div className="campo" />
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Como conheceu a igreja</span>
          <select value={v.comoConheceu ?? ''} onChange={(e) => m({ comoConheceu: e.target.value || undefined })}>
            <option value="">—</option>
            {s.config.comoConheceuOpcoes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="campo"><span>Origem do cadastro</span>
          <input type="text" value={`${ORIGEM_LABEL[v.origem]} · ${fmt(v.dataCadastro)}`} readOnly style={{ background: 'var(--surface2)' }} />
        </label>
      </div>
      <label className="campo"><span>Observações</span>
        <textarea value={v.observacoes ?? ''} onChange={(e) => m({ observacoes: e.target.value || undefined })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={v.flagMenorIdade} onChange={(e) => m({ flagMenorIdade: e.target.checked })} />
        Menor de idade (contato com o responsável)
      </label>

      <div className={`alerta ${v.consentimentoLgpd ? 'alerta-info' : 'alerta-warn'}`} style={{ marginTop: 4 }}>
        {v.consentimentoLgpd ? '✅' : '⚠️'} <div>
          <b>Consentimento LGPD:</b> {v.consentimentoLgpd
            ? <>autorizado{v.consentimentoLgpdData ? ` em ${fmt(v.consentimentoLgpdData)}` : ''}.</>
            : 'não registrado — este cadastro é anterior a esse controle, ou o consentimento não foi confirmado.'}
        </div>
      </div>

      <hr style={{ margin: '18px 0 14px', border: 'none', borderTop: '1px solid var(--border)' }} />
      <details>
        <summary style={{ color: 'var(--danger)' }}>Cadastrou por engano? Excluir este visitante</summary>
        <p className="descricao-secao" style={{ marginTop: 8 }}>
          Remove este cadastro e o histórico de contatos por completo — use para duplicados ou testes.
          Não tem volta. Se a pessoa só não quer mais ser contatada, prefira mudar o status para "Recusou".
        </p>
        <button
          className="btn btn-perigo btn-mini"
          onClick={() => {
            if (!confirm(`Excluir o cadastro de "${v.nome}" para sempre? Esta ação não pode ser desfeita.`)) return
            excluirVisitante(v.id, 'Cadastro feito por engano')
            navegar('/visitantes')
          }}
        ><IcoLixeira size={13} /> Excluir cadastro</button>
      </details>
    </div>
  )
}

/* ================= Aba: Acompanhamento (+ avançado) ================= */

function AbaAcompanhamento({ v }: { v: Visitante }) {
  const s = useAppState()
  const lider = usuarioPorId(s, v.liderConexaoId)
  const responsavel = usuarioPorId(s, v.responsavelId)
  const transicoes = transicoesDisponiveis(v.status)
  const [mostrarCorrecao, setMostrarCorrecao] = useState(false)

  // Cobrança de atualização: mensagem pronta para o consolidador responsável,
  // com o link que abre direto esta ficha para ele registrar o contato.
  const linkFicha = `${window.location.origin}${window.location.pathname}#/visitante/${v.id}`
  const msgCobranca = responsavel
    ? `Oi, ${responsavel.nome.split(' ')[0]}! Tudo bem? Como está o acompanhamento de ${v.nome}? Quando puder, registra a atualização na ficha: ${linkFicha}`
    : ''

  const MOTIVO: Partial<Record<Status, string>> = {
    em_contato: 'Contato retomado', aguardando_resposta: 'Contato enviado, sem retorno',
    encaminhado_lider: 'Aceitou o convite — handoff ao líder', visitou: 'Compareceu ao grupo',
    transferido: 'Líder confirmou que assumiu', integrado: 'Batismo/membresia',
    em_espera: 'Movido para acompanhamento leve', recusou: 'Pediu para não ser contatado',
    encerrado: 'Encerrado na triagem',
  }

  return (
    <div className="card">
      <h3>Quem acompanha</h3>
      <div className="linha-campos">
        <label className="campo"><span>Responsável (consolidador)</span>
          <select value={v.responsavelId ?? ''} onChange={(e) => atualizarVisitante(v.id, { responsavelId: e.target.value || undefined })}>
            <option value="">— sem responsável —</option>
            {consolidadoresAtivos(s).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="campo"><span>{s.config.termoGrupo} designada</span>
          <select
            value={v.conexaoId ?? ''}
            onChange={(e) => {
              const cx = s.conexoes.find((c) => c.id === e.target.value)
              atualizarVisitante(v.id, { conexaoId: cx?.id, liderConexaoId: cx?.liderId })
            }}
          >
            <option value="">— sem grupo —</option>
            {s.conexoes.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.regiao})</option>)}
          </select>
        </label>
      </div>
      {responsavel && (
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>Integrador(a) pós-culto: <b>{responsavel.nome}</b> · {responsavel.whatsapp}</span>
          <a className="btn btn-whats btn-mini" href={linkWhatsApp(responsavel.whatsapp, msgCobranca)} target="_blank" rel="noreferrer">
            <IcoWhats size={13} /> Pedir atualização
          </a>
        </p>
      )}
      {lider && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Líder do grupo: <b>{lider.nome}</b> · {lider.whatsapp}</p>}
      <label className="campo" style={{ maxWidth: 420 }}><span>Perfil de abordagem</span>
        <select value={v.perfilAbordagem ?? ''} onChange={(e) => atualizarVisitante(v.id, { perfilAbordagem: (e.target.value || undefined) as PerfilAbordagem | undefined })}>
          <option value="">— não classificado —</option>
          {Object.entries(PERFIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>

      <details>
        <summary>Avançado: mudar status manualmente</summary>
        <p className="descricao-secao" style={{ marginTop: 8 }}>
          No dia a dia você não precisa disto — o registro de contato move o status sozinho.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {transicoes.map((t) => (
            <button key={t} className="btn btn-sec btn-mini" style={{ justifyContent: 'flex-start' }}
              onClick={() => mudarStatus(v.id, t, MOTIVO[t] ?? 'Mudança manual')}>
              → {STATUS_LABEL[t]}
            </button>
          ))}
          {transicoes.length === 0 && <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Estado final — sem transições normais.</span>}
        </div>
      </details>

      <details>
        <summary>Marcou errado? Corrija aqui</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {v.historicoStatus.length > 1 && (
            <button className="btn btn-sec btn-mini" style={{ justifyContent: 'flex-start' }} onClick={() => desfazerUltimaMudanca(v.id)}>
              <IcoDesfazer size={13} /> Desfazer última mudança (voltar para "{STATUS_LABEL[v.historicoStatus[v.historicoStatus.length - 2].para]}")
            </button>
          )}
          <button className="btn btn-sec btn-mini" style={{ justifyContent: 'flex-start' }} onClick={() => setMostrarCorrecao(!mostrarCorrecao)}>
            <IcoEditar size={13} /> Corrigir para outro status…
          </button>
          {mostrarCorrecao && <FormCorrecao visitanteId={v.id} statusAtual={v.status} onFechar={() => setMostrarCorrecao(false)} />}
        </div>
      </details>
    </div>
  )
}

// Correção manual de status: qualquer destino, com motivo registrado na auditoria
function FormCorrecao({ visitanteId, statusAtual, onFechar }: { visitanteId: string; statusAtual: Status; onFechar: () => void }) {
  const [para, setPara] = useState<Status>('novo')
  const [motivo, setMotivo] = useState('')
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12 }}>
      <label className="campo"><span>Status correto</span>
        <select value={para} onChange={(e) => setPara(e.target.value as Status)}>
          {(Object.keys(STATUS_LABEL) as Status[]).filter((st) => st !== statusAtual).map((st) => (
            <option key={st} value={st}>{STATUS_LABEL[st]}</option>
          ))}
        </select>
      </label>
      <label className="campo"><span>Motivo da correção</span>
        <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: marcado por engano" />
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-mini" onClick={() => { corrigirStatus(visitanteId, para, motivo); onFechar() }}>Aplicar correção</button>
        <button className="btn btn-sec btn-mini" onClick={onFechar}>Cancelar</button>
      </div>
    </div>
  )
}
