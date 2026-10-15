// Leitura do cadastro único (Check-iFE) — etapa 2, fase A. As regras de quem lê o quê
// são do banco do Check-iFE: aqui só pedimos em lote e guardamos em MEMÓRIA (não vai para
// o aparelho: são dados pessoais de terceiros), com a hora da leitura. Se não vier nada,
// as telas usam a ficha do Integrar (reserva). Regras puras: regras-cadastro-unico.ts.
import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabaseClient'
import { MODO_DEMO, CADASTRO_UNICO_DEMO } from './demo'
import { avaliarLeitura, pessoaDasLinhas, type PessoaCU, type SituacaoLeitura } from './regras-cadastro-unico'

export type EstadoLeitura = 'desligado' | 'carregando' | 'indisponivel' | SituacaoLeitura

interface Cache {
  pessoas: Map<string, PessoaCU> // por conta (authUserId)
  pedidas: Set<string>
  estado: EstadoLeitura
  lidoEm?: string
}

const VALIDADE_MS = 5 * 60_000
const LOTE = 150
let cache: Cache = { pessoas: new Map(), pedidas: new Set(), estado: supabase || MODO_DEMO ? 'carregando' : 'desligado' }
let lidoEmMs = 0
let emCurso: Promise<void> | null = null
const ouvintes = new Set<() => void>()

function publicar(c: Partial<Cache>) {
  cache = { ...cache, ...c }
  ouvintes.forEach((f) => f())
}

async function lerLote(ids: string[]): Promise<PessoaCU[] | null> {
  if (MODO_DEMO) {
    return CADASTRO_UNICO_DEMO
      .filter((p) => ids.includes(p.user_id as string))
      .map((p) => pessoaDasLinhas(p, p._s as Record<string, unknown>))
      .filter((p): p is PessoaCU => !!p)
  }
  if (!supabase) return null
  const { data: pessoas, error } = await supabase
    .from('pessoas').select('id,user_id,nome,email,telefone,data_nascimento,ativo').in('user_id', ids)
  if (error) return null
  const linhas = (pessoas ?? []) as Record<string, unknown>[]
  const pessoaIds = linhas.map((p) => p.id as string)
  const sensivel = new Map<string, Record<string, unknown>>()
  if (pessoaIds.length > 0) {
    const colunas = 'pessoa_id,estado_civil,conexao_situacao,conexao_codigo'
    const ler = (cols: string) => supabase!.from('pessoas_sensivel').select(cols).in('pessoa_id', pessoaIds)
    let r: { data: unknown; error: unknown } = await ler(`${colunas},conexao_igreja`)
    // antes da migration 0025 do Check-iFE não existe conexao_igreja: lê sem ela
    if (r.error) r = await ler(colunas)
    for (const s of ((r.data ?? []) as Record<string, unknown>[])) sensivel.set(s.pessoa_id as string, s)
  }
  return linhas.map((p) => pessoaDasLinhas(p, sensivel.get(p.id as string))).filter((p): p is PessoaCU => !!p)
}

/** Lê (ou relê, se a leitura passou da validade ou há contas novas) o cadastro único destas contas. */
export function carregarCadastroUnico(ids: string[], minhaConta?: string, forcar = false): Promise<void> {
  if (!supabase && !MODO_DEMO) return Promise.resolve()
  const unicos = [...new Set(ids.filter(Boolean))]
  const novas = unicos.filter((id) => !cache.pedidas.has(id))
  const venceu = Date.now() - lidoEmMs > VALIDADE_MS
  if (!forcar && !venceu && novas.length === 0) return emCurso ?? Promise.resolve()
  if (emCurso) return emCurso
  const pedir = forcar || venceu ? [...new Set([...cache.pedidas, ...unicos])] : novas
  if (pedir.length === 0) return Promise.resolve()
  emCurso = (async () => {
    try {
      const recebidas: PessoaCU[] = []
      for (let i = 0; i < pedir.length; i += LOTE) {
        const lote = await lerLote(pedir.slice(i, i + LOTE))
        if (!lote) { publicar({ estado: cache.pessoas.size > 0 ? cache.estado : 'indisponivel' }); return }
        recebidas.push(...lote)
      }
      const pessoas = new Map(cache.pessoas)
      for (const id of pedir) pessoas.delete(id)
      for (const p of recebidas) pessoas.set(p.userId, p)
      const pedidas = new Set([...cache.pedidas, ...pedir])
      lidoEmMs = Date.now()
      publicar({
        pessoas, pedidas, lidoEm: new Date(lidoEmMs).toISOString(),
        estado: avaliarLeitura([...pedidas], [...pessoas.keys()], minhaConta),
      })
    } catch {
      publicar({ estado: cache.pessoas.size > 0 ? cache.estado : 'indisponivel' })
    } finally {
      emCurso = null
    }
  })()
  return emCurso
}

function assinar(f: () => void) {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

/** Cadastro único das contas indicadas (lê em lote na primeira vez e a cada 5 minutos). */
export function useCadastroUnico(ids: (string | undefined)[], minhaConta?: string): Cache {
  const c = useSyncExternalStore(assinar, () => cache)
  const chave = [...new Set(ids.filter((x): x is string => !!x))].sort().join(',')
  useEffect(() => {
    if (chave) void carregarCadastroUnico(chave.split(','), minhaConta)
  }, [chave, minhaConta])
  return c
}

/** Ao sair da conta, nada de dados de outras pessoas fica na memória. */
export function esquecerCadastroUnico() {
  lidoEmMs = 0
  publicar({ pessoas: new Map(), pedidas: new Set(), estado: supabase || MODO_DEMO ? 'carregando' : 'desligado', lidoEm: undefined })
}

supabase?.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT') esquecerCadastroUnico() })

/** Quem respondeu "ainda não participo de uma Conexão" (só as pessoas que as regras do Check-iFE deixam ver). */
export async function listarSemConexao(): Promise<PessoaCU[] | null> {
  if (MODO_DEMO) {
    return CADASTRO_UNICO_DEMO
      .filter((p) => (p._s as Record<string, unknown>)?.conexao_situacao === 'nao_participa')
      .map((p) => pessoaDasLinhas(p, p._s as Record<string, unknown>))
      .filter((p): p is PessoaCU => !!p)
  }
  if (!supabase) return null
  const { data: sens, error } = await supabase.from('pessoas_sensivel').select('pessoa_id,conexao_situacao').eq('conexao_situacao', 'nao_participa').limit(1000)
  if (error) return null
  const ids = ((sens ?? []) as { pessoa_id: string }[]).map((x) => x.pessoa_id)
  if (ids.length === 0) return []
  const r: PessoaCU[] = []
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data } = await supabase.from('pessoas').select('id,user_id,nome,email,telefone,data_nascimento,ativo').in('id', ids.slice(i, i + LOTE))
    for (const p of (data ?? []) as Record<string, unknown>[]) {
      // pessoa sem conta (user_id nulo) também aparece: o userId fica vazio
      const pessoa = pessoaDasLinhas({ ...p, user_id: p.user_id ?? '' }, { conexao_situacao: 'nao_participa' }) ??
        (typeof p.id === 'string' ? { userId: '', pessoaId: p.id, nome: p.nome as string | undefined, telefone: p.telefone as string | undefined, email: p.email as string | undefined, conexaoSituacao: 'nao_participa' as const } : null)
      if (pessoa && pessoa.ativo !== false) r.push(pessoa)
    }
  }
  return r.sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))
}
