import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
