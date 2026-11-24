// Worst-case data sets for the play/ page (design §5.4, break-ui).
// node qa/worst-data.cjs                 writes qa/out/worst/<name>.json
// node qa/worst-data.cjs --run [--url http://127.0.0.1:8765/play/] [--only long-names,slow-network]
//   loads the page at 390 and 1440 with each set (served by route interception) and reports console errors,
//   clipping, overlap, sideways scroll, visible placeholders, alert calls, javascript: links and injected HTML.
//   The slow-network case throttles to 400 kbps with 400 ms RTT at 390, checks the loading state and CLS < 0.1.
// Last line of --run: WORST ISSUES N (exit 1 when N > 0).
// require('./worst-data.cjs').build() returns { name: dataObject } for other scripts.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const QA = __dirname;
const FV = path.resolve(QA, '..');
const OUT = path.join(QA, 'out', 'worst');
const clone = (x) => JSON.parse(JSON.stringify(x));
const readLive = () => JSON.parse(fs.readFileSync(path.join(FV, 'data/live.json'), 'utf8'));

const INJ = '<img src=x onerror=alert(1)>';
const TOKEN45 = 'Facialrecognitionaccountabilitytransparencyx'.padEnd(45, 'z').slice(0, 45);
const FILL = 'and further amendments to the criminal procedure article concerning police use of biometric systems';
const LONG_QUOTE = ('"Police **may not** use facial recognition ((unless a court approves)) and [[except in an emergency]] ' +
  'the agency shall keep records of every search, the reason for it, the person who ran it and the result, and shall report them each year. ').repeat(8).slice(0, 1499) + '"';
const LONG_CITE = 'Md. Code Ann., Crim. Proc. § 2-501 https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcp&section=2-501&enactments=false&extra=' + 'x'.repeat(60);
const INTL = '🛑👁️ 顔認識の法律 Закон о распознавании лиц';
const RTL = 'قانون التعرف على الوجه';

function loadWords() {
  const p = path.join(FV, 'play/words.js');
  if (!fs.existsSync(p)) return null;
  try { const sb = {}; sb.window = sb; sb.self = sb; vm.runInNewContext(fs.readFileSync(p, 'utf8'), sb, { timeout: 2000 }); if (sb.FV_WORDS) return sb.FV_WORDS; } catch (e) {}
  try { const m = require(p); if (m && m.FV_WORDS) return m.FV_WORDS; } catch (e) {}
  return null;
}

// pad a law or bill name to exactly 160 characters with a 45-character unbroken token, keeping any "(…)" tail
function longName(name) {
  const m = /^(.*?)(\s*\([^()]*\))?$/.exec(name); const head = m[1], tail = m[2] || '';
  let mid = ` ${TOKEN45} ${FILL} ${FILL}`;
  const room = 160 - head.length - tail.length;
  mid = mid.slice(0, Math.max(0, room)).replace(/\s+$/, (s) => s.replace(/\s/g, 'y'));
  return (head + mid + tail).slice(0, 160).padEnd(160, 'y');
}
function rename(d, state, from, to) {
  for (const l of d.laws || []) if (l.state === state && l.name === from) l.name = to;
  for (const b of d.bills || []) if (b.state === state && b.name === from) b.name = to;
  for (const q of d.quotes || []) if (q.state === state && q.item === from) q.item = to;
  const lq = d.config && d.config.leadQuotes;
  if (lq) for (const k of Object.keys(lq)) { const [s, n, r] = k.split('|'); if (s === state && n === from) { lq[`${s}|${to}|${r}`] = lq[k]; delete lq[k]; } }
}
const firstLaw = (d, st, withRules = true) => d.laws.find((l) => l.state === st && (!withRules || (l.rules && l.rules.length)));
const offlineSite = (extra) => Object.assign({ status: 'offline', currentThrough: '2026-10-26', billYear: '2026' }, extra || {});

function build(base) {
  const live = base ? clone(base) : readLive();
  const sets = {};
  const mk = (name, fn) => { const d = clone(live); fn(d); sets[name] = d; };

  mk('long-names', (d) => {
    for (const x of [...d.laws, ...d.bills]) rename(d, x.state, x.name, longName(x.name));
    const q = d.quotes.find((x) => x.state === 'Maryland'); if (q) q.text = LONG_QUOTE;
    for (const l of d.laws) if (l.state === 'Maryland') l.cite = LONG_CITE;
  });
  mk('intl-text', (d) => {
    for (const x of [...d.laws, ...d.bills].filter((x) => ['Maryland', 'Illinois', 'Ohio'].includes(x.state))) {
      rename(d, x.state, x.name, `${INTL} ${x.name} ${RTL}`);
      x.does = `${x.does} ${RTL} 🙂 ${INTL}`;
    }
    for (const q of d.quotes.filter((x) => x.state === 'Maryland')) q.text = `${q.text} ${RTL}`;
  });
  mk('html-injection', (d) => {
    const l = firstLaw(d, 'Maryland'); rename(d, 'Maryland', l.name, `${l.name} ${INJ}`); l.does = `${l.does} ${INJ}`;
    const b = d.bills.find((x) => x.state === 'Maryland'); if (b) { rename(d, 'Maryland', b.name, `${INJ} ${b.name}`); b.does = `${INJ} ${b.does}`; }
    const q = d.quotes.find((x) => x.state === 'Maryland'); if (q) q.text = `${q.text} ${INJ} **${INJ}**`;
    d.config.prot['1'].long = `${d.config.prot['1'].long} ${INJ}`;
    d.config.examples = [{ id: 'inj-test', t: `Test ${INJ}`, d: `Desc ${INJ}`, lesson: `Lesson ${INJ}`, state: 'Maryland', who: 'local', src: 'photo', db: 'dmv', crime: 'serious', order: 1 }];
  });
  mk('empty-quotes', (d) => { d.quotes = []; });
  mk('missing-bits', (d) => {
    const l = firstLaw(d, 'Maryland'); d.quotes = d.quotes.filter((q) => !(q.state === 'Maryland' && q.item === l.name));
    for (const x of d.laws.filter((x) => x.state === 'Illinois')) { x.link = ''; x.cite = ''; }
    const l2 = d.laws.filter((x) => x.state === 'Maryland')[1] || l; l2.link = 'javascript:alert(1)';
    const b = d.bills.find((x) => x.state === 'Maryland'); if (b) b.link = ' JaVaScRiPt:alert(2)';
    const b2 = d.bills.find((x) => x.state === 'Ohio'); if (b2) b2.link = '';
  });
  mk('zero-bills', (d) => { d.bills = []; });
  mk('many-bills', (d) => {
    const year = String(Math.max(...d.bills.map((b) => +b.year || 0)));
    const rules = ['1', '2', '3', '4', '5', '6', '7'];
    for (let i = 0; i < 15; i++) d.bills.push({ state: 'Maryland', name: `HB ${900 + i} (${year})`, pending: i % 2 === 0, year, step: i % 3 ? 'Introduced' : 'Passed one chamber',
      does: `Test bill ${i + 1}: adds rules on police face recognition searches and reports.`, rules: [rules[i % 7]], limits: i % 4 === 0 ? { [rules[i % 7]]: 'lineups only' } : {},
      sponsor: 'Del. Test Sponsor (D)', link: 'https://example.com/bill-' + i });
  });
  mk('odd-rules', (d) => {
    const l = firstLaw(d, 'Maryland'); l.limits = Object.assign({}, l.limits, { [l.rules[0]]: 'moon phase only' });
    const all = ['1', '2', '3', '4', '5', '6', '7'];
    const wy = d.states.find((s) => s.name === 'Wyoming'); if (wy) wy.law = 'New';
    d.laws.push({ whoFor: ['state'], source: null, db: null, state: 'Wyoming', name: 'Test partial act (HB 1)', status: 'New', year: '2026',
      does: 'A test law that covers every protection only in part.', who: 'State police', rules: all.slice(), limits: Object.fromEntries(all.map((k) => [k, 'lineups only'])),
      review: true, reviewRules: all.slice(), reviewNote: 'Test note: how far it reaches is not settled.', cite: 'Wyo. Stat. § 0-0-000', link: 'https://example.com/wy' });
    const ak = d.states.find((s) => s.name === 'Alaska'); if (ak) ak.law = 'New';
    d.laws.push({ whoFor: ['state'], source: null, db: null, state: 'Alaska', name: 'Test state police ban (SB 2)', status: 'New', year: '2026',
      does: 'State police may not use face recognition.', who: 'State police', rules: [], limits: {}, review: false,
      ban: { who: ['state'], kind: 'Ban', text: "State police can't use face recognition.", except: '' }, cite: 'Alaska Stat. § 0.00.000', link: 'https://example.com/ak' });
  });
  mk('puerto-rico', (d) => { d.states.push({ name: 'Puerto Rico', law: 'No law' }); });
  mk('no-config', (d) => { delete d.config; });
  mk('long-words', (d) => {
    const W = loadWords() || { 'offline.heading': 'Face Value is offline', 'offline.message': 'This page is offline for now.', 'risk.linkText': 'Read more', 'offline.linkText': 'See the live site' };
    d.config.words = {};
    for (const [k, v] of Object.entries(W)) { if (/(url|Url)$/.test(k.split('.').pop()) || typeof v !== 'string' || !v) continue; d.config.words[k] = [v, v, v].join(' '); }
    d.config.prot['3'].short = 'Serious crimes only, plus more words here'.slice(0, 40).padEnd(40, 's');
    for (const k of Object.keys(d.config.prot)) d.config.prot[k].long = [d.config.prot[k].long, d.config.prot[k].long, d.config.prot[k].long].join(' ');
    for (const k of Object.keys(d.config.limits || {})) d.config.limits[k].text = [d.config.limits[k].text, d.config.limits[k].text, d.config.limits[k].text].join(' ');
    d._wordsFrom = loadWords() ? 'play/words.js' : 'fallback keys (play/words.js not loadable)';
  });
  mk('offline-long', (d) => {
    const msg = 'Face Value is offline while the research is updated. '.repeat(12).trim();
    d.config.site = offlineSite({ offlineMessage: msg });
    d.config.words = { 'offline.heading': 'Face Value is offline for a while during the yearly update of every state law and bill', 'offline.message': msg, 'offline.linkText': 'Read the research memo while the page is offline' };
  });
  mk('offline-empty', (d) => {
    d.config.site = offlineSite({ offlineMessage: '' });
    d.config.words = { 'offline.heading': '', 'offline.message': '', 'offline.linkText': '' };
  });
  mk('offline-from', (d) => { d.config.site = { status: 'live', currentThrough: '2026-10-26', billYear: '2026', offlineFrom: '2020-01-01' }; });
  for (const d of Object.values(sets)) delete d._wordsFrom;
  return sets;
}

// which hashes each set is loaded at, and what it must show
const PLAN = {
  'long-names': { hashes: ['#/', '#/maryland', '#/maryland/case', '#/illinois'] },
  'intl-text': { hashes: ['#/maryland', '#/illinois/case', '#/ohio'] },
  'html-injection': { hashes: ['#/', '#/maryland', '#/maryland/case'] },
  'empty-quotes': { hashes: ['#/maryland', '#/vermont'] },
  'missing-bits': { hashes: ['#/maryland', '#/illinois', '#/ohio'] },
  'zero-bills': { hashes: ['#/maryland', '#/ohio'] },
  'many-bills': { hashes: ['#/maryland'] },
  'odd-rules': { hashes: ['#/maryland', '#/wyoming', '#/alaska', '#/alaska/case?police=state', '#/alaska/case'] },
  'puerto-rico': { hashes: ['#/', '#/puerto-rico'], pr: true },
  'no-config': { hashes: ['#/', '#/maryland', '#/maryland/case'] },
  'long-words': { hashes: ['#/', '#/maryland', '#/maryland/case', '#/vermont'] },
  'offline-long': { hashes: ['#/'], offline: true },
  'offline-empty': { hashes: ['#/'], offline: true },
  'offline-from': { hashes: ['#/'], offline: true },
};

async function run(opts) {
  const P = require('./play-qa.cjs');
  const { chromium } = P.need('playwright');
  const sets = build();
  const names = Object.keys(sets).filter((n) => !opts.only || opts.only.includes(n));
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const report = { url: opts.url, results: [] }; let total = 0;
  const print = (label, f) => { console.log(`${label} issues: ${f.length}`); f.slice(0, 8).forEach((x) => console.log('    ' + x)); total += f.length; report.results.push({ case: label, issues: f }); };
  try {
    for (const name of names) for (const w of [390, 1440]) {
      const plan = PLAN[name] || { hashes: ['#/'] };
      const vp = P.VIEWPORTS.find((v) => v.w === w);
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile });
      await ctx.addInitScript(P.INIT);
      const body = JSON.stringify(sets[name]);
      await ctx.route(P.DATA_RE, (r) => r.fulfill({ status: 200, contentType: 'application/json', body }));
      const f = [];
      for (const h of plan.hashes) {
        const pg = await ctx.newPage(); const errs = []; const dialogs = [];
        pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 140)));
        pg.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
        pg.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
        try {
          await pg.goto(opts.url + h);
          if (!(await P.waitReady(pg))) f.push(`${h}: never reached is-ready, is-error or is-offline`);
          const cls = await pg.evaluate(() => document.body.className);
          if (plan.offline && !/\bis-offline\b/.test(cls)) f.push(`${h}: body lacks is-offline`);
          if (!plan.offline && !/\bis-ready\b/.test(cls)) f.push(`${h}: body is "${cls}", want is-ready`);
          if (/\bis-error\b/.test(cls)) f.push(`${h}: load failed (is-error)`);
          // open every accordion in the panel and footer so long text is on screen
          await pg.evaluate(() => { for (const b of [...document.querySelectorAll('#panel .acc-b[aria-expanded="false"], #foot .acc-b[aria-expanded="false"]')].slice(0, 40)) b.click(); });
          await pg.waitForTimeout(300);
          if (plan.pr) {
            const pr = await pg.evaluate(async () => { const tile = !!document.querySelector('.tile[data-st="Puerto Rico"]'); const dd = document.querySelector('#state-dd');
              if (dd) dd.click(); await new Promise((r) => setTimeout(r, 250));
              const opt = [...document.querySelectorAll('#state-dd-list [role=option]')].some((o) => /Puerto Rico/.test(o.textContent));
              return { tile, opt }; });
            if (pr.tile) f.push(`${h}: Puerto Rico has a map tile`);
            if (!pr.opt) f.push(`${h}: Puerto Rico missing from the dropdown`);
          }
          const res = await pg.evaluate(P.PAGE_CHECKS, { only: ['clip', 'overlap', 'placeholder', 'img'] });
          for (const [k, v] of Object.entries(res)) for (const x of v) f.push(`${h} ${k}: ${x}`);
          const x = await pg.evaluate(() => ({
            js: [...document.querySelectorAll('a[href]')].filter((a) => /^\s*javascript:/i.test(a.getAttribute('href'))).map((a) => a.textContent.trim().slice(0, 30)),
            inj: document.querySelectorAll('img[src="x"], [onerror]').length,
            spy: window.__qaDialogs || [],
          }));
          for (const m of P.sidewaysIssues(await pg.evaluate(P.SIDEWAYS), h + ': ')) f.push(m);
          for (const t of x.js) f.push(`${h}: javascript: link kept ("${t}")`);
          if (x.inj) f.push(`${h}: injected HTML became ${x.inj} live element(s)`);
          for (const s of x.spy.concat(dialogs.map((t) => 'native ' + t))) f.push(`${h}: dialog called: ${s}`);
        } catch (e) { f.push(`${h}: harness: ${String(e.message).split('\n')[0].slice(0, 140)}`); }
        for (const e of [...new Set(errs)]) f.push(`${h}: ${e}`);
        await pg.close();
      }
      await ctx.close();
      print(`[${w}] ${name}`, f);
    }
    if (!opts.only || opts.only.includes('slow-network')) print('[390] slow-network', await slowNetwork(browser, opts.url, P));
  } finally { await browser.close(); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(path.join(QA, 'out', 'worst-data.json'), JSON.stringify(Object.assign(report, { total }), null, 1));
  console.log('WORST ISSUES', total);
  return total;
}

async function slowNetwork(browser, url, P) {
  const f = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(P.INIT);
  await ctx.addInitScript(`document.addEventListener('DOMContentLoaded', () => { const b = document.body; const see = () => { if (b.classList.contains('is-loading')) window.__qaSawLoading = true; }; see(); new MutationObserver(see).observe(b, { attributes: true }); });`);
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 140)));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  try {
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1000 / 8, uploadThroughput: 400 * 1000 / 8 });
    const t0 = Date.now();
    await pg.goto(url + '#/maryland', { waitUntil: 'commit', timeout: 60000 });
    let ready = false;
    try { await pg.waitForFunction(() => document.body && /\b(is-ready|is-error|is-offline)\b/.test(document.body.className), null, { timeout: 60000 }); ready = true; } catch (e) {}
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    await pg.waitForTimeout(1000);
    const r = await pg.evaluate(() => ({ saw: !!window.__qaSawLoading, cls: window.__qaCls || 0, body: document.body ? document.body.className : '' }));
    if (!ready) f.push(`never reached is-ready within 60s (body "${r.body}")`);
    else if (!/\bis-ready\b/.test(r.body)) f.push(`ended as "${r.body}", want is-ready`);
    if (!r.saw) f.push('no is-loading state was seen while data loaded');
    if (r.cls >= 0.1) f.push(`layout shift CLS ${r.cls.toFixed(3)} (want < 0.1)`);
    console.log(`    slow-network: ready after ${secs}s, CLS ${r.cls.toFixed(3)}`);
  } catch (e) { f.push('harness: ' + String(e.message).split('\n')[0].slice(0, 140)); }
  for (const e of [...new Set(errs)]) f.push(e);
  await ctx.close();
  return f;
}

function write() {
  const sets = build();
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, d] of Object.entries(sets)) fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(d, null, 1));
  const w = loadWords();
  console.log(`wrote ${Object.keys(sets).length} data sets to ${path.relative(FV, OUT)}/ (${Object.keys(sets).join(', ')})`);
  console.log(w ? `long-words used ${Object.keys(w).length} keys from play/words.js` : 'long-words used fallback keys: play/words.js is not there yet');
}

module.exports = { build, PLAN, INJ, longName };
if (require.main === module) {
  const a = process.argv.slice(2);
  const get = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  write();
  if (a.includes('--run')) {
    const only = get('--only', null);
    run({ url: get('--url', 'http://127.0.0.1:8765/play/').split('#')[0], only: only ? only.split(',') : null })
      .then((n) => process.exit(n ? 1 : 0)).catch((e) => { console.error(e); console.log('WORST ISSUES 1'); process.exit(1); });
  }
}
