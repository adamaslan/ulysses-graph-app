import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import NodePanel, { EdgeCard } from './NodePanel';
import {
  NODES, EDGES, DEGREE, LAYERS, TYPE_COLORS, TYPE_LABELS, TYPE_SHAPES, HOLLOW_TYPES,
  layerFor, loadCorpus, nodeOf, tint,
} from '../data/graphData';
import {
  SPREAD_MIN, SPREAD_MAX, SPREAD_DEFAULT, LAYOUT_PRESETS, applySpacing, applyPreset, linkDistanceFor,
} from '../graph/forces';
import { loadPins, savePins, loadSpread, saveSpread, layoutToJson, parseLayout } from '../graph/pins';

// Edge visual states. Idle edges are quiet ink traces; connected edges take the
// selected node's family color. Derived co-occurrence is quieter than structure.
const EDGE_IDLE      = 'var(--edge)';
const EDGE_DIMMED    = 'var(--edge-dim)';
const EDGE_COOCCUR   = 'var(--edge-co)';
const EDGE_HIERARCHY = 'var(--edge-hier)';

const idleStroke = d => {
  if (d.kind === 'co_occurs') return EDGE_COOCCUR;
  if (d.kind === 'child_of' || d.kind === 'part_of') return EDGE_HIERARCHY;
  return EDGE_IDLE;
};

/** Node radius grows with degree so hubs read as hubs. */
const radiusOf = d => Math.min(17, 4 + Math.sqrt(DEGREE.get(d.id) || 1) * 1.5) + (d.type === 'episode' ? 2 : 0);

/** Minimum degree a node needs for its label to show at a given zoom level. */
const labelMinDegree = k => (k > 2.4 ? 0 : k > 1.6 ? 6 : 16);

const DIM_OPACITY = 0.15;
const TRAIL_KEEP = 5;            // breadcrumb length
const EDGE_HIT_WIDTH = 12;       // px; an edge is a thin line to tap
const SEARCH_MIN_CHARS = 3;      // passage search starts at this many characters
const SEARCH_NODE_RESULTS = 8;
const SEARCH_PASSAGE_RESULTS = 6;
const SNIPPET_SIDE = 50;
const LONG_PRESS_MS = 350;       // hold this long on a node to pick it up on touch
const LONG_PRESS_SLOP_PX = 8;    // moving further than this first means "pan", not "hold"
const DOUBLE_TAP_MS = 300;
const KNOWN_POSITION_SHARE = 0.6; // above this, a rebuild is a gentle settle, not a fresh layout
const SETTLE_ALPHA = 0.3;
const NEW_NODE_JITTER_PX = 4;

const hashId = () => new URLSearchParams(window.location.hash.slice(1)).get('n');

/** Put the selected node in the URL so a selection can be shared and Back undoes it. */
function writeHash(id) {
  const want = id ? `#n=${id}` : '';
  if (window.location.hash === want || (!want && !window.location.hash)) return;
  window.history.pushState(null, '', want || window.location.pathname + window.location.search);
}

const isTyping = target => ['INPUT', 'TEXTAREA'].includes(target?.tagName);

const SHAPE_TYPES = { circle: d3.symbolCircle, diamond: d3.symbolDiamond, square: d3.symbolSquare };

/** Path for a node's body or halo; `grow` adds to the radius so the halo can sit outside it. */
const shapePath = (d, grow = 0) => {
  const r = radiusOf(d) + grow;
  const shape = TYPE_SHAPES[d.type];
  const area = Math.PI * r * r * (shape === 'diamond' ? 1.35 : shape === 'square' ? 0.9 : 1);
  return d3.symbol(SHAPE_TYPES[shape], area)();
};

const restFill = d => (HOLLOW_TYPES.has(d.type) ? 'var(--paper)' : tint(TYPE_COLORS[d.type], 28));

const edgeId = (d, end) => (typeof d[end] === 'object' ? d[end].id : d[end]);

/**
 * Build an adjacency index so neighbour lookup on click is O(1).
 *
 * @param {Array<{source: string, target: string}>} edges Edge list.
 * @returns {Map<string, Set<string>>} Node id → set of adjacent node ids.
 */
function buildAdjacency(edges) {
  const adjacency = new Map();
  const connect = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a).add(b);
  };
  for (const edge of edges) {
    connect(edge.source, edge.target);
    connect(edge.target, edge.source);
  }
  return adjacency;
}

const TOUCH_HIT_RADIUS = 22;      // px; a fingertip is wider than a 4px node
const SELECTION_FIT_PADDING = 56; // px of breathing room around a zoomed selection
const SELECTION_MAX_ZOOM = 2.2;

/** Zoom `svg` so the given nodes fill the area above `bottomInset` px (the sheet). */
function fitNodes(svg, zoom, nodes, W, H, bottomInset = 0) {
  if (!nodes.length) return;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const availH = Math.max(120, H - bottomInset);
  const k = Math.min(
    SELECTION_MAX_ZOOM,
    (W - SELECTION_FIT_PADDING * 2) / Math.max(1, x1 - x0),
    (availH - SELECTION_FIT_PADDING * 2) / Math.max(1, y1 - y0),
  );
  const scale = Math.max(0.3, k);
  const transform = d3.zoomIdentity
    .translate(W / 2, availH / 2)
    .scale(scale)
    .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  svg.transition().duration(450).call(zoom.transform, transform);
}

export default function UlyssesGraph({
  filterType, layer = 'all', minWeight = 3, isMobile = false, sheetInset = 0, onReveal,
}) {
  const svgRef       = useRef(null);
  const nodeGroupRef = useRef(null);
  const linkRef      = useRef(null);
  const simRef       = useRef(null);
  const adjacencyRef = useRef(new Map());
  const nodesRef      = useRef([]);
  const zoomRef       = useRef(1);
  const focusRef      = useRef(new Set());
  const searchRef     = useRef('');
  const zoomBehaviorRef = useRef(null);
  const mobileRef     = useRef({ isMobile, sheetInset });
  mobileRef.current = { isMobile, sheetInset };
  const [selected, setSelected] = useState(null);
  const [neighbors, setNeighbors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [passageResults, setPassageResults] = useState([]);
  const [trail, setTrail] = useState([]);
  const [edgeInfo, setEdgeInfo] = useState(null);
  const [focusedType, setFocusedType] = useState(null);
  const [spread, setSpread] = useState(() => loadSpread(SPREAD_DEFAULT));
  const [preset, setPreset] = useState('free');
  const [frozen, setFrozen] = useState(false);
  const [pinCount, setPinCount] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const selectedRef   = useRef(null);
  const neighborsRef  = useRef([]);
  const pendingRef    = useRef(hashId());
  const cycleRef      = useRef({ landed: null, list: [], index: -1 });
  const revealRef     = useRef(onReveal);
  const positionsRef  = useRef(new Map());   // last known x/y per node id, kept across rebuilds
  const pinnedRef     = useRef(new Map());   // id → {x, y} for nodes the reader placed
  const spreadRef     = useRef(spread);
  const presetRef     = useRef(preset);
  const frozenRef     = useRef(frozen);
  const layerRef      = useRef(layer);
  const labelBucketRef = useRef(null);
  const layoutRef     = useRef(null);        // re-applies preset + spacing to the live simulation
  const reloadPinsRef = useRef(null);
  const unpinRef      = useRef(null);        // (id | null) → unpin one node, or all
  const suppressClickRef = useRef(false);
  const importInputRef = useRef(null);
  spreadRef.current = spread;
  presetRef.current = preset;
  frozenRef.current = frozen;
  layerRef.current = layer;
  selectedRef.current = selected;
  neighborsRef.current = neighbors;
  revealRef.current = onReveal;

  /** Select a node (or clear with null), keeping the trail and the URL hash in step. */
  const choose = useCallback((node, { updateHash = true } = {}) => {
    setEdgeInfo(null);
    setFocusedType(null);
    setSelected(node);
    if (node) setTrail(t => [...t.filter(id => id !== node.id), node.id].slice(-TRAIL_KEEP));
    if (updateHash) writeHash(node?.id ?? null);
  }, []);

  /** Select by id. A node outside the current layer asks the app to switch layers first. */
  const selectById = useCallback((id, options) => {
    const target = nodeOf(id);
    if (!target) return;
    const onScreen = nodesRef.current.find(n => n.id === id);
    if (onScreen) { choose(onScreen, options); return; }
    pendingRef.current = id;
    revealRef.current?.(layerFor(target.type));
  }, [choose]);

  // The layer picks which node types are on screen. A filtered category keeps
  // its own nodes plus every node one edge away, so cross-type relationships
  // stay connected instead of being stranded as isolated dots. Co-occurrence
  // edges below `minWeight` are dropped.
  const { filteredNodes, filteredEdges } = useMemo(() => {
    const layerTypes = new Set(LAYERS.find(l => l.id === layer)?.types ?? LAYERS.at(-1).types);
    const inLayer = NODES.filter(n => layerTypes.has(n.type));
    const layerIds = new Set(inLayer.map(n => n.id));
    const strong = EDGES.filter(
      e => layerIds.has(e.source) && layerIds.has(e.target) && (e.kind !== 'co_occurs' || (e.weight ?? 1) >= minWeight)
    );
    if (!filterType) return { filteredNodes: inLayer, filteredEdges: strong };
    const categoryIds = new Set(inLayer.filter(n => n.type === filterType).map(n => n.id));
    const visible = new Set([
      ...categoryIds,
      ...strong.filter(e => categoryIds.has(e.source) || categoryIds.has(e.target)).flatMap(e => [e.source, e.target]),
    ]);
    return {
      filteredNodes: inLayer.filter(n => visible.has(n.id)),
      filteredEdges: strong.filter(e => visible.has(e.source) && visible.has(e.target)),
    };
  }, [filterType, layer, minWeight]);

  /** Return every node connected to `id` by a single edge. */
  const neighborsOf = useCallback((id) => adjacencyRef.current.get(id) ?? new Set(), []);

  /** Show a label if the node is a hub at this zoom, is in the current selection, or matches the search. */
  const updateLabels = useCallback(() => {
    const nodeGroup = nodeGroupRef.current;
    if (!nodeGroup) return;
    const minDegree = labelMinDegree(zoomRef.current);
    if (labelBucketRef.current !== minDegree) {
      labelBucketRef.current = minDegree;
      layoutRef.current?.({ reheat: false });
    }
    const term = searchRef.current;
    nodeGroup.select('text').attr('display', d =>
      (DEGREE.get(d.id) ?? 0) >= minDegree || focusRef.current.has(d.id) || (term && d.label.toLowerCase().includes(term))
        ? null : 'none'
    );
  }, []);

  /**
   * Paint the full selection state: the clicked node, its direct neighbours and
   * every edge between them stay lit; everything else fades back.
   */
  const applySelection = useCallback((nodeData, onlyType = null) => {
    const nodeGroup = nodeGroupRef.current;
    const link = linkRef.current;
    if (!nodeGroup || !link) return;

    const focusId = nodeData.id;
    const allLinked = neighborsOf(focusId);
    const linked = onlyType ? new Set([...allLinked].filter(id => nodeOf(id)?.type === onlyType)) : allLinked;
    const accent = TYPE_COLORS[nodeData.type];
    focusRef.current = new Set([focusId, ...linked]);

    const isConnected = d => {
      const sid = edgeId(d, 'source');
      const tid = edgeId(d, 'target');
      return (sid === focusId && linked.has(tid)) || (tid === focusId && linked.has(sid));
    };

    link
      .style('stroke', d => (isConnected(d) ? accent : EDGE_DIMMED))
      .attr('stroke-width', d => (isConnected(d) ? 1.75 : 1));

    nodeGroup.attr('opacity', d =>
      d.id === focusId || linked.has(d.id) ? 1 : DIM_OPACITY
    );

    nodeGroup.select('.node-body')
      .style('stroke', d => (d.id === focusId ? 'var(--ink)' : TYPE_COLORS[d.type]))
      .attr('stroke-width', d => {
        if (d.id === focusId) return 3;
        return linked.has(d.id) ? 2 : 1.5;
      })
      .style('fill', d => {
        if (d.id === focusId) return TYPE_COLORS[d.type];
        return linked.has(d.id) ? tint(TYPE_COLORS[d.type], 55) : restFill(d);
      });

    // A static ring marks the focused node: the "you are here" marker.
    nodeGroup.select('.halo')
      .attr('opacity', d => (d.id === focusId ? 1 : 0))
      .style('stroke', accent);

    nodeGroup.select('text')
      .style('fill', d => (d.id === focusId || linked.has(d.id) ? 'var(--ink)' : 'var(--ink-soft)'))
      .attr('font-weight', d => (d.id === focusId || linked.has(d.id) ? 600 : 400));
    updateLabels();
  }, [neighborsOf, updateLabels]);

  /** Return the whole graph to its resting state. */
  const clearSelection = useCallback(() => {
    const nodeGroup = nodeGroupRef.current;
    const link = linkRef.current;
    if (!nodeGroup || !link) return;

    focusRef.current = new Set();
    link
      .style('stroke', idleStroke)
      .attr('stroke-width', 1);

    nodeGroup.attr('opacity', 1);
    nodeGroup.select('.node-body')
      .style('stroke', d => TYPE_COLORS[d.type])
      .attr('stroke-width', 1.5)
      .style('fill', restFill);
    nodeGroup.select('.halo').attr('opacity', 0);
    nodeGroup.select('text')
      .style('fill', 'var(--ink-soft)')
      .attr('font-weight', 400);
    updateLabels();
  }, [updateLabels]);

  useEffect(() => {
    const container = svgRef.current.parentElement;
    const W = container.clientWidth;
    const H = container.clientHeight;

    setSelected(null);
    setFrozen(false);
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', W)
      .attr('height', H);

    const g = svg.append('g');

    zoomRef.current = 1;
    const zoom = d3.zoom().scaleExtent([0.3, 4]).on('zoom', e => {
      g.attr('transform', e.transform);
      zoomRef.current = e.transform.k;
      updateLabels();
    });
    zoomBehaviorRef.current = zoom;
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('dblclick', e => {
      // Double-tap empty canvas to zoom in; nodes handle their own taps.
      if (e.target !== svgRef.current) return;
      svg.transition().duration(250).call(zoom.scaleBy, 1.8, d3.pointer(e, svgRef.current));
    });

    // Data clones. Nodes that were on screen before keep their position, so a filter
    // change settles the layout instead of scrambling it.
    const adjacency = buildAdjacency(filteredEdges);
    const known = positionsRef.current;   // stable Map: also used by the cleanup below
    const nodes = filteredNodes.map(d => ({ ...d }));
    const knownShare = nodes.filter(n => known.has(n.id)).length / Math.max(1, nodes.length);
    nodes.forEach((n, i) => {
      const at = known.get(n.id);
      if (at) { n.x = at.x; n.y = at.y; return; }
      if (knownShare === 0) return;
      const placed = [...(adjacency.get(n.id) ?? [])].map(id => known.get(id)).filter(Boolean);
      const home = placed.length
        ? { x: d3.mean(placed, p => p.x), y: d3.mean(placed, p => p.y) }
        : { x: W / 2, y: H / 2 };
      n.x = home.x + ((i % 7) - 3) * NEW_NODE_JITTER_PX;
      n.y = home.y + ((i % 5) - 2) * NEW_NODE_JITTER_PX;
    });
    const edges = filteredEdges.map(d => ({ ...d }));
    adjacencyRef.current = adjacency;
    nodesRef.current = nodes;

    const radius = radiusOf;
    const byId = new Map(nodes.map(n => [n.id, n]));

    // Pins the reader placed on this layer and preset become fixed positions.
    const pinNode = (n, at) => { n.fx = at.x; n.fy = at.y; n.x = at.x; n.y = at.y; };
    const loadPinsInto = () => {
      pinnedRef.current = loadPins(layerRef.current, presetRef.current);
      for (const [id, at] of pinnedRef.current) { const n = byId.get(id); if (n) pinNode(n, at); }
      setPinCount(pinnedRef.current.size);
    };
    loadPinsInto();

    // Link strength is weight-scaled so co-occurrence edges pull gently. Distances,
    // repulsion, collision and the positioning forces are set by applyLayout below.
    const dense = nodes.length > 100;
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id)
        .distance(linkDistanceFor)
        .strength(d => (d.kind === 'co_occurs' ? 0.05 : 0.3) + Math.min(0.15, (d.weight ?? 1) * 0.02)))
      .force('charge', d3.forceManyBody().distanceMax(700))
      .force('collision', d3.forceCollide())
      .alphaDecay(0.03)
      .velocityDecay(0.4);
    if (knownShare > KNOWN_POSITION_SHARE) sim.alpha(SETTLE_ALPHA);
    simRef.current = sim;

    const applyLayout = ({ reheat = true } = {}) => {
      const { clientWidth: cw, clientHeight: ch } = container;
      applySpacing(sim, {
        spread: spreadRef.current, dense, radiusOf: radius,
        labelMinDegree: labelMinDegree(zoomRef.current),
      });
      applyPreset(sim, presetRef.current, {
        nodes, adjacency, W: cw || W, H: ch || H, spread: spreadRef.current,
        isPinned: id => pinnedRef.current.has(id),
      });
      if (reheat && !frozenRef.current) sim.alpha(Math.max(sim.alpha(), 0.4)).restart();
    };
    layoutRef.current = applyLayout;
    applyLayout({ reheat: false });
    reloadPinsRef.current = () => {
      for (const n of nodes) { n.fx = null; n.fy = null; }
      loadPinsInto();
      markPins();
    };

    const linkHit = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', 'transparent')
      .attr('stroke-width', EDGE_HIT_WIDTH)
      .attr('pointer-events', 'stroke')
      .attr('cursor', 'help')
      .on('click', (e, d) => { e.stopPropagation(); setSelected(null); setEdgeInfo(d); });

    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .style('stroke', idleStroke)
      .attr('stroke-width', 1)
      .attr('stroke-linecap', 'round');
    linkRef.current = link;

    // ── Moving and pinning ──────────────────────────────────────────────────
    // A dragged node keeps its place (fx/fy stay set) and is remembered as a pin.
    // Shift-drag moves the node's direct neighbours with it.
    let nodeGroup = null;
    let dragGroup = [];
    let dragMoved = false;
    const render = () => {
      linkHit
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
    };
    const markPins = () => nodeGroup?.select('.pin-mark').attr('opacity', d => (pinnedRef.current.has(d.id) ? 1 : 0));
    const persistPins = () => {
      savePins(layerRef.current, presetRef.current, pinnedRef.current);
      setPinCount(pinnedRef.current.size);
      markPins();
    };
    const beginDrag = (d, withNeighbours) => {
      const family = withNeighbours ? nodes.filter(n => n !== d && adjacency.get(d.id)?.has(n.id)) : [];
      dragGroup = [d, ...family].map(n => ({
        n, dx: n.x - d.x, dy: n.y - d.y, prevFx: n.fx, prevFy: n.fy,
      }));
      dragMoved = false;
      if (!frozenRef.current) sim.alphaTarget(0.3).restart();
      for (const m of dragGroup) { m.n.fx = m.n.x; m.n.fy = m.n.y; }
    };
    const moveDrag = (d, x, y) => {
      dragMoved = true;
      for (const m of dragGroup) {
        m.n.fx = x + m.dx; m.n.fy = y + m.dy;
        if (frozenRef.current) { m.n.x = m.n.fx; m.n.y = m.n.fy; }
      }
      if (frozenRef.current) render();
    };
    const endDrag = () => {
      if (!frozenRef.current) sim.alphaTarget(0);
      for (const m of dragGroup) {
        if (!dragMoved) { m.n.fx = m.prevFx; m.n.fy = m.prevFy; continue; } // a plain click is not a pin
        pinnedRef.current.set(m.n.id, { x: m.n.fx, y: m.n.fy });
      }
      if (dragMoved) persistPins();
      dragGroup = [];
    };
    const unpin = id => {
      const targets = id ? [byId.get(id)] : nodes;
      for (const n of targets) {
        if (!n) continue;
        n.fx = null; n.fy = null;
        pinnedRef.current.delete(n.id);
      }
      // "Unpin all" also drops pins on nodes a filter is hiding, or they'd return pinned.
      if (!id) pinnedRef.current.clear();
      persistPins();
      applyLayout();   // re-anchors timeline episodes and reheats
    };
    unpinRef.current = unpin;

    nodeGroup = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => `${TYPE_LABELS[d.type]}: ${d.label}`)
      .call(d3.drag()
        // Touch pans the canvas; a long press (below) picks a node up. Mouse drags directly.
        .filter(e => !e.button && !e.type.startsWith('touch'))
        .on('start', (e, d) => beginDrag(d, e.sourceEvent?.shiftKey))
        .on('drag', (e, d) => moveDrag(d, e.x, e.y))
        .on('end', () => endDrag())
      );
    nodeGroupRef.current = nodeGroup;

    // Oversized invisible target so a fingertip can hit small nodes.
    nodeGroup.append('circle')
      .attr('class', 'hit')
      .attr('r', d => Math.max(radius(d), TOUCH_HIT_RADIUS))
      .attr('fill', 'transparent')
      .attr('pointer-events', 'all');

    // Static halo, hidden until the node is the focus of a selection.
    nodeGroup.append('path')
      .attr('class', 'halo')
      .attr('d', d => shapePath(d, 5))
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .attr('pointer-events', 'none');

    nodeGroup.append('path')
      .attr('class', 'node-body')
      .attr('d', d => shapePath(d))
      .style('fill', restFill)
      .style('stroke', d => TYPE_COLORS[d.type])
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', d => (d.thin ? '2 2' : null));

    nodeGroup.append('circle')
      .attr('class', 'pin-mark')
      .attr('r', 3)
      .attr('cx', d => radius(d) * 0.75)
      .attr('cy', d => -radius(d) * 0.75)
      .style('fill', 'var(--ink)')
      .style('stroke', 'var(--paper)')
      .attr('stroke-width', 1)
      .attr('opacity', d => (pinnedRef.current.has(d.id) ? 1 : 0))
      .attr('pointer-events', 'none');

    nodeGroup.append('text')
      .attr('class', 'node-label')
      .text(d => d.type === 'episode' ? d.number || d.label : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => -radius(d) - 6)
      .attr('font-size', d => d.type === 'episode' ? 11 : 10)
      .attr('font-family', 'var(--mono)')
      .style('fill', 'var(--ink-soft)')
      .style('paint-order', 'stroke')
      .style('stroke', 'var(--paper)')
      .attr('stroke-width', 3)
      .attr('pointer-events', 'none');

    // Toggle selection on a node; used by both pointer and keyboard activation.
    // The updater stays pure (no D3 mutation inside it) — the effect below
    // reacts to `selected` and does the actual graph painting.
    const selectNode = d => choose(selectedRef.current?.id === d.id ? null : d);

    // A second tap on a pinned node lets it go. (dblclick is unreliable on touch.)
    let lastTap = { id: null, at: 0 };
    nodeGroup.on('click', (e, d) => {
      e.stopPropagation();
      if (suppressClickRef.current) return;
      const now = Date.now();
      const isSecondTap = lastTap.id === d.id && now - lastTap.at < DOUBLE_TAP_MS;
      lastTap = { id: d.id, at: now };
      if (isSecondTap && pinnedRef.current.has(d.id)) { unpin(d.id); return; }
      selectNode(d);
    });

    // Touch: one finger pans; holding a node for LONG_PRESS_MS picks it up to move.
    const toGraph = touch => {
      const [x, y] = d3.zoomTransform(svgRef.current)
        .invert(d3.pointer(touch, svgRef.current));
      return { x, y };
    };
    let press = null;
    const cancelPress = () => { if (press) clearTimeout(press.timer); press = null; };
    nodeGroup.on('touchstart.press', (e, d) => {
      cancelPress();
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      press = {
        d, from: [touch.clientX, touch.clientY], held: false,
        timer: setTimeout(() => {
          press.held = true;
          navigator.vibrate?.(10);
          beginDrag(d, false);
        }, LONG_PRESS_MS),
      };
    }, { passive: true });
    nodeGroup.on('touchmove.press', e => {
      if (!press) return;
      const touch = e.touches[0];
      if (!press.held) {
        const moved = Math.hypot(touch.clientX - press.from[0], touch.clientY - press.from[1]);
        if (moved > LONG_PRESS_SLOP_PX) cancelPress();
        return;
      }
      e.preventDefault();
      e.stopPropagation();           // keep the canvas from panning while a node is held
      const at = toGraph(touch);
      moveDrag(press.d, at.x, at.y);
    }, { passive: false });
    const releasePress = () => {
      if (press?.held) {
        endDrag();
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
      }
      cancelPress();
    };
    nodeGroup.on('touchend.press touchcancel.press', releasePress);

    nodeGroup.on('keydown', (e, d) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        selectNode(d);
      }
    });

    svg.on('click', () => choose(null));

    sim.on('tick', render);

    sim.on('end.fit', () => {
      sim.on('end.fit', null);
      if (mobileRef.current.isMobile) fitNodes(svg, zoom, nodes, W, H);
    });

    updateLabels();

    // A selection requested by the URL or a search result waits here for its layer to load.
    const wanted = pendingRef.current;
    if (wanted) {
      const target = nodeOf(wanted);
      const onScreen = nodes.find(n => n.id === wanted);
      if (onScreen) { pendingRef.current = null; choose(onScreen); }
      else if (target) revealRef.current?.(layerFor(target.type));
      else pendingRef.current = null;
    }
    return () => {
      for (const n of nodes) known.set(n.id, { x: n.x, y: n.y });
      cancelPress();
      sim.stop();
    };
  }, [filteredNodes, filteredEdges, layer, updateLabels, choose]);

  // Paint the current selection. Runs as a side effect of `selected` changing
  // (never inside the setSelected updater itself, which must stay pure).
  useEffect(() => {
    if (!selected) {
      clearSelection();
      setNeighbors([]);
      return;
    }
    applySelection(selected, focusedType);
    setNeighbors(
      nodesRef.current.filter(
        n => n.id !== selected.id && adjacencyRef.current.get(selected.id)?.has(n.id)
      )
    );
  }, [selected, focusedType, applySelection, clearSelection]);

  // On phones, bring the selection into view above the sheet.
  useEffect(() => {
    if (!selected || !mobileRef.current.isMobile || !zoomBehaviorRef.current) return;
    const container = svgRef.current.parentElement;
    const ids = new Set([selected.id, ...(adjacencyRef.current.get(selected.id) ?? [])]);
    fitNodes(
      d3.select(svgRef.current), zoomBehaviorRef.current,
      nodesRef.current.filter(n => ids.has(n.id)),
      container.clientWidth, container.clientHeight, mobileRef.current.sheetInset,
    );
  }, [selected]);

  // Keep the canvas and layout centre in step with the container (rotation, resize).
  useEffect(() => {
    const container = svgRef.current.parentElement;
    const observer = new ResizeObserver(() => {
      const W = container.clientWidth;
      const H = container.clientHeight;
      d3.select(svgRef.current).attr('width', W).attr('height', H);
      if (!simRef.current || !W || !H) return;
      layoutRef.current?.();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Spread: retune the live simulation. Rebuilding would throw every position away.
  useEffect(() => {
    saveSpread(spread);
    layoutRef.current?.();
  }, [spread]);

  // Layout preset: pins belong to a preset, so swap them along with the forces.
  const firstPresetRun = useRef(true);
  useEffect(() => {
    if (firstPresetRun.current) { firstPresetRun.current = false; return; }
    reloadPinsRef.current?.();
    layoutRef.current?.();
  }, [preset]);

  // Freeze: stop the simulation so only the dragged node moves.
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (frozen) sim.stop();
    else sim.alpha(0.3).restart();
  }, [frozen]);

  const exportLayout = () => {
    const svg = svgRef.current;
    const t = d3.zoomTransform(svg);
    const blob = new Blob([layoutToJson({
      layer, preset, spread, pins: pinnedRef.current, zoom: { x: t.x, y: t.y, k: t.k },
    })], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ulysses-layout-${layer}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importLayout = async file => {
    const layout = file && parseLayout(await file.text());
    if (!layout) { window.alert('That file is not a Ulysses graph layout.'); return; }
    savePins(layer, layout.preset, layout.pins);
    if (Number.isFinite(layout.spread)) setSpread(Math.min(SPREAD_MAX, Math.max(SPREAD_MIN, layout.spread)));
    if (layout.preset !== presetRef.current) setPreset(layout.preset);
    else { reloadPinsRef.current?.(); layoutRef.current?.(); }
    const { x, y, k } = layout.zoom ?? {};
    if ([x, y, k].every(Number.isFinite) && zoomBehaviorRef.current) {
      d3.select(svgRef.current).call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(x, y).scale(k));
    }
  };

  // Back/forward follow the URL hash; Esc clears; ← → step through the selection's neighbours.
  useEffect(() => {
    const onPop = () => {
      const id = hashId();
      if (id) selectById(id, { updateHash: false });
      else choose(null, { updateHash: false });
    };
    const onKey = e => {
      if (isTyping(e.target)) return;
      if (e.key === 'Escape') { choose(null); return; }
      const current = selectedRef.current;
      if (current && (e.key === 'u' || e.key === 'U')) { unpinRef.current?.(current.id); return; }
      if (!current || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      // Keep cycling the neighbours of the node the walk started from, not of the one just reached.
      const cycle = cycleRef.current;
      if (cycle.landed !== current.id) Object.assign(cycle, { list: neighborsRef.current, index: -1 });
      if (!cycle.list.length) return;
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      cycle.index = (cycle.index + step + cycle.list.length) % cycle.list.length;
      cycle.landed = cycle.list[cycle.index].id;
      selectById(cycle.landed);
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); };
  }, [choose, selectById]);

  // Search highlight
  useEffect(() => {
    if (!nodeGroupRef.current) return;
    const term = searchTerm.trim().toLowerCase();
    searchRef.current = term;
    const matches = d => !term || d.label.toLowerCase().includes(term);
    nodeGroupRef.current.select('.node-body')
      .attr('opacity', d => (matches(d) ? 1 : 0.15));
    nodeGroupRef.current.select('text')
      .attr('opacity', d => (matches(d) ? 1 : 0.1));
    updateLabels();
  }, [searchTerm, updateLabels]);

  // Passage search runs over the lazily loaded corpus, so it waits for a few characters.
  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length < SEARCH_MIN_CHARS) { setPassageResults([]); return undefined; }
    let live = true;
    loadCorpus().then(corpus => {
      if (!live) return;
      const found = [];
      for (const block of corpus.blocks) {
        if (block.kind === 'c') continue;
        const text = block.paras.join(' ').replace(/\s+/g, ' ');
        const at = text.toLowerCase().indexOf(term);
        if (at < 0) continue;
        found.push({
          nodeId: block.kind === 'q' ? `p-${block.id}` : `an-${block.id}`,
          label: block.label,
          snippet: text.slice(Math.max(0, at - SNIPPET_SIDE), at + term.length + SNIPPET_SIDE),
        });
        if (found.length >= SEARCH_PASSAGE_RESULTS) break;
      }
      setPassageResults(found);
    });
    return () => { live = false; };
  }, [searchTerm]);

  const nodeResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return NODES.filter(n => n.type !== 'passage' && n.label.toLowerCase().includes(term))
      .slice(0, SEARCH_NODE_RESULTS);
  }, [searchTerm]);

  const openResult = id => { setSearchTerm(''); selectById(id); };

  return (
    <div className="relative w-full h-full canvas">
      {/* Search */}
      <div className={`absolute top-3 left-3 z-30 ${isMobile ? 'right-24' : 'w-72'}`}>
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search nodes and passages"
          className="input w-full"
          type="search"
        />
        {(nodeResults.length > 0 || passageResults.length > 0) && (
          <div className="panel mt-1 max-h-[50vh] overflow-y-auto p-2 text-sm">
            {nodeResults.length > 0 && <div className="eyebrow mb-1">Nodes</div>}
            {nodeResults.map(n => (
              <button key={n.id} className="block w-full text-left py-1.5 min-h-8" onClick={() => openResult(n.id)}>
                <span style={{ color: TYPE_COLORS[n.type] }}>{n.label}</span>
                <span className="mono text-[11px] soft"> · {TYPE_LABELS[n.type]}</span>
              </button>
            ))}
            {passageResults.length > 0 && <div className="eyebrow mt-2 mb-1">Passages</div>}
            {passageResults.map(r => (
              <button key={r.nodeId} className="block w-full text-left py-1.5" onClick={() => openResult(r.nodeId)}>
                <span className="mono text-[11px] soft">{r.label}</span>
                <span className="block italic">…{r.snippet}…</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <svg ref={svgRef} className="w-full h-full relative z-10" />

      {/* Layout tools */}
      <div className={`absolute z-30 flex flex-col gap-2 ${isMobile ? 'right-3 top-14 items-end' : 'left-3 bottom-3 items-start'}`}>
        <button className="chip" aria-pressed={toolsOpen} onClick={() => setToolsOpen(o => !o)}>
          Layout{pinCount ? ` · ${pinCount} pinned` : ''}
        </button>
        {toolsOpen && (
          <div className="panel p-3 flex flex-col gap-3 text-sm" style={{ maxWidth: 'min(18rem, 90vw)' }}>
            <label className="flex items-center gap-2 mono text-xs soft"
              title="Push nodes apart or pull them together">
              Spread {spread.toFixed(1)}×
              <input type="range" min={SPREAD_MIN} max={SPREAD_MAX} step="0.1" value={spread}
                onChange={e => setSpread(Number(e.target.value))} className="w-28" />
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Arrangement">
              {LAYOUT_PRESETS.map(p => (
                <button key={p.id} className="chip" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="chip" aria-pressed={frozen} onClick={() => setFrozen(f => !f)}
                title="Stop the layout moving; only the node you drag moves">
                Freeze
              </button>
              <button className="chip" disabled={!pinCount} onClick={() => unpinRef.current?.(null)}
                title="Release every pinned node. The rest still drift toward the middle.">
                Unpin all
              </button>
              <button className="chip" onClick={exportLayout}>Export</button>
              <button className="chip" onClick={() => importInputRef.current?.click()}>Import</button>
              <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden"
                onChange={e => { importLayout(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <p className="mono text-[11px] soft m-0">
              Drop a node to pin it · double-tap a pinned node or press U to release
              {isMobile ? ' · hold a node to move it' : ' · Shift-drag moves its neighbours too'}
            </p>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <NodePanel
          mobile={isMobile}
          node={selected}
          neighbors={neighbors}
          trail={trail}
          onSelect={selectById}
          onClose={() => choose(null)}
          onFocusGroup={setFocusedType}
          focusedType={focusedType}
        />
      )}
      {edgeInfo && <EdgeCard edge={edgeInfo} onSelect={selectById} onClose={() => setEdgeInfo(null)} />}
    </div>
  );
}
