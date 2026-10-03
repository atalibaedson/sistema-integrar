import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Versão exibida no rodapé da barra lateral (padrão dos sistemas iFE): sobe a
// cada publicação relevante, para conferir qual versão está no ar.
const pacote = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pacote.version) },
  server: { port: 5173, host: true }, // host: true → acessível pela rede local (celular)
  build: {
    rollupOptions: {
      // Duas páginas: o app (index.html) e a pública do visitante (visitante.html),
      // que tem título/prévia de link próprios ("Bem-vindo a iFE"). Ambas carregam
      // o MESMO app; a Vercel serve a de visitante nos subdomínios visitante/cadastro.
      input: {
        main: 'index.html',
        visitante: 'visitante.html',
      },
    },
  },
})
