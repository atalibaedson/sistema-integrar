// Foto de perfil escolhida no cadastro de integrante.
//
// Com a confirmação de e-mail ligada, quem se cadastra ainda não tem sessão para
// enviar a foto ao Storage. A foto fica guardada, reduzida, neste aparelho e é
// enviada no primeiro acesso confirmado — se a pessoa abrir o link no MESMO
// aparelho. Em outro aparelho ela segue sem foto (pode ser adicionada depois).

const prefixo = 'ife-foto-pendente:'
const chave = (email: string) => prefixo + email.trim().toLowerCase()

// Reduz para no máximo 480 px (JPEG) — cabe no localStorage e basta para um avatar
function reduzir(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const escala = Math.min(1, 480 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * escala))
      c.height = Math.max(1, Math.round(img.height * escala))
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')) }
    img.src = url
  })
}

export async function guardarFotoPendente(email: string, arquivo: File): Promise<void> {
  try {
    localStorage.setItem(chave(email), await reduzir(arquivo))
  } catch {
    // sem canvas/storage: a pessoa segue sem foto
  }
}

/** A foto guardada para este e-mail, pronta para enviar (ou null). */
export async function lerFotoPendente(email: string): Promise<Blob | null> {
  try {
    const dados = localStorage.getItem(chave(email))
    if (!dados) return null
    return await (await fetch(dados)).blob()
  } catch {
    return null
  }
}

export function limparFotoPendente(email: string): void {
  try { localStorage.removeItem(chave(email)) } catch { /* nada a limpar */ }
}
