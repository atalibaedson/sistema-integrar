// Copia os módulos PUROS que o servidor também usa (regras dos avisos e tipos)
// de src/ para supabase/functions/_shared/, ajustando os imports para o Deno
// (que exige a extensão .ts). Assim a função `alertas-push` aplica EXATAMENTE as
// mesmas regras do app — sem duas versões para divergir.
//
// Rode depois de mexer em qualquer arquivo da lista:  npm run sincronizar:servidor
// (um teste — src/__tests__/servidor-sincronizado.test.ts — barra o deploy se as
// cópias ficarem diferentes das fontes).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
export const ARQUIVOS = ['types', 'regras-acesso', 'alertas']
export const CABECALHO = (nome) =>
  `// ⚠️ CÓPIA GERADA de src/${nome}.ts — NÃO edite aqui. Mude a fonte e rode: npm run sincronizar:servidor\n`

const destino = join(raiz, 'supabase', 'functions', '_shared')
mkdirSync(destino, { recursive: true })
for (const nome of ARQUIVOS) {
  const fonte = readFileSync(join(raiz, 'src', `${nome}.ts`), 'utf8')
  const deno = fonte.replace(/from '(\.\/[\w-]+)'/g, "from '$1.ts'")
  writeFileSync(join(destino, `${nome}.ts`), CABECALHO(nome) + deno)
  console.log(`✓ supabase/functions/_shared/${nome}.ts`)
}
