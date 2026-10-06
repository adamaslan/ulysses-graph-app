import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import NodePanel from './NodePanel';
import { NODES, EDGES, DEGREE, LAYERS, TYPE_COLORS, TYPE_LABELS } from '../data/graphData';

// Edge visual states. Idle edges are barely-there cyan traces; connected edges
// blaze in the selected node's own hue.
const EDGE_IDLE   = '#00f0ff20';
const EDGE_DIMMED  = '#00f0ff08';
const EDGE_COOCCUR = '#ff2bd61c';   // derived co-occurrence: present, but quieter than structural edges
const EDGE_HIERARCHY = '#ff9f1a40'; // sub-theme and part membership

const idleStroke = d => {
  if (d.kind === 'co_occurs') return EDGE_COOCCUR;
  if (d.kind === 'child_of' || d.kind === 'part_of') return EDGE_HIERARCHY;
  return EDGE_IDLE;
};

/** Node radius grows with degree so hubs read as hubs. */
const radiusOf = d => Math.min(17, 4 + Math.sqrt(DEGREE.get(d.id) || 1) * 1.5) + (d.type === 'episode' ? 2 : 0);

/** Minimum degree a node needs for its label to show at a given zoom level. */
const labelMinDegree = k => (k > 2.4 ? 0 : k > 1.6 ? 6 : 16);

const DIM_OPACITY = 0.12;

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

export default function UlyssesGraph({ filterType, layer = 'all', minWeight = 3 }) {
  const svgRef       = useRef(null);
  const nodeGroupRef = useRef(null);
  const linkRef      = useRef(null);
  const simRef       = useRef(null);
  const adjacencyRef = useRef(new Map());
  const nodesRef      = useRef([]);
  const zoomRef       = useRef(1);
  const focusRef      = useRef(new Set());
  const searchRef     = useRef('');
  const [selected, setSelected] = useState(null);
  const [neighbors, setNeighbors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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
  const applySelection = useCallback((nodeData) => {
    const nodeGroup = nodeGroupRef.current;
    const link = linkRef.current;
    if (!nodeGroup || !link) return;

    const focusId = nodeData.id;
    const linked = neighborsOf(focusId);
    const accent = TYPE_COLORS[nodeData.type];
    focusRef.current = new Set([focusId, ...linked]);

    const isConnected = d => {
      const sid = edgeId(d, 'source');
      const tid = edgeId(d, 'target');
      return sid === focusId || tid === focusId;
    };

    link
      .attr('stroke', d => (isConnected(d) ? accent : EDGE_DIMMED))
      .attr('stroke-width', d => (isConnected(d) ? 2 : 1))
      .attr('stroke-opacity', d => (isConnected(d) ? 0.95 : 1))
      .attr('filter', d => (isConnected(d) ? 'url(#neon)' : null))
      .attr('stroke-dasharray', d => (isConnected(d) ? '6 6' : null))
      .classed('edge-flow', isConnected);

    nodeGroup.attr('opacity', d =>
      d.id === focusId || linked.has(d.id) ? 1 : DIM_OPACITY
    );

    nodeGroup.select('.node-body')
      .attr('stroke', d => (d.id === focusId ? '#ffffff' : TYPE_COLORS[d.type]))
      .attr('stroke-width', d => {
        if (d.id === focusId) return 3;
        return linked.has(d.id) ? 2.5 : 1.5;
      })
      .attr('fill', d => {
        if (d.id === focusId) return TYPE_COLORS[d.type] + 'aa';
        return linked.has(d.id) ? TYPE_COLORS[d.type] + '44' : TYPE_COLORS[d.type] + '18';
      })
      .attr('filter', d =>
        d.id === focusId || linked.has(d.id) ? 'url(#neon)' : null
      );

    // Halo ring pulses only around the focused node.
    nodeGroup.select('.halo')
      .attr('opacity', d => (d.id === focusId ? 1 : 0))
      .attr('stroke', accent);

    nodeGroup.select('text')
      .attr('fill', d => (d.id === focusId ? '#ffffff' : TYPE_COLORS[d.type]))
      .attr('font-weight', d => (d.id === focusId || linked.has(d.id) ? 700 : 400));
    updateLabels();
  }, [neighborsOf, updateLabels]);

  /** Return the whole graph to its resting state. */
  const clearSelection = useCallback(() => {
    const nodeGroup = nodeGroupRef.current;
    const link = linkRef.current;
    if (!nodeGroup || !link) return;

    focusRef.current = new Set();
    link
      .attr('stroke', idleStroke)
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 1)
      .attr('filter', null)
      .attr('stroke-dasharray', null)
      .classed('edge-flow', false);

    nodeGroup.attr('opacity', 1);
    nodeGroup.select('.node-body')
      .attr('stroke', d => TYPE_COLORS[d.type])
      .attr('stroke-width', 1.5)
      .attr('fill', d => TYPE_COLORS[d.type] + '18')
      .attr('filter', null);
    nodeGroup.select('.halo').attr('opacity', 0);
    nodeGroup.select('text')
      .attr('fill', d => TYPE_COLORS[d.type])
      .attr('font-weight', 400);
    updateLabels();
  }, [updateLabels]);

  useEffect(() => {
    const container = svgRef.current.parentElement;
    const W = container.clientWidth;
    const H = container.clientHeight;

    setSelected(null);
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', W)
      .attr('height', H);

    // ── Defs: neon bloom filter + grid pattern ───────────────────────────────
    const defs = svg.append('defs');

    const neon = defs.append('filter')
      .attr('id', 'neon')
      .attr('x', '-80%').attr('y', '-80%')
      .attr('width', '260%').attr('height', '260%');
    neon.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'blur1');
    neon.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '8').attr('result', 'blur2');
    const neonMerge = neon.append('feMerge');
    neonMerge.append('feMergeNode').attr('in', 'blur2');
    neonMerge.append('feMergeNode').attr('in', 'blur1');
    neonMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const grid = defs.append('pattern')
      .attr('id', 'cybergrid')
      .attr('width', 40).attr('height', 40)
      .attr('patternUnits', 'userSpaceOnUse');
    grid.append('path')
      .attr('d', 'M40 0 L0 0 0 40')
      .attr('fill', 'none')
      .attr('stroke', '#00f0ff')
      .attr('stroke-opacity', 0.06)
      .attr('stroke-width', 1);

    svg.append('rect')
      .attr('width', W).attr('height', H)
      .attr('fill', 'url(#cybergrid)')
      .attr('pointer-events', 'none');

    const g = svg.append('g');

    zoomRef.current = 1;
    svg.call(d3.zoom().scaleExtent([0.3, 4]).on('zoom', e => {
      g.attr('transform', e.transform);
      zoomRef.current = e.transform.k;
      updateLabels();
    }));

    // Data clones
    const nodes = filteredNodes.map(d => ({ ...d }));
    const edges = filteredEdges.map(d => ({ ...d }));
    adjacencyRef.current = buildAdjacency(filteredEdges);
    nodesRef.current = nodes;

    const radius = radiusOf;

    // Forces tuned for ~230 nodes / ~1,600 edges: weaker charge and shorter links
    // than the original 58-node layout, weight-scaled link strength so
    // co-occurrence edges pull gently, and a mild pull to the centre so
    // unconnected clusters do not drift off screen.
    const dense = nodes.length > 100;
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id)
        .distance(dense ? 75 : 80)
        .strength(d => (d.kind === 'co_occurs' ? 0.05 : 0.3) + Math.min(0.15, (d.weight ?? 1) * 0.02)))
      .force('charge', d3.forceManyBody().strength(dense ? -260 : -180).distanceMax(700))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('x', d3.forceX(W / 2).strength(0.045))
      .force('y', d3.forceY(H / 2).strength(0.045))
      .force('collision', d3.forceCollide().radius(d => radius(d) + 4))
      .alphaDecay(0.03)
      .velocityDecay(0.4);
    simRef.current = sim;

    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', idleStroke)
      .attr('stroke-width', 1)
      .attr('stroke-linecap', 'round');
    linkRef.current = link;

    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => `${TYPE_LABELS[d.type]}: ${d.label}`)
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );
    nodeGroupRef.current = nodeGroup;

    // Pulsing halo, hidden until the node is the focus of a selection.
    nodeGroup.append('circle')
      .attr('class', 'halo node-halo')
      .attr('r', d => radius(d) + 8)
      .attr('fill', 'none')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .attr('pointer-events', 'none');

    nodeGroup.append('circle')
      .attr('class', 'node-body')
      .attr('r', radius)
      .attr('fill', d => TYPE_COLORS[d.type] + '18')
      .attr('stroke', d => TYPE_COLORS[d.type])
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', d => (d.thin ? '2 2' : null));

    nodeGroup.append('text')
      .attr('class', 'node-label')
      .text(d => d.type === 'episode' ? d.number || d.label : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => -radius(d) - 6)
      .attr('font-size', d => d.type === 'episode' ? 9 : 8)
      .attr('font-family', 'ui-monospace, Consolas, monospace')
      .attr('letter-spacing', '0.5')
      .attr('fill', d => TYPE_COLORS[d.type])
      .attr('pointer-events', 'none');

    // Toggle selection on a node; used by both pointer and keyboard activation.
    // The updater stays pure (no D3 mutation inside it) — the effect below
    // reacts to `selected` and does the actual graph painting.
    const selectNode = d => {
      setSelected(prev => (prev?.id === d.id ? null : d));
    };

    nodeGroup.on('click', (e, d) => {
      e.stopPropagation();
      selectNode(d);
    });

    nodeGroup.on('keydown', (e, d) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        selectNode(d);
      }
    });

    svg.on('click', () => setSelected(null));

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    updateLabels();
    return () => { sim.stop(); };
  }, [filteredNodes, filteredEdges, updateLabels]);

  // Paint the current selection. Runs as a side effect of `selected` changing
  // (never inside the setSelected updater itself, which must stay pure).
  useEffect(() => {
    if (!selected) {
      clearSelection();
      setNeighbors([]);
      return;
    }
    applySelection(selected);
    setNeighbors(
      nodesRef.current.filter(
        n => n.id !== selected.id && adjacencyRef.current.get(selected.id)?.has(n.id)
      )
    );
  }, [selected, applySelection, clearSelection]);

  // Search highlight
  useEffect(() => {
    if (!nodeGroupRef.current) return;
    const term = searchTerm.toLowerCase();
    searchRef.current = term;
    const matches = d => !term || d.label.toLowerCase().includes(term);
    nodeGroupRef.current.select('.node-body')
      .attr('opacity', d => (matches(d) ? 1 : 0.15));
    nodeGroupRef.current.select('text')
      .attr('opacity', d => (matches(d) ? 1 : 0.1));
    updateLabels();
  }, [searchTerm, updateLabels]);

  return (
    <div className="relative w-full h-full cyber-canvas">
      {/* Search */}
      <div className="absolute top-3 left-3 z-20">
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="> search nodes"
          className="cyber-input text-xs px-3 py-1.5 w-52"
        />
      </div>

      <svg ref={svgRef} className="w-full h-full relative z-10" />
      <div className="scanlines" />

      {/* Detail panel */}
      {selected && (
        <NodePanel
          node={selected}
          neighbors={neighbors}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
