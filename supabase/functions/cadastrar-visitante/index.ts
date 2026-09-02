// Edge Function: cadastro público de visitante (autocadastro por QR code).
//
// Por que existe: o formulário público NÃO pode baixar o estado da igreja para
// o celular de quem abre o QR (isso levava todos os visitantes, pedidos de
// oração e sinais de cuidado para um aparelho qualquer — problema de LGPD).
// Aqui o cadastro é gravado no SERVIDOR, com a service role, e o navegador do
// visitante só envia o próprio formulário — nunca vê os dados dos outros.
//
// Implantação: publique com verificação de JWT DESLIGADA (o formulário é
// público e o projeto usa chave "publishable", que não é um JWT):
//   supabase functions deploy cadastrar-visitante --no-verify-jwt
//
// Depende da função SQL public.anexar_visitante (ver supabase/sql/01_...).
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

// Mesma geração de id do app (store.ts), para as fichas ficarem no mesmo padrão.
function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
function so_digitos(w: string): string {
  return (w ?? '').replace(/\D/g, '')
}
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
  const nome = texto(corpo.nome)
  const whatsapp = texto(corpo.whatsapp)
  const consentimento = corpo.consentimentoLgpd === true

  if (!igrejaId) return resposta({ error: 'Igreja não identificada.' }, 400)
  if (!nome || !whatsapp) return resposta({ error: 'Preencha nome e WhatsApp.' }, 400)
  if (!consentimento) return resposta({ error: 'É preciso autorizar o uso dos dados.' }, 400)

  const whats = so_digitos(whatsapp)
  const whatsValido = whats.length >= 10
  const agora = new Date().toISOString()

  // Monta a ficha no mesmo formato do app (types.ts / cadastrarVisitante).
  // A sugestão de Conexão e o responsável NÃO são definidos aqui — a Gestão da
  // Integração distribui depois (o cadastro entra "sem responsável", que o
  // Painel já sinaliza). WhatsApp inválido entra encerrado na triagem.
  const visitante: Record<string, unknown> = {
    id: uid(),
    nome,
    whatsapp,
    dataCadastro: agora,
    origem: 'qr_code',
    status: whatsValido ? 'novo' : 'encerrado',
    dataNascimento: texto(corpo.dataNascimento),
    situacaoCivil: texto(corpo.situacaoCivil),
    endereco: texto(corpo.endereco),
    bairro: texto(corpo.bairro),
    cidade: texto(corpo.cidade),
    primeiraVez: typeof corpo.primeiraVez === 'boolean' ? corpo.primeiraVez : undefined,
    membroOutraIgreja: typeof corpo.membroOutraIgreja === 'boolean' ? corpo.membroOutraIgreja : undefined,
    situacaoBatismo: texto(corpo.situacaoBatismo),
    comoConheceu: texto(corpo.comoConheceu),
    desejaConexao: texto(corpo.desejaConexao),
    desejaContato: typeof corpo.desejaContato === 'boolean' ? corpo.desejaContato : undefined,
    melhorHorarioContato: texto(corpo.melhorHorarioContato),
    pedidoOracao: texto(corpo.pedidoOracao),
    flagMenorIdade: false,
    flagOutraCidade: false,
    flagCuidado: false,
    transferenciaConfirmada: false,
    consentimentoLgpd: true,
    consentimentoLgpdData: agora,
    historicoStatus: [{
      de: null,
      para: whatsValido ? 'novo' : 'encerrado',
      data: agora,
      motivo: whatsValido ? 'Autocadastro (QR code)' : 'Triagem: WhatsApp inválido',
      automatica: !whatsValido,
    }],
    criadoEm: agora,
    atualizadoEm: agora,
  }

  // Remove chaves undefined (o JSON não deve carregar campos vazios)
  for (const k of Object.keys(visitante)) {
    if (visitante[k] === undefined) delete visitante[k]
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Append atômico no servidor: a função SQL trava a linha da igreja, checa
  // duplicidade por WhatsApp e anexa. Sem isso, uma gravação do app poderia
  // apagar o cadastro recém-inserido.
  const { data, error } = await supabaseAdmin.rpc('anexar_visitante', {
    p_igreja_id: igrejaId,
    p_visitante: visitante,
    p_whats: whatsValido ? whats : '',
  })

  if (error) return resposta({ error: `Não foi possível gravar: ${error.message}` }, 500)
  if (data && data.ok === false) {
    return resposta({ error: 'Cadastro indisponível para esta igreja no momento.' }, 409)
  }

  return resposta({ ok: true })
})
