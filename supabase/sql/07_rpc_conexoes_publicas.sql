-- Multi-igreja · Grupos (Conexões) públicos de UMA igreja
--
-- A tela "Criar meu acesso" (cadastro de integrante) mostra a lista de grupos
-- para a pessoa escolher o seu. Quem se cadastra ainda NÃO está logado, e o RLS
-- não entrega o estado da igreja a anônimos — sem esta função, a tela mostrava
-- os grupos de exemplo em vez dos grupos reais daquela igreja.
--
-- Devolve só id e nome, em ordem alfabética. NENHUM dado pessoal (nem líder,
-- nem endereço, nem membros). SECURITY DEFINER: lê só este pedaço do estado.
-- Pode rodar mais de uma vez (create or replace). Rode no SQL Editor.

create or replace function public.conexoes_publicas(p_igreja_id text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select jsonb_agg(jsonb_build_object('id', c->>'id', 'nome', c->>'nome') order by c->>'nome')
       from public.estados e,
            jsonb_array_elements(coalesce(e.dados->'conexoes', '[]'::jsonb)) c
      where e.igreja_id = p_igreja_id
        and coalesce(c->>'nome', '') <> ''),
    '[]'::jsonb
  );
$$;

revoke all on function public.conexoes_publicas(text) from public;
grant execute on function public.conexoes_publicas(text) to anon, authenticated;
