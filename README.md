# Zoopedia Finder

An unofficial companion for **Planet Zoo 2**: a searchable index of every Zoopedia species and a
wildlife reserve planner, in one self-contained HTML page.

- **Use it:** https://nekulturny.github.io/planetzootool/ — or download `index.html` and open
  it in a browser. Nothing is installed and nothing is sent anywhere; ticks and filters stay in
  your browser. Export a plan file from the Reserve planner
  to keep your progress or move it to another browser.
- **Change it:** read [`CLAUDE.md`](CLAUDE.md) first. Rules, data schema and change log:
  [`docs/Zoopedia_Finder_Rules.md`](docs/Zoopedia_Finder_Rules.md). Open work:
  [`BACKLOG.md`](BACKLOG.md).

## Build and test

Needs Python 3 and Node.js.

```
npm install    # once: installs jsdom for the tests
npm test       # rebuilds dist/zoopedia-finder.html, then runs the smoke tests
```

Expected: `wrote dist/zoopedia-finder.html (… bytes, 136 species)`, `wrote index.html (… bytes,
standalone page)`, then `17 tests passed`.

## Data

Species data comes from the public Zoopedia pages on planetzoogame.com; release groups,
reserve requirements, ecosystems and accreditation tiers from the wikily.gg Planet Zoo 2 wiki.
How to refresh it: rule spec §9.
