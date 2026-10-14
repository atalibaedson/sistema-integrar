-- 10 · Funções SÓ LEITURA do Integrar para o Check-iFE (cadastro único, etapa 2 — passo 2)
--
-- Decisões D1 e D2 (PLANO-ETAPA-2-CADASTRO-UNICO.md): o INTEGRAR é quem diz
--   • a que igrejas uma conta tem acesso (para o Check-iFE limitar o que um pastor lê), e
--   • de que igreja é uma pessoa (para o Check-iFE listar as conexões certas).
-- O Check-iFE CONSULTA estas funções (por exemplo, dentro das regras de leitura dele);
-- nunca escreve no Integrar.
--
-- ✔ Só cria funções novas do Integrar (prefixo integrar_). Não toca em tabela nenhuma,
--   nem em nada do Check-iFE ou do Louvor.
-- ✔ Sessão anônima (o Integrar cria uma por aparelho) recebe lista vazia.
-- ✔ Pode rodar mais de uma vez (create or replace). Rode no SQL Editor.
-- Para desfazer: drop function public.integrar_igrejas(), public.integrar_minhas_igrejas(),
--                public.integrar_igrejas_da_pessoa(uuid);

-- 1) As igrejas do Integrar: id e nome (sem dado pessoal). Pode ser lida sem login.
create or replace function public.integrar_igrejas()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', e.igreja_id,
      'nome', coalesce(nullif(e.dados->'config'->>'nomeIgreja', ''), e.igreja_id),
      'cidade', nullif(e.dados->'config'->>'cidade', '')
    ) order by e.igreja_id),
    '[]'::jsonb
  )
  from public.estados e;
$$;

-- 2) Igrejas a que QUEM CHAMA tem acesso no Integrar (vínculo aprovado em membros_igreja).
--    É o "escopo" de um pastor/gestor: o Check-iFE pode exigir que a pessoa lida seja de
--    uma destas igrejas.
create or replace function public.integrar_minhas_igrejas()
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(distinct m.igreja_id order by m.igreja_id), '{}'::text[])
    from public.membros_igreja m
   where m.auth_user_id = auth.uid()
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- 3) Igrejas de uma PESSOA no Integrar: onde ela tem ficha (aprovada ou pedido em análise,
--    ativa, não recusada) ou vínculo. Pode ser mais de uma (pastor de rede). Vazio = a
--    pessoa não está no Integrar (aí o Check-iFE decide como tratar).
create or replace function public.integrar_igrejas_da_pessoa(p_user_id uuid)
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(distinct x.igreja_id order by x.igreja_id), '{}'::text[])
    from (
      select m.igreja_id
        from public.membros_igreja m
       where m.auth_user_id = p_user_id
      union
      select e.igreja_id
        from public.estados e,
             jsonb_array_elements(coalesce(e.dados->'usuarios', '[]'::jsonb)) u
       where u->>'authUserId' = p_user_id::text
         and coalesce(u->>'ativo', 'true') <> 'false'
         and coalesce(u->>'statusAcesso', '') in ('aprovado', 'pendente_aprovacao')
    ) x
   where p_user_id is not null
     and auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

revoke all on function public.integrar_igrejas() from public;
revoke all on function public.integrar_minhas_igrejas() from public;
revoke all on function public.integrar_igrejas_da_pessoa(uuid) from public;
grant execute on function public.integrar_igrejas() to anon, authenticated;
grant execute on function public.integrar_minhas_igrejas() to authenticated;
grant execute on function public.integrar_igrejas_da_pessoa(uuid) to authenticated;

-- Conferência no SQL Editor: select public.integrar_igrejas();  → as duas igrejas.
-- As outras duas exigem uma sessão de pessoa (o SQL Editor não tem "usuário logado") e ali
-- devolvem {} — é o esperado. Quem confere de verdade é o Check-iFE, com a sessão de alguém.
