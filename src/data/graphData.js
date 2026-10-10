// The Ulysses graph: the hand-authored base (baseData.js) plus the corpus-derived
// expansion (expansion.json, produced by scripts/build_graph_data.py).
import { NODES as BASE_NODES, EDGES as BASE_EDGES } from './baseData';
import expansion from './expansion.json';

/** Ten node types share five color families; shape tells types apart inside a family. */
export const TYPE_COLORS = {
  episode:        'var(--fam-text)',
  part:           'var(--fam-text)',
  character:      'var(--fam-people)',
  theme:          'var(--fam-ideas)',
  motif:          'var(--fam-ideas)',
  place:          'var(--fam-places)',
  analysis:       'var(--fam-apparatus)',
  technique:      'var(--fam-apparatus)',
  correspondence: 'var(--fam-apparatus)',
  schema:         'var(--fam-apparatus)',
  passage:        'var(--fam-text)',
};

/** circle | diamond | square — see STYLE-GUIDE.md §1.3. */
export const TYPE_SHAPES = {
  episode: 'circle', part: 'circle', character: 'circle', theme: 'circle',
  motif: 'diamond', place: 'square',
  analysis: 'square', technique: 'square', correspondence: 'square', schema: 'square',
  passage: 'square',
};

/** Types drawn as an outline only, so they read as structure rather than content. */
export const HOLLOW_TYPES = new Set(['part', 'analysis']);

/** Mix a CSS color with transparency, e.g. tint('var(--fam-people)', 40). */
export const tint = (color, percent) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

export const TYPE_LABELS = {
  episode: 'Episode', character: 'Character', theme: 'Theme', place: 'Place',
  part: 'Part', motif: 'Motif', analysis: 'Analysis', technique: 'Technique',
  correspondence: 'Correspondence', schema: 'Schema', passage: 'Passage',
};

/** Filter-bar layers: which node types each view shows. A 228-node graph is not a good default. */
export const LAYERS = [
  { id: 'core',      label: 'Core',      types: ['part', 'episode', 'character', 'theme', 'place'] },
  { id: 'motifs',    label: 'Motifs',    types: ['episode', 'motif', 'theme'] },
  { id: 'structure', label: 'Structure', types: ['part', 'episode', 'correspondence', 'schema', 'technique', 'analysis'] },
  { id: 'all',       label: 'All',       types: Object.keys(TYPE_COLORS).filter(t => t !== 'passage') },
  { id: 'passages',  label: 'Passages',  types: ['episode', 'character', 'place', 'motif', 'theme', 'passage', 'analysis'] },
];

/** Passages are a layer of their own; the layer that can show a node of this type. */
export const layerFor = type => (type === 'passage' ? 'passages' : 'all');

export const EDGE_KINDS = {
  appears_in: 'appears in', set_in: 'set in', theme_of: 'theme of', child_of: 'sub-theme of',
  recurs_in: 'recurs in', part_of: 'part of', technique_of: 'technique of', schema_of: 'schema of',
  corresponds_to: 'corresponds to', discusses: 'discusses', co_occurs: 'co-occurs with', relates_to: 'relates to',
  next: 'comes before', echoes: 'echoes', relationship: 'relationship', speaks_in: 'speaks in',
  in: 'quoted from', mentions: 'mentions',
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

// One edge per unordered pair; the first occurrence wins its kind. Sub-theme edges go
// first so the hierarchy is never lost to a generic hand-authored link, and the
// curated base edges beat derived co-occurrence. A later duplicate still lends its
// evidence (blocks, shared nodes, speaker counts); a named relationship also wins the kind.
const edgeByPair = new Map();
export const EDGES = [];
for (const e of [
  ...expansion.edges.filter(e => e.kind === 'child_of'),
  ...BASE_EDGES.map(e => ({ ...e, kind: baseEdgeKind(nodeById.get(e.source), nodeById.get(e.target)) })),
  ...expansion.edges.filter(e => e.kind !== 'child_of'),
]) {
  const key = [e.source, e.target].sort().join('|');
  const kept = edgeByPair.get(key);
  if (!kept) {
    const copy = { ...e };
    edgeByPair.set(key, copy);
    EDGES.push(copy);
    continue;
  }
  const { source: _s, target: _t, kind, ...extras } = e;
  Object.assign(kept, extras);
  if (kind === 'relationship') kept.kind = kind;
}

const isPassageEdge = e => nodeById.get(e.source)?.type === 'passage' || nodeById.get(e.target)?.type === 'passage';

/** Edges among the 228 non-passage nodes, the graph the app is mostly about. */
export const CORE_EDGE_COUNT = EDGES.filter(e => !isPassageEdge(e)).length;
export const CORE_NODE_COUNT = NODES.filter(n => n.type !== 'passage').length;

/** Degree of every node; drives node size and label visibility. Passage links don't inflate other nodes. */
export const DEGREE = new Map(NODES.map(n => [n.id, 0]));
for (const e of EDGES) {
  const sourceIsPassage = nodeById.get(e.source).type === 'passage';
  const targetIsPassage = nodeById.get(e.target).type === 'passage';
  if (!targetIsPassage || sourceIsPassage) DEGREE.set(e.source, DEGREE.get(e.source) + 1);
  if (!sourceIsPassage || targetIsPassage) DEGREE.set(e.target, DEGREE.get(e.target) + 1);
}

export const nodeOf = id => nodeById.get(id);

/** Corpus text (quotes, analyses). Loaded lazily so the first paint stays light. */
let corpusPromise;
export function loadCorpus() {
  corpusPromise ??= import('./corpus.json').then(m => {
    const corpus = m.default;
    return { ...corpus, byId: new Map(corpus.blocks.map(b => [b.id, b])) };
  });
  return corpusPromise;
}
