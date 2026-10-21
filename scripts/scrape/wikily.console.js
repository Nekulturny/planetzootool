// Refresh release groups, reserve requirements and ecosystem data from the wikily.gg Planet Zoo 2 wiki.
//
// Where: paste into the browser DevTools console on https://wikily.gg/planet-zoo-2/release-groups
// Takes about 6 minutes: the wiki rate-limits (HTTP 429) above roughly one request every 2 seconds,
// so pages are fetched one at a time with a pause and a back-off on 429.
// Output: JSON {sp, eco} copied to the clipboard. Save it as data/wiki.json, then `npm test`.
//
// Assembled from the snippets that ran in the original session (Oct 2026).
// Known gap: the release-groups index only lists its first 100 species (pagination was not worked
// out). The rest are fetched by slug from EXTRA_SLUGS; add any new species there.
(async () => {
  const EXTRA_SLUGS = ["white-backed-vulture", "white-tailed-sea-eagle", "wild-boar", "yellow-tang"];
  const DELAY_MS = 2500;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const tbl = tb => [...tb.querySelectorAll("tr")].map(tr => [...tr.children].map(c => c.textContent.trim().replace(/\s+/g, " ")));
  async function get(path) {
    for (let i = 0; i < 6; i++) {
      const r = await fetch(path);
      if (r.status === 429) { await sleep(Math.max(20000, (Number(r.headers.get("retry-after")) || 0) * 1000)); continue; }
      if (!r.ok) throw new Error("HTTP " + r.status + " " + path);
      return new DOMParser().parseFromString(await r.text(), "text/html");
    }
    throw new Error("still rate-limited: " + path);
  }
  const page = async path => {
    const d = await get(path), main = d.querySelector("main") || d.body;
    return { name: main.querySelector("h1")?.textContent.trim(), tables: [...main.querySelectorAll("table")].map(tbl),
      ps: [...main.querySelectorAll("p,h2")].map(e => e.textContent.trim().replace(/\s+/g, " ")).filter(t => t && t.length < 300) };
  };
  const slugsFrom = (doc, section) => [...new Set([...doc.querySelectorAll(`a[href^="/planet-zoo-2/${section}/"]`)].map(a => a.getAttribute("href").split("/").pop()))];

  const spSlugs = [...new Set([...slugsFrom(await get("/planet-zoo-2/release-groups"), "release-groups"), ...EXTRA_SLUGS])];
  const ecoSlugs = slugsFrom(await get("/planet-zoo-2/ecosystems"), "ecosystems");
  console.log(`${spSlugs.length} species, ${ecoSlugs.length} ecosystems to fetch`);

  const sp = {}, eco = {}, failed = [];
  for (const s of spSlugs) {
    try {
      const v = await page("/planet-zoo-2/release-groups/" + s);
      const find = h => v.tables.find(t => t[0] && t[0][0] === h);
      const g = find("Group"), r = find("Requirement type"), e = find("Ecosystem");
      const fillsP = v.ps.find(p => p.startsWith("Roles this species fills once released:"));
      const rlI = v.ps.indexOf("Unlocked"), encI = v.ps.indexOf("Enclosure");
      sp[s] = { n: v.name, rl: rlI >= 0 ? v.ps[rlI + 1] : null, enc: encI >= 0 ? v.ps[encI + 1] : null,
        g: g ? g.slice(1) : [], r: r ? r.slice(1) : [], e: e ? e.slice(1).map(x => x[0]) : [],
        f: fillsP ? fillsP.replace("Roles this species fills once released:", "").split(",").map(x => x.trim()).filter(Boolean) : [] };
    } catch (err) { failed.push(s + ": " + err.message); }
    await sleep(DELAY_MS);
  }
  for (const s of ecoSlugs) {
    try {
      const v = await page("/planet-zoo-2/ecosystems/" + s);
      const find = h => v.tables.find(t => t[0] && t[0][0] === h);
      const o = find("Nature object"), ro = find("Species role"), bi = v.ps.indexOf("Biome");
      eco[s] = { n: v.name, biome: bi >= 0 ? v.ps[bi + 1] : null,
        terrain: (v.ps.find(p => p.startsWith("Terrain:")) || "").replace("Terrain:", "").trim(),
        also: (v.ps.find(p => p.startsWith("Also needs:")) || "").replace("Also needs:", "").trim(),
        o: o ? o.slice(1) : [], ro: ro ? ro.slice(1).map(x => x[0]) : [] };
    } catch (err) { failed.push(s + ": " + err.message); }
    await sleep(DELAY_MS);
  }
  if (failed.length) console.warn("failed:", failed);
  const json = JSON.stringify({ sp, eco });
  window.__wikilyData = json;
  copy(json); // DevTools console utility
  console.log(`done: ${Object.keys(sp).length} species, ${Object.keys(eco).length} ecosystems copied to the clipboard`);
})();
