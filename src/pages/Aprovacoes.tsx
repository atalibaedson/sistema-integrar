import { useState } from 'react'
import { useAppState, usuarioPorId } from '../store'
import { useUsuarioAtualId, usuarioAtual } from '../acesso'
import { aprovarIntegrante, rejeitarIntegrante } from '../actions'
import { PAPEL_COR, PAPEL_LABEL, rotuloPapel, SITUACAO_CIVIL_LABEL, STATUS_ACESSO_LABEL, type Papel, type Usuario } from '../types'
import { iniciais } from './Equipe'
import { IcoCheck } from '../icones'

function idade(dataNascimento?: string): string {
  if (!dataNascimento) return ''
  const anos = Math.floor((Date.now() - new Date(dataNascimento).getTime()) / 31_557_600_000)
  return Number.isFinite(anos) && anos > 0 ? ` · ${anos} anos` : ''
}

// Fila de aprovação de acesso: novos integrantes que confirmaram o e-mail e
// aguardam liberação. Restrita a Pastores/Gestão Ministerial e Gestão Integração.
export default function Aprovacoes() {
  const s = useAppState()
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const [rejeitando, setRejeitando] = useState('') // id do usuário com o campo de motivo aberto
  const [motivo, setMotivo] = useState('')
  // Funções ajustadas pela liderança, por usuário (partem do que a pessoa pediu)
  const [papeisEdit, setPapeisEdit] = useState<Record<string, Papel[]>>({})
  const papeisDe = (u: Usuario): Papel[] => papeisEdit[u.id] ?? u.papeis
  function alternarPapel(u: Usuario, p: Papel) {
    const atual = papeisDe(u)
    const novo = atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p]
    setPapeisEdit((m) => ({ ...m, [u.id]: novo }))
  }

  const pendentes = s.usuarios.filter((u) => u.statusAcesso === 'pendente_aprovacao')
  const aindaSemEmail = s.usuarios.filter((u) => u.statusAcesso === 'pendente_confirmacao_email')
  const decididos = s.usuarios
    .filter((u) => u.statusAcesso === 'aprovado' || u.statusAcesso === 'rejeitado')
    .filter((u) => u.aprovadoEm || u.rejeitadoEm)
    .sort((a, b) => (b.aprovadoEm ?? b.rejeitadoEm ?? '').localeCompare(a.aprovadoEm ?? a.rejeitadoEm ?? ''))
    .slice(0, 10)

  function Cartao({ u, acoes }: { u: Usuario; acoes: boolean }) {
    return (
      <div className="cartao" style={{ marginBottom: 10, padding: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {u.fotoUrl ? (
            <img src={u.fotoUrl} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div className="avatar" style={{ background: PAPEL_COR[u.papeis[0]] }}>{iniciais(u.nome)}</div>
          )}
          <div style={{ flex: 1, minWidth: 220 }}>
            <b>{u.nome}</b>{idade(u.dataNascimento)}
            {acoes ? (
              <div style={{ margin: '6px 0' }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                  Funções (confirme ou ajuste antes de liberar):
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) => (
                    <label key={p} className="check" style={{ fontSize: 13 }}>
                      <input type="checkbox" checked={papeisDe(u).includes(p)} onChange={() => alternarPapel(u, p)} />
                      {rotuloPapel(p)}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
                {u.papeis.map((p) => (
                  <span key={p} className="badge" style={{ background: PAPEL_COR[p] + '22', color: PAPEL_COR[p] }}>{rotuloPapel(p)}</span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              📱 {u.whatsapp} · ✉️ {u.email}
              {u.bairro && <> · 📍 {u.bairro}</>}
              {u.situacaoCivil && <> · {SITUACAO_CIVIL_LABEL[u.situacaoCivil]}</>}
            </div>
            {u.comoConheceu && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Chegou por: {u.comoConheceu}</div>}
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              {STATUS_ACESSO_LABEL[u.statusAcesso]}
              {u.statusAcesso === 'aprovado' && u.aprovadoPorId && <> por <b>{usuarioPorId(s, u.aprovadoPorId)?.nome ?? '?'}</b></>}
              {u.statusAcesso === 'rejeitado' && (
                <> por <b>{usuarioPorId(s, u.rejeitadoPorId)?.nome ?? '?'}</b>{u.motivoRejeicao && <> — {u.motivoRejeicao}</>}</>
              )}
            </div>
          </div>
          {acoes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                className="btn"
                disabled={papeisDe(u).length === 0}
                title={papeisDe(u).length === 0 ? 'Marque ao menos uma função' : undefined}
                onClick={() => aprovarIntegrante(u.id, eu?.id, papeisDe(u))}
              >
                <IcoCheck size={14} /> Aprovar acesso
              </button>
              {rejeitando === u.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="text" value={motivo} autoFocus placeholder="Motivo (fica registrado)"
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-sec"
                      onClick={() => { rejeitarIntegrante(u.id, eu?.id, motivo.trim()); setRejeitando(''); setMotivo('') }}
                    >
                      Confirmar rejeição
                    </button>
                    <button className="btn btn-sec" onClick={() => { setRejeitando(''); setMotivo('') }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-sec" onClick={() => { setRejeitando(u.id); setMotivo('') }}>Rejeitar…</button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="titulo-pagina">Aprovações de acesso</h1>
      <p className="subtitulo">
        Novos integrantes que criaram conta e aguardam liberação. Somente Pastores e Gestão
        Ministerial ou Gestão Integração podem aprovar.
      </p>

      <h3 style={{ margin: '18px 0 8px' }}>⏳ Aguardando aprovação ({pendentes.length})</h3>
      {pendentes.length === 0 && <p style={{ color: 'var(--text-2)' }}>Ninguém aguardando aprovação no momento. 🎉</p>}
      {pendentes.map((u) => <Cartao key={u.id} u={u} acoes />)}

      {aindaSemEmail.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 8px' }}>📬 Ainda confirmando o e-mail ({aindaSemEmail.length})</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Estas pessoas se cadastraram mas ainda não clicaram no link de confirmação — a aprovação
            libera quando confirmarem.
          </p>
          {aindaSemEmail.map((u) => <Cartao key={u.id} u={u} acoes={false} />)}
        </>
      )}

      {decididos.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 8px' }}>🗂 Decisões recentes</h3>
          {decididos.map((u) => <Cartao key={u.id} u={u} acoes={false} />)}
        </>
      )}
    </div>
  )
}
