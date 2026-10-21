// Smoke test for dist/zoopedia-finder.html. Run: npm test (builds first).
// Loads the built page in jsdom, drives the UI the way a user would and checks
// known results from the current data set. Update the expected numbers when the
// data is refreshed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "dist", "zoopedia-finder.html"), "utf8");
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.message));
// The artifact host wraps the file in <html><head><body>; mimic that here.
const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
  runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.test/"
});
const w = dom.window, d = w.document;
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};

const $ = id => d.getElementById(id);
const text = id => $(id).textContent.replace(/\s+/g, " ").trim();
const click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const choose = (id, value) => { const s = $(id); s.value = value; s.dispatchEvent(new w.Event("change", { bubbles: true })); };
const cardNames = () => [...d.querySelectorAll(".card h3")].map(x => x.textContent);
const planRows = () => [...d.querySelectorAll("#rvSpecies .sprow")];
const row = name => planRows().find(r => r.querySelector(".sp-name").textContent === name);
const statusOf = name => row(name).querySelector(".stp").textContent;
const tick = name => { const cb = row(name).querySelector("input[data-rel]"); cb.checked = true; cb.dispatchEvent(new w.Event("change", { bubbles: true })); };

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("ok -", name); }

test("page loads without script errors", () => assert.deepEqual(errors, []));

// CR-001: version label in the masthead (rule spec §0a)
test("masthead shows the version, species count and export date", () =>
  assert.equal(text("bandMeta"), "R1.0.2 · 136 species · data export 5 Oct 2026"));

test("species tab shows all 136 species", () => assert.match(text("count"), /^136 of 136 species/));

test("walk-through filter", () => {
  click(d.querySelector('[data-walk="yes"]'));
  assert.match(text("count"), /^42 /);
  click(d.querySelector('[data-walk="any"]'));
});

test("shares-a-habitat-with filter (thriving only)", () => {
  const sel = $("compatAdd");
  sel.value = [...sel.options].find(o => o.textContent.startsWith("Blue Wildebeest ")).value;
  sel.dispatchEvent(new w.Event("change", { bubbles: true }));
  click(d.querySelector('[data-cm="thriving"]'));
  assert.match(text("count"), /^11 /);
  click($("resetAll"));
});

test("every species detail panel opens", () => {
  for (let i = 0; i < 136; i++) w.eval(`openDetail(${i})`);
  w.eval("closeDetail()");
  assert.deepEqual(errors, []);
});

test("Franchise tier limit hides higher-tier species", () => {
  choose("tierSel", "2");
  assert.match(text("count"), /^65 of 136 species · 71 above Franchise Tier 2 hidden/);
  choose("tierSel", "4");
  assert.match(text("count"), /^126 of 136/);
});

test("Career mode uses Career tiers", () => {
  choose("modeSel", "career");
  choose("tierSel", "1");
  assert.ok(cardNames().includes("Lion"));
  assert.ok(!cardNames().includes("Black Wildebeest"));
  choose("tierSel", "4");
  assert.match(text("count"), /^136 of 136 species$/);
  choose("modeSel", "franchise");
  choose("tierSel", "0");
});

test("reserve planner: Great Rift Valley starting state", () => {
  click($("tabReserves"));
  click(d.querySelector('[data-res="grv"]'));
  assert.match(text("rvSummary"), /0\/27Released 19Ready now 8Waiting/);
  assert.equal(statusOf("Lion"), "Waiting");
});

test("reserve planner: prerequisites unlock the Lion", () => {
  ["Blue Wildebeest", "Black Rhinoceros", "Secretarybird"].forEach(tick);
  assert.equal(statusOf("Lion"), "Ready now");
});

test("reserve planner respects the tier limit", () => {
  choose("tierSel", "3");
  const leopard = row("African Leopard").textContent;
  assert.match(leopard, /only available from Tier 4/); // Dense Forest needs a High Browser (giraffes are Tier 4)
  choose("tierSel", "0");
});

test("plan export and import round trip", () => {
  choose("modeSel", "career"); choose("tierSel", "3");
  click(d.querySelector('[data-io="export"]'));
  const exported = $("ioOut").value;
  const plan = JSON.parse(exported);
  assert.equal(plan.kind, "reserve-plan");
  assert.equal(plan.mode, "career");
  assert.equal(plan.tier, 3);
  assert.deepEqual(plan.released["Great Rift Valley Reserve"], ["Black Rhinoceros", "Blue Wildebeest", "Secretarybird"]);

  w.eval('rv.released = {}; saveRv(); renderReserves();');
  choose("modeSel", "franchise"); choose("tierSel", "0");
  click(d.querySelector('[data-io="import"]'));
  $("ioIn").value = "not a plan";
  click(d.querySelector('[data-io="readtext"]'));
  assert.match(text("rvIO"), /isn't plan text from this page/);
  $("ioIn").value = exported;
  click(d.querySelector('[data-io="readtext"]'));
  click(d.querySelector('[data-io="apply"]'));
  assert.equal($("modeSel").value, "career");
  assert.equal($("tierSel").value, "3");
  assert.match(text("rvSummary"), /^Great Rift Valley Reserve.*3\/27Released/);
});

test("every reserve renders at every tier in both modes", () => {
  for (const mode of ["franchise", "career"]) {
    choose("modeSel", mode);
    for (const t of ["0", "1", "2", "3", "4", "5"]) {
      choose("tierSel", t);
      for (const r of ["grv", "tz", "sum", "sco", "swe", "pol"]) click(d.querySelector(`[data-res="${r}"]`));
    }
  }
  assert.deepEqual(errors, []);
});

// CR-002: standalone build for the public site and for opening from disk (rule spec §8a).
// Loaded exactly as a browser gets it from GitHub Pages: no wrapper added here.
const site = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const siteErrors = [];
const svc = new VirtualConsole();
svc.on("jsdomError", e => siteErrors.push(e.message));
const sw = new JSDOM(site, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: svc, url: "https://example.test/" }).window;
const sd = sw.document;
const shown = id => sw.getComputedStyle(sd.getElementById(id)).display !== "none";

test("standalone page wraps the same page as the artifact build", () => {
  assert.match(site, /^<!doctype html>\n/);
  assert.equal(site.slice(site.indexOf("<body>\n") + 7, site.lastIndexOf("\n</body>")), html);
});

test("standalone page is a complete document: standards mode, UTF-8, phone viewport", () => {
  assert.equal(sd.compatMode, "CSS1Compat");
  assert.equal(sd.documentElement.lang, "en");
  assert.equal(sd.querySelector("head meta[charset]").getAttribute("charset"), "utf-8");
  assert.equal(sd.querySelector('head meta[name="viewport"]').getAttribute("content"), "width=device-width, initial-scale=1");
});

test("standalone page loads without script errors and shows the version", () => {
  assert.deepEqual(siteErrors, []);
  assert.equal(sd.getElementById("bandMeta").textContent, "R1.0.2 · 136 species · data export 5 Oct 2026");
});

test("standalone page shows only the open tab; hidden panels stay hidden", () => {
  assert.ok(shown("speciesView"));
  assert.ok(!shown("reserveView"));
  assert.ok(!shown("rvIO"));
  sd.getElementById("tabReserves").dispatchEvent(new sw.MouseEvent("click", { bubbles: true }));
  assert.ok(!shown("speciesView"));
  assert.ok(shown("reserveView"));
  assert.ok(!shown("rvIO"));
});

console.log(`\n${passed} tests passed`);
