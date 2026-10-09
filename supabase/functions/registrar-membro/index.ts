// Edge Function: liga a conta à igreja do site — AGORA SÓ SE A LIDERANÇA APROVOU.
//
// Histórico do furo (corrigido): esta função ligava QUALQUER conta logada à igreja
// (só barrava a 2ª igreja). Como o vínculo (`membros_igreja`) libera a leitura do
// bloco `estados` (cuidado pastoral, crises…), toda conta do projeto — inclusive as
// do Louvor e do Check-iFE — passava a ler tudo. Agora o vínculo só é criado quando
// a ficha da conta, no bloco da igreja, está APROVADA e ativa. Quem está pendente
// não ganha vínculo (e não lê o bloco).
//
// O app novo não chama mais esta função: usa `acesso-membro` (status, pedido,
// aprovação). Ela continua publicada, com a regra segura, para aparelhos com a
// versão antiga aberta — que, sem o vínculo, simplesmente não sincronizam.
//
// Implantação: `supabase functions deploy registrar-membro` (COM verificação de JWT).
// Depende de public.membros_igreja (supabase/sql/05_...).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { acharFicha, statusDaConta } from '../_shared/regras-membros.ts'
import type { AppState } from '../_shared/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const resposta = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function texto(v: unknown): string | undefined {
  const t = typeof v === 'string' ? v.trim() : ''
  return t.length > 0 ? t : undefined
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

  // Quem está chamando? Derivado do token, nunca do corpo.
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const comUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData, error: userErr } = await comUsuario.auth.getUser()
  const user = userData?.user
  if (userErr || !user || (user as { is_anonymous?: boolean }).is_anonymous) {
    return resposta({ error: 'Sessão inválida.' }, 401)
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: linha, error: eLer } = await admin.from('estados').select('dados').eq('igreja_id', igrejaId).maybeSingle()
  if (eLer || !linha?.dados) return resposta({ error: 'Igreja não encontrada.' }, 404)
  const usuarios = ((linha.dados as AppState).usuarios ?? [])

  const ficha = acharFicha(usuarios, { id: user.id, email: user.email, emailConfirmado: !!user.email_confirmed_at })
  const status = statusDaConta(ficha)
  if (status !== 'aprovado') {
    // Sem aprovação não há vínculo — e isto NÃO é erro: a pessoa só vê "aguardando".
    return resposta({ ok: true, vinculado: false, status })
  }

  const { error: insErr } = await admin
    .from('membros_igreja')
    .upsert({ auth_user_id: user.id, igreja_id: igrejaId }, { onConflict: 'auth_user_id,igreja_id', ignoreDuplicates: true })
  if (insErr) return resposta({ error: `Não foi possível vincular: ${insErr.message}` }, 500)
  return resposta({ ok: true, vinculado: true, status })
})
