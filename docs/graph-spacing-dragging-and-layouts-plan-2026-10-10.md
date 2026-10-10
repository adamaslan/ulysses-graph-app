# Ulysses Graph: spacing control, moving nodes, and keeping arrangements

*Written 2026-10-10.*

**Status (2026-10-10).** All six steps are built on `feat/graph-spacing-pins-layouts`, as one PR rather than six. Checked in headless Chrome on desktop: drag and pin, pins kept across a filter change and a reload, the Timeline order (episodes 1–18). Not checked: long-press drag on a real phone, Export/Import, Shift-drag. Differences from the plan:

- Timeline now anchors each episode to its slot (`fx`/`fy`) instead of pulling it with a force. A force alone left episodes out of order.
- The Radial preset is looser than drawn: link forces pull nodes off their rings.
- `src/data/layouts/` is empty. A shipped default only exists once someone exports a layout and commits it there as `<layer>.json`.
- The force and pin code lives in `src/graph/forces.js` and `src/graph/pins.js`.

This plan covers three changes to the graph view:

1. **Spacing.** Let the reader push nodes further apart or pull them closer, and set spacing separately for each kind of edge.
2. **Moving.** A dragged node stays where it is dropped, on a phone as well as with a mouse.
3. **Arrangements.** A layout survives a filter change, a reload, and a different device. The reader can also pick a structured arrangement (a timeline of episodes, clusters by type) instead of the free force layout.

Every line reference below is to [UlyssesGraph.jsx](../src/components/UlyssesGraph.jsx) on `main` at `b37194f`.

---

## 0. Where things stand

| Behaviour | Current code | Effect |
|---|---|---|
| Edge length | `forceLink(...).distance(dense ? 75 : 80)` (L309) | One fixed length for every edge kind. Hierarchy and co-occurrence edges are laid out the same length. |
| Repulsion | `forceManyBody().strength(dense ? -260 : -180).distanceMax(700)` (L311) | Fixed. The ~230-node core layer is crowded in the middle. |
| Overlap | `forceCollide().radius(r + 4)` (L315) | 4 px of padding, so labels on hubs overlap their neighbours. |
| Centre pull | `forceX` / `forceY` at strength `0.045` (L313–314, repeated at L480–481) | Keeps clusters on screen but squeezes the layout. |
| Drag release | `.on('end', … d.fx = null; d.fy = null)` (L352) | A dragged node springs back as soon as it is let go. Nothing stays where it was put. |
| Touch drag | `.filter(e => !e.button && !e.type.startsWith('touch'))` (L349) | Nodes can't be moved on a phone at all; touch only pans. |
| Rebuild | The main effect depends on `filteredNodes` / `filteredEdges` (L440) and clears the SVG (L272) | Changing the layer, the type chip, or the weight slider throws every position away and lays the graph out again from scratch. |
| Persistence | Only the theme is stored (`ulysses-theme` in [App.jsx](../src/App.jsx)) | Any arrangement is lost on reload. |

d3-force v3 seeds its simulation with a fixed random source, so the **same node list always produces the same layout**. The problem is not randomness. Every filter change produces a different node list, which gives a different layout.

---

## 1. Spacing control

### 1.1 One "Spread" slider that scales everything together

Spacing needs more than one force changed at once. Raising link distance alone just stretches edges while repulsion stays where it was. So a single `spread` multiplier (0.6–2.5, default 1) scales all four forces together:

```js
const SPREAD_MIN = 0.6;
const SPREAD_MAX = 2.5;

const BASE = {
  linkDistance: 75,
  charge: -260,
  collidePad: 4,
  centerPull: 0.045,
};

/** Retune the running simulation in place. No rebuild, so positions are kept. */
function applySpacing(sim, spread) {
  sim.force('link').distance(d => linkDistanceFor(d) * spread);
  sim.force('charge').strength(BASE.charge * spread);
  sim.force('collision').radius(d => radiusOf(d) + BASE.collidePad * spread);
  // Wider spread needs a weaker centre pull, or the pull undoes the spread.
  sim.force('x').strength(BASE.centerPull / spread);
  sim.force('y').strength(BASE.centerPull / spread);
  sim.alpha(0.4).restart();
}
```

The key point is that this **mutates the running simulation** instead of adding `spread` to the main effect's dependencies. Adding it there would rebuild the graph on every slider tick and lose every position. Keep `spread` in a ref, and call `applySpacing` from a small `useEffect([spread])`.

Put the slider next to the existing co-occurrence weight slider in `App.jsx`'s `useGraphControls`, and pass it down as a prop the same way `minWeight` is passed.

### 1.2 Different lengths for different edge kinds

```js
const LINK_DISTANCE_BY_KIND = {
  child_of: 40,   // a sub-theme sits tight against its root theme
  part_of: 45,    // an episode sits close to its part
  co_occurs: 110, // a statistical link should not pull nodes into a knot
};
const DEFAULT_LINK_DISTANCE = 75;

/** Longer edges for hubs, so a high-degree node's neighbours have room to fan out. */
const linkDistanceFor = d =>
  (LINK_DISTANCE_BY_KIND[d.kind] ?? DEFAULT_LINK_DISTANCE)
  + Math.sqrt(Math.max(DEGREE.get(edgeId(d, 'source')), DEGREE.get(edgeId(d, 'target')))) * 2;
```

The result is tight families (theme to sub-theme, part to episode) with looser links between them. This alone removes most of the central knot.

### 1.3 Label-aware collision

Collision currently uses the shape radius only, but the label sits above the node (`dy = -radius - 6`, L384). Widen the collision radius for nodes whose label is showing:

```js
const LABEL_CHAR_WIDTH = 5.5; // px per character at 10px mono
const collideRadius = d => radiusOf(d) + BASE.collidePad * spreadRef.current
  + (labelVisible(d) ? Math.min(30, d.label.length * LABEL_CHAR_WIDTH / 2) : 0);
```

Re-run `sim.force('collision').radius(collideRadius)` inside `updateLabels()` whenever the zoom threshold changes. Then nodes make room for their labels as more labels appear on zoom-in.

---

## 2. Moving nodes so they stay put

### 2.1 Pin on drop

Change the drag `end` handler so the node keeps its fixed position:

```js
.on('end', (e, d) => {
  if (!e.active) sim.alphaTarget(0);
  // Leave fx/fy set: the node stays where it was dropped.
  pinnedRef.current.set(d.id, { x: d.fx, y: d.fy });
  savePins();
  markPinned(d.id, true);
})
```

Ways to unpin, all three needed:

| Action | Effect |
|---|---|
| Double-click / double-tap a pinned node | Unpin that node (`d.fx = d.fy = null`) and reheat |
| **Unpin all** button in the toolbar | Clear every pin for the current layer |
| `U` key while a node is selected | Unpin the selection |

Mark a pinned node visibly. A small filled dot at the top-right of the shape is enough, using `var(--ink)`. Without a marker, a reader can't tell why one node no longer moves with the rest.

### 2.2 Drag on touch without breaking pan

Today touch is filtered out so that one finger pans the canvas (L349). Keep that, and add **long-press to drag**: a touch that stays within 8 px for 350 ms picks up the node.

```js
const LONG_PRESS_MS = 350;
const LONG_PRESS_SLOP_PX = 8;
```

Implementation: on `touchstart` on a node group, start a timer and remember the point. On `touchmove` beyond the slop, cancel it, so the touch becomes a pan. When the timer fires, set `armedRef.current = d.id` and give haptic feedback (`navigator.vibrate?.(10)`). Then change the drag filter to:

```js
.filter(e => !e.button && (!e.type.startsWith('touch') || armedRef.current !== null))
```

### 2.3 Drag a neighbourhood

A **Shift-drag** (desktop) moves the node and all its direct neighbours by the same offset, and pins all of them. This is the quickest way to tidy one cluster by hand. Neighbours come from `adjacencyRef` (already built, L297). At drag start, record each neighbour's offset from the dragged node, then apply `fx = e.x + dx` to each on every drag event.

### 2.4 Freeze

A **Freeze** toggle calls `sim.stop()` and turns off the reheat on drag start (`alphaTarget(0.3)` at L350). In frozen mode, dragging moves only the dragged node and nothing else shifts. This is the mode for fine arrangement work.

---

## 3. Keeping arrangements

### 3.1 Carry positions across rebuilds

This change matters most. Without it, every chip click scrambles the graph. Keep a `positionsRef: Map<id, {x, y}>`, update it on `sim.on('end')` and on drag end. When the main effect builds the new `nodes` array (L295), seed each node from it:

```js
const nodes = filteredNodes.map(d => {
  const known = positionsRef.current.get(d.id);
  const pin = pinnedRef.current.get(d.id);
  return { ...d, ...(known && { x: known.x, y: known.y }), ...(pin && { fx: pin.x, fy: pin.y }) };
});
```

Start the new simulation at a low `alpha` (0.3 instead of 1) when most nodes already have positions. Nodes that were already on screen then barely move, and only newly revealed nodes settle in.

### 3.2 Save to the browser

Store pins per layer, because the `core`, `all`, and `passages` layers are different graphs:

```js
const PIN_STORAGE_KEY = layer => `ulysses-pins:${layer}`;
const LAYOUT_VERSION = 1;

function savePins(layer, pins) {
  try {
    localStorage.setItem(PIN_STORAGE_KEY(layer),
      JSON.stringify({ v: LAYOUT_VERSION, pins: Object.fromEntries(pins) }));
  } catch { /* storage blocked: pins last for this visit only */ }
}
```

When loading, **ignore ids that are no longer in `NODES`**. The graph data is regenerated by `scripts/build_graph_data.py` and ids can disappear. Save positions in graph coordinates, not screen pixels. They then survive a window resize, because the zoom transform is separate.

Also save the spread value (`ulysses-spread`) the same way the theme is saved.

### 3.3 Export, import, and a shipped default

- **Export layout** downloads `ulysses-layout-<layer>.json` (pins + spread + zoom transform).
- **Import layout** reads one back.
- When the reader has no saved layout, the app loads a **default layout** from `src/data/layouts/<layer>.json`, committed to the repo. This is how a hand-tuned arrangement reaches every visitor and every device, because `localStorage` is per browser.

Load precedence: browser pins → shipped default → plain force layout.

### 3.4 Arranged presets

Add a **Layout** picker with these presets. Each one only swaps forces on the running simulation, so pins and spread still apply on top.

| Preset | Forces | Reads as |
|---|---|---|
| **Free** (default) | today's forces + §1 | the current organic map |
| **Timeline** | `forceX` pulls episodes to evenly spaced slots by `number` (1–18), strength 1. Every other node gets `forceX` toward the mean x of the episodes it links to. `forceY` is weak. | June 16 left to right, with characters and themes sitting under the episodes they belong to |
| **By type** | `forceX` / `forceY` toward one anchor point per type on a 3×4 grid | one island per node type (characters, themes, places…) |
| **Radial** | `forceRadial` with radius by type: episodes on the inner ring, then characters, themes, motifs, passages outermost | a target diagram centred on the book's structure |

```js
const LAYOUT_PRESETS = ['free', 'timeline', 'type', 'radial'];
```

Store the chosen preset per layer next to the pins. Pins from one preset don't make sense in another, so pins are stored under `ulysses-pins:<layer>:<preset>`.

---

## 4. Order of work

Each step is shippable on its own. Do them as one branch per step, cut from `origin/main`.

| Step | What | Size | Files |
|---|---|---|---|
| 1 | §3.1 carry positions across rebuilds | small | `UlyssesGraph.jsx` |
| 2 | §1.1 + §1.2 spread slider and per-kind distances | small | `UlyssesGraph.jsx`, `App.jsx` |
| 3 | §2.1 pin on drop + unpin + marker, §3.2 save to the browser | medium | `UlyssesGraph.jsx`, `App.jsx`, `index.css` |
| 4 | §2.2 long-press drag on touch, §2.4 freeze | medium | `UlyssesGraph.jsx` |
| 5 | §3.4 layout presets | medium | `UlyssesGraph.jsx`, `App.jsx` |
| 6 | §3.3 export/import + shipped default, §2.3 neighbourhood drag, §1.3 label-aware collision | medium | `UlyssesGraph.jsx`, `src/data/layouts/` |

Step 1 comes first because everything after it depends on positions surviving a re-render. Without it, a pinned arrangement is wiped the first time a chip is clicked.

`UlyssesGraph.jsx` is already 611 lines. Before step 3, move the force setup and the drag/pin logic into `src/graph/forces.js` and `src/graph/pins.js`, so the component doesn't grow past ~800 lines.

---

## 5. How to check each step

**Run it locally.**

```bash
cd ~/code/ulysses-graph-app && npm run dev
```

Expect: Vite prints a `localhost` URL; open it.

**Lint and build (CI runs the same build on every PR).**

```bash
cd ~/code/ulysses-graph-app && npm run lint && npm run build
```

Expect: no lint errors, and `dist/` written without warnings about chunk size beyond today's.

**Manual checks in the browser.**

| Step | Check | Pass |
|---|---|---|
| 1 | Select a layer, wait for it to settle, then click a type chip and click **All** again | Nodes that were visible both times stay in place |
| 2 | Drag Spread from min to max | The graph expands and contracts smoothly; it never rebuilds (no flash, selection kept) |
| 3 | Drag a node, release, reload | The node is where it was dropped, with a pin marker; double-click unpins it |
| 4 | On a phone (or DevTools device mode): one-finger swipe, then long-press a node and move | The swipe pans; the long-press moves the node |
| 5 | Pick **Timeline** | Episodes 1–18 run left to right in order |
| 6 | Export, clear storage, import | The same arrangement comes back |

**Check that saved pins exist (in the browser DevTools console).**

```js
Object.keys(localStorage).filter(k => k.startsWith('ulysses-pins'))
```

Expect one key per layer and preset you've arranged.

---

## 6. Risks

- **Pan versus drag on touch.** If the long-press timing is wrong, scrolling the canvas will pick up nodes by accident. Keep the 350 ms delay and 8 px slop as named constants and test them on a real phone, not only in DevTools.
- **Stale pins after a data rebuild.** If `build_graph_data.py` renames ids, saved pins point at nothing. Ignoring unknown ids (§3.2) makes this harmless. Bump `LAYOUT_VERSION` when the id scheme changes so old saves are discarded.
- **Pins fighting the centre pull.** Pinned nodes ignore forces, but the unpinned nodes around them are still pulled to the centre. A reader who pins everything to the far left will see the rest stay in the middle. That is expected behaviour. Mention it in the **Unpin all** tooltip.
- **Mobile auto-fit.** `fitNodes` runs on `sim.on('end.fit')` (L423) and on every selection (L459). With persisted positions the layout may already be settled, so the first fit can fire immediately. Test that it still frames the graph on first load.
