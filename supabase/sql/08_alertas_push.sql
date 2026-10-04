-- Avisos por push · tabelas e rotina agendada
--
-- Depende da Edge Function `alertas-push` (supabase/functions/alertas-push) e dos
-- segredos VAPID_* / CRON_SECRET — veja IMPLANTACAO-ALERTAS-PUSH.md (passo a passo).
-- Rode na ORDEM: bloco A agora; bloco B só depois de publicar a função e gravar
-- os segredos.
--
-- Idempotente: pode rodar de novo sem duplicar nada.

-- ============================== BLOCO A — tabelas ==============================
-- Rode primeiro. Não muda nada do que já existe.

begin;

-- 1) Inscrições de push: um aparelho de uma pessoa numa igreja.
create table if not exists public.assinaturas_push (
  id uuid primary key default gen_random_uuid(),
  igreja_id text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  usuario_id text not null,            -- id da ficha na equipe (dentro de estados.dados)
  endpoint text not null,              -- endereço de push do aparelho (fornecido pelo navegador)
  p256dh text not null,
  auth text not null,
  aparelho text,                       -- navegador/aparelho, só para conferência
  criado_em timestamptz not null default now(),
  unique (igreja_id, endpoint)
);

create index if not exists assinaturas_push_igreja_idx on public.assinaturas_push (igreja_id);
create index if not exists assinaturas_push_usuario_idx on public.assinaturas_push (auth_user_id);

-- 2) Registro do que já foi enviado (evita repetir o mesmo aviso e limita 1 resumo/dia).
create table if not exists public.alertas_enviados (
  igreja_id text not null,
  usuario_id text not null,
  chave text not null,
  enviado_em timestamptz not null default now(),
  primary key (igreja_id, usuario_id, chave)
);

create index if not exists alertas_enviados_quando_idx on public.alertas_enviados (enviado_em);

-- 3) RLS LIGADO e SEM política nenhuma: o navegador não lê nem grava estas
-- tabelas. Só a Edge Function (service role) mexe — e ela valida quem chama.
alter table public.assinaturas_push enable row level security;
alter table public.alertas_enviados enable row level security;

commit;

-- ============================ BLOCO B — rotina agendada =========================
-- Rode DEPOIS de publicar a função e gravar os segredos. Troque
-- COLE_AQUI_O_CRON_SECRET pelo MESMO valor do segredo CRON_SECRET.
-- Roda a cada 30 minutos; a função decide sozinha se há algo a enviar (só entre
-- 7h e 21h de Brasília, no máximo 1 resumo por pessoa por dia).

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'alertas-push-30min',
--   '*/30 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://yzexsklhixqcbmnbrtdl.supabase.co/functions/v1/alertas-push',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'COLE_AQUI_O_CRON_SECRET'),
--     body    := '{"acao":"enviar"}'::jsonb
--   );
--   $$
-- );

-- ============================== REVERTER (se precisar) ==========================
-- Para parar os envios:
--   select cron.unschedule('alertas-push-30min');
-- Para apagar tudo isto (as inscrições se perdem; cada pessoa reativa depois):
--   drop table if exists public.assinaturas_push;
--   drop table if exists public.alertas_enviados;
