// The Ulysses graph: the hand-authored base (baseData.js) plus the corpus-derived
// expansion (expansion.json, produced by scripts/build_graph_data.py).
import { NODES as BASE_NODES, EDGES as BASE_EDGES } from './baseData';
import expansion from './expansion.json';

export const TYPE_COLORS = {
  episode:        '#ffd400',  // acid yellow
  character:      '#00f0ff',  // cyan
  theme:          '#ff2bd6',  // magenta
  place:          '#39ff88',  // toxic green
  part:           '#ff9f1a',  // amber
  motif:          '#ff5c7a',  // hot coral
  analysis:       '#b388ff',  // violet
  technique:      '#7cf5ff',  // ice
  correspondence: '#5b9bff',  // blue
  schema:         '#c6ff3d',  // lime
};

export const TYPE_LABELS = {
  episode: 'Episode', character: 'Character', theme: 'Theme', place: 'Place',
  part: 'Part', motif: 'Motif', analysis: 'Analysis', technique: 'Technique',
  correspondence: 'Correspondence', schema: 'Schema',
};

/** Filter-bar layers: which node types each view shows. A 228-node graph is not a good default. */
export const LAYERS = [
  { id: 'core',      label: 'Core',      types: ['part', 'episode', 'character', 'theme', 'place'] },
  { id: 'motifs',    label: 'Motifs',    types: ['episode', 'motif', 'theme'] },
  { id: 'structure', label: 'Structure', types: ['part', 'episode', 'correspondence', 'schema', 'technique', 'analysis'] },
  { id: 'all',       label: 'All',       types: Object.keys(TYPE_COLORS) },
];

export const EDGE_KINDS = {
  appears_in: 'appears in', set_in: 'set in', theme_of: 'theme of', child_of: 'sub-theme of',
  recurs_in: 'recurs in', part_of: 'part of', technique_of: 'technique of', schema_of: 'schema of',
  corresponds_to: 'corresponds to', discusses: 'discusses', co_occurs: 'co-occurs with', relates_to: 'relates to',
};

/** Infer a kind for the 153 untyped base edges from the types of their endpoints. */
function baseEdgeKind(a, b) {
  const types = new Set([a.type, b.type]);
  if (types.has('episode') && types.has('character')) return 'appears_in';
  if (types.has('episode') && types.has('theme')) return 'theme_of';
  if (types.has('episode') && types.has('place')) return 'set_in';
  return 'relates_to';
}

export const NODES = [
  ...BASE_NODES.map(n => ({ ...n, ...(expansion.overlay[n.id] ?? {}) })),
  ...expansion.nodes,
];

const nodeById = new Map(NODES.map(n => [n.id, n]));

// One edge per unordered pair; the first occurrence wins. Sub-theme edges go
// first so the hierarchy is never lost to a generic hand-authored link, and the
// curated base edges beat derived co-occurrence.
const seenPairs = new Set();
export const EDGES = [
  ...expansion.edges.filter(e => e.kind === 'child_of'),
  ...BASE_EDGES.map(e => ({ ...e, kind: baseEdgeKind(nodeById.get(e.source), nodeById.get(e.target)) })),
  ...expansion.edges.filter(e => e.kind !== 'child_of'),
].filter(e => {
  const key = [e.source, e.target].sort().join('|');
  if (seenPairs.has(key)) return false;
  seenPairs.add(key);
  return true;
});

/** Degree of every node across the full edge list; drives node size and label visibility. */
export const DEGREE = new Map(NODES.map(n => [n.id, 0]));
for (const e of EDGES) {
  DEGREE.set(e.source, DEGREE.get(e.source) + 1);
  DEGREE.set(e.target, DEGREE.get(e.target) + 1);
}

/** Corpus text (quotes, analyses). Loaded lazily so the first paint stays light. */
let corpusPromise;
export function loadCorpus() {
  corpusPromise ??= import('./corpus.json').then(m => {
    const corpus = m.default;
    return { ...corpus, byId: new Map(corpus.blocks.map(b => [b.id, b])) };
  });
  return corpusPromise;
}
