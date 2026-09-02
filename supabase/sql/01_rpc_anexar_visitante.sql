-- Prioridade 1 · Passo 1 de 4
-- Append atômico de um visitante ao estado da igreja, chamado pela Edge
-- Function cadastrar-visitante (que roda com a service role). Trava a linha da
-- igreja, checa duplicidade por WhatsApp e anexa. O lock + o carimbo
-- atualizado_em = now() garantem que uma gravação simultânea do app não apague
-- o cadastro recém-inserido (o app usa gravação condicional por versão).
--
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez (create or replace).

create or replace function public.anexar_visitante(
  p_igreja_id text,
  p_visitante jsonb,
  p_whats text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dados jsonb;
  v_dup boolean := false;
  v_vis jsonb := p_visitante;
begin
  -- Trava a linha da igreja até o fim da transação
  select dados into v_dados
    from public.estados
    where igreja_id = p_igreja_id
    for update;

  -- Sem estado da igreja não há onde anexar com segurança (evita "ressuscitar"
  -- uma igreja que só pareceu vazia). O app deve ter criado o estado antes.
  if v_dados is null then
    return jsonb_build_object('ok', false, 'erro', 'igreja_sem_estado');
  end if;

  -- Duplicidade por WhatsApp (só quando o número é válido)
  if length(coalesce(p_whats, '')) >= 10 then
    select exists (
      select 1
        from jsonb_array_elements(coalesce(v_dados->'visitantes', '[]'::jsonb)) e
        where regexp_replace(coalesce(e->>'whatsapp', ''), '\D', '', 'g') = p_whats
    ) into v_dup;
  end if;

  if v_dup then
    v_vis := jsonb_set(v_vis, '{status}', to_jsonb('encerrado'::text));
  end if;

  -- Anexa no início da lista (o app mantém o mais novo primeiro) e bomba a
  -- versão, para o sync dos aparelhos reler e mesclar em vez de sobrescrever.
  update public.estados
     set dados = jsonb_set(
           v_dados, '{visitantes}',
           jsonb_build_array(v_vis) || coalesce(v_dados->'visitantes', '[]'::jsonb)
         ),
         atualizado_em = now()
   where igreja_id = p_igreja_id;

  return jsonb_build_object('ok', true, 'duplicado', v_dup);
end;
$$;

-- Só a service role (usada pela Edge Function) chama esta função. O navegador
-- do visitante nunca a chama direto.
revoke all on function public.anexar_visitante(text, jsonb, text) from public;
grant execute on function public.anexar_visitante(text, jsonb, text) to service_role;
