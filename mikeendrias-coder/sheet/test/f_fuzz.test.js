'use strict';
// (f) Fuzz: 200 seeded random v1 data sets -> v1 sheet rows -> upgrade plan -> read back -> parity.
// The first FULL_MOCK seeds also run the whole way through the mock: v1 setupFromSite(), then the v2 upgrade.
const assert = require('assert');
const H = require('./harness');
const { FV, FV1, WORD_KEYS, SHEET_TEXTS } = H.pure();
const SEEDS = 200, FULL_MOCK = 6;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function fuzzData(seed) {
  const r = rng(seed), d = JSON.parse(H.LIVE_TEXT), P = FV.PIDS;
  const pick = a => a[Math.floor(r() * a.length)], chance = p => r() < p;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const codes = Object.keys(d.config.limits), WHO = [['local', 'state'], ['local'], ['state'], ['any']];
  d.laws.forEach(l => {
    if (chance(0.35)) { l.rules = P.filter(() => chance(0.3)); l.limits = {}; l.rules.forEach(k => { if (chance(0.3)) l.limits[k] = pick(codes); }); }
    if (chance(0.2)) l.whoFor = pick(WHO).slice();
    if (chance(0.15)) l.source = pick([null, 'drone', 'bodycam']);
    if (chance(0.1)) l.db = pick([null, 'dmv']);
    if (chance(0.2)) l.status = pick(['Unchanged', 'New', 'Amended']);
    delete l.reviewRules; delete l.reviewNote; delete l.note; delete l.ban; delete l.banException; delete l.bars;
    l.review = chance(0.4);
    if (l.review) { l.reviewRules = chance(0.3) ? l.rules.slice() : shuffle(l.rules.filter(() => chance(0.6))); if (chance(0.7)) l.reviewNote = 'Unclear ' + Math.floor(r() * 1000) + '.'; }
    if (chance(0.3)) l.note = 'Public note ' + Math.floor(r() * 100) + '.';
  });
  const byState = {}; d.laws.forEach(l => { (byState[l.state] = byState[l.state] || []).push(l); });
  shuffle(Object.keys(byState)).slice(0, 1 + Math.floor(r() * 3)).forEach(s => {
    const L = byState[s], ban = L[0];
    ban.ban = { who: pick(WHO).slice(), kind: pick(['Ban', 'Pause']), text: 'No face searches in ' + s + '.', except: chance(0.5) ? 'Except emergencies.' : '' };
    if (L[1] && chance(0.6)) L[1].banException = true;
  });
  shuffle(d.laws.slice()).slice(0, 1 + Math.floor(r() * 2)).forEach(l => { if (!l.ban) l.bars = { src: pick(['drone', 'bodycam']), text: 'This bar stops the search.' }; });
  d.bills.forEach(b => {
    if (chance(0.3)) { b.rules = P.filter(() => chance(0.25)); b.limits = {}; b.rules.forEach(k => { if (chance(0.3)) b.limits[k] = pick(codes); }); }
    if (chance(0.2)) b.pending = !b.pending;
    delete b.note; if (chance(0.2)) b.note = 'Bill note ' + Math.floor(r() * 100) + '.';
  });
  d.states.forEach(s => { s.law = FV.lawStatusOf(s.name, d.laws); if (/\(none of the seven\)$/.test(s.law) && chance(0.4)) s.law = s.law.replace(' (none of the seven)', ''); });
  shuffle(d.laws); shuffle(d.bills); shuffle(d.quotes); shuffle(d.config.stories);
  d.config.stories.forEach(s => { if (chance(0.2)) s.who = pick(['local', 'state', 'federal']); });
  if (chance(0.3)) delete d.config.glossary[pick(Object.keys(d.config.glossary))];
  return d;
}
const SETTINGS = [['GitHub owner', 'mikeendrias-coder'], ['GitHub repo', '2026-hackathon-sites'], ['Branch', 'mikeendrias-coder/face-value'], ['Folder', 'mikeendrias-coder'], ['Site address', H.SITE]];
function acceptAllowed(J1, J2) { const c = JSON.parse(JSON.stringify(J1)); c.states.forEach((s, i) => { if (J2.states[i] && J2.states[i].law === s.law + ' (none of the seven)') s.law = J2.states[i].law; }); return c; }

function pureRun(seed) {
  const d = fuzzData(seed), rows = FV1.toRows(d, SETTINGS.concat([['Research note', d.source]])), sheet = {};
  Object.keys(rows).forEach(t => { sheet[t] = rows[t].map(rw => rw.map(c => typeof c === 'boolean' ? c : String(c === null || c === undefined ? '' : c))); });
  const r1 = FV1.fromRows(sheet, d.source); assert.strictEqual(r1.errors.length, 0, 'seed ' + seed + ' v1 errors ' + JSON.stringify(r1.errors.slice(0, 2)));
  const J1 = r1.data, settings = {}; sheet.Settings.slice(1).forEach(x => { settings[x[0]] = x[1]; });
  const plan = FV.planV1toV2(J1, sheet, settings, { wordKeys: WORD_KEYS, texts: SHEET_TEXTS, today: H.TODAY, now: H.NOW, sheetId: 'S' });
  assert.strictEqual(plan.report.blocking.length, 0, 'seed ' + seed + ': ' + plan.report.blocking.slice(0, 3).join('; '));
  const model = FV.readModel(FV.sheetsFromGrids(plan.grids));
  [['preview', plan.J2], ['live', FV.build(model, { mode: 'live', live: J1, now: H.NOW })]].forEach(([mode, J2]) => {
    const ae = FV.additiveEqual(J1, J2);
    assert.ok(ae.ok, 'seed ' + seed + ' ' + mode + ': ' + ae.problems.slice(0, 3).join('; '));
    const s = FV.stripNew(J2); s.updated = J1.updated;
    assert.strictEqual(JSON.stringify(s, null, 1), JSON.stringify(acceptAllowed(J1, J2), null, 1), 'seed ' + seed + ' ' + mode + ' byte check');
  });
  return plan;
}

const tests = [
  [SEEDS + ' seeded random v1 data sets upgrade with parity (preview and live, plus the byte check)', () => {
    let unclearSome = 0, bans = 0, ex = 0, bars = 0;
    for (let s = 1; s <= SEEDS; s++) {
      const plan = pureRun(s);
      unclearSome += +(/(\d+) "only some/.exec(plan.report.conversions[0]) || [0, 0])[1];
      const c = plan.report.conversions[1]; bans += (c.match(/: (Ban|Pause)/g) || []).length; ex += (c.match(/: Exception/g) || []).length;
      bars += plan.objs.laws.filter(l => l.barsFrom).length;
    }
    assert.ok(unclearSome > 50 && bans > 100 && ex > 50 && bars > 100, 'the fuzz covers the hard cases: ' + [unclearSome, bans, ex, bars].join(','));
  }],
  ['the fuzz can fail: a dropped reviewNote breaks parity', () => {
    const d = fuzzData(7), J1 = JSON.parse(JSON.stringify(d)), J2 = JSON.parse(JSON.stringify(d));
    const l = J2.laws.find(x => x.reviewNote); delete l.reviewNote;
    assert.ok(!FV.additiveEqual(J1, J2).ok);
  }],
  ['the first ' + FULL_MOCK + ' seeds also run end to end through the mock (v1 setupFromSite, then Upgrade)', () => {
    for (let s = 1; s <= FULL_MOCK; s++) {
      const d = fuzzData(s), text = JSON.stringify(d, null, 1);
      const { env } = H.v1Sheet({ liveText: text, realism: s % 2 === 0 });
      const J1 = H.v1Json(env), ctx = H.loadV2(env);
      H.upgrade(env, ctx);
      ['preview', 'live'].forEach(mode => {
        const J2 = H.buildOf(env, ctx, mode, d), ae = FV.additiveEqual(J1, J2);
        assert.ok(ae.ok, 'seed ' + s + ' ' + mode + ': ' + ae.problems.slice(0, 3).join('; '));
      });
    }
  }]
];
module.exports = { scenario: 'f', title: 'fuzz: ' + SEEDS + ' random v1 sheets (' + FULL_MOCK + ' through the full mock)', tests };
