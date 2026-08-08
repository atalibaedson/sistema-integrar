import { useState } from 'react'
import { consolidadoresAtivos, useAppState, usuarioPorId } from '../../store'
import { PERFIL_LABEL, rotuloStatus, STATUS_LABEL, type PerfilAbordagem, type Status, type Visitante } from '../../types'
import { atualizarVisitante, corrigirStatus, desfazerUltimaMudanca, linkWhatsApp, mudarStatus } from '../../actions'
import { transicoesDisponiveis } from '../../machine'
import { IcoDesfazer, IcoEditar, IcoWhats } from '../../icones'
import { CampoInicioConexao } from './comum'

/* ================= Aba: Acompanhamento (+ avançado) ================= */

export default function AbaAcompanhamento({ v }: { v: Visitante }) {
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
