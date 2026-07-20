// Sincronização online via Supabase (REST/PostgREST, sem dependências)
// Fase 1: o estado inteiro é salvo como um registro JSON por igreja.
// A gravação é precedida de leitura + mesclagem registro a registro (ver
// mesclar.ts), então vários computadores podem cadastrar ao mesmo tempo sem
// que um sobrescreva os dados do outro. A fase 2 (login + tabelas por
// entidade) continua sendo o caminho para escala maior.
import type { AppState } from './types'

export interface ConfigNuvem {
  url: string // https://xxxx.supabase.co
  anonKey: string
  igrejaId: string // identificador da igreja (ex.: "ife-matriz")
}

const CHAVE = 'ife-nuvem-v1'

// Configuração embutida da igreja: já vem conectada, sem o usuário digitar nada.
// Para vender a outra igreja, troque estes 3 valores e gere um novo build.
// (A chave "publishable" é feita para ir no navegador; a proteção real vem na
// fase 2 com login por usuário.)
export const CONFIG_NUVEM_EMBUTIDA: ConfigNuvem | null = {
  url: 'https://yzexsklhixqcbmnbrtdl.supabase.co',
  anonKey: 'sb_publishable_xhm2rRyVeP-KPXdCNXbawQ_zn8sTfX-',
  igrejaId: 'minha-igreja',
}

// Sentinela para o caso do usuário desconectar de propósito num build embutido
const DESLIGADA = '__desligada__'

export function getConfigNuvem(): ConfigNuvem | null {
  try {
    const raw = localStorage.getItem(CHAVE)
    if (raw === DESLIGADA) return null
    if (raw) {
      const c = JSON.parse(raw) as ConfigNuvem
      if (c.url && c.anonKey && c.igrejaId) return c
    }
  } catch {
    // config corrompida: ignora
  }
  // Sem config salva → usa a embutida (app já nasce conectado)
  return CONFIG_NUVEM_EMBUTIDA
}

export function setConfigNuvem(c: ConfigNuvem | null) {
  if (c) localStorage.setItem(CHAVE, JSON.stringify(c))
  else if (CONFIG_NUVEM_EMBUTIDA) localStorage.setItem(CHAVE, DESLIGADA) // suprime a embutida
  else localStorage.removeItem(CHAVE)
}

// Token da sessão Supabase Auth (anônima ou real), injetado pelo
// supabaseClient.ts. Com o RLS "somente autenticado" ativo no banco, é ele
// que autoriza as leituras/gravações do sync.
let tokenSessao: string | null = null
export function setTokenSessao(token: string | null) {
  tokenSessao = token
}

function cabecalhos(c: ConfigNuvem): Record<string, string> {
  const h: Record<string, string> = {
    apikey: c.anonKey,
    'Content-Type': 'application/json',
  }
  if (tokenSessao) h.Authorization = `Bearer ${tokenSessao}`
  // Chave legada (JWT, começa com "eyJ") também vai no Authorization;
  // as novas chaves (sb_publishable_...) usam apenas o cabeçalho apikey.
  else if (c.anonKey.startsWith('eyJ')) h.Authorization = `Bearer ${c.anonKey}`
  return h
}

function base(c: ConfigNuvem): string {
  // Aceita a URL colada de qualquer forma: remove barra final e um
  // "/rest/v1" que o usuário possa ter copiado junto (o código já o adiciona).
  return c.url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
}

// Extrai a mensagem de erro que o Supabase devolve, para diagnóstico claro
async function erroSupabase(r: Response, acao: string): Promise<Error> {
  let detalhe = ''
  try {
    const corpo = await r.json()
    detalhe = corpo?.message || corpo?.hint || corpo?.error || JSON.stringify(corpo)
  } catch {
    detalhe = await r.text().catch(() => '')
  }
  return new Error(`Erro ${r.status} ao ${acao}${detalhe ? `: ${detalhe}` : ''}`)
}

export async function baixarEstado(c: ConfigNuvem): Promise<AppState | null> {
  let r: Response
  try {
    r = await fetch(
      `${base(c)}/rest/v1/estados?igreja_id=eq.${encodeURIComponent(c.igrejaId)}&select=dados`,
      { headers: cabecalhos(c) },
    )
  } catch {
    throw new Error('Falha de rede: verifique a URL do projeto (deve começar com https:// e terminar em .supabase.co) e sua conexão.')
  }
  if (!r.ok) throw await erroSupabase(r, 'ler da nuvem')
  const linhas: { dados: AppState }[] = await r.json()
  return linhas[0]?.dados ?? null
}

export async function enviarEstado(c: ConfigNuvem, dados: AppState): Promise<void> {
  let r: Response
  try {
    r = await fetch(`${base(c)}/rest/v1/estados`, {
      method: 'POST',
      headers: { ...cabecalhos(c), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ igreja_id: c.igrejaId, dados, atualizado_em: new Date().toISOString() }),
    })
  } catch {
    throw new Error('Falha de rede ao gravar: verifique a URL do projeto e sua conexão.')
  }
  if (!r.ok) throw await erroSupabase(r, 'gravar na nuvem')
}
