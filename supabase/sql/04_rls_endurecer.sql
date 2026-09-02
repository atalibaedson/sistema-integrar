-- Prioridade 1 · Passo 4 de 4  ⚠️ RODE POR ÚLTIMO
--
-- Fecha o acesso anônimo ao estado da igreja. Hoje a política aceita QUALQUER
-- sessão (inclusive a anônima que o app cria sozinho), então quem tiver a URL +
-- a chave pública lê e altera tudo. Aqui exigimos um usuário REAL logado (não
-- anônimo). O formulário público continua funcionando pelos outros caminhos:
--   • leitura da config  → função config_publica (SECURITY DEFINER, Passo 2)
--   • gravação do visitante → Edge Function cadastrar-visitante (service role)
--
-- ⚠️ ORDEM OBRIGATÓRIA. Só rode este passo DEPOIS de:
--   1. rodar os Passos 1, 2 e 3;
--   2. publicar a Edge Function cadastrar-visitante (--no-verify-jwt);
--   3. publicar a versão NOVA do app (a que lê a config pela função pública e
--      grava pela Edge Function) e confirmar que a equipe entrou com login.
-- Se rodar antes, os aparelhos param de sincronizar até atualizarem a página,
-- e o formulário público para de gravar.

drop policy if exists "acesso_com_chave_anon" on public.estados;
drop policy if exists "acesso_autenticado" on public.estados;
drop policy if exists "acesso_usuario_real" on public.estados;

create policy "acesso_usuario_real" on public.estados
  for all
  using (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Para reverter (volta a aceitar qualquer sessão), se algo der errado:
--   drop policy if exists "acesso_usuario_real" on public.estados;
--   create policy "acesso_autenticado" on public.estados
--     for all using (auth.role() = 'authenticated')
--     with check (auth.role() = 'authenticated');
