import { useAppState } from '../store'
import { podeVerVisitante, useUsuarioAtualId, usuarioAtual } from '../acesso'
import AbaDados from './VisitanteDetalhe/AbaDados'
import AbaAcompanhamento from './VisitanteDetalhe/AbaAcompanhamento'

// Página de dados completos + configuração do acompanhamento — acessada via
// "Dados completos →" no rodapé da ficha principal.
export default function VisitanteDados({ id }: { id: string }) {
  const s = useAppState()
  const v = s.visitantes.find((x) => x.id === id)
  const eu = usuarioAtual(s, useUsuarioAtualId())

  if (!v) return <div className="vazio">Visitante não encontrado. <a href="#/visitantes">Voltar</a></div>

  if (!podeVerVisitante(s, eu, v)) {
    return (
      <div className="vazio" style={{ maxWidth: 460, margin: '40px auto' }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <p style={{ marginTop: 8 }}>Você não tem acesso à ficha desta pessoa.</p>
        <a href="#/visitantes" style={{ color: 'var(--primary)' }}>← Voltar</a>
      </div>
    )
  }

  return (
    <div className="ficha-wrap">
      <a href={`#/visitante/${id}`} style={{ color: 'var(--primary)', fontSize: 13 }}>← Voltar para {v.nome.split(' ')[0]}</a>
      <h2 style={{ margin: '12px 0 4px', fontSize: 18, fontWeight: 700 }}>{v.nome}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Dados completos e configurações de acompanhamento</p>
      <AbaDados v={v} />
      <AbaAcompanhamento v={v} />
    </div>
  )
}
