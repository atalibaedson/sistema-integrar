-- Revisar quem está em membros_igreja SEM ter sido aprovado pela liderança do Integrar
--
-- Contexto: a função registrar-membro antiga ligava QUALQUER conta logada do projeto à
-- igreja. Como o vínculo libera a leitura do bloco `estados` (cuidado pastoral, crises…),
-- essas contas podem ler tudo. A função nova só liga quem está APROVADO. Este arquivo
-- ajuda a achar e a remover os vínculos que já existiam sem aprovação.
--
-- ✔ Só mexe na tabela do Integrar (membros_igreja). Nada do Louvor nem do Check-iFE.
-- ✔ A PARTE A é só leitura. A PARTE B (remoção) vem comentada, para você rodar de
--   propósito, só com a lista revisada, depois de olhar o resultado da parte A.
-- ✔ Quem tiver o vínculo removido continua com a conta de login; ao entrar no Integrar
--   verá "aguardando aprovação" (se tiver pedido) ou será convidado a completar o cadastro.
--
-- Rode no SQL Editor depois de publicar o app novo e a função nova (ver
-- IMPLANTACAO-CADASTRO-UNICO.md, passo 5).

-- ============================== PARTE A — só leitura ==============================
-- Uma linha por vínculo, dizendo se há uma ficha APROVADA e ativa que o justifique.
--   ok            → aprovado e ativo: o vínculo é legítimo
--   NÃO APROVADO  → tem ficha, mas pendente/rejeitada: o vínculo NÃO deveria existir
--   DESATIVADO    → ficha aprovada, mas a pessoa foi desativada na Equipe
--   SEM FICHA     → nenhuma ficha nesta igreja. Atenção: pastores de rede (vínculo criado
--                   por SQL em mais de uma igreja) aparecem assim na outra igreja até
--                   trocarem de igreja pela primeira vez — confira antes de remover.
with fichas as (
  select e.igreja_id, u as ficha
    from public.estados e,
         jsonb_array_elements(coalesce(e.dados->'usuarios', '[]'::jsonb)) u
),
vinculos as (
  select m.auth_user_id, m.igreja_id, au.email, au.created_at, au.last_sign_in_at,
         (select count(*) from public.membros_igreja x where x.auth_user_id = m.auth_user_id) as qtd_igrejas
    from public.membros_igreja m
    join auth.users au on au.id = m.auth_user_id
   where m.igreja_id in ('minha-igreja', 'ife-sjc')
)
select v.igreja_id,
       v.email,
       v.created_at::date        as conta_criada_em,
       v.last_sign_in_at::date   as ultimo_acesso,
       v.qtd_igrejas             as igrejas_vinculadas,
       fi.ficha->>'nome'         as nome_na_ficha,
       fi.ficha->>'statusAcesso' as situacao_na_ficha,
       case
         when fi.ficha is null                                         then 'SEM FICHA'
         when fi.ficha->>'statusAcesso' <> 'aprovado'                  then 'NÃO APROVADO'
         when coalesce(fi.ficha->>'ativo', 'true') = 'false'           then 'DESATIVADO'
         else 'ok'
       end as situacao_do_vinculo
  from vinculos v
  left join lateral (
    select f.ficha
      from fichas f
     where f.igreja_id = v.igreja_id
       and ( f.ficha->>'authUserId' = v.auth_user_id::text
          or (coalesce(f.ficha->>'authUserId', '') = ''
              and lower(coalesce(f.ficha->>'email', '')) = lower(coalesce(v.email, ''))) )
     order by (f.ficha->>'statusAcesso' = 'aprovado') desc
     limit 1
  ) fi on true
 order by (case when fi.ficha is null or fi.ficha->>'statusAcesso' <> 'aprovado'
                or coalesce(fi.ficha->>'ativo', 'true') = 'false' then 0 else 1 end),
          v.igreja_id, v.email;

-- Resumo rápido (quantos vínculos legítimos × suspeitos) — rode se quiser só os números:
-- select igreja_id, count(*) as vinculos from public.membros_igreja
--  where igreja_id in ('minha-igreja', 'ife-sjc') group by igreja_id;

-- ============================ PARTE B — remover (de propósito) ============================
-- 1) Rode a PARTE A e anote os e-mails dos vínculos que NÃO deveriam existir
--    (NÃO APROVADO, e SEM FICHA que não sejam pastores de rede).
-- 2) Cole APENAS esses e-mails abaixo, tire os "-- " do início das linhas e rode.
--    O RETURNING mostra o que foi removido. Se algo estiver errado, troque `commit` por
--    `rollback`. Para desfazer depois de confirmar: basta aprovar a pessoa de novo no
--    Integrar (a aprovação recria o vínculo).
--
-- begin;
--   delete from public.membros_igreja m
--    using auth.users au
--    where au.id = m.auth_user_id
--      and m.igreja_id in ('minha-igreja', 'ife-sjc')       -- só as igrejas do Integrar
--      and lower(au.email) in (
--        'COLE.AQUI@exemplo.com'
--        -- , 'outro@exemplo.com'
--      )
--   returning au.email, m.igreja_id;
-- commit;
