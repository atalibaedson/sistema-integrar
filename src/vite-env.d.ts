/// <reference types="vite/client" />

// Variáveis de ambiente do build (Vite). Prefixo VITE_ = expostas ao navegador.
// São a configuração da igreja por site: um mesmo código serve várias igrejas,
// cada deploy (ex.: Netlify) define as suas. Todas OPCIONAIS — sem elas, o
// nuvem.ts cai no padrão embutido (a igreja atual continua funcionando).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_IGREJA_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
