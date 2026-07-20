# Padrão visual dos sistemas iFE — extraído do Sistema de Integração

> Cole este documento inteiro numa nova sessão do Claude Code como referência de estilo.
> É **autocontido**: não depende de framework nem de arquivos de outro sistema.
> Par do documento `PADRAO-GRID-REPERTORIO.md` (Sistema de Louvor) — os dois usam os MESMOS tokens.
> Fonte: Inter. Estilo: minimalista neutro (Notion/Linear). Funciona com HTML+CSS+JS puro ou React.

Este documento cobre o **layout do app inteiro** (sidebar com seções, cabeçalho com chips,
navegação mobile) e os componentes que o Sistema de Integração acrescentou ao padrão:
badges suaves, cartões de pessoa com avatar, KPIs, abas, funil e botões de ícone.

---

## 1. Design tokens (cole no `:root`)

```css
:root {
  /* A COR PRIMÁRIA É CONFIGURÁVEL POR IGREJA (white-label).
     Os tons derivados são calculados — troque só a --primary. */
  --primary: #4f46e5;
  --primary-dark: color-mix(in srgb, var(--primary) 78%, black);
  --primary-soft: color-mix(in srgb, var(--primary) 9%, white);

  /* Neutros compartilhados com o Sistema de Louvor */
  --bg: #F6F8FA;
  --surface: #FFFFFF;
  --surface2: #EFF3F6;
  --border: #E4E9EE;
  --border-strong: #D5DDE5;
  --text: #1B2530;
  --text-2: #5D6B7A;          /* = --text-muted do Louvor */
  --text-3: #93A1B0;          /* = --text-light do Louvor */
  --danger: #C93A3A;
  --warn: #b45309;
  --ok: #1E8E4D;

  --shadow-sm: 0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.05);
  --shadow: 0 4px 12px rgba(16,24,40,0.06), 0 2px 4px rgba(16,24,40,0.04);
  --radius: 12px;
  --radius-sm: 8px;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --transition: 0.16s ease;
}

body {
  font-family: var(--font); background: var(--bg); color: var(--text);
  font-size: 14px; -webkit-font-smoothing: antialiased; letter-spacing: -0.011em;
}
```

Fonte Inter (no `<head>`):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Para o white-label, o app aplica a cor da igreja em tempo real:
```js
document.documentElement.style.setProperty('--primary', corDaIgreja)
```

---

## 2. Layout do app: sidebar clara com seções

```css
.layout { display: flex; min-height: 100vh; }
.sidebar {
  width: 244px; flex-shrink: 0;
  background: var(--surface); border-right: 1px solid var(--border);
  padding: 18px 14px; display: flex; flex-direction: column; gap: 2px;
}
.marca { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; padding: 4px 6px 16px; }
.marca-logo {
  width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
  background: var(--primary); color: #fff;
  display: flex; align-items: center; justify-content: center; font-weight: 800;
}
.marca small { display: block; font-size: 11px; font-weight: 500; color: var(--text-3); }

/* Rótulo de seção do menu (PRINCIPAL / GESTÃO...) */
.menu-secao {
  font-size: 10.5px; font-weight: 700; letter-spacing: .09em;
  text-transform: uppercase; color: var(--text-3); margin: 14px 8px 5px;
}
.sidebar a {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 12px; border-radius: 9px;
  color: var(--text-2); text-decoration: none; font-weight: 600; font-size: 13.5px;
}
.sidebar a:hover { background: var(--bg); color: var(--text); }
.sidebar a.ativo { background: var(--primary-soft); color: var(--primary); }

.conteudo { flex: 1; padding: 28px 32px; max-width: 1200px; }
.titulo-pagina { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.subtitulo { color: var(--text-2); margin-bottom: 22px; }
```

HTML:
```html
<div class="layout">
  <nav class="sidebar">
    <div class="marca">
      <span class="marca-logo">IF</span>
      <span>Nome da Igreja<small>Nome do sistema</small></span>
    </div>
    <div class="menu-secao">Principal</div>
    <a href="#/" class="ativo">📊 Painel</a>
    <a href="#/itens">👥 Itens</a>
    <div class="menu-secao">Gestão</div>
    <a href="#/config">⚙️ Configurações</a>
    <div class="rodape">frase institucional</div>
  </nav>
  <main class="conteudo"><!-- página --></main>
</div>
```

### Chips de status no topo da página (opcional)
```css
.cab-chips { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-bottom: 14px; }
.chip-status {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;
  border-radius: 999px; font-size: 12px; font-weight: 600;
  background: var(--surface); border: 1px solid var(--border); color: var(--text-2);
}
.st-ok   { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
.st-erro { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
```
Uso: `<span class="chip-status st-ok">● Sincronizado</span>` — igual ao "Sincronizado" do Louvor.

---

## 3. Cards, abas e barra de filtros

```css
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-sm);
  padding: 18px 20px; margin-bottom: 16px;
}
.card h3 { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 12px; }
.card-cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.descricao-secao { font-size: 12.5px; color: var(--text-3); margin: -6px 0 12px; line-height: 1.5; }

/* Abas sublinhadas (Configurações etc.) */
.abas { display: flex; gap: 4px; border-bottom: 2px solid var(--border); margin-bottom: 16px; overflow-x: auto; }
.aba {
  padding: 9px 14px; margin-bottom: -2px; font-size: 13.5px; font-weight: 600;
  color: var(--text-2); background: none; border: none;
  border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap;
}
.aba.ativa { color: var(--primary); border-bottom-color: var(--primary); }

/* Barra de filtros acima do card (padrão do grid do Louvor) */
.filter-bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
.search-box { position: relative; display: flex; align-items: center; }
.search-box input[type="text"] { padding-left: 36px; }
.search-box .search-icon { position: absolute; left: 10px; color: var(--text-3); pointer-events: none; display: inline-flex; }
.search-box .search-icon svg { width: 16px; height: 16px; }
```

Ícone de busca (SVG inline):
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
     stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
</svg>
```

---

## 4. Formulários e botões

```css
input, select, textarea {
  width: 100%; padding: 9px 12px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); font-family: var(--font); font-size: 14px;
  color: var(--text); background: var(--surface); outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}
input:focus, select:focus, textarea:focus {
  border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft);
}
input::placeholder { color: var(--text-3); }

label.campo { display: block; margin-bottom: 12px; }
label.campo span { display: block; font-weight: 600; font-size: 12.5px; margin-bottom: 4px; color: var(--text-2); }
.linha-campos { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }  /* 1fr no mobile */

.btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--font);
  background: var(--primary); color: #fff;
  box-shadow: 0 1px 2px rgba(16,24,40,0.10); transition: all var(--transition);
}
.btn:hover { filter: brightness(0.92); }        /* hover sempre ESCURECE */
.btn-sec { background: var(--surface); color: var(--text); border-color: var(--border-strong); box-shadow: none; }
.btn-sec:hover { background: var(--surface2); filter: none; }
.btn-mini { padding: 5px 10px; font-size: 12.5px; }
.btn-whats { background: #22c55e; color: #fff; text-decoration: none; }  /* ação de WhatsApp */

/* Botões de ícone (editar/lixeira/whats) — usados em linhas e cartões */
.btn-icone {
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--surface); border: 1px solid var(--border);
  cursor: pointer; font-size: 14px; color: var(--text-2); text-decoration: none;
}
.btn-icone:hover { background: var(--bg); }
.btn-icone.perigo { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn-icone.ok     { background: var(--ok);     border-color: var(--ok);     color: #fff; }
.btn-icone.whats  { background: #22c55e;       border-color: #22c55e;      color: #fff; }
```
Convenção de ícones: ✏️ editar · 🗑️ remover · 💬 WhatsApp · ✓ salvar · ✕ cancelar.
**Remover é sempre lixeira em botão vermelho, nunca texto "Remover".**

---

## 5. Tabela (grid) e badges

```css
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th {
  text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-2); padding: 10px 16px;
  border-bottom: 1px solid var(--border); background: var(--surface2); white-space: nowrap;
}
td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: middle; }
tr.clicavel { cursor: pointer; }
tr.clicavel:hover { background: var(--bg); }

.cell-title { font-weight: 600; color: var(--text); }
.cell-sub { font-size: 12px; color: var(--text-2); margin-top: 2px; }

/* Badge SUAVE: fundo claro + texto colorido (nunca fundo forte + texto branco) */
.badge {
  display: inline-flex; align-items: center; padding: 3px 10px;
  border-radius: 99px; font-size: 11px; font-weight: 700; white-space: nowrap;
}
```

Como gerar a badge suave a partir de uma cor de status (hex de 6 dígitos):
```js
// '#0ea5e9' -> fundo '#0ea5e922' (13% alpha) + texto na própria cor
function estiloStatus(cor) { return { background: cor + '22', color: cor } }
```
Paleta de status do Sistema de Integração (referência):
`novo #6366f1 · em contato #0ea5e9 · aguardando #f59e0b · com líder #8b5cf6 ·
visitou #14b8a6 · transferido #10b981 · integrado #22c55e · em espera #94a3b8 ·
recusou #ef4444 · encerrado #64748b`

---

## 6. Pessoas: avatar, cartão e grade

```css
.avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  color: #fff; font-weight: 700; font-size: 13.5px;
  display: flex; align-items: center; justify-content: center; user-select: none;
}
.grade-cartoes { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; }
.cartao-pessoa {
  border: 1px solid var(--border); border-radius: 12px; background: var(--surface);
  padding: 13px 14px; display: flex; gap: 12px; align-items: flex-start;
}
.cartao-acoes { display: flex; gap: 6px; flex-shrink: 0; }
.pessoa-nome { font-weight: 600; font-size: 14px; }
.pessoa-sub { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.tag {
  display: inline-block; padding: 3px 10px; margin: 2px 4px 2px 0;
  border-radius: 999px; font-size: 11.5px; font-weight: 600;
  background: var(--bg); border: 1px solid var(--border); color: var(--text-2);
}
```

```js
// Iniciais para o avatar: "Maria da Silva" -> "MD"
function iniciais(nome) {
  const p = nome.trim().split(/\s+/)
  return (p[0][0] + (p[1]?.[0] ?? '')).toUpperCase()
}
```

HTML do cartão (padrão "Integrantes & Bandas"):
```html
<div class="cartao-pessoa">
  <div class="avatar" style="background:#0ea5e9">MS</div>
  <div style="flex:1;min-width:0">
    <div class="pessoa-nome">Maria da Silva</div>
    <div><span class="tag">Consolidadora</span><span class="tag">🏠 Conexão Amor</span></div>
    <div class="pessoa-sub">📱 (24) 99999-9999</div>
  </div>
  <div class="cartao-acoes">
    <a class="btn-icone whats" title="WhatsApp">💬</a>
    <button class="btn-icone" title="Editar">✏️</button>
    <button class="btn-icone perigo" title="Remover">🗑️</button>
  </div>
</div>
```

---

## 7. KPIs e gráfico de barras (funil / relatórios)

```css
.grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
.kpi .valor { font-size: 26px; font-weight: 700; }
.kpi .rotulo { color: var(--text-2); font-size: 12px; margin-top: 2px; }
/* variação clicável (vira filtro): borda superior colorida de 3px + outline quando ativa */

.funil-etapa { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.funil-rotulo { width: 190px; font-size: 13px; color: var(--text-2); text-align: right; flex-shrink: 0; }
.funil-barra-area { flex: 1; }
.funil-barra {
  height: 26px; border-radius: 6px; display: flex; align-items: center; padding: 0 10px;
  color: #fff; font-weight: 700; font-size: 13px; min-width: 34px; transition: width .3s;
}
```
Barra: `style="width: NN%; background: COR"` — largura proporcional ao maior valor, mínimo ~8%.

---

## 8. Alertas inline

```css
.alerta { padding: 11px 14px; border-radius: 8px; margin-bottom: 8px; font-size: 13.5px; display: flex; gap: 8px; align-items: flex-start; }
.alerta-warn   { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.alerta-perigo { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.alerta-info   { background: var(--primary-soft); border: 1px solid color-mix(in srgb, var(--primary) 25%, white); color: var(--primary-dark); }
```
Padrão: emoji + `<div>` com o texto; pode terminar com um botão de ação à direita.

---

## 9. Mobile: barra de navegação inferior (não use menu sanduíche)

No mobile (≤960px): a sidebar vira só a barra de marca no topo (links escondidos), e a
navegação vai para uma **barra inferior fixa** com 4 itens + "Mais" (bottom sheet), como
WhatsApp/Instagram. A ação mais frequente fica num **botão circular central destacado**.

```css
.bottomnav { display: none; }
@media (max-width: 960px) {
  .sidebar a, .menu-secao { display: none; }
  .bottomnav {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    background: var(--surface); border-top: 1px solid var(--border);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
  }
  .bottomnav a, .bottomnav button {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
    font-size: 10.5px; font-weight: 600; color: var(--text-3);
    background: none; border: none; text-decoration: none;
  }
  .bottomnav .ativo { color: var(--primary); }
  .bottomnav .destaque .icone {           /* botão central "+" */
    background: var(--primary); color: #fff; width: 46px; height: 46px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    margin-top: -20px; font-size: 28px; border: 3px solid var(--bg);
    box-shadow: 0 4px 12px rgba(15,23,42,.25);
  }
  .conteudo { padding-bottom: 92px !important; }  /* nada escondido atrás da barra */

  /* Bottom sheet do "Mais" */
  .sheet-fundo { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 110; }
  .sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 120;
    background: var(--surface); border-radius: 16px 16px 0 0;
    padding: 10px 14px calc(18px + env(safe-area-inset-bottom));
  }
}
```
⚠️ No botão central use `+` **como texto** (herda o branco), nunca o emoji ➕ (tem cor própria).

---

## 10. Princípios do padrão (para o Claude replicar)

1. **Tudo com tokens** — trocar `--primary` re-tematiza o sistema inteiro (white-label).
   Tons derivados via `color-mix`, nunca hardcoded.
2. **Neutros idênticos** aos do Sistema de Louvor (seção 1) — os sistemas devem parecer
   módulos do mesmo produto.
3. **Badge é sempre suave** (fundo `cor+'22'`, texto na cor). Fundo sólido + texto branco
   só em contadores de alerta.
4. **Remover = 🗑️ em botão vermelho; editar = ✏️.** Ações em linhas/cartões são botões de
   ícone 32×32, nunca links de texto.
5. **Grid = filter-bar acima + card com tabela** (busca com ícone, selects, "+ Novo").
   Filtrar → ordenar (`localeCompare pt-BR`) → mapear; estado vazio explícito.
6. **Célula composta** (`.cell-title` + `.cell-sub`) para nome + detalhe na mesma coluna.
7. **Pessoas em cartões** com avatar de iniciais colorido por categoria/status.
8. **Uma ação principal por etapa/tela** (botão grande primário); o secundário fica em
   `<details>` recolhido ou bottom sheet. Ações irreversíveis pedem `confirm()`.
9. **Mobile: bottom nav, não sanduíche.** Ação mais usada no botão central destacado.
10. **Todo envio de mensagem** abre o WhatsApp com o texto pronto via
    `https://wa.me/55DDDNUMERO?text=...` (verde `#22c55e`).
11. **Hover escurece** (`brightness(0.92)`), foco é anel suave de 3px, transições 0.16s.
12. **Datas e ordenação sempre pt-BR** (`toLocaleDateString('pt-BR')`,
    `localeCompare('pt-BR', {sensitivity:'base'})`).
