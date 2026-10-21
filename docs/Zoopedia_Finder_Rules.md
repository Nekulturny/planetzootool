# Zoopedia Finder — Rule Specification

**Version:** 1.2 — 21 Oct 2026. v1.2 adds §8a, the standalone page and the public site (R1.0.2,
CR-002).
1.1 — 21 Oct 2026. v1.1 adds §0a, the version label in the masthead (R1.0.1, CR-001).
1.0 — 21 Oct 2026. Written from the R1.0.0 source (`src/template.html`,
`scripts/build.py`) and the Claude Chat handover of 21 Oct 2026, when the project moved into
Git. It records the rules as built; no rule was changed in writing it. Statements about the
game itself come from the two data sources (§1) and are **not independently verified**: where
the page makes an assumption about how Planet Zoo 2 works, it says so (§5.6).

---

## 0. Scope

A single-file HTML companion for **Planet Zoo 2**, for Paul's own play in Franchise and Career
mode. Two tabs share one **Accreditation** control (§3):

- **Species** — every Zoopedia species, with search, filters, card and table views and a detail
  drawer (§4).
- **Reserve planner** — for each of the six wildlife reserves, which species can be released
  now, which wait on other animals, and what each release unlocks (§5). Progress is ticked by
  hand and can be exported and imported as a plan file (§6).

Unofficial: it uses none of planetzoogame.com's logos or artwork, and every species links to
its official Zoopedia page.

## 0a. Version label (R1.0.1, CR-001)

The masthead band shows the page's version first, then the species count and the export date
of the Zoopedia data, for example:

`R1.0.2 · 136 species · data export 5 Oct 2026`

The version comes from one constant, `VERSION`, in `src/template.html`; bump it with every
release. Display only: no rule, filter or saved state reads it, and the plan file does not carry
it.

## 1. Data sources and joins

| File | Source | Holds |
|---|---|---|
| `data/animals.json` | planetzoogame.com/2/zoopedia, decoded from `data/raw/zoopedia_packed.json` by `scripts/decode_zoopedia.py` | 136 species (schema §2). Export dated 5 Oct 2026, reveals to 13 Oct 2026 |
| `data/wiki.json` | wikily.gg/planet-zoo-2/release-groups and /ecosystems | `sp`: release groups, reserve requirements and roles filled, 104 species. `eco`: 32 ecosystems with biome, roles (`ro`) and build notes. Read 21 Oct 2026 |
| `data/career_tiers.json` | wikily.gg/planet-zoo-2/accreditation | `{"Species name": Career tier 1–4}`, 136 entries. Re-read 21 Oct 2026, unchanged |

`scripts/build.py` joins them and **stops the build** (non-zero exit, every problem listed) when:

1. a species with at least one Zoopedia reserve has no wikily release data;
2. a species has no Career tier;
3. a wikily species matches no Zoopedia species.

Names are matched after `norm()`: lower-cased, `á` → `a`, everything but `a–z` removed (so
*Thomson's* = *Thomsons*, *Galápagos* = *Galapagos*). The build adds two fields to each
species: `rel` = `{rl, g, r, f}` from wikily (or `null`) and `ct` = Career tier. Ecosystem
objects keep only two-cell rows (`[object, amount]`). The build also refuses data containing
`</script` and a template without exactly one `/*__DATA__*/` placeholder.

All file I/O is explicit UTF-8.

## 2. Data schema (`data/animals.json`)

One record per species, sorted by name. Relationship indices point into this order.

| Group | Fields |
|---|---|
| Identity and taxonomy | `n` name, `slug`, `sci`, `cls`, `ord`, `fam`, `gen`, `cons` |
| Range and pack | `biomes`, `cont`, `pack`, `reveal`, `featured`, `livecam` |
| Enclosure | `encl` (Habitat / Aquarium / Exhibit), `roofed`, `climbproof`, `shoal`, `walk`, `exhibitTypes` |
| Accreditation and cost | `tier` (Franchise, **0-based**), `food` |
| Size | `size` [m♂, m♀, measure], `weight` [kg♂, kg♀] |
| Barrier | `barrier` {grade, h, climb, water, ww, wd} |
| Environment | `temp`, `hum`, `sal`, `terrain` [{t, lo, hi, parent}] |
| Space | `space` {land, shelter, aquatic, deep, climb, flight}: [minimum, + per extra animal] |
| Group | `group` [min, max, max♂ mixed, max♀ mixed, max♂ bachelor, max♀ bachelor] |
| Behaviour | `temperament`, `mating`, `dispersal` |
| Relationships | `thriving`, `neutral`: indices into this array |
| Enrichment | `enrich`, `foodEnrich` |
| Lifecycle | `life` [juvenile, adult, elderly years], `repro` [maturity, sterility, gestation, interbirth, litter min, litter max, seasons], `morphs` |
| Wild | `wild` {groups, eco, reserves, needs} |
| Added by the build | `rel` {rl, g, r, f}, `ct` |

Decoding rules (`decode_zoopedia.py`):

- `encl` = Aquarium if the habitat types include Aquarium, else Exhibit if they include
  Exhibit, else Habitat.
- `walk`: habitat and aquarium species use the source's `canGuestsWalkThrough`; exhibit species
  count as walk-through when a `Walkthrough` exhibit type is allowed.
- Relationships are expected to be symmetric; the decoder warns (does not fail) if not.

Known data quirks:

- `weight == [1, 1]` is a source placeholder (12 large animals). The page shows no weight for
  them.
- `wild.needs` (the Zoopedia's own required roles) is **incomplete** — it misses, for example,
  the Eurasian Bittern's need for a flourishing Lowland Marsh. The planner uses wikily's `rel.r`
  instead (§5.2).
- Zoopedia `tier` matches the wikily Franchise list exactly (verified in the original session).

## 3. Accreditation (shared by both tabs)

- `tierMode`: `franchise` or `career`. `tierCap`: 0 = no limit, else 1–5.
- `tierOf(a)` = Franchise `a.tier + 1`, or Career `a.ct`. **Every tier test goes through
  `tierOf`.**
- A species is above the cap when `tierCap > 0` and `tierOf(a) > tierCap`.
- Franchise has species at tiers 1–5 (32 / 33 / 31 / 30 / 10). Career has none at Tier 5
  (33 / 38 / 35 / 30), so Career Tier 4 and Tier 5 both show every species.
- Mode and cap are stored with the planner state (`zf-rv`, §7) and survive a reload.

## 4. Species tab

### 4.1 Filters (`matches`)

A species is shown when it passes **every** active filter. Within one chip group the chips are
OR-ed (any selected value); separate groups are AND-ed.

| Filter | Rule |
|---|---|
| Tier cap | hidden when above the cap (§3). The count line says how many are hidden |
| Search | split on whitespace; **every** token must appear, as a substring, in the species' search text (name, scientific name, taxonomy, status, enclosure, pack, temperament, mating, biomes, continents, roles, enrichment, morphs, terrain, wild ecosystems, reserves, exhibit types; walk-through species also match "walkthrough" / "walk-through") |
| Enclosure, Biome, Native range, Class, Conservation status, Temperament, Content, Terrain used, Wild reserve, Ecosystem role, Mating system | chip groups. A species with no temperament counts as `Not applicable` |
| Roofed / Climb-proof / Shoal fish | when ticked, the species must have the flag |
| Guests can walk through | Any / Yes / No against `walk` |
| Shares a habitat with | for every picked species: the candidate is not that species, and has a relationship with it — thriving or neutral, or thriving only. Several picks: must get along with **all** |
| Only species that can share | at least one relationship |
| Comfortable at (°C) | `temp[0] ≤ t ≤ temp[1]` |
| Max land area | active only below the slider maximum; species with no land requirement always pass |
| Max food cost | active only below the slider maximum; missing food counts as 0 |
| Highest barrier grade | hides species whose barrier grade is higher; species without a barrier pass |
| Water barrier allowed | the species must allow a water barrier |
| Has colour morphs / Featured | the species must have them |

Relationships: `REL[i][j]` is `T` (thriving) or `N` (neutral). Thriving overrides neutral.

### 4.2 Sorts and views

Name; land area ascending (no land requirement last) / descending; food cost; max group size;
coldest / hottest tolerated; most threatened (CR/EW first … domesticated last); most compatible;
newest reveal. Ties fall back to name. The table view has click-to-sort columns (nulls last).

### 4.3 Detail drawer

`openDetail(i)` shows overview, habitat or exhibit requirements, behaviour and relationships,
lifecycle, enrichment and *Release to the wild* (reserves, release groups, research level,
roles filled, reserve requirements), with a **Plan in <reserve>** button per reserve.

## 5. Reserve planner

### 5.1 Reserves

| id | Reserve | Biome | Region | Species |
|---|---|---|---|---|
| `grv` | Great Rift Valley Reserve | Grassland | Africa | 27 |
| `tz` | Tanzania Reserve | Grassland | Africa | 28 |
| `sum` | Sumatra Reserve | Tropical | Asia | 15 |
| `sco` | Scottish Highlands | Taiga | Europe | 11 |
| `swe` | Sweden Reserve | Taiga | Europe | 12 |
| `pol` | Poland Reserve | Temperate | Europe | 11 |

A species belongs to a reserve when its Zoopedia `wild.reserves` names it.

### 5.2 Requirements (`parseReq`)

Each wikily requirement row `[type, text]` becomes:

- **Ecosystems Required** → one **clause**. A leading `Either ` is dropped and the text split on
  ` or `. Each option is `{s: ecosystem slug, fl: needs flourishing}`, `fl` when the option starts
  `Flourishing `. Options that resolve to no ecosystem in the reserve's biome are dropped; a
  clause with no options left is dropped. Any one option satisfies the clause.
- **Species Roles Required** → a required role. All must be filled.
- **Nature Requirements** → a nest. Shown only, never evaluated.
- Any other type is ignored.

### 5.3 Ecosystem names (`ecoSlug`)

| Requirement name | Reserve | Slug |
|---|---|---|
| `Lake` | Poland (Temperate) | `lake-temperate` |
| `Lake` | Scottish Highlands | `lake-loch` |
| `Lake` | Sweden (other Taiga) | `lake-taiga` |
| `Lake` | Grassland / Tropical | none (dropped) |
| `Lake (Loch)` | Scottish Highlands only | `lake-loch` |
| `Grassland` | Sumatra (Tropical) | `grassland-tropical` |
| anything else | any | the ecosystem with exactly that name **in the reserve's biome**, else none |

Example: Red Deer's "Pastures or Mixed Lowland Forest" becomes just Pastures in Poland.

### 5.4 Status (`evaluate`)

Given the species ticked as released in the reserve:

1. **Roles filled** = every role (`rel.f`) of every released species in that reserve.
2. An ecosystem **flourishes** when all of its roles (`ECO[slug].ro`) are filled.
3. Each unreleased species gets a status, first match wins:

| Status | Label | Rule |
|---|---|---|
| done | Released | ticked as released (even if above the tier cap) |
| locked | Tier N needed | above the tier cap |
| blocked | Waiting | a required role is not filled, **or** a clause whose options *all* need flourishing has none flourishing |
| ready | Ready now | otherwise |

A clause with any non-flourishing option is "build it yourself" and **never blocks**.

### 5.5 Suggested order and unlocks

- **Step N** (`wavesFor`): starting from nothing released, release everything *ready*, repeat.
  A species' step is the round in which it first becomes ready. Computed per mode and tier cap,
  independent of the actual ticks; capped at 11 rounds (current data needs at most 3). A species
  never reached shows `Step –`; locked species show no step.
- **Releasing this unlocks …**: for each ready species, re-evaluate with it added and list the
  waiting species that become ready.
- Ready species are listed by unlock count (most first), then step, then name. Waiting and
  released species by step, then name; higher-tier species by tier, then name.
- Ecosystem cards cover every ecosystem named in the reserve's clauses: not flourishing first,
  then those some species needs flourishing, then by name.

### 5.6 Assumptions (not verified against the game)

1. A role counts **reserve-wide** once any released species in that reserve fills it. The game
   may require the animal to live inside that specific ecosystem area.
2. The planner does not track whether ecosystems are built, release-group composition, research
   level or nests. It shows them only.
3. Career scenario gifts are not modelled.
4. `Montane Forest` in Sweden resolves to the Taiga `Montane Forest`, not `Montane Forest
   (Boreal)`. Both are Taiga ecosystems in the data. It matters only if a Sweden species ever
   needs it to flourish.

## 6. Plan file

### 6.1 Format, `version: 1`

```json
{"app": "Zoopedia Finder", "kind": "reserve-plan", "version": 1, "saved": "ISO date",
 "mode": "career", "tier": 3, "current": "Great Rift Valley Reserve",
 "released": {"<reserve name>": ["<species name>", ...]}}
```

- `tier` is `null` for no limit. `released` lists only reserves with at least one tick; names are
  de-duplicated, sorted and limited to species of that reserve.
- Only planner state is exported. Species filters are not.
- The format is a contract with files Paul has already saved: a change to it is a new `version`
  and import must keep reading version 1.

### 6.2 Export

- **Save plan file** through the claude.ai artifact `downloads` capability
  (`window.claude.use("downloads")`), as `zoopedia-reserve-plan-YYYY-MM-DD.json` (local date).
  The button shows only when the capability resolves; if the host later reports it unavailable
  the button goes away.
- **Copy as text** always shows. If the clipboard is refused, the plan text is selected for a
  manual copy.

### 6.3 Import

- From a file (≤ 1 MB) or pasted text. Not JSON → "isn't plan text from this page". No
  `kind: "reserve-plan"` or no `released` object → "isn't a reserve plan exported from this page".
  `app` and `version` are not checked (only version 1 exists).
- Reserve keys match on name, id or short name. Unknown reserves and unknown species are
  skipped and listed in the preview (first 8). A reserve whose value is not a list is skipped
  without being listed.
- `current` sets the open reserve when it matches. `tier` (when present) 1–5 sets the cap,
  anything else means no limit; `mode` (when present and valid) sets the mode.
- A preview shows what the file holds against the current plan. **Replace my plan** replaces
  the ticks for **every** reserve.

## 7. Persistence

| Key | Holds |
|---|---|
| `localStorage["zf-state"]` | Species-tab filters, sort and view. Land and food limits are clamped to the current data's maximum on load |
| `localStorage["zf-rv"]` | Planner: view, reserve, released ticks (`released[reserveId]` = species names), tier, mode. An unknown reserve falls back to `grv`, an invalid tier to 0, an invalid mode to Franchise |

Storage is per viewer and per browser, which is why the plan file exists. Every read and write
is wrapped so the page works without storage.

## 8. Hosting

- Published as a private claude.ai artifact: https://claude.ai/artifact/Qh8ktsp29rPzG4j6bB3HEM,
  with `capabilities: {downloads: true}`.
- The host wraps the file in its own `<html><head><body>`, so the template has none of those
  tags; `<title>` and `<style>` come first.
- Content Security Policy: scripts only from cdnjs, jsdelivr, unpkg, cdn.tailwindcss.com,
  code.jquery.com; stylesheets only from Google Fonts; no other fetches; `<a download>`,
  `alert()` / `confirm()` and `window.print()` do not work.
- The page loads no scripts at all. Its only external resource is Google Fonts (Lilita One,
  Barlow, Barlow Condensed), each with a fallback stack.
- Hosted anywhere else, `window.claude` does not exist: the Save button stays hidden. Copy as
  text works. Everything else works only in the standalone build (§8a).

### 8a. Standalone page and public site (R1.0.2, CR-002)

Up to R1.0.1 the page relied on the claude.ai host's wrapper without saying so. Opened from
disk or served by any other host (checked in Chromium, 21 Oct 2026), it:

- showed **both tabs at once** and an empty import/export box: the page's own `display` rules
  for `#speciesView`, `#reserveView` and `#rvIO` override the browser's default for the
  `hidden` attribute, and only the host's base CSS forced `[hidden]` back to `display: none`;
- rendered in quirks mode (no doctype) with an 8 px body margin;
- laid out at 980 px on a phone, zoomed out (no viewport meta).

Rules from R1.0.2:

1. The page declares what it relied on, in its own CSS: `[hidden] { display: none !important; }`
   and `body { margin: 0; }`. Inside claude.ai these repeat the host's rules, so nothing changes
   there.
2. The build writes **two files** from the same template and data. The page between the
   wrappers is byte-identical in both.

| File | For | Wrapper |
|---|---|---|
| `dist/zoopedia-finder.html` | the claude.ai artifact | none: the host adds it |
| `index.html` (repo root) | the public site, and the file to give anyone | `<!doctype html>`, `<html lang="en">`, a head with `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width, initial-scale=1">`, then the page inside `<body>`, where the host also puts it |

3. **Public site:** GitHub Pages serves `main` from the repository root at
   https://nekulturny.github.io/planetzootool/. `.nojekyll` makes Pages publish the files as
   they are, without a Jekyll build. **Pushing `main` publishes the site.**
4. On the public site and from disk there is no **Save plan file** button (no `downloads`
   capability); **Copy as text** and import work (§6).

## 9. Data refresh

All sources block or rate-limit non-browser clients, so the scrapers are DevTools-console
scripts. Run each in a normal browser tab on the page named in its header and save the
clipboard output to the file shown, then `npm test`.

| Source | Script | Output | Notes |
|---|---|---|---|
| planetzoogame.com/2/zoopedia | `scripts/scrape/zoopedia.console.js` | `data/raw/zoopedia_packed.json`, then `python3 scripts/decode_zoopedia.py` | Nuxt app. About 2 minutes; keep the tab in the foreground (a background tab stalled the first run) |
| wikily.gg/planet-zoo-2/release-groups | `scripts/scrape/wikily.console.js` | `data/wiki.json` | HTTP 429 above about one request every 2 s, so one page at a time with a 2.5 s pause (about 6 minutes). The index lists only 100 species; the rest come from `EXTRA_SLUGS` |
| wikily.gg/planet-zoo-2/accreditation | `scripts/scrape/accreditation.console.js` | `data/career_tiers.json` | Also prints Franchise counts per tier, to cross-check against the Zoopedia |

`zoopedia.console.js` and `wikily.console.js` were assembled from snippets that each ran in the
original session but have **not** been run end to end in their assembled form. Check the output
the first time. The smoke test hard-codes counts from the current data (§10); update them with a
refresh, and say in the change log which numbers moved and why.

## 10. Verification

`npm test` builds both files and runs `tests/smoke.test.js` in jsdom: 17 tests. Thirteen drive
the artifact build and check known results from the current data — the masthead version label
(§0a); 136
species; 42 walk-through; 11 thriving
partners for Blue Wildebeest; 65 species at Franchise Tier 2 (71 hidden) and 126 at Tier 4;
Career Tier 1 includes Lion and not Black Wildebeest; Great Rift Valley starts at 19 ready /
8 waiting with the Lion waiting until Blue Wildebeest, Black Rhinoceros and Secretarybird are
released; African Leopard needs Tier 4 at Franchise Tier 3; plan export/import round trip; and
every reserve renders at every tier in both modes without script errors. Four load
`index.html` exactly as a browser receives it (§8a): it wraps the artifact build byte for byte;
it is a standards-mode UTF-8 document with the phone viewport; it loads without errors; and only
the open tab shows, before and after switching tabs. jsdom ignores `!important` and lets the
later rule win, so the `[hidden]` rule sits last in the stylesheet; real browsers were checked
separately in Chromium.

The expected values were taken from the page itself in the original session. They are
regression values, not independent proofs of the planner rules; a pure-logic suite with
expected values from outside the code is open (`BACKLOG.md`).

## 11. Change log

### Before Git (Claude Chat, 19–21 Oct 2026)

Published artifact versions, all now **R1.0.0**:

| Artifact version | Change |
|---|---|
| 1 | Species finder: search, filters, cards and table, detail drawer |
| 2 | Reserve planner tab built on wikily.gg data (added without being asked; see `CLAUDE.md`, Working with Paul) |
| 3 | Plan export and import |
| 4 | Fix: unreadable ghost buttons on the dark summary bar |
| 5 | Fix: tier label off by one (Zoopedia tiers are 0-based) |
| 6 | Tier-reached dropdown shared by both tabs |
| 7 | Count text shows how many species are hidden above the tier |
| 8 | Renamed to Franchise accreditation tier |
| 9 | Franchise / Career switch with Career tier data |

### Under change control

| Version | Change |
|---|---|
| R1.0.0 | 21 Oct 2026. Baseline = published artifact version 9, imported unchanged (tag `archive/claude-chat-handover`). Verified in this repo: `npm run build` reproduces `dist/zoopedia-finder.html` byte for byte, the file equals the live artifact apart from the host's wrapper, and the 12 smoke tests pass. No version label in the page yet. |
| R1.0.1 | 21 Oct 2026, **CR-001**. Version label in the masthead (§0a): the band reads `R1.0.1 · 136 species · data export 5 Oct 2026`, from a single `VERSION` constant. Display only; no rule, data or saved state changes. Smoke suite 12 → 13 tests. Approved by Paul and **released 21 Oct 2026 as artifact version 10**; the live page equals `dist/zoopedia-finder.html` apart from the host's wrapper (checked after publishing). |
| R1.0.2 | 21 Oct 2026, **CR-002**. Fix: the page works outside claude.ai (§8a). Up to R1.0.1, opened from disk or served elsewhere it showed both tabs at once and an empty import/export box, ran in quirks mode and laid out at 980 px on phones, because it relied on the claude.ai wrapper. The page now carries `[hidden] { display: none !important; }` and `body { margin: 0; }` itself, and the build also writes `index.html`, a complete document, for the public GitHub Pages site (https://nekulturny.github.io/planetzootool/) and for sharing as a file. No rule, data or saved-state change; no visible change inside claude.ai. Tests 13 → 17; the hidden-panel test was seen failing before the CSS fix. Chromium check at 1280 px and 390 px, before (defect reproduced) and after. Approved by Paul ("proceed") and **released 21 Oct 2026**: artifact version 11 (checked equal to `dist/` after publishing) and the first public-site build. |
