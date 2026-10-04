import { useEffect, useRef, type ReactNode } from 'react'
import { consolidadoresAtivos, interacoesDe, useAppState, usuarioPorId } from '../../store'
import { estiloStatus, rotuloStatus, type Visitante } from '../../types'
import { atualizarVisitante, linkWhatsApp, resolverCuidado, sinalizarCuidado } from '../../actions'
import { fmtDataVisita } from '../../cultos'
import { podeVerCuidado, podeVerVisitante, useUsuarioAtualId, usuarioAtual } from '../../acesso'
import { registrarAuditoria } from '../../auditoria'
import { IcoAlerta, IcoCadeado, IcoCalendario, IcoCasa, IcoCheck, IcoSeta, IcoUsuario, IcoWhats } from '../../icones'
import Avatar from '../../Avatar'
import Roteiro from './Roteiro'
import AbaAtividade from './AbaAtividade'
import HistoricoAlteracoes from './HistoricoAlteracoes'
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
        <div className="sucesso-selo sem-acesso"><IcoCadeado size={26} /></div>
        <p style={{ marginTop: 8 }}>Você não tem acesso à ficha desta pessoa.</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Só quem acompanha o visitante (ou está acima na hierarquia) pode ver as conversas.</p>
        <a href="#/visitantes" style={{ color: 'var(--acento-texto)' }}>← Voltar</a>
      </div>
    )
  }

  const verCuidado = podeVerCuidado(s, eu, v)
  // Líder sem papel de gestão vê visão simplificada (otimizada para celular)
  const ehSoLider = Boolean(eu && eu.papeis.every((p) => p === 'lider'))

  if (ehSoLider) return <FichaLider id={id} />

  return <FichaCompleta id={id} />
}

/* ================= Ficha completa (consolidadores, gestão, admin) =================
   Padrão da família iFE: à esquerda a PESSOA (identidade, contato, quem cuida)
   e a atribuição; à direita o TRABALHO (jornada, atividade, histórico). No
   celular vira uma coluna só: pessoa → jornada → atividade → atribuição. */

function FichaCompleta({ id }: { id: string }) {
  const s = useAppState()
  const v = s.visitantes.find((x) => x.id === id)!
  const eu = usuarioAtual(s, useUsuarioAtualId())
  const verCuidado = podeVerCuidado(s, eu, v)
  const conexao = s.conexoes.find((c) => c.id === v.conexaoId)
  const responsavel = usuarioPorId(s, v.responsavelId)

  return (
    <div className="ficha">
      <a href="#/visitantes" className="voltar"><IcoSeta size={15} /> Visitantes</a>

      <div className="ficha-grade">
        <aside className="ficha-lado">
          <CartaoPessoa v={v} verCuidado={verCuidado}>
            <li><IcoWhats size={15} /><span>WhatsApp</span><b>{v.whatsapp}</b></li>
            <li><IcoCasa size={15} /><span>{s.config.termoGrupo}</span><b>{conexao?.nome ?? <em className="ficha-falta">sem grupo</em>}</b></li>
            <li>
              <IcoUsuario size={15} /><span>Responsável</span>
              <b>
                {responsavel
                  ? <>{responsavel.nome}{!responsavel.ativo && <em className="ficha-falta"> (inativo)</em>}</>
                  : <em className="ficha-falta">sem responsável</em>}
              </b>
            </li>
            {v.cultoPrimeiraVisita && (
              <li>
                <IcoCalendario size={15} /><span>1ª visita</span>
                <b>{v.cultoPrimeiraVisita}{v.dataPrimeiraVisita ? ` · ${fmtDataVisita(v.dataPrimeiraVisita)}` : ''}</b>
              </li>
            )}
          </CartaoPessoa>

          <Atribuicao v={v} />
        </aside>

        <div className="ficha-principal">
          {v.flagCuidado && verCuidado && (
            <div className="alerta alerta-perigo">
              <IcoAlerta size={16} />
              <div><b>Protocolo de cuidado:</b> saia do roteiro, acione a liderança/pastor, registre o encaminhamento.
              Nunca prometa nada em nome da igreja nem aja sozinho.</div>
            </div>
          )}
          {v.flagMenorIdade && (
            <div className="alerta alerta-warn"><IcoAlerta size={16} /><div>Menor de idade — todo contato deve ser feito com o <b>responsável</b>.</div></div>
          )}

          {/* Jornada */}
          <Roteiro v={v} />

          {/* Atividade inline — sem tab */}
          <AbaAtividade v={v} />

          {/* Histórico de alterações (auditoria) — só gestão/pastores */}
          <HistoricoAlteracoes v={v} />
        </div>
      </div>
    </div>
  )
}

/* ================= Cartão da pessoa (topo da ficha) ================= */

function CartaoPessoa({ v, verCuidado, compacto, children }: {
  v: Visitante; verCuidado: boolean; compacto?: boolean; children?: ReactNode
}) {
  return (
    <div className="card ficha-pessoa">
      <div className="ficha-pessoa-topo">
        <Avatar nome={v.nome} tamanho="g" tom={v.flagCuidado && verCuidado ? 'var(--danger)' : undefined} />
        <div className="ficha-pessoa-id">
          <h1 className="ficha-nome">{v.nome}</h1>
          <div className="ficha-chips">
            <span className="chip-etapa" style={estiloStatus(v.status)}>{rotuloStatus(v.status)}</span>
            {v.flagCuidado && verCuidado && <span className="painel-chip painel-chip-crit">cuidado</span>}
            {v.flagMenorIdade && <span className="painel-chip painel-chip-warn">menor</span>}
          </div>
        </div>
      </div>

      {children && <ul className="ficha-info">{children}</ul>}

      <div className="ficha-pessoa-acoes">
        <a className="btn btn-whats" href={linkWhatsApp(v.whatsapp)} target="_blank" rel="noreferrer">
          <IcoWhats size={15} /> WhatsApp
        </a>
        {!compacto && verCuidado && (v.flagCuidado ? (
          <button className="btn btn-sec" onClick={() => resolverCuidado(v.id)}><IcoCheck size={15} /> Resolver cuidado</button>
        ) : (
          <button className="btn btn-perigo" title="Sinalizar cuidado/crise" onClick={() => sinalizarCuidado(v.id)}>
            <IcoAlerta size={15} /> Sinalizar cuidado
          </button>
        ))}
      </div>
    </div>
  )
}

/* ================= Atribuição: responsável + grupo + dados completos ================= */

function Atribuicao({ v }: { v: Visitante }) {
  const s = useAppState()
  const m = (patch: Parameters<typeof atualizarVisitante>[1]) => atualizarVisitante(v.id, patch)

  return (
    <div className="card ficha-atribuicao">
      <h3>Quem acompanha</h3>
      <label className="campo">
        <span>Responsável</span>
        <select value={v.responsavelId ?? ''} onChange={(e) => m({ responsavelId: e.target.value || undefined })}>
          <option value="">— sem responsável —</option>
          {consolidadoresAtivos(s)
            .slice()
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
            .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          {/* Responsável removido/inativo: mostra a situação real em vez de
              cair em silêncio na primeira opção, como se não houvesse ninguém */}
          {v.responsavelId && !consolidadoresAtivos(s).some((c) => c.id === v.responsavelId) && (
            <option value={v.responsavelId} disabled>
              {usuarioPorId(s, v.responsavelId)?.nome ?? 'Integrante removido'} (inativo — escolha outro)
            </option>
          )}
        </select>
      </label>
      <label className="campo">
        <span>{s.config.termoGrupo} designada</span>
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
      <a href={`#/visitante/${v.id}/dados`} className="ficha-link">
        Dados completos <IcoSeta size={14} />
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
    <div className="ficha ficha-so-lider">
      <a href="#/lideres" className="voltar"><IcoSeta size={15} /> Meu painel</a>

      <CartaoPessoa v={v} verCuidado={verCuidado} compacto>
        {responsavel && <li><IcoUsuario size={15} /><span>Integrador(a)</span><b>{responsavel.nome}</b></li>}
        {v.bairro && <li><IcoCasa size={15} /><span>Bairro</span><b>{v.bairro}{v.cidade ? ` · ${v.cidade}` : ''}</b></li>}
        {v.dataCadastro && <li><IcoCalendario size={15} /><span>Cadastro</span><b>{fmt(v.dataCadastro)}</b></li>}
        {v.situacaoCivil && <li><IcoUsuario size={15} /><span>Situação civil</span><b>{v.situacaoCivil}</b></li>}
      </CartaoPessoa>

      {v.flagCuidado && verCuidado && (
        <div className="alerta alerta-perigo">
          <IcoAlerta size={16} /><div><b>Cuidado/crise:</b> acione a liderança imediatamente e registre o encaminhamento.</div>
        </div>
      )}

      {/* Jornada — "O que fazer agora" em destaque */}
      <Roteiro v={v} />

      {/* Histórico resumido (últimos 4 registros) */}
      <HistoricoResumido v={v} />
    </div>
  )
}

function HistoricoResumido({ v }: { v: Visitante }) {
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
      <h3>Histórico recente</h3>
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
                {contato.respondeu ? 'Respondeu' : 'Sem resposta'}
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
