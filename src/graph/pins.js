import { NODES } from '../data/graphData';
import { LAYOUT_PRESETS } from './forces';

export const LAYOUT_VERSION = 1;
const PINS_KEY = (layer, preset) => `ulysses-pins:${layer}:${preset}`;
const SPREAD_KEY = 'ulysses-spread';

const VALID_IDS = new Set(NODES.map(n => n.id));
const isCoordinate = v => Number.isFinite(v);

// A layout shipped in the repo reaches every visitor; browser pins win over it.
const SHIPPED = import.meta.glob('../data/layouts/*.json', { eager: true, import: 'default' });
const shippedFor = layer => SHIPPED[`../data/layouts/${layer}.json`];

/** Keep only well-formed pins whose node still exists (ids change when the graph is rebuilt). */
function cleanPins(raw) {
  const pins = new Map();
  for (const [id, p] of Object.entries(raw ?? {})) {
    if (VALID_IDS.has(id) && isCoordinate(p?.x) && isCoordinate(p?.y)) pins.set(id, { x: p.x, y: p.y });
  }
  return pins;
}

/** Pins for a layer and preset: the browser's own, else the shipped default if it matches. */
export function loadPins(layer, preset) {
  try {
    const stored = JSON.parse(localStorage.getItem(PINS_KEY(layer, preset)) ?? 'null');
    if (stored?.v === LAYOUT_VERSION) return cleanPins(stored.pins);
  } catch { /* storage blocked or corrupt: fall through */ }
  const shipped = shippedFor(layer);
  return shipped?.v === LAYOUT_VERSION && (shipped.preset ?? 'free') === preset ? cleanPins(shipped.pins) : new Map();
}

export function savePins(layer, preset, pins) {
  try {
    localStorage.setItem(PINS_KEY(layer, preset),
      JSON.stringify({ v: LAYOUT_VERSION, pins: Object.fromEntries(pins) }));
  } catch { /* storage blocked: pins last for this visit only */ }
}

export function loadSpread(fallback) {
  try {
    const value = Number(localStorage.getItem(SPREAD_KEY));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch { return fallback; }
}

export function saveSpread(spread) {
  try { localStorage.setItem(SPREAD_KEY, String(spread)); } catch { /* storage unavailable */ }
}

/** Serialise a layout for download. */
export const layoutToJson = ({ layer, preset, spread, pins, zoom }) =>
  JSON.stringify({ v: LAYOUT_VERSION, layer, preset, spread, zoom, pins: Object.fromEntries(pins) }, null, 2);

/** Parse an imported layout file; returns null when it isn't one of ours. */
export function parseLayout(text) {
  try {
    const data = JSON.parse(text);
    if (data?.v !== LAYOUT_VERSION || !LAYOUT_PRESETS.some(({ id }) => id === data.preset)) return null;
    return { ...data, pins: cleanPins(data.pins) };
  } catch { return null; }
}
