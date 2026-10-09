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
