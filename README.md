# Consolidação de Visitantes (white-label)

Sistema de gestão da consolidação de visitantes, desenvolvido a partir da especificação da iFE (`Consolidacao-iFE-Especificacao.md`) e preparado para ser adaptado a **qualquer igreja**.

## Configurável por igreja (Configurações → Minha igreja)

- **Nome da igreja e subtítulo** — aparecem no menu, na aba do navegador e no autocadastro público.
- **Cor principal** — todo o sistema (botões, menu, destaques) muda na hora.
- **Nome do grupo pequeno** — Conexão, Célula, PG, GC… usado nos textos do sistema.
- **Prazo de silêncio** — quantos dias sem resposta até mover para "Em espera" (padrão 14).
- **Cultos/celebrações** — lista própria, usada para registrar em qual culto a pessoa veio pela 1ª vez.
- **Mensagens** — as 6 do fluxo são editáveis, e é possível cadastrar quantas mensagens extras quiser (aparecem no "Contato livre").

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173 no navegador.

Para gerar a versão de produção (pasta `dist/`, hospedável em qualquer serviço de site estático):

```bash
npm run build
```

## O que o sistema faz

- **Painel** — "Ações de hoje" (o que fazer com cada visitante, com botão que abre o WhatsApp com a mensagem pronta), funil de consolidação, KPIs e alertas: cuidado/crise, visitante sem responsável, transferência pendente do líder e lembrete de dia de contato (Seg/Qua/Sáb).
- **Jornada (Kanban)** — quadro visual com uma coluna por etapa; arraste o cartão para avançar o visitante. Transições inválidas são bloqueadas pela máquina de estados.
- **Equipe** — cadastro de usuários por categoria (Gestão Integração, Integradores pós-culto, Líder de Conexão, Pastores e Gestão Ministerial), com ativação/desativação e vínculo do líder à sua Conexão.
- **Correção de status** — na ficha do visitante: "Desfazer última mudança" (volta ao status anterior) ou "Corrigir para outro status" (qualquer destino, com motivo registrado no histórico como correção).
- **Visitantes** — lista com filtros por status, busca e contador de dias sem resposta.
- **Ficha do visitante** — histórico completo de contatos e de status, registro obrigatório por interação (retorno, grau de abertura, próximos passos, encaminhamentos), classificação em 4 caminhos (PRONTO / SILÊNCIO / RECUSA / CUIDADO), mudanças de status limitadas às transições válidas da máquina de estados, flag transversal de cuidado/crise, marcação de batismo/membresia.
- **Novo visitante** — cadastro manual (culto) com triagem automática da Fase 0 (WhatsApp válido, duplicado por WhatsApp, menor de idade, outra cidade) e sugestão de Conexão por proximidade + situação civil.
- **Autocadastro** (`#/autocadastro`) — formulário público para o QR code, sem menu.
- **Painel do líder** — fila de handoff (falar ANTES da visita), confirmação de visita e confirmação de que assumiu o acompanhamento.
- **Configurações** — Conexões, líderes, consolidadores e templates de mensagem editáveis (`{{nome}}`).
- **Automação** — 2 semanas sem resposta move automaticamente para "Em espera" (roda ao abrir o app).

## Onde ficam os dados

**Modo padrão (offline):** localStorage do navegador (chave `ife-consolidacao-v1`) — cada dispositivo tem sua cópia.

**Modo online (recomendado):** conecte um projeto Supabase em *Configurações → Dados → Sincronização online*. Toda mudança passa a ser salva na nuvem automaticamente (com indicador de status), e qualquer dispositivo conectado com as mesmas credenciais acessa os mesmos dados. O passo a passo completo — criação da conta, SQL da tabela e publicação do site na Vercel — está em **[SUPABASE.md](SUPABASE.md)**.

Em **Configurações → Dados** também há exportação/restauração de backup (.json) e a opção de zerar os dados.

## Padrão visual

O design system dos sistemas iFE (tokens, componentes e princípios) está documentado em
**[PADRAO-SISTEMA-INTEGRACAO.md](PADRAO-SISTEMA-INTEGRACAO.md)** — par do `PADRAO-GRID-REPERTORIO.md`
do Sistema de Louvor. Use-o como referência ao criar novos sistemas da mesma família.

## Estrutura

```
src/
  types.ts        # entidades e enums (seção 5 e 6 da especificação)
  machine.ts      # máquina de estados e transições válidas
  store.ts        # persistência (localStorage), seeds e automações de prazo
  actions.ts      # regras de negócio: triagem, registro de contato, handoff, integração
  router.ts       # roteador por hash
  App.tsx         # layout e navegação
  pages/          # Painel, Visitantes, Ficha, Novo, Autocadastro, Painel do líder, Configurações
```

## Decisões em aberto da especificação (como foram tratadas)

- **Deduplicação** — chave provisória: número de WhatsApp normalizado.
- **Transferência** — só se conclui com a confirmação explícita do líder no painel dele.
- **Atalho PRONTO** — disponível em qualquer contato, via classificação da resposta.
- **Protocolo de cuidado/crise** — flag transversal + alerta com as orientações da seção 8.5; protocolo detalhado fica para quando a iFE definir.
- **Menor de idade** — flag com aviso permanente na ficha ("contato com o responsável").
