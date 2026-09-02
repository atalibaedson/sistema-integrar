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
export function temTokenSessao(): boolean {
  return tokenSessao !== null
}

// Sinal de que a sessão do Supabase Auth já foi verificada/criada no boot.
// O sync ESPERA por ele antes da primeira leitura: sem token, o RLS "somente
// autenticado" devolve uma lista VAZIA (não um erro) — e o app entenderia
// "nuvem vazia" e sobrescreveria os dados da igreja com os deste aparelho.
let sessaoPronta = false
let resolverSessaoPronta: () => void = () => {}
const promessaSessaoPronta = new Promise<void>((res) => { resolverSessaoPronta = res })
export function marcarSessaoPronta() {
  sessaoPronta = true
  resolverSessaoPronta()
}
export function esperarSessaoPronta(limiteMs = 8000): Promise<void> {
  if (sessaoPronta) return Promise.resolve()
  return Promise.race([promessaSessaoPronta, new Promise<void>((r) => setTimeout(r, limiteMs))])
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

// Leitura com a "versão" da linha (o carimbo atualizado_em). A versão é o que
// permite a gravação condicional: só grava se ninguém escreveu entre a leitura
// e o envio — sem isso, o sync de um aparelho podia apagar um cadastro que o
// servidor (autocadastro público) tinha acabado de anexar.
export interface EstadoRemoto {
  dados: AppState
  versao: string // atualizado_em, exatamente como o banco devolveu
}

export async function baixarEstadoComVersao(c: ConfigNuvem): Promise<EstadoRemoto | null> {
  let r: Response
  try {
    r = await fetch(
      `${base(c)}/rest/v1/estados?igreja_id=eq.${encodeURIComponent(c.igrejaId)}&select=dados,atualizado_em`,
      { headers: cabecalhos(c) },
    )
  } catch {
    throw new Error('Falha de rede: verifique a URL do projeto (deve começar com https:// e terminar em .supabase.co) e sua conexão.')
  }
  if (!r.ok) throw await erroSupabase(r, 'ler da nuvem')
  const linhas: { dados: AppState; atualizado_em: string }[] = await r.json()
  const linha = linhas[0]
  return linha ? { dados: linha.dados, versao: linha.atualizado_em } : null
}

export async function baixarEstado(c: ConfigNuvem): Promise<AppState | null> {
  return (await baixarEstadoComVersao(c))?.dados ?? null
}

// Gravação condicional (optimistic concurrency): grava só se a linha ainda
// estiver na `versaoEsperada`. Devolve a nova versão em caso de sucesso, ou
// null se alguém gravou no meio (o sync deve reler e mesclar de novo).
export async function gravarEstadoCondicional(
  c: ConfigNuvem,
  dados: AppState,
  versaoEsperada: string,
): Promise<string | null> {
  const novaVersao = new Date().toISOString()
  let r: Response
  try {
    r = await fetch(
      `${base(c)}/rest/v1/estados?igreja_id=eq.${encodeURIComponent(c.igrejaId)}&atualizado_em=eq.${encodeURIComponent(versaoEsperada)}&select=atualizado_em`,
      {
        method: 'PATCH',
        headers: { ...cabecalhos(c), Prefer: 'return=representation' },
        body: JSON.stringify({ dados, atualizado_em: novaVersao }),
      },
    )
  } catch {
    throw new Error('Falha de rede ao gravar: verifique a URL do projeto e sua conexão.')
  }
  if (!r.ok) throw await erroSupabase(r, 'gravar na nuvem')
  const linhas: { atualizado_em: string }[] = await r.json()
  // Nenhuma linha atualizada = a versão mudou (outro aparelho/servidor gravou)
  return linhas[0]?.atualizado_em ?? null
}

// `modo`:
//  - 'substituir'  → grava por cima do registro da igreja (uso normal, após mesclar)
//  - 'so_se_vazio' → INSERE apenas se ainda não existir registro; se existir, o
//                    banco ignora em silêncio. É o modo seguro para quando a leitura
//                    voltou vazia: se "vazio" era só o RLS filtrando, nada se perde.
export async function enviarEstado(
  c: ConfigNuvem,
  dados: AppState,
  modo: 'substituir' | 'so_se_vazio' = 'substituir',
): Promise<void> {
  let r: Response
  try {
    r = await fetch(`${base(c)}/rest/v1/estados`, {
      method: 'POST',
      headers: {
        ...cabecalhos(c),
        Prefer: modo === 'so_se_vazio' ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ igreja_id: c.igrejaId, dados, atualizado_em: new Date().toISOString() }),
    })
  } catch {
    throw new Error('Falha de rede ao gravar: verifique a URL do projeto e sua conexão.')
  }
  if (!r.ok) throw await erroSupabase(r, 'gravar na nuvem')
}

// ---- Canais públicos (autocadastro do visitante) ----
// O formulário público NÃO baixa mais o estado da igreja (isso levava todos os
// visitantes, pedidos de oração e sinais de cuidado para o celular de quem
// abrisse o QR — problema de LGPD). Ele lê só a config pela função abaixo e
// grava o cadastro por uma Edge Function que roda no servidor com a service
// role — o navegador do visitante nunca vê os dados dos outros.

// Config pública: nome, cores, textos e quais campos o formulário mostra.
// Nenhum dado pessoal. RPC `config_publica` (SECURITY DEFINER) no banco.
export interface ConfigPublica {
  config: Record<string, unknown>
}

export async function baixarConfigPublica(c: ConfigNuvem): Promise<ConfigPublica | null> {
  let r: Response
  try {
    r = await fetch(`${base(c)}/rest/v1/rpc/config_publica`, {
      method: 'POST',
      headers: cabecalhos(c),
      body: JSON.stringify({ p_igreja_id: c.igrejaId }),
    })
  } catch {
    throw new Error('Falha de rede ao carregar a página.')
  }
  if (!r.ok) throw await erroSupabase(r, 'carregar a configuração')
  const corpo = await r.json()
  // A RPC devolve o objeto { config } (ou null se a igreja não existir)
  return corpo && corpo.config ? (corpo as ConfigPublica) : null
}

// Campos enviados pelo formulário público. A Edge Function faz a triagem
// (WhatsApp válido? duplicado?) e anexa o visitante no servidor.
export interface AutocadastroPublicoInput {
  nome: string
  whatsapp: string
  dataNascimento?: string
  situacaoCivil?: string
  endereco?: string
  bairro?: string
  cidade?: string
  primeiraVez?: boolean
  membroOutraIgreja?: boolean
  situacaoBatismo?: string
  comoConheceu?: string
  desejaConexao?: string
  desejaContato?: boolean
  melhorHorarioContato?: string
  pedidoOracao?: string
  consentimentoLgpd: boolean
}

export interface RespostaAutocadastro {
  ok: boolean
  erro?: string
}

export async function cadastrarVisitantePublico(
  c: ConfigNuvem,
  input: AutocadastroPublicoInput,
): Promise<RespostaAutocadastro> {
  let r: Response
  try {
    r = await fetch(`${base(c)}/functions/v1/cadastrar-visitante`, {
      method: 'POST',
      headers: cabecalhos(c),
      body: JSON.stringify({ igrejaId: c.igrejaId, ...input }),
    })
  } catch {
    return { ok: false, erro: 'Sem conexão. Verifique a internet e tente enviar de novo.' }
  }
  if (!r.ok) {
    // 404 = função ainda não publicada no projeto (ver guia de implantação)
    const detalhe = r.status === 404
      ? 'O envio ainda não está disponível. Avise a equipe da igreja.'
      : (await r.json().catch(() => ({}))).error || 'Não foi possível enviar agora.'
    return { ok: false, erro: detalhe }
  }
  return { ok: true }
}
