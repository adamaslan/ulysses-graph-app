import { useEffect, useState } from 'react';
import UlyssesGraph from './components/UlyssesGraph';
import ListView from './components/ListView';
import { useMediaQuery } from './hooks';
import { SHEET_PEEK_SHARE as PEEK_SHARE } from './components/NodePanel';
import {
  NODES, CORE_NODE_COUNT, CORE_EDGE_COUNT, LAYERS, TYPE_COLORS, TYPE_LABELS, TYPE_SHAPES, layerFor,
} from './data/graphData';

const COUNTS = NODES.reduce((acc, n) => {
  acc[n.type] = (acc[n.type] || 0) + 1;
  return acc;
}, {});

const LEGEND_DESC = {
  episode: 'Each chapter, June 16, 1904',
  part: 'Telemachiad, Odyssey, Nostos',
  character: 'Bloom and Stephen to the Citizen and Bello',
  theme: '8 root themes, 36 sub-themes',
  place: 'Martello Tower to Nighttown',
  motif: 'Recurring images mined from the notes',
  analysis: 'Pasted analyses and cross-cutting essays',
  technique: 'The style each episode is written in',
  correspondence: 'The Homeric figures',
  schema: 'The Gilbert schema “art” of each episode',
  passage: 'Each quoted passage, in the Passages layer',
};

const MOTIF_NOTE =
  'Motifs are mined from the notes file. Episodes 6, 7, 9 and 10 have no captured Joyce passages, ' +
  'so no motif reaches them. That reflects the notes, not the novel.';

const THEMES = ['system', 'light', 'dark'];

/** Cycle system → light → dark. The choice is kept per viewer; storage may be blocked. */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('ulysses-theme') || 'system'; } catch { return 'system'; }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try { localStorage.setItem('ulysses-theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);
  return [theme, () => setTheme(t => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length])];
}

function useGraphControls() {
  const [layer, setLayer] = useState('core');
  const [filterType, setFilterType] = useState(null);
  const [minWeight, setMinWeight] = useState(3);
  const types = LAYERS.find(l => l.id === layer).types;
  return {
    layer, filterType, minWeight, types,
    chooseLayer: id => { setLayer(id); setFilterType(null); },
    /** Filter to one node type, switching layer first if the current one can't show it. */
    showType: type => {
      if (!types.includes(type)) setLayer(layerFor(type));
      setFilterType(type);
    },
    setFilterType, setMinWeight,
  };
}

function LayerChips({ controls }) {
  return LAYERS.map(l => (
    <button key={l.id} onClick={() => controls.chooseLayer(l.id)} className="chip shrink-0"
      aria-pressed={controls.layer === l.id}>
      {l.label}
    </button>
  ));
}

function TypeChips({ controls }) {
  return [null, ...controls.types].map(f => (
    <button key={f ?? 'all'} onClick={() => controls.setFilterType(f)} className="chip"
      aria-pressed={controls.filterType === f} style={f ? { '--accent': TYPE_COLORS[f] } : undefined}>
      {f ? TYPE_LABELS[f] + 's' : 'All'}
    </button>
  ));
}

function WeightSlider({ controls }) {
  return (
    <label className="flex items-center gap-2 mono text-xs soft"
      title="Hide co-occurrence edges shared by fewer passages than this">
      co-occurs ≥ {controls.minWeight}
      <input type="range" min="1" max="8" value={controls.minWeight}
        onChange={e => controls.setMinWeight(Number(e.target.value))} className="w-28" />
    </label>
  );
}

function Controls({ controls, compact = false }) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${compact ? 'justify-center' : ''}`}>
      {!compact && <span className="eyebrow mr-1">Layer</span>}
      <LayerChips controls={controls} />
      <span className="mx-1 soft" aria-hidden="true">·</span>
      <TypeChips controls={controls} />
      <span className="ml-2"><WeightSlider controls={controls} /></span>
    </div>
  );
}

/** Phone layout: the graph fills the screen; filters live in a sheet. */
function MobileApp({ controls, theme, cycleTheme, openList }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <div className="canvas flex flex-col" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--rule)' }}>
        <h1 className="title text-xl m-0 mr-auto">Ulysses</h1>
        <button className="chip" onClick={openList}>List</button>
        <button className="chip" onClick={cycleTheme} aria-label="Change colour theme">{theme}</button>
        <button className="chip" onClick={() => setFiltersOpen(true)}>Filters</button>
      </div>
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b" style={{ borderColor: 'var(--rule)' }}>
        <LayerChips controls={controls} />
      </div>
      <div className="relative flex-1 min-h-0">
        <UlyssesGraph
          filterType={controls.filterType} layer={controls.layer} minWeight={controls.minWeight}
          onReveal={controls.chooseLayer}
          isMobile sheetInset={PEEK_SHARE * window.innerHeight}
        />
      </div>
      {filtersOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)}>
          <div className="panel fixed inset-x-0 bottom-0 rounded-b-none rounded-t-xl p-4 flex flex-col gap-3"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}>
            <div className="eyebrow">Show</div>
            <div className="flex flex-wrap gap-2"><TypeChips controls={controls} /></div>
            <WeightSlider controls={controls} />
            {controls.types.includes('motif') && (
              <p className="mono text-xs m-0" style={{ color: 'var(--warn)' }}>{MOTIF_NOTE}</p>
            )}
            <button className="chip self-start" onClick={() => setFiltersOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const controls = useGraphControls();
  const [theme, cycleTheme] = useTheme();
  const [fullscreen, setFullscreen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [view, setView] = useState('graph');
  const graph = (
    <UlyssesGraph filterType={controls.filterType} layer={controls.layer} minWeight={controls.minWeight}
      onReveal={controls.chooseLayer} />
  );
  const showOnGraph = id => {
    window.history.pushState(null, '', `#n=${id}`);
    setView('graph');
  };
  const themeButton = (
    <button onClick={cycleTheme} className="chip" aria-label="Change colour theme">Theme: {theme}</button>
  );

  if (view === 'list') {
    return (
      <div className="min-h-screen canvas" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'var(--rule)' }}>
          <h1 className="title text-xl m-0 mr-auto">Ulysses, as a list</h1>
          {themeButton}
          <button className="chip" onClick={() => setView('graph')}>Graph</button>
        </div>
        <ListView onShow={showOnGraph} />
      </div>
    );
  }

  if (isMobile) {
    return <MobileApp controls={controls} theme={theme} cycleTheme={cycleTheme} openList={() => setView('list')} />;
  }

  if (fullscreen) {
    return (
      <div className="w-full h-screen relative canvas">
        {graph}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[70%]">
          <Controls controls={controls} compact />
        </div>
        <button className="chip absolute bottom-5 right-5 z-30" onClick={() => setFullscreen(false)}>
          ← Exit
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen canvas">
      <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b" style={{ borderColor: 'var(--rule)' }}>
        <div className="eyebrow">James Joyce · 1922</div>
        <h1 className="title text-3xl m-0">Ulysses, as a graph</h1>
        <div className="flex gap-2">
          {themeButton}
          <button onClick={() => setView('list')} className="chip">List</button>
          <button onClick={() => setFullscreen(true)} className="chip">Fullscreen ↗</button>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-3 border-b" style={{ borderColor: 'var(--rule)' }}>
        <Controls controls={controls} />
        {controls.types.includes('motif') && (
          <p className="mono text-xs mt-2" style={{ color: 'var(--warn)' }}>{MOTIF_NOTE}</p>
        )}
      </div>

      <div className="mx-auto px-4 py-6 max-w-6xl">
        <div className="overflow-hidden border rounded" style={{ height: '72vh', borderColor: 'var(--rule)' }}>
          {graph}
        </div>
        <p className="mono text-xs soft mt-3 text-center">
          <button className="underline" onClick={() => setView('list')}>
            {CORE_NODE_COUNT} nodes · {CORE_EDGE_COUNT} edges
          </button>
          {' '}· click a node for its quotes and connections · click an edge to see why it links · drag · scroll to zoom · Esc clears
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12 grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.keys(TYPE_COLORS).map(type => (
          <LegendCard key={type} type={type}
            title={`${COUNTS[type] ?? 0} ${TYPE_LABELS[type]}s`} desc={LEGEND_DESC[type]}
            onPick={() => controls.showType(type)} />
        ))}
      </div>
    </div>
  );
}

const SHAPE_GLYPH = { circle: '●', diamond: '◆', square: '■' };

function LegendCard({ type, title, desc, onPick }) {
  const color = TYPE_COLORS[type];
  return (
    <button type="button" className="legend-card text-left" style={{ '--accent': color }} onClick={onPick}
      title={`Show only ${title.toLowerCase()}`}>
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden="true" style={{ color }}>{SHAPE_GLYPH[TYPE_SHAPES[type]]}</span>
        <span className="mono font-semibold text-xs" style={{ color }}>{title}</span>
      </div>
      <p className="text-sm soft">{desc}</p>
    </button>
  );
}
