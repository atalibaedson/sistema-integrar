# Implantação — acesso só para quem a liderança aprovou (+ preparação para o cadastro único)

Esta entrega faz três coisas, nesta ordem de importância:

1. **Fecha o furo de segurança.** O vínculo da conta com a igreja (`membros_igreja`) é o que libera a
   leitura do bloco `estados` — que inclui **cuidado pastoral e crises**. A função `registrar-membro` antiga
   ligava **qualquer conta logada do projeto** (inclusive do Louvor) à igreja. Agora **só entra quem a
   liderança aprovou**, e quem confere isso é o **servidor**. Quem está pendente não lê o bloco: vê só a
   tela "aguardando aprovação", e o status vem de uma função que devolve **apenas a situação da própria conta**.
2. **Prepara a confirmação de e-mail.** O cadastro não depende mais de sessão logo após o `signUp`: a ficha
   vai nos metadados da conta e é gravada (pelo servidor) no primeiro acesso já confirmado. Funciona com a
   confirmação **ligada ou desligada** — por isso o app pode ser publicado **antes** de você ligá-la.
3. **Convive no projeto compartilhado:** links dos e-mails voltam ao Integrar; conexões com código estável;
   aviso antes de excluir uma conta (o login é um só para os três sistemas).

> **Nada no painel do Supabase foi alterado por esta entrega** (Site URL, Redirect URLs, Confirm email,
> modelos de e-mail). Isso fica com você, na ordem do passo 6.

---

## O que mudou

| Peça | Onde | O que faz |
|---|---|---|
| `acesso-membro` (**nova**) | `supabase/functions/acesso-membro/` | `status` (situação da própria conta; liga se já aprovada), `solicitar` (cria a ficha **pendente**), `aprovar` (a liderança libera o vínculo — o servidor confere que quem aprova é Pastor/Gestão aprovado), `primeiro_admin` |
| `registrar-membro` (**corrigida**) | `supabase/functions/registrar-membro/` | só liga quem está **aprovado e ativo**. Fica publicada para aparelhos com a versão antiga aberta |
| `deletar-usuario-auth` (**endurecida**) | `supabase/functions/deletar-usuario-auth/` | antes qualquer sessão (até anônima) apagava qualquer conta. Agora exige Pastor/Gestão aprovado da igreja informada, conta desta igreja, e recusa conta ligada a outra igreja |
| Regras testadas | `src/regras-membros.ts` (+ cópia em `supabase/functions/_shared/`) | quem pode aprovar, achar a ficha da conta, ler o pedido, criar a ficha pendente |
| Revisão dos vínculos | `supabase/sql/09_revisar_membros_igreja.sql` | lista quem tem vínculo sem aprovação; remoção comentada, de propósito |

**Nenhum SQL novo é obrigatório** (a tabela `membros_igreja` já existe). O `09` é só de revisão.

### Metadados do `signUp` (padrão combinado entre os três sistemas)

```json
{ "origem": "integrar", "nome": "…", "telefone": "12999990000",
  "nascimento": "AAAA-MM-DD", "conexao": "<id da conexão>" | "nenhuma",
  "integrar": { "igreja": "ife-sjc", "funcoes": ["consolidador"], "loginPreferido": "email",
                "situacaoCivil": "", "fotoUrl": "", "consentimentoEm": "2026-10-09T…Z" } }
```
O objeto `integrar` é só do Integrar (os outros sistemas podem ignorá-lo). Os metadados são **só um pedido**:
o servidor valida tudo, a ficha nasce **pendente** e a liderança aprova.

### Domínios do Integrar (para o Redirect URLs — passo 6)

| Igreja | Endereço do app (use este nos Redirect URLs) |
|---|---|
| iFE Resende | `https://integracaoife.ifamiliaextraordinaria.com.br` |
| iFE São José dos Campos | `https://integracaoifesjc.ifamiliaextraordinaria.com.br` |

Endereços públicos de visitante (`visitante…`, `visitantesjc…`) **não** recebem e-mail de retorno: o app volta
sempre para o endereço do app da igreja. Se alguém ainda usa `sistema-integrar.vercel.app`, inclua-o também.
Cadastre cada um **sem** `#/rota`, nas duas formas: `https://…` e `https://…/**`.

---

## Passo a passo (nesta ordem — sem queda)

1. **Publicar a função nova** (só acrescenta; não muda nada do que já funciona):
   ```bash
   supabase functions deploy acesso-membro
   ```
2. **Publicar o app** (commit + push na `main` → Vercel). Confira que o rodapé mostra a versão nova.
   O app novo já usa `acesso-membro`; a `registrar-membro` antiga continua como estava, sem uso.
3. **Testar com a sua conta** (já aprovada): entre, abra Equipe e Aprovações. Deve ser igual a antes.
   Se algo parecer errado, veja os logs: painel → Edge Functions → `acesso-membro` → Logs.
4. **Fechar o furo** (publicar as funções corrigidas — depois que o app novo estiver no ar):
   ```bash
   supabase functions deploy registrar-membro
   supabase functions deploy deletar-usuario-auth
   ```
   A partir daqui nenhuma conta sem aprovação ganha vínculo, nem pelos aparelhos com a versão antiga.
5. **Revisar os vínculos que já existem.** No SQL Editor, rode a **PARTE A** de
   `supabase/sql/09_revisar_membros_igreja.sql` (só leitura). Confira a coluna `situacao_do_vinculo`:
   `NÃO APROVADO` e `SEM FICHA` (que não sejam pastores de rede) não deveriam ter vínculo. Anote os e-mails,
   cole-os na **PARTE B** e rode. Quem for removido por engano é só aprovar de novo.
6. **Quando for ligar a confirmação de e-mail** (você, no painel, **depois** dos passos 1–4):
   1. *Authentication → URL Configuration → Redirect URLs*: acrescente os endereços acima.
   2. *Authentication → Emails*: SMTP próprio (o e-mail embutido é só para teste) e modelo com texto neutro.
   3. Rode, só leitura: `select count(*) from auth.users where email_confirmed_at is null and not is_anonymous;` — deve ser `0`.
   4. Ligue **Confirm email** e faça o teste de aceite abaixo.

**Voltar atrás:** desligar *Confirm email* basta (o app funciona dos dois jeitos). Para reabrir os vínculos
(não recomendado), republique a versão antiga da `registrar-membro`.

---

## Teste de aceite (com a confirmação ligada)

| # | Teste | Esperado |
|---|---|---|
| 1 | Criar conta nova (e-mail real), com e sem foto | Tela **"Confirme seu e-mail"**; chega o e-mail; **Reenviar** respeita os 60 s |
| 2 | Clicar no link (mesmo aparelho) | Volta ao Integrar logada; vê **"Quase lá"**; o pedido aparece em Aprovações para a liderança |
| 3 | Tentar ler o bloco com a conta pendente (ex.: abrir a Equipe) | Não consegue: só a tela de espera |
| 4 | Aprovar a conta | A pessoa entra em até ~15 s (ou ao recarregar); com **erro** do servidor a aprovação não é gravada |
| 5 | Link aberto em **outro** aparelho | Funciona (só a foto não acompanha) |
| 6 | Tentar entrar **sem** confirmar | Mensagem clara + botão **Reenviar e-mail de confirmação** |
| 7 | Link vencido / já usado | Volta à entrada com aviso "o link expirou ou já foi usado" |
| 8 | E-mail que já tem conta (Louvor/Check-iFE) | "Esse e-mail já tem uma conta… entre com a mesma senha" |
| 9 | Conta do Louvor entra no Integrar | **Não** ganha vínculo; vê "Complete o seu cadastro" e, ao enviar, fica pendente |
| 10 | "Esqueci a senha" | O e-mail volta ao endereço do Integrar e abre "Definir nova senha" |
| 11 | Excluir um integrante na Equipe | Aviso de que o login vale para os três sistemas |
| 12 | Cada igreja (Resende e São José) | Mesmo comportamento |

---

## Convivência no projeto compartilhado

- O Integrar só toca nos **seus** objetos: `estados`, `estados_historico`, `membros_igreja`, `igrejas`,
  `assinaturas_push`, `alertas_enviados`, o bucket `avatares` e as funções `acesso-membro`, `registrar-membro`,
  `deletar-usuario-auth`, `cadastrar-visitante`, `alertas-push`, `conexoes_publicas`.
- **Não** cria, altera nem apaga objetos do Check-iFE (`pessoas`, `pessoas_sensivel`, `ministerios`,
  `membros_ministerio`, `eventos`, `presencas`…, tudo `checkife_*`, gatilhos `checkife_*` em `auth.users`,
  segredos `CHECKIFE_*`) nem do Louvor (`louvor_*`, bucket `guias`). Nenhum SQL daqui varre o schema.
- Segredos do Integrar (`VAPID_*`, `CRON_SECRET`) continuam como estão.
- **Conexões:** `conexoes_publicas('minha-igreja')` continua com o mesmo formato (`id`, `nome`). O `id` de uma
  conexão **nunca muda** (renomear é seguro). Apagar uma conexão pede confirmação e avisa que as pessoas dela
  terão de escolher de novo no Check-iFE.
- O login anônimo continua (o Check-iFE ignora contas anônimas).

## Fase seguinte (registrado, não feito agora)

O Integrar deve ler **nome, telefone, endereço, estado civil, cônjuge e Conexão** do cadastro do Check-iFE
(`pessoas` e `pessoas_sensivel`, com as regras de acesso do banco) em vez de manter cópia; pastores e Gestão
Integração terão papel no Check-iFE para ler esses dados. Isso mexe em: Equipe, Aprovações, Painel do líder,
Auditoria e no login por WhatsApp. Ver `PLANO-CADASTRO-UNICO.md`, seção 3.6.

## Ainda em aberto (sugestões, fora desta entrega)

- **Desativar/remover da Equipe não revoga o vínculo.** Quem foi desativado continua conseguindo ler o bloco
  pela API até a conta ser apagada. Dá para revogar o vínculo na própria função `acesso-membro`.
- Limitar tamanho/tipo de arquivo no bucket `avatares` (hoje aceita upload de qualquer sessão).
