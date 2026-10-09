import { useEffect, useRef, useState } from 'react';
import { TYPE_COLORS, TYPE_LABELS, loadCorpus, tint } from '../data/graphData';

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
      className="mono text-[11px] px-2 py-0.5 rounded-full border"
      style={{ color, borderColor: tint(color, 50), backgroundColor: tint(color, 10) }}
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
    <figure className="border-l-2 pl-3 py-1" style={{ borderColor: tint(accent, 45) }}>
      <figcaption className="flex flex-wrap items-center gap-1.5 mb-1">
        <span className="mono text-xs">{block.label}</span>
        {block.flag && <Chip color="var(--warn)" title={block.flagnote}>{FLAG_TEXT[block.flag]}</Chip>}
      </figcaption>
      {shown.map((p, i) => (
        <blockquote key={i} className="text-[15px] leading-relaxed italic whitespace-pre-line mb-2">
          {p}
        </blockquote>
      ))}
      <div className="flex items-center gap-2 mono text-[11px] soft">
        <span>{block.id} · L{block.lines}{block.page ? ` · p.${block.page}` : ''}</span>
        {long && (
          <button className="underline min-h-8 px-1" onClick={() => setOpen(o => !o)}>
            {open ? 'less' : 'more'}
          </button>
        )}
      </div>
      {block.flagnote && <p className="text-xs mt-1" style={{ color: 'var(--warn)' }}>{block.flagnote}</p>}
      {block.source && <p className="mono text-[11px] soft mt-1">Source: {block.source}</p>}
    </figure>
  );
}

function PassageList({ title, blocks, accent }) {
  const [all, setAll] = useState(false);
  if (blocks === null) return <p className="mono text-xs soft">loading text…</p>;
  if (!blocks.length) return null;
  const shown = all ? blocks : blocks.slice(0, QUOTES_SHOWN);
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--rule)' }}>
      <div className="eyebrow mb-2" style={{ color: accent }}>
        {title} ({blocks.length})
      </div>
      <div className="space-y-3">
        {shown.map(b => <Passage key={b.id} block={b} accent={accent} />)}
      </div>
      {blocks.length > QUOTES_SHOWN && (
        <button
          className="chip mt-2"
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
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--rule)' }}>
      <div className="eyebrow mb-2" style={{ color: accent }}>
        {neighbors.length} connection{neighbors.length === 1 ? '' : 's'}
      </div>
      {groups.map(([type, list], i) => (
        <details key={type} open={i === 0 && list.length <= 12} className="mb-1.5">
          <summary
            className="cursor-pointer mono text-xs py-1 select-none"
            style={{ color: TYPE_COLORS[type] }}
          >
            {TYPE_LABELS[type]}s ({list.length})
          </summary>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {list.map(n => (
              <button
                key={n.id}
                onClick={() => onSelect(n)}
                className="chip"
                style={{ '--accent': TYPE_COLORS[n.type], color: TYPE_COLORS[n.type] }}
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

// Bottom-sheet snap heights as a share of the viewport. Peek leaves the selected
// node and its neighbours visible above the sheet.
const SHEET_SNAPS = [0.32, 0.6, 0.92];
export const SHEET_PEEK_SHARE = SHEET_SNAPS[0];
const SWIPE_DISTANCE = 40; // px of vertical drag that counts as a swipe

/** Drag handle for the sheet: tap cycles snaps, swipe up grows, swipe down shrinks or closes. */
function SheetHandle({ snap, setSnap, onClose }) {
  const startY = useRef(null);
  const settle = endY => {
    const dy = endY - startY.current;
    startY.current = null;
    if (Math.abs(dy) < SWIPE_DISTANCE) { setSnap((snap + 1) % SHEET_SNAPS.length); return; }
    if (dy < 0) { setSnap(Math.min(SHEET_SNAPS.length - 1, snap + 1)); return; }
    if (snap === 0) { onClose(); return; }
    setSnap(snap - 1);
  };
  return (
    <button
      type="button"
      aria-label="Resize details"
      className="block w-full pt-2 pb-3 touch-none"
      onPointerDown={e => { startY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerUp={e => startY.current !== null && settle(e.clientY)}
      onPointerCancel={() => { startY.current = null; }}
    >
      <span className="block mx-auto h-1.5 w-12 rounded-full" style={{ background: 'var(--rule)' }} />
    </button>
  );
}

export default function NodePanel({ node, neighbors, onSelect, onClose, mobile = false }) {
  const [snap, setSnap] = useState(0);
  useEffect(() => { setSnap(0); }, [node.id]);
  const accent = TYPE_COLORS[node.type];
  const quotes = useBlocks(node.quotes);
  const notes = useBlocks(node.notes);
  const analysis = useBlocks(node.block ? [node.block] : []);
  const thinReason = node.type === 'motif'
    ? 'thin: Joyce’s text recurs in only 2–3 episodes of the notes'
    : 'thin: no quoted Joyce passage in the notes mentions this';

  return (
    <div
      className={mobile
        ? 'panel fixed inset-x-0 bottom-0 z-30 overflow-y-auto px-4 pb-6 text-sm rounded-b-none rounded-t-xl'
        : 'panel absolute top-3 right-3 z-20 w-[min(30rem,calc(100%-1.5rem))] max-h-[88%] overflow-y-auto p-4 text-sm'}
      style={mobile
        ? { '--accent': accent, height: `${SHEET_SNAPS[snap] * 100}dvh`, paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }
        : { '--accent': accent }}
      onClick={e => e.stopPropagation()}
    >
      {mobile && <SheetHandle snap={snap} setSnap={setSnap} onClose={onClose} />}
      <div className="eyebrow mb-1" style={{ color: accent }}>
        {TYPE_LABELS[node.type]}{node.number ? ` // ${String(node.number).padStart(2, '0')}` : ''}
        {node.parent ? ` // sub-theme` : ''}
      </div>
      <div className="title text-2xl leading-tight mb-2">{node.label}</div>
      {node.thin && <div className="mb-2"><Chip color="var(--warn)">{thinReason}</Chip></div>}
      <div className="text-[15px] leading-relaxed soft">{node.summary}</div>
      {node.setting && <div className="mono text-xs soft mt-1">{node.setting}</div>}

      {node.block && (
        <PassageList title="Full analysis" blocks={analysis} accent={accent} />
      )}
      <PassageList title="Joyce’s text" blocks={quotes} accent={accent} />
      <PassageList title="Commentary" blocks={notes} accent={accent} />
      <Neighbors neighbors={neighbors} accent={accent} onSelect={onSelect} />

      <button
        className="chip mt-4"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}
