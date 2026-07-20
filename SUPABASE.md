# Guia: salvar os dados online (Supabase) e publicar o sistema

Siga esta ordem: primeiro a nuvem de dados (parte 1), depois a publicação do site (parte 2).

---

## Parte 1 — Banco de dados online (Supabase)

O Supabase é um serviço de banco de dados na nuvem com plano **gratuito** (suficiente para começar — o limite gratuito comporta milhares de visitantes).

### Passo a passo (±10 minutos)

1. **Crie a conta:** acesse https://supabase.com → "Start your project" → entre com Google ou GitHub.
2. **Crie um projeto:** botão "New project" → dê um nome (ex.: `consolidacao`), defina uma senha de banco (guarde-a) e escolha a região `South America (São Paulo)`.
3. **Crie a tabela:** no menu lateral do projeto, abra **SQL Editor** → "New query" → cole o código abaixo → botão **Run**:

```sql
create table if not exists estados (
  igreja_id text primary key,
  dados jsonb not null,
  atualizado_em timestamptz default now()
);

alter table estados enable row level security;

drop policy if exists "acesso_com_chave_anon" on estados;
create policy "acesso_com_chave_anon" on estados
  for all using (true) with check (true);
```

> Pode rodar este script quantas vezes quiser — ele não duplica nada. Se aparecer "policy already exists" com a versão antiga do script, é sinal de que já estava tudo criado: siga em frente.

4. **Pegue as credenciais:** menu **Settings (⚙️) → API Keys**. Copie:
   - **Publishable key** (começa com `sb_publishable_…`) — botão de copiar ao lado da chave "default". *(Em projetos antigos, a aba "Legacy anon" com a chave `eyJ…` também funciona.)*
   - **URL do projeto:** em **Settings → Data API** aparece como "Project URL" (algo como `https://abcdefgh.supabase.co`). Atenção: **não** use a "secret key" — essa nunca vai no app.
5. **Conecte o app:** no sistema, vá em **Configurações → 💾 Dados → 🌐 Sincronização online**, cole a URL e a chave, escolha um identificador para a igreja (ex.: `ife-matriz`) e clique em **Conectar e sincronizar**.

Pronto: a partir daí, toda mudança é salva online automaticamente (indicador 🟢 na mesma tela). Para usar em outro dispositivo, conecte-o com **os mesmos três dados** — ele vai perguntar se você quer adotar os dados da nuvem.

### Limitações desta fase (importante)

- **Login:** o sistema já tem cadastro de integrante com senha, confirmação de e-mail e aprovação pela liderança — o passo a passo de ativação está em **[SUPABASE-AUTH.md](SUPABASE-AUTH.md)** (inclui apertar a segurança do banco para bloquear acesso anônimo). O modo aberto ("Vendo como") continua disponível em paralelo enquanto a equipe migra.
- **Uso simultâneo:** a gravação mescla os dados registro a registro (os cadastros de vários computadores se **somam**, e exclusões valem em todos), além de puxar novidades a cada minuto e ao voltar para a janela. Se o MESMO registro for editado em dois lugares ao mesmo tempo, vence a edição mais recente. **Importante:** todos os dispositivos precisam usar a versão atual do app — uma versão antiga ainda grava no modelo "última gravação vence" e pode desfazer dados dos outros.

---

## Parte 2 — Publicar o sistema online (Vercel)

Com os dados na nuvem, o site pode ser publicado para acesso de qualquer lugar (sem precisar do seu Mac ligado).

1. Crie uma conta em https://vercel.com (ou https://netlify.com — equivalente).
2. Gere a versão de produção do sistema:
   ```bash
   npm run build
   ```
3. **Opção simples (sem Git):** instale a CLI e publique:
   ```bash
   npm i -g vercel
   vercel deploy dist --prod
   ```
   A Vercel devolve uma URL pública (ex.: `https://consolidacao.vercel.app`).
4. No celular de cada membro da equipe: abra a URL → conecte à nuvem (Configurações → Dados) → "Adicionar à tela de início".
5. O **QR code do autocadastro** passa a apontar para `https://SUA-URL/#/autocadastro`.

> Dica: dá para usar um domínio próprio (ex.: `consolidacao.suaigreja.com.br`) nas configurações da Vercel.

---

## Roadmap para o produto (fase 2)

Para vender a várias igrejas com segurança, os próximos passos são:

1. ~~**Login por usuário** (Supabase Auth)~~ — ✅ implementado: cadastro de integrante, confirmação de e-mail e aprovação pela liderança (ver [SUPABASE-AUTH.md](SUPABASE-AUTH.md)).
2. **Tabelas por entidade** (visitantes, interações, etc.) com regras de acesso por igreja (Row Level Security) — sincronização mais granular que a mesclagem atual e isolamento total dos dados de cada igreja.
3. **Tempo real:** mudanças de um usuário aparecem na tela dos outros sem recarregar.
