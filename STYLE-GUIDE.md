# Ulysses Graph — Style Guide

Paper and ink, shared with the Quote Atlas (`~/code/homebase/ulysses-yas`).
The old cyberpunk guide is archived in
[docs/archive/STYLE-GUIDE-cyberpunk.md](docs/archive/STYLE-GUIDE-cyberpunk.md).

## 1. Foundations

### 1.1 Tokens

Defined once in [src/index.css](src/index.css) on `:root`, overridden for dark
under `prefers-color-scheme` (guarded by `:root:not([data-theme="light"])`) and
under `:root[data-theme="dark"]`. Never hardcode a hex in a component.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#f1eee6` | `#151a1d` | page and canvas |
| `--card` | `#faf8f2` | `#1b2125` | panel, chips, cards |
| `--ink` / `--ink-soft` | `#1d2328` / `#4d555c` | `#ebe6d9` / `#a7afb3` | text |
| `--rule` | `#cfc7b4` | `#3a4248` | borders |
| `--fam-text` | `#8a6c22` | `#d8b565` | episode, part |
| `--fam-people` | `#2f5d62` | `#8cc3c4` | character |
| `--fam-ideas` | `#8a2e2a` | `#d98a7e` | theme, motif |
| `--fam-places` | `#5b6e3a` | `#a9bf86` | place |
| `--fam-apparatus` | `#5d636b` | `#9aa3ab` | analysis, technique, schema, correspondence |
| `--warn` | `#9a5b12` | `#e0b36a` | flags and thin-evidence notes |

The theme button cycles system → light → dark and remembers the choice in
`localStorage` (wrapped in try/catch).

### 1.2 Color says family, shape says type

Ten node types share five hues. Shape tells types apart inside a family
(`TYPE_SHAPES` in [graphData.js](src/data/graphData.js)):

| Family | Type | Shape |
|---|---|---|
| text | episode / part | circle / hollow circle |
| people | character | circle |
| ideas | theme / motif | circle / diamond |
| places | place | square |
| apparatus | analysis / technique / correspondence / schema | hollow square / square |

Compose translucent colors with `tint(color, percent)`, never by appending a hex
alpha, because colors are CSS variables.

### 1.3 Type

- Quotes and summaries: Source Serif 4, 15px.
- Titles: Cormorant Garamond.
- IDs, page numbers, counts, chips: IBM Plex Mono, 11–12px minimum.
- No uppercase tracking except the small `.eyebrow` label.

## 2. Selection

Three tiers, no glow and no animation:

| Tier | Group opacity | Fill | Stroke |
|---|---|---|---|
| Focus | 1 | family color, solid | 3px `--ink`, plus a static halo ring |
| Neighbor | 1 | family color at 55% | 2px family color |
| Background | 0.15 | resting fill | 1.5px family color |

Connected edges take the focus node's family color at 1.75px; unrelated edges
fade to `--edge-dim`. `applySelection` and `clearSelection` are still the only
two functions that change the graph's look.

## 3. Detail panel

Type line → title → summary → full analysis → Joyce's text → commentary →
connections → close. One panel at most, bound to `selected`, and clicks inside it
never reach the canvas. Block IDs and line ranges stay visible on every passage.

## 4. Accessibility

- Selection differs by opacity, stroke width, fill and shape, not hue alone.
- Nodes are focusable buttons (Enter / Space select them).
- `prefers-reduced-motion` is honored; nothing animates at rest anyway.
