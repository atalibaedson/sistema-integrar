# Integrar → Check-iFE: pedidos da etapa 2 (cadastro único)

> Texto para colar na sessão do Check-iFE. Origem: Sistema Integrar v2.7.1, 2026-10-14.
> Plano completo do lado do Integrar: `PLANO-ETAPA-2-CADASTRO-UNICO.md` (repo do Integrar).

## Contexto

O Integrar vai passar a **ler** do cadastro único (`pessoas`, `pessoas_sensivel`) em vez de manter cópia, e a
**gravar só a linha da própria pessoa** (como já foi autorizado para o Louvor). Nada foi alterado em objetos do
Check-iFE. O Integrar continua dono de: acesso ao Integrar, funções, hierarquia, aprovação, conexão que a pessoa
**lidera**, foto e tudo de visitantes.

**Decisões do dono (Edson), 2026-10-14:**
- **D1** — O Integrar define a que igreja(s) cada pastor tem acesso (pode ser mais de uma). O Check-iFE usa isso
  para **limitar por igreja** a leitura de `pastor`/`integracao` (hoje o papel é global).
- **D2** — A igreja da pessoa é definida **no Integrar**; o Check-iFE consulta.
- **D3** — Pedir ao Check-iFE para aceitar estado civil **`outro`** (o Integrar passa a ter `uniao_estavel`).
- **D4** — O Integrar terá uma tela "Sem conexão" para a Gestão Integração (lê `conexao_situacao = 'nao_participa'`).
- **D5** — O Integrar grava a linha da **própria** pessoa (termo, conexão, estado civil, nome/telefone/nascimento).
- **D6** — `data_nascimento` passa a vir só do cadastro único.
- **D7** — Fichas sem login continuam só no Integrar até a pessoa criar conta.
- **D8** — A conta de equipe compartilhada "Integração - IFE" (`integracaoextraordinaria@gmail.com`) continua.

## Já pronto no Integrar (para o Check-iFE usar)

Funções **só leitura**, já criadas no projeto (`supabase/sql/10_funcoes_para_checkife.sql`). Sessão anônima recebe vazio.

| Função | Quem chama | Devolve |
|---|---|---|
| `integrar_igrejas()` | anônimo e logado | `[{ id, nome, cidade }]` — use `cidade` para diferenciar (o nome pode ser igual) |
| `integrar_minhas_igrejas()` | logado | `text[]` — igrejas a que **quem chama** tem acesso no Integrar |
| `integrar_igrejas_da_pessoa(p_user_id uuid)` | logado | `text[]` — igrejas em que a pessoa tem ficha ativa (aprovada ou pedido em análise) ou acesso |

Igrejas hoje: `minha-igreja` (iFE Resende) e `ife-sjc` (iFE São José dos Campos).
Conexões de cada igreja: `conexoes_publicas(p_igreja_id)` → `[{ id, nome }]` (ids **nunca** mudam).

Exemplo de regra de leitura por igreja (o Check-iFE decide a dele):
`integrar_igrejas_da_pessoa(pessoas.user_id) && integrar_minhas_igrejas()` → há igreja em comum.

## Pedidos

**P1. Gatilho em `auth.users` e metadados.** Quais chaves de `raw_user_meta_data` o gatilho usa para criar
`pessoas`? O Integrar envia: `origem: 'integrar'`, `nome`, `telefone` (só dígitos), `nascimento` (AAAA-MM-DD),
`conexao` (`'<id>'` ou `'nenhuma'`) e o objeto `integrar` (`igreja`, `funcoes`, `situacaoCivil`, …). `conexao` e
estado civil dos metadados são aproveitados ou ignorados?

**P2. Leitura em lote.** Confirmar `select` em `pessoas` (`id, user_id, nome, email, telefone, data_nascimento,
ativo`) e `pessoas_sensivel` (`pessoa_id, estado_civil, conexao_situacao, conexao_codigo, …`) por
`user_id in (…)`, com índice em `pessoas.user_id`.

**P3. Papéis.** Dar `pastor`/`integracao` a quem tem esses papéis no Integrar (lista abaixo). O papel global aceita
mais de um valor por pessoa? Como fica um pastor de rede (duas igrejas)?

| Igreja | Pessoa | Papel no Integrar → Check-iFE |
|---|---|---|
| *(preencher com o resultado da consulta de papéis do Integrar — o Edson tem a lista)* | | `pastor` → `pastor`; `coordenacao` (Gestão Integração) → `integracao` |

**P4. Igreja da conexão.** Coluna `conexao_igreja` (texto) em `pessoas_sensivel`, e a escolha de conexão lendo
`conexoes_publicas(<igreja da pessoa>)`, com a igreja vinda de `integrar_igrejas_da_pessoa`. Conferir se há ids de
conexão repetidos entre as duas igrejas.

**P5. Estado civil (D3).** Aceitar `outro` em `estado_civil`.

**P6. Gravação da própria linha (D5).** Confirmar que, com a sessão da pessoa, o Integrar pode gravar em `pessoas`
(`nome`, `telefone`, `data_nascimento`) e em `pessoas_sensivel` (`estado_civil`, `conexao_situacao`,
`conexao_codigo`, `conexao_igreja`) **só depois do aceite**; qual **erro** vem quando falta o termo; e se
`pessoas_sensivel` é criada sob demanda (upsert) ou pelo gatilho.

**P7. Mover conexão pela liderança (opcional).** RPC `checkife_definir_conexao(p_user_id, p_codigo, p_igreja)`
restrita a `pastor`/`integracao`, registrando quem alterou. Sem ela, vale "a pessoa decide".

**P8. Termo.** Confirmar `checkife_termo()` → `{ versao, html }` (anônimo), `checkife_aceitar_termo(p_versao)` e
`checkife_cadastro_completo()` → `{ completo, falta[], conexao_removida }`. O `html` é sanitizado? Quais tags?
(o Integrar vai exibi-lo como veio).

**P9. Links.** Confirmar `https://checkife.ifamiliaextraordinaria.com.br/?ir=perfil`; há links para "termo" e
"escolher conexão"? Existe parâmetro para voltar ao Integrar (`voltar=`)?

**P10. Exclusão.** Quando o Integrar apaga a conta de login, `pessoas.user_id` fica nulo e o cadastro continua?
Ele volta a ser ligado se a pessoa criar nova conta com o mesmo e-mail confirmado?

**P11. Leitura limitada por igreja (D1).** Restringir a leitura de `pastor`/`integracao` às pessoas com igreja em
comum (funções acima). **Pergunta:** o que fazer com quem **não está no Integrar** (só cadastrado no Check-iFE;
`integrar_igrejas_da_pessoa` devolve `{}`)? Sugestão: usar `conexao_igreja`; sem ela, só `admin` e `integracao` leem.

**P12. Tela "Sem conexão" (D4).** Confirmar que `integracao` pode ler `conexao_situacao` de todos (da igreja dele).

## Respostas que destravam o Integrar

- **Fase A (ler):** P2, P3, P11.
- **Fase B (completar o cadastro):** P1, P4, P5, P6, P8, P9.
- **Tela "Sem conexão":** P12. **Mover conexão:** P7 (opcional).
