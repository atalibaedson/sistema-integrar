# Sistema Integrar — mapa do projeto

App web (SPA React + TypeScript + Vite) para gestão da **consolidação de visitantes**
de igrejas. É **white-label**: nome, cores e termos (Conexão/Célula/PG, nomes das
etapas e papéis) vêm da configuração da igreja. Sincroniza na nuvem via Supabase.

## Comandos

```bash
npm run dev      # servidor de desenvolvimento (Vite) — ⚠️ conecta à PRODUÇÃO
npm run dev:demo # modo demonstração: SEM nuvem, igreja e sessão fictícias (demo.ts)
npm run build    # tsc -b && vite build  → use isto para VERIFICAR que nada quebrou
npm test         # vitest run — módulos puros (máquina, mesclagem, relatórios…)
```

Não há linter. A verificação de referência é `npm run build` (typecheck completo +
build) e `npm test`. Rode ambos depois de qualquer mudança em código; o deploy é na
**Vercel** (push na `main`) e o build roda `npm test && npm run build` (via
`vercel.json`), então um teste quebrado barra o deploy.

## ⚠️ Avisos críticos

- **O dev server grava na nuvem de PRODUÇÃO.** Rodar `npm run dev` conecta ao Supabase
  real. Nunca injete dados de teste no app rodando; ao verificar o preview, apenas
  confira que a tela renderiza — não crie/edite registros.
- **Dados pessoais reais** ficam em `backups/` (gitignored). Nunca versione nem os use
  em seeds. Nunca ponha pessoas reais em dados de exemplo.
- Preferir `npm run build` (offline) a subir o dev server quando o objetivo for só
  garantir que o código compila.
- Para **ver/conferir telas** (inclusive as internas, que exigem login), use
  `npm run dev:demo`: não conecta à nuvem e tem dados fictícios. O modo demo só
  existe no servidor de desenvolvimento — nunca entra no build publicado.

## Arquitetura

Roteamento por **hash** (`#/rota`), sem biblioteca de router. Estado global em
`store.ts` (localStorage + sincronização opcional com a nuvem). Sem framework de
estado externo — hooks + `useSyncExternalStore`.

Fluxo de boot e roteamento central: **`src/App.tsx`** (ler primeiro). Ele decide
rotas públicas (autocadastro, cadastro-integrante, entrar), login obrigatório,
aprovação de conta e aplica a identidade da igreja (cores + rótulos).

## Mapa dos arquivos

### Núcleo
- `App.tsx` — layout, menu, roteamento central, boot da sessão, tema da igreja.
- `router.ts` — router mínimo por hash (`useRota`, `navegar`).
- `store.ts` — estado global (localStorage + nuvem) + automações de prazo.
- `types.ts` — **modelo de dados** (Visitante, Interacao, Conexao, Usuario, Config,
  Template, Status, Papel…) e rótulos configuráveis (`aplicarRotulos`, `rotuloPapel`).
- `actions.ts` — regras de negócio: cadastrar visitante/integrante, registrar
  interação, mudar status, aprovar conta, batismo/membresia, próxima ação sugerida.
- `machine.ts` — máquina de estados do visitante (transições permitidas do funil).
- `campos.tsx` — componentes de formulário compartilhados (Escolha, BotaoSalvar,
  SeletorData) usados pelo autocadastro público e pelo cadastro da equipe.

### Nuvem / auth
- `nuvem.ts` — sync via Supabase (fetch puro/PostgREST); estado inteiro como 1 JSON
  por igreja, com mesclagem registro a registro. Gravação condicional por versão
  (`gravarEstadoCondicional`) e canais públicos do visitante (`baixarConfigPublica`,
  `cadastrarVisitantePublico`) — a página pública NÃO baixa o estado da igreja.
- `mesclar.ts` — mescla estado local × nuvem por id (evita sobrescrita entre aparelhos).
- `supabaseClient.ts` — cliente Supabase (auth + storage; sessão para o RLS).
- `acesso.ts` — controle de acesso por papel/hierarquia (quem vê/acessa o quê). As regras
  PURAS (supervisiona, podeVerVisitante, podeVerCuidado…) ficam em `regras-acesso.ts`
  (o servidor usa a mesma) e são reexportadas por `acesso.ts`.
- `auditoria.ts` — trilha de auditoria (LGPD): quem fez o quê, quando.

### Apoio
- `cultos.ts` — ocorrências de culto (dia da semana → datas concretas).
- `relatorios.ts` — cálculos puros dos relatórios (funil, batismos, distribuições).
- `tema.ts` — paletas e cor de contraste (o CSS deriva os tons por color-mix).
- `toast.ts` — aviso rápido "Salvo ✓". `icones.tsx` — ícones SVG. `ErroBoundary.tsx`.
- `Avatar.tsx` — avatar de pessoa (iniciais + cor estável por nome, ou foto); use-o
  em vez de montar círculos à mão.
- `TelaPublica.tsx` — moldura das telas públicas (entrar, criar acesso, nova senha,
  aguardando, autocadastro): painel institucional + conteúdo, padrão da família iFE.
- `alertas.ts` — **central de avisos**, regras PURAS (sem navegador): `calcularAlertas`
  gera cada aviso com destinatários e nível (o aviso SOBE: responsável → líder acima →
  Gestão); `alertasDoUsuario` filtra por pessoa e tira os adiados; `alertasConfig` aplica
  os prazos de Configurações → Avisos. Roda no app **e** no servidor (push).
- `avisos.ts` — liga o `alertas.ts` ao app: `useAvisos()` (sino, Painel, selos nas listas),
  `dispensarAviso` (adiar / já resolvi, guardado em `AppState.dispensas`) e `reativarAviso`.
- `push.ts` + `public/sw.js` — notificações push (inscrever/cancelar/testar via função
  `alertas-push`; o service worker só exibe a notificação, **sem cache**).
- `papeis.ts` — `PAPEL_DESC`: descrição curta de cada função (cadastro de integrante e Equipe).
- `demo.ts` — modo demonstração (`npm run dev:demo`): igreja e sessão fictícias.
- `carregar.ts` — `lazyComRecarga`: telas menos usadas carregam sob demanda (App.tsx);
  se um deploy novo trocou os arquivos, recarrega a página uma vez em vez de quebrar.

### Telas (`src/pages/`)
Painel (`Dashboard`), `Avisos` (central de avisos + ativar push), `Jornada`, `Visitantes` (lista) → `VisitanteDetalhe` (ficha,
grande), `NovoVisitante`, `PainelLider`, `Equipe/` (pasta: `index` lista + resumo, `Hierarquia` em árvore, `EditarMembro` e
`NovoMembro` na `Gaveta` lateral, `comum` com chips/seletor de funções), `Aprovacoes`, `Auditoria`,
`Relatorios`, `Configuracoes` (grande, por abas), `Ajuda`. Públicas: `Autocadastro`,
`CadastroIntegrante`, `Entrar`, `NovaSenha` (link "esqueci a senha"), `AguardandoAprovacao`.

## Garantias da sincronização (não quebrar)

- O sync espera a sessão do Supabase (`esperarSessaoPronta`) antes da 1ª leitura: sem
  token, o RLS devolve lista VAZIA, não erro, e "vazio" seria confundido com nuvem sem dados.
- Leitura vazia nunca grava por cima: só `enviarEstado(..., 'so_se_vazio')` (INSERT que o
  banco ignora se já houver registro). Aparelho virgem sem edição não sobe nada.
- Aparelho virgem com edição mescla com a NUVEM como base (`mesclarEstados(remoto, local)`).
- Toda ação destrutiva/administrativa em usuário passa por `registrarAuditoria`.
- Gravação é condicional por versão (carimbo `atualizado_em`): se alguém escreveu
  desde a leitura, relê e mescla de novo — não sobrescreve.
- A rota pública do visitante (`ehRotaPublicaVisitante`) NÃO sincroniza o estado:
  lê só a config (`carregarConfigPublica`) e grava pela Edge Function
  `cadastrar-visitante` (servidor, service role). Ver `IMPLANTACAO-PRIORIDADE-1.md`.

### Avisos e push (não quebrar)

- `src/alertas.ts`, `src/regras-acesso.ts` e `src/types.ts` têm CÓPIA em
  `supabase/functions/_shared/` (gerada por `npm run sincronizar:servidor`). Mudou um deles?
  Rode o script e republique a função `alertas-push` — o teste `servidor-sincronizado`
  barra o deploy se esquecer. Esses arquivos não podem importar nada de navegador/React.
- O texto do push só tem **contagens**: nunca ponha nome de visitante na notificação
  (aparece na tela bloqueada; LGPD).
- Cuidado/crise só vai para quem `podeVerCuidado` (pastores + responsável).
- Runbook do push (VAPID, SQL 08, cron): `IMPLANTACAO-ALERTAS-PUSH.md`.

### Servidor (Supabase — implantação manual)
- `supabase/functions/cadastrar-visitante/` — grava o autocadastro no servidor.
- `supabase/functions/alertas-push/` — inscrições e envio dos pushes (rotina agendada a
  cada 30 min); usa `_shared/` (cópia das regras dos avisos). `supabase/sql/08_alertas_push.sql`.
- `supabase/sql/01..04_*.sql` — RPCs (append atômico, config pública), backup e
  endurecimento do RLS. Rodar na ordem; o 04 (RLS) por último. Ver o runbook.

### Testes
- `src/__tests__/*.test.ts` (Vitest) cobrem os módulos puros: máquina de estados,
  mesclagem, relatórios, cultos, tema. `npm test`. Rodam no build da Vercel.

### Estilo
- `styles.css` — CSS global, organizado por seções comentadas (design tokens,
  sidebar, tabelas, formulários, ficha do visitante, kanban, autocadastro…).

## Convenções

- **Tudo em português** (nomes de arquivos, funções, variáveis, comentários). Siga.
- Combine com o código ao redor: densidade de comentários, nomenclatura, idioma.
- Termos e nomes de etapas/papéis são **configuráveis** — use os rótulos
  (`rotuloPapel`, `rotuloEtapa`, `aplicarRotulos`), não textos fixos.
- Cores derivadas saem das 3 cores da igreja via `color-mix` no CSS; não fixe cores.
- **Padrão visual da família iFE** (Louvor v9 / Check-iFE): barra lateral na cor
  escura, títulos em serifa (`--serif`, Fraunces), texto em Plus Jakarta Sans,
  semânticos `--ok/--warn/--danger` (+ `-soft`). Primária usada como TEXTO é
  `--acento-texto` (clareada no tema escuro), não `--primary`. Paleta padrão:
  "Padrão iFE" (`tema.ts`). Versão no rodapé = `package.json` (`__APP_VERSION__`).
  Peças reutilizáveis: `.pilulas`/`.pilula` (filtros com bolinha e contagem),
  `.chip-etapa` (etapa do visitante), `.painel-chip-*` (etiquetas semânticas),
  `.voltar` (link de voltar), `.eq-gaveta` (painel lateral de edição), `.eq-resumo` (quadros de resumo),
  `.eq-papel` (função com cor própria via `--c`). Ícones SVG, não emoji, em títulos e rótulos.

## Documentos de referência (NÃO leia sem necessidade)

Na raiz há especificações e manual longos — só consulte quando a tarefa pedir:
`Consolidacao-iFE-Especificacao.md`, `PADRAO-SISTEMA-INTEGRACAO.md`, `manual/manual.html`,
`IMPLANTACAO-ALERTAS-PUSH.md`,
`README.md`, `SUPABASE.md`, `SUPABASE-AUTH.md`.

## Manual do usuário

`manual/manual.html` (fonte, com imagens em `manual/img/`, tiradas do `dev:demo` —
só dados fictícios) gera o PDF `public/Manual-Integracao-iFE.pdf`, baixado pela
tela Ajuda. Depois de mudar telas que aparecem no manual, atualize as imagens e
gere o PDF de novo (Chrome instalado no Mac):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --virtual-time-budget=8000 --print-to-pdf=public/Manual-Integracao-iFE.pdf "file://$PWD/manual/manual.html"
```
