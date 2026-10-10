import * as d3 from 'd3';
import { DEGREE, TYPE_COLORS } from '../data/graphData';

export const SPREAD_MIN = 0.6;
export const SPREAD_MAX = 2.5;
export const SPREAD_DEFAULT = 1;

export const LAYOUT_PRESETS = [
  { id: 'free', label: 'Free' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'type', label: 'By type' },
  { id: 'radial', label: 'Radial' },
];

const BASE = {
  linkDistance: 75,
  chargeDense: -260,
  chargeSparse: -180,
  collidePad: 4,
  centerPull: 0.045,
};

// Hierarchy sits tight; statistical links stay loose so they don't knot the middle.
const LINK_DISTANCE_BY_KIND = { child_of: 40, part_of: 45, co_occurs: 110 };
const HUB_DISTANCE_PER_SQRT_DEGREE = 2;

const LABEL_CHAR_WIDTH = 5.5;   // px per character at 10px mono
const LABEL_EXTRA_MAX = 30;

const TIMELINE_MARGIN = 60;
const TIMELINE_FOLLOWER_PULL = 0.12;
const TYPE_GRID_PULL = 0.14;
const RADIAL_PULL = 0.7;
const RADIAL_INNER_RADIUS = 40;
const RADIAL_OUTER_SHARE = 0.42;
const RING_ORDER = [
  'episode', 'part', 'character', 'place', 'theme', 'technique',
  'correspondence', 'schema', 'motif', 'analysis', 'passage',
];

const endId = (d, end) => (typeof d[end] === 'object' ? d[end].id : d[end]);

/** Edge length by kind, lengthened for hubs so a busy node's neighbours can fan out. */
export const linkDistanceFor = d => {
  const hub = Math.max(DEGREE.get(endId(d, 'source')) || 1, DEGREE.get(endId(d, 'target')) || 1);
  return (LINK_DISTANCE_BY_KIND[d.kind] ?? BASE.linkDistance) + Math.sqrt(hub) * HUB_DISTANCE_PER_SQRT_DEGREE;
};

/** Collision radius: the shape, padding that grows with spread, plus room for a visible label. */
export function collideRadiusFor({ spread, radiusOf, labelMinDegree }) {
  return d => {
    const labelled = (DEGREE.get(d.id) ?? 0) >= labelMinDegree;
    const labelExtra = labelled ? Math.min(LABEL_EXTRA_MAX, (d.label.length * LABEL_CHAR_WIDTH) / 2) : 0;
    return radiusOf(d) + BASE.collidePad * spread + labelExtra;
  };
}

/** Retune link length, repulsion and collision on the running simulation; positions are kept. */
export function applySpacing(sim, { spread, dense, radiusOf, labelMinDegree }) {
  sim.force('link').distance(d => linkDistanceFor(d) * spread);
  sim.force('charge').strength((dense ? BASE.chargeDense : BASE.chargeSparse) * spread);
  sim.force('collision').radius(collideRadiusFor({ spread, radiusOf, labelMinDegree }));
}

function typeGridTargets(nodes, W, H) {
  const types = [...new Set(nodes.map(n => n.type))].sort(
    (a, b) => Object.keys(TYPE_COLORS).indexOf(a) - Object.keys(TYPE_COLORS).indexOf(b));
  const cols = W > 700 ? 4 : 3;
  const rows = Math.ceil(types.length / cols);
  return new Map(types.map((type, i) => [type, {
    x: (W * ((i % cols) + 0.5)) / cols,
    y: (H * (Math.floor(i / cols) + 0.5)) / rows,
  }]));
}

function timelineSlots(nodes, W) {
  const episodes = nodes.filter(n => n.type === 'episode').sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const step = (W - TIMELINE_MARGIN * 2) / Math.max(1, episodes.length - 1);
  return new Map(episodes.map((n, i) => [n.id, TIMELINE_MARGIN + i * step]));
}

/** Swap the positioning forces for a preset. Pins and spacing apply on top of whichever is chosen. */
export function applyPreset(sim, preset, { nodes, adjacency, W, H, spread, isPinned }) {
  const pull = BASE.centerPull / spread;
  // The timeline anchors each episode to its slot, so the order is exact rather than approximate.
  // Anchors are marked so they can be released when the preset changes; a node the reader pinned is never touched.
  for (const n of nodes) {
    if (!n.anchored || isPinned(n.id)) continue;
    n.fx = null; n.fy = null; n.anchored = false;
  }
  sim.force('radial', null);
  sim.force('center', preset === 'free' ? d3.forceCenter(W / 2, H / 2) : null);

  if (preset === 'timeline') {
    const slots = timelineSlots(nodes, W);
    for (const n of nodes) {
      if (!slots.has(n.id) || isPinned(n.id)) continue;
      n.fx = slots.get(n.id); n.fy = H / 2; n.anchored = true;
    }
    const meanSlot = d => {
      const xs = [...(adjacency.get(d.id) ?? [])].map(id => slots.get(id)).filter(x => x !== undefined);
      return xs.length ? d3.mean(xs) : W / 2;
    };
    sim.force('x', d3.forceX(d => slots.get(d.id) ?? meanSlot(d)).strength(TIMELINE_FOLLOWER_PULL));
    sim.force('y', d3.forceY(H / 2).strength(pull));
    return;
  }
  if (preset === 'type') {
    const anchors = typeGridTargets(nodes, W, H);
    sim.force('x', d3.forceX(d => anchors.get(d.type)?.x ?? W / 2).strength(TYPE_GRID_PULL));
    sim.force('y', d3.forceY(d => anchors.get(d.type)?.y ?? H / 2).strength(TYPE_GRID_PULL));
    return;
  }
  if (preset === 'radial') {
    const outer = (Math.min(W, H) * RADIAL_OUTER_SHARE);
    const ringStep = (outer - RADIAL_INNER_RADIUS) / (RING_ORDER.length - 1);
    const ringOf = d => {
      const i = RING_ORDER.indexOf(d.type);
      return RADIAL_INNER_RADIUS + (i < 0 ? RING_ORDER.length - 1 : i) * ringStep;
    };
    sim.force('radial', d3.forceRadial(ringOf, W / 2, H / 2).strength(RADIAL_PULL));
    sim.force('x', d3.forceX(W / 2).strength(0.01));
    sim.force('y', d3.forceY(H / 2).strength(0.01));
    return;
  }
  sim.force('x', d3.forceX(W / 2).strength(pull));
  sim.force('y', d3.forceY(H / 2).strength(pull));
}
