# Implantação — Prioridade 1 (segurança e proteção de dados)

Esta entrega fecha dois furos graves e reforça a confiabilidade da sincronização:

1. **Vazamento de dados (LGPD).** O formulário público do QR code baixava o
   estado inteiro da igreja (todos os visitantes, pedidos de oração, sinais de
   cuidado) para o celular de quem abrisse o link. Agora a página pública lê só
   a configuração e grava o cadastro por uma função no servidor — o navegador do
   visitante nunca vê os dados dos outros.
2. **Acesso anônimo total.** A regra do banco aceitava qualquer sessão. Passa a
   exigir um usuário real logado; os caminhos públicos usam funções dedicadas.
3. **Gravação condicional por versão.** O app só grava por cima se ninguém
   escreveu desde a leitura — assim o cadastro que o servidor acabou de anexar
   não é apagado pelo sync de um aparelho.
4. **Histórico de backup automático** e **testes** que barram o deploy se a
   mesclagem/sincronização regredir.

> ⚠️ **A ORDEM IMPORTA.** Se o banco for endurecido (Passo 4 do SQL) antes de o
> app novo estar no ar, os aparelhos param de sincronizar e o formulário público
> para de gravar. Siga exatamente a sequência abaixo.

---

## Ordem de implantação

### 1. Rodar o SQL dos passos 1 a 3 (ainda NÃO o 4)

No painel do Supabase → **SQL Editor**, rode, em ordem, o conteúdo de:

- `supabase/sql/01_rpc_anexar_visitante.sql`
- `supabase/sql/02_rpc_config_publica.sql`
- `supabase/sql/03_backup_historico.sql`

Pode rodar cada um mais de uma vez sem duplicar nada.

### 2. Publicar a Edge Function do autocadastro

O formulário é público e o projeto usa chave *publishable* (que não é um JWT),
então a função precisa ir **com verificação de JWT desligada**.

Com a [CLI do Supabase](https://supabase.com/docs/guides/cli) conectada ao
projeto (`supabase link`), o `supabase/config.toml` já fixa isso — basta:

```bash
supabase functions deploy cadastrar-visitante
```

Se preferir publicar pelo painel (Edge Functions → deploy), **desligue a opção
"Verify JWT"** dessa função depois de publicar. E se usar a CLI numa versão que
ignore o config, force pela flag: `--no-verify-jwt`.

Teste rápido (troque a URL e a chave *publishable*):

```bash
curl -X POST 'https://SEU-PROJETO.supabase.co/functions/v1/cadastrar-visitante' \
  -H 'apikey: sb_publishable_...' -H 'Content-Type: application/json' \
  -d '{"igrejaId":"minha-igreja","nome":"Teste","whatsapp":"11999999999","consentimentoLgpd":true}'
```

Deve responder `{"ok":true}` e a ficha "Teste" deve aparecer no app (como
visitante sem responsável). Apague-a depois.

### 3. Publicar a versão nova do app

Faça o deploy normal (commit + push → Netlify). Confirme que:

- o QR/`#/autocadastro` abre, mostra "Conectando…" por um instante e depois
  "Enviar", e um cadastro de teste cai no sistema;
- a equipe entra normalmente **com login** (a tela sem login não conta).

### 4. SÓ ENTÃO endurecer o banco

Depois de confirmar que o app novo está no ar e a equipe está entrando com
login, rode no SQL Editor:

- `supabase/sql/04_rls_endurecer.sql`

Abra o app num aparelho e confirme que o indicador continua **🟢 Sincronizado**,
e que o formulário público ainda grava. Se algo falhar, o próprio arquivo tem o
bloco de reversão comentado no fim.

---

## Como restaurar um backup

O gatilho guarda ~200 versões por igreja em `estados_historico`. Para voltar a
uma versão (no SQL Editor):

```sql
-- ver as versões recentes
select id, gravado_em, tamanho_bytes from estados_historico
 where igreja_id = 'minha-igreja' order by gravado_em desc limit 20;

-- restaurar uma delas
update estados e
   set dados = h.dados, atualizado_em = now()
  from estados_historico h
 where h.id = <ID> and e.igreja_id = h.igreja_id;
```

---

## O que ficou de fora (e por quê)

- **Tabelas por entidade** (um registro por visitante em vez de um JSON por
  igreja). É a mudança estrutural de maior fôlego e não é pré-requisito para o
  que está aqui — o append no servidor resolve a escrita pública com segurança.
  Fica como próxima fase de escala.
- **Cadastro de integrante** ainda mescla o estado após o login (exposição bem
  menor que a do visitante anônimo, e a pessoa está entrando na equipe). Migra
  junto com as tabelas por entidade.
