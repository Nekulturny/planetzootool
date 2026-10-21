// Refresh the Zoopedia data (all species, index + detail pages).
//
// Where: paste into the browser DevTools console on https://www.planetzoogame.com/2/zoopedia
//        (the site blocks non-browser HTTP clients, so this must run in a real browser tab).
// Keep the tab in the foreground while it runs (about 2 minutes): background tabs throttle
// timers and the run stalls.
// Output: the packed export is copied to the clipboard. Save it as data/raw/zoopedia_packed.json,
//         then run `python3 scripts/decode_zoopedia.py` and `npm test`.
//
// Assembled from the snippets that ran in the original session (Oct 2026). The site is a Nuxt app:
// - the index (all species, basic stats) is in useNuxtApp().payload.data[*].animals
// - each species page embeds its detail record in <script id="__NUXT_DATA__"> (devalue format)
// - labels come from the page's own i18n messages (useNuxtApp().$i18n)
(async () => {
  const app = useNuxtApp();
  const i18n = app.$i18n;
  const M = (i18n.messages.value || i18n.messages)["en-GB"];
  const index = Object.values(app.payload.data)
    .filter(v => v && Array.isArray(v.animals))
    .sort((a, b) => b.animals.length - a.animals.length)[0];
  const idx = index.animals;
  console.log(`index: ${idx.length} species, export ${index.exportDate}`);

  // devalue (Nuxt payload) decoder
  function unflatten(values, start) {
    const hyd = {};
    function h(i) {
      if (i === -1) return undefined; if (i === -3) return NaN; if (i === -4) return Infinity; if (i === -5) return -Infinity; if (i === -6) return -0;
      if (i in hyd) return hyd[i];
      const v = values[i];
      if (v === null || typeof v !== "object") { hyd[i] = v; return v; }
      if (Array.isArray(v)) {
        if (typeof v[0] === "string") {
          const t = v[0];
          if (t === "Date") return hyd[i] = new Date(v[1]);
          if (t === "Set") { const s = []; hyd[i] = s; for (let j = 1; j < v.length; j++) s.push(h(v[j])); return s; }
          if (t === "Map") { const o = {}; hyd[i] = o; for (let j = 1; j < v.length; j += 2) o[h(v[j])] = h(v[j + 1]); return o; }
          if (t === "null") { const o = {}; hyd[i] = o; for (let j = 1; j < v.length; j += 2) o[v[j]] = h(v[j + 1]); return o; }
          if (typeof v[1] === "number") return hyd[i] = h(v[1]); // Reactive/ShallowReactive wrappers
          return hyd[i] = null;
        }
        const arr = []; hyd[i] = arr; for (const n of v) { if (n === -2) continue; arr.push(h(n)); } return arr;
      }
      const o = {}; hyd[i] = o; for (const k in v) o[k] = h(v[k]); return o;
    }
    return h(start);
  }
  async function detail(a) {
    const html = await fetch("/2/zoopedia/" + a.Slugs["en-GB"]).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
    const mt = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!mt) throw new Error("no __NUXT_DATA__");
    const values = JSON.parse(mt[1]);
    for (const v of values) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const key = Object.keys(v).find(k => k.startsWith("zoopedia-species-"));
        if (key) { const d = unflatten(values, v[key]); return d.zoopedia || d; }
      }
    }
    throw new Error("species record not found");
  }

  // 1. fetch every detail page (3 at a time, one retry pass)
  const R = {};
  const fetchAll = async list => {
    const queue = [...list];
    const worker = async () => { while (queue.length) { const a = queue.shift(); try { R[a.InternalName] = await detail(a); } catch (e) { console.warn(a.InternalName, e.message); } } };
    await Promise.all([worker(), worker(), worker()]);
  };
  await fetchAll(idx);
  await fetchAll(idx.filter(a => !R[a.InternalName]));
  const missing = idx.filter(a => !R[a.InternalName]).map(a => a.InternalName);
  if (missing.length) throw new Error("detail pages failed: " + missing.join(", "));
  console.log("detail pages fetched:", Object.keys(R).length);

  // 2. build one record per species with English labels
  const T = k => { try { const r = i18n.t(k); return r === k ? null : r; } catch (e) { return null; } };
  const hum = s => s == null ? null : String(s).replace(/^(EN|Feeder|BL|CF|RF)_/, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  const L = (grp, k) => { const g = M[grp]; if (g && g[k] != null) { const v = g[k]; if (typeof v === "string") return v; try { return i18n.t(grp + "." + k); } catch (e) {} } return hum(k); };
  const animals = idx.map(a => ({ a, d: R[a.InternalName], name: T("Animal_" + a.InternalName) || hum(a.InternalName) })).sort((x, y) => x.name.localeCompare(y.name));
  const pos = {}; animals.forEach((x, i) => pos[x.a.InternalName] = i);
  const E = [], Ei = {}; const e = k => { if (!(k in Ei)) { Ei[k] = E.length; E.push(L("enrichmentItems", k)); } return Ei[k]; };
  const rel = arr => (arr || []).map(id => id in pos ? pos[id] : (T("Animal_" + id) || hum(id)));
  const nz = v => (v === undefined ? null : v);
  const out = animals.map(({ a, d, name }) => {
    const s = d.summary, z = d.zooHabitat || {}, mh = z.minimumHabitatRequirements || {}, sp = mh.space || {}, env = mh.environment || {}, gr = z.preferredGroupRanges || {}, si = z.socialInteractions || {}, lc = d.lifecycle || {}, so = lc.social || {}, l = lc.lifecycle || {}, wr = d.wildReserves || {};
    const St = a.Stats || {}, Ba = a.Barrier || {};
    const morphs = ((lc.colourMorphs || {}).colourMorphs || []).map(m => { const am = (M.animalMorph || {})[a.InternalName]; const x = am && am[m.slot]; return (x && x.label) || L("colourMorphLabel", m.variation); });
    return {
      n: name, s: a.Slugs["en-GB"], sc: T("Zoopedia_ScientificName_" + a.InternalName),
      c: s.speciesClass.join(", "), o: s.speciesOrder, f: s.speciesFamily, g: s.speciesGenus,
      cs: L("conservationStatus", s.conservationStatus[0]),
      b: s.biomes.map(x => L("biome", x)), ct: s.continents.map(x => T("Zoopedia_Continent_" + x) || hum(x)),
      h: s.habitatTypes, src: s.speciesSource, cp: hum(s.contentPack), at: s.accreditationTier,
      tg: s.releaseTags.map(x => L("requirementFlags", x)), fe: nz(d.statistics.periodicFoodExpenses),
      sz: [nz(St.SizeMale), nz(St.SizeFemale), nz(St.SizeMeasurement)], wt: [nz(St.WeightMale), nz(St.WeightFemale)],
      br: mh.barrier ? [mh.barrier.grade, mh.barrier.minimumHeight, Ba.ClimbProof ? 1 : 0, Ba.AllowWaterBarrier ? 1 : 0, nz(Ba.WaterBarrierWidth), nz(Ba.WaterBarrierDepth)] : null,
      tp: [env.minTemperature, env.maxTemperature], hu: env.minHumidity != null ? [env.minHumidity, env.maxHumidity] : null, sal: nz(env.salinity),
      tr: (mh.terrain || []).map(t => [L("terrainTypes", t.tag), t.minimum, t.maximum, t.parentTag ? L("terrainTypes", t.parentTag) : null]),
      sp: { l: sp.minimumLandSpace != null ? [sp.minimumLandSpace, sp.landSpacePerAdditionalAnimal] : null, sh: nz(sp.minimumShelterAreaPerAnimal), aq: sp.minimumAquaticSpace != null ? [sp.minimumAquaticSpace, sp.aquaticSpacePerAdditionalAnimal] : null, ds: sp.minimumDeepSwimmingSpace != null ? [sp.minimumDeepSwimmingSpace, sp.deepSwimmingSpacePerAdditionalAnimal] : null, cl: sp.minimumClimbableSpace != null ? [sp.minimumClimbableSpace, sp.climbableSpacePerAdditionalAnimal] : null, fl: sp.minimumFlightSpace != null ? [sp.minimumFlightSpace, sp.flightSpacePerAdditionalAnimal] : null },
      gr: [gr.minimumPopulation, gr.maximumPopulation, nz(gr.maximumMalesInMixedGroup), nz(gr.maximumFemalesInMixedGroup), nz(gr.maximumBachelorMale), nz(gr.maximumBachelorFemale)],
      wk: si.canGuestsWalkThrough === undefined ? null : (si.canGuestsWalkThrough ? 1 : 0), et: mh.enclosureTypes || [],
      tm: nz(si.temperament), mt: nz(si.matingType), od: si.offspringDispersal ? L("maturationType", si.offspringDispersal) : null,
      th: rel(z.thrivingRelationships), ne: rel(z.neutralRelationships),
      en: (z.research?.enrichmentItems || []).map(e), fd: (z.research?.foodEnrichmentItems || []).map(e),
      lc: [nz(l.juvenile), l.adult, l.elderly], rp: [so.sexualMaturityAge, nz(so.ageOfSexualSterility), so.gestationIncubationPeriod, so.interBirthPeriod, nz(so.minimumLitterSize), nz(so.maximumLitterSize), so.breedingSeasons, so.reproductionDifficulty],
      mo: morphs,
      wr: [(wr.socialGroupTypes || []).map(x => L("socialGroup", x)), (wr.suitableEcosystems || []).map(x => L("ecosystem", x)), (wr.wildReserves || []).map(x => L("scenarioNames", x)), wr.requiredRoles || []],
      rv: (a.RevealDate || "").slice(0, 10), ft: a.Featured ? 1 : 0, lv: a.Livecam ? 1 : 0, sf: a.ShoalFish ? 1 : 0
    };
  });

  // 3. pack: repeated label strings go into a shared table S (decode_zoopedia.py reverses this)
  const strF = ["c", "o", "f", "g", "cs", "b", "ct", "h", "src", "cp", "tg", "et", "tm", "mt", "od", "mo"];
  const freq = {};
  const bump = v => { if (typeof v === "string") freq[v] = (freq[v] || 0) + 1; else if (Array.isArray(v)) v.forEach(bump); };
  out.forEach(a => { strF.forEach(k => bump(a[k])); bump(a.sz[2]); a.tr.forEach(t => { bump(t[0]); bump(t[3]); }); bump(a.rp[7]); a.wr.forEach(bump); });
  const S = Object.keys(freq).filter(k => freq[k] >= 2).sort((a, b) => freq[b] - freq[a]);
  const Si = {}; S.forEach((s, i) => Si[s] = i);
  const enc = v => (typeof v === "string" && v in Si) ? Si[v] : v;
  const ea = arr => Array.isArray(arr) ? arr.map(enc) : enc(arr);
  const rows = out.map(a => [a.n, a.s, a.sc, enc(a.c), enc(a.o), enc(a.f), enc(a.g), enc(a.cs), ea(a.b), ea(a.ct), ea(a.h), enc(a.src), enc(a.cp), a.at, ea(a.tg), a.fe, [a.sz[0], a.sz[1], enc(a.sz[2])], a.wt, a.br, a.tp, a.hu, a.sal, a.tr.map(t => [enc(t[0]), t[1], t[2], enc(t[3])]), [a.sp.l, a.sp.sh, a.sp.aq, a.sp.ds, a.sp.cl, a.sp.fl], a.gr, a.wk, ea(a.et), enc(a.tm), enc(a.mt), enc(a.od), a.th, a.ne, a.en, a.fd, a.lc, [...a.rp.slice(0, 7), enc(a.rp[7])], ea(a.mo), a.wr.map(ea), a.rv, a.ft, a.lv, a.sf]);
  const packed = JSON.stringify({ S, E, D: index.exportDate, R: rows });
  window.__zoopediaPacked = packed;
  copy(packed); // DevTools console utility
  console.log(`done: ${rows.length} species, ${packed.length.toLocaleString()} chars copied to the clipboard (also in window.__zoopediaPacked)`);
})();
