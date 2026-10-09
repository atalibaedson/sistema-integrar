import { useAppState } from '../../store'
import { PAPEL_COR, rotuloPapel, type Usuario } from '../../types'
import { IcoAlerta, IcoUsuarios } from '../../icones'
import Avatar from '../../Avatar'
import { ChipsPapeis, definirSupervisor, ehTopo, semSupervisor, supervisorAtivo } from './comum'

// Quem supervisiona quem, em árvore. O supervisor também enxerga o
// acompanhamento de quem está abaixo dele; a liderança define isso aqui.
export default function Hierarquia({ onAbrir }: { onAbrir: (u: Usuario) => void }) {
  const s = useAppState()
  const ativos = s.usuarios.filter((u) => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  // filhos por supervisor (só quem tem supervisor ativo entra numa árvore; os demais são raízes)
  const filhos = new Map<string, Usuario[]>()
  const raizes: Usuario[] = []
  for (const u of ativos) {
    const sup = supervisorAtivo(s, u)
    if (sup && sup.id !== u.id) {
      const arr = filhos.get(sup.id)
      if (arr) arr.push(u)
      else filhos.set(sup.id, [u])
    } else {
      raizes.push(u)
    }
  }
  // Gestão e pastores primeiro; quem está "solto" (sem supervisor) logo depois
  raizes.sort((a, b) => Number(ehTopo(b)) - Number(ehTopo(a)) || a.nome.localeCompare(b.nome, 'pt-BR'))

  // Todos abaixo de alguém (para não oferecer como supervisor quem criaria um ciclo)
  function descendentes(id: string, acc = new Set<string>()): Set<string> {
    for (const f of filhos.get(id) ?? []) {
      if (!acc.has(f.id)) { acc.add(f.id); descendentes(f.id, acc) }
    }
    return acc
  }

  const soltos = ativos.filter((u) => semSupervisor(s, u)).length

  // Função comum (e não componente) de propósito: ela roda na hora, em ordem, e
  // marca `vistos` — assim dado legado em ciclo (ninguém seria raiz) não faz
  // ninguém aparecer duas vezes nem sumir.
  const vistos = new Set<string>()
  function no(u: Usuario, nivel: number): JSX.Element {
    vistos.add(u.id)
    const abaixo = (filhos.get(u.id) ?? []).filter((f) => !vistos.has(f.id))
    const proibidos = descendentes(u.id)
    const solto = semSupervisor(s, u)
    return (
      <li className="eq-no" key={u.id}>
        <div className={`eq-no-linha ${nivel === 0 ? 'raiz' : ''}`}>
          <button type="button" className="eq-no-pessoa" onClick={() => onAbrir(u)} title="Abrir ficha">
            <Avatar nome={u.nome} tom={PAPEL_COR[u.papeis[0]]} tamanho="p" foto={u.fotoUrl} />
            <span className="eq-no-nome">
              <b>{u.nome}</b>
              <ChipsPapeis papeis={u.papeis} />
            </span>
          </button>
          <span className="eq-no-meta">
            {(filhos.get(u.id)?.length ?? 0) > 0 && (
              <span className="eq-no-n"><IcoUsuarios size={12} /> {filhos.get(u.id)!.length}</span>
            )}
            {solto && <span className="painel-chip painel-chip-warn">Sem supervisor</span>}
          </span>
          <label className="eq-no-sup">
            <span>Supervisor</span>
            <select
              value={u.supervisorId ?? ''}
              aria-label={`Supervisor de ${u.nome}`}
              onChange={(e) => definirSupervisor(s, u, e.target.value)}
            >
              <option value="">{ehTopo(u) ? '— topo da hierarquia —' : '— ninguém —'}</option>
              {ativos.filter((x) => x.id !== u.id && !proibidos.has(x.id)).map((x) => (
                <option key={x.id} value={x.id}>{x.nome} · {x.papeis.map((p) => rotuloPapel(p)).join(', ')}</option>
              ))}
            </select>
          </label>
        </div>
        {abaixo.length > 0 && (
          <ul className="eq-filhos">
            {abaixo.map((f) => no(f, nivel + 1))}
          </ul>
        )}
      </li>
    )
  }

  const arvore = raizes.map((u) => no(u, 0))
  const orfaos = ativos.filter((u) => !vistos.has(u.id)).map((u) => no(u, 0)) // só com dado legado em ciclo

  return (
    <div className="eq-hier">
      <p className="descricao-secao">
        Defina a quem cada pessoa responde. O <b>supervisor</b> também enxerga o acompanhamento de quem está abaixo dele —
        você controla isso, nada vem fixo no sistema. Integradores pós-culto novos já entram supervisionados pela Gestão Integração.
      </p>
      {soltos > 0 && (
        <div className="alerta alerta-warn">
          <IcoAlerta size={16} />
          <div><b>{soltos} {soltos === 1 ? 'pessoa' : 'pessoas'} sem supervisor</b> — {soltos === 1 ? 'ela só vê' : 'elas só veem'} o próprio fluxo. Escolha o supervisor ao lado de cada nome.</div>
        </div>
      )}
      <div className="card eq-arvore">
        {ativos.length === 0 ? (
          <div className="painel-vazio">Nenhuma pessoa ativa na equipe.</div>
        ) : (
          <ul className="eq-nos">{arvore}{orfaos}</ul>
        )}
      </div>
    </div>
  )
}
