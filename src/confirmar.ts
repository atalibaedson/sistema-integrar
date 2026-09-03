// Diálogo de confirmação próprio — substitui o confirm() nativo, que no celular
// aparece como uma caixa cinza do sistema, sem a identidade da igreja e sem
// destaque para a consequência. Baseado em promise e em DOM puro (como o
// toast.ts), para trocar `if (!confirm(x))` por `if (!await confirmar({...}))`
// com o mínimo de mudança.
//
// SEGURANÇA: o padrão é sempre `false`. Cancelar, clicar no fundo, apertar Esc
// ou fechar → resolve(false). Só o botão de ação explícito resolve(true). Assim
// nenhuma ação destrutiva dispara sem o clique certo.
export interface OpcoesConfirmar {
  titulo?: string
  mensagem: string
  confirmar?: string // texto do botão de ação (padrão "Confirmar")
  cancelar?: string // texto do botão de cancelar (padrão "Cancelar")
  perigo?: boolean // ação destrutiva → botão vermelho
}

export function confirmar(opts: OpcoesConfirmar): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)

  return new Promise<boolean>((resolve) => {
    const fundo = document.createElement('div')
    fundo.className = 'modal-fundo'

    const caixa = document.createElement('div')
    caixa.className = 'modal confirmar-caixa'
    caixa.setAttribute('role', 'alertdialog')
    caixa.setAttribute('aria-modal', 'true')

    if (opts.titulo) {
      const h = document.createElement('h3')
      h.className = 'confirmar-titulo'
      h.textContent = opts.titulo
      caixa.appendChild(h)
    }

    const msg = document.createElement('p')
    msg.className = 'confirmar-msg'
    msg.textContent = opts.mensagem
    caixa.appendChild(msg)

    const rodape = document.createElement('div')
    rodape.className = 'confirmar-rodape'

    const btnCancelar = document.createElement('button')
    btnCancelar.type = 'button'
    btnCancelar.className = 'btn btn-sec'
    btnCancelar.textContent = opts.cancelar ?? 'Cancelar'

    const btnOk = document.createElement('button')
    btnOk.type = 'button'
    btnOk.className = opts.perigo ? 'btn btn-perigo' : 'btn'
    btnOk.textContent = opts.confirmar ?? 'Confirmar'

    rodape.appendChild(btnCancelar)
    rodape.appendChild(btnOk)
    caixa.appendChild(rodape)
    fundo.appendChild(caixa)
    document.body.appendChild(fundo)

    // Foco começa no Cancelar (opção segura)
    btnCancelar.focus()

    let fechado = false
    function fechar(resultado: boolean) {
      if (fechado) return
      fechado = true
      document.removeEventListener('keydown', aoTeclar)
      fundo.remove()
      resolve(resultado)
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar(false)
      if (e.key === 'Enter' && document.activeElement === btnOk) fechar(true)
    }

    btnOk.addEventListener('click', () => fechar(true))
    btnCancelar.addEventListener('click', () => fechar(false))
    fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(false) })
    document.addEventListener('keydown', aoTeclar)
  })
}
