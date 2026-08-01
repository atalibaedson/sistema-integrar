// Tema visual da igreja — as três cores da área de configuração do site
// (papel, escura, primária). Todos os tons derivados saem delas por color-mix
// no CSS; aqui ficam só as decisões que o CSS não consegue tomar sozinho.

export interface Paleta {
  nome: string
  descricao: string
  corFundo: string
  corEscura: string
  corPrimaria: string
}

// Presets prontos. O primeiro é a identidade do site da Família Extraordinária
// (ifamiliaextraordinaria.com.br) — os mesmos valores da área de configuração.
export const PALETAS: Paleta[] = [
  {
    nome: 'Família Extraordinária',
    descricao: 'A paleta do site: creme, azul royal e dourado.',
    corFundo: '#FAF7F1', corEscura: '#0042AA', corPrimaria: '#E5A13C',
  },
  {
    nome: 'Sóbrio',
    descricao: 'Cinza-claro e índigo — neutro, para igrejas sem identidade definida.',
    corFundo: '#F6F8FA', corEscura: '#1E293B', corPrimaria: '#4F46E5',
  },
  {
    nome: 'Verde oliveira',
    descricao: 'Areia e verde profundo, com terracota nos destaques.',
    corFundo: '#F7F5EF', corEscura: '#14532D', corPrimaria: '#C2703D',
  },
  {
    nome: 'Vinho',
    descricao: 'Off-white e bordô, com âmbar nos destaques.',
    corFundo: '#FAF6F6', corEscura: '#6B1F2E', corPrimaria: '#D08C2E',
  },
]

/**
 * Cor de texto legível EM CIMA de uma cor de fundo.
 *
 * Existe porque a cor primária é livre: branco sobre um dourado claro
 * (#E5A13C) fica ilegível, e preto sobre um azul escuro também. O CSS não sabe
 * calcular luminância, então a decisão é feita aqui e vira uma variável.
 */
export function corDeContraste(hex: string): string {
  const l = luminanciaRelativa(hex)
  // Limiar 0.42: acima disso a cor é "clara" e pede texto escuro. Escolhido por
  // cima do dourado (~0.44) e por baixo do azul royal (~0.09).
  return l > 0.42 ? '#1A1206' : '#FFFFFF'
}

// Luminância relativa (WCAG 2.1), de 0 (preto) a 1 (branco).
function luminanciaRelativa(hex: string): number {
  const { r, g, b } = paraRgb(hex)
  const canal = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

function paraRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = Number.parseInt(h, 16)
  if (h.length !== 6 || Number.isNaN(n)) return { r: 0, g: 0, b: 0 } // cor inválida → trata como escura
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
