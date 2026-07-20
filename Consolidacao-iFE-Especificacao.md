# Consolidação de Visitantes — iFE
### Especificação do processo para desenvolvimento de um aplicativo de gestão

Este documento descreve, em detalhe, o processo de consolidação de visitantes da Igreja Família Extraordinária (iFE), com o objetivo de servir de base para o desenvolvimento de um aplicativo que gerencie as informações do visitante ao longo de toda a jornada — do primeiro contato à integração.

Ele descreve **o que** o sistema precisa fazer (processo, dados, estados e regras), não **como** implementar (tecnologia). A leitura é independente da apresentação visual, mas as duas se complementam.

**Legenda de origem de cada regra:**
- **[confirmado]** — já definido pela iFE.
- **[prática]** — como a equipe já trabalha hoje.
- **[proposta]** — sugestão a validar antes de virar regra do sistema.

---

## 1. Visão geral

Consolidação é o processo de **acolher, acompanhar e integrar** o visitante à vida da igreja. O objetivo final não é "fazer contatos", e sim caminhar com a pessoa **até a integração e o discipulado** — culminando no batismo ou na recepção como membro.

Todo o acompanhamento é feito por **WhatsApp** [confirmado].

A jornada ideal ("caminho principal") tem cinco marcos:

1. **Chegou** — cadastro do visitante (no culto ou por QR code).
2. **Primeira semana** — sequência de contatos por WhatsApp (segunda, quarta e sábado), incluindo o convite para a Conexão.
3. **Passa ao líder** — ao aceitar o convite, o contato é entregue ao líder da Conexão, que fala com a pessoa **antes** da visita.
4. **Foi à Conexão** — a pessoa visita o grupo já acolhida pelo líder.
5. **Integrado** — frequenta os encontros da Conexão e as celebrações, até se batizar ou tornar-se membro.

Paralelamente, o sistema precisa tratar os **caminhos de exceção**: quando a pessoa não responde, não vai à Conexão, pede para não ser contatada, ou sinaliza uma situação de cuidado/crise.

---

## 2. Objetivos do sistema

O aplicativo deve permitir:

- Registrar e centralizar as informações de cada visitante.
- Orientar e registrar cada contato feito, com histórico completo.
- Deixar visível, a qualquer momento, **em que ponto da jornada** cada pessoa está (status).
- Garantir que **cada pessoa tenha um responsável** e que ninguém "caia no vão".
- Automatizar lembretes e mudanças de status baseadas em prazos.
- Apoiar a transferência (handoff) do visitante para o líder de Conexão.
- Produzir indicadores do processo (funil de consolidação).

---

## 3. Papéis (atores)

| Papel | Responsabilidade principal |
|---|---|
| **Consolidador** | "Dono" do acompanhamento do visitante na fase de consolidação. Faz os contatos, registra as interações, aciona o handoff. |
| **Líder de Conexão** | Recebe o visitante que aceitou o convite, faz o primeiro contato antes da visita e assume o acompanhamento após a integração começar. |
| **Liderança / Pastor** | Acionada nos casos de cuidado/crise e em decisões que exigem cobertura pastoral. |
| **Coordenação da Consolidação** | Distribui visitantes, acompanha os indicadores e resolve pendências (ex.: pessoa sem responsável). |

**Regra:** cada visitante tem **um único responsável** ativo por vez, com um **plano B** definido caso ele fique indisponível [proposta].

---

## 4. Canais

- Canal único de contato: **WhatsApp** [confirmado].
- Entrada de dados: **abordagem durante os cultos** e **autocadastro via QR code** [confirmado].

---

## 5. Modelo de dados (entidades)

> Descrição das entidades e campos que o app deve armazenar. Tipos são sugestões.

### 5.1. Visitante (Pessoa)
| Campo | Tipo | Observações |
|---|---|---|
| id | identificador | — |
| nome | texto | — |
| whatsapp | texto/telefone | usado como canal e possível chave de deduplicação |
| email | texto | opcional |
| data_cadastro | data/hora | — |
| origem | enum | `culto` \| `qr_code` |
| status | enum | ver seção 6 |
| perfil_abordagem | enum | ver seção 9 (pode ser nulo até ser classificado) |
| responsavel_id | ref Consolidador | dono atual do acompanhamento |
| lider_conexao_id | ref Líder | designado por proximidade + situação civil |
| conexao_id | ref Conexão | grupo destino |
| situacao_civil | enum | usada para escolher a Conexão |
| bairro/regiao | texto | usada para escolher a Conexão (proximidade) |
| flag_menor_idade | booleano | se verdadeiro, contato é com o responsável |
| flag_outra_cidade | booleano | visitante de passagem |
| flag_invalido_duplicado | booleano | dado inválido ou já cadastrado/membro |
| data_batismo_membresia | data | marco de integração concluída |
| observacoes | texto longo | — |
| criado_em / atualizado_em | data/hora | auditoria |

### 5.2. Interação (Contato)
Registro de **cada** contato realizado. É o coração do histórico.
| Campo | Tipo | Observações |
|---|---|---|
| id | identificador | — |
| visitante_id | ref Visitante | — |
| autor_id | ref (Consolidador ou Líder) | quem fez o contato |
| data | data/hora | — |
| canal | enum | `whatsapp` (default) |
| tipo | enum | `aproximacao` \| `conexao` \| `celebracao` \| `livre` \| `lider_pre_visita` |
| respondeu | booleano | houve retorno? |
| grau_abertura | enum | ex.: `alto` \| `medio` \| `baixo` \| `sem_resposta` |
| retorno_resumo | texto | o que a pessoa disse |
| proximos_passos | texto | o que fazer a seguir |
| encaminhamentos | texto | encaminhamentos realizados |
| flag_cuidado | booleano | sinal de crise/cuidado detectado neste contato |

### 5.3. Conexão (grupo)
| Campo | Tipo | Observações |
|---|---|---|
| id | identificador | — |
| nome | texto | — |
| lider_id | ref Líder | um ou mais |
| regiao/bairro | texto | usado no matching por proximidade |
| perfil | texto | ex.: solteiros, casais, jovens (situação civil) |
| dia_horario | texto | quando o grupo se encontra |

### 5.4. Líder de Conexão
`id, nome, whatsapp, conexao_id`

### 5.5. Consolidador
`id, nome, whatsapp, ativo`

### 5.6. Mensagem-modelo (template)
`id, gatilho (dia/tipo), texto_com_variaveis` — ver seção 10.

---

## 6. Estados do visitante (máquina de estados)

O status é o campo que dá visibilidade de onde cada pessoa está. Sugestão de estados:

| Status | Significado |
|---|---|
| **Novo** | Cadastrado, ainda não contatado. |
| **Em contato** | Primeira semana em andamento; há troca de mensagens. |
| **Aguardando resposta** | Contato feito, sem retorno ainda. |
| **Encaminhado ao líder** | Aceitou o convite; contato passado ao líder de Conexão (handoff antecipado). |
| **Visitou** | Compareceu à Conexão pela primeira vez. |
| **Transferido** | Líder assumiu o acompanhamento principal; consolidação em suporte. |
| **Integrado** | Frequenta encontros + celebrações, até batismo/membresia. |
| **Em espera** | 2 semanas sem resposta; acompanhamento leve. |
| **Recusou** | Pediu para não ser contatado; contatos encerrados. |
| **Encerrado / Inválido** | Duplicado, dado inválido ou visitante de passagem encerrado. |

**Flag transversal (não é status):** `Cuidado/Crise` — pode ser acionada a partir de qualquer status e dispara o acionamento da liderança, sem interromper o registro.

### Transições principais
| De | Para | Gatilho |
|---|---|---|
| Novo | Em contato | Primeiro contato realizado |
| Em contato | Aguardando resposta | Contato enviado, sem retorno |
| Aguardando resposta | Em contato | Pessoa respondeu |
| Em contato | Encaminhado ao líder | Pessoa **aceita o convite** para a Conexão |
| Encaminhado ao líder | Visitou | Pessoa comparece à Conexão |
| Visitou | Transferido | Líder **confirma** que assumiu o acompanhamento |
| Transferido | Integrado | Frequência sustentada; batismo/membresia |
| Em contato / Aguardando | Em espera | **2 semanas** sem resposta [confirmado] |
| Em espera | Em contato | Pessoa **sinaliza presença** / responde |
| qualquer | Recusou | Pessoa pede para parar |
| Novo / triagem | Encerrado/Inválido | Dado inválido, duplicado ou passagem |

---

## 7. Fluxo principal — passo a passo

### Fase 0 — Entrada e triagem [proposta]
1. O cadastro chega por **abordagem no culto** ou **autocadastro via QR code**.
2. O sistema aplica uma **triagem** antes de iniciar o fluxo:
   - **Dado/WhatsApp válido?** Se não → `Encerrado/Inválido`.
   - **Já é membro ou já está cadastrado (duplicado)?** Se sim → mesclar/encerrar.
   - **É menor de idade?** Se sim → contato direcionado ao **responsável** (subfluxo a detalhar).
   - **É de outra cidade / visitante de passagem?** Se sim → acolhimento pontual, sem entrar na semana.
3. Passando na triagem: o sistema **define o responsável** (consolidador) e o **status inicial = Novo**, e sugere a **Conexão/líder** por proximidade + situação civil.

### Fase 1 — Primeira semana (WhatsApp) [confirmado]
Sequência de três contatos, com **registro obrigatório após cada um** (ver seção 11):

| Dia | Tipo de contato | Intenção |
|---|---|---|
| **Segunda** | Aproximação | Acolher, dizer que a casa também é dela. |
| **Quarta** | Conexão | Apresentar o modelo de pastoreio e **convidar** para a Conexão. |
| **Sábado** | Celebração | Enviar a programação e reforçar o convite para o culto. |

Após **cada** contato, a resposta da pessoa é classificada em um dos quatro caminhos (seção 8).

### Fase 2 — Aceite do convite e handoff antecipado [confirmado]
Quando a pessoa **demonstra desejo de ir à Conexão**:
1. O status muda para **Encaminhado ao líder**.
2. O sistema/consolidador **entrega o contato ao líder** da Conexão designada.
3. O **líder faz o primeiro contato ANTES da visita**, para iniciar o vínculo.
4. Objetivo: a pessoa **não chega "de paraquedas"** — chega esperada e acolhida.

> **Atalho:** se a pessoa já demonstra abertura logo no primeiro contato, ela pode ir direto ao handoff, sem precisar percorrer toda a semana [proposta].

### Fase 3 — Visita e transferência
1. A pessoa **visita a Conexão** → status **Visitou**.
2. A **transferência só se conclui quando o líder confirma** que assumiu o acompanhamento principal → status **Transferido** [proposta].
3. A consolidação **permanece disponível para suporte** (acompanhando agora pela comunicação com o líder) [material].
   - *Decisão em aberto:* por quanto tempo a consolidação segue em paralelo (ver seção 16).

### Fase 4 — Integração (objetivo final) [confirmado]
- **Definição de "integrado":** a pessoa **frequentando os encontros da Conexão e as celebrações**, num caminho que se completa quando ela é **batizada ou recebida como membro**.
- *Visitar uma vez ≠ estar integrado.*

---

## 8. Caminhos de exceção (após cada contato)

### 8.1. PRONTO — respondeu e quer ir
Atalho direto para o **handoff ao líder** (Fase 2), sem esperar a semana inteira.

### 8.2. SILÊNCIO — não responde [proposta de parametrização]
1. Registrar "sem retorno" e **tentar novamente** no próximo dia do fluxo (Seg/Qua/Sáb).
2. **2 semanas** sem resposta [confirmado] → status **Em espera**: acompanhamento leve, só com informativos das celebrações.
3. **Reabrir** o contato pessoal assim que a pessoa **sinalizar presença**.

### 8.3. NÃO VAI À CONEXÃO — fim da 1ª semana sem visitar [prática]
1. **Repetir os contatos na 2ª semana.**
2. **Adaptar a abordagem ao perfil** da pessoa (seção 9).
3. Manter o convite para conhecer o líder; ao aceitar, segue para o handoff (Fase 2).

### 8.4. RECUSA — pede para parar [proposta]
1. Registrar a recusa → status **Recusou**.
2. Encerrar com gentileza e **parar os contatos**.
3. "Respeitar é não ser invasivo." A porta segue aberta se a pessoa retornar.

### 8.5. CUIDADO / CRISE — sinal de sofrimento ou urgência [proposta — protocolo a definir]
1. **Sair do roteiro** de consolidação.
2. **Acionar a liderança / pastor** (flag `Cuidado/Crise`).
3. **Registrar e acompanhar** o encaminhamento.
4. Nunca prometer nada em nome da igreja, nem agir sozinho. Havendo risco iminente, orientar também os serviços de emergência.
> O protocolo detalhado de cuidado será construído em um momento posterior.

---

## 9. Perfis de abordagem [material]

Usados para **adaptar** a comunicação, principalmente quando a pessoa ainda não foi à Conexão.

| Perfil | Como agir |
|---|---|
| **Pouca interação / sem líder definido** | Compartilhar informativos das celebrações e atividades. Quando a pessoa sinalizar presença, organizar o contato pessoal. |
| **Abriu-se, mas não visitou** | Continuar em contato ativo, buscando que conheça pessoalmente o líder sugerido em alguma celebração. |
| **Ainda não se abriu** | Mensagens objetivas e não invasivas. Mapear vivências na fé que possam ter criado bloqueios ou situações pessoais em andamento. |

---

## 10. Mensagens padrão (templates) [material]

Variável sugerida: `{{nome}}`. O app deve permitir editar templates e registrar a mensagem efetivamente enviada.

- **Segunda (Aproximação):**
  "Olá, {{nome}}! Foi uma alegria receber você conosco. Ficamos felizes pela sua presença, gostaríamos de te conhecer melhor e queremos dizer que essa casa também é sua. Conte conosco para o que precisar."

- **Quarta (Conexão):**
  "Bom dia, tudo bem? Como está a sua semana? Gostaria de te apresentar um pouco sobre o nosso modelo de pastoreio. Você já ouviu falar sobre conexão?"

- **Sábado (Celebração):**
  "Bom dia, tudo bem? Segue nossa programação de domingo, será um prazer ter você conosco novamente."

---

## 11. Registro por interação [material]

Após **cada** interação, registrar obrigatoriamente:
- **Data do contato**
- **Retorno da pessoa** (respondeu? o que disse?)
- **Grau de abertura**
- **Próximos passos**
- **Encaminhamentos realizados**

> Princípio: *"Uma consolidação sem registro gera perda de informações importantes."*

---

## 12. Regras de negócio (consolidadas)

1. Canal único: WhatsApp. [confirmado]
2. Primeira semana = 3 contatos: Seg (aproximação), Qua (conexão), Sáb (celebração). [confirmado]
3. Registro obrigatório após cada interação. [material]
4. Escolha da Conexão/líder por **proximidade + situação civil**; se não houver ideal, encaminhar a um **líder de Conexão designado**. [confirmado]
5. Ao **aceitar o convite**, o contato é passado ao líder, que fala com a pessoa **antes** da visita. [confirmado]
6. **2 semanas** sem resposta → status **Em espera**. [confirmado]
7. Da **Em espera**, retorna ao fluxo ativo quando a pessoa **sinaliza presença**. [confirmado/prática]
8. Não visitou na 1ª semana → **repetir na 2ª semana**, adaptando ao perfil. [prática]
9. **Transferência só se conclui com a confirmação do líder.** [proposta]
10. **Integrado** = frequência em encontros + celebrações, até **batismo/membresia**. [confirmado]
11. **Recusa** → encerrar e parar contatos. [proposta]
12. **Cuidado/crise** → acionar liderança; protocolo a definir. [proposta]

---

## 13. Automações e notificações sugeridas [proposta]

- **Agenda de contatos:** lembrar o consolidador dos contatos de Seg/Qua/Sáb.
- **Contador de silêncio:** ao completar 2 semanas sem resposta, mover automaticamente para **Em espera** e notificar o responsável.
- **Handoff:** ao marcar "aceitou o convite", notificar o líder de Conexão e disponibilizar o contato.
- **Confirmação de transferência:** cobrar do líder a confirmação de que assumiu; alertar se ficar pendente.
- **Alerta de cuidado/crise:** ao acionar a flag, notificar imediatamente a liderança.
- **Sem responsável:** alertar a coordenação se algum visitante ficar sem responsável ativo.
- **Reengajamento:** avisar quando alguém "Em espera" sinalizar presença.

---

## 14. Métricas e relatórios [proposta]

- **Funil de consolidação:** Novos → Em contato → Encaminhados ao líder → Visitaram → Transferidos → Integrados.
- **Taxa de resposta** por período e por consolidador.
- **Taxa de visita à Conexão** (dos que aceitaram o convite).
- **Tempo médio** do cadastro à visita e da visita à integração.
- **Volume por status** (quantos em espera, recusaram, etc.).
- **Casos de cuidado/crise** acionados (para acompanhamento pastoral).

---

## 15. Requisitos funcionais (resumo para o app)

1. Cadastrar visitante (manual, no culto) e receber autocadastro via QR code.
2. Aplicar triagem de entrada (validação, duplicidade, menor, outra cidade).
3. Atribuir responsável e sugerir Conexão/líder (proximidade + situação civil).
4. Exibir/editar e registrar as mensagens padrão por WhatsApp.
5. Agendar e lembrar os contatos da primeira semana.
6. Registrar cada interação com os campos da seção 11.
7. Classificar a resposta (pronto / silêncio / recusa / cuidado).
8. Gerenciar o status do visitante (máquina de estados da seção 6).
9. Executar automações de prazo (2 semanas → Em espera).
10. Realizar o handoff ao líder e registrar a confirmação de transferência.
11. Painel do líder de Conexão (seus visitantes encaminhados/transferidos).
12. Sinalizar cuidado/crise e notificar a liderança.
13. Marcar integração (batismo/membresia).
14. Gerar relatórios/funil (seção 14).
15. Manter histórico e auditoria de cada pessoa.

---

## 16. Decisões em aberto (validar antes de fechar o app)

1. **Consolidação em paralelo após o handoff:** por quanto tempo a consolidação continua acompanhando depois que o líder assume — até a integração se confirmar, ou sai de cena ao passar o contato?
2. **Subfluxo do menor de idade:** o que exatamente muda no contato com o responsável.
3. **Protocolo de cuidado/crise:** passos, quem aciona, tempos de resposta.
4. **Parâmetros do "atalho" (PRONTO):** o que caracteriza "já pronto" para pular a semana.
5. **Deduplicação:** por qual chave o sistema identifica duplicados (WhatsApp? nome?).

---

## 17. Princípios e cultura (guardrails do sistema) [material]

Estes valores devem guiar as decisões de produto e as mensagens automáticas:

- Amar pessoas; ouvir com atenção; ser intencional.
- Não ser invasivo; cumprir os prazos do fluxo; atualizar o sistema.
- Conectar pessoas à família da igreja; **mais importante que fazer contatos é fazer discípulos**.
- Acolhemos e cuidamos das vidas em amor, como filhas amadas de Deus.
- Não se comprometa em nome da igreja e não faça nada sozinho.
- **"Não estamos falando de um produto, e sim de pessoas."**

---

*Documento base para o desenvolvimento do app de consolidação da iFE. Itens marcados como [proposta] aguardam validação da equipe.*
