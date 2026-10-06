# Ulysses Graph App

An interactive force-directed graph of James Joyce's *Ulysses* — episodes, characters, themes, and places, built with React, D3, and Vite.

## The graph: 228 nodes

The graph is the hand-authored base (`src/data/baseData.js`, 58 nodes) plus a
corpus-derived expansion (`src/data/expansion.json`) and the full text of every
Joyce passage and analysis it cites (`src/data/corpus.json`, loaded lazily).

| Type | Count | | Type | Count |
|---|---:|---|---|---:|
| episode | 18 | | motif | 36 |
| character | 44 | | analysis | 15 |
| theme (8 roots, 36 sub-themes) | 44 | | technique | 18 |
| place | 20 | | correspondence | 18 |
| part | 3 | | schema | 12 |

Views are split into layers (Core, Motifs, Structure, All) because all 228 nodes
at once is dense. The *co-occurs* slider hides derived edges shared by fewer
passages than its value.

**Regenerating the data.** The text comes from the notes corpus in
`~/code/homebase/ulysses-yas` (override with `ULYSSES_YAS`). Node tables and
tagging rules are in `scripts/graph_nodes.py`; motif patterns in
`scripts/motif-patterns.txt`.

```bash
cd ~/code/ulysses-graph-app && /opt/homebrew/Caskroom/miniforge/base/bin/python scripts/build_graph_data.py
```

Expect `new nodes: 170 …` and `blocks: 118 …`.

**Known limit.** The motif layer is built from the notes file, which has no
captured Joyce passages for episodes 6, 7, 9 and 10, so no motif reaches them.
Nodes drawn with a dashed outline are *thin*: their evidence in the notes is
slight (see the chip in the detail panel).

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
