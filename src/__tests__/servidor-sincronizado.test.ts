import { describe, expect, it } from 'vitest'
import fonteAlertas from '../alertas.ts?raw'
import fonteRegras from '../regras-acesso.ts?raw'
import fonteTipos from '../types.ts?raw'
import copiaAlertas from '../../supabase/functions/_shared/alertas.ts?raw'
import copiaRegras from '../../supabase/functions/_shared/regras-acesso.ts?raw'
import copiaTipos from '../../supabase/functions/_shared/types.ts?raw'

// As cópias em supabase/functions/_shared são geradas por
// scripts/sincronizar-servidor.mjs. Se alguém muda a regra dos avisos no app e
// esquece de sincronizar, o servidor mandaria push com regra velha: este teste
// barra isso (e o deploy, que roda os testes).
const SEM_CABECALHO = /^\/\/ ⚠️ CÓPIA GERADA[^\n]*\n/
const normalizar = (copia: string) => copia.replace(SEM_CABECALHO, '').replace(/from '(\.\/[\w-]+)\.ts'/g, "from '$1'")

describe('cópias do servidor', () => {
  const pares: [string, string, string][] = [
    ['alertas', fonteAlertas, copiaAlertas],
    ['regras-acesso', fonteRegras, copiaRegras],
    ['types', fonteTipos, copiaTipos],
  ]
  for (const [nome, fonte, copia] of pares) {
    it(`${nome}.ts está sincronizado — se falhar, rode: npm run sincronizar:servidor`, () => {
      expect(copia).toMatch(SEM_CABECALHO)
      expect(normalizar(copia)).toBe(fonte)
    })
  }
})
