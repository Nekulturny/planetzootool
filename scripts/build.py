#!/usr/bin/env python3
"""Build dist/zoopedia-finder.html: src/template.html with all data embedded.

Merges data/animals.json (Zoopedia), data/wiki.json (wikily.gg release groups and
ecosystems) and data/career_tiers.json into one DATA object, and replaces the
/*__DATA__*/ placeholder in the template with it.

Usage: python3 scripts/build.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def norm(name):
    """Match species across sources despite punctuation differences (Thomson's / Thomsons, Galápagos)."""
    return re.sub(r"[^a-z]", "", name.lower().replace("á", "a"))


def main():
    D = load("data/animals.json")
    W = load("data/wiki.json")
    CT = load("data/career_tiers.json")

    wiki_by_name = {norm(v["n"]): v for v in W["sp"].values()}
    problems = []
    for a in D["animals"]:
        v = wiki_by_name.get(norm(a["n"]))
        # rel: release-to-the-wild data from wikily.gg (null when the species has no release groups)
        a["rel"] = {"rl": v["rl"], "g": v["g"], "r": v["r"], "f": v["f"]} if v else None
        if not v and a["wild"]["reserves"]:
            problems.append(f"no wikily release data for reserve species: {a['n']}")
        if a["n"] not in CT:
            problems.append(f"no Career tier for: {a['n']}")
        # ct: Career accreditation tier (1-4). a['tier'] is the Zoopedia's 0-based Franchise tier.
        a["ct"] = CT.get(a["n"])
    unmatched = [v["n"] for v in W["sp"].values() if not any(norm(a["n"]) == norm(v["n"]) for a in D["animals"])]
    if unmatched:
        problems.append(f"wikily species not in the Zoopedia data: {unmatched}")

    D["eco"] = {
        slug: {"n": e["n"], "biome": e["biome"], "terrain": e["terrain"], "also": e["also"],
               "o": [o for o in e["o"] if len(o) == 2], "ro": e["ro"]}
        for slug, e in W["eco"].items()
    }
    if problems:
        raise SystemExit("Build stopped:\n  " + "\n  ".join(problems))

    data = json.dumps(D, ensure_ascii=False, separators=(",", ":"))
    assert "</script" not in data, "data would break out of the inline <script>"
    template = (ROOT / "src/template.html").read_text(encoding="utf-8")
    assert template.count("/*__DATA__*/") == 1, "template must contain exactly one /*__DATA__*/ placeholder"

    out = ROOT / "dist/zoopedia-finder.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(template.replace("/*__DATA__*/", data), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size:,} bytes, {len(D['animals'])} species)")


if __name__ == "__main__":
    main()
