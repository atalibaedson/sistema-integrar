import { describe, expect, it } from 'vitest'
import sql10 from '../../supabase/sql/10_funcoes_para_checkife.sql?raw'

// O Check-iFE usa estas funções nas REGRAS DE LEITURA dele (migration 0025): renomear,
// remover ou mudar a assinatura quebra o acesso de pastores e da integração lá.
// Mudou de propósito? Combine com o Check-iFE antes e atualize este teste.
describe('contrato com o Check-iFE (SQL 10)', () => {
  it('mantém as três funções com o mesmo nome e assinatura', () => {
    expect(sql10).toContain('create or replace function public.integrar_igrejas()\nreturns jsonb')
    expect(sql10).toContain('create or replace function public.integrar_minhas_igrejas()\nreturns text[]')
    expect(sql10).toContain('create or replace function public.integrar_igrejas_da_pessoa(p_user_id uuid)\nreturns text[]')
  })
  it('continua liberando a execução para quem o Check-iFE usa', () => {
    expect(sql10).toContain('grant execute on function public.integrar_igrejas() to anon, authenticated;')
    expect(sql10).toContain('grant execute on function public.integrar_minhas_igrejas() to authenticated;')
    expect(sql10).toContain('grant execute on function public.integrar_igrejas_da_pessoa(uuid) to authenticated;')
  })
})
