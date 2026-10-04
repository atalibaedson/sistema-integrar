// Avatar de pessoa (padrão da família iFE): iniciais sobre uma cor estável por
// nome — a mesma pessoa tem sempre a mesma cor, em qualquer tela.

const CORES_AVATAR = ['#1F4E79', '#2E6DA4', '#1C7A4B', '#6D3FC4', '#9A6412', '#0E7490', '#7A3E65']

export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '?'
}

export function corDoNome(nome: string): string {
  let h = 0
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return CORES_AVATAR[h % CORES_AVATAR.length]
}

export default function Avatar({ nome, tom, tamanho, foto }: { nome: string; tom?: string; tamanho?: 'g' | 'p'; foto?: string }) {
  return (
    <span className={`avatar-pessoa ${tamanho ? `avatar-pessoa-${tamanho}` : ''}`} style={{ background: tom ?? corDoNome(nome) }} aria-hidden>
      {foto ? <img src={foto} alt="" /> : iniciaisDe(nome)}
    </span>
  )
}
