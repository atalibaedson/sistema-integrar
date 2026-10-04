import { useState } from 'react'
import { useAppState, usuarioPorId } from '../store'
import { useUsuarioAtualId, usuarioAtual } from '../acesso'
import { aprovarIntegrante, rejeitarIntegrante } from '../actions'
import { PAPEL_COR, PAPEL_LABEL, rotuloPapel, SITUACAO_CIVIL_LABEL, STATUS_ACESSO_LABEL, type Papel, type Usuario } from '../types'
import { IcoCheck, IcoEmail, IcoMapa, IcoWhats } from '../icones'
import Avatar from '../Avatar'

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
      <div className={`card aprov-cartao ${acoes ? 'aprov-pendente' : ''}`}>
        <Avatar nome={u.nome} tom={PAPEL_COR[u.papeis[0]]} foto={u.fotoUrl} />
        <div className="aprov-corpo">
          <div className="pessoa-nome">{u.nome}<span className="aprov-idade">{idade(u.dataNascimento)}</span></div>
          {acoes ? (
            <div className="aprov-funcoes">
              <span>Funções (confirme ou ajuste antes de liberar):</span>
              <div>
                {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) => (
                  <label key={p} className="check">
                    <input type="checkbox" checked={papeisDe(u).includes(p)} onChange={() => alternarPapel(u, p)} />
                    {rotuloPapel(p)}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="cartao-tags">
              {u.papeis.map((p) => (
                <span key={p} className="tag" style={{ background: PAPEL_COR[p] + '18', borderColor: PAPEL_COR[p] + '40', color: PAPEL_COR[p] }}>{rotuloPapel(p)}</span>
              ))}
            </div>
          )}
          <div className="pessoa-sub cartao-sub">
            <span><IcoWhats size={12} /> {u.whatsapp}</span>
            {u.email && <span><IcoEmail size={12} /> {u.email}</span>}
            {u.bairro && <span><IcoMapa size={12} /> {u.bairro}</span>}
            {u.situacaoCivil && <span>{SITUACAO_CIVIL_LABEL[u.situacaoCivil]}</span>}
          </div>
          {u.comoConheceu && <div className="pessoa-sub">Chegou por: {u.comoConheceu}</div>}
          <div className="aprov-status">
            {STATUS_ACESSO_LABEL[u.statusAcesso]}
            {u.statusAcesso === 'aprovado' && u.aprovadoPorId && <> por <b>{usuarioPorId(s, u.aprovadoPorId)?.nome ?? '?'}</b></>}
            {u.statusAcesso === 'rejeitado' && (
              <> por <b>{usuarioPorId(s, u.rejeitadoPorId)?.nome ?? '?'}</b>{u.motivoRejeicao && <> — {u.motivoRejeicao}</>}</>
            )}
          </div>
        </div>
        {acoes && (
          <div className="aprov-acoes">
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
                    className="btn btn-perigo"
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
    )
  }

  return (
    <div>
      <h1 className="titulo-pagina">Aprovações de acesso</h1>
      <p className="subtitulo">
        Novos integrantes que criaram conta e aguardam liberação. Somente Pastores e Gestão
        Ministerial ou Gestão Integração podem aprovar.
      </p>

      <div className="painel-secao-cab"><h2>Aguardando aprovação <span className="painel-contagem">{pendentes.length}</span></h2></div>
      {pendentes.length === 0 && <div className="card"><div className="painel-vazio">Ninguém aguardando aprovação no momento.</div></div>}
      {pendentes.map((u) => <Cartao key={u.id} u={u} acoes />)}

      {aindaSemEmail.length > 0 && (
        <>
          <div className="painel-secao-cab aprov-secao"><h2>Ainda confirmando o e-mail <span className="painel-contagem">{aindaSemEmail.length}</span></h2></div>
          <p className="descricao-secao" style={{ marginTop: -4 }}>
            Estas pessoas se cadastraram mas ainda não clicaram no link de confirmação — a aprovação
            libera quando confirmarem.
          </p>
          {aindaSemEmail.map((u) => <Cartao key={u.id} u={u} acoes={false} />)}
        </>
      )}

      {decididos.length > 0 && (
        <>
          <div className="painel-secao-cab aprov-secao"><h2>Decisões recentes</h2></div>
          {decididos.map((u) => <Cartao key={u.id} u={u} acoes={false} />)}
        </>
      )}
    </div>
  )
}
