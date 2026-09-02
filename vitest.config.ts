import { defineConfig } from 'vitest/config'

// Config própria dos testes (não usa o plugin React do vite.config.ts — os
// testes cobrem só módulos puros de lógica, sem JSX nem DOM).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
