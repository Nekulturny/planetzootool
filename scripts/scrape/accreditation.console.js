// Refresh Career accreditation tiers from the wikily.gg wiki.
//
// Where: paste into the browser DevTools console on https://wikily.gg/planet-zoo-2/accreditation
// Output: {"Species name": careerTier, ...} copied to the clipboard. Save it as data/career_tiers.json.
// It also prints the Franchise counts per tier: these should match the Zoopedia's own
// accreditationTier (0-based) in data/animals.json, which is what the page uses for Franchise.
(() => {
  const career = {}, franchise = {};
  const tablists = [...document.querySelectorAll('[role="tablist"]')].filter(tl => /Career|Franchise/.test(tl.textContent));
  tablists.forEach((tl, i) => {
    const tier = i + 1;
    tl.querySelectorAll('[role="tab"]').forEach(tab => {
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      const names = panel ? [...new Set([...panel.querySelectorAll("a, li")].map(x => x.textContent.trim()).filter(Boolean))] : [];
      const target = /^Career/.test(tab.textContent.trim()) ? career : franchise;
      names.forEach(n => { target[n] = tier; });
    });
  });
  const count = m => Object.values(m).reduce((acc, t) => (acc[t] = (acc[t] || 0) + 1, acc), {});
  console.log("Career per tier:", count(career), "total", Object.keys(career).length);
  console.log("Franchise per tier:", count(franchise), "total", Object.keys(franchise).length);
  const sorted = Object.fromEntries(Object.keys(career).sort().map(k => [k, career[k]]));
  copy(JSON.stringify(sorted)); // DevTools console utility
  window.__careerTiers = sorted;
  console.log("Career tiers copied to the clipboard");
})();
