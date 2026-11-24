#!/usr/bin/env node
/* Parity check: play/logic.js and play/kit.js against the pinned old app.js (the oracle).
   Run from FV:  node qa/parity.cjs            -> "PARITY OK: …" and exit 0, or the first 20 differences and exit 1
                 node qa/parity.cjs --canary   -> swaps covered/partial in a copy of the new logic; must exit 1
   Where the oracle comes from:
     FV_BASE=<commit>        oracle commit (default 1ea0c6b), read with git show
     FV_REPO=<git dir>       the repo's .git, for a copy of FV outside the repo (GIT_DIR=<git dir> also works)
     FV_ORACLE_FILE=<path>   a saved app.js; skips git entirely
   The new code always runs in a bare vm (no window, document, storage, fetch, clock or random).
   Every exported function is called on every dataset, including the broken ones, and must never throw.
   Differences from app.js on purpose (each one is applied to the oracle side and named here):
     - who=federal reads as local; what-if is fixed at none.
     - config.limits keys match in any case, and a missing or unknown type keeps the built-in one.
     - nationalProt lists only states in the states list; otherLawsOf leaves out ban laws.
     - billNote and the 'loose' kind in billImpact follow contract.md §2 (the old app had no such note).
   See design-site-v2.md §4.3. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const FV = path.resolve(__dirname, '..');
const BASE = process.env.FV_BASE || '1ea0c6b';
const CANARY = process.argv.includes('--canary');
const clone = x => JSON.parse(JSON.stringify(x));
const J = x => JSON.stringify(x);
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const die = (msg, code) => { console.log(msg); process.exit(code); };

/* ---------------- the oracle ---------------- */
let appSrc, oracleFrom;
if (process.env.FV_ORACLE_FILE) {
  try { appSrc = fs.readFileSync(process.env.FV_ORACLE_FILE, 'utf8'); oracleFrom = process.env.FV_ORACLE_FILE; }
  catch (e) { die(`PARITY ERROR: cannot read FV_ORACLE_FILE ${process.env.FV_ORACLE_FILE}`, 2); }
} else {
  const args = process.env.FV_REPO ? ['--git-dir', process.env.FV_REPO] : ['-C', FV];
  try { appSrc = execFileSync('git', args.concat(['show', `${BASE}:mikeendrias-coder/app.js`]), { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); oracleFrom = `app.js@${BASE}`; }
  catch (e) { die(`PARITY ERROR: cannot read ${BASE}:mikeendrias-coder/app.js. Outside the repo, set FV_REPO=<repo>/.git or FV_ORACLE_FILE=<saved app.js>.`, 2); }
}
const cut = (from, to, label) => {
  const a = appSrc.indexOf(from), b = appSrc.indexOf(to, a + 1);
  if (a < 0 || b < 0) die(`PARITY ERROR: oracle marker missing (${label})`, 2);
  return [a, b];
};
const lift = (re, label) => { const m = re.exec(appSrc); if (!m) die(`PARITY ERROR: oracle marker missing (${label})`, 2); return m; };
const [a0, a1] = cut('(() => {', '/* ================= app state', 'part A');
const partA = appSrc.slice(a0 + '(() => {'.length, a1);
const [b0, b1] = cut('/* ================= the legal logic (from v1)', '/* ================= drawer', 'part B');
const partB = appSrc.slice(b0, b1);
// app.js:859-868 (LTYPE and limitsOf), verbatim.
const [c0, c1] = cut('const LTYPE = {', 'function renderCompareLaws', 'limitsOf');
const partC = appSrc.slice(c0, c1);
// app.js:326-358: quote marks, markup and qbody, verbatim.
const [d0, d1] = cut('/* Quote marks, typed by editors', 'const clip = (t, n) =>', 'markup');
const partD = appSrc.slice(d0, d1);
// app.js:365-370: the rows of billImpact, verbatim, returned before the HTML is built.
const [e0, e1] = cut('function billImpact(b) {', '  const n = k => rows.filter(x => x.k === k).length;', 'billImpact rows');
const partE = appSrc.slice(e0, e1).replace('function billImpact(b) {', 'function billRows(b) {') + '  return rows;\n}';
// app.js:407-408: the full and part lists of stateGroups, verbatim.
const [f0, f1] = cut('function stateGroups(rule) {', '  const bills = [...new Set(', 'stateGroups');
const partF = appSrc.slice(f0, f1).replace('function stateGroups(rule) {', 'function natGroups(rule) {') + '  return { full, part };\n}';
// app.js:580 (nFull), 578 and 605 (other laws), and 599 (the old "Partly" line), verbatim, wrapped per state.
const m580 = lift(/^\s*const n = protCount\(st\), nFull = (.*);\s*$/m, 'app.js:580 nFull');
const m578 = lift(/^\s*const lawsHere = (D\.laws\.filter\(l => l\.state === st\));\s*$/m, 'app.js:578 lawsHere');
const m605 = lift(/^\s*const other = (lawsHere\.filter\(l => !l\.rules\.length\));\s*$/m, 'app.js:605 other');
const m599 = lift(/^\s*const lim = sp\.level === 'part' \?.*$/m, 'app.js:599 limit line');
const LTYPE_BASE = vm.runInNewContext('(' + lift(/const LTYPE = (\{[^\n]*\});/, 'app.js:859 LTYPE')[1] + ')');
const ORACLE = new vm.Script(`${partA}\n${partB}\n${partC}\n${partD}\n${partE}\n${partF}\n
const full580 = st => ${m580[1]};
const other605 = st => { const lawsHere = ${m578[1]}; return ${m605[1]}; };
const lim599 = (st, r) => { const sp = stateProt(st, r);\n${m599[0]}\n return lim; };
({ D, STEPS, LTYPE, groupOf, banOf, protCount, mapLevel, counts, LAST, inSession, stateProt, billsFor, computeCase, otherLaws, banFor, barFor,
   plainLimit, SRC_FOR, WHO_FOR, broad, limitsOf, lim599, full580, other605, billRows, natGroups, markup, qbody, XB, XE })`, { filename: oracleFrom });
// The oracle reads config.limits the new way: keys in lower case, and a missing or unknown type keeps the built-in one.
const LT_OK = ['narrow', 'weak', 'loose'];
function oracleInput(D) {
  if (!isObj(D) || !isObj(D.config) || !isObj(D.config.limits)) return D;
  const lim = {};
  Object.keys(D.config.limits).forEach(k => {
    const v = D.config.limits[k], lk = String(k).toLowerCase(), t = isObj(v) ? v.type : null;
    const keep = lim[lk] ? lim[lk].type : LTYPE_BASE[lk] || 'narrow';
    lim[lk] = { text: isObj(v) ? v.text : undefined, type: LT_OK.includes(t) ? t : keep };
  });
  return Object.assign({}, D, { config: Object.assign({}, D.config, { limits: lim }) });
}
const oracle = D => ORACLE.runInNewContext({ window: { FRT_DATA: clone(oracleInput(D)) }, matchMedia: () => ({ matches: false }), S: { whatif: 'none', model: 'Montana' } });

/* ---------------- the new code, always in a bare vm ---------------- */
const LOGIC_PATH = path.join(FV, 'play', 'logic.js');
const KIT_PATH = path.join(FV, 'play', 'kit.js');
let logicSrc = fs.readFileSync(LOGIC_PATH, 'utf8');
if (CANARY) {
  const from = "/* PRECEDENCE */ for (const k of ['covered', 'partial', 'review', 'bypassed'])";
  if (!logicSrc.includes(from)) die('PARITY ERROR: canary marker missing in play/logic.js', 2);
  logicSrc = logicSrc.replace(from, "/* PRECEDENCE */ for (const k of ['partial', 'covered', 'review', 'bypassed'])");
  console.log('CANARY: covered/partial precedence swapped in a copy of play/logic.js');
}
// No window, document, localStorage or fetch. Any clock or random read throws. URLSearchParams is a plain web API.
const loadInVm = (src, file) => {
  const ctx = vm.createContext({ URLSearchParams });
  vm.runInContext(`(() => { const now = () => { throw new Error('clock read'); };
    const D0 = Date; globalThis.Date = function Date() { throw new Error('clock read'); };
    Object.assign(globalThis.Date, { now, parse: D0.parse, UTC: D0.UTC });
    Math.random = () => { throw new Error('random read'); }; })();`, ctx);
  const mod = { exports: {} }; ctx.module = mod;
  vm.runInContext(src, ctx, { filename: file });
  return mod.exports;
};
let FVLogic, FVKit;
try { FVLogic = loadInVm(logicSrc, CANARY ? 'logic.js (canary, bare vm)' : 'logic.js (bare vm)'); }
catch (e) { die(`PARITY FAIL: play/logic.js does not load in a bare vm: ${e.message}`, 1); }
try { FVKit = loadInVm(fs.readFileSync(KIT_PATH, 'utf8'), 'kit.js (bare vm)'); }
catch (e) { die(`PARITY FAIL: play/kit.js does not load in a bare vm: ${e.message}`, 1); }
const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

/* ---------------- datasets ---------------- */
const readJSON = p => JSON.parse(fs.readFileSync(path.join(FV, p), 'utf8'));
const live = readJSON('data/live.json');
const datasets = [
  { name: 'data/live.json', D: live, real: true },
  { name: 'data/preview.json', D: readJSON('data/preview.json'), real: true },
  { name: 'qa/fixtures/live-2026-11-18.json', D: readJSON('qa/fixtures/live-2026-11-18.json'), real: true }
];
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const RULES = ['1', '2', '3', '4', '5', '6', '7'];
const SRCS = ['photo', 'cctv', 'drone', 'bodycam'];
const LAWVALS = ['No law', 'Unchanged', 'New', 'Amended', 'Unchanged (none of the seven)', 'New (none of the seven)', 'Amended (none of the seven)'];
const mixCase = k => k.replace(/\b\w/g, ch => ch.toUpperCase());
function fuzz(base, seed) {
  const R = mulberry32(seed), rnd = n => Math.floor(R() * n), pick = a => a[rnd(a.length)], chance = p => R() < p;
  const D = clone(base);
  const cfgCodes = Object.keys((base.config && base.config.limits) || {});
  const codes = cfgCodes.concat(['mystery limit', 'Mystery Limit', 'ADDS OFFENSES']);
  for (let i = D.laws.length - 1; i > 0; i--) { const j = rnd(i + 1); [D.laws[i], D.laws[j]] = [D.laws[j], D.laws[i]]; }
  const randRules = () => {
    const rules = RULES.filter(() => chance(0.35)), limits = {};
    rules.forEach(r => { if (chance(0.35)) limits[r] = r === '4' && chance(0.5) ? 'lineups only' : chance(0.15) ? 'drones only' : pick(codes); });
    return { rules, limits };
  };
  D.laws.forEach(l => {
    if (chance(0.5)) l.whoFor = pick([['any'], ['local'], ['state'], ['local', 'state']]);
    if (chance(0.3)) l.source = pick([null, 'drone', 'bodycam']);
    if (chance(0.3)) l.db = pick([null, 'dmv']);
    if (chance(0.4)) Object.assign(l, randRules());
    if (chance(0.3)) {
      l.review = chance(0.5);
      if (chance(0.5)) l.reviewRules = l.rules.filter(() => chance(0.5)); else delete l.reviewRules;
      if (chance(0.7)) l.reviewNote = 'Open question ' + rnd(9); else delete l.reviewNote;
    }
    if (chance(0.05)) l.ban = chance(0.3) ? null : { who: pick([['local'], ['state'], ['local', 'state']]), kind: pick(['Ban', 'Pause']), text: 'Ban text ' + rnd(9), except: '' };
    if (chance(0.05)) l.bars = chance(0.3) ? null : { src: pick(SRCS), text: 'Bar text ' + rnd(9) };
  });
  D.states.forEach(s => { if (chance(0.15)) s.law = pick(LAWVALS); });
  D.bills.forEach(b => {
    if (chance(0.4)) b.year = pick(['2021', '2022', '2023', '2024', '2025', '2026', '', '2025-26']);
    if (chance(0.3)) b.pending = chance(0.5);
    if (chance(0.25)) { const x = randRules(); b.rules = x.rules; b.limits = x.limits; if (x.rules.includes('3') && chance(0.5)) b.limits['3'] = pick(['adds offenses', 'adds an offense']); }
  });
  // Limit types from the Sheet: retyped, junk, missing, a new code, and keys in mixed case.
  if (D.config && D.config.limits && chance(0.6)) {
    const L = D.config.limits, TYPES = ['narrow', 'weak', 'loose', 'junk', undefined, 'Loose'];
    cfgCodes.forEach(k => { if (chance(0.25)) L[k].type = pick(TYPES); });
    if (chance(0.5)) L['mystery limit'] = { text: 'a new limit', type: pick(TYPES) };
    if (chance(0.5)) { const k = pick(cfgCodes); L[mixCase(k)] = { text: 'mixed case', type: pick(TYPES) }; }
    if (chance(0.2)) L[pick(cfgCodes)] = 'not an object';
  }
  // Move the newest session: sometimes the newest year is older than 2026, or no bill has a plain year at all.
  const roll = R();
  if (roll < 0.2) { const top = pick(['2023', '2024', '2025']); D.bills.forEach(b => { if (+b.year > +top) b.year = pick(['2021', '2022', top, '']); }); }
  else if (roll < 0.25) D.bills.forEach(b => { b.year = pick(['', '2025-26']); });
  return D;
}
for (let i = 0; i < 200; i++) datasets.push({ name: `fuzz #${i} (seed ${0xF00D + i})`, D: fuzz(live, 0xF00D + i) });
// Degenerate data. The first three must still match the oracle; the others crash the oracle, and the new code must still run.
datasets.push({ name: 'degenerate: no bills', D: Object.assign(clone(live), { bills: [] }) });
datasets.push({ name: 'degenerate: no laws', D: Object.assign(clone(live), { laws: [] }) });
(() => {
  const D = clone(live);
  D.laws.push({ whoFor: ['local', 'state'], source: null, db: null, state: 'Atlantis', name: 'Atlantis law', rules: ['1', '3'], limits: { '3': 'adds offenses' }, review: false, ban: { who: ['local'], kind: 'Ban', text: 'x', except: '' } });
  D.bills.push({ state: 'Atlantis', name: 'AB 1 (2026)', pending: true, year: '2026', rules: ['1'], limits: {} });
  datasets.push({ name: 'degenerate: a law for a state that is not listed', D });
})();
datasets.push({ name: 'degenerate: no config, laws, bills or quotes', D: { states: clone(live.states) } });
(() => {
  const D = clone(live);
  const md = D.laws.find(l => l.state === 'Maryland'); delete md.whoFor; delete md.limits;
  const al = D.laws.find(l => l.state === 'Alabama'); delete al.rules;
  D.laws.find(l => l.state === 'Virginia').ban = { kind: 'Ban', text: 'no who list' };
  D.bills[0].rules = undefined; D.bills[1].limits = null;
  // Bills in the session with broken fields, on rows that have bill notes.
  const sess = n => D.bills.find(b => b.name === n) || die(`PARITY ERROR: degenerate bill ${n} is gone from data/live.json`, 2);
  sess('SB 26-071 (2026)').limits = null;
  sess('H.B. 1010 (2026)').rules = null;
  sess('HB 756 (2026)').limits = 'adds offenses';
  D.laws.find(l => l.state === 'Montana').whoFor = null;
  D.config.limits['fact of use'] = null;
  datasets.push({ name: 'degenerate: laws and bills with missing fields', D });
})();
(() => {
  const D = clone(live);
  D.states.push(null, 42, {}, { name: '' }, { name: 'Nowhere', law: 'New' });
  D.laws.push(null, 'law', { state: 'Ohio' }, { state: 'Ohio', name: 'x', rules: 'not a list', limits: [], whoFor: 'any', ban: true, bars: 'x' });
  D.bills.push(null, 7, { state: 'Ohio', year: 2026 }, { state: 'Ohio', name: 'y', year: '2026', rules: ['1', 3, null, '9', 'constructor'], limits: { '1': 42 } });
  D.config = { limits: { x: null, Y: 'loose', z: { type: 7 } }, prot: null };
  datasets.push({ name: 'degenerate: junk entries in every list', D });
})();
datasets.push({ name: 'degenerate: not an object', D: 'not data' });

/* ---------------- comparison ---------------- */
const CTXS = [];
['local', 'state'].forEach(who => SRCS.forEach(src => ['dmv', 'mug'].forEach(db => ['serious', 'minor'].forEach(crime => CTXS.push({ who, src, db, crime })))));
const nm = x => (x && x.name != null ? x.name : null);
const orNull = x => (x != null ? x : null);
// Why a law was bypassed, read from the oracle's reason text and the law; the new code must carry the same in by/src/db/who.
const byOracle = (O, h) => {
  if (h.reason == null) return null;
  if (/lineups/.test(h.reason)) return { by: 'lineup' };
  if (/driver's license/.test(h.reason)) return { by: 'db', db: h.law.db };
  if (h.law.source && h.reason === `it only covers ${O.SRC_FOR[h.law.source]}`) return { by: 'source', src: h.law.source };
  return { by: 'who', who: h.law.whoFor };
};
const byNew = h => (h.by != null || h.src != null || h.db != null || h.who != null ? { by: h.by, src: h.src, db: h.db, who: h.who } : null);
const normHit = (h, by) => [h.law.name, h.kind, orNull(h.reason), orNull(h.limit), by(h)];
const normCase = (c, by) => ({
  stopAt: c.stopAt,
  why: c.why && { kind: c.why.kind, law: c.why.law ? c.why.law.name : null, text: orNull(c.why.text) },
  steps: c.steps.map(s => ({ key: s.key, icon: s.icon, checks: s.checks, agg: s.agg, results: s.results.map(r => ({ rule: r.rule, at: orNull(r.at), status: r.status, has: orNull(r.has),
    top: r.top ? normHit(r.top, by) : null, hits: r.hits.map(h => normHit(h, by)) })) }))
});
// app.js:710-715 formula, applied to the oracle's case.
const tally715 = c => { const all = c.steps.flatMap(s => s.agg === 'skip' ? [] : s.results); const n = k => all.filter(r => r.status === k).length;
  return { got: n('covered') + n('would'), soft: n('partial') + n('review'), bypassed: n('bypassed'), gap: n('gap'), total: all.filter(r => r.status !== 'na').length }; };
// The old app gave undefined or '' for a missing note; the new one must give null, so the page can test it plainly.
const normProt = p => ({ level: p.level, review: !!p.review, reviewNote: p.reviewNote || null, laws: p.laws.map(l => l.name) });
const normProtNew = p => ({ level: p.level, review: p.review, reviewNote: p.reviewNote, laws: p.laws.map(l => l.name) });
// New limit codes in the old app's words, so they can be checked against the verbatim old code.
const firstText = (O, c) => !c ? '' : c.kind === 'limit' ? O.plainLimit(c.code) : c.kind === 'source' ? `only covers ${O.SRC_FOR[c.src]}`
  : c.kind === 'db' ? "only covers driver's license photo searches" : `only binds ${c.who.map(w => O.WHO_FOR[w]).join(' and ')}`;
const cap = t => t.replace(/^it /, '').replace(/^./, ch => ch.toUpperCase());
const catchText = (O, c) => ({ ty: c.type, t: c.kind === 'limit' ? cap(O.plainLimit(c.code)) : c.kind === 'source' ? `Only covers ${O.SRC_FOR[c.src]}`
  : c.kind === 'db' ? "Only covers searches of driver's license photos" : `Only binds ${c.who.map(w => O.WHO_FOR[w]).join(' and ')}` });
// Old rows with no type (source, db, who) narrow the rule.
const oracleCatch = (O, st, r) => { const sp = O.stateProt(st, r); if (sp.level !== 'part') return []; const seen = {}, out = [];
  sp.laws.forEach(l => O.limitsOf(l, r).forEach(x => { if (!seen[x.t]) { seen[x.t] = 1; out.push({ ty: x.ty || 'narrow', t: x.t }); } })); return out; };
const ltypeO = (O, code) => O.LTYPE[String(code).toLowerCase()] || 'narrow';
// contract.md §2 billNote, built from the oracle's billsFor, stateProt and LTYPE.
const oracleBillNote = (O, st, r) => {
  const level = O.stateProt(st, r).level, g = { loose: [], add: [], addPart: [], up: [] };
  O.billsFor(st, r).forEach(b => {
    const lim = b.limits[r];
    if (lim && ltypeO(O, lim) === 'loose') g.loose.push(b.name);
    else if (level === 'no') g[lim ? 'addPart' : 'add'].push(b.name);
    else if (level === 'part' && !lim) g.up.push(b.name);
  });
  return ['loose', 'add', 'addPart', 'up'].filter(k => g[k].length).slice(0, 2).map(kind => ({ kind, bills: g[kind] }));
};
const oracleImpact = (O, b) => O.billRows(b).map(x => ({ rule: x.r, kind: x.lim && ltypeO(O, x.lim) === 'loose' ? 'loose' : x.k, limit: orNull(x.lim) }));
const byYear = (a, b) => String(b.year).localeCompare(String(a.year));

const diffs = [], crashes = [], crashDatasets = [], seen = { status: {}, agg: {}, why: {}, LAST: {}, note: {}, impact: {}, ltype: {}, by: {} };
let nCases = 0, nCells = 0, nCompared = 0, nStates0 = null, nCells0 = null, mismatchSize = false, nCalls = 0;
const tryO = f => { try { return { ok: true, v: f() }; } catch (e) { return { ok: false, e }; } };
const listed = D => (isObj(D) && Array.isArray(D.states) ? D.states : []).filter(s => isObj(s) && typeof s.name === 'string' && s.name).map(s => s.name);

function runDataset(ds) {
  const crashesBefore = crashes.length;
  const src = J(ds.D);
  const Dn = deepFreeze(clone(ds.D));
  let L;
  try { L = FVLogic.create(Dn); } catch (e) { diffs.push(`${ds.name}: new create() threw: ${e.message}`); return; }
  const Ores = tryO(() => oracle(ds.D));
  const O = Ores.ok ? Ores.v : null;
  if (!O) crashes.push(`${ds.name}: oracle threw on load (${Ores.e.message})`);
  const names = listed(ds.D);
  const bills = isObj(ds.D) && Array.isArray(ds.D.bills) ? ds.D.bills : [];
  const laws = isObj(ds.D) && Array.isArray(ds.D.laws) ? ds.D.laws : [];
  if (ds.real && O && J(oracleInput(ds.D)) !== J(ds.D)) diffs.push(`${ds.name}: config.limits needs normalizing (mixed-case keys or bad types), so the live page would differ from app.js`);
  // check(path, oracleFn, newFn): the new code runs on every dataset and must never throw; the oracle may (listed separately).
  // toOld (optional) turns the new answer into the old app's words; it needs the oracle, so it runs after the no-throw check.
  const check = (p, of, nf, toOld) => {
    let nv; nCalls++;
    try { nv = nf(); } catch (e) { diffs.push(`${ds.name} ${p}: new code threw: ${e.message}`); return; }
    if (!O) return;
    if (toOld) { const t = tryO(() => toOld(nv)); if (!t.ok) { diffs.push(`${ds.name} ${p}: new answer has an odd shape (${t.e.message})`); return; } nv = t.v; }
    const o = tryO(of);
    if (!o.ok) { crashes.push(`${ds.name} ${p}: oracle threw (${o.e.message}); new code ran`); return; }
    if (J(o.v) !== J(nv)) diffs.push(`${ds.name} ${p}:\n    old ${J(o.v)}\n    new ${J(nv)}`);
  };
  // S0: step definitions and limit types.
  check('S0 STEPS', () => O.STEPS.map(s => ({ key: s.key, icon: s.icon, checks: s.checks })), () => L.STEPS.map(s => ({ key: s.key, icon: s.icon, checks: s.checks })));
  const codes = new Set(Object.keys(LTYPE_BASE).concat(['mystery limit', 'Lineups Only']));
  if (isObj(ds.D) && isObj(ds.D.config) && isObj(ds.D.config.limits)) Object.keys(ds.D.config.limits).forEach(k => { codes.add(k); codes.add(k.toUpperCase()); });
  laws.concat(bills).forEach(x => { if (isObj(x) && isObj(x.limits)) Object.values(x.limits).forEach(v => { if (typeof v === 'string' && v) codes.add(v); }); });
  codes.forEach(code => check(`S0 limitType(${J(code)})`, () => ltypeO(O, code), () => { const t = L.limitType(code); seen.ltype[t] = 1; return t; }));
  check('S0 limitType(empty)', () => ['narrow', 'narrow'], () => [L.limitType(''), L.limitType(null)]);
  // S1
  check('S1 counts', () => O.counts, () => L.counts);
  check('S1 LAST', () => O.LAST, () => { seen.LAST[L.LAST] = 1; return L.LAST; });
  bills.forEach((b, i) => check(`S1 inSession(bill ${i})`, () => !!O.inSession(b), () => !!L.inSession(Dn.bills[i])));
  check('S1 states', () => O.D.states.map(s => s.name), () => L.states());
  names.forEach(st => {
    check(`S1 ${st}`, () => [O.groupOf(st), nm(O.banOf(st)), O.protCount(st), O.mapLevel(st), O.full580(st)],
      () => [L.groupOf(st), nm(L.banOf(st)), L.protCount(st), L.mapLevel(st), L.fullCount(st)]);
    check(`S1 ${st} otherLawsOf (app.js:605, no ban laws)`, () => O.other605(st).filter(l => !l.ban).map(l => l.name), () => L.otherLawsOf(st).map(l => l.name));
    check(`S1 ${st} sessionBills`, () => O.D.bills.filter(b => b.state === st && O.inSession(b)).sort(byYear).map(b => b.name), () => L.sessionBills(st).map(b => b.name));
  });
  // S2 + S3
  let cells = 0;
  RULES.forEach(r => check(`S2 nationalProt rule ${r} (app.js:407-408, listed states)`, () => { const g = O.natGroups(r); return { yes: g.full.filter(s => names.includes(s)), part: g.part.filter(s => names.includes(s)) }; },
    () => L.nationalProt(r)));
  names.forEach(st => L.PORDER.forEach(r => {
    cells++;
    check(`S2 ${st} rule ${r} stateProt`, () => normProt(O.stateProt(st, r)), () => normProtNew(L.stateProt(st, r)));
    check(`S2 ${st} rule ${r} billsFor`, () => O.billsFor(st, r).map(b => b.name), () => L.billsFor(st, r).map(b => b.name));
    check(`S2 ${st} rule ${r} billNote`, () => oracleBillNote(O, st, r), () => L.billNote(st, r).map(n => { seen.note[n.kind] = 1; return { kind: n.kind, bills: n.bills.map(b => b.name) }; }));
    check(`S3 ${st} rule ${r} catchFirst (app.js:599)`, () => O.lim599(st, r), () => L.catchFirst(st, r), c => firstText(O, c));
    check(`S3 ${st} rule ${r} catchOf (app.js:861-868)`, () => oracleCatch(O, st, r), () => L.catchOf(st, r), cs => cs.map(c => catchText(O, c)));
  }));
  bills.forEach((b, i) => check(`S2 billImpact(bill ${i}: ${nm(b)}) (app.js:365-370)`, () => oracleImpact(O, O.D.bills[i]),
    () => L.billImpact(Dn.bills[i]).map(x => { seen.impact[x.kind] = 1; return x; })));
  // S4
  let cases = 0;
  const lawSet = new Set(isObj(Dn) && Array.isArray(Dn.laws) ? Dn.laws : []);
  names.forEach(st => CTXS.forEach(ctx => {
    cases++;
    const p = `S4 ${st} ${ctx.who}/${ctx.src}/${ctx.db}/${ctx.crime}`;
    check(p + ' computeCase', () => normCase(O.computeCase(st, ctx), h => byOracle(O, h)), () => {
      const c = L.computeCase(st, ctx);
      c.steps.forEach(s => { seen.agg[s.agg] = 1; s.results.forEach(r => { seen.status[r.status] = 1; (r.hits || []).forEach(h => { if (h.by) seen.by[h.by] = 1; if (!lawSet.has(h.law)) throw new Error('a hit carries a copy of a law'); }); }); });
      seen.why[c.why ? c.why.kind : 'none'] = 1;
      if (c.why && c.why.law && !lawSet.has(c.why.law)) throw new Error('why.law is a copy of the law');
      return normCase(c, byNew);
    });
    check(p + ' otherLaws', () => O.otherLaws(st, ctx).map(l => l.name), () => L.otherLaws(st, ctx).map(l => l.name));
    check(p + ' banFor/barFor', () => [nm(O.banFor(st, ctx)), nm(O.barFor(st, ctx))], () => [nm(L.banFor(st, ctx)), nm(L.barFor(st, ctx))]);
    check(p + ' banGap', () => { const b = O.banOf(st); return b && !b.ban.who.includes(ctx.who) ? b.name : null; }, () => nm(L.banGap(st, ctx)));
    check(p + ' tally', () => tally715(O.computeCase(st, ctx)), () => L.tally(L.computeCase(st, ctx)));
  }));
  // Odd arguments: every function must answer without throwing.
  const ODD = [undefined, null, '', 'Nowhere', 42, {}, [], 'constructor', '__proto__'];
  check('odd arguments', () => null, () => {
    ODD.forEach(a => ODD.forEach(b => {
      ['stateBySlug', 'banOf', 'groupOf', 'protCount', 'fullCount', 'mapLevel', 'nationalProt', 'limitType', 'inSession', 'sessionBills', 'billImpact', 'otherLawsOf', 'tally', 'parseHash', 'hashFor', 'normCtx', 'slug']
        .forEach(f => L[f](a));
      ['stateProt', 'catchOf', 'catchFirst', 'billsFor', 'billNote', 'otherLaws', 'banFor', 'barFor', 'computeCase', 'banGap', 'limitsOf'].forEach(f => L[f](a, b));
      L.effective(a, b, null, null);
    }));
    return null;
  });
  if (J(ds.D) !== src) diffs.push(`${ds.name}: the input data changed during the run`);
  const crashedHere = crashes.length > crashesBefore;
  if (crashedHere) crashDatasets.push(ds.name);
  if (O && !crashedHere) {
    nCompared++; nCases += cases; nCells += cells;
    if (nStates0 == null) { nStates0 = cases; nCells0 = cells; } else if (cases !== nStates0 || cells !== nCells0) mismatchSize = true;
  }
}
datasets.forEach(runDataset);
['loose', 'add', 'addPart', 'up'].forEach(k => { if (!seen.note[k]) diffs.push(`coverage: no dataset produced a billNote of kind ${k}`); });
['add', 'up', 'same', 'have', 'loose'].forEach(k => { if (!seen.impact[k]) diffs.push(`coverage: no dataset produced a billImpact of kind ${k}`); });
LT_OK.forEach(k => { if (!seen.ltype[k]) diffs.push(`coverage: limitType never gave ${k}`); });
['source', 'db', 'who', 'lineup'].forEach(k => { if (!seen.by[k]) diffs.push(`coverage: no bypass by ${k}`); });

/* ---------------- exclusions (asserted, then counted) ---------------- */
const Llive = FVLogic.create(deepFreeze(clone(live)));
let nFed = 0;
Llive.states().forEach(st => CTXS.filter(c => c.who === 'local').forEach(c => {
  nFed++;
  const f = normCase(Llive.computeCase(st, Object.assign({}, c, { who: 'federal' })), byNew), l = normCase(Llive.computeCase(st, c), byNew);
  if (J(f) !== J(l)) diffs.push(`exclusion: who=federal is not read as local for ${st}`);
}));
if (Llive.CODES.who.includes('federal')) diffs.push('exclusion: CODES.who still offers federal');
if (Llive.computeCase('Maryland', Llive.CASE_DEF).steps.some(s => s.results.some(r => r.status === 'would'))) diffs.push('exclusion: a what-if status leaked into the new logic');

/* ---------------- Node: require() gives the same module ---------------- */
let pureNote = '';
try {
  const Lreq = require(LOGIC_PATH).create(clone(live));
  const a = Llive.states().map(st => CTXS.map(c => J(normCase(Llive.computeCase(st, c), byNew))) + J(Llive.PORDER.map(r => Llive.billNote(st, r).map(n => n.kind)))).join();
  const b = Llive.states().map(st => CTXS.map(c => J(normCase(Lreq.computeCase(st, c), byNew))) + J(Lreq.PORDER.map(r => Lreq.billNote(st, r).map(n => n.kind)))).join();
  if (a !== b) diffs.push('purity: logic.js gives different answers under require() and in the bare vm');
  const kr = require(KIT_PATH);
  if (kr.markup('**a** ((b)) [[c]]', k => k) !== FVKit.markup('**a** ((b)) [[c]]', k => k)) diffs.push('purity: kit.js differs under require()');
  pureNote = 'pure: every check ran logic.js and kit.js in a bare vm (no window/document/localStorage/fetch; clock and random throw); data frozen, never changed; require() gives the same answers';
} catch (e) { diffs.push(`purity: ${e.message}`); }

/* ---------------- kit.js: golden answers, and markup against app.js:326-358 ---------------- */
let nKit = 0;
const kitEq = (label, got, want) => { nKit++; if (got !== want) diffs.push(`kit ${label}:\n    want ${J(want)}\n    got  ${J(got)}`); };
const kitTry = (label, f) => { try { f(); } catch (e) { diffs.push(`kit ${label}: threw ${e.message}`); } };
const K = FVKit, BADGE = k => `\u0001${k}\u0002`;
kitTry('goldens', () => {
  kitEq('esc', K.esc(`<script>alert("x")&'</script>`), '&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;&lt;/script&gt;');
  kitEq('esc null', K.esc(null), ''); kitEq('esc 0', K.esc(0), '0');
  kitEq('fmt', K.fmt('Hi {state}, {x}', { state: 'Ohio' }), 'Hi Ohio, {x}');
  kitEq('fmt zero', K.fmt('{n} of {n}', { n: 0 }), '0 of 0');
  kitEq('fmt null var', K.fmt('{a}', { a: null }), '{a}');
  kitEq('fmt inherited name', K.fmt('{toString} {constructor}', {}), '{toString} {constructor}');
  kitEq('fmt no vars', K.fmt('{a.b}'), '{a.b}');
  kitEq('slug', K.slug('District of Columbia'), 'district-of-columbia');
  kitEq('curly', K.curly('"a" b "c'), '“a” b ”c');
  kitEq('unq', K.unq('“x”'), 'x');
  kitEq('clip', K.clip('one two three', 7), 'one…'); kitEq('clip short', K.clip('short', 10), 'short');
  kitEq('plainMarks', K.plainMarks('**a** ((b)) [[c]]'), 'a b c');
  kitEq('markup bold + escape', K.markup('**a** <b>', BADGE), '<b class="kw">a</b> &lt;b&gt;');
  kitEq('markup script', K.markup('<script>alert(1)</script>', BADGE), '&lt;script&gt;alert(1)&lt;/script&gt;');
  kitEq('markup also', K.markup('((x)) and ((y))', BADGE), '<span class="q-also">\u0001also\u0002x</span> and <span class="q-also">y</span>');
  kitEq('markup exc', K.markup('[[<img onerror=x>]] ((y)) [[z]]', BADGE), '<span class="q-exc">\u0001exc\u0002&lt;img onerror=x&gt;</span> <span class="q-also">\u0001also\u0002y</span> <span class="q-exc">z</span>');
  kitEq('markup quote mark in bold', K.markup('**"a"**', BADGE), '<b class="kw">“a”</b>');
  kitEq('markup cut', K.markup('**one** two three four', BADGE, 9), '<b class="kw">one</b> two…');
  kitEq('markup badge escapes nothing', K.markup('((a))', () => '<i>B</i>'), '<span class="q-also"><i>B</i>a</span>');
  kitEq('quoteBody', K.quoteBody('"((Also)) a"', BADGE), '<span class="q-also">\u0001also\u0002“Also</span> a”');
  kitEq('quoteBody lead-in', K.quoteBody('the policy must "x"', BADGE), 'the policy must “x”');
  kitEq('shortBill', K.shortBill('HB 756 (2026)'), 'HB 756'); kitEq('shortBill GA', K.shortBill('SB 3564 (104th GA, 2026)'), 'SB 3564');
  kitEq('shortBill plain', K.shortBill('HB 1'), 'HB 1'); kitEq('shortBill only year', K.shortBill('(2026)'), '(2026)');
  kitEq('sessionOf', K.sessionOf('HB 756 (2026)'), '2026'); kitEq('sessionOf range', K.sessionOf('H 4640 (2025-26)'), '2025-26');
  kitEq('sessionOf words', K.sessionOf('H 1062 (2025 Session)'), '2025'); kitEq('sessionOf none', K.sessionOf('HB 1'), '');
  kitEq('safeUrl javascript', K.safeUrl('javascript:alert(1)'), ''); kitEq('safeUrl JAVASCRIPT', K.safeUrl(' JAVASCRIPT:alert(1)'), '');
  kitEq('safeUrl data', K.safeUrl('data:text/html,x'), ''); kitEq('safeUrl protocol-relative', K.safeUrl('//evil.example'), '');
  kitEq('safeUrl https', K.safeUrl(' https://a.example/x?y=1 '), 'https://a.example/x?y=1'); kitEq('safeUrl HTTP', K.safeUrl('HTTP://a.example'), 'HTTP://a.example');
  kitEq('safeUrl null', K.safeUrl(null), '');
  kitEq('theState DC', K.theState('District of Columbia'), 'the District of Columbia');
  kitEq('theState DC cap', K.theState('District of Columbia', true), 'The District of Columbia');
  kitEq('theState Ohio', K.theState('Ohio', true), 'Ohio');
});
// The new markup, with class names and badges put back the old way, must equal app.js markup exactly.
const Okit = oracle(live);
const asOld = h => h.replace(/<span class="q-(also|exc)">(\u0001(also|exc)\u0002)?/g, (m, cls, b, kind) =>
  (b ? (kind !== cls ? 'BADGE-KIND-MISMATCH' : kind === 'exc' ? Okit.XE : Okit.XB) : '') + '<span class="exc">');
const visible = h => h.replace(/<span class="xb">.*?<\/span>/g, m => (m.includes('Exception') ? '[EXC]' : '[ALSO]')).replace(/<[^>]*>/g, '');
const texts = live.quotes.map(q => q.text).concat(['**a** ((b)) [[c]] ((d)) **"e"**', '((start)) then "x"', '"[[all of it]]"', '<script>"x"</script> ((y))', 'a **b', '']);
let nMarkup = 0;
texts.forEach((t, i) => [undefined, 40, 120].forEach(n => {
  nMarkup++;
  kitTry(`markup text ${i}`, () => {
    const want = Okit.markup(t, '', n), got = asOld(K.markup(t, BADGE, n));
    if (got !== want) diffs.push(`kit markup (quote ${i}, n=${n}) differs from app.js:\n    old ${J(want)}\n    new ${J(got)}`);
    const wq = visible(Okit.qbody(t, '1', '', n)), gq = visible(asOld(K.quoteBody(t, BADGE, n)));
    if (wq !== gq) diffs.push(`kit quoteBody (quote ${i}, n=${n}) reads differently from app.js qbody:\n    old ${J(wq)}\n    new ${J(gq)}`);
  });
}));

/* ---------------- routes ---------------- */
const D0 = Object.assign({}, Llive.CASE_DEF);
const RT = (st, view, ctx, open, ex, canonical) => ({ st, view, ctx: Object.assign({}, D0, ctx), open: open || null, ex: ex || null, canonical });
const OV = (open) => RT(null, 'overview', {}, open, null, open ? '#/?open=' + open : '#/');
const ROUTES = [
  ['', OV()], ['#', OV()], ['#/', OV()],
  ['#/?open=judge', OV('judge')],
  ['#/?open=bills', OV()],
  ['#/maryland', RT('Maryland', 'score', {}, null, null, '#/maryland')],
  ['#/Maryland', RT('Maryland', 'score', {}, null, null, '#/maryland')],
  ['#/maryland?open=bills', RT('Maryland', 'score', {}, 'bills', null, '#/maryland?open=bills')],
  ['#/maryland?open=nope', RT('Maryland', 'score', {}, null, null, '#/maryland')],
  ['#/maryland?open=JUDGE', RT('Maryland', 'score', {}, 'judge', null, '#/maryland?open=judge')],
  ['#/maryland/case', RT('Maryland', 'case', {}, null, null, '#/maryland/case')],
  ['#/maryland/case?ex=indiana-lineup', RT('Maryland', 'case', {}, null, 'indiana-lineup', '#/maryland/case?ex=indiana-lineup')],
  ['#/maryland/case?ex=Indiana%20Lineup', RT('Maryland', 'case', {}, null, 'indiana-lineup', '#/maryland/case?ex=indiana-lineup')],
  ['#/maryland/case?ex=', RT('Maryland', 'case', {}, null, null, '#/maryland/case')],
  ['#/maryland/case?crime=shoplifting&ex=montana-shoplifting', RT('Maryland', 'case', { crime: 'minor' }, null, 'montana-shoplifting', '#/maryland/case?crime=shoplifting&ex=montana-shoplifting')],
  ['#/maryland/case?police=state&photo=drone&search=mugshots&crime=shoplifting&ex=illinois-drone', RT('Maryland', 'case', { who: 'state', src: 'drone', db: 'mug', crime: 'minor' }, null, 'illinois-drone', '#/maryland/case?police=state&photo=drone&search=mugshots&crime=shoplifting&ex=illinois-drone')],
  ['#/maryland/case?police=local&photo=still&search=licenses&crime=robbery', RT('Maryland', 'case', {}, null, null, '#/maryland/case')],
  ['#/maryland/case?photo=camera', RT('Maryland', 'case', { src: 'cctv' }, null, null, '#/maryland/case?photo=camera')],
  ['#/maryland/case?who=state&src=cctv&db=mug&crime=minor', RT('Maryland', 'case', { who: 'state', src: 'cctv', db: 'mug', crime: 'minor' }, null, null, '#/maryland/case?police=state&photo=camera&search=mugshots&crime=shoplifting')],
  ['#/maryland/case?who=federal', RT('Maryland', 'case', {}, null, null, '#/maryland/case')],
  ['#/maryland/case?police=federal&src=bodycam', RT('Maryland', 'case', { src: 'bodycam' }, null, null, '#/maryland/case?photo=bodycam')],
  ['#/maryland/case?step=3&whatif=bills&copy=montana', RT('Maryland', 'case', {}, null, null, '#/maryland/case')],
  ['#/maryland/case?open=judge', RT('Maryland', 'case', {}, null, null, '#/maryland/case')],
  ['#/maryland?ex=x', RT('Maryland', 'score', {}, null, null, '#/maryland')],
  ['#tab=case&state=Maryland&who=federal&src=drone', RT('Maryland', 'case', { src: 'drone' }, null, null, '#/maryland/case?photo=drone')],
  ['#tab=case&state=Ohio&who=state&src=cctv&db=mug&crime=minor&step=4&whatif=borrow', RT('Ohio', 'case', { who: 'state', src: 'cctv', db: 'mug', crime: 'minor' }, null, null, '#/ohio/case?police=state&photo=camera&search=mugshots&crime=shoplifting')],
  ['#tab=state&state=Vermont', RT('Vermont', 'score', {}, null, null, '#/vermont')],
  ['#tab=compare&state=Maryland&cmpB=Montana', RT('Maryland', 'score', {}, null, null, '#/maryland')],
  ['#tab=compare&cmode=states&state=Maryland', RT('Maryland', 'score', {}, null, null, '#/maryland')],
  ['#tab=compare&cmode=laws&prot=7&state=Ohio', OV('training')],
  ['#tab=compare&cmode=laws', OV('judge')],
  ['#tab=compare&cmode=laws&prot=99', OV('judge')],
  ['#tab=laws&state=Maryland&p=judge', RT('Maryland', 'score', {}, 'judge', null, '#/maryland?open=judge')],
  ['#tab=laws&state=Maryland&p=4', RT('Maryland', 'score', {}, 'match', null, '#/maryland?open=match')],
  ['#tab=laws&state=Maryland', RT('Maryland', 'score', {}, null, null, '#/maryland')],
  ['#tab=laws&p=crowds', OV('crowds')],
  ['#tab=laws', OV()],
  ['#tab=home', OV()],
  ['#tab=case', OV()],
  ['#tab=nope&state=Maryland', OV()],
  ['#state=Indiana&who=local', RT('Indiana', 'case', {}, null, null, '#/indiana/case')],
  ['#state=Indiana&who=state&src=photo&db=dmv&crime=serious', RT('Indiana', 'case', { who: 'state' }, null, null, '#/indiana/case?police=state')],
  ['#state=District+of+Columbia&who=local', RT('District of Columbia', 'case', {}, null, null, '#/district-of-columbia/case')],
  ['#/compare/maryland/montana', RT('Maryland', 'score', {}, null, null, '#/maryland')],
  ['#/compare/laws/judge', OV('judge')],
  ['#/compare/laws/5', OV('accuracy')],
  ['#/compare', OV()],
  ['#/laws', OV()],
  ['#/laws/bills?state=ohio', RT('Ohio', 'score', {}, 'bills', null, '#/ohio?open=bills')],
  ['#/laws?state=maryland&p=judge', RT('Maryland', 'score', {}, 'judge', null, '#/maryland?open=judge')],
  ['#/laws/wording?q=warrant', OV()],
  ['#start', OV()], ['#case', OV()], ['#compare', OV()], ['#explore', OV()], ['#words', OV()], ['#top', OV()],
  ['#/dc', RT('District of Columbia', 'score', {}, null, null, '#/district-of-columbia')],
  ['#/washington-dc', RT('District of Columbia', 'score', {}, null, null, '#/district-of-columbia')],
  ['#/district-of-columbia/case?police=state', RT('District of Columbia', 'case', { who: 'state' }, null, null, '#/district-of-columbia/case?police=state')],
  ['#/new%20york', RT('New York', 'score', {}, null, null, '#/new-york')],
  ['#/narnia', OV()],
  ['#/narnia/case?police=state', OV()],
  ['#/%E0%A4%A', OV()],
  ['#%%%', OV()],
  ['https://example.com/play/#/montana/case?crime=shoplifting', RT('Montana', 'case', { crime: 'minor' }, null, null, '#/montana/case?crime=shoplifting')]
];
// Every row slug and its number, on the scorecard and the overview; ignored in the case view.
Object.keys(Llive.PSLUG).forEach(k => {
  const v = Llive.PSLUG[k];
  [v, k].forEach(x => {
    ROUTES.push([`#/maryland?open=${x}`, RT('Maryland', 'score', {}, v, null, `#/maryland?open=${v}`)]);
    ROUTES.push([`#/?open=${x}`, OV(v)]);
    ROUTES.push([`#/maryland/case?open=${x}`, RT('Maryland', 'case', {}, null, null, '#/maryland/case')]);
  });
});
let nRoutes = 0;
const routeTry = (label, f) => { try { f(); } catch (e) { diffs.push(`route ${label}: threw ${e.message}`); } };
ROUTES.forEach(([h, want]) => {
  nRoutes++;
  routeTry(J(h), () => {
    const got = Llive.parseHash(h);
    if (J(got) !== J(want)) diffs.push(`route ${J(h)}:\n    want ${J(want)}\n    got  ${J(got)}`);
    const again = Llive.hashFor(got);
    if (again !== got.canonical) diffs.push(`route ${J(h)}: hashFor gives ${again}, canonical is ${got.canonical}`);
    if (J(Llive.parseHash(got.canonical)) !== J(got)) diffs.push(`route ${J(h)}: canonical ${got.canonical} does not read back the same`);
  });
});
[null, undefined, 42, {}, '#/maryland/case?police=%zz'].forEach(h => routeTry(String(h), () => Llive.parseHash(h)));
// Round trip: every state × every setup × example, and every state × every open value.
const OLD = { src: { photo: 'photo', cctv: 'cctv', drone: 'drone', bodycam: 'bodycam' } };
let nTrips = 0;
const trip = (label, input, want) => {
  nTrips++;
  routeTry(label, () => {
    const h = Llive.hashFor(input), r = Llive.parseHash(h);
    const w = Object.assign({}, want, { canonical: h });
    if (J(r) !== J(w)) { diffs.push(`round trip ${label}: hashFor gives ${h}\n    want ${J(w)}\n    got  ${J(r)}`); return; }
    if (J(Llive.parseHash(r.canonical)) !== J(r)) diffs.push(`round trip ${label}: ${h} does not read back the same`);
  });
};
Llive.states().forEach(st => {
  const sl = Llive.slug(st);
  CTXS.forEach(ctx => [null, 'indiana-lineup'].forEach(ex => {
    const want = { st, view: 'case', ctx: Object.assign({}, ctx), open: null, ex };
    trip(`${sl} case ${J(ctx)} ex=${ex}`, { st, view: 'case', ctx, ex }, want);
    trip(`${sl} (by slug) case ${J(ctx)} ex=${ex}`, { st: sl, view: 'case', ctx, ex, open: 'judge' }, want);
    if (ex) return;
    // The same setup in the three old forms reads the same.
    const oldQ = `who=${ctx.who}&src=${OLD.src[ctx.src]}&db=${ctx.db}&crime=${ctx.crime}`;
    [`#/${sl}/case?${oldQ}`, `#tab=case&state=${encodeURIComponent(st)}&${oldQ}`, `#state=${encodeURIComponent(st)}&${oldQ}`].forEach(h => {
      nTrips++;
      routeTry(h, () => { const r = Llive.parseHash(h); if (r.st !== st || r.view !== 'case' || J(r.ctx) !== J(ctx)) diffs.push(`old form ${h} reads as ${J(r)}`); });
    });
  }));
  [null, 'bills'].concat(Object.keys(Llive.PSLUG), Object.values(Llive.PSLUG)).forEach(open => {
    const want = { st, view: 'score', ctx: Object.assign({}, D0), open: open && open !== 'bills' ? Llive.PSLUG[Llive.protBySlug(open)] : open, ex: null };
    trip(`${sl} score open=${open}`, { st, view: 'score', open, ex: 'indiana-lineup' }, want);
  });
});
[null, 'bills'].concat(Object.values(Llive.PSLUG)).forEach(open =>
  trip(`overview open=${open}`, { st: null, open }, { st: null, view: 'overview', ctx: Object.assign({}, D0), open: open === 'bills' ? null : open, ex: null }));

/* ---------------- report ---------------- */
const perCase = 51 * CTXS.length;
console.log(`Oracle: ${oracleFrom} parts A+B (+ app.js:326-358, 365-370, 407-408, 578-605, 599 and 859-868 verbatim), what-if fixed at none`);
console.log(`Datasets: ${datasets.length} (3 real, 200 fuzz, ${datasets.length - 203} degenerate); compared in full against the oracle: ${nCompared}; ${nCalls} checks run`);
console.log(`Compared: ${nCases} cases, ${nCells} scorecard cells, ${nRoutes} routes, ${nTrips} round trips, ${nKit} kit answers, ${nMarkup} markup texts`);
console.log(`Excluded by design: who=federal (${nFed} cases checked to read as local, ${nFed} per dataset not run on the oracle); what-if bills and borrow (${2 * perCase} cases per dataset); compare and laws views (old routes only, rewritten in the route table); all wording`);
console.log(`Paths covered: status ${Object.keys(seen.status).sort().join(' ')} | agg ${Object.keys(seen.agg).sort().join(' ')} | stop ${Object.keys(seen.why).sort().join(' ')} | by ${Object.keys(seen.by).sort().join(' ')} | LAST ${Object.keys(seen.LAST).sort().join(' ')}`);
console.log(`Bills covered: billNote ${Object.keys(seen.note).sort().join(' ')} | billImpact ${Object.keys(seen.impact).sort().join(' ')} | limitType ${Object.keys(seen.ltype).sort().join(' ')}`);
console.log(`Oracle crashes: ${crashes.length} calls in ${crashDatasets.length} dataset${crashDatasets.length === 1 ? '' : 's'} (${crashDatasets.join('; ')}); new code ran without throwing on all of them`);
crashes.slice(0, 10).forEach(c => console.log('  - ' + c));
if (crashes.length > 10) console.log(`  … and ${crashes.length - 10} more`);
if (pureNote) console.log(pureNote);
if (diffs.length) {
  const caught = diffs.some(d => / S4 .* computeCase:/.test(d));
  console.log(`PARITY FAIL: ${diffs.length} difference${diffs.length === 1 ? '' : 's'}${CANARY ? (caught ? ' (canary caught in computeCase, as it should)' : ' (but none in computeCase: the canary itself was not caught)') : ''}`);
  diffs.slice(0, 20).forEach(d => console.log('  * ' + d));
  process.exit(CANARY && !caught ? 0 : 1);
}
if (CANARY) { console.log('CANARY NOT CAUGHT: the swapped precedence passed parity'); process.exit(0); }
if (mismatchSize) console.log(`PARITY OK: ${nCompared} datasets, ${nCases} cases + ${nCells} scorecard cells`);
else console.log(`PARITY OK: ${nCompared} datasets × ${nStates0} cases + ${nCells0} scorecard cells`);
process.exit(0);
