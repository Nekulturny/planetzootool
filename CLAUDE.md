# Zoopedia Finder — Project Conventions

Read this fully before touching anything. The rules in short: docs first, CR-tagged changes,
R-versions, a branch per change, `main` = released.

---

## What this project is

A single-file HTML companion for **Planet Zoo 2** (an unofficial fan tool), built for Paul's
own play in Franchise and Career mode. Two tabs:

- **Species** — all 136 Zoopedia species with search, filters, card and table views and a
  detail drawer.
- **Reserve planner** — for each of the six wildlife reserves: which species can be released
  now, which wait on other animals, and what each release unlocks. Progress is ticked by hand
  and saved to a plan file.

A shared **Accreditation** control (Franchise / Career plus "tier reached") filters both tabs.

Owner: Paul de Graaff. Built in a Claude Chat session 19–21 Oct 2026, moved into Git
21 Oct 2026.

## Tool inventory and status

| Tool | Status |
|---|---|
| Zoopedia Finder R1.0.2 | **R1.0.1 released 21 Oct 2026** as artifact https://claude.ai/artifact/Qh8ktsp29rPzG4j6bB3HEM version 10 (R1.0.0 = version 9; R1.0.1 = CR-001, version label in the masthead). **R1.0.2 (CR-002) built**: the page works outside claude.ai, and the build also writes `index.html` for the public site https://nekulturny.github.io/planetzootool/ (rule spec §8a). 17-test jsdom suite, passing. Rule spec `docs/Zoopedia_Finder_Rules.md` v1.2. EN only. |

Highest CR: **CR-002**.

---

## Non-negotiable architecture

1. **One deliverable = one self-contained HTML page**, built from `src/template.html` plus
   `data/*.json` by `scripts/build.py` (Python 3, standard library only) into two files with the
   same page inside (rule spec §8a): `dist/zoopedia-finder.html` for the claude.ai artifact, and
   `index.html`, a complete document, for the public site and for sharing as a file. The build
   only inlines the data: no bundler, no runtime dependencies, no scripts from anywhere. Google
   Fonts is the only external resource, each font with a fallback stack. **Never hand-edit
   `dist/` or `index.html`**: change the template or the data, rebuild, commit all of them.

2. **Everything runs client-side.** No fetch to any endpoint. The page must work as a claude.ai
   artifact (host wrapper and CSP: rule spec §8), on the public site and opened from disk. Check
   a layout or CSS change in a real browser outside claude.ai too: the page once leaned on the
   host's CSS without anyone noticing (CR-002).

3. **The rule spec is written or updated before the code.** `docs/Zoopedia_Finder_Rules.md`
   holds every rule the page applies, the data schema, the plan-file format and the change log.

4. **Game facts come from the data sources, never from memory.** The Zoopedia and wikily.gg
   (rule spec §1) are the only sources. Paul plays both modes and catches inaccuracies quickly:
   when a game fact is unsure, say so instead of guessing. `data/*.json` is scraper output
   (rule spec §9); regenerate it, don't hand-edit it.

5. **Saved state is a contract.** The plan file (`version: 1`, rule spec §6) and the
   localStorage keys `zf-state` / `zf-rv` (§7) hold Paul's progress. Changing their shape is a
   migration: a new plan `version`, and import keeps reading the old one.

---

## Repository and GitHub

- Remote: `origin` = `github.com/Nekulturny/planetzootool`, created by Paul 21 Oct 2026 and
  **public**: everything committed is visible to anyone, so no personal data and no references
  to Paul's work. `main` is the released state: it equals the published artifact, and **pushing
  `main` publishes the public site** (GitHub Pages from the repository root). Work on a branch;
  fast-forward into `main` when Paul approves.
- **Push only when Paul asks.** Never force-push, rewrite history or delete a remote ref
  without his explicit go-ahead for that specific action.
- The handover as received is tagged `archive/claude-chat-handover`.
- **Releasing**, only after Paul approves the change, has two steps: push `main` (the public
  site updates itself within a few minutes), and republish the artifact. In a Claude session
  with the Artifact tool: publish `dist/zoopedia-finder.html` with `url` set to the artifact
  link above and keep `capabilities: {downloads: true}`. Record the new artifact version in the
  rule spec change log.

## Working with Paul

- Execution first. When the task is clear, do it and report the result. Don't turn it into a
  consultation and don't explain what you're about to do.
- **Ask before going significantly beyond the requested scope.** He said so explicitly after
  the reserve planner was added when he had only asked for existing tools. Small fixes to
  defects you introduced are fine. New features need a yes first; ideas go into `BACKLOG.md`.
- Be direct and concise, without filler. Flag real problems briefly.
- Accuracy over helpfulness. Never describe something as tested unless the tests ran in this
  session. Report plainly: what changed, how it was verified, what is still open.

## Change tracking and versions

- Inline changes carry `CR-0xx` comments in the source (e.g. `// CR-001: version label`). Use
  the next free number and note it in the rule spec change log (§11). Series starts at CR-001.
- Versioning is `R<major>.<minor>.<patch>`: patch = fix or display-only change, minor = new
  feature, major = a change that breaks saved plans or state. R1.0.0 = artifact version 9.
- The version shows in the page masthead from CR-001 on. The filename stays
  `dist/zoopedia-finder.html` (the artifact is republished in place from it, and Git holds the
  history) unless Paul decides otherwise.

---

## Required workflow

**Docs first, then build, then verify.** In that order, every time.

1. Update the rule spec in `docs/` (rule, change-log row, CR number).
2. Change `src/template.html` and/or the data, then `npm run build`.
3. `npm test` — must pass before the work counts as done. A changed rule gets a new assertion
   whose expected value comes from the spec or the game, not from running the code. When a data
   refresh moves the hard-coded counts, update them and say which moved and why.

Do not skip step 3 because the change looks small.

## Layout

```
src/template.html          the page: HTML, CSS and JS in one file, with a /*__DATA__*/ placeholder
data/animals.json          Zoopedia data, 136 species (schema: rule spec §2)
data/wiki.json             wikily.gg: release groups and requirements (104 species), 32 ecosystems
data/career_tiers.json     {"Species name": Career accreditation tier 1-4}
data/raw/zoopedia_packed.json   raw packed Zoopedia export (input to decode_zoopedia.py)
scripts/build.py           template + data -> dist/zoopedia-finder.html (validates joins, fails loudly)
scripts/decode_zoopedia.py packed export -> data/animals.json
scripts/scrape/*.console.js     browser-console scrapers that refresh the data (rule spec §9)
tests/smoke.test.js        jsdom smoke test that drives the UI and checks known results
dist/zoopedia-finder.html  the built page for the claude.ai artifact
index.html                 the same page as a complete document: public site and shareable file
.nojekyll                  tells GitHub Pages to publish the files as they are
docs/Zoopedia_Finder_Rules.md   rule specification and change log
```

## Build and test

```
npm install          # jsdom 24.1.3, only needed for the tests (package-lock.json pins the tree)
npm run build        # python3 scripts/build.py (writes dist/zoopedia-finder.html and index.html)
npm test             # build + tests/smoke.test.js (17 tests)
```

Python 3 only, no packages. All file I/O is explicit UTF-8 (species names include
"Galápagos"). The tests hard-code numbers from the current data, for example 19 species ready
in Great Rift Valley and 65 species at Franchise Tier 2.

## Code map (`src/template.html`)

- **Species tab:** `st` is the filter state (`fresh()` gives the defaults, `SETS` lists the chip
  groups), saved to `zf-state`. `matches(a)` applies every filter including the tier cap;
  `render()` draws the count, active-filter chips and the cards or table; `syncControls()`
  mirrors state into the controls. `REL[i][j]` holds the relationships. `openDetail(i)` opens
  the drawer.
- **Accreditation:** `tierMode`, `tierCap`, `tierOf(a)`; `setTier()` / `syncTier()`.
- **Planner:** `RESERVES`, `ecoSlug()`, `parseReq()`, `evaluate()`, `wavesFor()` (cached on the
  plan per mode and tier), `PLAN[reserveId]`. `rv` (view, reserve, released, tier, mode) is
  saved to `zf-rv`. `renderReserves()` draws the tab.
- **Plan file:** `planText()`, `parsePlan()`, `renderIO()`, `ioAction()`.

## House style

- Colours are CSS custom properties on `:root`, with dark-mode overrides under
  `prefers-color-scheme` and `[data-theme]`. Add any new colour to **all three** blocks.
- The look follows planetzoogame.com (olive band, cream background, chunky display type:
  Lilita One, Barlow, Barlow Condensed) but uses none of its logos or artwork.
- It works at phone width: the filters become a slide-in panel and the planner columns stack.
  Keep it that way.

## Data source gotchas

- Zoopedia `tier` is **0-based**; the page shows `tier + 1`. Always go through `tierOf()`.
- Career has no Tier 5: every species is available by Career Tier 4.
- `weight == [1, 1]` is a source placeholder (12 large animals); the page hides it.
- The Zoopedia's `wild.needs` is incomplete; the planner reads wikily's requirement rows.
- Species names differ in punctuation across sources (*Thomson's* / *Thomsons*, *Galápagos*);
  joins go through `norm()` in `build.py`.
- Every source blocks or rate-limits non-browser clients. A refresh runs the console scrapers
  in a real browser tab; it cannot be done from a cloud session.

---

## Status

21 Oct 2026: handover imported unchanged and verified (build reproduces `dist/` byte for byte,
the file equals the live artifact, 12/12 smoke tests pass). Open work and decisions:
`BACKLOG.md`.
