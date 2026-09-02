-- Prioridade 1 · Passo 3 de 4
-- Histórico automático do estado da igreja: cada gravação vira uma versão
-- guardada. Dá "voltar para ontem" em minutos se algo for sobrescrito por
-- engano — hoje um erro de gravação é irreversível. Rode no SQL Editor.

create table if not exists public.estados_historico (
  id bigserial primary key,
  igreja_id text not null,
  dados jsonb not null,
  gravado_em timestamptz not null default now(),
  tamanho_bytes int
);

create index if not exists estados_historico_igreja_idx
  on public.estados_historico (igreja_id, gravado_em desc);

-- Só o dono do projeto (service_role / SQL Editor) lê o histórico; o app não.
alter table public.estados_historico enable row level security;

create or replace function public.snapshot_estado() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.estados_historico (igreja_id, dados, tamanho_bytes)
  values (new.igreja_id, new.dados, octet_length(new.dados::text));

  -- Mantém ~200 versões por igreja (evita crescer sem limite)
  delete from public.estados_historico h
   where h.igreja_id = new.igreja_id
     and h.id not in (
       select id from public.estados_historico
        where igreja_id = new.igreja_id
        order by gravado_em desc
        limit 200
     );

  return new;
end;
$$;

drop trigger if exists trg_snapshot_estado on public.estados;
create trigger trg_snapshot_estado
  after insert or update on public.estados
  for each row execute function public.snapshot_estado();

-- Para restaurar uma versão (exemplo), rode manualmente no SQL Editor:
--   update public.estados e
--      set dados = h.dados, atualizado_em = now()
--     from public.estados_historico h
--    where h.id = <ID_DA_VERSAO> and e.igreja_id = h.igreja_id;
