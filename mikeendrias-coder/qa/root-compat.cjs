// Root app backward-compatibility smoke (design-sheet §4 "Old-app compatibility smoke").
// Loads the root app (index.html + app.js) twice: (A) with data/live.json, (B) with a v2 JSON.
// B is sheet/test/out/v2-preview.json when it exists, else it is built here from live.json.
// Data is served by route interception, so nothing on disk changes.
// Usage: node qa/root-compat.cjs [--url http://127.0.0.1:8765/index.html] [--b path/to/v2.json] [--write-b]
// Prints ROOT-COMPAT OK, or the differences (exit 1).
'use strict';
const fs = require('fs');
const path = require('path');
const need = (m) => require(require.resolve(m, { paths: [__dirname, process.cwd(), '/home/michael/work'] }));

const QA = __dirname;
const FV = path.resolve(QA, '..');
const OUT = path.join(QA, 'out');
const DATA_RE = /\/data\/(live|preview)\.json(\?.*)?$/;
const PORDER = ['3', '1', '6', '5', '7', '4', '2'];
const PANEL_STATES = ['Maryland', 'Vermont', 'Kentucky', 'Ohio'];

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const URL = (arg('--url', 'http://127.0.0.1:8765/index.html')).split('#')[0].split('?')[0];

const clone = (x) => JSON.parse(JSON.stringify(x));

// Build a v2 file from live.json the way the Sheet v2 would (contract §5): additive keys only,
// plus the one allowed legacy change (Vermont's law gains " (none of the seven)").
function synthV2(live) {
  const d = clone(live);
  d.schema = 2;
  d.generator = 'Face Value sheet 2.0.0';
  const c = d.config;
  const WHY = {
    '1': 'A judge checks the reason before police search.',
    '2': 'People can only challenge a match they know about.',
    '3': 'Keeps face scans for the most serious cases.',
    '4': 'A match is a lead. It can be wrong.',
    '5': 'Bad matches have led to wrong arrests.',
    '6': 'Scanning crowds tracks everyone in view.',
    '7': 'Trained users catch more bad matches.',
  };
  for (const k of Object.keys(c.prot)) { c.prot[k].why = WHY[k] || 'Why it matters.'; c.prot[k].order = PORDER.indexOf(k) + 1; }
  c.words = { 'offline.heading': 'Face Value is offline for now', 'risk.linkText': 'Read more', 'risk.url': 'https://example.com/face-value-read-more' };
  c.site = { status: 'live', currentThrough: '2026-10-26', billYear: '2026' };
  const qi = d.quotes.findIndex((q) => q.state === 'Maryland' && q.rule === '3' && q.kind === 'Law');
  c.leadQuotes = qi >= 0 ? { [`Maryland|${d.quotes[qi].item}|3`]: qi } : {};
  c.examples = [
    { id: 'montana-shoplifting', t: 'Shoplifting in Montana', d: 'A store camera catches a shoplifter.', lesson: 'Montana keeps face scans for serious crimes.', state: 'Montana', who: 'local', src: 'cctv', db: 'mug', crime: 'minor', order: 1 },
    { id: 'indiana-lineup', t: 'The lineup loophole', d: 'A face match puts someone in a lineup.', lesson: 'Watch the arrest step.', state: 'Indiana', who: 'local', src: 'photo', db: 'dmv', crime: 'serious', order: 2 },
    { id: 'illinois-drone', t: 'Drone footage in Illinois', d: 'Police use drone video.', lesson: 'Illinois limits drone footage.', state: 'Illinois', who: 'local', src: 'drone', db: 'dmv', crime: 'serious', order: 3 },
    { id: 'kentucky-no-limits', t: 'A law with no limits', d: 'Kentucky has a law with none of the seven.', lesson: 'A law can exist and still add none.', state: 'Kentucky', who: 'local', src: 'photo', db: 'dmv', crime: 'minor', order: 4 },
  ];
  const vt = d.states.find((s) => s.name === 'Vermont');
  if (vt && !/none of the seven/i.test(vt.law)) vt.law += ' (none of the seven)';
  return d;
}

const norm = (t) => (t == null ? null : String(t).replace(/\s+/g, ' ').trim());

async function collect(browser, data, label) {
  const snap = { errors: [] };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript("try{localStorage.setItem('fv-seen','1')}catch(e){}");
  const body = JSON.stringify(data);
  await ctx.route(DATA_RE, (r) => r.fulfill({ status: 200, contentType: 'application/json', body }));
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => snap.errors.push('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') snap.errors.push('console: ' + m.text()); });
  const open = async (h, q = '') => {
    await pg.goto('about:blank'); await pg.goto(URL + q + h);
    await pg.waitForFunction(() => document.querySelectorAll('#tiles .tile').length > 0 || document.querySelector('.loadfail'), null, { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(500);
  };
  try {
    // tiles
    await open('#tab=state&state=Maryland');
    snap.tiles = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#tiles .tile')].map((t) => [t.dataset.state, [...t.classList].filter((c) => /^l[0zb1-4]$/.test(c)).join(' ')])));
    // state panels
    snap.panels = {};
    for (const st of PANEL_STATES) {
      await open('#tab=state&state=' + encodeURIComponent(st));
      snap.panels[st] = await pg.evaluate(() => ({
        name: document.getElementById('s-name').textContent,
        hud: document.getElementById('s-hud').textContent, sum: document.getElementById('s-sum').textContent, prots: document.getElementById('s-prots').textContent,
      }));
      for (const k of Object.keys(snap.panels[st])) snap.panels[st][k] = norm(snap.panels[st][k]);
    }
    // story presets: load each, jump to step 6, read the verdict
    await open('#tab=case&state=Maryland');
    const nStories = await pg.locator('#schips .schip').count();
    snap.stories = [];
    for (let i = 0; i < nStories; i++) {
      await open('#tab=case&state=Maryland');
      await pg.locator(`#schips .schip[data-preset="${i}"]`).click({ timeout: 3000 });
      await pg.waitForTimeout(400);
      await pg.locator('.station[data-i="5"]').click({ timeout: 3000 });
      await pg.waitForTimeout(900);
      snap.stories.push(await pg.evaluate(() => {
        const v = document.querySelector('#stepbody .verdict-row');
        return { hash: location.hash, verdict: v ? (v.textContent + ' | ' + (v.nextElementSibling ? v.nextElementSibling.textContent : '')).replace(/\s+/g, ' ').trim() : null };
      }));
    }
    // Read the laws: tab counts, row counts, and the "2026" search
    await open('#/laws');
    snap.laws = { tabs: await pg.evaluate(() => [...document.querySelectorAll('#ltabs [data-lt]')].map((b) => b.textContent.replace(/\s+/g, ' ').trim())) };
    for (const k of ['laws', 'bills', 'quotes']) {
      await pg.locator(`#ltabs [data-lt="${k}"]`).click(); await pg.waitForTimeout(150);
      await pg.fill('#l-q', ''); await pg.waitForTimeout(100);
      const all = await pg.textContent('#l-count');
      await pg.fill('#l-q', '2026'); await pg.waitForTimeout(250);
      const hit = await pg.textContent('#l-count');
      snap.laws[k] = { all: norm(all), search2026: norm(hit) };
    }
    // quote drawers: an exact-wording row, and a Maryland protection
    await open('#/laws/wording');
    await pg.locator('#ltable .lrow').first().click({ timeout: 3000 }); await pg.waitForTimeout(400);
    snap.quoteDrawer = await pg.evaluate(() => ({ on: document.getElementById('drawer').classList.contains('on'), title: document.getElementById('d-title').textContent.replace(/\s+/g, ' ').trim(), body: document.getElementById('d-body').textContent.replace(/\s+/g, ' ').trim() }));
    await open('#tab=state&state=Maryland');
    await pg.locator('#s-prots .prot:not(.banrow)').first().click({ timeout: 3000 }); await pg.waitForTimeout(400);
    snap.protDrawer = await pg.evaluate(() => ({ on: document.getElementById('drawer').classList.contains('on'), title: document.getElementById('d-title').textContent.replace(/\s+/g, ' ').trim(), body: document.getElementById('d-body').textContent.replace(/\s+/g, ' ').trim() }));
    // ?preview bar
    await open('#tab=state&state=Maryland', '?preview');
    snap.preview = await pg.evaluate(() => { const b = document.querySelector('.previewbar'); return { bar: !!b, role: b && b.getAttribute('role') }; });
  } catch (e) {
    snap.errors.push(`harness (${label}): ${String(e.message).split('\n')[0]}`);
  } finally { await ctx.close(); }
  return snap;
}

function diff(a, b, p = '', out = []) {
  if (out.length > 60) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p ? `${p}.${k}` : k, out);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    const ta = JSON.stringify(a) || 'undefined', tb = JSON.stringify(b) || 'undefined';
    let i = 0; while (i < ta.length && ta[i] === tb[i]) i++;
    const from = Math.max(0, i - 50);
    const s = (t) => (from ? '…' : '') + t.slice(from, from + 150) + (t.length > from + 150 ? '…' : '');
    out.push(`${p}: A=${s(ta)} B=${s(tb)}`);
  }
  return out;
}

(async () => {
  const live = JSON.parse(fs.readFileSync(path.join(FV, 'data/live.json'), 'utf8'));
  const given = arg('--b', null);
  const s1 = path.join(FV, 'sheet/test/out/v2-preview.json');
  let B, bFrom;
  if (given) { B = JSON.parse(fs.readFileSync(given, 'utf8')); bFrom = given; }
  else if (fs.existsSync(s1)) { B = JSON.parse(fs.readFileSync(s1, 'utf8')); bFrom = path.relative(FV, s1); }
  else { B = synthV2(live); bFrom = 'synthesized from data/live.json'; }
  if (args.includes('--write-b')) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'root-compat-b.json'), JSON.stringify(B, null, 1)); }
  console.log(`A: data/live.json   B: ${bFrom} (schema ${B.schema})`);

  const { chromium } = need('playwright');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  let A, Bs;
  try { A = await collect(browser, live, 'A'); Bs = await collect(browser, B, 'B'); } finally { await browser.close(); }

  const problems = [];
  for (const [lab, s] of [['A', A], ['B', Bs]]) for (const e of s.errors) problems.push(`${lab} error: ${e.slice(0, 200)}`);
  // sanity of the A run itself, so an empty page cannot pass
  if (Object.keys(A.tiles || {}).length !== 51) problems.push(`A has ${Object.keys(A.tiles || {}).length} tiles, want 51`);
  if (!A.stories || !A.stories.length || A.stories.some((x) => !x.verdict)) problems.push('A: a story preset gave no step-6 verdict');
  if (!A.quoteDrawer || !A.quoteDrawer.on) problems.push('A: the quote drawer did not open');
  if (!A.protDrawer || !A.protDrawer.on) problems.push('A: the protection drawer did not open');
  if (!A.preview || !A.preview.bar) problems.push('A: no preview bar with ?preview');
  if (!Bs.preview || !Bs.preview.bar) problems.push('B: no preview bar with ?preview');
  const strip = (s) => { const c = clone(s); delete c.errors; if (c.preview) delete c.preview.text; return c; };
  for (const d of diff(strip(A), strip(Bs))) problems.push('differs: ' + d);

  const summary = `tiles ${Object.keys(A.tiles || {}).length}, panels ${PANEL_STATES.join('/')}, stories ${A.stories ? A.stories.length : 0}, laws ${JSON.stringify(A.laws && A.laws.laws)} bills ${JSON.stringify(A.laws && A.laws.bills)} quotes ${JSON.stringify(A.laws && A.laws.quotes)}`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'root-compat.json'), JSON.stringify({ bFrom, A, B: Bs, problems }, null, 1));
  console.log('compared: ' + summary);
  if (problems.length) { problems.slice(0, 60).forEach((p) => console.log('  - ' + p)); console.log(`ROOT-COMPAT FAIL ${problems.length}`); process.exit(1); }
  console.log('ROOT-COMPAT OK'); process.exit(0);
})().catch((e) => { console.error(e); console.log('ROOT-COMPAT FAIL (crash)'); process.exit(1); });
