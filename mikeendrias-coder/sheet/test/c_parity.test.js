'use strict';
// (c) Data parity: the v2 build of the upgraded sheet = live.json + whitelisted new fields; the only legacy change is Vermont.
// Also writes sheet/test/out/v2-preview.json (the preview JSON the mock builds from today's data).
const assert = require('assert'), fs = require('fs'), path = require('path');
const H = require('./harness');
const { FV } = H.pure();

let P = null;
function parity() {
  if (P) return P;
  const f = H.fresh();
  P = { f, pv: H.buildOf(f.env, f.ctx, 'preview'), lv: H.buildOf(f.env, f.ctx, 'live') };
  return P;
}
const vermontFixed = d => { const c = JSON.parse(JSON.stringify(d)); c.states.find(s => s.name === 'Vermont').law = 'Unchanged (none of the seven)'; return c; };

module.exports = { scenario: 'c', title: 'data parity with live.json', tests: [
  ['preview and live builds are additive-equal to live.json; the only allowed change is Vermont', () => {
    const { pv, lv } = parity();
    [pv, lv].forEach((d, i) => {
      const r = FV.additiveEqual(H.LIVE, d);
      assert.ok(r.ok, (i ? 'live' : 'preview') + ': ' + r.problems.slice(0, 5).join('; '));
      assert.strictEqual(JSON.stringify(r.allowed), JSON.stringify(['Vermont: "Unchanged" → "Unchanged (none of the seven)"']));
    });
  }],
  ['every new path matches the whitelist (schema, generator, prot why/order, words, site, leadQuotes, examples)', () => {
    const { pv } = parity(), extra = [];
    const walk = (a, b, p) => { if (b && typeof b === 'object') Object.keys(b).forEach(k => { const q = p ? p + '.' + k : k; if (!a || typeof a !== 'object' || !(k in a)) extra.push(q); else walk(a[k], b[k], q); }); };
    walk(H.LIVE, pv, '');
    const ok = [/^schema$/, /^generator$/, /^config\.prot\.[1-7]\.(why|order)$/, /^config\.(words|site|leadQuotes|examples)$/];
    extra.forEach(q => assert.ok(ok.some(r => r.test(q)), 'unexpected new path ' + q));
    assert.ok(!('scores' in pv.config), 'no config.scores');
    assert.strictEqual(pv.schema, 2); assert.strictEqual(pv.generator, 'Face Value sheet 2.0.0');
  }],
  ['the four top-level arrays are deep-equal to live.json apart from Vermont', () => {
    const { pv, lv } = parity(), want = vermontFixed(H.LIVE);
    ['states', 'laws', 'bills', 'quotes'].forEach(k => { assert.strictEqual(FV.canonical(pv[k]), FV.canonical(want[k]), 'preview ' + k); assert.strictEqual(FV.canonical(lv[k]), FV.canonical(want[k]), 'live ' + k); });
  }],
  ['byte check: v2 output minus the new keys = the v1 build of the same sheet (apart from updated and Vermont)', () => {
    const { pv, lv, f } = parity();
    const v1 = vermontFixed(f.J1);
    [pv, lv].forEach((d, i) => { const s = FV.stripNew(d); s.updated = v1.updated; assert.strictEqual(JSON.stringify(s, null, 1), JSON.stringify(v1, null, 1), i ? 'live' : 'preview'); });
  }],
  ['source is byte-identical; config.why has exactly the 5 steps; legacy stories unchanged', () => {
    const { pv, lv } = parity();
    assert.strictEqual(pv.source, H.LIVE.source); assert.strictEqual(lv.source, H.LIVE.source);
    assert.strictEqual(Object.keys(pv.config.why).join(','), 'crime,approval,search,arrest,disclose');
    assert.strictEqual(FV.canonical(pv.config.stories), FV.canonical(H.LIVE.config.stories));
    assert.strictEqual(FV.canonical(lv.config.stories), FV.canonical(H.LIVE.config.stories));
    assert.ok(pv.config.stories.some(s => s.who === 'federal'), 'the federal story stays for the old site');
  }],
  ['preview carries the new-page fields; live (all Draft) carries none of the drafts', () => {
    const { pv, lv } = parity();
    assert.strictEqual(pv.config.examples.map(e => e.id).join(','), 'montana-shoplifting,indiana-lineup,illinois-drone,kentucky-no-limits');
    pv.config.examples.forEach(e => { ['id', 't', 'd', 'lesson', 'state', 'who', 'src', 'db', 'crime', 'order'].forEach(k => assert.ok(k in e, k)); assert.notStrictEqual(e.who, 'federal'); });
    assert.ok(Object.keys(pv.config.words).length > 0 && pv.config.words['offline.heading']);
    assert.ok(Object.keys(pv.config.words).every(k => !/^why\./.test(k)), 'why.* never in config.words');
    assert.ok(pv.config.prot['1'].why && pv.config.prot['3'].order === 1);
    assert.strictEqual(lv.config.examples.length, 0); assert.strictEqual(Object.keys(lv.config.words).length, 0); assert.ok(!lv.config.prot['1'].why);
    assert.strictEqual(JSON.stringify(pv.config.site), JSON.stringify({ status: 'live', currentThrough: '2026-10-26', billYear: '2026', nextUpdate: '2027-04-26' }));
  }],
  ['the old-app contract passes on both builds', () => {
    const { pv, lv } = parity();
    assert.strictEqual(FV.oldAppContract(pv).length, 0); assert.strictEqual(FV.oldAppContract(lv).length, 0);
  }],
  ['writes sheet/test/out/v2-preview.json (the v2 preview built from today\'s data)', () => {
    const { pv } = parity(), dir = path.join(__dirname, 'out');
    fs.mkdirSync(dir, { recursive: true });
    const out = JSON.parse(JSON.stringify(pv)); out.updated = H.NOW;
    fs.writeFileSync(path.join(dir, 'v2-preview.json'), JSON.stringify(out, null, 1));
    assert.ok(FV.additiveEqual(H.LIVE, JSON.parse(fs.readFileSync(path.join(dir, 'v2-preview.json'), 'utf8'))).ok);
  }]
] };
