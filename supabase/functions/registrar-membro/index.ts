// Edge Function: liga a conta recém-criada à igreja do site (RLS por igreja).
//
// Por que existe: o vínculo usuário → igreja (tabela membros_igreja) é a fonte
// de verdade do acesso, e não pode ser gravável pelo navegador — senão qualquer
// um se colocaria em qualquer igreja. Aqui o servidor (service role) insere o
// vínculo, mas derivando o usuário do PRÓPRIO token (auth.getUser), nunca de um
// id vindo no corpo. E só deixa a pessoa se ligar à PRIMEIRA igreja: entrar em
// outra igreja (pastor de rede) é privilégio, feito por SQL do dono / admin.
//
// Implantação: publique COM verificação de JWT (é uma chamada autenticada —
// precisa do token do usuário para saber quem é):
//   supabase functions deploy registrar-membro
//
// Depende da tabela public.membros_igreja (ver supabase/sql/05_...).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const resposta = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

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
  const authHeader = req.headers.get('Authorization') ?? ''
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const comUsuario = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
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

  // Já tem vínculo com OUTRA igreja? Então isto seria auto-escalar para uma
  // segunda igreja — bloqueado. Entrar em outra igreja é privilégio (SQL/admin).
  const { data: existentes, error: exErr } = await admin
    .from('membros_igreja')
    .select('igreja_id')
    .eq('auth_user_id', user.id)
  if (exErr) return resposta({ error: `Falha ao verificar vínculo: ${exErr.message}` }, 500)
  if (existentes && existentes.some((m) => m.igreja_id !== igrejaId)) {
    return resposta({ error: 'Esta conta já está vinculada a outra igreja.' }, 403)
  }

  // Insere o vínculo (idempotente). O usuário só se liga à igreja deste site.
  const { error: insErr } = await admin
    .from('membros_igreja')
    .upsert({ auth_user_id: user.id, igreja_id: igrejaId }, { onConflict: 'auth_user_id,igreja_id' })
  if (insErr) return resposta({ error: `Não foi possível vincular: ${insErr.message}` }, 500)

  return resposta({ ok: true })
})
