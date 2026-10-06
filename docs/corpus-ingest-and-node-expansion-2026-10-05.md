# Loading the `ulysses-yas` corpus into the graph app, and growing it 58 → 131 nodes

*Written 2026-10-05. Plan only — nothing below has been executed.*

Two jobs, one pipeline:

1. **Ingest** every Joyce passage, every analysis, and every commentary note from
   `~/code/homebase/ulysses-yas` into the graph app, in full, with no paraphrase.
2. **Expand** the graph from **58 nodes to 131** (+125%), using the corpus as the
   evidence for the new nodes rather than inventing them.

The central decision that makes this cheap: **do not hand-author the corpus into
`graphData.js`.** `build_atlas.py` already holds the whole corpus as a
machine-readable table. Export it to JSON once, and the graph app consumes that.
Hand work is then limited to *tagging* — which nodes each passage belongs to —
not transcribing.

---

## 0. What exists, measured

| Side | Fact | How it was measured |
|---|---|---|
| Graph app | **58 nodes** — 18 episode, 18 character, 14 theme, 8 place | regex count over `src/data/graphData.js` |
| Graph app | **153 edges**, flat `{source, target}`, untyped | same |
| Graph app | Node fields consumed by UI: `id`, `type`, `label`, `number`, `summary` | `src/components/UlyssesGraph.jsx:253,346,349` |
| Graph app | `FILTERS` and `TYPE_COLORS` are hardcoded 4-type lists | `src/App.jsx:10`, `graphData.js` tail |
| Corpus | **115 blocks** in `build_atlas.py` `BLOCKS` — 96 Joyce quotes (`q`), 12 analyses (`a`), 7 commentary notes (`c`) | importing the module |
| Corpus | **6 hard-to-place items** in `HARD_ITEMS` — 3 cross-cutting essays, 3 raw buckets | same |
| Corpus | Block = `(episode, kind, label, [(start,end), …], opts)`; text lives as **line ranges into `notes-from-notes-app.md`** (4,072 lines) | `build_atlas.py:84–207` |
| Corpus | Extraction helpers already exist: `source_lines()`, `strip_markers()`, `paragraphs()`, `plain_text()` | `build_atlas.py:274–352` |
| Corpus | `build_atlas.py` is import-safe (`if __name__ == "__main__"` guard) | `build_atlas.py` tail |

**Target: 131 nodes** (58 × 2.25 = 130.5, rounded up).

---

## 1. Architecture: quotes are payload, not nodes

The tempting move is to make each of the 96 quotes a node. **Don't.**

- 96 quote nodes is +165%, not +125%, and they would be degree-1 leaves — they
  add visual mass and no structure. The force layout turns into a hairball.
- A quote's value in a graph is as *evidence attached to an edge or a node*, not
  as a thing with its own neighbourhood.

So:

| Corpus kind | Becomes | Why |
|---|---|---|
| 96 `q` Joyce quotes | **payload** — a `quotes: [...]` array on episode/character/theme/place nodes | leaf text; belongs in the detail panel, shown in full |
| 7 `c` commentary notes | **payload** — `notes: [...]` on the same nodes | one-to-three lines each |
| 12 `a` analyses | **nodes**, new type `analysis` | each argues across 3–5 episodes — genuinely graph-shaped |
| 3 cross-cutting essays (H1 Boylan, H2 insecurity, H3 enjoyment) | **nodes**, type `analysis` | the `HARD_ITEMS` plan already says they belong on a theme page, not an episode |
| 3 raw buckets (listening log, refs, notes-to-self) | **one `corpus` appendix page**, not nodes | timestamps and half-sentences; no referent to link to |

Every quote keeps its block ID (`e15q07`) and its source citation (`L847–863`)
so the graph panel can cite back into `notes-from-notes-app.md`.

---

## 2. Node expansion: where the 73 new nodes come from

| Type | Now | After | New | Source of the new nodes |
|---|---:|---:|---:|---|
| `episode` | 18 | 18 | 0 | complete already |
| `part` | 0 | 3 | **+3** | `build_atlas.py` `PARTS` — Telemachiad / Odyssey / Nostos |
| `character` | 18 | 40 | **+22** | named in the corpus but absent from the graph (list in §2.1) |
| `theme` | 14 | 26 | **+12** | the themes the corpus actually argues (list in §2.2) |
| `place` | 8 | 20 | **+12** | settings named in the quotes (list in §2.3) |
| `analysis` | 0 | 15 | **+15** | the 12 `a` blocks + 3 cross-cutting essays |
| `technique` | 0 | 9 | **+9** | the nine episodes whose formal device the corpus discusses |
| **Total** | **58** | **131** | **+73** | = +125.9% |

### 2.1 The 22 new characters

All appear by name in `BLOCKS` labels or in the quoted text:

Martin Cunningham · Mr Power · Zoe Higgins · Bella/Bello Cohen · Bridie Kelly ·
Cissy Caffrey · Edy Boardman · Ellen Bloom · Rudolph Virag (Bloom's father) ·
Mrs Talboys · Mrs Bellingham · The Nymph · Punch Costello · Dr Dixon ·
Ben Dollard · Mina Purefoy · D.B. Murphy · The Man in the Macintosh ·
Garryowen · Mananaun MacLir · Alexander J. Dowie · The Veiled Sibyl

### 2.2 The 12 new themes

Masochism & submission · Metempsychosis · Obscenity & censorship ·
Advertising & commerce · Usurpation & the key · Empire & colonialism ·
The history of English prose · Voyeurism & fireworks · Equanimity ·
Parallax · The unknowable (the macintosh) · Maternity & birth

Each one is anchored: *Obscenity & censorship* is the `banned` key already
flagged in `THEMES_TABLE_ROWS`; *Equanimity* is `e17q04`
("Envy, jealousy, abnegation, equanimity"); *Masochism* is the Bello/Nymph run
in Circe; *Parallax* and *Metempsychosis* are Bloom's own words in Calypso/Lotus
Eaters.

### 2.3 The 12 new places

Davy Byrne's · Freeman's Journal offices · Westland Row post office ·
Mabbot Street entrance · Bella Cohen's house · The cabman's shelter ·
Holles Street maternity hospital · Howth Head · Gibraltar · Mullingar ·
Paris · Bullock Harbour

### 2.4 The 9 technique nodes

Aeolus headlines · Sirens *fuga per canonem* · Cyclops gigantism ·
Nausicaa tumescence/detumescence · Oxen embryonic prose history ·
Circe hallucination-drama · Eumaeus exhausted narration · Ithaca catechism ·
Penelope unpunctuated monologue

Only these nine, because these are the ones the corpus has analysis blocks or
quotes about. A `technique` node for an episode nobody wrote about would be
filler.

**Edge growth:** 153 → roughly **420**, mostly free (episode→part, quote→episode,
analysis→episodes-it-cites are all derived mechanically in §5).

---

## 3. Prerequisite: freeze the block IDs — do this first, nothing works without it

`ulysses-placement-and-themes-plan.md` Step 0 already specifies this and it has
not been done. Block IDs (`e15q07`) are **positional** — generated from the order
of `BLOCKS`. Every graph edge is about to reference them. Inserting one Sirens
quote renumbers everything downstream and silently re-points every edge at the
wrong passage.

**Step 3.1 — preflight.**

```bash
cd ~/code/homebase/ulysses-yas && git status --short . && grep -c '^    (' build_atlas.py
```
Expect: clean or known-modified, and `115` (the block count).

**Step 3.2 — snapshot the current generated IDs, so they can be pinned verbatim.**

```bash
cd ~/code/homebase/ulysses-yas && /opt/homebrew/Caskroom/miniforge/base/bin/python - <<'PY'
import importlib.util
from collections import defaultdict
spec = importlib.util.spec_from_file_location("ba", "build_atlas.py")
ba = importlib.util.module_from_spec(spec); spec.loader.exec_module(ba)
counters = defaultdict(int)
for ep, kind, label, ranges, opts in ba.BLOCKS:
    counters[(ep, kind)] += 1
    print(f"e{ep:02d}{kind}{counters[(ep,kind)]:02d}\t{label}")
PY
```
Expect: 115 tab-separated lines, starting `e01q01	Haines · German jews; the cliff`.

**Step 3.3 — pin them.** Add an explicit `"id"` to every block's `opts` using the
output of 3.2, then make `build_episode_sections()` prefer `opts["id"]` and abort
on a duplicate. (This is an edit to `build_atlas.py`, not a command.)

**Step 3.4 — verify no duplicates (expect no output).**

```bash
cd ~/code/homebase/ulysses-yas && grep -o '"id": "[^"]*"' build_atlas.py | sort | uniq -d
```

**Step 3.5 — verify the atlas still builds byte-identically.**

```bash
cd ~/code/homebase/ulysses-yas && cp ulysses-quotes-and-notes-outline.html /tmp/atlas-before.html \
  && /opt/homebrew/Caskroom/miniforge/base/bin/python build_atlas.py \
  && diff -q /tmp/atlas-before.html ulysses-quotes-and-notes-outline.html && echo "IDENTICAL"
```
Expect: the `wrote …: 96 quotes, 12 analyses, 7 commentary notes, 6 hard-to-place items` line, then `IDENTICAL`.

> If `diff` reports a difference, the ID pinning changed rendering — stop and
> reconcile before going further. The atlas HTML is the human-readable check on
> the same data the graph is about to consume.

---

## 4. The exporter: one script, one JSON file, zero transcription

Write **`~/code/homebase/ulysses-yas/export_corpus.py`**. It imports
`build_atlas` (safe — main is guarded) and reuses its extraction helpers, so
quote text can never drift between the atlas and the graph.

What it emits — `corpus.json`:

```jsonc
{
  "generated": "2026-10-05",
  "source": "notes-from-notes-app.md",
  "parts":    [ { "id": "partI", "label": "The Telemachiad", "blurb": "...", "episodes": [1,2,3] } ],
  "episodes": [ { "number": 1, "part": "I", "title": "Telemachus",
                  "setting": "Stephen · Martello tower", "summary": "..." } ],
  "blocks":   [ { "id": "e05q02", "episode": 5, "kind": "q",
                  "label": "Martha's letter · language of flowers",
                  "paragraphs": ["...", "..."],      // FULL text, paragraph-split
                  "page": "150–51",
                  "lines": "L2632–2652",
                  "flag": null, "flagnote": null, "source": null } ],
  "essays":   [ { "slug": "boylan", "title": "The Bloom–Boylan connection",
                  "tag": "Cross-cutting analysis", "reason": "...",
                  "paragraphs": ["..."], "lines": "L2465–2587" } ],
  "appendix": [ { "slug": "listening", "title": "Audiobook listening log",
                  "paragraphs": ["..."] } ]
}
```

Rules the script must follow:

- **`paragraphs`, not `plain_text`.** `plain_text()` joins every line with a
  single space and flattens Joyce's paragraphing — unacceptable for full quotes.
  Use `ba.paragraphs(ba.strip_markers(ba.source_lines(ranges)))` and join each
  paragraph's lines with `" "`.
- **Keep the page markers stripped** (`strip_markers`) but **keep the citation**
  (`ba.lines_cited(ranges)` → `L2632–2652`) so the graph panel can link back.
- **Carry `flag` / `flagnote` through verbatim.** Six blocks are flagged
  `corrected` / `inferred` / `misattributed`; the graph must show that
  uncertainty, not launder it.
- **Carry `source`** (`AI` / `GUIDE` / review) so analysis is never displayed as
  if it were Joyce.
- **Fail loudly** on a missing ID, a duplicate ID, or an out-of-range line number.

**Step 4.1 — run it.**

```bash
cd ~/code/homebase/ulysses-yas && /opt/homebrew/Caskroom/miniforge/base/bin/python export_corpus.py
```
Expect: `wrote corpus.json: 3 parts, 18 episodes, 115 blocks (96 q / 12 a / 7 c), 3 essays, 3 appendix buckets`.

**Step 4.2 — verify shape and that nothing was truncated.**

```bash
cd ~/code/homebase/ulysses-yas && /opt/homebrew/Caskroom/miniforge/base/bin/python - <<'PY'
import json
d = json.load(open("corpus.json"))
print("blocks", len(d["blocks"]), "essays", len(d["essays"]))
print("empty text:", [b["id"] for b in d["blocks"] if not any(p.strip() for p in b["paragraphs"])])
print("dupe ids:", [i for i in {b['id'] for b in d['blocks']} if sum(b['id']==i for b in d['blocks'])>1])
print("flagged:", [(b["id"], b["flag"]) for b in d["blocks"] if b.get("flag")])
longest = max(d["blocks"], key=lambda b: sum(len(p) for p in b["paragraphs"]))
print("longest block:", longest["id"], sum(len(p) for p in longest["paragraphs"]), "chars")
PY
```
Expect: `blocks 115 essays 3`, two empty lists, **6** flagged entries, and a
longest block in the thousands of characters (the Circe/Oxen analyses).

**Step 4.3 — spot-check one quote against the source, verbatim.**

```bash
cd ~/code/homebase/ulysses-yas && sed -n '2632,2652p' notes-from-notes-app.md | head -5 \
  && echo "--- as exported ---" \
  && /opt/homebrew/Caskroom/miniforge/base/bin/python -c "
import json; d=json.load(open('corpus.json'))
b=[x for x in d['blocks'] if x['id']=='e05q02'][0]
print(b['paragraphs'][0][:300])"
```
Expect: the Martha Clifford letter text, same words in both halves.

---

## 5. Tagging: the only genuinely manual step, and how to make it 80% automatic

Each of the 115 blocks and 15 analysis nodes needs to know which nodes it
belongs to. Three tiers, cheapest first:

**Tier 1 — free, derived (≈130 edges, zero human effort).**
Every block already carries its episode number. `block → episode` is a direct
edge. Likewise `episode → part` from `PARTS` (18 edges), and
`technique → episode` (9 edges).

**Tier 2 — keyword autotag (≈200 edges, review-only effort).**
Build `TAG_RULES` mapping node id → regex over the block's full text:
`bloom`, `molly`, `boylan`, `stephen`, `rudy`, `gerty`, `martha`, `citizen`,
`zoe`, `bello|bella`, `garryowen`, `macintosh|mackintosh`, `metempsychosis`,
`equanimity`, `parallax`, `gibraltar`, `howth`, `mullingar`, and so on. Emit a
candidate edge for each hit, write the candidates to a reviewable TSV, and
accept/reject by eye rather than typing each edge.

**Step 5.1 — generate the candidate tag sheet.**

```bash
cd ~/code/homebase/ulysses-yas && /opt/homebrew/Caskroom/miniforge/base/bin/python autotag.py --out tags-candidates.tsv
```
Expect: `wrote tags-candidates.tsv: N candidate edges across 115 blocks` with N in the 200–400 range.

**Step 5.2 — review it.** One line per candidate: `block_id  node_id  matched_term  keep?`.
Default every row to `keep`; the review pass is deleting false positives
(e.g. "bloom" inside "blooming"), not adding rows. Regex boundaries should use
`\b` to keep that list short.

**Step 5.3 — count what survived.**

```bash
cd ~/code/homebase/ulysses-yas && awk -F'\t' '$4=="keep"' tags-candidates.tsv | wc -l
```

**Tier 3 — hand-tagged, ~40 edges.** Only two things need real judgement:

- **The 15 analysis nodes → the episodes they cite.** `HARD_ITEMS` already
  states these for H1–H3 (the `see_also` table in
  `ulysses-placement-and-themes-plan.md` Part A1 lists the exact block IDs:
  H1 → `e04q02, e10q01, e11q01, e15q33, e18q04`; H2 → `e04q02, e15q13, e15q10,
  e17q02, e15q35`; H3 → `e15q33, e17q04`). Copy those; derive the other 12 from
  each analysis's own episode plus any episode it names.
- **`theme → theme` cross-links for the 12 new themes.** Cheap and high-value
  for layout; no automation beats doing it by hand once.

> **Accuracy note carried over from the existing plan:** H2 claims Bloom "feels a
> 'cold crust'" and "sees Boylan's face in mirrors". Neither is in the notes —
> `e15q34` shows *Shakespeare's* face in the mirror. Mark those claims
> `unverified` in the node's payload rather than repeating them as fact.

---

## 6. Graph app side: the schema and UI changes

**Step 6.1 — generate `src/data/corpus.json` in the app from the exporter output.**

```bash
cd ~/code/ulysses-graph-app && mkdir -p src/data \
  && cp ~/code/homebase/ulysses-yas/corpus.json src/data/corpus.json \
  && node -e "const d=require('./src/data/corpus.json');console.log('blocks',d.blocks.length,'essays',d.essays.length)"
```
Expect: `blocks 115 essays 3`.

> Copy, don't symlink — Vite will not follow a symlink out of the project root,
> and the build must be reproducible from the repo alone. Re-copying is the sync
> step whenever the corpus changes.

**Step 6.2 — extend the node schema in `src/data/graphData.js`.**

New optional fields, all additive — nothing existing breaks:

```js
{
  id: 'ep05', type: 'episode', label: 'Lotus Eaters', number: 5,
  summary: '…',                    // unchanged
  part: 'I',                       // new — links to the part node
  setting: 'Bloom · drift, post, bath',   // new — from EPISODES
  quotes: ['e05q01', 'e05q02'],    // new — block IDs, resolved against corpus.json
  notes:  ['e13c01'],              // new — commentary block IDs
  analyses: ['a-boylan'],          // new — analysis node ids discussing this node
}
```

Quotes are referenced **by ID, never inlined**. `graphData.js` stays reviewable
and `corpus.json` stays the single source of the text.

**Step 6.3 — add the two new types.**

```js
export const TYPE_COLORS = {
  episode: '#ffd400', character: '#00f0ff', theme: '#ff2bd6', place: '#39ff88',
  part: '#ff8a00', analysis: '#b388ff', technique: '#7cf5ff',   // new
};
export const TYPE_LABELS = { /* …, */ part: 'Part', analysis: 'Analysis', technique: 'Technique' };
```

Then in `src/App.jsx:10`, extend `FILTERS`:

```js
const FILTERS = [null, 'episode', 'character', 'theme', 'place', 'part', 'analysis', 'technique'];
```

`App.jsx`'s `COUNTS` and the legend row derive from `NODES` and `TYPE_COLORS`
already, so both pick up the new types for free. The four `LegendCard`s at
`App.jsx:120–123` are hardcoded — add three.

**Step 6.4 — give edges a kind, so 420 edges stay readable.**

```js
{ source: 'bloom', target: 'ep04', kind: 'appears_in' }
```

Kinds: `appears_in`, `set_in`, `theme_of`, `quoted_in`, `discusses`,
`part_of`, `technique_of`, `relates_to`. `kind` is optional, so existing edges
keep working; render it as stroke-dash or opacity in `UlyssesGraph.jsx:102–109`.
Without this, the expanded graph is an undifferentiated mesh.

**Step 6.5 — the detail panel has to carry full quotes.**

`UlyssesGraph.jsx:338–380` is a fixed `w-80` panel with a `max-h-40` scroll box.
That fits a 300-character summary, not a 3,000-character Circe analysis. Changes:

- Widen to `w-80 md:w-[28rem]`, make the whole panel `max-h-[85vh] overflow-y-auto`.
- Below the existing connections block, add a **Quotes** section: one
  `<blockquote>` per resolved block, every paragraph rendered, with the
  `page` / `L2632–2652` citation in mono beneath it.
- Render `flag`/`flagnote` as a visible caution chip (`corrected` / `inferred` /
  `misattributed`) — the whole point of carrying those fields.
- Render `source` as an attribution line on `a` and `c` blocks
  (*"AI chat answer pasted into the notes"*) so analysis never reads as Joyce.
- Collapse each quote past ~400 characters behind a "more" toggle; default
  collapsed when a node has more than three.

**Step 6.6 — verify the app builds and the counts land.**

```bash
cd ~/code/ulysses-graph-app && npm run lint && npm run build
```

```bash
cd ~/code/ulysses-graph-app && node -e "
const d=require('fs').readFileSync('src/data/graphData.js','utf8');
const n=[...d.matchAll(/^  \{ id: '([^']+)', type: '([^']+)'/gm)];
const t={};n.forEach(m=>t[m[2]]=(t[m[2]]||0)+1);
console.log('nodes',n.length,t);
console.log('edges',[...d.matchAll(/\{ source: '/g)].length);
console.log('growth', ((n.length/58-1)*100).toFixed(1)+'%');
"
```
Expect: `nodes 131 { episode: 18, character: 40, theme: 26, place: 20, part: 3, analysis: 15, technique: 9 }` and `growth 125.9%`.

**Step 6.7 — verify every quote reference resolves (expect two empty lists).**

```bash
cd ~/code/ulysses-graph-app && node -e "
const corpus=require('./src/data/corpus.json');
const ids=new Set([...corpus.blocks.map(b=>b.id), ...corpus.essays.map(e=>'a-'+e.slug)]);
const src=require('fs').readFileSync('src/data/graphData.js','utf8');
const refs=[...src.matchAll(/'(e\d\d[qac]\d\d|a-[a-z]+)'/g)].map(m=>m[1]);
console.log('dangling refs:', [...new Set(refs.filter(r=>!ids.has(r)))]);
const used=new Set(refs);
console.log('orphan blocks (in corpus, on no node):', corpus.blocks.filter(b=>!used.has(b.id)).map(b=>b.id));
"
```
Both lists empty means every block made it onto at least one node and no node
points at a block that does not exist. **This is the check that proves "all the
quotes and all the analysis" actually landed.**

**Step 6.8 — eyeball it.**

```bash
cd ~/code/ulysses-graph-app && npm run dev
```
Then: click **Circe** (the 40-block episode) and confirm the panel scrolls
through every quote in full; click an **Analysis** node and confirm the
attribution line and the episodes it links to; filter to **Analysis** and
confirm 15 nodes.

---

## 7. Order of operations

| # | Step | Depends on | Reversible? |
|---|---|---|---|
| 1 | §3 freeze block IDs in `build_atlas.py` | — | yes (git) |
| 2 | §4 write + run `export_corpus.py` | 1 | yes |
| 3 | §5.1–5.3 autotag + review sheet | 2 | yes |
| 4 | §5 Tier-3 hand-tagging (analyses, theme cross-links) | 3 | yes |
| 5 | §2 author the 73 new nodes in `graphData.js` | 4 | yes |
| 6 | §6.2–6.4 schema + types + edge kinds | 5 | yes |
| 7 | §6.5 detail-panel rewrite | 6 | yes |
| 8 | §6.6–6.8 verify | 7 | — |

Steps 1–4 happen in `~/code/homebase/ulysses-yas`; steps 5–8 in
`~/code/ulysses-graph-app`. **Two repos, two commits, two PRs** — they are
separate units of work and the corpus repo's change (ID freezing) is useful on
its own even if the graph work stalls.

Branch state as of writing: `ulysses-graph-app` is on `feat/app-source`, clean
tree, no open PRs — safe to edit in place.

---

## 8. What this plan deliberately does not do

- **No re-transcription of Joyce.** Every character of quoted text comes out of
  `notes-from-notes-app.md` through `build_atlas.py`'s own helpers. If the text
  is wrong in the graph, it is wrong in the atlas too, and one fix repairs both.
- **No quote nodes.** §1.
- **No node invented without corpus evidence.** Every one of the 73 is traceable
  to a `BLOCKS` label, a quoted passage, or `PARTS`/`EPISODES`.
- **No silent laundering of uncertainty.** The 6 `flag`ged placements, the
  `misattributed` analyses, and H2's two unverified claims all stay visible in
  the UI.
- **No audiobook-log mapping.** `HARD_ITEMS`' `listening` bucket stays an
  appendix. Guessing which recording and chapter offsets the timestamps refer to
  would be fabrication.

---
---

# Part II — Phase 2: 131 → 232 nodes (+300% on the original 58), theme-led

*Appended 2026-10-05. Phase 2 is **additive on Phase 1** and cannot precede it —
it reuses Phase 1's `corpus.json`, its frozen block IDs, and its tag sheet.*

Phase 1 grew the graph by adding *more of the same kinds of thing* (more
characters, more places). That tops out fast: Ulysses has a finite cast, and
padding it produces nodes with degree 1.

Phase 2 grows it by adding **new kinds of relation** — motifs that recur across
episodes, Homeric correspondences that bridge characters to episodes, and a
theme hierarchy with internal structure. These are the node types that *earn*
edges rather than consuming them, which is how the graph gets denser and more
readable at the same time.

**Target: 232 nodes** (58 × 4.0 = +300% exactly), **~1,500 edges** (from 153).

---

## 9. Allocation: where the next 101 nodes come from

| Type | Orig. | Ph. 1 | **Ph. 2** | New in Ph. 2 | Source |
|---|---:|---:|---:|---:|---|
| `episode` | 18 | 18 | 18 | 0 | complete |
| `part` | 0 | 3 | 3 | 0 | complete |
| `character` | 18 | 40 | 44 | **+4** | remaining named figures (§9.1) |
| `theme` | 14 | 26 | **44** | **+18** | the hierarchy in §10 |
| `place` | 8 | 20 | 20 | 0 | complete |
| `analysis` | 0 | 15 | 15 | 0 | complete — corpus has exactly 15 |
| `technique` | 0 | 9 | 18 | **+9** | complete the set, all 18 episodes |
| `motif` | 0 | 0 | **40** | **+40** | §11 — the interconnection engine |
| `correspondence` | 0 | 0 | **18** | **+18** | §12 — the Homeric figures |
| `schema` | 0 | 0 | **12** | **+12** | §12 — the Gilbert "art" axis |
| **Total** | **58** | **131** | **232** | **+101** | = **+300.0%** |

### 9.1 The last 4 characters

Milly's photographer employer (Mr Coghlan), Professor Goodwin, J.C. Doyle, and
Mrs Breen — each named in quoted text already exported in Phase 1
(`e04q01`, `e04q05`, `e13q*`). Four is the honest remainder; beyond this,
corpus-attested named figures run out and further characters would be padding.

---

## 10. The theme expansion: 26 → 44, with a hierarchy

Phase 1's 26 themes are a flat list. At 44 a flat list is unusable — the filter
bar becomes a wall and every theme looks equally important. So themes get
**one level of hierarchy**, inside the existing type.

**Schema change — one new optional field, no new type:**

```js
{ id: 'equanimity', type: 'theme', label: 'Equanimity',
  parent: 'cuckoldry',        // new — null/absent for the 8 roots
  summary: '…', quotes: ['e17q04'] }
```

### 10.1 The 8 roots and 36 children

| Root theme | Children | Indicative children |
|---|---:|---|
| Fatherhood & sonship | 5 | Rudy's eleven days · the search for Telemachus · Simon as failed father · Hamnet & Shakespeare's dead son · Rudolph's suicide |
| Cuckoldry & equanimity | 6 | the 4:00 appointment · Boylan as double & rival · masochism & submission · voyeurism & the keyhole · the four-stage defence (envy / jealousy / abnegation / equanimity) · Othello |
| Exile, usurpation & home | 4 | the key & the tower · the failed Fenian (Kevin Egan) · Gibraltar & elsewhere · entry by window |
| The body | 5 | appetite & food · bathing · excretion · masturbation · birth & maternity |
| Death & mourning | 4 | the funeral & its logistics · the mother's deathbed · agenbite of inwit · the ghost |
| Jewishness, nation & empire | 4 | antisemitism's three registers · the Citizen's one eye · colonial curiosity (Haines) · wandering & dispersal |
| Style as subject | 4 | stream of consciousness · parody & pastiche · the history of English prose · the unpunctuated voice |
| Knowledge & the unknowable | 4 | parallax · metempsychosis · the macintosh · misreading & mishearing |
| **8 roots** | **36** | **= 44 theme nodes** |

### 10.2 Migration rules — do not break Phase 1

- **Never change an existing theme's `id`.** All 26 Phase-1 themes keep their
  ids and become either a root or a child. `cuckoldom`, `fatherhood`, `guilt`,
  `language`, `stream`, `memory` etc. all survive as-is, re-parented.
- **Re-parenting is additive**: you add a `parent` field, you do not move or
  rewrite the node. Every Phase-1 edge touching that theme stays valid.
- `parent` must reference a node whose `type` is `theme` and whose own `parent`
  is absent. **One level only** — no grandchildren, verified in §15.
- The 8 roots are the only themes shown when the theme filter is collapsed;
  children appear on expand or when a root is focused.

### 10.3 Free edges from the hierarchy

36 `theme → parent` edges (`kind: 'child_of'`), authored once in the `parent`
field and derived — not hand-listed. Plus: a child inherits its parent's
episode links for layout purposes but **does not duplicate them as edges** (that
would double-count; the hierarchy edge already carries it).

---

## 11. Motifs: the interconnection engine — and a measured warning

A motif node is a recurring concrete image or phrase. It is the highest-value
node type in the whole plan because **one motif yields 4–8 episode edges**: its
entire point is that it recurs. 40 motifs ≈ 240 edges, and they encode Joyce's
actual method rather than an editorial opinion.

### 11.1 What I measured — read this before writing the motif list

> **Final counts in §11.5; superseded in part by §11.4 (added 2026-10-05).** The canon-first list
> described below had 14 of 40 candidates with zero hits. §11.4 re-derives the
> motif list by mining `notes-from-notes-app.md` itself and is the list to use.
> The measurements below stay as the reasoning for why.

I tested whether motif→episode edges can be derived by grepping the corpus.
**Partly, and less than you'd hope:**

```bash
cd ~/code/homebase/ulysses-yas && grep -cEi '\b(metempsychosis|pike hoses)\b' notes-from-notes-app.md
```

Results across 40 canonical-motif candidates:

| Finding | Number | Consequence |
|---|---:|---|
| Candidates with **zero** corpus attestation | **14 of 40** | includes *Throwaway/Elijah*, *agenbite of inwit*, *parallax*, *potted meat*, *Agendath Netaim*, *the black panther*, *the snotgreen sea*, *Love's Old Sweet Song*, *gorgonzola*, *the viceregal cavalcade* |
| Candidates attested, word-bounded | ~26 of 40 | *sweets of sin* (8), *quoits/jingle* (11), *cuckoo* (7), *kidney* (6), *nymph* (5), *potato* (6), *secondbest bed* (3), *metempsychosis* (2), *macintosh* (2), *keyhole* (2), *señorita* (2), *Howth/Bailey* (2) |
| Non-blank corpus lines that map to an episode via a block range | **2,564 / 2,880 = 89%** | a grep hit has an 89% chance of resolving to an episode automatically |

**`notes-from-notes-app.md` is a 96-passage selection, not the novel.** A motif
that recurs eight times in *Ulysses* may appear once or never here. So:

- **Derive the motif list from the corpus, don't impose it from canon.** Run the
  frequency pass (§11.2), take what is actually there, and let the canon list
  be a seed for the grep patterns — not the answer.
- **Word boundaries are mandatory.** Unbounded `hat` matched **195** lines
  (*that*, *what*, *whatever*); bounded `\bhat\b` matched **11**. Unbounded
  `cat` → 42; bounded → 2. Every pattern gets `\b…\b`.
- Any motif that survives with **fewer than 2 distinct episodes** is not a
  motif — it is a single image, and it belongs as a quote on an existing node.
  This is enforced as a hard check in §15.
- The ~14 canonical-but-unattested motifs: **either omit them, or include them
  with `attested: false` and hand-authored episode links**, rendered with the
  same caution chip Phase 1 uses for `inferred` placements. Do not let an
  unattested motif look like a measured one.

### 11.2 Step — generate the motif frequency sheet

```bash
cd ~/code/homebase/ulysses-yas && /opt/homebrew/Caskroom/miniforge/base/bin/python motif_scan.py \
  --patterns motif-patterns.txt --out motif-candidates.tsv
```
Expect: `scanned 40 patterns over 4072 lines: N attested (>=2 episodes), M single-episode, 14 unattested`.

`motif_scan.py` must: compile each pattern with `\b` boundaries and `re.I`;
grep every line of `LINES`; map each hit line → its enclosing block (building
the same line→(episode,kind) index measured above) → episode; and emit
`pattern  n_hits  n_episodes  episodes  example_block_ids`.

**Verify the line→episode index covers what I measured:**

```bash
cd ~/code/homebase/ulysses-yas && /opt/homebrew/Caskroom/miniforge/base/bin/python - <<'PY'
import importlib.util
spec = importlib.util.spec_from_file_location("ba", "build_atlas.py")
ba = importlib.util.module_from_spec(spec); spec.loader.exec_module(ba)
covered = {}
for ep, kind, label, ranges, opts in ba.BLOCKS:
    for s, e in ranges:
        for ln in range(s, e + 1): covered[ln] = (ep, kind)
nonblank = sum(1 for l in ba.LINES if l.strip())
cov = sum(1 for ln in covered if ln <= len(ba.LINES) and ba.LINES[ln - 1].strip())
print(f"non-blank {nonblank}, mapped {cov} ({cov/nonblank:.0%}), unmapped {nonblank-cov}")
PY
```
Expect: `non-blank 2880, mapped 2564 (89%), unmapped 316`.

### 11.3 Motif node shape

```js
{ id: 'm-sweets-of-sin', type: 'motif', label: 'Sweets of Sin',
  pattern: '\\bsweets of sin\\b',   // the regex that found it — auditable
  attested: true, hits: 8,
  episodes: [10, 11, 13, 15, 17, 18],   // DERIVED, not asserted
  quotes: ['e10q01', 'e15q24', 'e17q01'],
  themes: ['cuckoldry', 'voyeurism'],   // hand-tagged, ~2 per motif
  summary: 'The pornographic novel Bloom buys for Molly in Wandering Rocks…' }
```

Everything except `label`, `themes` and `summary` is generated. Hand cost per
motif: a one-line summary and two theme tags.

### 11.4 The corpus-derived motif list (use this one)

Mined from `notes-from-notes-app.md` only — no canon seed list, no
`build_atlas.py` blocks. Method: tokenize the whole file (page markers
removed), rank content words by how many lines they hit and how widely they
spread across the file, group the concrete ones into lexical families, then test
each family with a word-bounded regex. **47 candidates tested.**

**What the raw frequency said.** The top of a plain frequency list is noise
(*little, know, long, life*) and meta-words from the pasted commentary
(*passage, episode, uses, becomes*). One tier down, the corpus's real recurring
imagery appears and it is **sensory and bodily, not allegorical**: *eyes, hands,
hair, lips, white / blue / black / green, voice, music, pockets, veil, letters*.
That is a different list from the canon one, and it is what the file supports.

**Spread** is how many of ten equal slices of the file contain at least one hit
(10 = recurs from start to finish). It is a measure of recurrence, **not** of
episodes: file order is not novel order. Mapping hits to episodes happens later,
in §11.2, through the block index.

**Tiers:** A = spread 6–10 (27 motifs) · B = spread 4–5 (8) · thin = spread ≤3 (12).

| # | Motif | Tier | Lines | Spread /10 | Pattern (`\b…\b`, case-insens.) |
|---:|---|:-:|---:|---:|---|
| 1 | Music & sound | A | 86 | 10 | `music(?:al)?\|sound\|jingle\|jingling\|tune\|melody\|dance` |
| 2 | Voice & song | A | 46 | 10 | `voice\|song\|sang\|sing(?:s\|ing)?\|tenor` |
| 3 | Black & dark | A | 36 | 10 | `black\|dark(?:ness)?\|shadow` |
| 4 | Lips, mouth & breath | A | 27 | 10 | `lips?\|mouth\|breath\|kiss(?:es\|ed)?` |
| 5 | Night, moon & lamplight | A | 45 | 9 | `night\|moon\|stars?\|lights?\|lamp\|fireworks?\|candle` |
| 6 | Eyes & gaze | A | 41 | 9 | `eyes?\|gaze\|stared?\|glance` |
| 7 | Letters & writing | A | 29 | 9 | `letters?\|wrote\|written\|writing\|postcard\|envelope` |
| 8 | White & pale | A | 27 | 9 | `white\|pale\|snow` |
| 9 | Legs, stockings & the garter | A | 22 | 9 | `legs?\|feet\|foot\|ankles?\|stockings?\|garter` |
| 10 | Dress & undress | A | 29 | 8 | `dress\w*\|gown\|slip\|shift\|coat\|skirt\|boots?\|shoes?` |
| 11 | Water, bath & wet | A | 26 | 8 | `water\|bath\|stream\|sea\|strand\|wet` |
| 12 | The pocket check | A | 25 | 8 | `pockets?\|potato\|soap\|locket\|photocard` |
| 13 | Hair | A | 24 | 8 | `hair\|curls?\|tresses` |
| 14 | Archaic voice (thou/thee) | A | 20 | 8 | `thou\|thee\|thy\|thine` |
| 15 | Blue | A | 18 | 8 | `blue` |
| 16 | Hands & fingers | A | 50 | 7 | `hands?\|fingers?\|palm` |
| 17 | Names & aliases | A | 18 | 7 | `names?\|henry\|alias` |
| 18 | Flowers & roses | A | 16 | 7 | `roses?\|flowers?\|lilies\|lily\|violets?` |
| 19 | Green | A | 15 | 7 | `green` |
| 20 | The hat | A | 11 | 7 | `hat` |
| 21 | Bed & bedroom | A | 19 | 6 | `beds?\|bedroom\|pillow\|bedspread` |
| 22 | Bells, whistles & horns | A | 17 | 6 | `bells?\|whistl\w+\|horn\|chime\w*` |
| 23 | Skin, flesh & the bosom | A | 15 | 6 | `skin\|flesh\|naked\|bosom\|breast\w*` |
| 24 | The stranger / mackintosh | A | 15 | 6 | `mackintosh\|macintosh\|stranger` |
| 25 | The veil & the blush | A | 13 | 6 | `veil\|blush(?:es\|ed\|ing)?\|bashful` |
| 26 | Smell & perfume | A | 11 | 6 | `smell\|perfume\|scent\|sniff\w*` |
| 27 | Dogs (Garryowen) | A | 11 | 6 | `garryowen\|terrier\|retriever\|dog\|wolfdog\|dachshund` |
| 28 | Gold & bronze | B | 25 | 5 | `gold(?:en)?\|bronze` |
| 29 | Tears & weeping | B | 17 | 5 | `tears?\|weep\w*\|cry\|cried\|crying` |
| 30 | Mirror & reflection | B | 14 | 5 | `mirror\|looking-?glass\|lookingglass\|reflect\w*` |
| 31 | Jingle & quoits | B | 11 | 5 | `jingle\|jingling\|quoits` |
| 32 | Hunger & eating | B | 9 | 5 | `hungry\|eat(?:s\|ing)?\|dinner\|sandwich\|gobbl\w+\|appetite\|bacon` |
| 33 | The kidney | B | 6 | 5 | `kidney` |
| 34 | Smoke & cigars | B | 14 | 4 | `smok\w+\|cigars?\|cigarettes?\|pipes?` |
| 35 | Keys & locks | B | 6 | 4 | `keys?\|locks?` |
| 36 | The wet night in the lane | thin | 10 | 3 | `wet night\|lane` |
| 37 | Sweets of Sin | thin | 8 | 3 | `sweets of sin` |
| 38 | The cuckoo | thin | 7 | 3 | `cuckoo` |
| 39 | Four o'clock | thin | 6 | 3 | `four o.?clock\|4 ?p\.?m` |
| 40 | Eleven (Rudy's days) | thin | 3 | 3 | `eleven` |
| 41 | Gulls & birds | thin | 3 | 3 | `gulls?\|birds?` |
| 42 | The litany (pray for us) | thin | 19 | 2 | `pray for us\|litany` |
| 43 | Fireworks & the Roman candle | thin | 5 | 2 | `fireworks?\|roman candle\|rocket` |
| 44 | Mananaun & the gasjet | thin | 4 | 2 | `mananaun\|gasjet` |
| 45 | Return, return (Clan Milly) | thin | 2 | 2 | `return,? return\|clan milly` |
| 46 | The cat | thin | 2 | 2 | `cat\|mrkgnao` |
| 47 | Howth & the Bailey light | thin | 2 | 1 | `howth\|bailey` |

#### Which 40 to ship

- **All 35 in tiers A and B.**
- **Plus 5 thin ones, chosen because they are specific, well-known Joyce
  images that this corpus quotes directly:** The wet night in the lane (#36),
  Sweets of Sin (#37), The cuckoo (#38), Four o'clock (#39), The litany
  (#42; 19 lines but all in one run of Circe, so it stays `thin`).
  These carry a `thin: true` flag and render with the same caution chip as an
  `inferred` placement. They pass the "≥2 episodes" check in §15.3, but only just.
- **The other 7 thin candidates do not become nodes**: eleven (3 lines), gulls
  (3), fireworks (5), Mananaun & the gasjet (4), Return, return (2), the cat
  (2), Howth & the Bailey light (2, spread 1). They are single images. Put them
  on existing nodes as `quotes`, per the §11.1 rule.

Result: **40 motifs, 35 of them solid.** Total stays **232 nodes (+300%)**, and
unlike the canon list, no motif is hand-asserted.

#### Two judgements worth challenging

1. **Overlapping families.** Voice & song (#2) and Music & sound (#1) share
   `jingle` and `song`; Black & dark (#3) and Night, moon & lamplight (#5) share
   little but sit close in meaning. I kept each pair separate because voice vs
   structure and colour vs setting are different uses in the text. If the graph
   looks redundant, merging each pair costs 2 nodes — you would land at 230
   (+297%), still within one rounding of the target.
2. **The pocket check (#12) is one motif, not four.** *Potato, soap, locket,
   photocard* are one scene (Bloom going through his pockets). *Sweets of Sin*
   is kept separate (#37) because it recurs on its own in other scenes.

#### The commentary-vocabulary layer: these are themes, not motifs

The mining also surfaced the words the **pasted analysis** leans on. They are
frequent and widely spread, but they are the commentator's concepts, not
Joyce's repeated images, so they feed the §10 theme hierarchy instead:

| Concept | Lines | Spread | Goes under (§10.1) |
|---|---:|---:|---|
| Cuckold, cuckoo, betrayal, jealousy, humiliation, affair | 82 | 8 | Cuckoldry & equanimity |
| Watching, gaze, keyhole, peep | 39 | 7 | Cuckoldry → voyeurism & the keyhole |
| Private & public | 32 | 8 | new child under *Exile, usurpation & home* |
| Memory & remember | 31 | 7 | Knowledge & the unknowable |
| Money & business | 12 | 7 | new child under *Jewishness, nation & empire* |
| Father / child | 55 | 10 | Fatherhood & sonship |
| Death, funeral, ghost | 48 | 10 | Death & mourning |

`private & public` (32 lines across 8 slices) is the one genuinely new theme this
turned up — it was not in the §10.1 table.

#### Caveats on these numbers

- **Counts include the AI-commentary text, not only Joyce.** The notes file
  mixes Joyce's text, pasted analysis, and a listening log. A hit on *eyes* may
  be a Joyce sentence or "Bloom's eyes" in a summary. Spread across the file
  makes a motif likely real; it does not prove Joyce wrote it. §11.2's scan
  must be re-run **restricted to `q` blocks** to separate the two, and any motif
  whose Joyce-only count drops below the thresholds is demoted.
- **Some patterns are generic.** *dress, slip, light, sea, lamp, cry, foot* are
  ordinary words. They are included because the family as a whole recurs, but
  expect a few false positives; skim the hit lines before accepting a family.
- **One pass, one file.** Nothing here has been checked against the novel itself,
  only against the notes.

#### Reproduce it

Create the pattern file used for the table above (one line per motif:
`id|label|regex`):

```bash
cat > ~/code/homebase/ulysses-yas/motif-patterns.txt <<'PATTERNS'
m-music|Music & sound|music(?:al)?|sound|jingle|jingling|tune|melody|dance
m-voice|Voice & song|voice|song|sang|sing(?:s|ing)?|tenor
m-dark|Black & dark|black|dark(?:ness)?|shadow
m-lips|Lips, mouth & breath|lips?|mouth|breath|kiss(?:es|ed)?
m-night|Night, moon & lamplight|night|moon|stars?|lights?|lamp|fireworks?|candle
m-eyes|Eyes & gaze|eyes?|gaze|stared?|glance
m-letters|Letters & writing|letters?|wrote|written|writing|postcard|envelope
m-white|White & pale|white|pale|snow
m-legs|Legs, stockings & the garter|legs?|feet|foot|ankles?|stockings?|garter
m-clothes|Dress & undress|dress\w*|gown|slip|shift|coat|skirt|boots?|shoes?
m-water|Water, bath & wet|water|bath|stream|sea|strand|wet
m-pockets|The pocket check|pockets?|potato|soap|locket|photocard
m-hair|Hair|hair|curls?|tresses
m-thou|Archaic voice (thou/thee)|thou|thee|thy|thine
m-blue|Blue|blue
m-hands|Hands & fingers|hands?|fingers?|palm
m-names|Names & aliases|names?|henry|alias
m-flowers|Flowers & roses|roses?|flowers?|lilies|lily|violets?
m-green|Green|green
m-hat|The hat|hat
m-bed|Bed & bedroom|beds?|bedroom|pillow|bedspread
m-bells|Bells, whistles & horns|bells?|whistl\w+|horn|chime\w*
m-skin|Skin, flesh & the bosom|skin|flesh|naked|bosom|breast\w*
m-stranger|The stranger / mackintosh|mackintosh|macintosh|stranger
m-veil|The veil & the blush|veil|blush(?:es|ed|ing)?|bashful
m-smell|Smell & perfume|smell|perfume|scent|sniff\w*
m-dogs|Dogs (Garryowen)|garryowen|terrier|retriever|dog|wolfdog|dachshund
m-gold|Gold & bronze|gold(?:en)?|bronze
m-tears|Tears & weeping|tears?|weep\w*|cry|cried|crying
m-mirror|Mirror & reflection|mirror|looking-?glass|lookingglass|reflect\w*
m-jingle|Jingle & quoits|jingle|jingling|quoits
m-hunger|Hunger & eating|hungry|eat(?:s|ing)?|dinner|sandwich|gobbl\w+|appetite|bacon
m-kidney|The kidney|kidney
m-smoke|Smoke & cigars|smok\w+|cigars?|cigarettes?|pipes?
m-keys|Keys & locks|keys?|locks?
m-lane|The wet night in the lane|wet night|lane
m-sweets|Sweets of Sin|sweets of sin
m-cuckoo|The cuckoo|cuckoo
m-four|Four o'clock|four o.?clock|4 ?p\.?m
m-eleven|Eleven (Rudy's days)|eleven
m-gulls|Gulls & birds|gulls?|birds?
m-litany|The litany (pray for us)|pray for us|litany
m-fireworks|Fireworks & the Roman candle|fireworks?|roman candle|rocket
m-gasjet|Mananaun & the gasjet|mananaun|gasjet
m-return|Return, return (Clan Milly)|return,? return|clan milly
m-cat|The cat|cat|mrkgnao
m-howth|Howth & the Bailey light|howth|bailey
PATTERNS
wc -l ~/code/homebase/ulysses-yas/motif-patterns.txt
```
Expect: `47 /Users/…/motif-patterns.txt`.

Re-measure any single motif straight from the notes file (swap the pattern):

```bash
cd ~/code/homebase/ulysses-yas && grep -cEi '\b(eyes?|gaze|stared?|glance)\b' notes-from-notes-app.md
```
Expect: `41` (lines containing at least one hit).


### 11.5 Joyce-only re-scan: the result (run 2026-10-05)

`motif_scan.py` (in `~/code/homebase/ulysses-yas/`, uncommitted) maps every notes
line to the Joyce quote blocks only (kind `q`, from `build_atlas.BLOCKS`),
excluding pasted analysis, commentary and the listening log, then counts the
distinct **episodes** each motif hits. It reads `motif-patterns.txt` and writes
`motif-candidates.tsv`.

```bash
cd ~/code/homebase/ulysses-yas && /opt/homebrew/Caskroom/miniforge/base/bin/python motif_scan.py
```
Output: `scanned 47 patterns over 4072 lines (1508 Joyce-block lines): 25 keep, 11 thin, 11 demote`

Rule applied (§15.3 made executable): **keep** = Joyce text in ≥4 episodes ·
**thin** = 2–3 episodes · **demote** = 1 episode, so it is a single image and not
a motif.

**What it changed.**

- **Commentary was inflating the counts a lot.** *Music & sound* went 86 → 10
  lines and from spread 10 to **2 episodes**; most of what looked like a book-wide
  motif was the pasted analysis saying "music". 22 of the 47 patterns lost more
  than 40% of their lines.
- **All 5 thin picks I proposed in §11.4 failed except one.** Sweets of Sin, the
  cuckoo, four o'clock and the litany each appear in Joyce's text in a single
  episode in these notes (15, 15, 11, 15). They are demoted. The wet night in
  the lane survives (3 episodes).
- **9 of the 35 tier A/B motifs were downgraded to thin** (music, gold, jingle,
  stranger, bells, thou, clothes, smoke, mirror).

**Keep: 25** (Joyce text in ≥4 episodes)

| id | Motif | Lines raw → Joyce-only | Eps | Episodes |
|---|---|---:|---:|---|
| `m-hands` | Hands & fingers | 50 → 42 | 9 | 1, 2, 3, 4, 11, 13, 14, 15, 18 |
| `m-eyes` | Eyes & gaze | 41 → 33 | 7 | 2, 11, 12, 13, 14, 15, 17 |
| `m-lips` | Lips, mouth & breath | 27 → 20 | 7 | 3, 4, 11, 13, 14, 15, 18 |
| `m-night` | Night, moon & lamplight | 45 → 32 | 6 | 4, 11, 13, 14, 15, 18 |
| `m-white` | White & pale | 27 → 20 | 6 | 3, 5, 12, 13, 15, 18 |
| `m-water` | Water, bath & wet | 26 → 15 | 6 | 3, 5, 11, 13, 15, 18 |
| `m-names` | Names & aliases | 18 → 12 | 6 | 5, 11, 12, 13, 14, 15 |
| `m-tears` | Tears & weeping | 17 → 9 | 6 | 2, 4, 11, 12, 13, 15 |
| `m-voice` | Voice & song | 46 → 26 | 5 | 1, 4, 11, 13, 15 |
| `m-dark` | Black & dark | 36 → 24 | 5 | 5, 11, 13, 15, 16 |
| `m-letters` | Letters & writing | 29 → 17 | 5 | 4, 5, 11, 14, 15 |
| `m-legs` | Legs, stockings & the garter | 22 → 16 | 5 | 4, 11, 13, 14, 15 |
| `m-flowers` | Flowers & roses | 16 → 13 | 5 | 5, 11, 13, 14, 15 |
| `m-hair` | Hair | 24 → 11 | 5 | 5, 11, 13, 14, 15 |
| `m-skin` | Skin, flesh & the bosom | 15 → 11 | 5 | 5, 8, 13, 14, 15 |
| `m-hunger` | Hunger & eating | 9 → 7 | 5 | 2, 3, 8, 11, 15 |
| `m-pockets` | The pocket check | 25 → 14 | 4 | 5, 14, 15, 16 |
| `m-green` | Green | 15 → 11 | 4 | 3, 12, 13, 15 |
| `m-smell` | Smell & perfume | 11 → 9 | 4 | 4, 5, 11, 15 |
| `m-hat` | The hat | 11 → 8 | 4 | 11, 12, 15, 16 |
| `m-bed` | Bed & bedroom | 19 → 8 | 4 | 4, 13, 14, 15 |
| `m-veil` | The veil & the blush | 13 → 8 | 4 | 11, 13, 14, 15 |
| `m-dogs` | Dogs (Garryowen) | 11 → 8 | 4 | 13, 14, 15, 18 |
| `m-blue` | Blue | 18 → 6 | 4 | 2, 11, 13, 15 |
| `m-kidney` | The kidney | 6 → 5 | 4 | 4, 11, 12, 15 |

**Thin: 11** (2–3 episodes; ship with `thin: true` and the caution chip)

| id | Motif | Lines raw → Joyce-only | Eps | Episodes |
|---|---|---:|---:|---|
| `m-clothes` | Dress & undress | 29 → 15 | 3 | 11, 13, 15 |
| `m-thou` | Archaic voice (thou/thee) | 20 → 14 | 3 | 11, 14, 15 |
| `m-smoke` | Smoke & cigars | 14 → 10 | 3 | 3, 11, 15 |
| `m-bells` | Bells, whistles & horns | 17 → 7 | 3 | 11, 13, 15 |
| `m-mirror` | Mirror & reflection | 14 → 5 | 3 | 4, 15, 17 |
| `m-lane` | The wet night in the lane | 10 → 5 | 3 | 11, 13, 15 |
| `m-music` | Music & sound | 86 → 10 | 2 | 11, 15 |
| `m-gold` | Gold & bronze | 25 → 7 | 2 | 11, 15 |
| `m-stranger` | The stranger / mackintosh | 15 → 4 | 2 | 14, 15 |
| `m-jingle` | Jingle & quoits | 11 → 4 | 2 | 11, 15 |
| `m-eleven` | Eleven (Rudy's days) | 3 → 2 | 2 | 13, 15 |

**Demote: 11** (1 episode; become quotes on existing nodes, not nodes)

| id | Motif | Lines raw → Joyce-only | Eps | Episodes |
|---|---|---:|---:|---|
| `m-litany` | The litany (pray for us) | 19 → 12 | 1 | 15 |
| `m-gasjet` | Mananaun & the gasjet | 4 → 4 | 1 | 15 |
| `m-keys` | Keys & locks | 6 → 3 | 1 | 11 |
| `m-sweets` | Sweets of Sin | 8 → 3 | 1 | 15 |
| `m-cuckoo` | The cuckoo | 7 → 3 | 1 | 15 |
| `m-fireworks` | Fireworks & the Roman candle | 5 → 3 | 1 | 13 |
| `m-gulls` | Gulls & birds | 3 → 2 | 1 | 15 |
| `m-howth` | Howth & the Bailey light | 2 → 2 | 1 | 13 |
| `m-four` | Four o'clock | 6 → 1 | 1 | 11 |
| `m-return` | Return, return (Clan Milly) | 2 → 1 | 1 | 14 |
| `m-cat` | The cat | 2 → 1 | 1 | 15 |

#### Corrected counts

| | §11.4 plan | After re-scan |
|---|---:|---:|
| Motif nodes | 40 | **36** (25 solid + 11 thin) |
| Total nodes | 232 (+300%) | **228 (+293.1%)** |
| Motif → episode edges (F4) | ~240 | **157** |
| Total edges | ~1,500 | **~1,400** |

The shortfall of 4 nodes is real. The corpus supports 36 recurring images, not
40, and §16.3 says to ship what is supported rather than pad. If you want to
reach exactly 232, the honest options are: (a) add 4 nodes of another type
(more `technique` or `schema`, which are derived from the episode list, not from
this scan), or (b) accept +293%. Not: promoting demoted motifs.

#### The coverage problem this exposed

The 157 motif → episode edges are badly lopsided:

| Episode | 1 | 2 | 3 | 4 | 5 | **6** | **7** | 8 | **9** | **10** | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Motif edges | 2 | 5 | 7 | 11 | 10 | **0** | **0** | 2 | **0** | **0** | 27 | 7 | 23 | 16 | 36 | 3 | 2 | 6 |

- **Episodes 6, 7, 9 and 10 get zero motif edges**, and 10 of the 36 motifs live
  entirely inside episodes 11/13/14/15. Episode 15 alone takes 36 edges.
- **The cause is the source, not the method.** `BLOCKS` holds 1 Joyce quote for
  each of eps 1 and 2, and 2 for each of 6, 8 and 10; Circe has 40. The graph
  will show motifs as a Sirens–Nausicaa–Oxen–Circe phenomenon, which is a fact
  about what was pasted into the notes and **not a claim about Ulysses**.
- **Do not paper over it.** The UI should say so (a one-line note on the motif
  layer: "built from the notes file; episodes 6, 7, 9, 10 are not represented
  because no Joyce passages from them were captured"), and the plan's
  cross-episode connectivity should rely on the other families (themes,
  correspondences, schema, technique), which do reach every episode.
- **Cheapest real fix:** paste more Joyce text for eps 6, 7, 9, 10 into the notes
  file, re-run `motif_scan.py`, and the motif layer fills in without any code
  change.


---

## 12. Correspondences and schema: bridging node types

These two types exist to connect *across* the graph's existing partitions, which
is what "more interconnections" actually requires. A new character connects to
episodes it appears in; a Homeric correspondence connects **a set of characters
to a set of episodes to a theme**, in one node.

### 12.1 The 18 Homeric correspondences (`correspondence`)

Odysseus · Penelope · Telemachus · Antinous & the suitors · Calypso · Nestor ·
Proteus · Aeolus · the Lotus Eaters · Hades & Elpenor · Polyphemus · Nausicaa ·
the Sirens · Scylla & Charybdis · Circe · the Oxen of Helios · Eumaeus ·
Athena/Mentor

Each carries two derived edge sets:

| Correspondence | → characters | → episode(s) |
|---|---|---|
| Odysseus | bloom | 4–18 |
| Penelope | molly | 18 |
| Calypso | molly | 4 |
| Telemachus | stephen | 1–3, 9, 14–17 |
| Antinous | mulligan, boylan | 1, 9, 11 |
| Nestor | deasy | 2 |
| Polyphemus | citizen | 12 |
| Nausicaa | gerty | 13 |
| the Sirens | douce, kennedy | 11 |
| Hades & Elpenor | dignam | 6 |
| Circe | bella_cohen, zoe | 15 |
| Eumaeus | murphy | 16 |

…and so on for the remaining 6. **18 authored rows → ~45 edges**, and crucially
these are the edges that link the character cluster to the episode cluster
through a third thing, which pulls the layout into something readable instead of
two blobs.

### 12.2 The 12 schema nodes (`schema`)

The Gilbert schema's **"art" axis**, one per assigned episode: Theology ·
History · Philology · Economics · Botany & Chemistry · Rhetoric · Architecture ·
Literature · Music · Politics · Medicine · Magic.

**Deliberate omission:** the schema's *organ* axis (kidney, genitals, heart,
lungs, ear, womb, flesh…) is **not** a node type. Those collapse cleanly into
the **The body** theme cluster (§10.1) as children and quote tags; making them a
parallel 15-node type would duplicate the same relations under a second name.
`kidney` stays a **motif**, which is what it functions as in the text.

---

## 13. Interconnection: nine derived edge families, ~1,500 edges

The point of this section is that **almost none of these are hand-authored.**
153 → ~1,500 edges is a 10× increase for roughly 60 authored rows.

| # | Family | Derivation rule | Est. | Judgement |
|---|---|---|---:|---|
| F1 | `block → episode` | the block's own episode number | 115 | none |
| F2 | `episode → part` | `PARTS` | 18 | none |
| F3 | `theme → parent` | the `parent` field | 36 | 36 field values |
| F4 | `motif → episode` | **grep the motif pattern, map hit line → block → episode** (§11.2) | ~240 | none |
| F5 | `block → node` | Phase-1 autotag regex over block text, now including motif patterns | ~300 | review sheet |
| F6 | `correspondence → character` / `→ episode` | the 18-row table (§12.1) | ~45 | 18 rows |
| F7 | `schema → episode` | the 12-row Gilbert art axis | 12 | 12 rows |
| F8 | **co-occurrence**: `theme↔theme`, `char↔char`, `theme↔char`, `motif↔theme` | pairwise count over nodes sharing a block tag, kept where count ≥ 2 | ~450 | none |
| F9 | `analysis → episode` / `→ block` | `HARD_ITEMS` `see_also` + each analysis's own episode | ~60 | partly authored |
| — | Phase 1 + original | — | ~420 | — |
| | **Total after dedup** | | **~1,500** | **~66 authored rows** |

### 13.1 F8 is the trick worth understanding

Instead of hand-authoring `theme ↔ theme` and `character ↔ character` edges — the
tedious, arbitrary part of Phase 1 — **compute them from shared block tags.**
Two themes tagged on the same passage co-occur; count those co-occurrences
across all 115 blocks; emit an edge wherever the count clears a threshold, with
the count as the edge **weight**.

```bash
cd ~/code/homebase/ulysses-yas && /opt/homebrew/Caskroom/miniforge/base/bin/python cooccur.py \
  --tags tags-candidates.tsv --min-weight 2 --out edges-derived.json
```
Expect: `N pairs above threshold (theme↔theme X, char↔char Y, theme↔char Z, motif↔theme W)`
with N in the 350–550 range. Tune `--min-weight` to land there; **3 is likely
right if 2 over-produces.**

This is both cheaper and more defensible than hand-authoring: the edge exists
because two things appear in the same Joyce passage, not because someone felt
they were related.

### 13.2 Edges get a weight, and `kind` becomes mandatory

Phase 1 made `kind` optional. At ~1,500 edges it is required:

```js
{ source: 'm-sweets-of-sin', target: 'ep15', kind: 'recurs_in', weight: 3 }
```

Kinds: `appears_in` · `set_in` · `theme_of` · `child_of` · `recurs_in` ·
`quoted_in` · `discusses` · `part_of` · `technique_of` · `schema_of` ·
`corresponds_to` · `co_occurs`. `weight` defaults to 1; only F8 edges carry
counts above that.

---

## 14. What breaks at 232 nodes / 1,500 edges — this is mandatory work, not polish

Phase 1's UI changes were additive. Phase 2's are not: the current component
will render this as an illegible mesh. Four things must change.

**14.1 Layers, not a 10-item filter bar.** `App.jsx:10`'s `FILTERS` array with
ten types is a wall of pills. Group them:

```js
const LAYERS = {
  text:   ['part', 'episode', 'motif'],
  people: ['character', 'correspondence'],
  ideas:  ['theme', 'technique', 'schema', 'analysis'],
  places: ['place'],
};
```
Default view = **one layer on** (`text`), with per-type pills nested under the
active layer. A 232-node graph with everything visible is not a default anyone
wants.

**14.2 An edge-weight threshold control.** A slider bound to `minWeight`,
default 2, filtering F8 edges. Without it the co-occurrence family alone buries
the structural edges.

**14.3 Degree-based sizing and label suppression.** `UlyssesGraph.jsx:203` sizes
by type (`episode ? 12 : character ? 10 : 8`). Replace with
`radius = 5 + Math.sqrt(degree) * 1.8`, so hubs read as hubs. And suppress
labels below a degree/zoom threshold — 232 simultaneous `<text>` labels is
unreadable regardless of performance.

**14.4 Retune the force simulation, and measure before optimising.**
`forceManyBody` strength and `forceLink` distance tuned for 58/153 will collapse
or explode at 232/1500. Scale charge with node count, raise link distance, add
`forceCollide`, and lower `alphaDecay` so it still settles.

```bash
cd ~/code/ulysses-graph-app && npm run build && npm run preview
```
Then profile a drag in DevTools. **1,500 SVG `<line>` elements updated per tick
is the thing to measure** — if a tick exceeds ~16ms, in this order: (a) raise
`minWeight`, (b) render links to `<canvas>` while keeping nodes in SVG for
hit-testing, (c) only then consider WebGL. Do not pre-emptively rewrite to
canvas; measure first.

**14.5 The neighbour panel needs grouping.** `UlyssesGraph.jsx:302–307` lists
every neighbour as a flat chip row in a `max-h-40` box. `bloom` will have 100+
neighbours. Group by type with counts (`Themes (14) · Motifs (22) · …`),
collapsed, expandable.

---

## 15. Verification for Phase 2

**15.1 Node count and growth.**

```bash
cd ~/code/ulysses-graph-app && node -e "
const d=require('fs').readFileSync('src/data/graphData.js','utf8');
const n=[...d.matchAll(/^  \{ id: '([^']+)', type: '([^']+)'/gm)];
const t={};n.forEach(m=>t[m[2]]=(t[m[2]]||0)+1);
console.log('nodes',n.length); console.log(t);
console.log('growth vs 58:', ((n.length/58-1)*100).toFixed(1)+'%');
"
```
Expect: `nodes 232`, the type table matching §9, and `growth vs 58: 300.0%`.

**15.2 Theme hierarchy is exactly one level, with no dangling or cyclic parents.**

```bash
cd ~/code/ulysses-graph-app && node -e "
const {NODES}=await import('./src/data/graphData.js');
const themes=NODES.filter(n=>n.type==='theme');
const byId=new Map(themes.map(t=>[t.id,t]));
const roots=themes.filter(t=>!t.parent), kids=themes.filter(t=>t.parent);
console.log('themes',themes.length,'roots',roots.length,'children',kids.length);
console.log('dangling parent:',kids.filter(t=>!byId.has(t.parent)).map(t=>t.id));
console.log('grandchildren (parent has a parent):',kids.filter(t=>byId.get(t.parent)?.parent).map(t=>t.id));
console.log('self-parent:',themes.filter(t=>t.parent===t.id).map(t=>t.id));
" --input-type=module
```
Expect: `themes 44 roots 8 children 36` and **three empty arrays**.

**15.3 Every motif actually recurs — the check that keeps motifs honest.**

```bash
cd ~/code/ulysses-graph-app && node -e "
const {NODES}=await import('./src/data/graphData.js');
const m=NODES.filter(n=>n.type==='motif');
const thin=m.filter(x=>(x.episodes||[]).length<2);
console.log('motifs',m.length,'attested',m.filter(x=>x.attested).length,'unattested',m.filter(x=>!x.attested).length);
console.log('NOT RECURRING (<2 episodes) — demote these to quotes:',thin.map(x=>x.id));
console.log('missing pattern:',m.filter(x=>!x.pattern).map(x=>x.id));
" --input-type=module
```
Expect: `motifs 40`, the attested/unattested split matching what §11.2 actually
found, and **two empty arrays**. A non-empty first array means a motif is not a
motif — demote it, don't keep it for the node count.

**15.4 Edge count, kinds, and that nothing is orphaned.**

```bash
cd ~/code/ulysses-graph-app && node -e "
const {NODES,EDGES}=await import('./src/data/graphData.js');
const ids=new Set(NODES.map(n=>n.id));
const deg=new Map(NODES.map(n=>[n.id,0]));
let bad=[];
for(const e of EDGES){
  if(!ids.has(e.source)||!ids.has(e.target)) bad.push(e.source+'->'+e.target);
  deg.set(e.source,(deg.get(e.source)||0)+1); deg.set(e.target,(deg.get(e.target)||0)+1);
}
const kinds={}; EDGES.forEach(e=>kinds[e.kind||'UNTYPED']=(kinds[e.kind||'UNTYPED']||0)+1);
const ds=[...deg.values()].sort((a,b)=>a-b);
console.log('edges',EDGES.length,'nodes',NODES.length);
console.log('kinds',kinds);
console.log('dangling edges:',bad);
console.log('degree-0 nodes:',[...deg].filter(([,d])=>d===0).map(([i])=>i));
console.log('degree median',ds[Math.floor(ds.length/2)],'max',ds[ds.length-1],'mean',(2*EDGES.length/NODES.length).toFixed(1));
" --input-type=module
```
Expect: `edges` ≈ 1,400–1,600; **no `UNTYPED` key**; two empty arrays; mean
degree ~12 and median ~8. A degree-0 node is a node that earned nothing — cut it
or tag it.

**Baseline, measured on the current 58-node graph** (same command, run
2026-10-05): `edges 153`, `kinds { UNTYPED: 153 }`, no dangling, no degree-0,
**degree median 4, max 32 (`bloom`), mean 5.3**. Phase 2 should roughly double
the mean and raise the median to ~8 — if the mean climbs but the median does
not, the new edges are all piling onto existing hubs and the periphery gained
nothing.

**15.5 Full-corpus coverage still holds after Phase 2.** Re-run §6.7 unchanged.
Expect both lists still empty — Phase 2 must not orphan a block that Phase 1 placed.

**15.6 Interaction budget.**

```bash
cd ~/code/ulysses-graph-app && npm run lint && npm run build && npm run preview
```
Then in DevTools Performance, drag a hub node for 3 seconds. **Pass = no tick
over ~16ms.** Record the actual number in this doc when you run it; if it fails,
apply §14.4's remedies in order and record which one was needed.

---

## 16. Order, risk, and what Phase 2 still refuses to do

### 16.1 Order

| # | Step | Where | Depends on |
|---|---|---|---|
| 1–8 | **all of Phase 1** | both repos | — |
| 9 | Re-parent the 26 themes, author 18 new ones (§10) | graph app | 5 |
| 10 | `motif_scan.py` + patterns file → `motif-candidates.tsv` (§11.2) | `ulysses-yas` | 2 |
| 11 | Pick the 40 motifs from what the scan found; author summaries + theme tags | graph app | 10 |
| 12 | Author the 18-row correspondence table + 12 schema rows (§12) | graph app | 9 |
| 13 | Complete `technique` to 18; add the last 4 characters | graph app | 5 |
| 14 | `cooccur.py` → `edges-derived.json` (§13.1) | `ulysses-yas` | 10, 11 |
| 15 | Merge derived edges in, add `kind` + `weight` everywhere (§13.2) | graph app | 14 |
| 16 | §14 UI work — layers, weight slider, degree sizing, force retune, panel grouping | graph app | 15 |
| 17 | §15 verify | graph app | 16 |

Steps 10 and 14 are the only new Python; 9, 11, 12, 13 are the authoring; 16 is
the bulk of the real work and should probably be its own PR.

**Suggested PR split** (4, not 1 — step 16 alone will be a large diff):
`corpus-ingest` (Ph. 1) · `theme-hierarchy` (9) · `motifs-and-correspondences`
(10–15) · `graph-ui-at-scale` (16).

### 16.2 The real risk: a 232-node mesh nobody can read

Node count is the thing that was asked for; **legibility is the thing that can
be lost getting it.** At 232/1,500 the honest failure mode is a graph that is
objectively richer and subjectively worse than the 58-node version.

Three mitigations, all in §14, none optional: **layers on by default (one at a
time), a weight threshold ≥2, and degree-based sizing with label suppression.**
If after §15.6 the graph is still unreadable with those on, the correct response
is to raise `--min-weight` and hide the F8 co-occurrence layer by default — not
to delete nodes. The co-occurrence family is the one that can be turned down
without losing structure, because it is derived and reproducible.

### 16.3 Still refused, for the same reasons as §8

- **No motif kept for the count.** §15.3 fails the build on a motif with fewer
  than 2 episodes. 40 is the target, not a quota — if the corpus only supports
  34 attested motifs, ship 34 and say so, and the total lands at 226 (+290%)
  rather than fabricating six.
- **No unattested node presented as attested.** The 14 canonical motifs with
  zero corpus hits carry `attested: false` and the caution chip, or they don't
  ship.
- **No organ axis as a parallel type** (§12.2) — it would duplicate the body
  theme cluster to inflate the count.
- **No grandchild themes.** One level, verified.
- **No co-occurrence edge below threshold.** A single shared passage is a
  coincidence, not a relation.
