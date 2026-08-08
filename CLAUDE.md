# Sistema Integrar — mapa do projeto

App web (SPA React + TypeScript + Vite) para gestão da **consolidação de visitantes**
de igrejas. É **white-label**: nome, cores e termos (Conexão/Célula/PG, nomes das
etapas e papéis) vêm da configuração da igreja. Sincroniza na nuvem via Supabase.

## Comandos

```bash
npm run dev      # servidor de desenvolvimento (Vite)
npm run build    # tsc -b && vite build  → use isto para VERIFICAR que nada quebrou
```

Não há testes automatizados nem linter. A verificação de referência é `npm run build`
(faz typecheck completo + build). Rode-o depois de qualquer mudança em código.

## ⚠️ Avisos críticos

- **O dev server grava na nuvem de PRODUÇÃO.** Rodar `npm run dev` conecta ao Supabase
  real. Nunca injete dados de teste no app rodando; ao verificar o preview, apenas
  confira que a tela renderiza — não crie/edite registros.
- **Dados pessoais reais** ficam em `backups/` (gitignored). Nunca versione nem os use
  em seeds. Nunca ponha pessoas reais em dados de exemplo.
- Preferir `npm run build` (offline) a subir o dev server quando o objetivo for só
  garantir que o código compila.

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
  por igreja, com mesclagem registro a registro.
- `mesclar.ts` — mescla estado local × nuvem por id (evita sobrescrita entre aparelhos).
- `supabaseClient.ts` — cliente Supabase (auth + storage; sessão para o RLS).
- `acesso.ts` — controle de acesso por papel/hierarquia (quem vê/acessa o quê).
- `auditoria.ts` — trilha de auditoria (LGPD): quem fez o quê, quando.

### Apoio
- `cultos.ts` — ocorrências de culto (dia da semana → datas concretas).
- `relatorios.ts` — cálculos puros dos relatórios (funil, batismos, distribuições).
- `tema.ts` — paletas e cor de contraste (o CSS deriva os tons por color-mix).
- `toast.ts` — aviso rápido "Salvo ✓". `icones.tsx` — ícones SVG. `ErroBoundary.tsx`.

### Telas (`src/pages/`)
Painel (`Dashboard`), `Jornada`, `Visitantes` (lista) → `VisitanteDetalhe` (ficha,
grande), `NovoVisitante`, `PainelLider`, `Equipe`, `Aprovacoes`, `Auditoria`,
`Relatorios`, `Configuracoes` (grande, por abas), `Ajuda`. Públicas: `Autocadastro`,
`CadastroIntegrante`, `Entrar`, `AguardandoAprovacao`.

### Estilo
- `styles.css` — CSS global, organizado por seções comentadas (design tokens,
  sidebar, tabelas, formulários, ficha do visitante, kanban, autocadastro…).

## Convenções

- **Tudo em português** (nomes de arquivos, funções, variáveis, comentários). Siga.
- Combine com o código ao redor: densidade de comentários, nomenclatura, idioma.
- Termos e nomes de etapas/papéis são **configuráveis** — use os rótulos
  (`rotuloPapel`, `rotuloEtapa`, `aplicarRotulos`), não textos fixos.
- Cores derivadas saem das 3 cores da igreja via `color-mix` no CSS; não fixe cores.

## Documentos de referência (NÃO leia sem necessidade)

Na raiz há especificações e manual longos — só consulte quando a tarefa pedir:
`Consolidacao-iFE-Especificacao.md`, `PADRAO-SISTEMA-INTEGRACAO.md`, `manual.html`,
`README.md`, `SUPABASE.md`, `SUPABASE-AUTH.md`.
