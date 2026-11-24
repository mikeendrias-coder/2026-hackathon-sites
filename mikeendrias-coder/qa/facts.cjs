#!/usr/bin/env node
/* Golden facts about the law, checked on the frozen data file (design-site-v2.md §4.4).
   Run from FV: node qa/facts.cjs   -> one OK/FAIL line per fact, then "FACTS OK" (exit 0) or "FACTS FAIL" (exit 1). */
'use strict';
const fs = require('fs');
const path = require('path');
const FV = path.resolve(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(FV, 'qa', 'fixtures', 'live-2026-11-18.json'), 'utf8'));
const L = require(path.join(FV, 'play', 'logic.js')).create(D);

let fails = 0;
const fact = (text, test) => {
  let ok = false, note = '';
  try { const r = test(); ok = r === true; if (!ok && r !== false && r != null) note = ` (got ${JSON.stringify(r)})`; }
  catch (e) { note = ` (threw: ${e.message})`; }
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${text}${note}`);
};
const ctx = (who, src, db, crime) => ({ who, src, db, crime });
const run = (st, c) => L.computeCase(st, c);
const step = (c, key) => c.steps.find(s => s.key === key);
const stoppedAt = (c, i, kind) => c.stopAt === i && !!c.why && c.why.kind === kind;
const J = x => JSON.stringify(x);
const allNo = st => L.PORDER.every(r => L.stateProt(st, r).level === 'no');

console.log('Face Value facts, on qa/fixtures/live-2026-11-18.json');

// Counts and sessions
fact('Counts: 12 states with rules, 2 with a ban, 4 with a law that has none of the 7, 33 with no law',
  () => L.counts.rules === 12 && L.counts.ban === 2 && L.counts.zero === 4 && L.counts.none === 33 || L.counts);
fact('The bill session is 2026, and 25 of 54 bills are in it', () => L.LAST === '2026' && D.bills.filter(L.inSession).length === 25 || [L.LAST, D.bills.filter(L.inSession).length]);

// Vermont and Virginia
['local', 'state'].forEach(who => fact(`Vermont, ${who} police: stopped at step 1, Crime, by the pause`, () => {
  const c = run('Vermont', ctx(who, 'photo', 'dmv', 'serious'));
  return stoppedAt(c, 0, 'ban') && c.why.law.ban.kind === 'Pause' || { stopAt: c.stopAt, why: c.why && c.why.kind };
}));
fact('Virginia, local police: stopped at step 1 by the ban', () => stoppedAt(run('Virginia', ctx('local', 'photo', 'dmv', 'serious')), 0, 'ban'));
fact('Virginia, state police: the search goes through, every step is a gap, and the ban note shows', () => {
  const c = run('Virginia', ctx('state', 'photo', 'dmv', 'serious'));
  return c.stopAt === -1 && c.steps.filter(s => s.key !== 'trial').every(s => s.agg === 'gap') && !!L.banGap('Virginia', { who: 'state' }) && !L.banGap('Virginia', { who: 'local' });
});

// Shoplifting
['Maine', 'Maryland', 'Montana', 'Utah'].forEach(st => fact(`${st}, shoplifting: stopped at step 1, Crime`, () => stoppedAt(run(st, ctx('local', 'photo', 'dmv', 'minor')), 0, 'crime')));
fact('Colorado, shoplifting: not stopped', () => run('Colorado', ctx('local', 'photo', 'dmv', 'minor')).stopAt === -1);

// Illinois
fact('Illinois, drone footage: stopped at step 3, Search, by the drone bar', () => stoppedAt(run('Illinois', ctx('local', 'drone', 'dmv', 'serious')), 2, 'bar'));
fact("Illinois, security camera: the Search step is \"law doesn't reach this\"", () => step(run('Illinois', ctx('local', 'cctv', 'dmv', 'serious')), 'search').agg === 'bypassed');

// Indiana
fact('Indiana: the scorecard says Partly for "A match isn\'t enough" (lineups only)', () => L.stateProt('Indiana', '4').level === 'part');
fact('Indiana: the case arrest step is mixed', () => { const a = step(run('Indiana', ctx('local', 'photo', 'dmv', 'serious')), 'arrest').agg; return a === 'mixed' || a; });

// New Hampshire
fact('New Hampshire: "Judge must approve" is Partly and flagged Unclear', () => { const p = L.stateProt('New Hampshire', '1'); return p.level === 'part' && p.review === true; });
fact('New Hampshire, local police: Judge is bypassed because the law only covers state agencies', () => {
  const r = step(run('New Hampshire', ctx('local', 'photo', 'dmv', 'serious')), 'approval').results[0];
  return r.status === 'bypassed' && /state agencies/.test(r.top.reason) && r.top.by === 'who' || r;
});
fact('New Hampshire, state police: Judge is partly covered', () => step(run('New Hampshire', ctx('state', 'photo', 'dmv', 'serious')), 'approval').results[0].status === 'partial');
fact('New Hampshire rule 1 catch lists both limits: live scanning only, and state agencies only', () => {
  const c = L.catchOf('New Hampshire', '1');
  return c.some(x => x.kind === 'limit' && x.code === 'real-time only') && c.some(x => x.kind === 'who' && x.who.length === 1 && x.who[0] === 'state') || c;
});

// Kentucky, Ohio, Maryland, DC
fact('Kentucky: all 7 are No, the law has none of the 7, and 1 other law is listed', () => allNo('Kentucky') && L.groupOf('Kentucky') === 'zero' && L.otherLawsOf('Kentucky').length === 1);
fact('Kentucky: the use-policy law shows up in a case', () => L.otherLaws('Kentucky', ctx('local', 'photo', 'dmv', 'serious')).length === 1);
fact('Ohio: all 7 are No, no law, and 2 bills in the session', () => allNo('Ohio') && L.groupOf('Ohio') === 'none' && L.sessionBills('Ohio').length === 2 || L.sessionBills('Ohio').length);
fact('Maryland: 5 of 7, all 5 in full', () => L.protCount('Maryland') === 5 && L.fullCount('Maryland') === 5);
fact('Maryland rule 3: the HB 756 and HB 762 note is "loose" (widens police use), and no note says they add it', () => {
  const notes = L.billNote('Maryland', '3'), names = k => (notes.find(n => n.kind === k) || { bills: [] }).bills.map(b => b.name);
  const loose = names('loose');
  return loose.includes('HB 756 (2026)') && loose.includes('HB 762 (2026)')
    && !notes.some(n => n.kind !== 'loose' && n.bills.some(b => /HB 75[6]|HB 762/.test(b.name))) || notes.map(n => [n.kind, n.bills.map(b => b.name)]);
});
fact('Maryland HB 756: its impact on rule 3 is "loose"', () => {
  const b = D.bills.find(x => x.state === 'Maryland' && /^HB 756/.test(x.name));
  return L.billImpact(b).some(x => x.rule === '3' && x.kind === 'loose');
});
fact('Maryland: the old 2025 bill HB 210 is out of session, and the session list is HB 756 and HB 762', () =>
  J(L.sessionBills('Maryland').map(b => b.name).sort()) === J(['HB 756 (2026)', 'HB 762 (2026)']) || L.sessionBills('Maryland').map(b => b.name));

// Full and partial counts, which differ from the protection count
fact('Utah: 3 of 7, but only 2 in full', () => L.protCount('Utah') === 3 && L.fullCount('Utah') === 2 || [L.protCount('Utah'), L.fullCount('Utah')]);
fact('Montana: 5 of 7, 4 in full', () => L.protCount('Montana') === 5 && L.fullCount('Montana') === 4 || [L.protCount('Montana'), L.fullCount('Montana')]);
fact('New Hampshire: 2 of 7, none in full', () => L.protCount('New Hampshire') === 2 && L.fullCount('New Hampshire') === 0);

// The national lists
fact('"Judge must approve" nationally: Montana in full; Massachusetts, Minnesota, New Hampshire and Utah limited', () => {
  const n = L.nationalProt('1'); return J(n) === J({ yes: ['Montana'], part: ['Massachusetts', 'Minnesota', 'New Hampshire', 'Utah'] }) || n;
});
fact('"Serious crimes only" nationally: Maine, Maryland, Montana and Utah, all in full', () => J(L.nationalProt('3')) === J({ yes: ['Maine', 'Maryland', 'Montana', 'Utah'], part: [] }) || L.nationalProt('3'));
fact('No state is on both national lists, for any of the 7', () => L.PORDER.every(r => { const n = L.nationalProt(r); return !n.part.some(s => n.yes.includes(s)); }));

// Other laws and bans
fact('Vermont: other laws lists the child exploitation exception and leaves out the pause', () =>
  J(L.otherLawsOf('Vermont').map(l => l.name)) === J(['Child exploitation exception (H.195, Act 17)']) || L.otherLawsOf('Vermont').map(l => l.name));
fact('Virginia: no other laws (the ban law is not listed as one)', () => L.otherLawsOf('Virginia').length === 0);
['local', 'state'].forEach(who => fact(`Vermont, ${who} police: the pause covers them, so no ban note`, () => L.banGap('Vermont', { who }) === null));
fact('Ohio, with no ban: no ban note', () => L.banGap('Ohio', { who: 'state' }) === null);

// Session bills and bill notes
fact('Massachusetts: H 4640 (2025-26) is still pending, so it is in the session; the 2021-24 bills are not', () =>
  J(L.sessionBills('Massachusetts').map(b => b.name)) === J(['H 4640 (2025-26)']) || L.sessionBills('Massachusetts').map(b => b.name));
fact('California: 2 bills on record, none in the session', () => D.bills.filter(b => b.state === 'California').length === 2 && L.sessionBills('California').length === 0);
fact('New York: 3 session bills, newest year first', () => L.sessionBills('New York').length === 3 && L.sessionBills('New York').every(b => b.year === '2025'));
const note = (st, r) => L.billNote(st, r).map(n => [n.kind, n.bills.map(b => b.name)]);
fact('Massachusetts rule 1 (limited now): H 4640 would make it full ("up")', () => J(note('Massachusetts', '1')) === J([['up', ['H 4640 (2025-26)']]]) || note('Massachusetts', '1'));
fact('Colorado rule 1 (none now): SB 26-071 would add it in full ("add")', () => J(note('Colorado', '1')) === J([['add', ['SB 26-071 (2026)']]]) || note('Colorado', '1'));
fact('Rhode Island rule 1 (none now): H 8119 would add a limited form ("addPart")', () => J(note('Rhode Island', '1')) === J([['addPart', ['H 8119 (2026)']]]) || note('Rhode Island', '1'));
fact('Illinois: SB 3564 makes rule 6 full ("up") and adds rule 4 ("add")', () =>
  J(note('Illinois', '6')) === J([['up', ['SB 3564 (104th GA, 2026)']]]) && J(note('Illinois', '4')) === J([['add', ['SB 3564 (104th GA, 2026)']]]) || [note('Illinois', '6'), note('Illinois', '4')]);
fact('Maryland rule 1 (full now): no bill note', () => note('Maryland', '1').length === 0);
fact('Massachusetts H 4640 impact: rule 1 up; rules 2, 3, 6 and 7 add', () => {
  const b = D.bills.find(x => x.name === 'H 4640 (2025-26)'), i = L.billImpact(b).map(x => x.rule + x.kind).join(' ');
  return i === '1up 2add 3add 6add 7add' || i;
});

// Limit types
fact('Limit types: "adds offenses" loose in any case, "fact of use" weak, "real-time only" narrow, unknown narrow', () =>
  L.limitType('adds offenses') === 'loose' && L.limitType('Adds Offenses') === 'loose' && L.limitType('fact of use') === 'weak'
  && L.limitType('real-time only') === 'narrow' && L.limitType('no such limit') === 'narrow' && L.limitType(null) === 'narrow');
fact('New Hampshire rule 1 catch: both rows typed narrow', () => L.catchOf('New Hampshire', '1').every(c => c.type === 'narrow'));

// The six steps
fact('Case steps carry their icons and checks: crime/3, approval/1, search/6,5,7, arrest/4 lineup + arrest, disclose/2, trial/none', () => {
  const s = run('Maryland', ctx('local', 'photo', 'dmv', 'serious')).steps.map(x => `${x.key}:${x.icon}:${x.checks.map(c => c.join('@')).join(',')}`).join(' ');
  return s === 'crime:step-crime:3 approval:step-approval:1 search:step-search:6,5,7 arrest:step-arrest:4@lineup,4@arrest disclose:step-disclose:2 trial:step-trial:' || s;
});
fact('Bypass reasons are tagged: New Hampshire local by who, Illinois camera by source, Indiana arrest by lineup', () => {
  const by = (st, c, key) => step(run(st, c), key).results.flatMap(r => r.hits.filter(h => h.kind === 'bypassed').map(h => h.by));
  const nh = by('New Hampshire', ctx('local', 'photo', 'dmv', 'serious'), 'approval'), il = by('Illinois', ctx('local', 'cctv', 'dmv', 'serious'), 'search'), ind = by('Indiana', ctx('local', 'photo', 'dmv', 'serious'), 'arrest');
  return nh.includes('who') && il.includes('source') && ind.includes('lineup') || { nh, il, ind };
});

fact('DC: slug district-of-columbia, "dc" and "washington-dc" open it, tile DC on the map, no law', () =>
  L.slug('District of Columbia') === 'district-of-columbia' && L.stateBySlug('dc') === 'District of Columbia' && L.stateBySlug('washington-dc') === 'District of Columbia'
  && L.ABBR['District of Columbia'] === 'DC' && Array.isArray(L.POS.DC) && L.groupOf('District of Columbia') === 'none' && L.mapLevel('District of Columbia') === 'l0');
fact('A still photo makes "No live crowd scanning" not apply', () => L.states().every(st => L.effective(st, '6', ctx('local', 'photo', 'dmv', 'serious')).status === 'na'));

// The 4 default examples
fact('Example montana-shoplifting (Montana, local, camera, mugshots, shoplifting): stopped at step 1, Crime', () => stoppedAt(run('Montana', ctx('local', 'cctv', 'mug', 'minor')), 0, 'crime'));
fact('Example indiana-lineup (Indiana, local, still, licenses, robbery): goes through, arrest step mixed', () => {
  const c = run('Indiana', ctx('local', 'photo', 'dmv', 'serious')); return c.stopAt === -1 && step(c, 'arrest').agg === 'mixed';
});
fact('Example illinois-drone (Illinois, local, drone, licenses, robbery): stopped at step 3, Search, by the bar', () => stoppedAt(run('Illinois', ctx('local', 'drone', 'dmv', 'serious')), 2, 'bar'));
fact('Example kentucky-no-limits (Kentucky, local, still, licenses, shoplifting): goes through with a gap at every step', () => {
  const c = run('Kentucky', ctx('local', 'photo', 'dmv', 'minor'));
  return c.stopAt === -1 && c.steps.filter(s => s.key !== 'trial').every(s => s.agg === 'gap') || c.steps.map(s => s.agg);
});

console.log(fails ? `FACTS FAIL: ${fails}` : 'FACTS OK');
process.exit(fails ? 1 : 0);
