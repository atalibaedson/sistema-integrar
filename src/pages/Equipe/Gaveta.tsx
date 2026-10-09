import { useEffect, type ReactNode } from 'react'

// Painel lateral (gaveta) para editar ou criar sem sair da lista. No celular
// ocupa a tela toda. Fecha com Esc ou ao clicar fora — quem a usa decide, em
// `onFechar`, se há algo a descartar (ver EditarMembro).
export default function Gaveta({ rotulo, onFechar, children }: {
  rotulo: string
  onFechar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', tecla)
    // Trava a rolagem da página por trás enquanto a gaveta está aberta
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
    }
  }, [onFechar])

  return (
    <div className="eq-gaveta-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <aside className="eq-gaveta" role="dialog" aria-modal="true" aria-label={rotulo}>
        {children}
      </aside>
    </div>
  )
}
