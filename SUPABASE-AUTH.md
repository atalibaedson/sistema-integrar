# Guia: ativar o login com senha (Supabase Auth)

O sistema agora tem **cadastro de integrante com senha, confirmação de e-mail e aprovação
pela liderança**. Para isso funcionar, é preciso configurar o projeto Supabase — são
3 passos no painel, uns 5 minutos. **Faça na ordem abaixo.**

> ⚠️ **Importante:** publique a versão nova do sistema (`npm run build` + deploy) **antes**
> do Passo 3 (aperto da segurança do banco). Se apertar a segurança com a versão antiga
> no ar, os aparelhos da equipe param de sincronizar até atualizarem a página.

---

## Passo 1 — Configurações de autenticação

No painel do projeto (https://supabase.com/dashboard):

1. **Authentication → Sign In / Providers → Email**: confirme que **"Confirm email"
   está LIGADO** (é o padrão). É isso que faz o Supabase enviar o e-mail de confirmação.
2. **Authentication → Sign In / Providers** (ou Settings, conforme a versão do painel):
   ligue **"Allow anonymous sign-ins"**. *Sem isso, os aparelhos da equipe que ainda usam
   o modo aberto ("Vendo como") perdem a sincronização quando o Passo 3 for aplicado.*
3. **Authentication → URL Configuration**:
   - **Site URL**: a URL do site publicado, ex.: `https://SEU-SITE.vercel.app`
     (sem `#/rota` no final — só a raiz).
   - **Redirect URLs**: adicione as duas, também sem `#/rota`:
     - `http://localhost:5173`
     - `https://SEU-SITE.vercel.app`

> Por que sem `#/rota`? O link de confirmação devolve o "crachá" da sessão no `#` da URL,
> e o endereço das páginas do sistema também usa `#`. O app já sabe receber na raiz e
> levar a pessoa para o lugar certo.

## Passo 2 — Pasta de fotos de perfil (Storage)

**SQL Editor → New query**, cole e rode (pode rodar mais de uma vez, não duplica):

```sql
insert into storage.buckets (id, name, public) values ('avatares', 'avatares', true)
on conflict (id) do nothing;

drop policy if exists "avatares_leitura_publica" on storage.objects;
create policy "avatares_leitura_publica" on storage.objects
  for select using (bucket_id = 'avatares');

drop policy if exists "avatares_upload_autenticado" on storage.objects;
create policy "avatares_upload_autenticado" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares');

drop policy if exists "avatares_update_autenticado" on storage.objects;
create policy "avatares_update_autenticado" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares');
```

## Passo 3 — Apertar a segurança do banco (RLS)

Hoje **qualquer pessoa** com a URL + chave pública (que fica visível no código do site)
consegue ler e alterar todos os dados. Este passo fecha essa porta: só quem tem uma
sessão do Supabase (mesmo anônima, que o app cria sozinho) consegue acessar.

**Só rode depois de publicar a versão nova do sistema.** SQL Editor:

```sql
drop policy if exists "acesso_com_chave_anon" on estados;
drop policy if exists "acesso_autenticado" on estados;
create policy "acesso_autenticado" on estados
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

Depois de rodar, abra o sistema em um aparelho e confira que o indicador continua
🟢 **Sincronizado**. Se aparecer erro de sincronização, recarregue a página (o app
cria a sessão anônima ao abrir).

## Passo 4 (opcional) — E-mail de confirmação em português

**Authentication → Emails → Confirm signup**: personalize o assunto e o texto, ex.:

- Assunto: `Confirme seu e-mail — Consolidação iFE`
- Corpo: `<h2>Bem-vindo(a) ao ministério!</h2><p>Clique para confirmar seu e-mail e ativar sua conta:</p><p><a href="{{ .ConfirmationURL }}">Confirmar meu e-mail</a></p>`

---

## Como funciona o fluxo (resumo para a liderança)

1. O novo integrante acessa **`SEU-SITE/#/cadastro-integrante`** e preenche o cadastro
   completo (dados, funções, foto, senha).
2. Recebe um **e-mail de confirmação** e clica no link.
3. A conta entra na fila de **Aprovações** (menu Gestão) — visível apenas para
   **Pastores e Gestão Ministerial** e **Gestão Integração**, com aviso de pendências.
4. Aprovado ✅, a pessoa entra por **`SEU-SITE/#/entrar`** com **e-mail ou WhatsApp** + senha.
   Rejeitado 🚫, ela vê o motivo na tela.
5. Tudo (cadastro, confirmação, aprovação, rejeição) fica registrado na **Auditoria**.

## O que essa fase protege — e o que ainda não

**Protege:** dados deixam de ficar abertos para qualquer um na internet com a chave do
site; contas com senha de verdade (a senha nunca fica salva no sistema — só no Supabase,
criptografada); acesso novo só com aprovação da liderança; trilha de auditoria completa.

**Ainda não protege (próxima fase):** os dados continuam num "pacote" único por igreja —
qualquer sessão válida lê o pacote inteiro; a separação por papel (ex.: só pastor vê
cuidado/crise) é regra do aplicativo, não do banco. O modo aberto ("Vendo como") continua
existindo de propósito, até toda a equipe migrar para o login. O isolamento total exige a
migração para tabelas por entidade (roadmap em [SUPABASE.md](SUPABASE.md)).
