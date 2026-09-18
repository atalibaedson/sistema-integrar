-- Go-live de São José + reativação do RLS por igreja.  ⚠️ RODAR NA ENTRADA DE SJC
--
-- Pré-requisitos (NÃO rode antes disto):
--   • A versão do app com o autocorrigir-no-login já está no ar HÁ DIAS e a
--     equipe de Resende abriu o app (os vínculos se preencheram sozinhos).
--   • Confira que quase todo mundo tem vínculo (o número deve estar perto do
--     tamanho real da equipe):
--        select count(*) from public.membros_igreja where igreja_id='minha-igreja';
--
-- Rode as seções na ordem. A seção C (reativar o RLS) é a única sensível — está
-- numa transação e pode ser revertida (fim do arquivo).

-- ============================================================================
-- A) Registro público de igrejas (nomes para o seletor de rede)
-- ============================================================================
create table if not exists public.igrejas (
  id text primary key,
  nome text not null,
  uf text,
  criado_em timestamptz not null default now()
);

alter table public.igrejas enable row level security;

-- Cada um lê os nomes só das igrejas de que é membro (nome não é sensível, mas
-- não há por que expor a lista inteira).
drop policy if exists "ler_minhas_igrejas" on public.igrejas;
create policy "ler_minhas_igrejas" on public.igrejas
  for select using (
    exists (select 1 from public.membros_igreja m
             where m.auth_user_id = auth.uid() and m.igreja_id = igrejas.id)
  );

-- As duas igrejas. Ajuste os nomes/UF se quiser.
insert into public.igrejas (id, nome, uf) values
  ('minha-igreja', 'iFE Resende', 'RJ'),
  ('ife-sjc',      'iFE São José dos Campos', 'SP')
on conflict (id) do update set nome = excluded.nome, uf = excluded.uf;

-- ============================================================================
-- B) Vínculos de São José (pastores de rede + admin de SJC)
--    Troque os e-mails. O admin de SJC também pode simplesmente entrar no site
--    de SJC e o autocorrigir cria o vínculo dele — mas para um começo limpo,
--    insira aqui.
-- ============================================================================
--   insert into public.membros_igreja (auth_user_id, igreja_id)
--   select id, 'ife-sjc' from auth.users
--    where email in ('pastor.rede@exemplo.com', 'admin.sjc@exemplo.com')
--   on conflict do nothing;

-- ============================================================================
-- C) Reativar o RLS por igreja (⚠️ sensível — transacional)
--    Só rode quando a seção acima estiver feita e os vínculos de Resende
--    conferidos. Quem tiver sido esquecido se autocorrige no próximo login.
-- ============================================================================
begin;

drop policy if exists "acesso_usuario_real" on public.estados;
drop policy if exists "acesso_membro_igreja" on public.estados;

create policy "acesso_membro_igreja" on public.estados
  for all
  using (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and exists (select 1 from public.membros_igreja m
                 where m.auth_user_id = auth.uid() and m.igreja_id = estados.igreja_id)
  )
  with check (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and exists (select 1 from public.membros_igreja m
                 where m.auth_user_id = auth.uid() and m.igreja_id = estados.igreja_id)
  );

commit;

-- Reversão de emergência (destrava todo mundo, sem checar igreja):
--   drop policy if exists "acesso_membro_igreja" on public.estados;
--   create policy "acesso_usuario_real" on public.estados
--     for all
--     using (auth.role() = 'authenticated'
--            and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
--     with check (auth.role() = 'authenticated'
--            and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
