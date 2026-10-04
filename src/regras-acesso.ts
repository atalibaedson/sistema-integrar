// Regras de acesso PURAS (sem navegador): quem supervisiona quem, quem vê qual
// ficha. Ficam separadas de acesso.ts (que lê localStorage e a sessão) para que
// o servidor — a função que envia os avisos por push — use exatamente as mesmas
// regras. Uma cópia deste arquivo vai para supabase/functions/_shared (ver
// scripts/sincronizar-servidor.mjs). Mantenha-o sem imports de navegador.
import type { AppState, Papel, Usuario, Visitante } from './types'

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

// Regra central: quem pode ver a ficha (e as conversas) de um visitante.
// Sem identidade (sessão ainda alinhando, conta desativada) = não vê nada. O
// antigo "modo aberto" liberava tudo neste caso — com login obrigatório isso
// deixava uma conta desativada enxergando todos os visitantes.
export function podeVerVisitante(s: AppState, u: Usuario | undefined, v: Visitante): boolean {
  if (!u) return false
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
  if (!u) return false
  if (temPapel(u, 'pastor')) return true
  if (v.responsavelId === u.id) return true
  return false
}
