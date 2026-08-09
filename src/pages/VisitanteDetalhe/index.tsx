import { useEffect, useRef } from 'react'
import { consolidadoresAtivos, interacoesDe, useAppState, usuarioPorId } from '../../store'
import { estiloStatus, rotuloStatus, STATUS_COR } from '../../types'
import { atualizarVisitante, linkWhatsApp, resolverCuidado, sinalizarCuidado } from '../../actions'
import { fmtDataVisita } from '../../cultos'
import { iniciais } from '../Equipe'
import { podeVerCuidado, podeVerVisitante, useUsuarioAtualId, usuarioAtual } from '../../acesso'
import { registrarAuditoria } from '../../auditoria'
import { IcoAlerta, IcoCheck, IcoWhats } from '../../icones'
import Roteiro from './Roteiro'
import AbaAtividade from './AbaAtividade'
import { fmt } from './comum'

export default function VisitanteDetalhe({ id }: { id: string }) {
  const s = useAppState()
  const v = s.visitantes.find((x) => x.id === id)
  const eu = usuarioAtual(s, useUsuarioAtualId())

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
  // Líder sem papel de gestão vê visão simplificada (otimizada para celular)
  const ehSoLider = Boolean(eu && eu.papeis.every((p) => p === 'lider'))

  if (ehSoLider) return <FichaLider id={id} />

  return <FichaCompleta id={id} />
}

/* ================= Ficha completa (consolidadores, gestão, admin) ================= */

function FichaCompleta({ id }: { id: string }) {
  const s = useAppState()
  const v = s.visitantes.find((x) => x.id === id)!
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const verCuidado = podeVerCuidado(s, eu, v)
  const conexao = s.conexoes.find((c) => c.id === v.conexaoId)
  const responsavel = usuarioPorId(s, v.responsavelId)

  return (
    <div className="ficha-wrap">
      <a href="#/visitantes" style={{ color: 'var(--primary)', fontSize: 13 }}>← Visitantes</a>

      {/* Hero */}
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

      {/* Jornada */}
      <Roteiro v={v} />

      {/* Atividade inline — sem tab */}
      <AbaAtividade v={v} />

      {/* Rodapé de configuração rápida */}
      <RodapeConfig v={v} />
    </div>
  )
}

/* ================= Rodapé: atribuição rápida + link para dados completos ================= */

function RodapeConfig({ v }: { v: ReturnType<typeof useAppState>['visitantes'][number] }) {
  const s = useAppState()
  const m = (patch: Parameters<typeof atualizarVisitante>[1]) => atualizarVisitante(v.id, patch)

  return (
    <div className="ficha-footer-config">
      <label className="campo" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Responsável</span>
        <select value={v.responsavelId ?? ''} onChange={(e) => m({ responsavelId: e.target.value || undefined })}>
          <option value="">— sem responsável —</option>
          {consolidadoresAtivos(s)
            .slice()
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
            .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      <label className="campo" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.config.termoGrupo} designada</span>
        <select
          value={v.conexaoId ?? ''}
          onChange={(e) => {
            const cx = s.conexoes.find((c) => c.id === e.target.value)
            m({ conexaoId: cx?.id, liderConexaoId: cx?.liderId })
          }}
        >
          <option value="">— sem grupo —</option>
          {(() => {
            const sorted = [...s.conexoes].sort((a, b) => {
              const ba = a.bairro ?? '', bb = b.bairro ?? ''
              if (!ba && bb) return 1
              if (ba && !bb) return -1
              const bc = ba.localeCompare(bb, 'pt-BR')
              return bc !== 0 ? bc : a.nome.localeCompare(b.nome, 'pt-BR')
            })
            const bairros = [...new Set(sorted.map((c) => c.bairro ?? ''))]
            return bairros.map((bairro) => (
              <optgroup key={bairro || '__sem__'} label={bairro || 'Sem bairro'}>
                {sorted.filter((c) => (c.bairro ?? '') === bairro).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </optgroup>
            ))
          })()}
        </select>
      </label>
      <a href={`#/visitante/${v.id}/dados`} style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'center' }}>
        Dados completos →
      </a>
    </div>
  )
}

/* ================= Ficha simplificada para o líder (celular) ================= */

function FichaLider({ id }: { id: string }) {
  const s = useAppState()
  const v = s.visitantes.find((x) => x.id === id)!
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const verCuidado = podeVerCuidado(s, eu, v)
  const responsavel = usuarioPorId(s, v.responsavelId)

  return (
    <div className="ficha-wrap">
      <a href="#/lideres" style={{ color: 'var(--primary)', fontSize: 13 }}>← Meu painel</a>

      {/* Mini hero */}
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="avatar" style={{ width: 46, height: 46, fontSize: 16, background: STATUS_COR[v.status] }}>
            {iniciais(v.nome)}
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{v.nome}</span>
              <span className="badge" style={estiloStatus(v.status)}>{rotuloStatus(v.status)}</span>
              {v.flagCuidado && verCuidado && <span className="badge-flag">🚨 cuidado</span>}
            </div>
            <div className="pessoa-sub">📱 {v.whatsapp}</div>
          </div>
          <a className="btn btn-whats" href={linkWhatsApp(v.whatsapp)} target="_blank" rel="noreferrer">
            <IcoWhats size={15} />
          </a>
        </div>
      </div>

      {v.flagCuidado && verCuidado && (
        <div className="alerta alerta-perigo">
          🚨 <div><b>Cuidado/crise:</b> acione a liderança imediatamente e registre o encaminhamento.</div>
        </div>
      )}

      {/* Jornada — "O que fazer agora" em destaque */}
      <Roteiro v={v} />

      {/* Histórico resumido (últimos 4 registros) */}
      <HistoricoResumido v={v} />

      {/* Nota sobre a pessoa */}
      <div style={{
        background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        padding: '10px 14px', fontSize: 12.5, color: 'var(--text-3)', marginTop: 0,
      }}>
        {responsavel && <div>Integrador(a): <b style={{ color: 'var(--text-2)' }}>{responsavel.nome}</b></div>}
        {v.dataCadastro && <div>Cadastrado em {fmt(v.dataCadastro)}</div>}
        {v.bairro && <div>Bairro: {v.bairro}{v.cidade ? ` · ${v.cidade}` : ''}</div>}
        {v.situacaoCivil && <div>Situação civil: {v.situacaoCivil}</div>}
      </div>
    </div>
  )
}

function HistoricoResumido({ v }: { v: ReturnType<typeof useAppState>['visitantes'][number] }) {
  const s = useAppState()
  const interacoes = interacoesDe(s, v.id)

  type Ev = { data: string; tipo: 'contato' | 'status'; idx: number }
  const eventos: Ev[] = [
    ...interacoes.map((i, idx) => ({ data: i.data, tipo: 'contato' as const, idx })),
    ...v.historicoStatus.map((h, idx) => ({ data: h.data, tipo: 'status' as const, idx })),
  ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 4)

  if (eventos.length === 0) return null

  return (
    <div className="card" style={{ paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)', marginBottom: 12 }}>
        Histórico recente
      </div>
      {eventos.map((e, i) => {
        const contato = e.tipo === 'contato' ? interacoes[e.idx] : undefined
        const mudanca = e.tipo === 'status' ? v.historicoStatus[e.idx] : undefined
        return (
          <div key={i} style={{
            borderLeft: `2px solid ${e.tipo === 'status' ? 'var(--primary)' : contato?.respondeu ? 'var(--ok)' : 'var(--border-strong)'}`,
            paddingLeft: 12, marginLeft: 6, paddingBottom: 10, position: 'relative',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>{fmt(e.data)}</div>
            {contato && (
              <div style={{ fontSize: 13.5 }}>
                {contato.respondeu ? '💬 Respondeu' : '🔇 Sem resposta'}
                {contato.retornoResumo && <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>{contato.retornoResumo}</div>}
              </div>
            )}
            {mudanca && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {mudanca.de && <><span className="badge" style={estiloStatus(mudanca.de)}>{rotuloStatus(mudanca.de)}</span>→</>}
                <span className="badge" style={estiloStatus(mudanca.para)}>{rotuloStatus(mudanca.para)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
