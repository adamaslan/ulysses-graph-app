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
    seen: set[tuple] = set()

    def edge(source: str, target: str, kind: str, weight: int = 1) -> None:
        key = (min(source, target), max(source, target))
        if source == target or key in seen:
            return
        seen.add(key)
        record = {"source": source, "target": target, "kind": kind}
        if weight > 1:
            record["weight"] = weight
        edges.append(record)

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
    for motif in motif_nodes:
        motif["quotes"] = quotes_for.get(motif["id"], [])
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

    # ---- co-occurrence: nodes tagged on the same Joyce passage -------------------------------------------------
    pair_types = {"character", "theme", "place", "motif"}
    pair_counts: Counter = Counter()
    for block in joyce:
        present = sorted(n for n in tags[block["id"]] if node_type[n] in pair_types and n not in COOCCUR_EXCLUDE)
        for a, b in combinations(present, 2):
            pair_counts[(a, b)] += 1
    cooccur = [(a, b, w) for (a, b), w in pair_counts.items() if w >= COOCCUR_MIN_WEIGHT]
    cooccur.sort(key=lambda r: -r[2])
    for a, b, w in cooccur:
        edge(a, b, "co_occurs", w)

    for node in nodes:
        if node["type"] in ("character", "place", "theme") and not node.get("quotes"):
            node["thin"] = True

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "corpus.json").write_text(json.dumps({
        "source": "notes-from-notes-app.md", "blocks": blocks,
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
    print(f"co-occurrence pairs at weight>={COOCCUR_MIN_WEIGHT}: {len(cooccur)} "
          f"(of {len(pair_counts)} pairs seen)")


if __name__ == "__main__":
    main()
