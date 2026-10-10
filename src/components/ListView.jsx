import { NODES, TYPE_COLORS } from '../data/graphData';
import { PassageList, useBlocks } from './NodePanel';

const PARTS = NODES.filter(n => n.type === 'part').sort((a, b) => a.id.localeCompare(b.id));
const EPISODES = NODES.filter(n => n.type === 'episode').sort((a, b) => a.number - b.number);

/** One episode's Joyce passages, loaded only once its section is opened. */
function EpisodeSection({ episode, onShow }) {
  const accent = TYPE_COLORS.episode;
  const blocks = useBlocks(episode.quotes);
  return (
    <details className="border-t py-2" style={{ borderColor: 'var(--rule)' }}>
      <summary className="cursor-pointer select-none py-1 min-h-8">
        <span className="mono text-xs soft mr-2">{String(episode.number).padStart(2, '0')}</span>
        <span className="title text-lg">{episode.label}</span>
        <span className="mono text-xs soft ml-2">{episode.quotes?.length ?? 0} passages</span>
      </summary>
      <p className="soft text-[15px] leading-relaxed mt-1">{episode.summary}</p>
      <button className="chip my-2" onClick={() => onShow(episode.id)}>Show on graph</button>
      <PassageList title="Joyce’s text" blocks={blocks} accent={accent} onSelect={onShow} />
    </details>
  );
}

/** The corpus as an outline: Part → Episode → quotes. A readable alternative to the graph on a phone. */
export default function ListView({ onShow }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      {PARTS.map(part => (
        <section key={part.id} className="mb-6">
          <h2 className="eyebrow mb-1" style={{ color: TYPE_COLORS.part }}>{part.label}</h2>
          <p className="soft text-sm mb-2">{part.summary}</p>
          {EPISODES.filter(e => e.part === part.id).map(episode => (
            <EpisodeSection key={episode.id} episode={episode} onShow={onShow} />
          ))}
        </section>
      ))}
    </div>
  );
}
