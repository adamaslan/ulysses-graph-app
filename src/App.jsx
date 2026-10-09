import { useEffect, useState } from 'react';
import UlyssesGraph from './components/UlyssesGraph';
import { NODES, EDGES, LAYERS, TYPE_COLORS, TYPE_LABELS, TYPE_SHAPES } from './data/graphData';

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
    setFilterType, setMinWeight,
  };
}

function Controls({ controls, compact = false }) {
  const { layer, filterType, minWeight, types, chooseLayer, setFilterType, setMinWeight } = controls;
  return (
    <div className={`flex items-center gap-2 flex-wrap ${compact ? 'justify-center' : ''}`}>
      {!compact && <span className="eyebrow mr-1">Layer</span>}
      {LAYERS.map(l => (
        <button key={l.id} onClick={() => chooseLayer(l.id)} className="chip" aria-pressed={layer === l.id}>
          {l.label}
        </button>
      ))}
      <span className="mx-1 soft" aria-hidden="true">·</span>
      {[null, ...types].map(f => (
        <button key={f ?? 'all'} onClick={() => setFilterType(f)} className="chip"
          aria-pressed={filterType === f} style={f ? { '--accent': TYPE_COLORS[f] } : undefined}>
          {f ? TYPE_LABELS[f] + 's' : 'All'}
        </button>
      ))}
      <label className="flex items-center gap-2 mono text-xs soft ml-2"
        title="Hide co-occurrence edges shared by fewer passages than this">
        co-occurs ≥ {minWeight}
        <input type="range" min="1" max="8" value={minWeight}
          onChange={e => setMinWeight(Number(e.target.value))} className="w-24" />
      </label>
    </div>
  );
}

export default function App() {
  const controls = useGraphControls();
  const [theme, cycleTheme] = useTheme();
  const [fullscreen, setFullscreen] = useState(false);
  const graph = (
    <UlyssesGraph filterType={controls.filterType} layer={controls.layer} minWeight={controls.minWeight} />
  );
  const themeButton = (
    <button onClick={cycleTheme} className="chip" aria-label="Change colour theme">Theme: {theme}</button>
  );

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
          {NODES.length} nodes · {EDGES.length} edges · click a node for its quotes and connections · drag · scroll to zoom
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12 grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.keys(TYPE_COLORS).map(type => (
          <LegendCard key={type} type={type}
            title={`${COUNTS[type] ?? 0} ${TYPE_LABELS[type]}s`} desc={LEGEND_DESC[type]} />
        ))}
      </div>
    </div>
  );
}

const SHAPE_GLYPH = { circle: '●', diamond: '◆', square: '■' };

function LegendCard({ type, title, desc }) {
  const color = TYPE_COLORS[type];
  return (
    <div className="legend-card" style={{ '--accent': color }}>
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden="true" style={{ color }}>{SHAPE_GLYPH[TYPE_SHAPES[type]]}</span>
        <span className="mono font-semibold text-xs" style={{ color }}>{title}</span>
      </div>
      <p className="text-sm soft">{desc}</p>
    </div>
  );
}
