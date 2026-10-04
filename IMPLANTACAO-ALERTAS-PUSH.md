# Implantação — Avisos e notificações no celular (push)

A **central de avisos** (sino, bloco "Precisa de atenção" no Painel, página
Avisos, selos nas listas, aba Configurações → Avisos) **funciona assim que o app
é publicado** — não precisa de nada do servidor.

Já as **notificações no celular** (push) precisam de uma implantação manual no
Supabase, feita por quem é dono do projeto. São 7 passos; leva uns 15 minutos.

> O que o push faz: a cada 30 minutos o servidor calcula os avisos de cada pessoa
> (com as mesmas regras do app) e manda (1) **um resumo por dia** (por volta das 8h
> — configurável) e (2) **na hora**, o aviso de *visitante novo para você* e de
> *caso de cuidado*. Nunca antes das 7h nem depois das 21h (Brasília). A
> notificação só traz **contagens** — nunca o nome de um visitante.

---

## O que mudou no projeto

| Peça | Onde |
|---|---|
| Regras dos avisos (rodam no app **e** no servidor) | `src/alertas.ts` (cópia automática em `supabase/functions/_shared/`) |
| Função do servidor | `supabase/functions/alertas-push/` |
| Tabelas + rotina agendada | `supabase/sql/08_alertas_push.sql` |
| Service worker (só mostra a notificação) | `public/sw.js` |

---

## Passo a passo

### 1. Publicar o app

Commit + push na `main` (a Vercel publica). Sem isso o botão "Ativar notificações"
nem aparece.

### 2. Gerar as chaves de notificação (VAPID)

No terminal, na pasta do projeto:

```bash
npx web-push generate-vapid-keys
```

Ele imprime uma **Public Key** e uma **Private Key**. Guarde as duas (a privada é
segredo: não vai para o GitHub nem para o chat).

### 3. Gravar os segredos no Supabase

Com a CLI do Supabase conectada ao projeto (a mesma usada para publicar as outras
funções). Troque os valores entre `<...>`:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="<Public Key do passo 2>" \
  VAPID_PRIVATE_KEY="<Private Key do passo 2>" \
  VAPID_SUBJECT="mailto:<um e-mail seu>" \
  CRON_SECRET="$(openssl rand -hex 24)"
```

Anote o `CRON_SECRET` que foi gerado (rode `openssl rand -hex 24` à parte se
preferir escolher o valor): ele será usado no passo 6. Também dá para cadastrar os
segredos pelo painel: **Project Settings → Edge Functions → Secrets**.

### 4. Criar as tabelas (SQL, bloco A)

No painel → **SQL Editor**, rode **só o BLOCO A** de `supabase/sql/08_alertas_push.sql`
(do início até o `commit;`). Cria `assinaturas_push` e `alertas_enviados`, com RLS
ligado e sem política — o navegador não enxerga essas tabelas.
Deve responder `Success. No rows returned`.

### 5. Publicar a função

```bash
supabase functions deploy alertas-push
```

O `supabase/config.toml` já deixa a verificação de JWT desligada para esta função
(necessário para a rotina agendada; as ações de cada pessoa validam o login por
dentro). Se publicar pelo painel, desligue **"Verify JWT"** depois.

Confira se a função subiu e se as chaves estão boas (resposta esperada: `"vapid":true`):

```bash
curl -s -X POST "https://yzexsklhixqcbmnbrtdl.supabase.co/functions/v1/alertas-push" -H "Content-Type: application/json" -d '{"acao":"saude"}'
```

Se vier `"vapid":false`, o campo `motivo` diz o que falta (segredo ausente ou chave
inválida — por exemplo, um texto de exemplo colado no lugar da chave). Corrija o
segredo e **publique a função de novo** (os segredos são lidos na partida).

### 6. Testar no seu aparelho

1. Abra o sistema → **Avisos** (sino no topo) → card **Notificações no celular** →
   **Ativar notificações** → permita no navegador.
2. Toque em **Enviar notificação de teste**. Deve chegar em segundos.

> **iPhone/iPad:** só funciona com o sistema instalado na **Tela de Início**
> (Compartilhar → *Adicionar à Tela de Início*) e aberto por esse ícone. Exige iOS 16.4+.
> **Android:** funciona no Chrome, instalado ou não.

Só depois de o teste chegar, ligue a rotina:

### 7. Ligar a rotina agendada (SQL, bloco B)

No **SQL Editor**, rode o **BLOCO B** de `supabase/sql/08_alertas_push.sql`
(está comentado: tire os `-- ` do início das linhas) trocando
`COLE_AQUI_O_CRON_SECRET` pelo valor do `CRON_SECRET` do passo 3.

Para conferir sem mandar nada (simulação — mostra quem receberia o quê):

```bash
curl -s -X POST "https://yzexsklhixqcbmnbrtdl.supabase.co/functions/v1/alertas-push" \
  -H "Content-Type: application/json" -H "x-cron-secret: <CRON_SECRET>" \
  -d '{"acao":"enviar","simular":true}'
```

---

## Como acompanhar

- **Logs da função:** painel → Edge Functions → `alertas-push` → Logs.
- **Quem está inscrito:** `select igreja_id, usuario_id, aparelho, criado_em from assinaturas_push;`
- **O que já foi enviado hoje:** `select * from alertas_enviados order by enviado_em desc limit 50;`
- Inscrições que o aparelho cancelou (ou expiraram) são apagadas sozinhas no envio seguinte.

## Se algo não funcionar

| Sintoma | Causa provável |
|---|---|
| O card de notificações não aparece | Navegador sem suporte, ou iPhone fora da Tela de Início (aparece o aviso explicando). Em `dev:demo` ele é só demonstração. |
| "chaves não configuradas" ao ativar | Faltou o passo 3 (`VAPID_*`) ou a função foi publicada antes dos segredos — publique de novo. |
| "Sua conta não está vinculada a esta igreja" | A conta não tem linha em `membros_igreja` (mesmo requisito do login). |
| Teste não chega | Permissão bloqueada no navegador; modo "Não perturbe"; iPhone aberto fora do ícone da Tela de Início. |
| Resumo não chega | Só sai entre 7h e 21h, depois da hora configurada, e **só se houver avisos**; no máximo 1 por dia. Rode a simulação do passo 7. |

## Mudou uma regra dos avisos?

Edite `src/alertas.ts` e rode `npm run sincronizar:servidor`, depois republique a
função (`supabase functions deploy alertas-push`). Se esquecer de sincronizar, o
teste `servidor-sincronizado` barra o deploy do app.

## Reverter

- Parar os envios: `select cron.unschedule('alertas-push-30min');`
- Apagar tudo: `drop table assinaturas_push; drop table alertas_enviados;` (cada pessoa precisa reativar depois).
- O app continua funcionando sem o push — os avisos seguem no sino e no Painel.
