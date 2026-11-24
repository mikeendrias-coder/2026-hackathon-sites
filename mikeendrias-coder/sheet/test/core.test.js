'use strict';
// Unit tests for the pure core (no Google services).
const assert = require('assert');
const H = require('./harness');
const { FV, FV1, WORD_KEYS } = H.pure();
const same = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);

module.exports = { scenario: '0', title: 'pure core helpers', tests: [
  ['Code.gs starts with @OnlyCurrentDoc, version 2.0.0, schema 2', () => {
    const src = require('fs').readFileSync(H.CODE, 'utf8').split('\n');
    assert.strictEqual(src[0], '/** @OnlyCurrentDoc */');
    assert.ok(/v2\.0\.0/.test(src[2]), 'line 3 names v2.0.0');
    const m = H.pure();
    assert.strictEqual(m.FV_VERSION, '2.0.0'); assert.strictEqual(m.SCHEMA_VERSION, 2);
  }],
  ['legacy/Code.v1.gs is a byte copy of the v1 script (FV1 is v1 FV verbatim)', () => {
    const fs = require('fs');
    const v1 = fs.readFileSync(H.CODE_V1, 'utf8'), v2 = fs.readFileSync(H.CODE, 'utf8');
    const body = v1.split('\n').slice(16, 201).join('\n').replace(/^var FV = /, 'var FV1 = ');
    assert.ok(v2.indexOf(body) >= 0, 'FV1 block equals v1 lines 17-201');
    assert.ok(/^\/\*\*\n \* Face Value: control the website/.test(v1), 'legacy file is the v1 script');
  }],
  ['AP dates both ways', () => {
    assert.strictEqual(FV.apDate('2026-10-26'), 'Oct. 26, 2026');
    assert.strictEqual(FV.apDate('2026-03-05'), 'March 5, 2026');
    assert.strictEqual(FV.apDate('2026-09-01'), 'Sept. 1, 2026');
    same(FV.parseApDate(H.LIVE.source), { iso: '2026-10-26', match: 'Oct. 26, 2026' });
    assert.strictEqual(FV.parseApDate('no date here'), null);
    assert.strictEqual(FV.isoDate('2026-02-30'), '');
  }],
  ['lawStatusOf reproduces 50 of 51 stored values; only Vermont differs', () => {
    const diffs = H.LIVE.states.filter(s => FV.lawStatusOf(s.name, H.LIVE.laws) !== s.law).map(s => s.name);
    assert.deepStrictEqual(diffs, ['Vermont']);
    assert.strictEqual(FV.lawStatusOf('Vermont', H.LIVE.laws), 'Unchanged (none of the seven)');
  }],
  ['stateLevels matches the old app groups (12 rules, 2 bans, 4 zero, 33 none)', () => {
    const lv = FV.stateLevels(H.LIVE), c = { rules: 0, ban: 0, zero: 0, none: 0 };
    Object.values(lv).forEach(x => c[x.group]++);
    assert.deepStrictEqual(c, { rules: 12, ban: 2, zero: 4, none: 33 });
    assert.strictEqual(lv.Vermont.level, 'lb'); assert.strictEqual(lv.Maryland.level, 'l4'); assert.strictEqual(lv.Ohio.level, 'l0'); assert.strictEqual(lv.Kentucky.level, 'lz');
  }],
  ['hashInput ignores updated; canonical sorts keys', () => {
    const a = { updated: 'x', b: 1, a: [1, { d: 2, c: 3 }] }, b = { a: [1, { c: 3, d: 2 }], b: 1, updated: 'y' };
    assert.strictEqual(FV.hashInput(a), FV.hashInput(b));
  }],
  ['additiveEqual allows only whitelisted new fields and the Vermont label', () => {
    const a = JSON.parse(H.LIVE_TEXT), b = JSON.parse(H.LIVE_TEXT);
    b.schema = 2; b.config.words = { x: 'y' }; b.config.prot['1'].why = 'w';
    assert.ok(FV.additiveEqual(a, b).ok);
    const c = JSON.parse(H.LIVE_TEXT); c.laws[0].lastChecked = '2026-01-01';
    assert.ok(!FV.additiveEqual(a, c).ok, 'a new key inside laws is refused');
    const d = JSON.parse(H.LIVE_TEXT); d.config.scores = {};
    assert.ok(!FV.additiveEqual(a, d).ok, 'config.scores is refused');
    const e = JSON.parse(H.LIVE_TEXT); e.laws.pop();
    assert.ok(!FV.additiveEqual(a, e).ok, 'a dropped law is caught');
    const f = JSON.parse(H.LIVE_TEXT); delete f.laws[3].reviewNote;
    assert.ok(!FV.additiveEqual(a, f).ok, 'a dropped field is caught');
  }],
  ['oldAppContract passes on live.json and catches crashes', () => {
    same(FV.oldAppContract(H.LIVE), []);
    const bad = JSON.parse(H.LIVE_TEXT); bad.config.prot['1'].step = 'x'; bad.config.stories[0].who = 'alien'; bad.quotes[0].item = 'Nope'; bad.laws[0].whoFor = 'local'; bad.states[0].name = 'Atlantis';
    const msgs = FV.oldAppContract(bad).map(p => p.msg).join('\n');
    ['"step"', 'bad dropdown', 'missing law or bill', 'Applies to', 'Atlantis'].forEach(s => assert.ok(msgs.indexOf(s) >= 0, s));
  }],
  ['diff lists map changes first and per-area counts', () => {
    const b = JSON.parse(H.LIVE_TEXT); b.laws.find(l => l.state === 'Kentucky').rules = ['4']; b.laws.find(l => l.state === 'Kentucky').limits = {};
    b.states.find(s => s.name === 'Kentucky').law = 'Unchanged';
    const d = FV.diff(H.LIVE, b);
    assert.ok(d.map.some(m => /^Kentucky: Law, none of the 7 → 1 of 7/.test(m)), d.map.join(';'));
    assert.ok(/^Map: 1 state/.test(d.summary[0]));
    assert.strictEqual(FV.diff(H.LIVE, JSON.parse(H.LIVE_TEXT)).count, 0);
  }],
  ['v1 round trip still holds (the old test_roundtrip check)', () => {
    const rows = FV1.toRows(H.LIVE, []), asSheet = {};
    Object.keys(rows).forEach(t => { asSheet[t] = rows[t].map(r => r.map(c => typeof c === 'boolean' ? c : String(c === null || c === undefined ? '' : c))); });
    const { data, errors } = FV1.fromRows(asSheet, H.LIVE.source);
    assert.strictEqual(errors.length, 0);
    data.updated = H.LIVE.updated;
    assert.strictEqual(FV.canonical(data), FV.canonical(H.LIVE));
  }],
  ['WORD_KEYS block has the contract shape and the required keys', () => {
    const src = require('fs').readFileSync(H.CODE, 'utf8');
    const m = /\n\/\/ <WORD_KEYS>\nvar WORD_KEYS = \[\n([\s\S]*?)\];\n\/\/ <\/WORD_KEYS>\n/.exec(src);
    assert.ok(m, 'marker block present');
    m[1].split('\n').filter(Boolean).forEach(line => { assert.ok(/^\{.*\},$/.test(line), 'one object per line: ' + line.slice(0, 60)); JSON.parse(line.slice(0, -1)); });
    assert.ok(/\n\/\/ <SHEET_TEXTS>\nvar SHEET_TEXTS = [\s\S]*?;\n\/\/ <\/SHEET_TEXTS>\n/.test(src), 'SHEET_TEXTS block present');
    const keys = WORD_KEYS.map(w => w.key);
    ['offline.heading', 'offline.message', 'offline.linkText', 'offline.linkUrl', 'risk.url', 'risk.linkText'].forEach(k => assert.ok(keys.indexOf(k) >= 0, k));
    WORD_KEYS.forEach(w => { assert.ok(typeof w.where === 'string' && Array.isArray(w.fills) && typeof w.text === 'string' && w.max > 0, w.key); if (FV.isUrlKey(w.key)) assert.ok(/^https:\/\//.test(w.text), w.key + ' is https'); });
    assert.strictEqual(new Set(keys).size, keys.length, 'keys are unique');
  }]
] };
