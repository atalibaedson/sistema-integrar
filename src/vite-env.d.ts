/// <reference types="vite/client" />

// Variáveis de ambiente do build (Vite). Prefixo VITE_ = expostas ao navegador.
// São a configuração da igreja por site: um mesmo código serve várias igrejas,
// cada deploy (ex.: Vercel) define as suas. Todas OPCIONAIS — sem elas, o
// nuvem.ts decide a igreja pelo domínio (IGREJA_POR_HOST) ou cai no padrão.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_IGREJA_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Versão do app (package.json), injetada pelo Vite — ver vite.config.ts.
declare const __APP_VERSION__: string
