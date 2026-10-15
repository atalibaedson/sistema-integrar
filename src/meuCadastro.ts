// O cadastro único da PRÓPRIA pessoa (fase B): termo, dados pessoais, estado civil e
// participação em Conexão. Grava SÓ a linha de quem está logado, com o token dela — as
// regras do banco do Check-iFE garantem isso (nunca a linha de outra pessoa). Os dados
// sensíveis (estado civil, conexão) só depois do aceite do termo (erro 42501 sem ele).
// Regras puras e mensagens: regras-cadastro-unico.ts.
import { useEffect, useSyncExternalStore } from 'react'
import { supabase, getSessaoReal } from './supabaseClient'
import { MODO_DEMO } from './demo'
import {
  lerSituacaoCU, linhaParticipacao, mensagemDoErroCU, pessoaDasLinhas,
  type PessoaCU, type SituacaoCU,
} from './regras-cadastro-unico'
import { carregarCadastroUnico } from './cadastroUnico'

export interface TermoCU { versao: string; html: string }
export interface ConexaoCU { igreja: string; igrejaNome: string; cidade?: string; id: string; nome: string; minha: boolean }
type Resultado = { ok: true } | { ok: false; erro: string }

// ---- demonstração (sem nuvem) ----
const demo = {
  termo: { versao: 'demo-1', html: '<div class="termo"><p><b>Cadastro único (demonstração).</b> Texto fictício do termo de privacidade.</p><ul><li>Seus dados valem nos sistemas da igreja.</li><li>Você pode corrigir quando quiser.</li></ul></div>' },
  situacao: { completo: false, falta: ['termo'], conexaoRemovida: false, camposPendentes: ['sexo', 'profissao'] } as SituacaoCU,
  pessoa: { userId: 'demo-auth', pessoaId: 'p-marcos', nome: 'Marcos Andrade', telefone: '00900000001', dataNascimento: '1980-04-12', estadoCivil: 'casado' } as PessoaCU,
}

export async function lerTermo(): Promise<TermoCU | null> {
  if (MODO_DEMO) return demo.termo
  if (!supabase) return null
  const { data, error } = await supabase.rpc('checkife_termo')
  const t = data as { versao?: unknown; html?: unknown } | null
  return !error && t && typeof t.versao === 'string' && typeof t.html === 'string' ? { versao: t.versao, html: t.html } : null
}

export async function aceitarTermo(versao: string): Promise<Resultado> {
  if (MODO_DEMO) { demo.situacao = { ...demo.situacao, falta: demo.situacao.falta.filter((f) => f !== 'termo') }; await recarregarSituacao(); return { ok: true } }
  if (!supabase) return { ok: false, erro: 'Sem conexão com a nuvem.' }
  const { error } = await supabase.rpc('checkife_aceitar_termo', { p_versao: versao })
  if (error) return { ok: false, erro: mensagemDoErroCU(error) }
  await recarregarSituacao()
  return { ok: true }
}

export async function lerMeuCadastro(): Promise<PessoaCU | null> {
  if (MODO_DEMO) return demo.pessoa
  const eu = getSessaoReal()?.userId
  if (!supabase || !eu) return null
  const { data: p } = await supabase.from('pessoas').select('id,user_id,nome,email,telefone,data_nascimento,ativo').eq('user_id', eu).maybeSingle()
  if (!p) return null
  const ler = (cols: string) => supabase!.from('pessoas_sensivel').select(cols).eq('pessoa_id', (p as { id: string }).id).maybeSingle()
  let r: { data: unknown; error: unknown } = await ler('estado_civil,conexao_situacao,conexao_codigo,conexao_igreja')
  if (r.error) r = await ler('estado_civil,conexao_situacao,conexao_codigo')
  return pessoaDasLinhas(p as Record<string, unknown>, (r.data ?? undefined) as Record<string, unknown> | undefined)
}

/** Nome, telefone e nascimento (tabela `pessoas`): não dependem do termo. */
export async function salvarMeusDados(d: { nome: string; telefone: string; dataNascimento?: string }): Promise<Resultado> {
  if (MODO_DEMO) { demo.pessoa = { ...demo.pessoa, nome: d.nome, telefone: d.telefone, dataNascimento: d.dataNascimento }; return { ok: true } }
  const eu = getSessaoReal()?.userId
  if (!supabase || !eu) return { ok: false, erro: 'Entre na sua conta para salvar.' }
  const { data, error } = await supabase.from('pessoas')
    .update({ nome: d.nome.trim(), telefone: d.telefone.replace(/\D/g, ''), data_nascimento: d.dataNascimento || null })
    .eq('user_id', eu).select('id')
  if (error) return { ok: false, erro: mensagemDoErroCU(error) }
  if (!data || data.length === 0) return { ok: false, erro: mensagemDoErroCU({ code: 'P0002' }) }
  void carregarCadastroUnico([eu], eu, true)
  return { ok: true }
}

/** Estado civil e Conexão (tabela `pessoas_sensivel`): só depois do aceite do termo. */
export async function salvarMinhaParticipacao(pessoaId: string, d: { estadoCivil?: string; conexao: string; igreja: string }): Promise<Resultado> {
  if (MODO_DEMO) { demo.situacao = { ...demo.situacao, falta: demo.situacao.falta.filter((f) => f !== 'conexao') }; await recarregarSituacao(); return { ok: true } }
  if (!supabase) return { ok: false, erro: 'Sem conexão com a nuvem.' }
  const linha = { ...linhaParticipacao(pessoaId, d.conexao, d.igreja), estado_civil: d.estadoCivil || null }
  const { error } = await supabase.from('pessoas_sensivel').upsert(linha, { onConflict: 'pessoa_id' })
  if (error) return { ok: false, erro: mensagemDoErroCU(error) }
  const eu = getSessaoReal()?.userId
  if (eu) void carregarCadastroUnico([eu], eu, true)
  await recarregarSituacao()
  return { ok: true }
}

/** Conexões das igrejas (as da pessoa primeiro) — lista pública do Check-iFE. */
export async function listarConexoesCU(): Promise<ConexaoCU[]> {
  if (!supabase || MODO_DEMO) return []
  const { data, error } = await supabase.rpc('checkife_conexoes_todas')
  if (error || !Array.isArray(data)) return []
  return (data as Record<string, unknown>[])
    .filter((c) => typeof c.id === 'string' && typeof c.igreja === 'string')
    .map((c) => ({
      igreja: c.igreja as string, igrejaNome: String(c.igreja_nome ?? c.igreja), cidade: typeof c.cidade === 'string' ? c.cidade : undefined,
      id: c.id as string, nome: String(c.nome ?? ''), minha: c.minha === true,
    }))
}

/** A liderança muda a conexão de alguém (o Check-iFE confere: admin, ou pastor/integração da mesma igreja). */
export async function definirConexaoDe(userId: string, codigo: string, igreja: string): Promise<Resultado> {
  if (MODO_DEMO) return { ok: true }
  if (!supabase) return { ok: false, erro: 'Sem conexão com a nuvem.' }
  const { error } = await supabase.rpc('checkife_definir_conexao', { p_user_id: userId, p_codigo: codigo, p_igreja: codigo === 'nenhuma' ? null : igreja })
  if (error) return { ok: false, erro: mensagemDoErroCU(error) }
  void carregarCadastroUnico([userId], getSessaoReal()?.userId, true)
  return { ok: true }
}

/**
 * O termo vem do Check-iFE (texto fixo dele: só div, p, b, i, h4, ul, li e class). Mesmo assim,
 * limpamos aqui antes de exibir: fica só o que está nessa lista, sem atributos além de class.
 */
const TAGS_DO_TERMO = new Set(['DIV', 'P', 'B', 'I', 'H4', 'UL', 'LI', 'STRONG', 'EM', 'BR'])
export function limparTermo(html: string): string {
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const limpar = (no: Element) => {
    for (const filho of [...no.children]) {
      if (!TAGS_DO_TERMO.has(filho.tagName)) { filho.replaceWith(doc.createTextNode(filho.textContent ?? '')); continue }
      for (const a of [...filho.attributes]) if (a.name !== 'class') filho.removeAttribute(a.name)
      limpar(filho)
    }
  }
  const raiz = doc.body.firstElementChild as Element
  limpar(raiz)
  return raiz.innerHTML
}

// ---- situação (para o aviso "complete o seu cadastro") ----
let situacao: { carregado: boolean; valor: SituacaoCU | null } = { carregado: false, valor: null }
let pedindo: Promise<void> | null = null
const ouvintes = new Set<() => void>()

export function recarregarSituacao(): Promise<void> {
  if (pedindo) return pedindo
  const p: Promise<void> = (async () => {
    if (MODO_DEMO) { situacao = { carregado: true, valor: { ...demo.situacao } }; return }
    if (!supabase || !getSessaoReal()) { situacao = { carregado: true, valor: null }; return }
    const { data, error } = await supabase.rpc('checkife_cadastro_completo')
    situacao = { carregado: true, valor: error ? null : lerSituacaoCU(data) }
  })()
    .catch(() => { situacao = { carregado: true, valor: null } })
    // .finally roda DEPOIS desta atribuição (mesmo quando a consulta termina na hora): nunca fica "preso"
    .finally(() => { if (pedindo === p) pedindo = null; ouvintes.forEach((f) => f()) })
  pedindo = p
  return p
}

/** Situação do cadastro único de quem está logado (uma consulta por sessão; recarrega depois de salvar). */
export function useSituacaoCadastroUnico(): { carregado: boolean; valor: SituacaoCU | null } {
  const s = useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, () => situacao)
  useEffect(() => { if (!s.carregado) void recarregarSituacao() }, [s.carregado])
  return s
}

supabase?.auth.onAuthStateChange((evento) => {
  if (evento === 'SIGNED_OUT' || evento === 'SIGNED_IN') { situacao = { carregado: false, valor: null }; ouvintes.forEach((f) => f()) }
})
