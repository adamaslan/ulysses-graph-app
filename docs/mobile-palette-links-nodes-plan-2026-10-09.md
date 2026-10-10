# Ulysses Graph: mobile, calmer colors, more clickable, more links, richer nodes

*Written 2026-10-09.*

**Status (2026-10-09).** Phases 1–2 shipped in #6. Phases 3–5 are built on `feat/links-clickable-passages`, as one PR rather than three. Not done:

- **Phase 6 (notes backfill)** is editorial work in `ulysses-yas/build_atlas.py` (a different repo): deciding what each of the 316 unused lines is. Left for a person.
- `of` on analyses (§4.1 `analyzes`, `analyzed_by`) needs an `of` field in the `build_atlas.py` opts, so it waits on phase 6.
- Not built: `flagged_from`, motif→motif edges, hand-picked episode key lines, analysis sentences on character and theme nodes, double-tap to zoom a neighborhood, hover tooltips, and "passages only as neighbors" on phones.
- `ATLAS_URL` in `NodePanel.jsx` is empty until the Quote Atlas has a stable URL; block references become links once it is set.
- Relationship pairs with no passage naming both are dropped by the build (7 of 21 today), so the list can be re-run as the notes grow.

This plan covers five changes to the app:

1. Make it work on a phone.
2. Replace the neon look with a calmer palette.
3. Make every name, chip, reference and edge clickable.
4. Add more links between nodes.
5. Give nodes more text, taken only from the quotes and analyses in the original notes.

Every number below was measured from the current code and data on branch `feat/corpus-graph` (its PR #5 has merged).

---

## 0. Where things stand

| Area | Current state | Where |
|---|---|---|
| Graph size | 228 nodes and 1,616 edges after de-duplication. 842 of the edges are `co_occurs`; only 346 of those survive the default slider (≥ 3) | [graphData.js](../src/data/graphData.js), `expansion.json` |
| Text corpus | 118 blocks: 96 Joyce quotes, 15 analyses, 7 commentary notes. Every block is attached to at least one node | `corpus.json` |
| Thin nodes | 69 nodes have degree ≤ 2. 18 are flagged `thin` because no quote mentions them. All 18 techniques and all 12 schema nodes are one sentence with no text | `expansion.json` |
| Unused notes | 316 of the 2,880 non-blank lines in `notes-from-notes-app.md` are in no block and no hard-to-place item | `~/code/homebase/ulysses-yas/build_atlas.py` `BLOCKS` |
| Missing episodes | Hades, Aeolus, Scylla and Charybdis, and Wandering Rocks have no motif. Episodes 7 and 9 have no captured quote at all | [README.md](../README.md) "Known limit" |
| Panel | Fixed to the top right, `w-[min(30rem,…)]`, `max-h-[88%]`. On a phone it covers the whole graph | [NodePanel.jsx:734](../src/components/NodePanel.jsx#L734) |
| Type sizes | Quotes 11px, chips 9–10px, node labels 8–9px | NodePanel.jsx, [UlyssesGraph.jsx:494](../src/components/UlyssesGraph.jsx#L494) |
| Colors | 10 saturated neon hues, plus scanlines, a grid, a glow filter, a glitch title, and animated dashed edges | [index.css](../src/index.css), [graphData.js:768](../src/data/graphData.js#L768) |

What already works and should stay:

- The three-tier selection: focus, neighbor, background.
- `applySelection` and `clearSelection` as the only two code paths that change the graph's look.
- The lazily loaded corpus.
- The provenance shown on every block (`e15q07 · L847–863 · p.…`).
- The reduced-motion handling.

---

## 1. Mobile

### 1.1 Layout

| Change | Detail |
|---|---|
| Full-height canvas | Under 640px, drop the `72vh` bordered box ([App.jsx:140](../src/App.jsx#L140)) and the legend grid. The graph fills `100dvh` minus a 48px top bar. |
| Bottom sheet instead of the side panel | Under 640px, `NodePanel` becomes a sheet anchored to the bottom with three snap points: **peek** (about 30%: type, title, summary, connection count), **half** (60%), and **full** (92%). Drag the handle to resize it. Swipe down from peek to close it. At peek, the selected node and its neighbors stay visible above the sheet. |
| Controls in a sheet | Layer chips, type chips and the slider currently wrap into 3–4 rows. Replace them with one **Filters** button that opens a sheet. The layer row stays visible as a segmented control (Core · Motifs · Structure · All). |
| Search bar | Move search from the floating `w-52` box ([UlyssesGraph.jsx:570](../src/components/UlyssesGraph.jsx#L570)) into the top bar at full width. Results show as a list (see §3.3). |
| Safe areas | Add `env(safe-area-inset-*)` padding to the top bar and the sheet. |
| Resize and rotation | The canvas size is read once per effect ([UlyssesGraph.jsx:373](../src/components/UlyssesGraph.jsx#L373)). Add a `ResizeObserver` that updates the center forces and the svg size, so rotating the phone doesn't leave the graph off-center. |

### 1.2 Touch

| Problem | Fix |
|---|---|
| `d3.drag` on every node ([UlyssesGraph.jsx:465](../src/components/UlyssesGraph.jsx#L465)) catches one-finger touches, so a pan that starts on a node drags the node instead | On touch, drag a node only after a long press (about 350ms). A short touch selects. `pointerType === 'mouse'` keeps the current behavior. |
| Nodes are 4–17px across and hard to hit with a finger | Add an invisible hit circle to each node, `r = max(radius, 22)`, with `fill: transparent; pointer-events: all`. |
| Selecting a node doesn't move the view | On select, animate the zoom to the bounding box of the focus node and its neighbors, leaving room for the sheet at peek. |
| Labels are hidden at the starting zoom (minimum degree 16 at k=1) | On phones, start at a zoom fitted to the layer. Always label the focus node and its neighbors (this already happens). Raise the label font to 11px on screens. |
| Double-tap | Double-tap empty canvas to zoom in. Double-tap a node to zoom to its neighborhood. |

### 1.3 Performance on phones

- Remove the `#neon` SVG filter. It is a two-pass Gaussian blur on up to about 100 nodes and edges per selection, and it is the most expensive thing on mobile Safari. See §2.
- Remove the scanlines overlay (`mix-blend-mode: overlay` across the whole canvas).
- On first load on a phone, open the Core layer with the slider at ≥ 4. Show the "All" layer only after the user asks for it.
- Stop the simulation once alpha drops below 0.02. Don't restart it on selection.

### 1.4 A list view for phones

Add a **List** toggle that shows the same data as a scrollable outline: Part → Episode → quotes, with each node as a tappable row. The graph is a poor reading surface on a 390px screen. The list gives a phone user the whole corpus without pinch-zooming. It reuses `NodePanel`'s parts (`PassageList`, `Neighbors`).

---

## 2. Calmer colors

### 2.1 What to remove

| Remove | Why |
|---|---|
| Ten saturated neon hues | With ten hues at full saturation, none of them signals anything |
| `#neon` glow filter, halo pulse, `.edge-flow` dash animation | Constant motion and glow make the page look like a screensaver. The three tiers of opacity and stroke already show the selection. |
| Scanlines, the 40px cyan grid, the two-color vignette | Decoration only, and they cost performance |
| `.glitch-title` chromatic aberration | Hurts legibility on the one line you most need to read |
| Uppercase, wide-tracked monospace at 9–10px everywhere | Hard to read and adds to the neon look |
| Leftover Vite starter CSS in [App.css](../src/App.css) (`.hero`, `#next-steps`, `#social`, the purple `--accent`) | Dead code that conflicts with the real tokens |

### 2.2 What to use instead

Reuse the Quote Atlas palette (`~/code/homebase/ulysses-yas/atlas_template.html`) so the two companion pages look like one project: paper and ink, with three muted accents.

Group the ten node types into **five color families**. Use **shape** to tell types apart within a family. Hue answers what kind of thing a node is; shape answers which kind exactly.

| Family | Types | Light | Dark | Shape |
|---|---|---|---|---|
| Text | episode, part | `#8a6c22` gold | `#d8b565` | episode: filled circle with its number inside; part: ring only |
| People | character | `#2f5d62` sea | `#8cc3c4` | circle |
| Ideas | theme, motif | `#8a2e2a` oxblood | `#d98a7e` | theme: circle; motif: diamond |
| Places | place | `#5b6e3a` moss | `#a9bf86` | rounded square |
| Apparatus | analysis, technique, schema, correspondence | `#5d636b` slate | `#9aa3ab` | small square; analysis is drawn hollow |

| Surface token | Light | Dark |
|---|---|---|
| `--paper` (page and canvas) | `#f1eee6` | `#151a1d` |
| `--card` (sheet and panel) | `#faf8f2` | `#1b2125` |
| `--ink` | `#1d2328` | `#ebe6d9` |
| `--ink-soft` | `#4d555c` | `#a7afb3` |
| `--rule` and idle edges | `#cfc7b4` | `#3a4248` |

Rules:

- Follow the system theme. Add a theme toggle that cycles system → light → dark, stored with `localStorage` inside a try/catch, as the atlas does. Define tokens on `:root`, override them under `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`.
- Selection keeps its three tiers with no glow:
  - **Focus:** fill at 100%, a 3px `--ink` ring, and a static 2px halo in the family color.
  - **Neighbor:** fill at 55%, a 2px stroke.
  - **Background:** group opacity `0.15`.
- Connected edges take the focus node's family color, solid, 1.75px. Edges between two neighbors get 1px at 50%.
- Fonts: Source Serif 4 for quotes and summaries, Cormorant Garamond for titles, IBM Plex Mono only for IDs, page numbers and counts. Quote text at 16px on phones and 15px on desktop.
- Rewrite [STYLE-GUIDE.md](../STYLE-GUIDE.md) §1 and §4 to match. Archive the cyberpunk version to `docs/archive/` with an `ARCHIVED:` header rather than deleting it.

---

## 3. Make more of the app clickable

The node chips in `Neighbors` are clickable now. Nothing else in the panel is. The aim is that anything naming another node or passage can be tapped.

### 3.1 Linked names inside quote and analysis text

When the build tags a block, it already knows which node patterns match it (`tags` in `build_graph_data.py`). That information is thrown away before `corpus.json` is written. Instead, keep it and write out the character offsets of each match:

```jsonc
{ "id": "e15q07", "paras": ["…"], "tags": ["bloom", "bella", "m-hat"],
  "links": [[0, [[12, 17, "bella"], [140, 145, "bloom"]]]] }   // [paraIndex, [[start, end, nodeId], …]]
```

`Passage` then renders each match as an inline button with a dotted underline in the target node's family color. Tapping it selects that node.

- Link only the first match of each node in each paragraph, so the text doesn't turn into a wall of underlines.
- Skip `bloom` in quotes (he is in nearly every block), the same exception `COOCCUR_EXCLUDE` makes.

### 3.2 Everything else that should be tappable

| Element | Tap action |
|---|---|
| The `EPISODE // 11` type line | Selects the episode. On a passage, selects its episode. |
| The block reference `e11q03 · L1546–1572 · p.501` | Opens the Quote Atlas at `#e11q03` (the atlas uses the same IDs). Add `ATLAS_URL` as one constant. Check whether the published artifact URL keeps the hash; if it doesn't, link to a local or Pages copy of the atlas. |
| Flag chips (`placement corrected`) | Show the flag note inline. Today it only appears in a `title` tooltip, which a phone can't show. |
| An edge | Opens a small "why connected" card. It shows the edge kind (`EDGE_KINDS`), the weight, and for `co_occurs` edges the shared passages, each one tappable. The data for this is in the build's `pair_counts`; write the block IDs onto the edge. Give each edge a transparent 12px-wide hit line. |
| Legend cards | Act as type filters, the same as the type chips. |
| The stats line (`228 nodes · 1,616 edges`) | Opens the List view. |
| Episode panel | Previous and next buttons (‹ 10 Wandering Rocks · 12 Cyclops ›). |
| A neighbor group heading (`Characters (14)`) | "Show only these": dims every other neighbor on the graph. |

### 3.3 Search, history and deep links

- Search results become a list in two sections: **Nodes**, matched by label, and **Passages**, matched by full text across the corpus. Tapping a result selects it and zooms to it. Today search only dims nodes that don't match.
- Store the selection in the URL hash (`#n=ep11`, `#n=ep11&b=e11q03`), so links can be shared and the browser Back button undoes the last selection. Read the hash on load.
- Show a breadcrumb of the last 5 nodes visited, at the top of the panel or sheet.
- Desktop only: hovering a node for 300ms shows a tooltip with its label, type and first summary line. Touch screens don't get hover.
- Keyboard: when a node has focus, ←/→ cycle through its neighbors and Esc clears the selection. Nodes already have `tabindex` and `role="button"`.

---

## 4. More links between nodes

Today's links fall into two groups: hand-authored structure (episode↔character/theme/place, plus parts, techniques, schema and correspondences) and derived co-occurrence. What's missing is links that say *how* two things relate, and links at the level of single passages.

### 4.1 New edge kinds

| Kind | Between | Source of truth | Rough count |
|---|---|---|---|
| `next` | episode → episode | The order of the 18 episodes | 17 |
| `echoes` | episode ↔ episode | Derived: the two episodes' quotes share ≥ 3 tagged nodes (characters, places, motifs). Weight = number shared; the card lists them | build prints it |
| `relationship` | character ↔ character | Hand-authored, about 20 pairs, each with a label and an evidence block ID: Bloom–Molly *married*, Molly–Boylan *affair*, Bloom–Stephen *surrogate father/son*, Bloom–Rudy *father/dead son*, Bloom–Milly, Stephen–Mulligan, Bella–Bello *same figure*, Gerty–Cissy/Edy *friends*. Only add a pair if a block in the notes shows it, and store that block's ID on the edge | ~20 |
| `speaks_in` | character → episode | Derived from speaker lines (`SPEAKER` regex in `build_atlas.py`). The notes have 40 BLOOM lines, 7 each for ZOE and BELLO, 6 for BOYLAN, and more. This is a stronger signal than a name being mentioned | build prints it |
| `analyzes` | analysis → its episode and its passage | Twelve of the 15 analyses come right after the quote they discuss in `BLOCKS` (e.g. "The overture, line by line" follows "The overture · bronze by gold"). Record this as an explicit `"of": "e11q01"` in the analysis's `opts`. Don't infer it from the order of `BLOCKS`, which would break when blocks are reordered | 12 |
| `flagged_from` | passage → the episode it was wrongly filed under | The 7 rows of `THEMES_TABLE_ROWS`. This puts the placement decisions on the graph | 7 |
| `sub_motif` / motif → motif | motif ↔ motif | Hand-authored where two motif patterns overlap (for example music & sound with the Sirens street cries) | small |

### 4.2 A Passages layer

Add a fifth layer, **Passages**, that turns each of the 96 quotes into a node (a small text glyph) linked to:

- its episode (`in`),
- every node it is tagged with (`mentions`),
- the analysis that discusses it (`analyzed_by`),
- the commentary next to it.

This is the most important new link source. It makes the graph go from character to the actual line where that character speaks, then out to the analysis of that line. It also gives the Ideas and People families real paths between them, instead of the statistical shortcut that `co_occurs` provides.

Keep the layer off by default. With it on, the graph has about 340 nodes. That works on desktop. On a phone, show passages only as neighbors of the selected node.

### 4.3 Cleaning up `co_occurs`

- 842 edges, more than half of all edges, come from one rule. Hide them in the Core layer unless a node is selected; when one is, show its co-occurrence edges at ≥ 2.
- Store the shared block IDs on each edge (§3.2), so a co-occurrence link can always explain itself.

---

## 5. Richer nodes from the original notes

**The rule:** every new sentence of node text is either copied verbatim from `notes-from-notes-app.md` with its block ID and line range, or is an existing hand-authored summary. Nothing generated is presented as Joyce's text or as the notes. AI analyses keep the label "AI chat answer pasted into the notes", as they have now.

### 5.1 What each node type gains

| Type | Has now | Add | Built from |
|---|---|---|---|
| **Episode** (18) | A summary, its quotes, its commentary | (a) A **key line**: one short excerpt pinned at the top, chosen by hand per episode in `graph_nodes.py` as `KEY_LINE = {"ep11": ("e11q01", 0)}`. (b) Each analysis shown under the quote it discusses (`of`, §4.1), not in a separate list. (c) A fact strip: technique · schema art · Homeric correspondence, each tappable | `BLOCKS`, `TECHNIQUES`, `SCHEMA`, `CORRESPONDENCES` |
| **Character** (44) | A one-line summary, plus quotes where the name appears | (a) **In their words**: their speaker lines, pulled as single lines with a link to the passage. (b) **First seen**: the earliest passage in book order. (c) **What the analyses say**: up to 3 sentences from analyses that name them, each with its block ID. (d) A row of the episodes they appear in, in book order | Speaker lines, `tags`, sentence-split analysis text |
| **Theme** (44) | A summary and its quotes | (a) The quotes ranked by how many times the theme pattern matches, top 3 shown first. (b) Analysis excerpts that use the theme's words. (c) The sub-themes as chips at the top | Theme `rx` match counts |
| **Motif** (36) | An auto-generated summary ("Recurs in Joyce's text in 2 episodes…") with one clipped first hit | Replace the summary with a **keyword-in-context strip**: every hit as about 80 characters on each side, the matched word in bold, grouped by episode. This is where the motif idea is clearest | Motif `pattern` |
| **Analysis** (15) | The first 300 characters, which often start with "Short answer:" | (a) A summary made from the analysis's own headings (the `<h5>`s that `render_analysis` already detects). (b) The passage it analyzes, shown first. (c) The flag note, inline | The analysis body, `of` |
| **Technique / Schema / Correspondence** (48) | One sentence, no text | The episode's key line, plus up to 2 analysis sentences that mention the style or art (Sirens: "fugue", "onomatopoeia", "overture"). For correspondences, link to the character and their speaker lines. If nothing in the notes fits, label the node "no notes yet" rather than writing filler | Analysis sentences matched by a per-node `rx` |
| **Place** (20) | A summary and its quotes | First seen, the quotes, and the characters seen there (derived from co-tags) | `tags` |

### 5.2 Fill the gaps from notes that aren't used yet

1. **316 lines in no block.** The longest runs, in `notes-from-notes-app.md`:

   | Lines | Starts with |
   |---|---|
   | L36–95 (60 lines) | "2. Nestor" |
   | L3234–3259 | The Honourable Mrs Mervyn Talboys |
   | L744–764 | A Circe page |
   | L3383–3402 | Starts with `* * * *` |
   | L3130–3147 | "First Watch: Infernal machine…" |
   | L2425–2439 | The Bawd, "her wolfeyes shining" |
   | L3080–3090 | Bloom, "To be a shoefitter" |

   Go through each run. It either becomes a new block, is a duplicate paste (note which block it duplicates), or belongs to the listening log. Respect the frozen-ID rule in `ulysses-placement-and-themes-plan.md` Step 0: new blocks get the next free number and never renumber existing blocks.
2. **Episodes 6, 7, 9 and 10.** Look for quotes in `~/code/homebase/docs/ulysses app/` (`ulysses-notes.md`, `ulysses-notes-by-chapter.md`, and the per-chapter wiki files). Bring in only passages that are the user's own pasted Joyce text, not summaries. Give each one a source field so the panel can say which file it came from.
3. **The 18 thin nodes.** After steps 1–2, re-run the build. Any node still thin either gets a `MANUAL_EPS` entry with a reason, or is dropped from Core and kept only in All.

### 5.3 Data shape changes

- **`corpus.json` blocks:** add `tags`, `links` (§3.1), `speakers: [{name, nodeId, para, line}]`, and `of` (for analyses).
- **`expansion.json` nodes:** add `keyLine: {block, para}`, `excerpts: [{block, text, match: [start, end]}]` (KWIC for motifs; analysis sentences for characters and themes), and `firstSeen: blockId`.
- **`expansion.json` edges:** add `blocks: [blockId]` on derived edges, and `label` and `evidence` on `relationship` edges.
- Keep everything in `corpus.json`, loaded lazily. Write only IDs into `expansion.json`, so the first page load stays small.

---

## 6. Order of work

Each phase is one branch and one PR, cut from `origin/main`, never from `feat/corpus-graph`. That branch's PR has merged. Phases 1 and 2 touch the same files (`index.css`, `NodePanel.jsx`, `UlyssesGraph.jsx`), so merge them in order rather than in parallel.

| # | Branch | Scope | Main files |
|---|---|---|---|
| 1 | `feat/palette-calm` | §2: tokens, light and dark themes, shapes, remove the neon effects, rewrite and archive the style guide | `index.css`, `App.css`, `graphData.js`, `UlyssesGraph.jsx`, `STYLE-GUIDE.md` |
| 2 | `feat/mobile-sheet` | §1: bottom sheet, filters sheet, touch handling, ResizeObserver, fit to selection | `App.jsx`, `NodePanel.jsx`, `UlyssesGraph.jsx` |
| 3 | `feat/data-links` | §3.1 and §4–5 data: `tags`, `links`, `speakers`, `of`, new edge kinds, excerpts | `scripts/build_graph_data.py`, `scripts/graph_nodes.py`, `ulysses-yas/build_atlas.py` (`of` in opts) |
| 4 | `feat/clickable-everywhere` | §3.2–3.3 in the UI: inline links, edge cards, search list, hash and history | `NodePanel.jsx`, `UlyssesGraph.jsx` |
| 5 | `feat/passages-layer` | §4.2, plus the List view (§1.4) | `graphData.js`, `App.jsx` |
| 6 | `feat/notes-backfill` | §5.2: new blocks from unused lines, episodes 6, 7, 9 and 10 | `ulysses-yas/build_atlas.py`, then a graph rebuild |

### Checks for every phase

**1. Rebuild the data** (phases 3, 5 and 6):

```bash
cd ~/code/ulysses-graph-app && /opt/homebrew/Caskroom/miniforge/base/bin/python scripts/build_graph_data.py
```

Expect `blocks: 118 …` today. The number goes up after phase 6. Expect `new edges:` to go up after phase 3.

**2. Lint and build:**

```bash
cd ~/code/ulysses-graph-app && npm run lint && npm run build
```

Expect no lint errors and a `dist/` build.

**3. Try it on a real phone** over the same Wi-Fi:

```bash
cd ~/code/ulysses-graph-app && npm run dev -- --host
```

Open the `Network:` URL it prints on the phone. Check that:

- one finger pans the graph,
- tapping a node opens the sheet at peek,
- the selected node stays visible above the sheet,
- a long press drags a node,
- rotating the phone keeps the graph centered.

**4. Check that block IDs haven't moved** (phase 6). Expect no output:

```bash
cd ~/code/homebase/ulysses-yas && grep -o '"id": "[^"]*"' build_atlas.py | sort | uniq -d
```

---

## 7. Out of scope

- Writing new literary analysis. Nodes get richer only from text already in the notes.
- Server, accounts, and shared annotations.
- Changing the force-layout algorithm. Only phone-specific tuning (§1.3) is in scope.
