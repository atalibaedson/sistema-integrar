import { lazy, type ComponentType } from 'react'

// React.lazy com recuperação de deploy novo: cada publicação troca o nome dos
// arquivos (hash). Quem estava com o app aberto pede uma tela pelo nome antigo,
// que já não existe — sem isto, a tela quebraria. Aqui, na falha, recarrega a
// página UMA vez (pega a versão nova); se falhar de novo, deixa o erro subir
// para o ErroBoundary em vez de ficar recarregando em loop.
const CHAVE = 'ife-recarregou-por-chunk'

export function lazyComRecarga<T extends ComponentType<any>>(carregar: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const m = await carregar()
      try { sessionStorage.removeItem(CHAVE) } catch { /* armazenamento indisponível */ }
      return m
    } catch (e) {
      let jaRecarregou = false
      try { jaRecarregou = sessionStorage.getItem(CHAVE) === '1' } catch { /* idem */ }
      if (!jaRecarregou) {
        try { sessionStorage.setItem(CHAVE, '1') } catch { /* idem */ }
        window.location.reload()
        return new Promise<{ default: T }>(() => {}) // a página vai recarregar
      }
      throw e
    }
  })
}
