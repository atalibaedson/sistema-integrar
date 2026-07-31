import { Component, type ReactNode } from 'react'

// Rede de segurança: sem isto, qualquer erro de render deixava a tela TOTALMENTE
// em branco (o React desmonta a árvore inteira). Aqui mostramos uma mensagem
// amigável com "Recarregar" — nunca mais um branco sem explicação.
export class ErroBoundary extends Component<{ children: ReactNode }, { erro?: Error }> {
  state: { erro?: Error } = {}

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  componentDidCatch(erro: Error) {
    console.error('[app] erro de render capturado:', erro)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="ac-tela">
        <div className="ac-cartao ac-cartao-ok">
          <div className="ac-check">😕</div>
          <h1 className="ac-titulo-ok">Algo não carregou</h1>
          <p className="ac-texto-ok">
            Tivemos um probleminha ao abrir esta tela. Recarregar a página costuma resolver.
          </p>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>
            Recarregar
          </button>
          <p style={{ marginTop: 14, fontSize: 11, color: 'var(--text-3)', wordBreak: 'break-word' }}>
            {String(this.state.erro?.message || this.state.erro)}
          </p>
        </div>
      </div>
    )
  }
}
