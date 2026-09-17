-- Multi-igreja · RLS por igreja  ⚠️ RODE POR ÚLTIMO (depois de 01–04)
--
-- Hoje qualquer usuário REAL logado lê/grava a linha de QUALQUER igreja (a
-- política do Passo 4 só checa "autenticado e não anônimo"). Com duas igrejas
-- no mesmo projeto, a equipe de uma leria os dados da outra. Aqui amarramos
-- cada usuário às igrejas de que ele é membro.
--
-- Modelo:
--   • membro local  → 1 linha em membros_igreja (a sua igreja)
--   • pastor de rede → várias linhas (uma por igreja que ele supervisiona)
--
-- ⚠️ ORDEM E SEGURANÇA:
--   • Rode isto DEPOIS de publicar a Edge Function registrar-membro E a versão
--     do app que a chama no cadastro. Senão, contas novas nascem sem vínculo e
--     param de sincronizar.
--   • Roda numa transação só: cria a tabela, faz o BACKFILL de todos os
--     usuários atuais para 'minha-igreja' (iFE Resende) e SÓ ENTÃO troca a
--     política. Assim ninguém perde acesso no meio do caminho.
--   • Idempotente: pode rodar de novo sem duplicar (create if not exists /
--     on conflict do nothing / drop policy if exists).

begin;

-- 1) Tabela de vínculo usuário → igreja (a fonte de verdade do acesso)
create table if not exists public.membros_igreja (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  igreja_id text not null,
  criado_em timestamptz not null default now(),
  primary key (auth_user_id, igreja_id)
);

create index if not exists membros_igreja_igreja_idx
  on public.membros_igreja (igreja_id);

alter table public.membros_igreja enable row level security;

-- O app lê APENAS os próprios vínculos (para saber quais igrejas mostrar no
-- seletor). Inserir/alterar/apagar é só via service role (Edge Function
-- registrar-membro no cadastro, ou SQL do dono para os pastores de rede).
drop policy if exists "ler_meus_vinculos" on public.membros_igreja;
create policy "ler_meus_vinculos" on public.membros_igreja
  for select using (auth_user_id = auth.uid());

-- 2) BACKFILL: todos os usuários que já existem na iFE Resende (minha-igreja).
-- Extrai os authUserId de dentro do estado da própria igreja — assim NÃO pega
-- por engano usuários de outro sistema (ex.: louvor) que dividem este projeto
-- de Auth. O JOIN com auth.users garante que só entram contas de login que
-- REALMENTE existem: fichas órfãs (authUserId de uma conta já apagada — resíduo
-- do incidente "usuários sumiram") são ignoradas, pois não conseguem logar.
with candidatos as (
  select distinct (u->>'authUserId') as aid
    from public.estados e,
         jsonb_array_elements(coalesce(e.dados->'usuarios', '[]'::jsonb)) u
   where e.igreja_id = 'minha-igreja'
     and u->>'authUserId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
insert into public.membros_igreja (auth_user_id, igreja_id)
select c.aid::uuid, 'minha-igreja'
  from candidatos c
  join auth.users au on au.id = c.aid::uuid
on conflict do nothing;

-- 3) Troca a política de estados: exige ser membro DAQUELA igreja.
drop policy if exists "acesso_usuario_real" on public.estados;
drop policy if exists "acesso_membro_igreja" on public.estados;

create policy "acesso_membro_igreja" on public.estados
  for all
  using (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1 from public.membros_igreja m
       where m.auth_user_id = auth.uid()
         and m.igreja_id = estados.igreja_id
    )
  )
  with check (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1 from public.membros_igreja m
       where m.auth_user_id = auth.uid()
         and m.igreja_id = estados.igreja_id
    )
  );

commit;

-- ============================================================================
-- Como CADASTRAR um pastor de REDE (vê as duas igrejas). Rode DEPOIS, quando
-- souber o auth_user_id do pastor (achado por e-mail na tabela auth.users):
--
--   insert into public.membros_igreja (auth_user_id, igreja_id)
--   select id, 'ife-sjc' from auth.users where email = 'pastor@exemplo.com'
--   on conflict do nothing;
--
-- (ele já é membro de 'minha-igreja' pelo backfill; esta linha adiciona a 2ª.)
-- ============================================================================

-- Para REVERTER (volta a aceitar qualquer usuário real, sem checar igreja):
--   drop policy if exists "acesso_membro_igreja" on public.estados;
--   create policy "acesso_usuario_real" on public.estados
--     for all
--     using (auth.role() = 'authenticated'
--            and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
--     with check (auth.role() = 'authenticated'
--            and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
