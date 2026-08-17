# Ulysses Graph — Cyberpunk Style Guide

The visual and interaction contract for this app. Two things carry the whole
design: **what happens when a node is clicked**, and **how the dialogue box
presents what was clicked**. Everything else is chrome around those two moments.

---

## 1. Foundations

### 1.1 Color tokens

Defined once in [src/index.css](src/index.css) on `:root`. Never hardcode a hex
in a component when a token exists.

| Token | Value | Role |
|---|---|---|
| `--cy-void` | `#05060a` | Page and canvas ground. The darkest surface. |
| `--cy-deep` | `#0a0d14` | Recessed panels. |
| `--cy-surface` | `#10141f` | Raised panels (dialogue box top gradient stop). |
| `--cy-cyan` | `#00f0ff` | Primary UI accent — chrome, inputs, rules, grid. |
| `--cy-magenta` | `#ff2bd6` | Secondary accent — chromatic aberration, theme nodes. |
| `--cy-yellow` | `#ffd400` | Episode nodes. |
| `--cy-green` | `#39ff88` | Place nodes. |
| `--cy-line` | `rgba(0,240,255,0.18)` | Default 1px border for all chrome. |

### 1.2 Node type colors

Mirrored in [src/data/graphData.js](src/data/graphData.js) as `TYPE_COLORS`.
Node type is the **only** thing that determines a node's hue — never state,
never emphasis.

| Type | Hex | Reads as |
|---|---|---|
| `episode` | `#ffd400` | acid yellow |
| `character` | `#00f0ff` | cyan |
| `theme` | `#ff2bd6` | magenta |
| `place` | `#39ff88` | toxic green |

### 1.3 Alpha suffix convention

Colors are composed by appending a hex alpha pair to the token. Use these rungs
and no others — arbitrary alphas make the graph read as noise:

| Suffix | Use |
|---|---|
| `08` | Dimmed edge, effectively invisible |
| `12` – `18` | Resting node fill, chip background |
| `20` | Idle edge |
| `33` – `44` | Neighbor node fill, panel divider |
| `55` | Chip border, panel border |
| `aa` | Focused node fill |

### 1.4 Type

- **Everything structural is monospace** (`ui-monospace, Consolas, monospace`):
  labels, chips, headers, metadata, counts, buttons.
- **Only prose is sans**: the summary paragraph in the dialogue box and legend
  card descriptions. This is the one place the eye is meant to slow down.
- Uppercase + wide tracking (`0.15em`–`0.3em`) for every label and chip.
  Sentence case, normal tracking for prose.
- Sizes: `10px` for labels/chips/metadata, `11px`–`12px` for prose, `16px`
  for the dialogue box title.

### 1.5 Geometry

- **Radius is 2px or zero.** Nothing is pill-shaped except node circles and
  legend dots. Rounded corners undercut the whole aesthetic.
- **Cut corners instead**, via `clip-path` — a 14px notch on the dialogue box
  (top-right and bottom-left), 10px on legend cards (top-right only).
- **Left accent rule**: a 2px solid border-left in the accent color marks any
  container carrying identity (dialogue box, legend card).

### 1.6 Glow

Glow means *live*, never decoration. Two mechanisms:

- **SVG** — the `#neon` filter (triple-stacked `feGaussianBlur` at 3.5 and 8,
  merged over the source). Applied only to selected and neighbor nodes and
  their connecting edges.
- **CSS** — `box-shadow: 0 0 Npx <color>55`. Chips glow on hover; the active
  chip and the dialogue box glow persistently.

Nothing at rest glows. If everything glows, the selection can't.

---

## 2. Node Clicks — the core interaction

Clicking a node **traces its connections**. The graph divides into three tiers,
and the contrast between them is the entire point of the interaction.

### 2.1 The three tiers

| Tier | Group opacity | Fill | Stroke | Glow | Label |
|---|---|---|---|---|---|
| **Focus** (clicked) | `1` | `type + aa` | `#ffffff` @ 3px | `#neon` | white, bold |
| **Neighbor** (one edge away) | `1` | `type + 44` | `type` @ 2.5px | `#neon` | type color, bold |
| **Background** (everything else) | `0.12` | `type + 18` | `type` @ 1.5px | none | type color, normal |

The focused node is the only node ever stroked in **white** — that is its
unique signature. Neighbors keep their own type color, so you can still read
*what kind* of thing each connection is at a glance.

### 2.2 Edges

| State | Stroke | Width | Dash | Glow |
|---|---|---|---|---|
| Idle (nothing selected) | `#00f0ff20` | 1 | none | none |
| **Connected to focus** | **focused node's type color** | 2 | `6 6`, animated | `#neon` |
| Dimmed (selection active, unrelated) | `#00f0ff08` | 1 | none | none |

Connected edges animate: `stroke-dashoffset` runs to `-12` over 0.7s on an
infinite linear loop (`.edge-flow`), reading as data flowing outward from the
clicked node. Connected edges take the **focus node's** color, not their own
endpoints' — so the selection reads as one radiating system rather than a
patchwork.

### 2.3 The halo

Each node carries a hidden `.node-halo` ring at `radius + 8`, `opacity: 0`. On
focus it becomes visible in the accent color and pulses — scale `1 → 1.25`,
stroke-opacity `0.7 → 0.15`, 1.8s ease-in-out, infinite. Only ever **one**
halo on screen. It is the "you are here" marker.

### 2.4 Click rules

1. **Click a node** → that node becomes focus; its neighbors light; everything
   else dims to `0.12`.
2. **Click the same node again** → full reset. Click is a toggle.
3. **Click empty canvas** → full reset.
4. **Click inside the dialogue box** → nothing. The panel calls
   `stopPropagation`, so interacting with the panel never dismisses it.
5. **Drag a node** → position changes, selection state does not.

Reset means every visual returns to Section 2.1's Background row *and* group
opacity returns to `1` — handled centrally by `clearSelection()`. Never unwind
a selection attribute-by-attribute at a call site.

### 2.5 Implementation notes

- Adjacency is precomputed once per filter change into a
  `Map<string, Set<string>>` (`buildAdjacency`), so a click is an O(1) lookup,
  not an edge scan. With 153 edges this matters less for speed than for
  keeping the click handler readable.
- `applySelection` and `clearSelection` are the only two functions permitted to
  mutate graph visuals. Adding a third path is how selection state drifts out
  of sync.
- Edge endpoints may be either an id string (pre-simulation) or a node object
  (post-simulation). Always resolve through the `edgeId(d, end)` helper.

### 2.6 Search vs. selection

Search dims **non-matching** nodes via the `opacity` attribute on the child
`circle`/`text` elements. Selection dims via `opacity` on the parent `g`.
They are deliberately on different elements so the two can coexist — a search
filter and an active selection compose rather than clobber each other.

---

## 3. Dialogue Boxes

The dialogue box is the payoff for a click. It answers *what did I click* and
*what is it connected to*, in that order.

### 3.1 Anatomy

Top to bottom, and this order is fixed:

1. **Type line** — `CHARACTER` or `EPISODE // 04`. 10px mono, uppercase,
   `0.25em` tracking, in the accent color. Episode numbers are zero-padded.
2. **Title** — 16px bold white, with `.glitch-title` chromatic aberration.
3. **Summary** — 12px sans, `white/60`, relaxed leading. The only prose.
4. **Divider** — 1px in `accent + 33`.
5. **Connection count** — `12 CONNECTIONS`, 10px mono uppercase, accent color.
   Singular/plural is handled; a lone connection reads `1 CONNECTION`.
6. **Connection chips** — one per neighbor, each in **its own type color**, so
   the mix of episodes/characters/themes/places is legible at a glance. Wraps
   freely, scrolls past `max-h-40`.
7. **Close** — `[ X ] CLOSE`, 10px mono, `white/30` → `white/80` on hover.

### 3.2 Container styling

```
background:   linear-gradient(160deg, rgba(16,20,31,.95), rgba(5,6,10,.95))
border:       1px solid color-mix(accent 45%, transparent)
border-left:  2px solid accent
clip-path:    notch 14px top-right + bottom-left
backdrop:     blur(10px)
box-shadow:   0 0 24px accent@25%  +  inset 0 1px 0 white@6%
animation:    panel-in 160ms ease-out (slide 8px from right + fade)
```

### 3.3 The accent variable

The panel's entire color identity flows from one CSS custom property set
inline from the selected node's type:

```jsx
<div className="cyber-panel" style={{ '--accent': TYPE_COLORS[selected.type] }}>
```

`--accent` then drives the border, left rule, glow, divider, and title shadow
through `color-mix()`. **Click a character → the box is cyan. Click a theme →
it's magenta.** Adding a new node type requires no panel CSS changes.

### 3.4 Rules

- **One dialogue box at most.** It is bound to `selected`; there is no stack.
- **Never blocks the graph.** Fixed to the top-right, `w-80`, so the force
  layout stays visible and readable behind and beside it.
- **Never intercepts canvas clicks.** `stopPropagation` on the container.
- **Always dismissible three ways**: the close button, clicking the focused
  node again, or clicking empty canvas.
- **Long content scrolls internally** (`max-h-40 overflow-y-auto` on the chip
  well). The panel itself never grows unbounded.
- **Entrance animates, exit does not.** The box appears in 160ms and vanishes
  instantly — an exit animation would lag behind the graph's own reset and
  read as slop.

---

## 4. Ambient effects

- **Grid** — 40px SVG pattern, cyan at `0.06` opacity, drawn beneath the graph.
  `pointer-events: none`.
- **Scanlines** — 4px repeating gradient, `mix-blend-mode: overlay`, `0.5`
  opacity, `z-index: 15` above the SVG. Decorative only, never clickable.
- **Canvas vignette** — cyan radial glow from top-center, magenta from
  bottom-right, both fading into `--cy-void`.

## 5. Accessibility

- `prefers-reduced-motion: reduce` disables edge flow, halo pulse, and panel
  entrance. The **static** selection states — color, width, opacity tiers —
  all remain, so the interaction still fully works without motion.
- Selection is never signaled by glow alone. Every tier differs in opacity,
  stroke width, and fill as well, so the three tiers survive both reduced
  motion and reduced color perception.
- Background tier bottoms out at `0.12` rather than `0` — dimmed context stays
  faintly visible, preserving the shape of the whole graph while you read a
  selection.
