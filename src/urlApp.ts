// Endereço do app do Integrar para os links dos e-mails (confirmar cadastro e
// redefinir senha). O link do e-mail precisa voltar para o Integrar — e para o
// app da PRÓPRIA igreja, mesmo que a pessoa tenha se cadastrado num endereço
// público de visitante. Esses endereços têm de estar na lista "Redirect URLs"
// do Supabase (ver SUPABASE-AUTH.md).

// Subdomínios públicos do visitante → o app da mesma igreja
const APP_DO_VISITANTE: Record<string, string> = {
  'visitante.ifamiliaextraordinaria.com.br': 'https://integracaoife.ifamiliaextraordinaria.com.br',
  'cadastro.ifamiliaextraordinaria.com.br': 'https://integracaoife.ifamiliaextraordinaria.com.br',
  'visitantesjc.ifamiliaextraordinaria.com.br': 'https://integracaoifesjc.ifamiliaextraordinaria.com.br',
}

/** Raiz do app (sem #/rota e sem barra final) para o host em que a pessoa está. */
export function urlDoAppParaHost(hostname: string, origem: string): string {
  const doVisitante = APP_DO_VISITANTE[hostname]
  if (doVisitante) return doVisitante
  // visitante*/cadastro* desconhecidos: não dá para adivinhar o app — usa o próprio endereço
  return origem.replace(/\/+$/, '')
}

export function urlDoApp(): string {
  return urlDoAppParaHost(window.location.hostname, window.location.origin)
}

// App de cada igreja — para avisar quem abriu o endereço de OUTRA igreja (ex.: o link
// do e-mail caiu no endereço padrão) e levá-lo ao certo, em vez de deixar o pedido de
// acesso ir para a igreja errada.
export const APPS_DAS_IGREJAS: Record<string, { nome: string; url: string }> = {
  'minha-igreja': { nome: 'iFE Resende', url: 'https://integracaoife.ifamiliaextraordinaria.com.br' },
  'ife-sjc': { nome: 'iFE São José dos Campos', url: 'https://integracaoifesjc.ifamiliaextraordinaria.com.br' },
}

/** Igreja escolhida no cadastro do Integrar (metadados `integrar.igreja`), se for OUTRA que não a aberta agora e conhecida. */
export function igrejaDoCadastroSeOutra(metadados: unknown, igrejaAberta: string): string | null {
  const m = metadados && typeof metadados === 'object' ? (metadados as Record<string, unknown>) : {}
  const integrar = m.integrar && typeof m.integrar === 'object' ? (m.integrar as Record<string, unknown>) : {}
  const igreja = typeof integrar.igreja === 'string' ? integrar.igreja : ''
  if (m.origem !== 'integrar' || !igreja || igreja === igrejaAberta || !APPS_DAS_IGREJAS[igreja]) return null
  return igreja
}
