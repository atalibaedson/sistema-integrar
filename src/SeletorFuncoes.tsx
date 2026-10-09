import { PAPEL_COR, PAPEL_LABEL, rotuloPapel, type Papel } from './types'
import { PAPEL_DESC } from './papeis'

// Escolha de funções: cartões com a descrição (o mesmo padrão do cadastro de
// integrante). Sempre sobra ao menos uma função marcada.
export default function SeletorFuncoes({ papeis, onMudar }: { papeis: Papel[]; onMudar: (novos: Papel[]) => void }) {
  function alternar(p: Papel) {
    const novos = papeis.includes(p) ? papeis.filter((x) => x !== p) : [...papeis, p]
    if (novos.length === 0) return
    onMudar(novos)
  }
  return (
    <div className="wz-papeis eq-seletor">
      {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) => {
        const sel = papeis.includes(p)
        return (
          <button
            type="button" key={p} aria-pressed={sel}
            className={`wz-papel ${sel ? 'sel' : ''}`}
            onClick={() => alternar(p)}
            style={sel ? { borderColor: PAPEL_COR[p], background: `color-mix(in srgb, ${PAPEL_COR[p]} 9%, var(--surface))` } : undefined}
          >
            <span className="wz-papel-dot" style={{ background: PAPEL_COR[p] }} />
            <span className="wz-papel-txt">
              <b>{rotuloPapel(p)}</b>
              <small>{PAPEL_DESC[p]}</small>
            </span>
            <span className="wz-papel-check" style={sel ? { background: PAPEL_COR[p], borderColor: PAPEL_COR[p] } : undefined}>
              {sel ? '✓' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
