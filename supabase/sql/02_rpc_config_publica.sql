-- Prioridade 1 · Passo 2 de 4
-- Configuração PÚBLICA da igreja para o formulário de autocadastro: nome,
-- cores, textos e quais campos mostrar. NENHUM dado pessoal (nem visitantes,
-- nem usuários, nem interações). É o único jeito de a página pública ler algo
-- do banco depois que o acesso anônimo for fechado (Passo 4).
--
-- SECURITY DEFINER: roda com os privilégios do dono e devolve só a config,
-- ainda que o RLS bloqueie a leitura da linha inteira. Rode no SQL Editor.

create or replace function public.config_publica(p_igreja_id text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object('config', dados->'config')
    from public.estados
    where igreja_id = p_igreja_id;
$$;

revoke all on function public.config_publica(text) from public;
grant execute on function public.config_publica(text) to anon, authenticated;
