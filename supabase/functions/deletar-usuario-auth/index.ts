// Edge Function: apaga a CONTA de login (Supabase Auth) de um integrante removido.
//
// ⚠️ A conta de login é uma só para os três sistemas (Integrar, Louvor e Check-iFE):
// apagá-la tira o acesso da pessoa aos três. O cadastro dela no Check-iFE NÃO é
// apagado junto (fica sem login). O app avisa isto antes de excluir.
//
// Segurança (antes qualquer sessão válida — até anônima — podia apagar qualquer conta
// de que soubesse o id): agora só vale se
//   • quem chama é Pastor/Gestão Integração APROVADO da igreja informada (conferido no bloco);
//   • a conta apagada pertence a esta igreja (tem vínculo ou ficha nela);
//   • a conta NÃO tem vínculo com outra igreja (uma conta de rede não se apaga daqui);
//   • não é a própria conta de quem chama.
//
// Implantação: `supabase functions deploy deletar-usuario-auth` (COM verificação de JWT).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chamadorPodeAprovar, contaTemFicha } from '../_shared/regras-membros.ts'
import type { AppState } from '../_shared/types.ts'

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

    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAdmin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Quem chama: conta real (não anônima) válida
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user || (user as { is_anonymous?: boolean }).is_anonymous) return resposta({ error: 'Token inválido' }, 401)

    const { authUserId, igrejaId } = await req.json()
    if (!authUserId || typeof authUserId !== 'string') return resposta({ error: 'authUserId obrigatório' }, 400)
    if (!igrejaId || typeof igrejaId !== 'string') return resposta({ error: 'igrejaId obrigatório' }, 400)
    if (authUserId === user.id) return resposta({ error: 'Não é possível deletar a própria conta assim' }, 400)

    // 1) quem chama é administrador aprovado DESTA igreja (pela ficha dele no bloco)
    const { data: linha } = await supabaseAdmin.from('estados').select('dados').eq('igreja_id', igrejaId).maybeSingle()
    const usuarios = ((linha?.dados as AppState | undefined)?.usuarios ?? [])
    if (!chamadorPodeAprovar(usuarios, { id: user.id, email: user.email, emailConfirmado: !!user.email_confirmed_at })) {
      return resposta({ error: 'Só Pastores e a Gestão Integração aprovados podem excluir contas.' }, 403)
    }

    // 2) a conta é desta igreja, e só desta
    const { data: vinculos } = await supabaseAdmin.from('membros_igreja').select('igreja_id').eq('auth_user_id', authUserId)
    const igrejasDaConta = (vinculos ?? []).map((v: { igreja_id: string }) => v.igreja_id)
    if (!igrejasDaConta.includes(igrejaId) && !contaTemFicha(usuarios, authUserId)) {
      return resposta({ error: 'Essa conta não pertence a esta igreja.' }, 404)
    }
    if (igrejasDaConta.some((i: string) => i !== igrejaId)) {
      return resposta({ error: 'Essa conta também pertence a outra igreja e não pode ser apagada daqui.' }, 409)
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId)
    if (error) throw error

    return resposta({ ok: true })
  } catch (err) {
    return resposta({ error: String(err) }, 500)
  }
})
