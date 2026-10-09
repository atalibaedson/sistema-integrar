// Edge Function: quem entra na igreja do Integrar (vínculo `membros_igreja`).
//
// Por que existe: o vínculo é o que libera a leitura do bloco `estados` (cuidado
// pastoral, crises…). Antes, a função `registrar-membro` ligava QUALQUER conta
// logada do projeto à igreja — inclusive contas do Louvor e do Check-iFE. Agora o
// vínculo só nasce quando a liderança APROVA, e quem confere isso é o servidor.
// Quem está pendente não lê o bloco: vê só a tela "aguardando aprovação", cujo
// status vem daqui e devolve SÓ a situação da própria conta.
//
// Ações (POST/JSON, `acao`), todas exigem o token de uma conta real (não anônima):
//   • status         — situação da própria conta. Se ela já foi aprovada, garante o vínculo.
//   • solicitar      — cria a ficha PENDENTE da conta (dos metadados do cadastro, ou do
//                      que a pessoa confirmou em "Completar cadastro"). Nunca aprova.
//   • aprovar        — a liderança (pastor/gestão aprovados, conferidos AQUI) libera o
//                      vínculo de outra conta que tem ficha nesta igreja.
//   • primeiro_admin — enquanto a igreja não tem nenhum administrador aprovado, a
//                      própria pessoa com ficha pode ativar o seu acesso.
//
// As regras estão em _shared/regras-membros.ts (cópia gerada de src/regras-membros.ts,
// testada). Implantação: `supabase functions deploy acesso-membro` (COM verificação de
// JWT — o padrão). Não usa segredos novos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  acharFicha, aplicarSolicitacao, chamadorPodeAprovar, contaTemFicha, existeAdminAprovado, lerSolicitacao,
  ligarFichaAConta, podeSerPrimeiroAdmin, statusDaConta, type ContaAuth,
} from '../_shared/regras-membros.ts'
import type { AppState } from '../_shared/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const resposta = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const texto = (v: unknown): string | undefined => {
  const t = typeof v === 'string' ? v.trim() : ''
  return t.length > 0 ? t : undefined
}

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? ''
const admin = createClient(URL_SUPABASE, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { autoRefreshToken: false, persistSession: false },
})
const PREFIXO_FOTO = `${URL_SUPABASE}/storage/v1/object/public/avatares/`

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

interface Chamador { conta: ContaAuth; metadados: unknown }

// Quem está chamando? Derivado do token, nunca do corpo.
async function chamadorDoToken(req: Request): Promise<Chamador | null> {
  const comUsuario = createClient(URL_SUPABASE, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await comUsuario.auth.getUser()
  const u = data?.user
  if (error || !u || (u as { is_anonymous?: boolean }).is_anonymous) return null
  return {
    conta: { id: u.id, email: u.email ?? undefined, emailConfirmado: !!u.email_confirmed_at },
    metadados: u.user_metadata ?? {},
  }
}

interface Linha { dados: AppState; versao: string }

async function lerEstado(igrejaId: string): Promise<Linha | null> {
  const { data, error } = await admin.from('estados').select('dados, atualizado_em').eq('igreja_id', igrejaId).maybeSingle()
  if (error || !data?.dados) return null
  const d = data.dados as AppState
  return { dados: { ...d, usuarios: d.usuarios ?? [], conexoes: d.conexoes ?? [], auditoria: d.auditoria ?? [] }, versao: data.atualizado_em as string }
}

async function vincular(authUserId: string, igrejaId: string): Promise<string | null> {
  const { error } = await admin.from('membros_igreja').upsert(
    { auth_user_id: authUserId, igreja_id: igrejaId },
    { onConflict: 'auth_user_id,igreja_id', ignoreDuplicates: true },
  )
  return error ? error.message : null
}

async function estaVinculado(authUserId: string, igrejaId: string): Promise<boolean> {
  const { data } = await admin.from('membros_igreja').select('igreja_id').eq('auth_user_id', authUserId).eq('igreja_id', igrejaId).maybeSingle()
  return !!data
}

// Leitura + gravação condicional pela versão (como o app faz): se alguém gravou no meio,
// relê e tenta de novo. `alterar` devolve o novo estado, ou null se não há o que gravar.
async function alterarEstado(igrejaId: string, alterar: (e: AppState) => AppState | null): Promise<'gravou' | 'nada' | 'sem_igreja' | 'ocupado' | string> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const linha = await lerEstado(igrejaId)
    if (!linha) return 'sem_igreja'
    const novo = alterar(linha.dados)
    if (!novo) return 'nada'
    const { data, error } = await admin
      .from('estados')
      .update({ dados: novo, atualizado_em: new Date().toISOString() })
      .eq('igreja_id', igrejaId)
      .eq('atualizado_em', linha.versao)
      .select('atualizado_em')
    if (error) return error.message
    if (data && data.length > 0) return 'gravou'
  }
  return 'ocupado'
}

// ---- status ----

async function acaoStatus(c: Chamador, igrejaId: string) {
  const linha = await lerEstado(igrejaId)
  if (!linha) return resposta({ error: 'Igreja não encontrada.' }, 404)
  const usuarios = linha.dados.usuarios
  const ficha = acharFicha(usuarios, c.conta)
  const status = statusDaConta(ficha)

  // Aprovada pela liderança: garante o vínculo (autocorrige quem foi aprovado antes de existir esta regra)
  if (status === 'aprovado') {
    const erro = await vincular(c.conta.id, igrejaId)
    if (erro) return resposta({ error: `Não foi possível liberar o acesso: ${erro}` }, 500)
    // Ficha antiga achada só pelo e-mail: liga à conta (daí em diante o vínculo é por conta)
    if (ficha && !ficha.authUserId) {
      await alterarEstado(igrejaId, (e) => (acharFicha(e.usuarios, c.conta)?.id === ficha.id ? ligarFichaAConta(e, ficha.id, c.conta.id) : null))
    }
  }
  return resposta({
    ok: true,
    status,
    vinculado: await estaVinculado(c.conta.id, igrejaId),
    nome: ficha?.nome,
    motivo: status === 'rejeitado' ? ficha?.motivoRejeicao : undefined,
    podePrimeiroAdmin: podeSerPrimeiroAdmin(usuarios, c.conta),
    // só o necessário para a tela: nada do restante do bloco
  })
}

// ---- solicitar ----

async function acaoSolicitar(c: Chamador, igrejaId: string, corpo: Record<string, unknown>) {
  // `automatico`: o pedido nasce do cadastro feito neste Integrar (metadados da conta).
  // Sem isso, vem da tela "Completar cadastro" (a pessoa confirmou os dados ali).
  const extra = corpo.ficha
  const leitura = lerSolicitacao(c.metadados, extra, {
    igrejaId, prefixoFoto: PREFIXO_FOTO, automatico: corpo.automatico === true || extra === undefined,
  })
  if (!leitura.ok) return resposta({ ok: false, semDados: leitura.semDados === true, error: leitura.erro }, leitura.semDados ? 200 : 400)

  let resultado = 'ja_existe'
  const r = await alterarEstado(igrejaId, (estado) => {
    // a conexão escolhida precisa existir nesta igreja (senão, fica sem)
    const sol = { ...leitura.solicitacao }
    if (sol.conexaoParticipaId && !estado.conexoes.some((x) => x.id === sol.conexaoParticipaId)) sol.conexaoParticipaId = undefined
    const aplicado = aplicarSolicitacao(estado, c.conta, sol, uid)
    resultado = aplicado.resultado
    return aplicado.resultado === 'ja_existe' ? null : aplicado.estado
  })
  if (r === 'sem_igreja') return resposta({ error: 'Igreja não encontrada.' }, 404)
  if (r === 'ocupado') return resposta({ error: 'O sistema está ocupado. Tente de novo em instantes.' }, 409)
  if (r !== 'gravou' && r !== 'nada') return resposta({ error: `Não foi possível registrar o pedido: ${r}` }, 500)
  return resposta({ ok: true, resultado })
}

// ---- aprovar / primeiro_admin ----

async function acaoAprovar(c: Chamador, igrejaId: string, corpo: Record<string, unknown>) {
  const alvo = texto(corpo.authUserId)
  if (!alvo) return resposta({ error: 'Conta não informada.' }, 400)
  const linha = await lerEstado(igrejaId)
  if (!linha) return resposta({ error: 'Igreja não encontrada.' }, 404)
  // Quem aprova é conferido AQUI, pela ficha dele no bloco — não por algo enviado pelo navegador.
  if (!chamadorPodeAprovar(linha.dados.usuarios, c.conta)) {
    return resposta({ error: 'Só Pastores e a Gestão Integração aprovados podem liberar acessos.' }, 403)
  }
  if (!contaTemFicha(linha.dados.usuarios, alvo)) {
    return resposta({ error: 'Essa conta não tem pedido de acesso nesta igreja.' }, 404)
  }
  // O alvo precisa ser uma conta real (não anônima)
  const { data: alvoAuth, error: eAlvo } = await admin.auth.admin.getUserById(alvo)
  if (eAlvo || !alvoAuth?.user || (alvoAuth.user as { is_anonymous?: boolean }).is_anonymous) {
    return resposta({ error: 'Conta não encontrada.' }, 404)
  }
  const erro = await vincular(alvo, igrejaId)
  if (erro) return resposta({ error: `Não foi possível liberar o acesso: ${erro}` }, 500)
  return resposta({ ok: true })
}

async function acaoPrimeiroAdmin(c: Chamador, igrejaId: string) {
  const linha = await lerEstado(igrejaId)
  if (!linha) return resposta({ error: 'Igreja não encontrada.' }, 404)
  if (existeAdminAprovado(linha.dados.usuarios)) {
    return resposta({ error: 'Esta igreja já tem administrador. Peça a aprovação à liderança.' }, 403)
  }
  if (!podeSerPrimeiroAdmin(linha.dados.usuarios, c.conta)) {
    return resposta({ error: 'Não foi possível confirmar o seu pedido de acesso.' }, 403)
  }
  const erro = await vincular(c.conta.id, igrejaId)
  if (erro) return resposta({ error: `Não foi possível liberar o acesso: ${erro}` }, 500)
  return resposta({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return resposta({ error: 'Método não permitido' }, 405)

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return resposta({ error: 'Requisição inválida' }, 400)
  }
  const igrejaId = texto(corpo.igrejaId)
  if (!igrejaId) return resposta({ error: 'Igreja não identificada.' }, 400)

  const chamador = await chamadorDoToken(req)
  if (!chamador) return resposta({ error: 'Sessão inválida.' }, 401)

  try {
    switch (texto(corpo.acao)) {
      case 'status': return await acaoStatus(chamador, igrejaId)
      case 'solicitar': return await acaoSolicitar(chamador, igrejaId, corpo)
      case 'aprovar': return await acaoAprovar(chamador, igrejaId, corpo)
      case 'primeiro_admin': return await acaoPrimeiroAdmin(chamador, igrejaId)
      default: return resposta({ error: 'Ação desconhecida.' }, 400)
    }
  } catch (e) {
    console.error('erro inesperado', (e as Error).message)
    return resposta({ error: 'Erro inesperado no servidor.' }, 500)
  }
})
