import { useEffect, useRef, useState } from 'react';
import { TYPE_COLORS, TYPE_LABELS, EDGE_KINDS, loadCorpus, nodeOf, tint } from '../data/graphData';

const COLLAPSE_AT = 420;   // characters before a passage folds behind "more"
const QUOTES_SHOWN = 4;    // passages shown before "show all"
const SPEAKER_LINES_SHOWN = 6;
const TRAIL_LENGTH = 5;    // recently visited nodes kept in the breadcrumb
const KWIC_SHOWN = 12;

/** Quote Atlas page the block ids deep-link into (`#e11q03`). Empty until it has a stable URL. */
const ATLAS_URL = '';

const FLAG_TEXT = {
  corrected: 'placement corrected',
  inferred: 'placement inferred',
  misattributed: 'analysis names the wrong episode',
};

/** Resolve block ids to corpus blocks; `null` while the corpus is loading. */
export function useBlocks(ids) {
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

/** Cut paragraphs to about `max` characters, keeping paragraph indexes so link offsets stay valid. */
function clipParagraphs(paras, max) {
  const out = [];
  let used = 0;
  for (let i = 0; i < paras.length && used < max; i += 1) {
    const room = max - used;
    const text = paras[i];
    out.push({ index: i, text: text.length > room ? text.slice(0, room).trimEnd() : text, cut: text.length > room });
    used += text.length;
  }
  return out;
}

/** Render one paragraph with each tagged name as a button that selects that node. */
function LinkedText({ text, spans, cut, onSelect }) {
  const parts = [];
  let at = 0;
  for (const [start, end, id] of spans ?? []) {
    if (end > text.length) break;
    if (start > at) parts.push(text.slice(at, start));
    const target = nodeOf(id);
    parts.push(
      <button
        key={`${start}-${id}`}
        type="button"
        className="inline-link"
        style={{ '--accent': TYPE_COLORS[target.type] }}
        title={`${TYPE_LABELS[target.type]}: ${target.label}`}
        onClick={() => onSelect(id)}
      >
        {text.slice(start, end)}
      </button>
    );
    at = end;
  }
  parts.push(text.slice(at));
  return <>{parts}{cut ? '…' : ''}</>;
}

function Passage({ block, accent, onSelect }) {
  const [open, setOpen] = useState(false);
  const long = block.paras.join('\n\n').length > COLLAPSE_AT;
  const shown = open || !long
    ? block.paras.map((text, index) => ({ index, text, cut: false }))
    : clipParagraphs(block.paras, COLLAPSE_AT);
  const spansFor = index => block.links?.find(([i]) => i === index)?.[1];
  const reference = `${block.id} · L${block.lines}${block.page ? ` · p.${block.page}` : ''}`;
  return (
    <figure className="border-l-2 pl-3 py-1" style={{ borderColor: tint(accent, 45) }}>
      <figcaption className="flex flex-wrap items-center gap-1.5 mb-1">
        <span className="mono text-xs">{block.label}</span>
        {block.flag && <Chip color="var(--warn)" title={block.flagnote}>{FLAG_TEXT[block.flag]}</Chip>}
      </figcaption>
      {shown.map(p => (
        <blockquote key={p.index} className="text-[15px] leading-relaxed italic whitespace-pre-line mb-2">
          <LinkedText text={p.text} spans={spansFor(p.index)} cut={p.cut} onSelect={onSelect} />
        </blockquote>
      ))}
      <div className="flex items-center gap-2 mono text-[11px] soft">
        {ATLAS_URL
          ? <a className="underline" href={`${ATLAS_URL}#${block.id}`} target="_blank" rel="noreferrer">{reference}</a>
          : <span>{reference}</span>}
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

export function PassageList({ title, blocks, accent, onSelect }) {
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
        {shown.map(b => <Passage key={b.id} block={b} accent={accent} onSelect={onSelect} />)}
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

function Neighbors({ neighbors, accent, onSelect, onFocusGroup, focusedType }) {
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
          <button className="chip mb-1" aria-pressed={focusedType === type}
            onClick={() => onFocusGroup(focusedType === type ? null : type)}>
            {focusedType === type ? 'show all connections' : 'show only these on the graph'}
          </button>
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

/** A character's own speaker lines, gathered from the corpus. */
function useSpeakerLines(node) {
  const [lines, setLines] = useState(null);
  useEffect(() => {
    let live = true;
    setLines(null);
    if (node.type !== 'character') { setLines([]); return undefined; }
    loadCorpus().then(corpus => {
      if (!live) return;
      const found = [];
      for (const block of corpus.blocks) {
        for (const [who, , text] of block.speakers ?? []) {
          if (who === node.id) found.push({ block: block.id, text });
        }
      }
      setLines(found);
    });
    return () => { live = false; };
  }, [node.id, node.type]);
  return lines;
}

function SpeakerLines({ lines, accent, onSelect }) {
  const [all, setAll] = useState(false);
  if (!lines?.length) return null;
  const shown = all ? lines : lines.slice(0, SPEAKER_LINES_SHOWN);
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--rule)' }}>
      <div className="eyebrow mb-2" style={{ color: accent }}>In their words ({lines.length})</div>
      <ul className="space-y-1.5 list-none p-0 m-0">
        {shown.map((l, i) => (
          <li key={i} className="text-sm italic">
            {l.text}{' '}
            <button className="mono text-[11px] underline not-italic soft" onClick={() => onSelect(`p-${l.block}`)}>
              {l.block}
            </button>
          </li>
        ))}
      </ul>
      {lines.length > SPEAKER_LINES_SHOWN && (
        <button className="chip mt-2" onClick={() => setAll(a => !a)}>
          {all ? 'show fewer' : `show all ${lines.length}`}
        </button>
      )}
    </div>
  );
}

/** Keyword-in-context strip for a motif: every hit with its surroundings, grouped by episode. */
function KwicStrip({ motifId, accent, onSelect }) {
  const [rows, setRows] = useState(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let live = true;
    loadCorpus().then(corpus => { if (live) setRows(corpus.kwic?.[motifId] ?? []); });
    return () => { live = false; };
  }, [motifId]);
  if (!rows?.length) return null;
  const shown = all ? rows : rows.slice(0, KWIC_SHOWN);
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--rule)' }}>
      <div className="eyebrow mb-2" style={{ color: accent }}>In context ({rows.length})</div>
      <ul className="space-y-1.5 list-none p-0 m-0">
        {shown.map(([block, before, hit, after], i) => (
          <li key={i} className="text-sm leading-snug">
            <span className="soft">…{before}</span><strong>{hit}</strong><span className="soft">{after}…</span>{' '}
            <button className="mono text-[11px] underline soft" onClick={() => onSelect(`p-${block}`)}>{block}</button>
          </li>
        ))}
      </ul>
      {rows.length > KWIC_SHOWN && (
        <button className="chip mt-2" onClick={() => setAll(a => !a)}>
          {all ? 'show fewer' : `show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

function Trail({ trail, onSelect }) {
  if (trail.length < 2) return null;
  return (
    <nav aria-label="Recently visited" className="flex flex-wrap items-center gap-1 mb-2 mono text-[11px] soft">
      {trail.slice(-TRAIL_LENGTH).map((id, i, list) => (
        <span key={id} className="flex items-center gap-1">
          {i === list.length - 1
            ? <span className="ink">{nodeOf(id).label}</span>
            : <button className="underline" onClick={() => onSelect(id)}>{nodeOf(id).label}</button>}
          {i < list.length - 1 && <span aria-hidden="true">›</span>}
        </span>
      ))}
    </nav>
  );
}

/** The episode a node belongs to: ‹ previous · next › links, plus a first-seen line for derived nodes. */
function EpisodeStepper({ node, onSelect }) {
  if (node.type !== 'episode') return null;
  const previous = nodeOf(`ep${String(node.number - 1).padStart(2, '0')}`);
  const next = nodeOf(`ep${String(node.number + 1).padStart(2, '0')}`);
  return (
    <div className="flex justify-between gap-2 mb-2">
      {previous ? <button className="chip" onClick={() => onSelect(previous.id)}>‹ {previous.label}</button> : <span />}
      {next ? <button className="chip" onClick={() => onSelect(next.id)}>{next.label} ›</button> : <span />}
    </div>
  );
}

/** One-line facts under the summary: where a node first appears and how many episodes it spans. */
function FirstSeen({ node, onSelect }) {
  const first = node.quotes?.[0];
  if (!first || node.type === 'episode') return null;
  return (
    <p className="mono text-xs soft mt-1">
      first seen in{' '}
      <button className="underline" onClick={() => onSelect(`p-${first}`)}>{first}</button>
    </p>
  );
}

function EdgeCard({ edge, onSelect, onClose }) {
  const from = nodeOf(edge.source.id ?? edge.source);
  const to = nodeOf(edge.target.id ?? edge.target);
  return (
    <div className="panel absolute bottom-3 left-3 z-20 w-[min(24rem,calc(100%-1.5rem))] p-3 text-sm"
      onClick={e => e.stopPropagation()}>
      <div className="eyebrow mb-1">{EDGE_KINDS[edge.kind] ?? edge.kind}{edge.weight ? ` · ×${edge.weight}` : ''}</div>
      <div className="mb-1">
        <button className="underline" onClick={() => onSelect(from.id)}>{from.label}</button>
        {' — '}
        <button className="underline" onClick={() => onSelect(to.id)}>{to.label}</button>
      </div>
      {edge.label && <p className="m-0 soft">{edge.label}</p>}
      {edge.speaks && <p className="m-0 soft">{edge.speaks} speaker line{edge.speaks === 1 ? '' : 's'} in this episode</p>}
      {edge.shared && (
        <div className="flex flex-wrap gap-1 mt-1">
          {edge.shared.map(id => (
            <button key={id} className="chip" onClick={() => onSelect(id)}>{nodeOf(id)?.label ?? id}</button>
          ))}
        </div>
      )}
      {(edge.blocks || edge.evidence) && (
        <div className="flex flex-wrap items-center gap-1 mt-1 mono text-[11px] soft">
          {edge.kind === 'relationship' ? 'evidence' : 'shared passages'}:
          {(edge.blocks ?? [edge.evidence]).map(id => (
            <button key={id} className="underline" onClick={() => onSelect(`p-${id}`)}>{id}</button>
          ))}
        </div>
      )}
      <button className="chip mt-2" onClick={onClose}>Close</button>
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

export { EdgeCard };

export default function NodePanel({
  node, neighbors, onSelect, onClose, mobile = false, trail = [], onFocusGroup, focusedType,
}) {
  const [snap, setSnap] = useState(0);
  useEffect(() => { setSnap(0); }, [node.id]);
  const accent = TYPE_COLORS[node.type];
  const quotes = useBlocks(node.quotes);
  const notes = useBlocks(node.notes);
  const analysis = useBlocks(node.block ? [node.block] : []);
  const speakerLines = useSpeakerLines(node);
  const episodeOf = ['technique', 'schema'].includes(node.type)
    ? neighbors.find(n => n.type === 'episode') : null;
  const episodeQuote = useBlocks(episodeOf?.quotes?.slice(0, 1));
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
      <Trail trail={trail} onSelect={onSelect} />
      <EpisodeStepper node={node} onSelect={onSelect} />
      <div className="eyebrow mb-1" style={{ color: accent }}>
        {node.type === 'passage' && node.ep
          ? <button className="underline" onClick={() => onSelect(`ep${String(node.ep).padStart(2, '0')}`)}>Episode {node.ep}</button>
          : <>
            {TYPE_LABELS[node.type]}{node.number ? ` // ${String(node.number).padStart(2, '0')}` : ''}
            {node.parent ? ` // sub-theme` : ''}
          </>}
      </div>
      <div className="title text-2xl leading-tight mb-2">{node.label}</div>
      {node.thin && <div className="mb-2"><Chip color="var(--warn)">{thinReason}</Chip></div>}
      <div className="text-[15px] leading-relaxed soft">{node.summary}</div>
      {node.setting && <div className="mono text-xs soft mt-1">{node.setting}</div>}
      <FirstSeen node={node} onSelect={onSelect} />

      {node.block && (
        <PassageList title={node.type === 'passage' ? 'Passage' : 'Full analysis'} blocks={analysis}
          accent={accent} onSelect={onSelect} />
      )}
      {node.type === 'motif' && <KwicStrip motifId={node.id} accent={accent} onSelect={onSelect} />}
      <SpeakerLines lines={speakerLines} accent={accent} onSelect={onSelect} />
      <PassageList title="Joyce’s text" blocks={quotes} accent={accent} onSelect={onSelect} />
      {episodeOf && (
        <PassageList title={`From ${episodeOf.label}`} blocks={episodeQuote} accent={accent} onSelect={onSelect} />
      )}
      <PassageList title="Commentary" blocks={notes} accent={accent} onSelect={onSelect} />
      <Neighbors neighbors={neighbors} accent={accent} onSelect={n => onSelect(n.id)}
        onFocusGroup={onFocusGroup} focusedType={focusedType} />

      <button
        className="chip mt-4"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}
