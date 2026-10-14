# Etapa 2 — o Integrar passa a usar o cadastro único (análise e plano)

> **Só análise e plano.** Nada foi implementado, nada foi alterado no painel do Supabase, nenhum objeto do
> Check-iFE (`pessoas`, `pessoas_sensivel`, `checkife_*`…) ou do Louvor foi tocado. Data: 2026-10-10.
> Contexto: a etapa 1 (v2.6.x: acesso só após aprovação, confirmação de e-mail, conexões) está no ar e conferida.
> Documentos anteriores: [PLANO-CADASTRO-UNICO.md](PLANO-CADASTRO-UNICO.md) (seção 3.6 já previa esta etapa),
> [IMPLANTACAO-CADASTRO-UNICO.md](IMPLANTACAO-CADASTRO-UNICO.md).

## Decisões (2026-10-14)

| # | Decisão |
|---|---|
| D1 | Área no **Integrar** para dizer a que igreja(s) cada pastor tem acesso (uma ou mais). O Check-iFE usa essa lista para limitar a leitura por igreja. |
| D2 | A igreja da pessoa é definida **no Integrar** (o Check-iFE consulta). |
| D3 | Pedir ao Check-iFE para aceitar `outro` (e o Integrar passa a ter `uniao_estavel`). |
| D4 | Sim: tela "Sem conexão" para a Gestão Integração. |
| D5 | O Integrar grava a linha da **própria** pessoa (termo, conexão, estado civil). |
| D6 | `dataNascimento` sai da ficha e passa a vir do cadastro único. |
| D7 | Fichas sem login continuam só no Integrar até a pessoa criar conta. |
| D8 | Manter a conta compartilhada "Integração - IFE". |

**Achado na lista de papéis:** a conta `ataliba.edson` tem **duas fichas em São José** (duplicata). Causa: a
ficha de pastor de rede é criada pelo **aparelho** (`garantirFichaMembroRede`, no `App.tsx`) quando ele ainda
não baixou o bloco da nuvem; outro aparelho faz o mesmo e a mesclagem guarda as duas. O Adilson com uma ficha
em cada igreja **não** é duplicata: é o modelo (1 login, 1 cadastro pessoal, 1 ficha por igreja com os papéis
daquela igreja). Correção no passo 0 da seção 13.

## 0. Resumo

1. **O Integrar quase não depende de dados pessoais da pessoa.** Dentro do bloco `estados`, a ficha
   (`Usuario`) guarda `nome`, `whatsapp`, `email`, `dataNascimento`, `situacaoCivil`, `bairro` (legado, o cadastro
   atual não pede), `conexaoParticipaId`, `comoConheceu` (legado) e `fotoUrl`. **Só a tela Aprovações mostra
   nascimento (idade), bairro, situação civil e "chegou por"**; `conexaoParticipaId` hoje não aparece em tela
   nenhuma. Ou seja: a mudança é pequena na interface e grande em *quem é a fonte da verdade*.
2. **A regra de leitura do Check-iFE bate com as telas do Integrar:** só *Pastores e Gestão Ministerial* e
   *Gestão Integração* abrem Equipe e Aprovações (`acesso.ts`), e são exatamente os que o Check-iFE deixa ler
   (`pastor` e `integracao`). Líder, consolidador e acolhedor só precisam de dados da própria pessoa.
3. **Proposta de fonte da verdade:** nome, e-mail, telefone, nascimento, endereço, estado civil, cônjuge e
   participação em conexão → **Check-iFE**. Acesso, funções, hierarquia, aprovação, conexão que a pessoa
   **lidera**, foto e tudo de visitante → **Integrar**.
4. **Ordem segura (3 fases, cada uma reversível):** (A) ler do Check-iFE *mantendo* a cópia como reserva;
   (B) a pessoa completa o termo e os próprios dados sem sair do Integrar; (C) só então remover as cópias.
5. **Pontos que precisam de decisão** estão na seção 9, e o **pedido formal ao Check-iFE** na seção 8.

---

## 1. O que o Integrar usa hoje e de onde passaria a vir

| Dado da ficha (`Usuario`) | Onde aparece / é usado | Quem vê | Fonte proposta |
|---|---|---|---|
| `nome` | Em todo o sistema (listas, hierarquia, avisos, auditoria, atribuição de visitantes) | todos os papéis | **Cópia operacional no Integrar**, atualizada a partir do Check-iFE (ver 1.1) |
| `whatsapp` | botão "chamar no WhatsApp" (Equipe, líder), login por WhatsApp (`Entrar`) | quem lê a ficha | idem (telefone do Check-iFE) |
| `email` | login, ligação da ficha à conta, Equipe | pastor/gestão | idem |
| `dataNascimento` | Aprovações (idade) | pastor/gestão | **Check-iFE** (`pessoas.data_nascimento`) |
| `situacaoCivil` | Aprovações | pastor/gestão | **Check-iFE** (`estado_civil`) |
| `bairro`, `comoConheceu` | Aprovações (legado: o cadastro atual não coleta) | pastor/gestão | `bairro` → Check-iFE (derivado do endereço); `comoConheceu` fica no Integrar |
| `conexaoParticipaId` | nenhuma tela (guardado para o Check-iFE) | — | **Check-iFE** (`conexao_codigo` + `conexao_situacao`) |
| `fotoUrl` | avatares (Equipe, Aprovações, Painel do líder, hierarquia) | todos | **Integrar** (o Check-iFE não tem foto no cadastro único) |
| `papeis`, `supervisorId`, `conexaoId` (lidera), `statusAcesso`, `ativo`, aprovação | permissões, hierarquia, alertas | — | **Integrar** (não muda) |
| Visitantes, interações, etapas, alertas | todo o fluxo de consolidação | — | **Integrar** (fora do cadastro único) |

### 1.1 `nome`, `whatsapp`, `email`: por que NÃO apagar da ficha

Esses três alimentam coisas que funcionam **sem o Check-iFE**: a atribuição de visitantes a um responsável, a
trilha de auditoria (nomes congelados de propósito, LGPD), o login por WhatsApp (`Entrar` procura o número nas
fichas do aparelho) e o modo offline do app. Proposta: manter como **cópia operacional com carimbo de data**
(`cadastroUnicoEm`), atualizada em dois momentos: (a) quando a própria pessoa entra (ela lê a própria linha em
`pessoas` e corrige a ficha); (b) quando pastor/gestão abre Equipe (lê as linhas em lote). A cópia nunca é a
fonte: em conflito, vale o Check-iFE.

## 2. Mapeamento campo a campo (Integrar ↔ Check-iFE)

| Integrar (`Usuario`) | Check-iFE | Observação |
|---|---|---|
| `authUserId` | `pessoas.user_id` | **chave da ligação**. Nunca casar por e-mail sozinho. |
| `nome` | `pessoas.nome` | |
| `email` | `pessoas.email` | |
| `whatsapp` (texto formatado) | `pessoas.telefone` (só dígitos, padrão combinado) | usar `formatarTelefone` na leitura |
| `dataNascimento` (`AAAA-MM-DD`) | `pessoas.data_nascimento` | mesmo formato |
| `ativo` | `pessoas.ativo` | **não são a mesma coisa**: `ativo` do Integrar = "está na equipe"; o do Check-iFE = "cadastro ativo". Não espelhar. |
| `situacaoCivil`: `solteiro`, `casado`, `divorciado`, `viuvo`, `outro` | `estado_civil`: `solteiro`, `casado`, `uniao_estavel`, `divorciado`, `viuvo` | `outro` **não existe** no Check-iFE e `uniao_estavel` não existe no Integrar. Na leitura: `uniao_estavel` → exibir "União estável". `outro` → deixa em branco no Check-iFE (ver dúvida D3). |
| `conexaoParticipaId` | `conexao_codigo` (+ `conexao_situacao`) | `'nenhuma'` do Integrar = `conexao_situacao = 'nao_participa'` |
| (não existe) | `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `data_casamento`, `conjuge_nome` | O Integrar **não coleta** isso hoje. Só leria, se a tela precisar. |

## 3. Papéis e quem lê o quê

| Papel no Integrar | Papel global esperado no Check-iFE | O que lê de `pessoas`/`pessoas_sensivel` | Telas |
|---|---|---|---|
| Pastores e Gestão Ministerial (`pastor`) | `pastor` | todas as pessoas | Equipe, Aprovações |
| Gestão Integração (`coordenacao`) | `integracao` | todas as pessoas | Equipe, Aprovações |
| Líder, Consolidador, Acolhedor | (sem papel global) | **só a própria linha** | "Meu cadastro" (nova, simples) |

Consequências:
- **O Check-iFE precisa do papel global certo para cada pastor/gestor do Integrar.** Hoje o admin define à mão.
  Se faltar, o Integrar **mostra o que a ficha tem** (cópia) e um aviso discreto "dados do cadastro único
  indisponíveis para o seu perfil" — nunca quebra a tela.
- **Atenção à abrangência:** o papel `pastor`/`integracao` do Check-iFE é *global* (todas as pessoas, de todas
  as igrejas). Um pastor de São José, com esse papel, lê também o cadastro das pessoas de Resende. Hoje o
  Integrar isola por igreja (RLS por `membros_igreja`). É uma diferença de modelo que precisa de decisão (D1).
- **Lista de quem tem esses papéis no Integrar** (você roda; só lê o bloco do Integrar):

```sql
select e.igreja_id, u->>'nome' as nome, u->>'email' as email, u->'papeis' as papeis,
       u->>'statusAcesso' as acesso, coalesce(u->>'ativo', 'true') as ativo,
       (coalesce(u->>'authUserId', '') <> '') as tem_conta
  from public.estados e,
       jsonb_array_elements(coalesce(e.dados->'usuarios', '[]'::jsonb)) u
 where e.igreja_id in ('minha-igreja', 'ife-sjc')
   and (u->'papeis') ?| array['pastor', 'coordenacao']
 order by e.igreja_id, u->>'nome';
```
  Quem aparece com `tem_conta = false` ainda não tem login: não tem como receber papel no Check-iFE.
- **Automático?** Não recomendo agora. A mudança de papel é rara (poucas pessoas) e é decisão do admin do
  Check-iFE. Se quiserem automatizar depois: o Check-iFE **consulta** (nunca o Integrar escreve) uma função
  somente-leitura `integrar_papeis(p_igreja_id)` → `(user_id, papel)` do Integrar. Fica registrado, não pedido.

## 4. Conexões

- **Ids estáveis e formato `{ id, nome }`:** já garantidos pela `conexoes_publicas(p_igreja_id)`; o id **nunca
  muda** (renomear é permitido). Nada a fazer no Integrar além de manter a regra (já documentada).
- **Duas igrejas:** a mesma função aceita qualquer `p_igreja_id` (`'ife-sjc'` funciona hoje). O que falta é o
  Check-iFE **saber de que igreja a pessoa é** e **guardar de qual igreja é o código**. Dois problemas:
  1. `conexao_codigo` sozinho é ambíguo se ids repetirem entre igrejas (ids são aleatórios, a colisão é
     improvável, mas **não há garantia** — não conferi os dois blocos; ver pedido P4).
  2. O Check-iFE hoje só lista as conexões de `'minha-igreja'`.
  Proposta: o Check-iFE passa a guardar também `conexao_igreja` (texto, padrão `'minha-igreja'`) e a tela de
  escolha lê a lista da igreja da pessoa. Como o Check-iFE sabe a igreja da pessoa? **Dúvida D2.**
- **"Ainda não participo":** `conexao_situacao = 'nao_participa'`. Proposta: uma **lista** simples em
  Aprovações/Equipe? Não — essa lista é de *integrantes da equipe*, e quem não participa pode ser qualquer
  pessoa do Check-iFE. Sugiro uma tela **"Sem conexão"** para Gestão Integração (lê `pessoas_sensivel`
  filtrando `nao_participa`), com botão de mensagem. Decisão sua (D4).
- **Quem vale, se os dois mudarem?** Regra proposta:
  1. **A escolha da própria pessoa vale** para "de qual conexão eu participo" (`conexao_codigo`), em qualquer dos
     dois sistemas (ambos gravam a mesma coluna; não há "dois valores").
  2. O Integrar (liderança) **não grava** na linha da pessoa. Se a liderança precisar mover alguém, usa uma
     função do Check-iFE restrita a `pastor`/`integracao` (pedido P7) e a ação fica na auditoria do Integrar;
     sem essa função, a liderança **pede** à pessoa (aviso no sino) e a escolha dela prevalece.
  3. "Conexão que a pessoa **lidera**" é outra coisa e **fica 100% no Integrar** (`Conexao.liderId`).

## 5. Cadastro e correção dos dados (escrever, ou só ler?)

**Recomendo que o Integrar escreva só a linha da própria pessoa** (mesma regra autorizada para o Louvor),
pelo token dela, com PostgREST/RPC do Check-iFE — nunca com a chave de serviço do Integrar e nunca a linha de
outra pessoa:

- **Por quê:** o cadastro do Integrar já pede nome, telefone, nascimento, estado civil e conexão. Sem escrever,
  a pessoa teria que preencher tudo de novo no Check-iFE logo depois — e o objetivo do cadastro único é o
  contrário.
- **O que o Integrar gravaria (e só depois do termo aceito):** `estado_civil`, `conexao_situacao`,
  `conexao_codigo` (+ `conexao_igreja`); nome/telefone/nascimento em `pessoas`.
- **Onde:** uma tela única "Meu cadastro" (Mais → Meu cadastro) e o passo final do cadastro de integrante.
  Endereço, cônjuge e data de casamento ficam no Check-iFE (link `…/?ir=perfil`); o Integrar não os coleta.
- **Alternativa mínima:** o Integrar só lê e manda a pessoa ao Check-iFE. É menos código, mas piora a
  primeira experiência (dois cadastros em dois sites). Decisão sua (D5).

## 6. Termo LGPD: como os dois convivem

- **Dois consentimentos, duas finalidades:** (a) o do **Integrar** (já existe: `consentimentoLgpdEm`) cobre
  os dados *do Integrar* — ficha de equipe, função, hierarquia, acompanhamento de visitantes; (b) o do
  **cadastro único** (`checkife_termo` / `checkife_aceitar_termo`) cobre os dados *do cadastro único* — pessoais
  e sensíveis compartilhados entre os sistemas. Um não substitui o outro.
- **Onde o aceite do cadastro único pode acontecer:** só com **sessão** (a RPC grava para `auth.uid()`). Com
  "Confirm email" ligado, não há sessão logo depois do cadastro. Logo: **não** dá para aceitar na mesma tela do
  `signUp`. Fluxo proposto:
  1. A pessoa se cadastra no Integrar (como hoje: marca o consentimento do **Integrar**).
  2. Confirma o e-mail e entra pela primeira vez.
  3. O app chama `checkife_cadastro_completo()`. Se `falta` tiver `'termo'` e/ou `'conexao'`, mostra uma
     tela **"Completar o cadastro único"**: texto de `checkife_termo()` (renderizado como veio, sem editar),
     botão de aceite e a escolha da conexão. Só depois grava os dados sensíveis.
  4. `conexao_removida = true` → aviso "sua conexão foi removida; escolha outra" (o id deixou de existir).
- **Quem bloqueia o quê:** o aceite do cadastro único **não** bloqueia o acesso ao Integrar (que depende só da
  aprovação da liderança). Ele só bloqueia gravar dados sensíveis e ler os da pessoa.
- **Texto:** o Integrar não reescreve o termo; exibe o do Check-iFE. A versão aceita fica no Check-iFE.

## 7. O que sairia do bloco `estados` (fase C) e o que não pode sair

**Removeria da ficha (`Usuario`), só depois de a leitura estar estável e o Check-iFE confirmar os dados:**

| Campo | Observação |
|---|---|
| `situacaoCivil` | vira leitura de `estado_civil` |
| `conexaoParticipaId` | vira leitura de `conexao_codigo` |
| `bairro` | legado (nunca preenchido pelo cadastro atual); só some da tela Aprovações |
| `dataNascimento` | **não estava na sua lista**, mas está no cadastro único; sugiro remover também (D6) |

**Não removeria:** `nome`, `whatsapp`, `email` (ver 1.1), `fotoUrl`, `comoConheceu`, nem nada de funções,
hierarquia, aprovação e visitantes. Cônjuge e endereço completo **não existem** no bloco hoje (nada a remover).

**Cuidados na remoção:**
- Fazer **por versão do app**, com o código novo já lendo do Check-iFE; nunca um SQL que reescreva o bloco.
- Fichas **sem conta** (cadastradas pela liderança em Equipe, `sem_login`) não têm `pessoas`: para elas o
  dado fica na ficha. Por isso a remoção é *por ficha ligada a conta*, não geral.
- **Backup antes:** o gatilho `snapshot_estado` já guarda histórico; ainda assim, exportar o bloco antes.
- O servidor (`acesso-membro`, `lerSolicitacao`) deixa de gravar esses campos na ficha pendente; os
  metadados do `signUp` continuam levando o pedido (o Check-iFE decide o que aproveita — ver P1).

## 8. Pedidos ao Check-iFE (colunas, funções, links, papéis)

**P1. Gatilho em `auth.users` e metadados.** Confirmar quais chaves de `raw_user_meta_data` o gatilho usa para
criar `pessoas` (`nome`, `telefone`, `data_nascimento`?). O Integrar envia `nome`, `telefone` (só dígitos),
`nascimento`, `conexao` (`'<id>'|'nenhuma'`) e o objeto `integrar`. Dizer se `conexao`/estado civil dos
metadados são aproveitados ou ignorados (hoje o Integrar assume que são **ignorados**).

**P2. Leitura (já existe; só confirmar):** `select` em `pessoas(id, user_id, nome, email, telefone,
data_nascimento, ativo)` e `pessoas_sensivel(pessoa_id, estado_civil, conexao_situacao, conexao_codigo,
cep, bairro, cidade, uf, …)` com a regra "própria pessoa + admin + `pastor`/`integracao`". Pedir que a
leitura **em lote por `user_id in (…)`** seja permitida e performática (índice em `pessoas.user_id`).

**P3. Papéis.** Atribuir `pastor`/`integracao` às pessoas da lista da seção 3 (a lista sai do SQL acima).
Dizer se o papel global aceita **mais de um** valor por pessoa e como fica um pastor de rede.

**P4. Igreja da conexão.** Coluna `conexao_igreja` (texto, padrão `'minha-igreja'`) em `pessoas_sensivel`, e a
escolha lendo `conexoes_publicas(<igreja da pessoa>)`. Antes, o Check-iFE confirma que não há colisão de ids
entre os blocos de `'minha-igreja'` e `'ife-sjc'` (o Integrar pode fornecer a lista dos dois blocos).

**P5. Estado civil `outro` e `uniao_estavel`.** Dizer se aceitam um valor `outro` (ou se o Integrar grava
`nulo` e a pessoa escolhe de novo). Hoje há 5 valores diferentes entre os dois sistemas.

**P6. Gravação da própria linha pelo Integrar.** Confirmar que, com a sessão da pessoa, é permitido gravar em
`pessoas` (`nome`, `telefone`, `data_nascimento`) e em `pessoas_sensivel` (`estado_civil`,
`conexao_situacao`, `conexao_codigo`, `conexao_igreja`) **só depois do aceite**, e qual **erro** devolvem
quando o termo falta (para a tela do Integrar tratar). Dizer se `pessoas_sensivel` é criada sob demanda
(upsert) ou pelo gatilho.

**P7. Mover conexão pela liderança (opcional).** RPC `checkife_definir_conexao(p_user_id, p_codigo,
p_igreja)` restrita a `pastor`/`integracao`, que registra quem alterou e quando. Se não houver, vale a regra
"a pessoa decide" (seção 4).

**P8. Termo.** Confirmar o contrato: `checkife_termo()` → `{ versao, html }` (anônimo permitido),
`checkife_aceitar_termo(p_versao)` e `checkife_cadastro_completo()` → `{ completo, falta[], conexao_removida }`.
Perguntar: o `html` é sanitizado? (o Integrar vai renderizá-lo — precisa de lista de tags permitidas.)

**P9. Links.** Confirmar `https://checkife.ifamiliaextraordinaria.com.br/?ir=perfil` e se existe outro para
"termo" e para "escolher conexão", e como o Check-iFE devolve a pessoa ao Integrar (parâmetro `voltar=`).

**P10. Exclusão.** Quando o Integrar apaga a conta de login (Equipe → Excluir), o Check-iFE passa a ter
`pessoas.user_id` nulo. Confirmar que isso é o esperado, que o cadastro **continua** e que reaparece
ligado se a pessoa criar nova conta com o **mesmo e-mail confirmado**.

## 9. Dúvidas e decisões para você

- **D1. Isolamento por igreja.** O papel `pastor`/`integracao` do Check-iFE enxerga **todas** as pessoas. Aceita
  que um pastor de São José leia o cadastro de Resende (e vice-versa), ou quer exigir `conexao_igreja`/igreja da
  pessoa na regra de leitura do Check-iFE?
- **D2. Qual a igreja da pessoa no Check-iFE?** Ela escolhe ao completar o cadastro? Ou o Integrar informa (a
  conta tem vínculo em `membros_igreja`)? Sem isso, não há como listar as conexões certas.
- **D3. Estado civil `outro`:** apagar (a pessoa escolhe de novo) ou pedir ao Check-iFE para aceitar `outro`?
- **D4. Lista "sem conexão"** para a Gestão Integração: quer essa tela? Onde (menu Gestão)?
- **D5. O Integrar escreve a linha da própria pessoa** (recomendado) ou só lê e manda ao Check-iFE?
- **D6. Remover também `dataNascimento` da ficha** (idade em Aprovações passaria a vir do Check-iFE)?
- **D7. Fichas `sem_login`** (cadastradas pela liderança): continuam só no Integrar até a pessoa ter conta?
  Proposta: sim; quando ela se cadastrar com o mesmo e-mail confirmado, a ficha é ligada à conta (já
  funciona) e passa a usar o cadastro único.
- **D8. Conta de equipe compartilhada** (`integracaoextraordinaria@gmail.com`, "Integração - IFE"): ela tem
  `pessoas` no Check-iFE com nome de uma "pessoa" que não é uma pessoa. Manter assim ou desativar o cadastro
  dela no Check-iFE (e o Integrar usa só o papel)?

## 10. Visitantes e pessoas em acompanhamento

**Confirmado no código:** `Visitante` e `Interacao` têm seus próprios campos (nome, telefone, bairro, situação
civil, etapa…) e **não** referenciam `authUserId` nem `pessoas`. O autocadastro público (`cadastrar-visitante`)
grava só no bloco do Integrar, pela função de servidor, sem login. As regras de alerta (`alertas.ts`) e o push
(`alertas-push`) usam fichas de **equipe** (id, papéis, supervisor) e contagens — **não leem** dados pessoais
do cadastro único. Nada disso depende do cadastro único e **nada muda** neles nesta etapa.

## 11. Efeitos e riscos que encontrei (além dos pedidos)

1. **Login por WhatsApp** (`Entrar`) procura o número nas fichas **do aparelho**: funciona só em aparelho que
   já sincronizou. Com o telefone vindo do Check-iFE isso continua igual (é uma limitação atual, não nova).
   Para funcionar em aparelho novo seria preciso uma função pública que resolva WhatsApp → e-mail
   (vazamento de existência de conta; por isso **não** proponho agora).
2. **Offline:** o Integrar trabalha com cópia local. Dados lidos do Check-iFE entram como cache **com data**;
   sem rede, a tela mostra o último valor e o carimbo.
3. **Auditoria** guarda nomes congelados de propósito (LGPD/histórico): não é afetada pela mudança de fonte.
4. **Alertas e push:** não leem `pessoas` (continuam só com o bloco); **nenhuma republicação** de função é
   necessária por causa desta etapa, exceto `acesso-membro` se deixar de gravar campos na ficha.
5. **RLS de leitura do Check-iFE vs. "aprovação" do Integrar:** ser `pastor` no Check-iFE **não** dá acesso ao
   Integrar (continua dependendo de ficha aprovada + vínculo). Mas o inverso também vale: aprovar alguém como
   pastor no Integrar **não** lhe dá leitura no Check-iFE. Duas listas de poder; precisam ficar alinhadas à
   mão (P3) — risco de divergência, mitigado por um aviso na tela Equipe (item da fase A).
6. **Ligar ficha ↔ pessoa por e-mail** só é seguro com e-mail **confirmado**. Já é a regra da etapa 1
   (`acharFicha`); a leitura de `pessoas` usará `user_id` (nunca e-mail).
7. **Ordem das mudanças de dado:** se a remoção (fase C) vier antes de todas as pessoas terem `pessoas`
   preenchida, a Aprovações perde informação. Por isso a fase C é a última e condicionada a uma conferência
   (ficha ligada ↔ `pessoas` com os campos preenchidos).

## 12. Fases propostas (cada uma reversível, nenhuma mexe no painel)

| Fase | O que entrega | Depende de | Reversão |
|---|---|---|---|
| **A — Ler** | Equipe/Aprovações leem `pessoas`/`pessoas_sensivel` para quem tem papel; cópia da ficha como reserva; aviso "papel no Check-iFE ausente"; carimbo de atualização | P2, P3 | desligar a leitura (flag); nada foi removido |
| **B — Completar** | Tela "Completar o cadastro único" (termo + conexão) e "Meu cadastro"; gravação só da própria linha; `conexao_igreja` | P1, P4–P6, P8, P9 | a tela some; dados no Check-iFE ficam |
| **C — Limpar** | Remover `situacaoCivil`, `conexaoParticipaId`, `bairro` (e `dataNascimento` se D6) das fichas ligadas | A e B estáveis; conferência; backup | restaurar do snapshot (`snapshot_estado`) |
| **D (opcional)** | Tela "Sem conexão"; mover conexão pela liderança | P7, D4 | remover a tela |

Testes previstos: regras puras (mapeamento de campos e de estado civil, quem pode ler, ligação ficha↔pessoa,
fallback sem papel), sem tocar produção; roteiro de aceite com contas de teste dos três papéis.

## 13. Passo a passo (com as decisões de 2026-10-14)

| Passo | O que é feito | Quem | Versão |
|---|---|---|---|
| **0. Arrumar a casa** ✅ feito na v2.6.3 | (a) A ficha de pastor de rede passa a ser criada pelo **servidor** (`acesso-membro`), uma só por conta e igreja; (b) rotina que **une fichas duplicadas** da mesma conta na mesma igreja (mantém a mais usada, transfere visitantes `responsavelId`/`liderConexaoId`, `supervisorId`, líderes de conexão e `autorId`, remove a outra, registra na auditoria); (c) excluir uma ficha **nunca** apaga a conta se a mesma conta tiver outra ficha ou outra igreja. | Integrar (eu) + você publica | 2.7.0 |
| **1. Igrejas da rede (D1)** ✅ v2.7.0 | Na ficha do pastor (Equipe): "Acesso a outras igrejas", marcando uma ou mais. Só quem é pastor aprovado na igreja de destino concede; o servidor cria o vínculo e a ficha de pastor ali. Substitui o SQL manual de hoje. | Integrar | 2.7.0 |
| **2. Funções para o Check-iFE (D1, D2)** ✅ SQL 10 | Funções **só leitura** do Integrar: igrejas a que uma conta tem acesso, e a igreja de casa de uma pessoa. O Check-iFE as consulta (nunca escreve no Integrar). | Integrar (SQL novo, você roda) | 2.7.0 |
| **3. Pedidos ao Check-iFE** | Enviar P1–P11 (seção 8 + P11: limitar a leitura de `pastor`/`integracao` às igrejas da função do passo 2; aceitar `outro`). Esperar as respostas antes da fase A. | você leva; Check-iFE faz | — |
| **A. Ler** | Equipe e Aprovações leem `pessoas`/`pessoas_sensivel` (quem tem papel); a ficha fica como reserva; aviso quando o papel no Check-iFE falta; data de atualização. | Integrar | 2.8.0 |
| **B. Completar** | Tela "Completar o cadastro único" (termo do Check-iFE + conexão da igreja da pessoa + estado civil, com `uniao_estavel`) no 1º acesso; "Meu cadastro" no menu. Grava só a linha da própria pessoa (D5). | Integrar | 2.9.0 |
| **D4. Sem conexão** | Tela para a Gestão Integração: quem marcou "ainda não participo", com botão de mensagem. | Integrar | 2.9.0 |
| **C. Limpar** | Remover da ficha `situacaoCivil`, `conexaoParticipaId`, `bairro` e `dataNascimento` (D6) — só das fichas ligadas a conta e com o cadastro único preenchido; fichas sem login ficam (D7). Backup antes. | Integrar + você confere | 3.0.0 |

Em todos: testes das regras puras, build, publicação só com o seu "publica", e roteiro de conferência.

## 14. Contrato para o Check-iFE (passo 2 — `supabase/sql/10_funcoes_para_checkife.sql`)

Funções **só leitura** do Integrar (testadas num Postgres local com dados fictícios). Sessão anônima recebe vazio.

| Função | Quem pode chamar | Devolve | Uso sugerido no Check-iFE |
|---|---|---|---|
| `integrar_igrejas()` | anônimo e logado | `[{ id, nome, cidade }]` | mostrar o nome da igreja (use `cidade` para diferenciar: o `nome` das duas pode ser igual) |
| `integrar_minhas_igrejas()` | logado | `text[]` — igrejas a que **quem chama** tem acesso no Integrar | D1: limitar a leitura de `pastor`/`integracao` |
| `integrar_igrejas_da_pessoa(p_user_id uuid)` | logado | `text[]` — igrejas em que a pessoa tem ficha aprovada ou pedido em análise (ativa) ou vínculo | D2: igreja da pessoa; `conexoes_publicas(<igreja>)` para a lista de conexões |

Exemplo de regra de leitura (o Check-iFE decide e escreve a dele):
`integrar_igrejas_da_pessoa(pessoas.user_id) && integrar_minhas_igrejas()` (há igreja em comum).
Pessoa **sem** igreja no Integrar (só cadastrada no Check-iFE) devolve `{}`: o Check-iFE precisa definir o que
fazer com ela (ex.: liberar para `integracao` ou usar `conexao_igreja`).
