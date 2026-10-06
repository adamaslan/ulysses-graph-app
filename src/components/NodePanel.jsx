import { useEffect, useState } from 'react';
import { TYPE_COLORS, TYPE_LABELS, loadCorpus } from '../data/graphData';

const COLLAPSE_AT = 420;   // characters before a passage folds behind "more"
const QUOTES_SHOWN = 4;    // passages shown before "show all"

const FLAG_TEXT = {
  corrected: 'placement corrected',
  inferred: 'placement inferred',
  misattributed: 'analysis names the wrong episode',
};

/** Resolve block ids to corpus blocks; `null` while the corpus is loading. */
function useBlocks(ids) {
  const [blocks, setBlocks] = useState(null);
  const key = (ids ?? []).join(',');
  useEffect(() => {
    let live = true;
    setBlocks(null);
    if (!key) { setBlocks([]); return undefined; }
    loadCorpus().then(corpus => {
      if (live) setBlocks(key.split(',').map(id => corpus.byId.get(id)).filter(Boolean));
    });
    return () => { live = false; };
  }, [key]);
  return blocks;
}

function Chip({ children, color, title }) {
  return (
    <span
      title={title}
      className="text-[9px] px-1.5 py-0.5 rounded-sm font-mono uppercase tracking-wider border"
      style={{ color, borderColor: color + '66', backgroundColor: color + '14' }}
    >
      {children}
    </span>
  );
}

function Passage({ block, accent }) {
  const [open, setOpen] = useState(false);
  const full = block.paras.join('\n\n');
  const long = full.length > COLLAPSE_AT;
  const shown = open || !long ? block.paras : [full.slice(0, COLLAPSE_AT).trimEnd() + '…'];
  return (
    <figure className="border-l-2 pl-3 py-1" style={{ borderColor: accent + '66' }}>
      <figcaption className="flex flex-wrap items-center gap-1.5 mb-1">
        <span className="text-[10px] font-mono text-white/70">{block.label}</span>
        {block.flag && <Chip color="#ffb020" title={block.flagnote}>{FLAG_TEXT[block.flag]}</Chip>}
      </figcaption>
      {shown.map((p, i) => (
        <blockquote key={i} className="text-[11px] leading-relaxed text-white/60 italic whitespace-pre-line mb-1.5">
          {p}
        </blockquote>
      ))}
      <div className="flex items-center gap-2 text-[9px] font-mono text-white/30">
        <span>{block.id} · L{block.lines}{block.page ? ` · p.${block.page}` : ''}</span>
        {long && (
          <button className="underline hover:text-white/70" onClick={() => setOpen(o => !o)}>
            {open ? 'less' : 'more'}
          </button>
        )}
      </div>
      {block.flagnote && <p className="text-[10px] text-amber-300/60 mt-1">{block.flagnote}</p>}
      {block.source && <p className="text-[9px] text-white/30 mt-1">Source: {block.source}</p>}
    </figure>
  );
}

function PassageList({ title, blocks, accent }) {
  const [all, setAll] = useState(false);
  if (blocks === null) return <p className="text-[10px] font-mono text-white/30">loading text…</p>;
  if (!blocks.length) return null;
  const shown = all ? blocks : blocks.slice(0, QUOTES_SHOWN);
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: accent + '33' }}>
      <div className="text-[10px] uppercase tracking-[0.2em] font-mono mb-2" style={{ color: accent }}>
        {title} ({blocks.length})
      </div>
      <div className="space-y-3">
        {shown.map(b => <Passage key={b.id} block={b} accent={accent} />)}
      </div>
      {blocks.length > QUOTES_SHOWN && (
        <button
          className="mt-2 text-[10px] font-mono uppercase tracking-widest text-white/40 hover:text-white/80"
          onClick={() => setAll(a => !a)}
        >
          {all ? 'show fewer' : `show all ${blocks.length}`}
        </button>
      )}
    </div>
  );
}

function Neighbors({ neighbors, accent, onSelect }) {
  const groups = Object.entries(
    neighbors.reduce((acc, n) => ((acc[n.type] ??= []).push(n), acc), {})
  ).sort((a, b) => b[1].length - a[1].length);
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: accent + '33' }}>
      <div className="text-[10px] uppercase tracking-[0.2em] font-mono mb-2" style={{ color: accent }}>
        {neighbors.length} connection{neighbors.length === 1 ? '' : 's'}
      </div>
      {groups.map(([type, list], i) => (
        <details key={type} open={i === 0 && list.length <= 12} className="mb-1.5">
          <summary
            className="cursor-pointer text-[10px] font-mono uppercase tracking-wider select-none"
            style={{ color: TYPE_COLORS[type] }}
          >
            {TYPE_LABELS[type]}s ({list.length})
          </summary>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {list.map(n => (
              <button
                key={n.id}
                onClick={() => onSelect(n)}
                className="text-[10px] px-2 py-0.5 rounded-sm font-mono border hover:brightness-150"
                style={{
                  color: TYPE_COLORS[n.type],
                  borderColor: TYPE_COLORS[n.type] + '55',
                  backgroundColor: TYPE_COLORS[n.type] + '12',
                }}
              >
                {n.label}
              </button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function NodePanel({ node, neighbors, onSelect, onClose }) {
  const accent = TYPE_COLORS[node.type];
  const quotes = useBlocks(node.quotes);
  const notes = useBlocks(node.notes);
  const analysis = useBlocks(node.block ? [node.block] : []);
  const thinReason = node.type === 'motif'
    ? 'thin: Joyce’s text recurs in only 2–3 episodes of the notes'
    : 'thin: no quoted Joyce passage in the notes mentions this';

  return (
    <div
      className="cyber-panel absolute top-3 right-3 z-20 w-[min(30rem,calc(100%-1.5rem))] max-h-[88%] overflow-y-auto p-4 text-sm"
      style={{ '--accent': accent }}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-[10px] uppercase tracking-[0.25em] mb-1 font-mono" style={{ color: accent }}>
        {TYPE_LABELS[node.type]}{node.number ? ` // ${String(node.number).padStart(2, '0')}` : ''}
        {node.parent ? ` // sub-theme` : ''}
      </div>
      <div className="font-bold text-white text-base mb-2 glitch-title">{node.label}</div>
      {node.thin && <div className="mb-2"><Chip color="#ffb020">{thinReason}</Chip></div>}
      <div className="text-white/60 text-xs leading-relaxed">{node.summary}</div>
      {node.setting && <div className="text-[10px] font-mono text-white/30 mt-1">{node.setting}</div>}

      {node.block && (
        <PassageList title="Full analysis" blocks={analysis} accent={accent} />
      )}
      <PassageList title="Joyce’s text" blocks={quotes} accent={accent} />
      <PassageList title="Commentary" blocks={notes} accent={accent} />
      <Neighbors neighbors={neighbors} accent={accent} onSelect={onSelect} />

      <button
        className="mt-3 text-[10px] font-mono uppercase tracking-widest text-white/30 hover:text-white/80 transition"
        onClick={onClose}
      >
        [ x ] close
      </button>
    </div>
  );
}
