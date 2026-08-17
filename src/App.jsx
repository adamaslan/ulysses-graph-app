import { useState } from 'react';
import UlyssesGraph from './components/UlyssesGraph';
import { NODES, TYPE_COLORS, TYPE_LABELS } from './data/graphData';

const COUNTS = NODES.reduce((acc, n) => {
  acc[n.type] = (acc[n.type] || 0) + 1;
  return acc;
}, {});

const FILTERS = [null, 'episode', 'character', 'theme', 'place'];

/** Filter pill styling — neon outline when active, ghosted cyan when not. */
function chipStyle(active, type) {
  const color = type ? TYPE_COLORS[type] : '#00f0ff';
  return active
    ? { borderColor: color, color, backgroundColor: color + '14', boxShadow: `0 0 12px ${color}55` }
    : { borderColor: 'rgba(0,240,255,0.18)', color: 'rgba(0,240,255,0.45)', backgroundColor: 'transparent' };
}

export default function App() {
  const [filterType, setFilterType] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  if (fullscreen) {
    return (
      <div className="w-full h-screen relative cyber-canvas">
        <UlyssesGraph filterType={filterType} />
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f ?? 'all'}
              onClick={() => setFilterType(f)}
              className="cyber-chip text-[10px] px-3 py-1"
              style={{ ...chipStyle(filterType === f, f), backgroundColor: '#05060acc' }}
            >
              {f ? TYPE_LABELS[f] + 's' : 'All'}
            </button>
          ))}
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

      {/* Filter bar */}
      <div className="px-6 py-3 flex items-center gap-2 border-b flex-wrap" style={{ borderColor: 'rgba(0,240,255,0.12)' }}>
        <span className="text-[10px] font-mono uppercase tracking-widest mr-1" style={{ color: 'rgba(0,240,255,0.35)' }}>
          Filter:
        </span>
        {FILTERS.map(f => (
          <button
            key={f ?? 'all'}
            onClick={() => setFilterType(f)}
            className="cyber-chip text-[10px] px-3 py-1"
            style={chipStyle(filterType === f, f)}
          >
            {f ? TYPE_LABELS[f] + 's' : 'All'}
          </button>
        ))}
        <div className="ml-auto flex gap-4 text-[10px] font-mono uppercase tracking-wider">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1.5" style={{ color: color + 'aa' }}>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
              />
              {TYPE_LABELS[type]}
            </span>
          ))}
        </div>
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
          <UlyssesGraph filterType={filterType} />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] mt-3 text-center" style={{ color: 'rgba(0,240,255,0.3)' }}>
          Click a node to trace its connections · drag to rearrange · scroll to zoom
        </p>
      </div>

      {/* Legend cards */}
      <div className="max-w-6xl mx-auto px-4 pb-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <LegendCard color={TYPE_COLORS.episode} title={`${COUNTS.episode} Episodes`} desc="Each chapter — June 16, 1904" />
        <LegendCard color={TYPE_COLORS.character} title={`${COUNTS.character} Characters`} desc="From Bloom and Stephen to the Citizen" />
        <LegendCard color={TYPE_COLORS.theme} title={`${COUNTS.theme} Themes`} desc="Guilt, desire, fatherhood, language and more" />
        <LegendCard color={TYPE_COLORS.place} title={`${COUNTS.place} Places`} desc="Martello Tower to Nighttown" />
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
