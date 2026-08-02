import { useEffect, useRef, useState } from 'react'
import { consolidadoresAtivos, getEstado, interacoesDe, templatesPorEtapa, useAppState, usuarioPorId } from '../store'
import {
  estiloStatus, GRAU_LABEL, HORARIO_CONTATO_LABEL, OPCOES_DESEJA_CONEXAO, ORIGEM_LABEL, PERFIL_LABEL,
  SITUACAO_BATISMO_LABEL, SITUACAO_CIVIL_LABEL,
  rotuloStatus, rotuloTipoInteracao, STATUS_COR, STATUS_LABEL, TIPO_INTERACAO_LABEL,
  type EtapaFluxo, type GrauAbertura, type HorarioContato, type PerfilAbordagem, type SituacaoBatismo, type SituacaoCivil, type Status, type TipoInteracao, type Visitante,
} from '../types'
import {
  aplicarTemplate, atualizarVisitante, corrigirStatus, desfazerUltimaMudanca,
  encaminharParaBatismo, excluirVisitante, linkWhatsApp, marcarMembresia, mudarStatus, proximoTipoContato,
  prontidaoMembro, registrarBatismo, registrarBatismoRealizado, registrarInteracao, resolverCuidado, sinalizarCuidado,
  type Classificacao,
} from '../actions'
import { transicoesDisponiveis } from '../machine'
import { fmtDataVisita } from '../cultos'
import { SeletorData as CampoData } from '../campos'
import { iniciais } from './Equipe'
import { podeVerCuidado, podeVerVisitante, useUsuarioAtualId, usuarioAtual } from '../acesso'
import { registrarAuditoria } from '../auditoria'
import { navegar } from '../router'
import { IcoAlerta, IcoCheck, IcoDesfazer, IcoEditar, IcoEnviar, IcoHistorico, IcoLixeira, IcoUsuario, IcoConfig, IcoWhats } from '../icones'

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function fmtDia(iso: string): string {
  // "2026-08-01" (só data) é interpretado como meia-noite UTC pelo Date — no
  // fuso do Brasil isso vira o dia ANTERIOR. Datas de batismo, membresia e 1ª
  // visita são salvas nesse formato, então precisam ser lidas como data local.
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  const d = soData ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

/**
 * Escolha de data a partir do calendário cadastrado em Configurações.
 *
 * Batismo e recepção de membros não acontecem em qualquer dia: são eventos com
 * data marcada. Escolher numa lista evita o erro de digitação na pressa. Mas a
 * vida não cabe sempre no calendário — por isso sempre existe a saída "outra
 * data", que abre o campo livre. Sem datas cadastradas, cai direto no campo livre.
 */
function SeletorData({ datas, valor, onMudar, rotulo }: {
  datas: string[]
  valor: string
  onMudar: (d: string) => void
  rotulo: string
}) {
  const cadastradas = [...new Set(datas)].filter(Boolean).sort()
  const [livre, setLivre] = useState(cadastradas.length === 0)
  const semCalendario = cadastradas.length === 0 || livre

  // Mantém o valor coerente com o modo, senão o botão salva uma data que a
  // pessoa não escolheu: no modo lista, um valor fora da lista não está
  // realmente selecionado (o select mostra "escolher a data") e precisa ser
  // zerado; no modo livre, começar em hoje é o atalho útil.
  useEffect(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    if (semCalendario && !valor) onMudar(hoje)
    if (!semCalendario && valor && !cadastradas.includes(valor)) onMudar('')
  }, [semCalendario, valor])

  if (semCalendario) {
    return (
      <div className="campo" style={{ marginBottom: 0, maxWidth: 210 }}>
        <span>{rotulo}</span>
        <CampoData value={valor} onChange={onMudar} />
        {cadastradas.length > 0 && (
          <a href="#/" onClick={(e) => { e.preventDefault(); setLivre(false) }} style={{ fontSize: 11.5, marginTop: 4, display: 'inline-block' }}>
            ← escolher uma data do calendário
          </a>
        )}
      </div>
    )
  }

  return (
    <label className="campo" style={{ marginBottom: 0, maxWidth: 230 }}>
      <span>{rotulo}</span>
      <select
        value={cadastradas.includes(valor) ? valor : ''}
        onChange={(e) => {
          if (e.target.value === '__outra__') { setLivre(true); return }
          onMudar(e.target.value)
        }}
      >
        <option value="">— escolher a data —</option>
        {cadastradas.map((d) => <option key={d} value={d}>{fmtDia(d)}</option>)}
        <option value="__outra__">Outra data…</option>
      </select>
    </label>
  )
}

/**
 * Data em que a pessoa começou a frequentar o grupo — preenchida pelo líder.
 * É a base do requisito de tempo mínimo para virar membro.
 */
function CampoInicioConexao({ v }: { v: Visitante }) {
  const s = useAppState()
  const grupo = s.config.termoGrupo || 'Conexão'
  return (
    <div className="campo" style={{ marginBottom: 0, maxWidth: 230 }}>
      <span>Começou a frequentar a {grupo} em</span>
      <CampoData
        value={v.dataInicioConexao ?? ''}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(iso) => atualizarVisitante(v.id, { dataInicioConexao: iso || undefined })}
      />
    </div>
  )
}

/**
 * Botão de concluir a jornada (virar membro), com a checagem de prontidão que a
 * liderança do grupo faz antes: tempo mínimo frequentando o grupo (calculado da
 * data de início) e confirmação de frequência. O tempo pode ser liberado como
 * exceção — a vida nem sempre cabe na regra —, e tudo o que foi confirmado fica
 * registrado no histórico. As exigências são configuráveis (0 desliga cada uma).
 *
 * `primaria` controla só o destaque visual do botão: nos passos onde virar
 * membro é o próximo marco natural ele vem como ação principal; senão, secundária.
 */
function BotaoVirarMembro({ v, primaria }: { v: Visitante; primaria: boolean }) {
  const s = useAppState()
  const [dataMembresia, setDataMembresia] = useState('')
  const [freqOk, setFreqOk] = useState(false)
  const [excecao, setExcecao] = useState(false)
  const pr = prontidaoMembro(s, v)
  const primeiroNome = v.nome.split(' ')[0]
  const grupo = s.config.termoGrupo || 'Conexão'

  const tempoLiberado = pr.tempoOk || excecao
  const freqLiberado = !pr.exigeFrequencia || freqOk
  const podeConcluir = !!dataMembresia && tempoLiberado && freqLiberado

  // O que a liderança confirmou na hora — vai para o histórico da membresia.
  const obs = [
    pr.exigeFrequencia && freqOk ? `frequência acima de ${pr.frequenciaMinima}% confirmada` : '',
    pr.exigeTempo && !pr.tempoOk && excecao ? `exceção ao tempo mínimo (${pr.meses ?? 0}/${pr.mesesMinimos} meses no grupo)` : '',
  ].filter(Boolean).join('; ')

  const plural = (n: number) => (n === 1 ? 'mês' : 'meses')

  return (
    <div>
      {pr.regraAtiva && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--bg)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            Antes de receber {primeiroNome} como membro:
          </div>

          {pr.exigeTempo && (
            <div style={{ marginBottom: pr.exigeFrequencia ? 10 : 0 }}>
              {!pr.temDataInicio ? (
                <>
                  <p className="rot-sub" style={{ margin: '0 0 6px' }}>
                    ⏳ Informe quando {primeiroNome} começou a frequentar a {grupo} — o mínimo é {pr.mesesMinimos} {plural(pr.mesesMinimos)}.
                  </p>
                  <CampoInicioConexao v={v} />
                </>
              ) : pr.tempoOk ? (
                <p className="rot-sub" style={{ margin: 0 }}>
                  ✅ Frequenta a {grupo} há <b>{pr.meses} {plural(pr.meses!)}</b> (mínimo {pr.mesesMinimos}).
                </p>
              ) : (
                <>
                  <p className="rot-sub" style={{ margin: '0 0 4px' }}>
                    ⚠️ Frequenta a {grupo} há <b>{pr.meses} {plural(pr.meses!)}</b> — o mínimo é {pr.mesesMinimos} {plural(pr.mesesMinimos)}.
                  </p>
                  <label className="check" style={{ marginBottom: 0 }}>
                    <input type="checkbox" checked={excecao} onChange={(e) => setExcecao(e.target.checked)} />
                    Receber mesmo assim, como exceção
                  </label>
                </>
              )}
            </div>
          )}

          {pr.exigeFrequencia && (
            <label className="check" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={freqOk} onChange={(e) => setFreqOk(e.target.checked)} />
              Confirmo que {primeiroNome} teve mais de {pr.frequenciaMinima}% de frequência na {grupo} nesse período.
            </label>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <SeletorData
          datas={s.config.datasMembresia} valor={dataMembresia} onMudar={setDataMembresia}
          rotulo="Data da recepção como membro"
        />
        <button
          className={primaria ? 'btn' : 'btn btn-sec'}
          disabled={!podeConcluir}
          onClick={() => marcarMembresia(v.id, dataMembresia, obs || undefined)}
        >
          🎉 Concluir: virou membro!
        </button>
      </div>
    </div>
  )
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
              <span className="badge" style={estiloStatus(v.status)}>{rotuloStatus(v.status)}</span>
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

// Em qual passo (1-7) cada status se encontra
const PASSO_DO_STATUS: Record<Status, number> = {
  novo: 2, em_contato: 2, aguardando_resposta: 2, em_espera: 2, recusou: 2, encerrado: 2,
  encaminhado_lider: 3, visitou: 4, transferido: 5, batismo: 6, integrado: 7,
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
    // Nestes dois passos vale a data do EVENTO (o batismo, a recepção como
    // membro), não a do clique que moveu a ficha: alguém batizado dia 13 pode
    // só ter sido registrado dia 20, e é o dia 13 que a igreja quer ver.
    {
      n: 6,
      // Sem isto, um passo "Batismo" marcado e sem data fica ambíguo: pulou de
      // propósito, ou esqueceram de registrar? O texto diz qual dos dois é.
      titulo: v.situacaoBatismo === 'ja_batizado' ? 'Batismo · dispensado' : 'Batismo',
      quandoFeito: v.dataBatismo ?? dataDe('batismo'),
      explicacao: v.situacaoBatismo === 'ja_batizado'
        ? 'Não precisou: já era batizado(a) quando chegou à igreja.'
        : v.situacaoBatismo === 'batizado_aqui'
          ? 'Batizado(a) aqui na igreja.'
          : 'Etapa de quem ainda não é batizado. Quem já chegou batizado pula direto para o passo 7.',
    },
    { n: 7, titulo: 'Membro 🎉', quandoFeito: v.dataMembresia ?? dataDe('integrado'), explicacao: 'Recebida como membro da igreja — é isso que conclui a jornada, com ou sem batismo pelo caminho.' },
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
      {/* Chegar a "Membro" pelo quadro da Jornada ou por correção de status não
          pede a data. Sem este aviso, o buraco só apareceria no relatório. */}
      {concluido && !v.dataMembresia && (
        <div className="alerta alerta-warn">
          ⚠️ <div>
            Falta registrar <b>a data em que {v.nome.split(' ')[0]} virou membro</b>.
            Preencha na aba <b>Dados</b> — sem ela, a conclusão não entra nos relatórios por período.
          </div>
        </div>
      )}
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

/* Conteúdo do passo em andamento — as ações moram AQUI */
function PassoAtual({ v, passo }: { v: Visitante; passo: number }) {
  const s = useAppState()
  const [registrando, setRegistrando] = useState(false)
  // Vazias de propósito: quem preenche é o SeletorData, que sabe se a igreja tem
  // calendário cadastrado (aí a data é escolhida) ou não (aí hoje é o padrão).
  // A data da membresia mora dentro de BotaoVirarMembro (junto da checagem).
  const [dataBatismo, setDataBatismo] = useState('')
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
    const texto = template ? aplicarTemplate(template.texto, v, s) : undefined

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

  // Passo 5 — o líder acompanha até o próximo marco. Qual marco é esse depende
  // da situação de batismo: quem já é batizado não passa pelo batismo de novo,
  // vai direto a membro. Por isso a ordem dos botões muda conforme o caso.
  if (passo === 5) {
    const jaBatizado = v.situacaoBatismo === 'ja_batizado' || v.situacaoBatismo === 'batizado_aqui'
    const receberComoMembro = <BotaoVirarMembro v={v} primaria={jaBatizado} />
    const encaminharBatismo = (
      <button className={jaBatizado ? 'btn btn-sec' : 'btn'} onClick={() => encaminharParaBatismo(v.id)}>
        💧 Encaminhar {primeiroNome} para o batismo
      </button>
    )

    return (
      <div className="rot-caixa">
        <p className="rot-sub" style={{ marginBottom: 10 }}>
          O líder cuida de {primeiroNome}; a consolidação fica de apoio.{' '}
          {jaBatizado
            ? <>Como {primeiroNome} <b>já é batizado(a)</b>, o próximo marco é ser recebido(a) como membro.</>
            : v.situacaoBatismo === 'nao_batizado'
              ? <>{primeiroNome} <b>ainda não é batizado(a)</b> — o próximo marco costuma ser o batismo.</>
              : <>Ainda <b>não sabemos</b> se {primeiroNome} é batizado(a). Vale perguntar: é isso que define o próximo passo.</>}
        </p>

        {/* Preenchido pelo líder: base do tempo mínimo para virar membro. */}
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

  // Passo 6 — batismo: primeiro registra que aconteceu, depois recebe como
  // membro (é a membresia que fecha a jornada, não o batismo).
  if (passo === 6) {
    const batizado = v.situacaoBatismo === 'batizado_aqui' || v.situacaoBatismo === 'ja_batizado'
    return (
      <div className="rot-caixa">
        {!batizado ? (
          <>
            <p className="rot-sub" style={{ marginBottom: 10 }}>
              {primeiroNome} está encaminhado(a) para o batismo. Quando acontecer, registre a data aqui.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
              <SeletorData
                datas={s.config.datasBatismo} valor={dataBatismo} onMudar={setDataBatismo}
                rotulo="Data do batismo"
              />
              <button className="btn" disabled={!dataBatismo} onClick={() => registrarBatismoRealizado(v.id, dataBatismo)}>
                💧 Batizado(a)!
              </button>
            </div>
            <div className="rot-ou">ou</div>
          </>
        ) : (
          <p className="rot-sub" style={{ marginBottom: 10 }}>
            ✅ Batismo registrado{v.dataBatismo ? ` em ${fmtDia(v.dataBatismo)}` : ''}. Falta receber
            {' '}{primeiroNome} como membro — é isso que conclui a jornada.
          </p>
        )}

        <BotaoVirarMembro v={v} primaria={batizado} />

        <div className="rot-ou">ou</div>

        {/* Depois de batizada não faz sentido oferecer "adiou o batismo" — o que
            pode acontecer é a membresia demorar e a pessoa seguir com o líder. */}
        <button
          className="btn btn-sec"
          onClick={() => mudarStatus(
            v.id, 'transferido',
            batizado ? 'Membresia adiada — segue com o líder' : 'Batismo adiado — segue com o líder',
          )}
        >
          <IcoDesfazer size={14} />{' '}
          {batizado ? 'Membresia vai demorar — volta ao acompanhamento do líder' : 'Adiou o batismo — volta ao acompanhamento do líder'}
        </button>
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
            {e.tipo === 'contato' && <> · {rotuloTipoInteracao(e.contato!.tipo)} · por {e.contato!.autorPapel === 'lider' ? 'líder' : 'consolidador'}</>}
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
                {e.mudanca!.de && <><span className="badge" style={estiloStatus(e.mudanca!.de)}>{rotuloStatus(e.mudanca!.de)}</span>{' → '}</>}
                <span className="badge" style={estiloStatus(e.mudanca!.para)}>{rotuloStatus(e.mudanca!.para)}</span>
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
        <div className="campo"><span>Data de nascimento</span>
          <CampoData value={v.dataNascimento ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(iso) => m({ dataNascimento: iso || undefined })} />
        </div>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Endereço</span>
          <input type="text" value={v.endereco ?? ''} onChange={(e) => m({ endereco: e.target.value || undefined })} placeholder="Rua e número" />
        </label>
        <label className="campo"><span>Bairro</span>
          <input type="text" value={v.bairro ?? ''} onChange={(e) => m({ bairro: e.target.value || undefined })} />
        </label>
      </div>
      <div className="linha-campos">
        <label className="campo"><span>Cidade</span>
          <input type="text" value={v.cidade ?? ''} onChange={(e) => m({ cidade: e.target.value || undefined })} />
        </label>
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
        <div className="campo"><span>Data da 1ª visita</span>
          <CampoData value={v.dataPrimeiraVisita ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(iso) => m({ dataPrimeiraVisita: iso || undefined })} />
        </div>
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
      <div className="linha-campos">
        <label className="campo"><span>Primeira vez na igreja?</span>
          <select value={v.primeiraVez === undefined ? '' : v.primeiraVez ? 'sim' : 'nao'} onChange={(e) => m({ primeiraVez: e.target.value === '' ? undefined : e.target.value === 'sim' })}>
            <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
          </select>
        </label>
        <label className="campo"><span>Membro de outra igreja?</span>
          <select value={v.membroOutraIgreja === undefined ? '' : v.membroOutraIgreja ? 'sim' : 'nao'} onChange={(e) => m({ membroOutraIgreja: e.target.value === '' ? undefined : e.target.value === 'sim' })}>
            <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
          </select>
        </label>
      </div>

      {/* Batismo: fato da pessoa, não etapa do funil. Fica aqui (e não no roteiro)
          justamente porque pode ser preenchido em qualquer momento da jornada. */}
      <div className="bloco-destaque">
        <div className="bloco-destaque-titulo">💧 Situação de batismo</div>
        <p className="descricao-secao" style={{ marginTop: 0 }}>
          Não é etapa da jornada — quem já chega batizado não precisa de batismo para virar membro.
          Serve para não convidar ao batismo quem já é batizado, e para saber quem ainda pode ser convidado.
        </p>
        <div className="linha-campos">
          <label className="campo"><span>Situação</span>
            <select
              value={v.situacaoBatismo ?? ''}
              onChange={(e) => registrarBatismo(v.id, (e.target.value || undefined) as SituacaoBatismo | undefined, v.dataBatismo)}
            >
              <option value="">— ainda não sabemos —</option>
              {Object.entries(SITUACAO_BATISMO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {v.situacaoBatismo && v.situacaoBatismo !== 'nao_batizado' && (
            <div className="campo"><span>Data do batismo <em className="campo-dica">(se souber)</em></span>
              <CampoData
                value={v.dataBatismo ?? ''}
                onChange={(iso) => registrarBatismo(v.id, v.situacaoBatismo, iso || undefined)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Data da membresia editável aqui, e não só no momento de concluir a
          jornada: quem chega a "Membro" pelo quadro da Jornada ou por uma
          correção manual de status entra sem data, e sem este campo não haveria
          como preencher depois — só desfazendo o status. */}
      {(v.status === 'integrado' || v.dataMembresia) && (
        <div className="bloco-destaque">
          <div className="bloco-destaque-titulo">🎉 Membresia</div>
          <p className="descricao-secao" style={{ marginTop: 0 }}>
            O dia em que a pessoa foi recebida como membro — é o que conclui a jornada.
          </p>
          <div className="linha-campos">
            <div className="campo"><span>Data em que virou membro</span>
              <CampoData value={v.dataMembresia ?? ''} onChange={(iso) => m({ dataMembresia: iso || undefined })} />
            </div>
            <div className="campo" />
          </div>
          {v.status === 'integrado' && !v.dataMembresia && (
            <div className="alerta alerta-warn" style={{ marginBottom: 0 }}>
              ⚠️ <div>Está como membro, mas <b>sem a data</b> registrada. Preencha acima — sem ela, a pessoa não aparece nos relatórios por período.</div>
            </div>
          )}
        </div>
      )}
      <div className="linha-campos">
        <label className="campo"><span>Quer participar de uma {s.config.termoGrupo || 'Conexão'}?</span>
          <select value={v.desejaConexao ?? ''} onChange={(e) => m({ desejaConexao: e.target.value || undefined })}>
            <option value="">—</option>
            {OPCOES_DESEJA_CONEXAO.map((o) => <option key={o} value={o}>{o}</option>)}
            {v.desejaConexao && !(OPCOES_DESEJA_CONEXAO as readonly string[]).includes(v.desejaConexao) && (
              <option value={v.desejaConexao}>{v.desejaConexao}</option>
            )}
          </select>
        </label>
        <label className="campo"><span>Deseja contato? · melhor horário</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={v.desejaContato === undefined ? '' : v.desejaContato ? 'sim' : 'nao'} onChange={(e) => m({ desejaContato: e.target.value === '' ? undefined : e.target.value === 'sim' })}>
              <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
            </select>
            <select value={v.melhorHorarioContato ?? ''} onChange={(e) => m({ melhorHorarioContato: (e.target.value || undefined) as HorarioContato | undefined })}>
              <option value="">horário</option>
              {(Object.keys(HORARIO_CONTATO_LABEL) as HorarioContato[]).map((h) => <option key={h} value={h}>{HORARIO_CONTATO_LABEL[h]}</option>)}
            </select>
          </div>
        </label>
      </div>
      <label className="campo"><span>🙏 Pedido de oração</span>
        <textarea value={v.pedidoOracao ?? ''} onChange={(e) => m({ pedidoOracao: e.target.value || undefined })} placeholder="O que a pessoa pediu para orarmos." />
      </label>
      <label className="campo"><span>Observações (equipe)</span>
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
    transferido: 'Líder confirmou que assumiu', batismo: 'Encaminhado(a) para o batismo', integrado: 'Recebido(a) como membro',
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
            {s.conexoes.map((c) => {
              const loc = [c.bairro, c.cidade].filter(Boolean).join(' · ')
              return <option key={c.id} value={c.id}>{c.nome}{loc ? ` (${loc})` : ''}</option>
            })}
          </select>
        </label>
      </div>
      <div className="linha-campos">
        <CampoInicioConexao v={v} />
        <div className="campo" />
      </div>
      <p className="descricao-secao" style={{ marginTop: 0 }}>
        Data em que a pessoa passou a frequentar a {s.config.termoGrupo} — preenchida pelo líder.
        É a base do tempo mínimo exigido para receber como membro.
      </p>
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
              → {rotuloStatus(t)}
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
              <IcoDesfazer size={13} /> Desfazer última mudança (voltar para "{rotuloStatus(v.historicoStatus[v.historicoStatus.length - 2].para)}")
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
            <option key={st} value={st}>{rotuloStatus(st)}</option>
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
