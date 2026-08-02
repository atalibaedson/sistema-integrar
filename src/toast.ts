// Aviso rápido e discreto ("Salvo ✓") — confirma que uma ação foi gravada, sem
// precisar de alert(). Sem dependências: cria o nó, mostra e remove sozinho.
export function toast(msg: string, tipo: 'ok' | 'erro' | 'info' = 'ok') {
  if (typeof document === 'undefined') return
  let host = document.getElementById('toast-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'toast-host'
    document.body.appendChild(host)
  }
  const el = document.createElement('div')
  el.className = `toast toast-${tipo}`
  const icone = tipo === 'ok' ? '✓' : tipo === 'erro' ? '⚠️' : 'ℹ️'
  el.textContent = `${icone} ${msg}`
  host.appendChild(el)
  // Força o reflow para a transição de entrada acontecer
  requestAnimationFrame(() => el.classList.add('visivel'))
  window.setTimeout(() => {
    el.classList.remove('visivel')
    window.setTimeout(() => el.remove(), 250)
  }, 2200)
}
