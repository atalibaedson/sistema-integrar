import { useEffect, useRef, useState } from 'react'
import { useAppState, usuarioPorId } from '../../store'
import { estiloStatus, rotuloStatus, STATUS_COR } from '../../types'
import { linkWhatsApp, resolverCuidado, sinalizarCuidado } from '../../actions'
import { fmtDataVisita } from '../../cultos'
import { iniciais } from '../Equipe'
import { podeVerCuidado, podeVerVisitante, useUsuarioAtualId, usuarioAtual } from '../../acesso'
import { registrarAuditoria } from '../../auditoria'
import { IcoAlerta, IcoCheck, IcoConfig, IcoHistorico, IcoUsuario, IcoWhats } from '../../icones'
import Roteiro from './Roteiro'
import AbaAtividade from './AbaAtividade'
import AbaDados from './AbaDados'
import AbaAcompanhamento from './AbaAcompanhamento'

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
