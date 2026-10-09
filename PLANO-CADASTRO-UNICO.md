# Plano — cadastro único (Integrar · Louvor · Check-iFE) e confirmação de e-mail

> **Status (atualizado em 2026-10-09):** a seção 1 (cadastro com confirmação de e-mail), o furo do vínculo
> e o item 3.5 (exclusão de conta) foram **implementados** — ver `IMPLANTACAO-CADASTRO-UNICO.md`.
> A função de conexões da seção 2 **não** foi criada: o Check-iFE usa a `conexoes_publicas` existente.
> Continua só plano: a seção 3.6 (dados básicos vindos do Check-iFE, "fase seguinte").
> Os trechos de SQL desta página são **rascunhos** (não foram rodados em lugar nenhum).
> Regras deste trabalho: não mexer nos objetos do Louvor (`louvor_*`, bucket `guias`) nem
> nos do Check-iFE; não rodar SQL em produção sem ok; o Integrar só altera o que é dele.

## 0. Resumo e decisões que dependem de você

1. **Confirmação de e-mail:** o app novo é feito para funcionar com ela **ligada e desligada**.
   Assim dá para publicar o app primeiro e só depois religar, e desfazer é só desligar de novo.
2. **A função de conexões** se chamará `public.integrar_conexoes(p_igreja_id text)` e devolve
   `codigo`, `nome`, `ativa` (formato na seção 2). **Hoje não existe "ativa"** no Integrar
   (conexão apagada some de vez): precisa de um campo novo, pequeno.
3. **Perguntas para você** (detalhes nas seções indicadas):
   - **A)** A lista de conexões será lida pelo Check-iFE **antes** de a pessoa estar logada (na tela
     de cadastro)? Se sim, "só logado" não serve — seção 2.3.
   - **B)** Posso **separar** "conexão de que a pessoa participa" de "conexão que ela lidera"
     (hoje o mesmo campo faz os dois papéis) — seção 2.5.
   - **C)** O e-mail do projeto já usa **SMTP próprio**? Sem isso, religar a confirmação é arriscado — seção 1.5.
   - **D)** Qual é o endereço do Integrar de **Resende**? (para a lista de endereços de retorno) — seção 3.4.
   - **E)** Aceita que eu **retire a exclusão de conta de login** da tela Equipe? Numa lista de contas
     compartilhada ela apagaria o acesso da pessoa nos três sistemas — seção 3.5.

---

## 1. Cadastro de integrante com confirmação de e-mail

### 1.1 O que quebra hoje se ligar a confirmação sem mexer

`cadastrarIntegrante` (src/actions.ts) assume que o `signUp` já devolve sessão:

| Passo de hoje | Com confirmação ligada |
|---|---|
| `aguardarVinculoIgreja` (função `registrar-membro`) | **Pula**: sem sessão real não há vínculo com a igreja. |
| Gravar o usuário em `estados` e `sincronizarAgora()` | **Recusado pelo RLS**: a política exige conta real **e** vínculo. A ficha fica só no aparelho de quem se cadastrou; a liderança nunca a vê. |
| Foto em `avatares` | O upload até funcionaria (a sessão anônima do app é do papel `authenticated`), mas a URL só seria guardada junto da ficha — que não grava. |
| Mensagem de erro "already registered" | **Deixa de existir** — ver 1.3(a). |

### 1.2 Fluxo novo

1. **Cadastro (3 passos, igual hoje).** No fim, `supabase.auth.signUp` com:
   - `options.emailRedirectTo` = endereço do app **desta igreja** (raiz, sem `#/rota`; ver 3.4);
   - `options.data` = a ficha (contrato na seção 3.3): campos comuns no topo e o que é só do Integrar
     dentro de `integrar: { funcoes, loginPreferido }`;
   - a **foto** sobe antes, com a sessão anônima que o app já tem, e a URL vai em `foto_url`. Se o upload
     falhar, segue sem foto (a pessoa adiciona depois).
2. **Tela "Confirme seu e-mail"** no lugar de "Cadastro recebido": diz para qual e-mail foi enviado, pede para
   olhar o spam, tem **Reenviar e-mail** (`auth.resend`, com espera de 60 s) e **Já confirmei → Entrar**.
3. **A pessoa clica no link.** O Supabase confirma e devolve a pessoa ao app **já logada** (o app usa o fluxo
   implícito, o mesmo do "Esqueci a senha"). Se ela confirmar em outro aparelho, nada se perde: a ficha está
   na conta, não no aparelho.
4. **Primeiro login → provisionar a ficha.** Em `App.tsx`, quando há sessão real **sem** ficha nesta igreja
   **e** há `user_metadata.integrar`:
   1. aguardar o vínculo (`registrar-membro`) e a 1ª sincronização (o estado local é "virgem");
   2. criar o `Usuario` como `pendente_aprovacao`, com a auditoria de sempre, e sincronizar;
   3. se houver `foto_url`, ela já vai na ficha.
   Da aprovação em diante **nada muda** (Aprovações, funções, hierarquia, "Esqueci a senha").
5. **Contas antigas** não passam por nada disso: já têm ficha e e-mail confirmado.

### 1.3 Detalhes que decidem se funciona

- **(a) E-mail já cadastrado.** Com confirmação ligada o Supabase **não dá erro**: devolve um usuário "de
  mentira" com `identities` vazio. O app passa a testar isso e dizer *"Esse e-mail já tem conta (do Louvor,
  do Check-iFE ou do Integrar). Entre com a mesma senha."*
- **(b) Duas telas de entrada para o mesmo caso: quem já tem conta de outro sistema.** Ao entrar no Integrar
  sem ficha e sem `integrar` nos metadados, hoje cairia numa tela de espera sem explicação. Vira uma tela curta
  **"Completar cadastro de integrante"** (funções, conexão, autorização LGPD; nome e telefone já preenchidos) que
  cria a ficha pendente do mesmo jeito. Com o cadastro único isso será o caso mais comum.
- **(c) Ficha com id previsível.** O id do `Usuario` passa a ser derivado do id da conta (ex.: `u-<authUserId>`).
  Assim, dois aparelhos provisionando ao mesmo tempo **mesclam** em vez de duplicar (a mesclagem é por id).
- **(d) Dedup por e-mail/WhatsApp passa a ser feito no 1º login**, não no `signUp`. Hoje o `signUp` só consegue
  comparar com o **cache local**, porque a sessão anônima não lê `estados`; em aparelho novo a comparação é vazia.
  No 1º login o estado já está sincronizado e o dedup (incluindo a ficha criada antes pela liderança) funciona de verdade.
- **(e) Link vencido ou "consumido" por antivírus de e-mail.** Alguns provedores abrem o link sozinhos e o
  invalidam; o app volta com `#error=...otp_expired`. O app deve reconhecer esse erro e mostrar *"Seu e-mail
  provavelmente já está confirmado: tente entrar. Se não, reenvie."* (o `Entrar` já trata "e-mail não confirmado").
- **(f) Metadado é pedido, não autorização.** `user_metadata` pode ser alterado pela própria conta. O Integrar o
  trata só como **pedido** (`pendente_aprovacao`, funções que a liderança confirma ou ajusta), com tamanho limitado
  e texto sanitizado. Nunca concede acesso.
- **(g) A liderança só vê pedidos já confirmados** — o que também barra cadastros falsos de robôs. A seção
  "Ainda confirmando o e-mail" em Aprovações ficará vazia (pode ser removida depois).
- **(h) Um `Entrar` por igreja não muda.** `redirectTo` do "Esqueci a senha" já é o endereço do próprio site.

### 1.4 O que muda no código (quando for implementar)

`src/actions.ts` (separar `cadastrarIntegrante` em *criar conta* + `provisionarFichaIntegrante`), `src/App.tsx`
(efeito de provisionamento), `src/pages/CadastroIntegrante.tsx` (tela "confirme seu e-mail", reenviar, conexão
obrigatória), nova `CompletarCadastro.tsx`, `src/pages/Entrar.tsx` (mensagens), `src/supabaseClient.ts` (ler o
erro do hash). **Testes automáticos (Vitest):** montagem do pacote de metadados, ficha derivada dos metadados
(id previsível, idempotência, limites), dedup. A parte que depende do Supabase real (e-mail, link) só se testa
de ponta a ponta — ver 1.6.

### 1.5 Antes de religar a confirmação (checklist no painel do Supabase)

1. **SMTP próprio.** O e-mail embutido do Supabase é só para testes: limite muito baixo e, em projetos novos,
   restrito a endereços da equipe do projeto. Conferir em *Authentication → Emails → SMTP*; se não houver,
   configurar um serviço (Resend, SendGrid, Brevo…) **antes**. O "Esqueci a senha" já depende disso.
2. **Redirect URLs** com todos os endereços (seção 3.4) e o **Site URL** apontando para algo estável.
3. **Modelo de e-mail neutro** (seção 3.4).
4. **Contas sem confirmação.** Rodar (só leitura) e conferir que é `0`; senão essas contas ficariam trancadas:
   `select count(*) from auth.users where email_confirmed_at is null and not is_anonymous;`
5. **Manter "Allow anonymous sign-ins" ligado** (o Integrar depende dele).
6. Publicar o app novo → testar (1.6) → **só então** religar.

### 1.6 Como testar sem arriscar a produção

O `npm run dev` grava na produção, então **não** serve. Duas opções, da mais segura:
- **Supabase local** (`supabase start`, precisa do Docker Desktop aberto; hoje o Docker aparece desligado):
  tem caixa de e-mail de teste embutida (Inbucket), confirmação ligável à vontade e nenhum risco.
- **Projeto de teste** descartável no Supabase, com os SQL 01–08 e as funções, e `VITE_SUPABASE_URL`/
  `VITE_SUPABASE_ANON_KEY` apontando para ele.

**Roteiro de aceite:** cadastro novo (com e sem foto) → e-mail → link no mesmo aparelho → ficha pendente aparece
em Aprovações; link aberto em **outro** aparelho; e-mail repetido; conta que já existia em outro sistema; link
vencido; reenviar; "Esqueci a senha"; conta antiga entrando normalmente; cada igreja (Resende e São José).

---

## 2. Consulta de conexões (só leitura)

### 2.1 Nome e formato (para repassar ao Check-iFE)

```
public.integrar_conexoes(p_igreja_id text)  →  tabela (codigo text, nome text, ativa boolean)
```

Chamada: `supabase.rpc('integrar_conexoes', { p_igreja_id: 'ife-sjc' })`. Resposta (JSON, ordenada por nome):

```json
[
  { "codigo": "k3j2h1g0lx9a", "nome": "Conexão Família Centro", "ativa": true },
  { "codigo": "m8w1q0z5r2bc", "nome": "Conexão Jovens Norte",  "ativa": false }
]
```

- `p_igreja_id`: `minha-igreja` (iFE Resende) ou `ife-sjc` (iFE São José). Mesmos ids da tabela `igrejas`,
  que podem servir de chave comum entre os sistemas.
- **`codigo`** = o `id` interno da conexão no Integrar: texto opaco, **estável e nunca reaproveitado**. Não há um
  "código" humano hoje; o Check-iFE deve guardar este valor e mostrar o `nome`.
- **`ativa`**: ver 2.2. **Conexão apagada deixa de aparecer** na lista; o Check-iFE deve tratar um código
  guardado que não veio mais como "conexão encerrada" (nunca apagar a pessoa por isso).
- Nenhum outro dado do bloco (nem líder, endereço, horário ou membros) é devolvido.
- A opção **"Ainda não participo de uma Conexão"** não vem da função: cada sistema a oferece (valor `nenhuma`).

### 2.2 Campo novo `ativa` (pequeno)

`Conexao.ativa?: boolean` (ausente = ativa, **sem migração**) e um interruptor "Grupo ativo" na aba Grupos de
Configurações. Permite **desativar em vez de apagar**, preservando o código. Conexão desativada continua na
lista com `ativa: false`; os cadastros do Integrar e do Check-iFE não oferecem as inativas para escolha nova.
(`types.ts` é copiado para o servidor: rodar `npm run sincronizar:servidor`.)

### 2.3 Rascunho do SQL — arquivo `supabase/sql/09_rpc_integrar_conexoes.sql` (não executado)

```sql
create or replace function public.integrar_conexoes(p_igreja_id text)
returns table (codigo text, nome text, ativa boolean)
language sql stable security definer set search_path = public
as $$
  select c->>'id', c->>'nome', coalesce((c->'ativa') <> 'false'::jsonb, true)
    from public.estados e,
         jsonb_array_elements(coalesce(e.dados->'conexoes', '[]'::jsonb)) c
   where e.igreja_id = p_igreja_id
     and coalesce(c->>'id', '') <> '' and coalesce(c->>'nome', '') <> ''
     -- só conta real: toda visita à página pública também tem sessão ("anônima"),
     -- e anônima TAMBÉM é do papel `authenticated`
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
   order by c->>'nome';
$$;
revoke all on function public.integrar_conexoes(text) from public, anon;
grant execute on function public.integrar_conexoes(text) to authenticated;
```

Pontos de atenção: (i) "para quem estiver logado" **exclui as sessões anônimas** de propósito (checagem acima);
(ii) **pergunta A:** se o Check-iFE precisa da lista na tela de cadastro (antes do login), a versão "só logado"
não atende. O Integrar já expõe `conexoes_publicas` (id e nome, **também para anônimos**) na tela "Criar meu
acesso", então abrir esta mesma lista a anônimos não amplia a exposição: bastaria `grant ... to anon` e tirar a
checagem. Recomendo isso **se** o cadastro do Check-iFE for público; (iii) a função **não** exige vínculo com a
igreja de propósito: quem acaba de se cadastrar ainda não é membro do Integrar. (iv) `conexoes_publicas` fica como
está (a tela atual depende dela) e pode ser aposentada depois.

### 2.4 Conexão obrigatória no cadastro do Integrar

Faz sentido, e é mudança pequena: o seletor deixa de ter "— selecionar —", passa a exigir uma escolha e ganha
a opção **"Ainda não participo de uma Conexão"**. Só entram as `ativa`. Vale também para a tela "Completar cadastro".

### 2.5 Atenção: o campo `Usuario.conexaoId` hoje significa "grupo que a pessoa **lidera**"

No código, `conexaoId` do usuário é usado como o grupo do **líder** (mensagens `{{nome_conexão}}`, Painel do
líder, e em Equipe escolher a conexão de alguém o torna líder dela). O formulário de cadastro, porém, pergunta
"de qual Conexão você **faz parte**" e grava no mesmo campo. Com o cadastro único passando a ser a fonte de "de
que Conexão a pessoa participa", os dois conceitos precisam de campos separados:
- `Usuario.conexaoId` continua = grupo que lidera (nada muda);
- novo `Usuario.conexaoParticipaId` (ou `'nenhuma'`) = grupo de que participa, vindo do cadastro; **não** vira liderança.
**Pergunta B.**

---

## 3. Avisos e efeitos

### 3.1 Nomes: há conflito?

Nenhum conflito direto com a lista do Check-iFE (`pessoas, ministerios, eventos, presencas, ausencias,
declaracoes, requisitos, auditoria, funcoes, equipes, escala_*`). No Integrar, "auditoria", "funções" e "equipe"
vivem **dentro do JSON** de `estados`, não são tabelas. Para o Check-iFE **não reutilizar**, os nomes do Integrar:

| Tipo | Nomes do Integrar |
|---|---|
| Tabelas | `estados`, `estados_historico`, `membros_igreja`, `igrejas`, `assinaturas_push`, `alertas_enviados` |
| Funções SQL | `anexar_visitante`, `config_publica`, `conexoes_publicas`, `snapshot_estado` (gatilho em `estados`), `integrar_conexoes` (nova) |
| Gatilho / agenda | `trg_snapshot_estado`; tarefa `alertas-push-30min` |
| Storage | bucket `avatares` (público; políticas `avatares_*`) |
| Edge Functions | `cadastrar-visitante`, `registrar-membro`, `deletar-usuario-auth`, `alertas-push` |

Atenção a **`igrejas`**: já existe (id `minha-igreja`/`ife-sjc`, nome, UF). Se o Check-iFE também tem "igreja",
**reutilize esta tabela e estes ids** em vez de criar outra.

### 3.2 O gatilho em `auth.users` (o que o Check-iFE precisa fazer)

Pontos que podem derrubar os três sistemas se ficarem de fora:

1. **Ignorar contas anônimas** (`new.is_anonymous = true`). O Integrar cria **uma sessão anônima por aparelho
   que abre o app, inclusive quem só abre o QR de visitante** — sem o filtro nasceriam milhares de "pessoas" fantasmas.
2. **O gatilho nunca pode falhar.** Se ele lançar erro, o Supabase recusa o cadastro **e o login anônimo**, e o
   Integrar para de sincronizar em todos os aparelhos. Usar `security definer`, `set search_path`, bloco
   `exception when others` que registra o erro numa tabela e segue.
3. **Quando criar a pessoa:** com confirmação ligada, o `insert` em `auth.users` acontece no cadastro, **antes** de
   confirmar. Sugerir criar a pessoa quando `email_confirmed_at` ficar preenchido (ou marcá-la "não confirmada"),
   para robôs não gerarem pessoas.
4. **Ler `raw_user_meta_data`** com cuidado (é editável pela conta): validar tipos e tamanhos; nunca usar para dar permissão.
5. **Exclusão de conta:** definir o que acontece com a pessoa (`on delete` do vínculo). Ver 3.5.
6. Testar em Supabase local/projeto de teste antes de aplicar na produção.

### 3.3 Dados que o `signUp` do Integrar manda (contrato proposto)

Campos comuns no topo, **snake_case**, para a pessoa nascer completa; o que é só do Integrar vai dentro de `integrar`:

| Chave | Conteúdo | Origem no Integrar |
|---|---|---|
| `nome` | nome completo | já coletado |
| `telefone` | só dígitos, com DDD (ex.: `12999990000`) | WhatsApp, já coletado |
| `data_nascimento` | `AAAA-MM-DD` | já coletado (opcional) |
| `estado_civil` | `solteiro`\|`casado`\|`divorciado`\|`viuvo`\|`outro` | já coletado (opcional) |
| `conexao_codigo` | código da conexão (2.1) ou `nenhuma` | obrigatório (2.4) |
| `igreja_id` | `minha-igreja` \| `ife-sjc` | endereço do site |
| `origem` | `integrar` | fixo |
| `foto_url` | URL pública em `avatares` | opcional |
| `consentimento_lgpd`, `consentimento_em` | `true`, data/hora ISO | já coletado |
| `integrar` | `{ funcoes: [...], loginPreferido }` | só o Integrar lê |

**Não coletamos hoje:** endereço, bairro e cônjuge. O cadastro do Integrar não pergunta isso; se o Check-iFE
quiser a pessoa completa, ou ele coleta no próprio cadastro, ou o Integrar passa a perguntar (decisão futura).
O mapeamento de `estado_civil` para as opções do Check-iFE é dele.

### 3.4 E-mails automáticos e endereços de retorno

- **Um modelo só por projeto.** O texto do Integrar atual (SUPABASE-AUTH.md, passo 4) deixa de valer: o modelo
  passa a ser neutro ("Igreja Família Extraordinária"). Pode usar o nome da pessoa: `{{ .Data.nome }}`.
- **Redirect URLs** (lista permitida) precisa ter **cada** endereço do Integrar, e o app **sempre** passa o
  próprio endereço (`emailRedirectTo` no cadastro e no reenvio; `redirectTo` no "Esqueci a senha", que já faz isso):
  - `https://integracaoifesjc.ifamiliaextraordinaria.com.br`
  - **endereço do Integrar de Resende** — *pergunta D* (não está no repositório: Resende é o padrão do código)
  - `http://localhost:5173` (desenvolvimento)
  - Um curinga (`https://*.ifamiliaextraordinaria.com.br`) cobre todos, mas também libera os outros dois
    sistemas; endereços exatos são mais seguros.
- **Site URL** é um só para o projeto: é o destino de e-mails que não informam retorno. Escolher o que for mais neutro.
- **Cadastro aberto no subdomínio de visitante** (`visitante…`/`cadastro…`): o retorno deve ser o endereço do **app**
  da igreja, não o da página de visitante. O app terá um mapa igreja → endereço.

### 3.5 Outros efeitos que encontrei (não pedidos, mas importam com a lista única de contas)

1. **Excluir integrante apaga a conta de login nos três sistemas.** `Equipe.tsx` chama a função
   `deletar-usuario-auth`, que remove o usuário do Supabase Auth. Com lista única, isso tira o acesso da pessoa
   ao Louvor e ao Check-iFE e pode apagar a "pessoa" (e o histórico de presenças) por cascata.
   **Plano:** o Integrar deixa de apagar a conta; só remove a ficha e o vínculo da igreja (`membros_igreja`), por
   uma função de servidor restrita a Pastor/Gestão. *Pergunta E.*
2. **`deletar-usuario-auth` é fraca hoje:** aceita **qualquer** sessão válida (inclusive anônima), sem checar
   papel. Só não é explorada porque é preciso conhecer o id da conta. Recomendo **desativá-la** junto com o item 1.
3. **Vínculo automático com a igreja.** `registrar-membro` liga ao Integrar **qualquer** conta real que abrir o
   site, e o RLS libera a leitura do `estados` inteiro (todos os visitantes) a quem tem vínculo — **antes da
   aprovação**. Com o cadastro único, **todos** os membros da igreja terão conta; qualquer um que abrir o Integrar
   passaria a ter o vínculo. Reforço sugerido (fase posterior): criar a ficha pendente **pelo servidor** (como
   `cadastrar-visitante`) e só criar o vínculo **na aprovação**. Fora do escopo agora, mas o risco cresce com o cadastro único.
4. **Bucket `avatares`** aceita upload de qualquer sessão (inclusive anônima). Sugestão: limitar tamanho e tipo de
   arquivo no bucket e, com o tempo, limpar fotos de cadastros nunca confirmados.
5. **Louvor e Check-iFE** também precisam tratar a confirmação religada (telas de espera, reenvio); não é com o Integrar.

### 3.6 Futuro: dados básicos vindos do Check-iFE (sem plano de migração)

O que o Integrar precisará decidir quando isso chegar:
- **Quem é a fonte da verdade** de nome, e-mail, telefone, nascimento, endereço, estado civil, cônjuge e conexão.
  Hoje esses campos vivem em `Usuario` (dentro do JSON). O vínculo natural é `authUserId` ↔ conta (já existe).
- O Integrar continua dono de **acesso, funções, hierarquia, aprovação e conexão que lidera**.
- **Telas afetadas:** Equipe (cartão da pessoa), Aprovações, Painel do líder, Auditoria (nomes congelados), e o
  login por WhatsApp (`Entrar` procura o WhatsApp nos usuários do estado).
- **Como ler:** por função de servidor (como a das conexões), nunca abrindo as tabelas do Check-iFE. Lembrando
  que o Integrar trabalha **offline** com cópia no aparelho: o dado lido vira cache e precisa de data.
- **Visitantes** são outra coisa (não têm conta); só viram "pessoa" se algum dia forem integrados — a ligar depois.

---

## 4. Ordem proposta

| # | Etapa | Quem |
|---|---|---|
| 1 | Responder as perguntas A–E; Check-iFE confirma o contrato de metadados (3.3) e as regras do gatilho (3.2) | você / Check-iFE |
| 2 | Integrar: campo `ativa`, função `integrar_conexoes` (SQL 09), conexão obrigatória, `conexaoParticipaId` | Integrar |
| 3 | Integrar: cadastro com `signUp` + metadados, tela "confirme seu e-mail", provisionamento no 1º login, "Completar cadastro", testes | Integrar |
| 4 | Testar tudo em Supabase local/projeto de teste (1.6) | Integrar |
| 5 | Publicar o app (funciona com a confirmação **ainda desligada**) | Integrar |
| 6 | Checklist 1.5 (SMTP, endereços, modelo neutro, query das contas) e **religar a confirmação** | você |
| 7 | Retirar `deletar-usuario-auth` do fluxo da Equipe | Integrar (após E) |

**Rollback:** desligar "Confirm email" no painel — o app novo continua funcionando.

## 5. Texto pronto para o Check-iFE

> O Integrar é dono da lista de conexões. Para consultar: `rpc('integrar_conexoes', { p_igreja_id })`, com
> `p_igreja_id` = `minha-igreja` (Resende) ou `ife-sjc` (São José). Devolve `[{ codigo, nome, ativa }]`, ordenada por
> nome (`codigo` é opaco e estável; conexão apagada some da lista). Esta função **[exige conta real — não anônima]**
> *(ajustar conforme a pergunta A)*. O `signUp` do Integrar manda em `user_metadata`: `nome`, `telefone` (só dígitos),
> `data_nascimento` (AAAA-MM-DD), `estado_civil`, `conexao_codigo` (ou `nenhuma`), `igreja_id`, `origem`='integrar',
> `foto_url`, `consentimento_lgpd`, `consentimento_em` e `integrar` (objeto só do Integrar). No gatilho de `auth.users`:
> **ignore `is_anonymous`** (o Integrar cria uma sessão anônima por aparelho), **nunca deixe o gatilho falhar**
> (bloquearia cadastro e login anônimo dos três sistemas) e considere criar a pessoa só quando `email_confirmed_at`
> for preenchido. `igrejas` já existe no projeto (ids `minha-igreja`, `ife-sjc`): reutilize.
