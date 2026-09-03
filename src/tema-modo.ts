// Modo claro/escuro do app (opcional, por aparelho). Guarda a escolha em
// localStorage e põe data-theme="dark" na raiz — o CSS faz o resto. Padrão é
// claro; nada aqui roda até a pessoa ligar pelo botão 🌙 no topo.
const CHAVE = 'ife-tema-modo'
export type ModoTema = 'claro' | 'escuro'

export function getModoTema(): ModoTema {
  try {
    return localStorage.getItem(CHAVE) === 'escuro' ? 'escuro' : 'claro'
  } catch {
    return 'claro'
  }
}

export function aplicarModoTema(m: ModoTema) {
  if (typeof document === 'undefined') return
  if (m === 'escuro') document.documentElement.setAttribute('data-theme', 'dark')
  else document.documentElement.removeAttribute('data-theme')
}

export function alternarModoTema(): ModoTema {
  const novo: ModoTema = getModoTema() === 'escuro' ? 'claro' : 'escuro'
  try { localStorage.setItem(CHAVE, novo) } catch { /* modo privado: só não persiste */ }
  aplicarModoTema(novo)
  return novo
}
