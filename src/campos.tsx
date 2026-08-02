// Componentes de formulário compartilhados pelo autocadastro (público) e pelo
// cadastro feito pela equipe — os dois seguem o mesmo padrão visual.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface OpcaoEscolha { v: string; rotulo: string }

/**
 * Grupo de opções em "pílulas" — usado para Sim/Não e listas curtas.
 * Melhor que um <select> quando as opções cabem na tela: um toque só, e a
 * resposta fica visível sem abrir menu (importante no celular, no corredor
 * da igreja). Clicar na opção já escolhida desmarca.
 */
export function Escolha({ valor, opcoes, onEscolher }: {
  valor: string
  opcoes: OpcaoEscolha[]
  onEscolher: (v: string) => void
}) {
  return (
    <div className="ac-opcoes">
      {opcoes.map((o) => (
        <button
          type="button" key={o.v}
          className={`ac-opcao ${valor === o.v ? 'sel' : ''}`}
          onClick={() => onEscolher(valor === o.v ? '' : o.v)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export const SIM_NAO: OpcaoEscolha[] = [{ v: 'sim', rotulo: 'Sim' }, { v: 'nao', rotulo: 'Não' }]

/* ---------------- Botão Salvar com confirmação ----------------
   Dá a segurança de "foi salvo?" que faltava: só grava ao clicar, e mostra
   "Salvo! ✓" por alguns segundos. Enquanto houver mudança pendente, avisa. */
export function BotaoSalvar({ pendente, onSalvar, rotulo = 'Salvar alterações' }: {
  pendente: boolean
  onSalvar: () => void
  rotulo?: string
}) {
  const [salvo, setSalvo] = useState(false)

  // Voltou a ter mudança pendente → esconde o "Salvo!"
  useEffect(() => { if (pendente) setSalvo(false) }, [pendente])

  function salvar() {
    onSalvar()
    setSalvo(true)
    window.setTimeout(() => setSalvo(false), 2500)
  }

  return (
    <div className="barra-salvar">
      <button type="button" className="btn" onClick={salvar} disabled={!pendente}>
        💾 {rotulo}
      </button>
      {salvo && <span className="salvar-ok">✓ Salvo!</span>}
      {!salvo && pendente && <span className="salvar-pend">Alterações não salvas</span>}
      {!salvo && !pendente && <span className="salvar-sync">Tudo salvo</span>}
    </div>
  )
}

/* ---------------- Seletor de data moderno ----------------
   Substitui o <input type="date"> nativo, cujo calendário abre sempre para
   baixo e some no fim da página. Este abre um popover posicionado com position
   fixed (não é cortado por containers com overflow) e vira para cima quando não
   há espaço embaixo. Visual do sistema, em pt-BR. Valor no formato yyyy-mm-dd. */

const DIAS_CURTOS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function parseIso(iso?: string): Date | null {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return null
  return new Date(a, m - 1, d)
}

function fmtBonito(iso?: string): string {
  const d = parseIso(iso)
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function SeletorData({ value, onChange, min, max, placeholder = 'dd/mm/aaaa', id, disabled, compacto }: {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  placeholder?: string
  id?: string
  disabled?: boolean
  compacto?: boolean // largura automática, para filtros inline (De/Até)
}) {
  const [aberto, setAberto] = useState(false)
  const [mesVisivel, setMesVisivel] = useState(() => parseIso(value) ?? new Date())
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; acima: boolean } | null>(null)

  // Ancora o popover ao gatilho; vira para cima quando falta espaço embaixo
  function recolocar() {
    if (!gatilhoRef.current) return
    const r = gatilhoRef.current.getBoundingClientRect()
    const alturaPop = 340
    const espacoAbaixo = window.innerHeight - r.bottom
    const acima = espacoAbaixo < alturaPop && r.top > espacoAbaixo
    const largura = 300
    let left = r.left
    if (left + largura > window.innerWidth - 8) left = window.innerWidth - largura - 8
    if (left < 8) left = 8
    setPos({ left, top: acima ? r.top : r.bottom, acima })
  }

  useLayoutEffect(() => { if (aberto) recolocar() }, [aberto])

  // Fecha ao clicar fora ou apertar Esc; ao rolar/redimensionar, reposiciona
  // (fechar no scroll dava problema: o scroll de foco ao abrir fechava na hora).
  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (gatilhoRef.current?.contains(e.target as Node)) return
      if (popRef.current?.contains(e.target as Node)) return
      setAberto(false)
    }
    function tecla(e: KeyboardEvent) { if (e.key === 'Escape') setAberto(false) }
    function acompanhar(e: Event) {
      if (popRef.current?.contains(e.target as Node)) return
      recolocar()
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', acompanhar, true)
    window.addEventListener('resize', acompanhar)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', acompanhar, true)
      window.removeEventListener('resize', acompanhar)
    }
  }, [aberto])

  function abrir() {
    if (disabled) return
    setMesVisivel(parseIso(value) ?? new Date())
    setAberto(true)
  }

  function escolher(d: Date) {
    onChange(isoLocal(d))
    setAberto(false)
  }

  // Grade do mês visível (começa no domingo)
  const ano = mesVisivel.getFullYear()
  const mes = mesVisivel.getMonth()

  // Intervalo de anos do seletor: usa min/max quando existem; senão, cobre um
  // range amplo (data de nascimento precisa voltar ~120 anos). Sempre inclui o
  // ano visível, para o valor do <select> nunca ficar sem opção.
  const anoHoje = new Date().getFullYear()
  const anoMin = Math.min(min ? Number(min.slice(0, 4)) : anoHoje - 120, ano)
  const anoMax = Math.max(max ? Number(max.slice(0, 4)) : anoHoje + 15, ano)
  const anos: number[] = []
  for (let a = anoMax; a >= anoMin; a--) anos.push(a) // mais recentes no topo

  const primeiro = new Date(ano, mes, 1)
  const inicioGrade = new Date(primeiro)
  inicioGrade.setDate(1 - primeiro.getDay())
  const dias: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicioGrade)
    d.setDate(inicioGrade.getDate() + i)
    dias.push(d)
  }

  const hojeIso = isoLocal(new Date())
  const selIso = value

  const desabilitada = (d: Date) => {
    const iso = isoLocal(d)
    if (min && iso < min) return true
    if (max && iso > max) return true
    return false
  }

  return (
    <>
      <button
        type="button" id={id} ref={gatilhoRef} onClick={abrir} disabled={disabled}
        className={`seletor-data ${compacto ? 'sd-compacto' : ''} ${aberto ? 'aberto' : ''} ${!value ? 'sd-vazio' : ''}`}
      >
        <span>{value ? fmtBonito(value) : placeholder}</span>
        <span className="seletor-data-ico" aria-hidden>📅</span>
      </button>

      {aberto && pos && (
        <div
          ref={popRef} className="cal-pop"
          style={{
            position: 'fixed', left: pos.left, width: 300,
            ...(pos.acima ? { bottom: window.innerHeight - pos.top + 6 } : { top: pos.top + 6 }),
          }}
        >
          <div className="cal-cab">
            <button type="button" className="cal-nav" onClick={() => setMesVisivel(new Date(ano, mes - 1, 1))} aria-label="Mês anterior">‹</button>
            <div className="cal-titulo">
              <select value={mes} onChange={(e) => setMesVisivel(new Date(ano, Number(e.target.value), 1))}>
                {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={ano} onChange={(e) => setMesVisivel(new Date(Number(e.target.value), mes, 1))}>
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <button type="button" className="cal-nav" onClick={() => setMesVisivel(new Date(ano, mes + 1, 1))} aria-label="Próximo mês">›</button>
          </div>

          <div className="cal-grade cal-semana">
            {DIAS_CURTOS.map((d, i) => <span key={i} className="cal-wd">{d}</span>)}
          </div>
          <div className="cal-grade">
            {dias.map((d, i) => {
              const iso = isoLocal(d)
              const foraMes = d.getMonth() !== mes
              const cls = [
                'cal-dia',
                foraMes ? 'fora' : '',
                iso === selIso ? 'sel' : '',
                iso === hojeIso ? 'hoje' : '',
              ].join(' ')
              return (
                <button
                  type="button" key={i} className={cls}
                  disabled={desabilitada(d)}
                  onClick={() => escolher(d)}
                >{d.getDate()}</button>
              )
            })}
          </div>

          <div className="cal-rodape">
            <button type="button" className="btn btn-sec btn-mini" onClick={() => escolher(new Date())}>Hoje</button>
            {value && <button type="button" className="btn btn-sec btn-mini" onClick={() => { onChange(''); setAberto(false) }}>Limpar</button>}
          </div>
        </div>
      )}
    </>
  )
}
