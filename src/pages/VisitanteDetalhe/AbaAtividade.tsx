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

  function classeItem(e: Evento) {
    if (e.tipo === 'status') return 'interacao-item tipo-status'
    if (e.contato?.flagCuidado) return 'interacao-item tipo-cuidado'
    if (!e.contato?.respondeu) return 'interacao-item tipo-silencio'
    if (e.contato?.grauAbertura === 'alto') return 'interacao-item tipo-pronto'
    return 'interacao-item'
  }

  return (
    <div className="card">
      <div className="secao-header" style={{ marginBottom: 14 }}>
        <span>📋 Atividade</span>
        <span className="secao-cont">{interacoes.length} contato{interacoes.length === 1 ? '' : 's'}</span>
      </div>
      {eventos.length === 0 && <div className="vazio">Nada registrado ainda.</div>}
      {eventos.map((e, idx) => (
        <div className={classeItem(e)} key={idx}>
          <div className="interacao-meta">
            {fmt(e.data)}
            {e.tipo === 'contato' && <> · {rotuloTipoInteracao(e.contato!.tipo)} · por {e.contato!.autorPapel === 'lider' ? 'líder' : 'consolidador'}</>}
            {e.tipo === 'status' && e.mudanca!.automatica && ' · automático'}
          </div>
          {e.tipo === 'contato' ? (
            <div className="interacao-corpo">
              <p>
                <b>{e.contato!.respondeu ? '💬 Respondeu' : '🔇 Sem resposta'}</b>
                {e.contato!.respondeu && e.contato!.grauAbertura !== 'sem_resposta' && (
                  <> · abertura <span style={{ fontWeight: 700, color: aberturaColor(e.contato!.grauAbertura) }}>{GRAU_LABEL[e.contato!.grauAbertura].toLowerCase()}</span></>
                )}
                {e.contato!.flagCuidado && <span className="badge-flag" style={{ marginLeft: 6 }}>🚨 cuidado</span>}
              </p>
              {e.contato!.retornoResumo && <p>{e.contato!.retornoResumo}</p>}
              {e.contato!.proximosPassos && <p><b>Próximo passo:</b> {e.contato!.proximosPassos}</p>}
              {e.contato!.encaminhamentos && <p><b>Encaminhamentos:</b> {e.contato!.encaminhamentos}</p>}
            </div>
          ) : (
            <div className="interacao-corpo">
              <p style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                {e.mudanca!.de && (
                  <><span className="badge" style={estiloStatus(e.mudanca!.de)}>{rotuloStatus(e.mudanca!.de)}</span>→</>
                )}
                <span className="badge" style={estiloStatus(e.mudanca!.para)}>{rotuloStatus(e.mudanca!.para)}</span>
                {e.mudanca!.motivo && <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 4 }}>{e.mudanca!.motivo}</span>}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function aberturaColor(grau: string) {
  if (grau === 'alto') return 'var(--ok)'
  if (grau === 'baixo') return 'var(--warn)'
  return 'var(--text-2)'
}
