# Zoopedia Finder — handover

A single-file HTML companion for **Planet Zoo 2**, built for Paul (the user) in a Claude chat session on 19–21 Oct 2026. It has two tabs:

- **Species**: all 136 Zoopedia species with search, filters, card and table views, and a detail drawer.
- **Reserve planner**: for each of the six wildlife reserves, it shows which species can be released now, which are waiting on other animals, and what each one unlocks. Progress can be exported and imported as a plan file.

A shared **Accreditation** control (Franchise / Career plus "tier reached") filters both tabs.

The current build is published as a private claude.ai artifact: https://claude.ai/artifact/Qh8ktsp29rPzG4j6bB3HEM (version 9). `dist/zoopedia-finder.html` is byte-identical to it.

## Working with Paul

- Execution first. When the task is clear, do it and report the result. Don't turn it into a consultation and don't explain what you're about to do.
- **Ask before going significantly beyond the requested scope.** He gave this feedback explicitly during the original session, after a whole reserve planner was added when he'd only asked for existing tools. Small fixes to defects you introduced are fine. New features need a yes first.
- Be direct and concise, without filler. Flag real problems briefly.
- He plays both Franchise and Career, and catches data inaccuracies quickly. When game facts are unsure, say so instead of guessing.

## Layout

```
src/template.html          the page: HTML, CSS and JS in one file, with a /*__DATA__*/ placeholder
data/animals.json          Zoopedia data, 136 species (decoded, readable schema below)
data/wiki.json             wikily.gg data: release groups and requirements (104 species) and 32 ecosystems
data/career_tiers.json     {"Species name": Career accreditation tier 1-4}
data/raw/zoopedia_packed.json   raw packed Zoopedia export (input to decode_zoopedia.py)
scripts/build.py           template + data -> dist/zoopedia-finder.html (validates joins and fails loudly)
scripts/decode_zoopedia.py packed export -> data/animals.json
scripts/scrape/*.console.js     browser-console scrapers used to refresh the data (see Data refresh)
tests/smoke.test.js        jsdom smoke test that drives the UI and checks known results
dist/zoopedia-finder.html  the built page (the deliverable)
```

## Build and test

```
npm install          # jsdom, only needed for the tests
npm run build        # python3 scripts/build.py
npm test             # build + tests/smoke.test.js (12 checks)
```

Python 3 only, no packages. All file I/O is explicit UTF-8 (species names include "Galápagos"). The tests hard-code numbers from the current data, for example 19 species ready in Great Rift Valley and 65 species at Franchise Tier 2. Update them when the data is refreshed.

## How the page works

Everything lives in `src/template.html`. There are no frameworks and no external scripts. The only external resource is Google Fonts (Lilita One, Barlow, Barlow Condensed), each with a fallback stack. `DATA = {animals, exported, eco}` is inlined by the build.

### Species tab
- `st`: the filter state, saved to localStorage `zf-state`. `SETS` holds the chip filters. `fresh()` gives the defaults.
- `matches(a)` applies every filter, including the tier cap. `render()` draws the count, active-filter chips, and the cards or table. `syncControls()` mirrors state into the controls.
- `REL[i][j]` is `"T"` (thriving) or `"N"` (neutral). Thriving overrides neutral, and the data is symmetric. "Shares a habitat with" means a species must get along with every picked species.
- `openDetail(i)` opens the drawer. It also shows release groups and requirements, and has "Plan in <reserve>" buttons.

### Reserve planner
- `RESERVES`: six reserves with id, name and biome. The reserve each species belongs to comes from the Zoopedia (`a.wild.reserves`).
- `parseReq(a, res)` turns the wikily requirement rows into:
  - clauses, where each clause is a list of options and any option satisfies it. Each option is `{s: ecosystem slug, fl: needs flourishing}`.
  - required roles, all of which must be met.
  - nests, which are shown only.
- `ecoSlug(name, res)` resolves requirement names to an ecosystem in the reserve's biome:
  - "Lake" becomes `lake-loch` in Scottish Highlands, `lake-taiga` in Sweden and `lake-temperate` in Poland.
  - "Grassland" in the Tropical biome becomes `grassland-tropical`.
  - Options outside the reserve's biome are dropped. For example, Red Deer's "Pastures or Mixed Lowland Forest" becomes just Pastures in Poland.
- `evaluate(P, released)` works out each species' status:
  - **done** if it's ticked as released.
  - **locked** if it's above the current tier cap.
  - **blocked** if a required role isn't filled yet, or none of a flourishing clause's options flourishes.
  - **ready** otherwise.
  - A clause with any non-flourishing option counts as "build it yourself" and is never blocking.
  - An ecosystem flourishes when the released species in that reserve fill all of its roles (`ECO[slug].ro`).
- `wavesFor(P)` gives the suggested "Step N": repeatedly release everything that's ready, starting from nothing. It's cached per mode and tier.
- For each ready species, "Releasing this unlocks …" re-runs `evaluate` with that species added.
- The released ticks live in `rv.released[reserveId]` as species names. `rv` (view, reserve, released, tier, mode) is saved to localStorage `zf-rv`.

### Accreditation (shared by both tabs)
- `tierMode` is `"franchise"` or `"career"`. `tierCap` is 0 (no limit) or 1–5.
- `tierOf(a)` returns the Franchise tier as `a.tier + 1` (the Zoopedia field is 0-based) or the Career tier as `a.ct`. Every tier check goes through `tierOf`.
- Career has no species at Tier 5. Every species is available by Career Tier 4.

### Plan import and export
- File format (`version: 1`):
  ```json
  {"app": "Zoopedia Finder", "kind": "reserve-plan", "version": 1, "saved": "ISO date",
   "mode": "career", "tier": 3, "current": "Great Rift Valley Reserve",
   "released": {"<reserve name>": ["<species name>", ...]}}
  ```
- Import validates the file, shows a preview, and **replaces** the whole plan. Unknown reserves and species are skipped and listed.
- Export can **Save plan file** through the claude.ai artifact `downloads` capability (`window.claude.use("downloads")`). The button only shows when the capability resolves. **Copy as text** always works, with a select-the-textarea fallback.
- Only planner state is exported. The species filters are not.

### If it stays a claude.ai artifact
- The host wraps the file in its own `<html><head><body>`, so the template has no `<html>`/`<head>`/`<body>` tags. `<title>` and `<style>` come first.
- Content Security Policy:
  - Scripts can only load from cdnjs, jsdelivr, unpkg, cdn.tailwindcss.com or code.jquery.com. Stylesheets only from Google Fonts.
  - The page can't fetch any other site.
  - `<a download>`, `alert()`/`confirm()` and `window.print()` don't work.
- localStorage is per viewer and per browser, which is why the plan export exists.
- To republish, use a Claude session that has the Artifact tool. Publish `dist/zoopedia-finder.html` with `url` set to the artifact link above and keep `capabilities: {downloads: true}`.
- If you host it somewhere else instead, `claude.use` won't exist. The Save button stays hidden and everything else works.

### Styling
- The colours are CSS custom properties on `:root`, with dark-mode overrides under `prefers-color-scheme` and `[data-theme]`. Add any new colour to all three blocks.
- The look follows planetzoogame.com (olive band, cream background, chunky display type) but uses none of its logos or artwork.
- It works at phone width: the filters become a slide-in panel, and the planner columns stack.

## Data: schema notes

`data/animals.json` holds one record per species, sorted by name:

| Group | Fields |
|---|---|
| Identity and taxonomy | `n` name, `slug`, `sci`, `cls`, `ord`, `fam`, `gen`, `cons` |
| Range and pack | `biomes`, `cont`, `pack`, `reveal`, `featured`, `livecam` |
| Enclosure | `encl` (Habitat / Aquarium / Exhibit), `roofed`, `climbproof`, `shoal`, `walk` (guests can walk through), `exhibitTypes` |
| Accreditation and cost | `tier` (Franchise, **0-based**), `food` |
| Size | `size` [m♂, m♀, measure], `weight` [kg♂, kg♀] |
| Barrier | `barrier` {grade, h, climb, water, ww, wd} |
| Environment | `temp`, `hum`, `sal`, `terrain` [{t, lo, hi, parent}] |
| Space | `space` {land, shelter, aquatic, deep, climb, flight}: [minimum, +per extra animal] |
| Group | `group` [min, max, max♂ mixed, max♀ mixed, max♂ bachelor, max♀ bachelor] |
| Behaviour | `temperament`, `mating`, `dispersal` |
| Relationships | `thriving`, `neutral`: indices into this array |
| Enrichment | `enrich`, `foodEnrich` |
| Lifecycle | `life` [juvenile, adult, elderly years], `repro` [maturity, sterility, gestation, interbirth, litter min, litter max, seasons], `morphs` |
| Wild | `wild` {groups, eco, reserves, needs} |
| Added by the build | `rel` {rl, g, r, f} from wikily.gg, `ct` Career tier |

Quirks:
- `weight == [1, 1]` is a placeholder in the source, used for 12 large animals. The page hides it.
- `wild.needs` (the Zoopedia's own "required roles") is **incomplete**. For example, it misses the Eurasian Bittern's need for a flourishing Lowland Marsh. The planner therefore uses wikily's `rel.r`.
- Zoopedia `tier` matches the wikily Franchise list exactly (verified).

## Data refresh

All sources block or rate-limit non-browser clients, so the scrapers are DevTools-console scripts. Run each in a normal browser tab on the page named in its header, then save the clipboard output to the file shown.

| Source | Script | Output | Notes |
|---|---|---|---|
| planetzoogame.com/2/zoopedia | `zoopedia.console.js` | `data/raw/zoopedia_packed.json`, then `python3 scripts/decode_zoopedia.py` | Nuxt app. The index is in `useNuxtApp().payload`, each species page embeds `__NUXT_DATA__` (devalue format), and labels come from `useNuxtApp().$i18n`. About 2 minutes. Keep the tab focused, because a background tab stalled the first run. Last export: 5 Oct 2026, with reveals up to 13 Oct. |
| wikily.gg/planet-zoo-2/release-groups | `wikily.console.js` | `data/wiki.json` | Returns HTTP 429 above roughly one request every 2 seconds, so the script fetches one page at a time with a 2.5-second pause (about 6 minutes). The index only lists 100 species (pagination not solved), so it adds `EXTRA_SLUGS`. Read on 21 Oct 2026. |
| wikily.gg/planet-zoo-2/accreditation | `accreditation.console.js` | `data/career_tiers.json` | Reads the Career/Franchise tab panels. Re-run on 21 Oct 2026 and the output matched the stored file exactly. |

The scrapers were assembled from the snippets that ran during the original session. Each step has produced the stored data, but `zoopedia.console.js` and `wikily.console.js` have not been run end to end in their assembled form. Check the output when you first use them. `npm run build` fails if species don't join across the sources.

## Known limits and open questions

- **Planner assumptions:**
  - A role counts reserve-wide once any released species fills it. The game may require the animal to live inside that specific ecosystem area.
  - The planner doesn't track whether you've built the ecosystems, the release group composition, the research level or nests. It only shows them.
- "Montane Forest" in Sweden is not mapped to "Montane Forest (Boreal)". That only matters if a species ever needs it to flourish there.
- Career mode can also gift animals through scenarios. That isn't modelled.
- The Save-file prompt hasn't been tested in the live artifact viewer. Everything else has been tested in jsdom, and the published page has been checked visually.
- No-one has decided whether species filter state should be included in exported plans.

## Version history (published artifact)

1. Species finder (search, filters, cards and table, detail drawer)
2. Reserve planner tab built on wikily.gg data (unrequested scope; see Working with Paul)
3. Plan export and import
4. Fix: unreadable ghost buttons on the dark summary bar
5. Fix: tier label was off by one (Zoopedia tiers are 0-based)
6. Tier-reached dropdown shared by both tabs
7. Count text shows how many species are hidden above the tier
8. Renamed it Franchise accreditation tier
9. Franchise / Career switch with Career tier data
