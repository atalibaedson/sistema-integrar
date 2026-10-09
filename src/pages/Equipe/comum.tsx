import type { CSSProperties } from 'react'
import { setEstado } from '../../store'
import { PAPEL_COR, PAPEL_LABEL, rotuloPapel, type AppState, type Papel, type Usuario } from '../../types'
import { PAPEL_DESC } from '../../papeis'
import { registrarAuditoria } from '../../auditoria'
import { criariCiclo } from '../../acesso'
import { toast } from '../../toast'

// Peças compartilhadas da tela Equipe (lista, hierarquia e gaveta de edição).

// Muda o supervisor de `alvo`, com validação de ciclo e registro em auditoria.
export function definirSupervisor(s: AppState, alvo: Usuario, novoSupervisorId: string) {
  if (novoSupervisorId && criariCiclo(s, alvo.id, novoSupervisorId)) {
    toast(`Não é possível: ${alvo.nome} já supervisiona (direta ou indiretamente) essa pessoa. Isso criaria um ciclo na hierarquia.`, 'erro')
    return
  }
  const novoSupervisor = s.usuarios.find((u) => u.id === novoSupervisorId)
  setEstado((st) => ({
    ...st,
    usuarios: st.usuarios.map((x) => x.id === alvo.id ? { ...x, supervisorId: novoSupervisorId || undefined } : x),
  }))
  registrarAuditoria('Alterou hierarquia', {
    alvoTipo: 'usuario', alvoId: alvo.id, alvoNome: alvo.nome,
    detalhe: novoSupervisor ? `Novo supervisor: ${novoSupervisor.nome}` : 'Removeu supervisor',
  })
}

// Gestão Integração e pastores ficam no topo da hierarquia: não precisam de supervisor.
export function ehTopo(u: Usuario): boolean {
  return u.papeis.includes('coordenacao') || u.papeis.includes('pastor')
}

// Supervisor que ainda existe e está ativo (um supervisor removido/desativado vale como "sem supervisor")
export function supervisorAtivo(s: AppState, u: Usuario): Usuario | undefined {
  if (!u.supervisorId) return undefined
  return s.usuarios.find((x) => x.id === u.supervisorId && x.ativo)
}

export function semSupervisor(s: AppState, u: Usuario): boolean {
  return u.ativo && !ehTopo(u) && !supervisorAtivo(s, u)
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome
}

// Funções da pessoa, cada uma com a sua cor (a cor entra por variável CSS para
// o tom se ajustar sozinho ao tema claro e ao escuro)
export function ChipsPapeis({ papeis }: { papeis: Papel[] }) {
  return (
    <span className="eq-chips">
      {papeis.map((p) => (
        <span key={p} className="eq-papel" style={{ '--c': PAPEL_COR[p] } as CSSProperties}>{rotuloPapel(p)}</span>
      ))}
    </span>
  )
}

// Situação do acesso (login) em uma etiqueta só — a mais importante para quem administra
export function ChipAcesso({ u }: { u: Usuario }) {
  if (!u.ativo) return <span className="painel-chip painel-chip-neutro">Inativo</span>
  switch (u.statusAcesso) {
    case 'aprovado': return <span className="painel-chip painel-chip-ok">Com acesso</span>
    case 'pendente_aprovacao': return <span className="painel-chip painel-chip-warn">Aguardando aprovação</span>
    case 'pendente_confirmacao_email': return <span className="painel-chip painel-chip-warn">Confirmando e-mail</span>
    case 'rejeitado': return <span className="painel-chip painel-chip-crit">Acesso recusado</span>
    default: return <span className="painel-chip painel-chip-neutro">Sem login</span>
  }
}

// Escolha de funções: cartões com a descrição (o mesmo padrão do cadastro de
// integrante). Sempre sobra ao menos uma função marcada.
export function SeletorFuncoes({ papeis, onMudar }: { papeis: Papel[]; onMudar: (novos: Papel[]) => void }) {
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
