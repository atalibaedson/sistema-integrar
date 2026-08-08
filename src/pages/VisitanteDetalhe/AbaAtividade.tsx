import { interacoesDe, useAppState } from '../../store'
import { estiloStatus, GRAU_LABEL, rotuloStatus, rotuloTipoInteracao, type Visitante } from '../../types'
import { fmt } from './comum'

/* ================= Aba: Atividade (linha do tempo unificada) ================= */

export default function AbaAtividade({ v }: { v: Visitante }) {
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
