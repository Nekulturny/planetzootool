#!/usr/bin/env python3
"""Decode the packed Zoopedia export into data/animals.json.

Input:  data/raw/zoopedia_packed.json  (output of scripts/scrape/zoopedia.console.js)
Output: data/animals.json              (the record schema documented in CLAUDE.md)

Usage: python3 scripts/decode_zoopedia.py [packed.json] [animals.json]
"""
import json
import pathlib
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data/raw/zoopedia_packed.json"
DST = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "data/animals.json"

P = json.loads(SRC.read_text(encoding="utf-8"))
S, E, R = P["S"], P["E"], P["R"]


def s(v):
    """Packed strings are either inline or an index into the shared string table S."""
    return S[v] if isinstance(v, int) and not isinstance(v, bool) else v


def sa(a):
    return [s(x) for x in (a or [])]


ROLE = {"PreyMedium": "Medium Prey", "PreySmall": "Small Prey", "PreyLarge": "Large Prey", "Predator": "Predators"}
ENC = {"Box": "Box", "BoxLarge": "Large Box", "BoxLargeAngled": "Large Angled Box", "Cylinder": "Cylinder",
       "CylinderLarge": "Large Cylinder", "Walkthrough": "Walkthrough"}
MEAS = {"Shoulder": "shoulder height", "Length": "length", "Height": "height", "Standing": "standing height",
        "NoseToRump": "nose to rump", "LegSpan": "leg span", "Wingspan": "wingspan"}
SAL = {1: "Freshwater", 2: "Brackish", 3: "Freshwater, Brackish", 4: "Saltwater", 5: "Freshwater, Saltwater",
       6: "Brackish, Saltwater", 7: "Any salinity"}

out = []
for r in R:
    h = sa(r[10]); src = s(r[11]); et = sa(r[26])
    encl = "Aquarium" if "Aquarium" in h else ("Exhibit" if "Exhibit" in h else "Habitat")
    wk = r[25]
    # Habitat/aquarium species carry canGuestsWalkThrough; exhibit species count as walk-through
    # when a Walkthrough exhibit type is allowed.
    walk = (wk == 1) if wk is not None else ("Walkthrough" in et)
    sp = r[23]
    out.append(dict(
        n=r[0], slug=r[1], sci=r[2], cls=s(r[3]), ord=s(r[4]), fam=s(r[5]), gen=s(r[6]), cons=s(r[7]),
        biomes=sa(r[8]), cont=sa(r[9]), encl=encl, roofed="Roofed" in h, climbproof="ClimbProof" in h,
        shoal=src == "ShoalFish", pack=s(r[12]), tier=r[13], roles=sa(r[14]), food=r[15],
        size=[r[16][0], r[16][1], MEAS.get(s(r[16][2]), s(r[16][2])) if r[16][2] is not None else None],
        weight=r[17],
        barrier=None if r[18] is None else dict(grade=r[18][0], h=r[18][1], climb=bool(r[18][2]),
                                                water=bool(r[18][3]), ww=r[18][4], wd=r[18][5]),
        temp=r[19], hum=r[20], sal=SAL.get(r[21]) if r[21] else None,
        terrain=[dict(t=s(t[0]), lo=t[1], hi=t[2], parent=s(t[3])) for t in r[22]],
        space=dict(land=sp[0], shelter=sp[1], aquatic=sp[2], deep=sp[3], climb=sp[4], flight=sp[5]),
        group=r[24], walk=walk, exhibitTypes=[ENC.get(x, x) for x in et],
        temperament=s(r[27]), mating=s(r[28]), dispersal=s(r[29]),
        thriving=r[30], neutral=r[31],
        enrich=[E[i] for i in r[32]], foodEnrich=[E[i] for i in r[33]],
        life=r[34], repro=r[35][:7], morphs=sa(r[36]),
        wild=dict(groups=sa(r[37][0]), eco=sa(r[37][1]), reserves=sa(r[37][2]),
                  needs=[ROLE.get(x, x) for x in sa(r[37][3])]),
        reveal=r[38], featured=bool(r[39]), livecam=bool(r[40]),
    ))

# Sanity checks: every label must have resolved to a string.
for a in out:
    for k in ["cls", "ord", "fam", "gen", "cons", "temperament", "mating", "dispersal", "pack"]:
        assert a[k] is None or isinstance(a[k], str), (a["n"], k, a[k])
    for x in a["biomes"] + a["cont"] + a["roles"] + a["morphs"] + a["wild"]["groups"] + a["wild"]["eco"] + a["wild"]["reserves"]:
        assert isinstance(x, str), (a["n"], x)
    for t in a["terrain"]:
        assert isinstance(t["t"], str), (a["n"], t)

# Relationships are expected to be symmetric (thriving/neutral are indices into this sorted list).
asym = [(a["n"], out[j]["n"]) for i, a in enumerate(out) for j in a["thriving"] + a["neutral"]
        if i not in out[j]["thriving"] + out[j]["neutral"]]
if asym:
    print("WARNING asymmetric relationships:", asym[:10])

DST.write_text(json.dumps(dict(animals=out, exported=P["D"]), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"wrote {DST}: {len(out)} species, export {P['D']}")
print("enclosures:", dict(Counter(a["encl"] for a in out)), "| walk-through:", sum(a["walk"] for a in out))
