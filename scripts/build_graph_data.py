"""Build src/data/corpus.json and src/data/expansion.json from the Ulysses notes.

The notes corpus lives in ~/code/homebase/ulysses-yas (override with
ULYSSES_YAS). Quote text is taken straight from notes-from-notes-app.md through
that folder's own build_atlas helpers, so it matches the Quote Atlas exactly.

Run:  python3 scripts/build_graph_data.py
"""
import importlib.util
import json
import os
import re
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

HERE = Path(__file__).parent
APP = HERE.parent
sys.path.insert(0, str(HERE))
import graph_nodes as G  # noqa: E402

YAS = Path(os.environ.get("ULYSSES_YAS", Path.home() / "code/homebase/ulysses-yas"))
OUT_DIR = APP / "src" / "data"
COOCCUR_MIN_WEIGHT = int(os.environ.get("COOCCUR_MIN_WEIGHT", "2"))
COOCCUR_EXCLUDE = {"bloom"}  # present in almost every block: an edge to everything says nothing
KWIC_SIDE = 80
KWIC_PER_MOTIF = 40
SPEAKER_LINE_MAX = 220
MOTIF_SOLID_EPISODES = 4
MOTIF_MIN_EPISODES = 2
ANALYSIS_MENTION_MIN = 3
ANALYSIS_MENTION_CAP = 6


def load_atlas():
    sys.path.insert(0, str(YAS))
    spec = importlib.util.spec_from_file_location("build_atlas", YAS / "build_atlas.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ba = load_atlas()


def rx(pattern: str) -> re.Pattern[str]:
    return re.compile(rf"\b(?:{pattern})\b", re.I)


def render_paragraphs(lines: list[str]) -> list[str]:
    """Rejoin PDF hard wraps; keep real breaks (speakers, stage directions, verse)."""
    out: list[str] = []
    for para in ba.paragraphs(ba.strip_markers(lines)):
        text, previous = "", ""
        for raw in para:
            line = raw.strip()
            if not text:
                text = line
            elif len(previous) < ba.SHORT_LINE or ba.starts_new_line(line):
                text += "\n" + line
            elif previous.endswith("-") and line[:1].islower():
                text += line
            else:
                text += " " + line
            previous = line
        out.append(text)
    return out


def build_blocks() -> list[dict]:
    blocks, seq = [], {}
    for episode, kind, label, ranges, opts in ba.BLOCKS:
        seq[(episode, kind)] = seq.get((episode, kind), 0) + 1
        lines = ba.source_lines(ranges)
        pages = [opts["page"]] if opts.get("page") else ba.pages_in(lines)
        blocks.append({
            "id": f"e{episode:02d}{kind}{seq[(episode, kind)]:02d}",
            "ep": episode, "kind": kind, "label": label,
            "paras": render_paragraphs(lines),
            "page": "–".join([pages[0], pages[-1]]) if len(pages) > 1 else (pages[0] if pages else None),
            "lines": ba.lines_cited(ranges),
            "flag": opts.get("flag"), "flagnote": opts.get("flagnote"),
            "source": opts.get("source", ba.AI if kind == "a" else (ba.GUIDE if kind == "c" else None)),
        })
    for item in ba.HARD_ITEMS:
        if item["tag"] != "Cross-cutting analysis":
            continue
        kind, label, ranges, _ = item["blocks"][0]
        blocks.append({
            "id": f"x-{item['slug']}", "ep": 0, "kind": "a", "label": item["title"],
            "paras": render_paragraphs(ba.source_lines(ranges)), "page": None,
            "lines": ba.lines_cited(ranges), "flag": None, "flagnote": None,
            "source": ba.AI, "reason": item["reason"],
        })
    return blocks


def block_text(block: dict) -> str:
    return "\n".join(block["paras"])


def load_motifs(blocks: list[dict], joyce: list[dict]) -> tuple[list[dict], dict]:
    """Motif nodes from motif-patterns.txt, kept only if Joyce's text recurs."""
    nodes, rules = [], {}
    for raw in (HERE / "motif-patterns.txt").read_text(encoding="utf-8").splitlines():
        if not raw.strip():
            continue
        slug, label, pattern = raw.split("|", 2)
        compiled = rx(pattern)
        hit_blocks = [b for b in joyce if compiled.search(block_text(b))]
        episodes = sorted({b["ep"] for b in hit_blocks})
        if len(episodes) < MOTIF_MIN_EPISODES:
            continue
        match = compiled.search(block_text(hit_blocks[0]))
        text = block_text(hit_blocks[0])
        start = max(0, match.start() - 50)
        snippet = " ".join(text[start:match.end() + 70].split())
        names = ", ".join(str(e) for e in episodes)
        nodes.append({
            "id": slug, "type": "motif", "label": label, "pattern": pattern,
            "thin": len(episodes) < MOTIF_SOLID_EPISODES,
            "episodes": episodes, "hits": len(hit_blocks),
            "summary": (f"Recurs in Joyce's text in {len(episodes)} episodes ({names}), across "
                        f"{len(hit_blocks)} passages. Found by a word-bounded scan of the notes. "
                        f"First hit: “…{snippet}…”"),
        })
        rules[slug] = pattern
    return nodes, rules


def find_links(paras: list[str], patterns: dict[str, re.Pattern[str]]) -> list:
    """First match of each node per paragraph, as [[para, [[start, end, id], ...]], ...]."""
    out = []
    for index, para in enumerate(paras):
        spans = []
        for nid, pattern in patterns.items():
            match = pattern.search(para)
            if match:
                spans.append((match.start(), match.end(), nid))
        spans.sort()
        kept, last_end = [], -1
        for start, end, nid in spans:
            if start >= last_end:
                kept.append([start, end, nid])
                last_end = end
        if kept:
            out.append([index, kept])
    return out


def find_speakers(paras: list[str], character_rx: dict[str, re.Pattern[str]]) -> list:
    """Speaker lines (BLOOM: ...) as [[character id, para, line], ...]."""
    out = []
    for index, para in enumerate(paras):
        for line in para.split("\n"):
            match = ba.SPEAKER.match(line.strip())
            if not match:
                continue
            name = match.group(1).strip().lower()
            owner = next((cid for cid, pattern in character_rx.items() if pattern.fullmatch(name)), None)
            if owner:
                text = " ".join(line.split())
                out.append([owner, index, text[:SPEAKER_LINE_MAX]])
    return out


def keyword_in_context(pattern: re.Pattern[str], hit_blocks: list[dict]) -> list:
    """[[block id, before, hit, after], ...] for a motif, in book order, capped."""
    rows = []
    for block in hit_blocks:
        text = " ".join(block_text(block).split())
        for match in pattern.finditer(text):
            before = text[max(0, match.start() - KWIC_SIDE):match.start()]
            after = text[match.end():match.end() + KWIC_SIDE]
            rows.append([block["id"], before, match.group(0), after])
    return rows[:KWIC_PER_MOTIF]


def main() -> None:
    blocks = build_blocks()
    by_id = {b["id"]: b for b in blocks}
    joyce = [b for b in blocks if b["kind"] == "q"]
    commentary = [b for b in blocks if b["kind"] == "c"]
    analyses = [b for b in blocks if b["kind"] == "a"]

    motif_nodes, motif_rules = load_motifs(blocks, joyce)

    # ---- tagging rules: node id -> pattern, per type ------------------------------
    existing_ids = {"character": [], "theme": [], "place": []}
    base_types = {
        **{k: "character" for k in ("bloom molly stephen boylan mulligan dignam citizen gerty martha milly rudy "
                                     "simon douce kennedy deasy haines kevin_egan conmee").split()},
        **{k: "theme" for k in ("cuckoldom fatherhood antisemitism guilt language music hamlet food desire death "
                                 "religion women memory stream").split()},
        **{k: "place" for k in "martello eccles sandymount glasnevin national_library ormond kiernans nighttown".split()},
    }
    node_type: dict[str, str] = dict(base_types)
    rules: dict[str, str] = dict(G.EXISTING_RX)
    for cid, _l, _s, pattern in G.CHARACTERS:
        node_type[cid], rules[cid] = "character", pattern
    for pid, _l, _s, pattern in G.PLACES:
        node_type[pid], rules[pid] = "place", pattern
    for tid, _l, _p, _s, pattern, _e in G.THEMES:
        node_type[tid], rules[tid] = "theme", pattern
    for mid, pattern in motif_rules.items():
        node_type[mid], rules[mid] = "motif", pattern
    compiled = {nid: rx(p) for nid, p in rules.items()}

    tags: dict[str, set[str]] = {}
    for block in joyce + commentary:
        text = block_text(block)
        tags[block["id"]] = {nid for nid, c in compiled.items() if c.search(text)}

    inline_rx = {nid: compiled[nid] for nid, t in node_type.items()
                 if t in ("character", "place", "motif") and nid not in G.INLINE_SKIP}
    inline_text_rx = {nid: c for nid, c in inline_rx.items() if node_type[nid] != "motif"}
    character_rx = {nid: compiled[nid] for nid, t in node_type.items() if t == "character"}
    for block in blocks:
        patterns = inline_rx if block["kind"] == "q" else inline_text_rx
        links = find_links(block["paras"], patterns)
        if links:
            block["links"] = links
        if block["kind"] == "q":
            speakers = find_speakers(block["paras"], character_rx)
            if speakers:
                block["speakers"] = speakers
    book_order = {b["id"]: i for i, b in enumerate(blocks)}

    quotes_for: dict[str, list[str]] = defaultdict(list)
    notes_for: dict[str, list[str]] = defaultdict(list)
    for block in joyce + commentary:
        target = quotes_for if block["kind"] == "q" else notes_for
        for nid in tags[block["id"]]:
            target[nid].append(block["id"])

    def derived_episodes(nid: str) -> Counter:
        return Counter(by_id[b]["ep"] for b in quotes_for.get(nid, []))

    nodes: list[dict] = []
    edges: list[dict] = []

    by_pair: dict[tuple, dict] = {}

    def edge(source: str, target: str, kind: str, weight: int = 1, **extra) -> bool:
        """Add an edge, or merge extra fields into the pair's existing one (its kind and weight win).

        Returns True if the edge was newly written.
        """
        key = (min(source, target), max(source, target))
        extras = {k: v for k, v in extra.items() if v}
        if source == target:
            return False
        if key in by_pair:
            by_pair[key].update(extras)
            return False
        record = {"source": source, "target": target, "kind": kind}
        if weight > 1:
            record["weight"] = weight
        record.update(extras)
        by_pair[key] = record
        edges.append(record)
        return True

    # ---- overlay: attach text to the 58 existing nodes ----------------------------
    overlay: dict[str, dict] = {}
    episode_meta = {n: (part, title, setting) for n, part, title, setting, _ in ba.EPISODES}
    for n, (part, _title, setting) in episode_meta.items():
        eid = f"ep{n:02d}"
        overlay[eid] = {
            "part": f"part{ {'I': 1, 'II': 2, 'III': 3}[part] }".replace(" ", ""),
            "setting": setting,
            "quotes": [b["id"] for b in joyce if b["ep"] == n],
            "notes": [b["id"] for b in commentary if b["ep"] == n],
        }
    for nid, ntype in base_types.items():
        entry = {"quotes": quotes_for.get(nid, []), "notes": notes_for.get(nid, [])}
        if nid in G.REPARENT:
            entry["parent"] = G.REPARENT[nid]
        overlay[nid] = entry

    # ---- parts ------------------------------------------------------------------------
    for pid, label, summary, eps in G.PARTS:
        nodes.append({"id": pid, "type": "part", "label": label, "summary": summary})
        for n in eps:
            edge(f"ep{n:02d}", pid, "part_of")

    # ---- characters / places: episodes derived from the blocks they appear in ---------
    for cid, label, summary, _pattern in G.CHARACTERS:
        nodes.append({"id": cid, "type": "character", "label": label, "summary": summary,
                      "quotes": quotes_for.get(cid, []), "notes": notes_for.get(cid, [])})
        for ep, count in sorted(derived_episodes(cid).items()):
            edge(cid, f"ep{ep:02d}", "appears_in", count)
        for ep in G.MANUAL_EPS.get(cid, []):
            edge(cid, f"ep{ep:02d}", "appears_in")
    for pid, label, summary, _pattern in G.PLACES:
        nodes.append({"id": pid, "type": "place", "label": label, "summary": summary,
                      "quotes": quotes_for.get(pid, []), "notes": notes_for.get(pid, [])})
        for ep, count in sorted(derived_episodes(pid).items()):
            edge(pid, f"ep{ep:02d}", "set_in", count)
        for ep in G.MANUAL_EPS.get(pid, []):
            edge(pid, f"ep{ep:02d}", "set_in")

    # ---- themes: hierarchy + hand-set episodes -------------------------------------------
    for tid, label, parent, summary, _pattern, eps in G.THEMES:
        record = {"id": tid, "type": "theme", "label": label, "summary": summary,
                  "quotes": quotes_for.get(tid, []), "notes": notes_for.get(tid, [])}
        if parent:
            record["parent"] = parent
        nodes.append(record)
        for n in eps:
            edge(tid, f"ep{n:02d}", "theme_of")
    for tid, label, parent, *_ in G.THEMES:
        if parent:
            edge(tid, parent, "child_of")
    for child, parent in G.REPARENT.items():
        edge(child, parent, "child_of")

    # ---- motifs -----------------------------------------------------------------------------
    kwic: dict[str, list] = {}
    for motif in motif_nodes:
        motif["quotes"] = quotes_for.get(motif["id"], [])
        kwic[motif["id"]] = keyword_in_context(
            compiled[motif["id"]], [by_id[b] for b in motif["quotes"]])
        nodes.append(motif)
        for ep, count in sorted(derived_episodes(motif["id"]).items()):
            edge(motif["id"], f"ep{ep:02d}", "recurs_in", count)
        for theme in G.MOTIF_THEMES.get(motif["id"], []):
            edge(motif["id"], theme, "theme_of")

    # ---- technique / schema / correspondence ------------------------------------------------------
    for tid, label, summary, ep in G.TECHNIQUES:
        nodes.append({"id": tid, "type": "technique", "label": label, "summary": summary})
        edge(tid, f"ep{ep:02d}", "technique_of")
    for sid, label, episode_name, ep in G.SCHEMA:
        nodes.append({"id": sid, "type": "schema", "label": label,
                      "summary": f"The Gilbert schema assigns {label.split(': ')[1]} as the 'art' of {episode_name}."})
        edge(sid, f"ep{ep:02d}", "schema_of")
    for cid, label, summary, chars, eps, themes in G.CORRESPONDENCES:
        nodes.append({"id": cid, "type": "correspondence", "label": label, "summary": summary})
        for ch in chars:
            edge(cid, ch, "corresponds_to")
        for n in eps:
            edge(cid, f"ep{n:02d}", "corresponds_to")
        for th in themes:
            edge(cid, th, "corresponds_to")

    # ---- analysis nodes: 12 pasted analyses + 3 cross-cutting essays ---------------------------------------
    analysis_rx = {nid: compiled[nid] for nid, t in node_type.items() if t in ("character", "theme", "place")}
    for block in analyses:
        text = block_text(block)
        body = ba.strip_leading_symbol(" ".join(text.split()))
        nid = f"an-{block['id']}"
        nodes.append({"id": nid, "type": "analysis", "label": block["label"], "block": block["id"],
                      "summary": body[:300].rstrip() + ("…" if len(body) > 300 else ""),
                      **({"flag": block["flag"], "flagnote": block["flagnote"]} if block["flag"] else {})})
        if block["id"].startswith("x-"):
            spec = G.ESSAYS[block["id"][2:]]
            for n in spec["eps"]:
                edge(nid, f"ep{n:02d}", "discusses")
            for target in spec["themes"] + spec["chars"]:
                edge(nid, target, "discusses")
            continue
        edge(nid, f"ep{block['ep']:02d}", "discusses")
        counts = Counter({k: len(c.findall(text)) for k, c in analysis_rx.items()})
        for target, count in counts.most_common(ANALYSIS_MENTION_CAP):
            if count >= ANALYSIS_MENTION_MIN:
                edge(nid, target, "discusses", count)

    # ---- episode order, echoes, relationships, speakers -------------------------------------
    for a, b in zip(G.EPISODE_ORDER, G.EPISODE_ORDER[1:]):
        edge(f"ep{a:02d}", f"ep{b:02d}", "next")

    echo_types = {"character", "place", "motif"}
    episode_tags: dict[int, set[str]] = defaultdict(set)
    for block in joyce:
        episode_tags[block["ep"]] |= {n for n in tags[block["id"]]
                                      if node_type[n] in echo_types and n not in COOCCUR_EXCLUDE}
    echo_pairs = sorted(
        ((len(episode_tags[a] & episode_tags[b]), a, b)
         for a, b in combinations(sorted(episode_tags), 2)
         if len(episode_tags[a] & episode_tags[b]) >= G.ECHO_MIN_SHARED),
        reverse=True)
    echo_used: Counter = Counter()
    echoes = 0
    for count, a, b in echo_pairs:
        if echo_used[a] >= G.ECHO_PER_EPISODE or echo_used[b] >= G.ECHO_PER_EPISODE:
            continue
        shared = sorted(episode_tags[a] & episode_tags[b])
        if edge(f"ep{a:02d}", f"ep{b:02d}", "echoes", count, shared=shared[:14]):
            echo_used[a] += 1
            echo_used[b] += 1
            echoes += 1

    dropped_pairs = []
    for a, b, label in G.RELATIONSHIPS:
        evidence = next((blk["id"] for blk in joyce if a in tags[blk["id"]] and b in tags[blk["id"]]), None)
        if evidence is None:
            dropped_pairs.append((a, b))
            continue
        edge(a, b, "relationship", 1, label=label, evidence=evidence)

    speaker_counts: Counter = Counter()
    for block in joyce:
        for cid, _para, _line in block.get("speakers", []):
            speaker_counts[(cid, block["ep"])] += 1
    for (cid, ep), count in sorted(speaker_counts.items()):
        edge(cid, f"ep{ep:02d}", "speaks_in", count, speaks=count)

    # ---- passages: each Joyce quote as a node, linked to its episode and the nodes it names ----
    for block in joyce:
        pid = f"p-{block['id']}"
        nodes.append({"id": pid, "type": "passage", "label": block["label"], "block": block["id"],
                      "ep": block["ep"],
                      "summary": f"A passage of Joyce’s text quoted in the notes, from episode {block['ep']}."})
        edge(pid, f"ep{block['ep']:02d}", "in")
        for nid in sorted(tags[block["id"]]):
            if nid not in COOCCUR_EXCLUDE:
                edge(pid, nid, "mentions")

    # ---- co-occurrence: nodes tagged on the same Joyce passage -------------------------------------------------
    pair_types = {"character", "theme", "place", "motif"}
    pair_counts: Counter = Counter()
    pair_blocks: dict[tuple[str, str], list[str]] = defaultdict(list)
    for block in joyce:
        present = sorted(n for n in tags[block["id"]] if node_type[n] in pair_types and n not in COOCCUR_EXCLUDE)
        for a, b in combinations(present, 2):
            pair_counts[(a, b)] += 1
            pair_blocks[(a, b)].append(block["id"])
    cooccur = [(a, b, w) for (a, b), w in pair_counts.items() if w >= COOCCUR_MIN_WEIGHT]
    cooccur.sort(key=lambda r: -r[2])
    for a, b, w in cooccur:
        edge(a, b, "co_occurs", w, blocks=pair_blocks[(a, b)][:12])

    for node in nodes:
        if node["type"] in ("character", "place", "theme") and not node.get("quotes"):
            node["thin"] = True

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "corpus.json").write_text(json.dumps({
        "source": "notes-from-notes-app.md", "blocks": blocks, "kwic": kwic,
        "appendix": [{"slug": i["slug"], "title": i["title"], "reason": i["reason"],
                      "paras": render_paragraphs(ba.source_lines([r for _k, _l, rs, _o in i["blocks"] for r in rs]))}
                     for i in ba.HARD_ITEMS if i["tag"] == "Unmapped notes"],
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT_DIR / "expansion.json").write_text(json.dumps(
        {"nodes": nodes, "overlay": overlay, "edges": edges},
        ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    kinds = Counter(e["kind"] for e in edges)
    types = Counter(n["type"] for n in nodes)
    print(f"blocks: {len(blocks)} ({Counter(b['kind'] for b in blocks)})")
    print(f"new nodes: {len(nodes)} {dict(types)}")
    print(f"new edges: {len(edges)} {dict(kinds)}")
    print(f"echoes: {echoes}; relationships dropped for lack of evidence: {dropped_pairs}")
    print(f"speaker lines: {sum(speaker_counts.values())} across {len({c for c, _ in speaker_counts})} characters")
    print(f"co-occurrence pairs at weight>={COOCCUR_MIN_WEIGHT}: {len(cooccur)} "
          f"(of {len(pair_counts)} pairs seen)")


if __name__ == "__main__":
    main()
