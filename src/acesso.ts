// Controle de acesso por hierarquia.
// A identidade atual pode vir de duas origens, em paralelo:
//  1. o seletor "Vendo como" (modo aberto, sem senha — equipe legada);
//  2. o login real (Supabase Auth), que só define a identidade após a conta
//     estar com statusAcesso 'aprovado' (ver App.tsx).
// As regras de visibilidade abaixo valem igualmente para as duas origens.
import { useSyncExternalStore } from 'react'
import type { AppState, Papel, Usuario, Visitante } from './types'
import { assinarSessao, getSessaoCarregada, getSessaoReal, type SessaoReal } from './supabaseClient'

const CHAVE = 'ife-usuario-atual'
let atualId: string | null = localStorage.getItem(CHAVE)
const ouvintes = new Set<() => void>()

export function getUsuarioAtualId(): string | null {
  return atualId
}

export function setUsuarioAtualId(id: string | null) {
  atualId = id
  if (id) localStorage.setItem(CHAVE, id)
  else localStorage.removeItem(CHAVE)
  ouvintes.forEach((f) => f())
}

export function useUsuarioAtualId(): string | null {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb) },
    () => atualId,
  )
}

export function usuarioAtual(s: AppState, id: string | null): Usuario | undefined {
  return s.usuarios.find((u) => u.id === id && u.ativo)
}

// 'a' está acima de 'b' na cadeia de supervisão? (transitivo, à prova de ciclo)
export function supervisiona(s: AppState, aId: string, bId: string): boolean {
  let cur = s.usuarios.find((u) => u.id === bId)
  const visto = new Set<string>()
  while (cur?.supervisorId && !visto.has(cur.id)) {
    visto.add(cur.id)
    if (cur.supervisorId === aId) return true
    cur = s.usuarios.find((u) => u.id === cur!.supervisorId)
  }
  return false
}

// Definir `novoSupervisorId` como supervisor de `uId` criaria um loop?
// (verdadeiro se novoSupervisorId já está, hoje, abaixo de uId na cadeia)
export function criariCiclo(s: AppState, uId: string, novoSupervisorId: string): boolean {
  if (uId === novoSupervisorId) return true
  return supervisiona(s, uId, novoSupervisorId)
}

// A pessoa exerce alguma das funções indicadas?
export function temPapel(u: Usuario | undefined, ...papeis: Papel[]): boolean {
  return !!u && papeis.some((p) => u.papeis.includes(p))
}

// Gestão Integração e pastores enxergam tudo
export function papelVeTudo(u?: Usuario): boolean {
  return temPapel(u, 'coordenacao', 'pastor')
}

// ---- Acesso a PÁGINAS (fonte única da verdade) ----
// Rotas NÃO listadas são livres para toda a equipe. As listadas exigem um dos
// papéis indicados. No modo aberto (sem identidade escolhida) as restritas ficam
// ocultas — para acessá-las, entre como Pastor/Gestão Integração (login ou
// "Vendo como"). Este mapa governa o menu E o bloqueio de rota, juntos.
export const ACESSO_ROTA: { prefixo: string; papeis: Papel[] }[] = [
  { prefixo: '/aprovacoes', papeis: ['pastor', 'coordenacao'] },
  { prefixo: '/relatorios', papeis: ['pastor', 'coordenacao'] },
  { prefixo: '/auditoria', papeis: ['pastor', 'coordenacao'] },
  { prefixo: '/config', papeis: ['pastor', 'coordenacao'] },
  { prefixo: '/equipe', papeis: ['pastor', 'coordenacao'] },
  { prefixo: '/lideres', papeis: ['pastor', 'coordenacao', 'lider'] },
]

// Acolhedor "puro" (só cadastra visitantes no culto): em vez do modelo de
// deny-list acima, ele tem uma allow-list — só o formulário de cadastro e a
// ajuda. Como uma pessoa pode ter vários papéis, quem for acolhedor + algo mais
// segue as regras normais (a união das permissões dos seus papéis).
const ROTAS_ACOLHEDOR = ['/novo', '/ajuda']

export function soAcolhedor(u: Usuario | undefined): boolean {
  return !!u && u.papeis.includes('acolhedor') && u.papeis.every((p) => p === 'acolhedor')
}

export function podeAcessarRota(rota: string, u: Usuario | undefined): boolean {
  if (soAcolhedor(u)) {
    return ROTAS_ACOLHEDOR.some((r) => rota === r || rota.startsWith(r + '/'))
  }
  const regra = ACESSO_ROTA.find((r) => rota === r.prefixo || rota.startsWith(r.prefixo + '/'))
  if (!regra) return true // rota livre para a equipe
  return temPapel(u, ...regra.papeis)
}

// Regra central: quem pode ver a ficha (e as conversas) de um visitante.
// Sem identidade escolhida = modo aberto (fase de teste não bloqueia ninguém).
export function podeVerVisitante(s: AppState, u: Usuario | undefined, v: Visitante): boolean {
  if (!u) return true
  if (papelVeTudo(u)) return true
  // está no fluxo: responsável direto ou líder designado
  if (v.responsavelId === u.id) return true
  if (v.liderConexaoId === u.id) return true
  // líder (ou 2º líder) do grupo de destino
  const conexao = s.conexoes.find((c) => c.id === v.conexaoId)
  if (conexao?.liderId === u.id || conexao?.lider2Id === u.id) return true
  // "líder acima": supervisiona quem está no fluxo
  if (v.responsavelId && supervisiona(s, u.id, v.responsavelId)) return true
  if (v.liderConexaoId && supervisiona(s, u.id, v.liderConexaoId)) return true
  return false
}

// Cuidado/crise é o dado mais sensível: só pastor + o responsável direto.
export function podeVerCuidado(s: AppState, u: Usuario | undefined, v: Visitante): boolean {
  if (!u) return true
  if (temPapel(u, 'pastor')) return true
  if (v.responsavelId === u.id) return true
  return false
}

// Lista de visitantes que a identidade atual pode ver
export function visitantesVisiveis(s: AppState, u: Usuario | undefined): Visitante[] {
  return s.visitantes.filter((v) => podeVerVisitante(s, u, v))
}

// ---- Sessão real (login com senha via Supabase Auth) ----
// Sessões anônimas (criadas só para o RLS do sync) NÃO contam como login.
export function useSessaoReal(): SessaoReal | null {
  return useSyncExternalStore(assinarSessao, getSessaoReal)
}

// A verificação inicial da sessão (restaurar a persistida) já terminou?
// Enquanto false, o app mostra um "carregando" em vez de piscar a tela de login.
export function useSessaoCarregada(): boolean {
  return useSyncExternalStore(assinarSessao, getSessaoCarregada)
}

// Encontra o Usuario ligado a uma sessão real (por authUserId ou e-mail)
export function usuarioDaSessao(s: AppState, sessao: SessaoReal | null): Usuario | undefined {
  if (!sessao) return undefined
  return (
    s.usuarios.find((u) => u.authUserId === sessao.userId) ??
    s.usuarios.find((u) => !!sessao.email && (u.email ?? '').trim().toLowerCase() === sessao.email.toLowerCase())
  )
}
