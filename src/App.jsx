import { useState } from 'react';
import UlyssesGraph from './components/UlyssesGraph';
import { NODES, EDGES, LAYERS, TYPE_COLORS, TYPE_LABELS } from './data/graphData';

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

/** Filter pill styling — neon outline when active, ghosted cyan when not. */
function chipStyle(active, type) {
  const color = type ? TYPE_COLORS[type] : '#00f0ff';
  return active
    ? { borderColor: color, color, backgroundColor: color + '14', boxShadow: `0 0 12px ${color}55` }
    : { borderColor: 'rgba(0,240,255,0.18)', color: 'rgba(0,240,255,0.45)', backgroundColor: 'transparent' };
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
  const pill = 'cyber-chip text-[10px] px-3 py-1';
  return (
    <div className={`flex items-center gap-2 flex-wrap ${compact ? 'justify-center' : ''}`}>
      {!compact && (
        <span className="text-[10px] font-mono uppercase tracking-widest mr-1" style={{ color: 'rgba(0,240,255,0.35)' }}>
          Layer:
        </span>
      )}
      {LAYERS.map(l => (
        <button key={l.id} onClick={() => chooseLayer(l.id)} className={pill}
          style={{ ...chipStyle(layer === l.id, null), ...(compact ? { backgroundColor: '#05060acc' } : {}) }}>
          {l.label}
        </button>
      ))}
      <span className="mx-1 text-white/10">|</span>
      {[null, ...types].map(f => (
        <button key={f ?? 'all'} onClick={() => setFilterType(f)} className={pill}
          style={{ ...chipStyle(filterType === f, f), ...(compact ? { backgroundColor: '#05060acc' } : {}) }}>
          {f ? TYPE_LABELS[f] + 's' : 'All'}
        </button>
      ))}
      <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider ml-2"
        style={{ color: 'rgba(255,43,214,0.7)' }} title="Hide co-occurrence edges shared by fewer passages than this">
        co-occurs ≥ {minWeight}
        <input type="range" min="1" max="8" value={minWeight}
          onChange={e => setMinWeight(Number(e.target.value))} className="w-24 accent-fuchsia-500" />
      </label>
    </div>
  );
}

export default function App() {
  const controls = useGraphControls();
  const [fullscreen, setFullscreen] = useState(false);
  const graph = (
    <UlyssesGraph filterType={controls.filterType} layer={controls.layer} minWeight={controls.minWeight} />
  );

  if (fullscreen) {
    return (
      <div className="w-full h-screen relative cyber-canvas">
        {graph}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[70%]">
          <Controls controls={controls} compact />
        </div>
        <button
          className="cyber-chip absolute bottom-5 right-5 text-[10px] px-4 py-2 z-30"
          style={chipStyle(false, null)}
          onClick={() => setFullscreen(false)}
        >
          ← Exit
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white cyber-canvas">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'rgba(0,240,255,0.15)' }}>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em]" style={{ color: 'rgba(0,240,255,0.4)' }}>
          James Joyce // 1922
        </div>
        <h1
          className="text-lg font-bold tracking-[0.2em] uppercase font-mono"
          style={{ color: '#00f0ff', textShadow: '0 0 18px #00f0ff66, 1px 0 0 #ff2bd644' }}
        >
          Ulysses · Wiki Graph
        </h1>
        <button
          onClick={() => setFullscreen(true)}
          className="cyber-chip text-[10px] px-3 py-1.5"
          style={chipStyle(false, null)}
        >
          Fullscreen ↗
        </button>
      </div>

      {/* Controls */}
      <div className="px-6 py-3 border-b" style={{ borderColor: 'rgba(0,240,255,0.12)' }}>
        <Controls controls={controls} />
        {controls.types.includes('motif') && (
          <p className="text-[10px] font-mono mt-2" style={{ color: 'rgba(255,92,122,0.7)' }}>{MOTIF_NOTE}</p>
        )}
      </div>

      {/* Graph */}
      <div className="mx-auto px-4 py-6 max-w-6xl">
        <div
          className="overflow-hidden border"
          style={{
            height: '72vh',
            borderColor: 'rgba(0,240,255,0.25)',
            boxShadow: '0 0 40px rgba(0,240,255,0.10), inset 0 0 60px rgba(0,0,0,0.6)',
          }}
        >
          {graph}
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] mt-3 text-center" style={{ color: 'rgba(0,240,255,0.3)' }}>
          {NODES.length} nodes · {EDGES.length} edges · click a node for its quotes and connections · drag · scroll to zoom
        </p>
      </div>

      {/* Legend cards */}
      <div className="max-w-6xl mx-auto px-4 pb-12 grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.keys(TYPE_COLORS).map(type => (
          <LegendCard key={type} color={TYPE_COLORS[type]}
            title={`${COUNTS[type] ?? 0} ${TYPE_LABELS[type]}s`} desc={LEGEND_DESC[type]} />
        ))}
      </div>
    </div>
  );
}

function LegendCard({ color, title, desc }) {
  return (
    <div
      className="p-4 border"
      style={{
        borderColor: color + '33',
        borderLeft: `2px solid ${color}`,
        background: 'linear-gradient(160deg, rgba(16,20,31,0.7), rgba(5,6,10,0.7))',
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
        <span className="font-mono font-semibold text-xs uppercase tracking-wider" style={{ color }}>
          {title}
        </span>
      </div>
      <p className="text-[11px] text-white/40">{desc}</p>
    </div>
  );
}
