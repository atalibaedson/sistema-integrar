import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const resposta = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return resposta({ error: 'Não autorizado' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Verifica que quem chama é um usuário autenticado válido
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return resposta({ error: 'Token inválido' }, 401)

    const { authUserId } = await req.json()
    if (!authUserId || typeof authUserId !== 'string') {
      return resposta({ error: 'authUserId obrigatório' }, 400)
    }

    // Impede que alguém delete a si mesmo via bug
    if (authUserId === user.id) return resposta({ error: 'Não é possível deletar a própria conta assim' }, 400)

    const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId)
    if (error) throw error

    return resposta({ ok: true })
  } catch (err) {
    return resposta({ error: String(err) }, 500)
  }
})
