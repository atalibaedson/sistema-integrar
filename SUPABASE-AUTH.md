# Guia: login com senha (Supabase Auth)

O sistema tem **cadastro de integrante com senha e aprovação pela liderança**. O projeto
Supabase (`yzexsklhixqcbmnbrtdl`) é **compartilhado** com o Louvor e o Check-iFE: a lista de
contas (`auth.users`) é uma só, e os e-mails automáticos (confirmar e-mail, redefinir senha,
convite) usam **um modelo só** para o projeto.

> ## Situação atual (atualizada em 2026-10-08)
>
> | Item | Estado |
> |---|---|
> | **"Confirm email"** | **DESLIGADO.** A conta nasce já confirmada e a pessoa entra assim que a liderança aprova. |
> | "Allow anonymous sign-ins" | **LIGADO** (o app cria uma sessão anônima por aparelho para o RLS; **não desligue**). |
> | RLS de `estados` | **Por igreja** (política `acesso_membro_igreja`, vínculo em `membros_igreja`), ativo desde 2026-10-03. |
>
> **A confirmação de e-mail será religada**, mas **só depois** de o Integrar publicar a mudança que a
> suporta: hoje o cadastro depende de a conta já ter sessão logo após o `signUp`, o que não acontece com
> a confirmação ligada. **Não religue antes.** O plano completo, o checklist e a ordem estão em
> [PLANO-CADASTRO-UNICO.md](PLANO-CADASTRO-UNICO.md).

---

## Passo 1 — Configurações de autenticação

No painel do projeto (https://supabase.com/dashboard):

1. **Authentication → Sign In / Providers → Email → "Confirm email"**: hoje **desligado** (ver quadro acima).
   Ao religar (apenas depois da publicação descrita no plano), antes confira o checklist da seção 1.5 do
   plano: **SMTP próprio** (o e-mail embutido do Supabase é só para testes), endereços de retorno e modelo de e-mail.
2. **Authentication → Sign In / Providers**: **"Allow anonymous sign-ins" ligado.**
3. **Authentication → URL Configuration**:
   - **Site URL**: um só para o projeto inteiro (é o destino de e-mails que não informam retorno).
   - **Redirect URLs**: **todos** os endereços dos sistemas que usam e-mail de retorno, **sem `#/rota`**
     (só a raiz). Para o Integrar:
     - `https://integracaoifesjc.ifamiliaextraordinaria.com.br` (São José dos Campos)
     - o endereço do Integrar de Resende
     - `http://localhost:5173` (desenvolvimento)
   - Cada sistema deve **informar o próprio endereço** ao pedir o e-mail (`emailRedirectTo` no cadastro,
     `redirectTo` no "Esqueci a senha"). O Integrar já faz isso no "Esqueci a senha".

> Por que sem `#/rota`? O link de confirmação devolve o "crachá" da sessão no `#` da URL, e o endereço
> das páginas do sistema também usa `#`. O app já sabe receber na raiz e levar a pessoa para o lugar certo.

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

> Atenção: o papel `authenticated` **inclui as sessões anônimas** do app. Qualquer aparelho que abre
> o sistema pode enviar foto para este bucket. Por isso o plano sugere limitar tamanho e tipo de arquivo.

## Passo 3 — Segurança do banco (RLS) — **já aplicada, por igreja**

> ⚠️ **Não rode mais a política antiga `acesso_autenticado`** (que constava aqui). Políticas do
> Postgres se **somam**: rodá-la de novo reabriria os dados de **todas** as igrejas a qualquer sessão
> (até anônima), anulando o isolamento por igreja.

O acesso a `estados` hoje é decidido por `acesso_membro_igreja`: a pessoa precisa ser conta real (não
anônima) **e** ter vínculo com a igreja em `membros_igreja`. Esse vínculo é criado pela função
`registrar-membro` no primeiro login. Os SQL, na ordem e com o roteiro de reversão:
`supabase/sql/04_rls_endurecer.sql` → `05_rls_por_igreja.sql` → `06_ativar_sao_jose.sql`.

## Passo 4 — E-mails (modelo único, texto neutro)

**Authentication → Emails**: os modelos (confirmar cadastro, redefinir senha, convite) valem para o
**projeto inteiro**. Por isso o texto deve ser **neutro** ("Igreja Família Extraordinária"), sem citar
um sistema específico. Dá para usar o nome da pessoa (`{{ .Data.nome }}`) e o link (`{{ .ConfirmationURL }}`).

Exemplo — **Confirm signup**:

- Assunto: `Confirme seu e-mail — Igreja Família Extraordinária`
- Corpo: `<h2>Bem-vindo(a)!</h2><p>Clique para confirmar seu e-mail e ativar sua conta:</p><p><a href="{{ .ConfirmationURL }}">Confirmar meu e-mail</a></p>`

---

## Como funciona o fluxo hoje (resumo para a liderança)

1. O novo integrante acessa **`SEU-SITE/#/cadastro-integrante`** e preenche o cadastro
   completo (dados, funções, foto, senha).
2. A conta é criada **já confirmada** (a confirmação por e-mail está desligada) e o pedido entra na fila de
   **Aprovações** (menu Gestão), visível apenas para **Pastores e Gestão Ministerial** e **Gestão Integração**,
   com aviso de pendências.
3. Aprovado ✅, a pessoa entra por **`SEU-SITE/#/entrar`** com **e-mail ou WhatsApp** + senha.
   Rejeitado 🚫, ela vê o motivo na tela. "Esqueci a senha" envia o link por e-mail.
4. Tudo (cadastro, aprovação, rejeição) fica registrado na **Auditoria**.

**Depois que a confirmação for religada** (ver o plano): o passo 2 passa a ser *"a pessoa recebe um e-mail,
clica no link, e só então o pedido aparece em Aprovações"*. O restante não muda.

## Funções do servidor que o login usa (Edge Functions)

| Função | Para quê | JWT |
|---|---|---|
| `registrar-membro` | liga a conta recém-logada à igreja do site (RLS por igreja) | exigido |
| `cadastrar-visitante` | grava o autocadastro público do visitante | desligado |
| `alertas-push` | notificações no celular (ver IMPLANTACAO-ALERTAS-PUSH.md) | desligado (valida por dentro) |
| `deletar-usuario-auth` | apaga a conta de login ao excluir integrante | exigido — **ver aviso abaixo** |

> ⚠️ Com a lista de contas **compartilhada**, apagar a conta no Auth tira o acesso da pessoa **também do
> Louvor e do Check-iFE**. O plano prevê o Integrar deixar de usar `deletar-usuario-auth` (remover só a
> ficha e o vínculo da igreja). Até lá, **tenha cuidado ao excluir integrantes** na tela Equipe.

## O que essa fase protege — e o que ainda não

**Protege:** contas com senha de verdade (a senha nunca fica salva no sistema — só no Supabase,
criptografada); acesso novo só com aprovação da liderança; **isolamento entre igrejas** pelo RLS por
vínculo; trilha de auditoria completa; o formulário público do visitante não baixa dados da igreja.

**Ainda não protege:** os dados continuam num "pacote" único por igreja — **quem tem vínculo com a igreja
lê o pacote inteiro**, e o vínculo é criado no primeiro login, **antes** da aprovação da liderança; a
separação por papel (ex.: só pastor vê cuidado/crise) é regra do aplicativo, não do banco. O plano propõe
reforçar isso (ficha pendente criada pelo servidor, vínculo só na aprovação). O isolamento total por
papel exigiria a migração para tabelas por entidade (roadmap em [SUPABASE.md](SUPABASE.md)).
