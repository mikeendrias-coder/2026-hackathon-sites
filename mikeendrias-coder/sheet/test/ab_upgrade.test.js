'use strict';
// (a) a v1 sheet built the real way, by v1's own setupFromSite(); (b) the dry run, then the upgrade, resume and undo.
const assert = require('assert');
const H = require('./harness');
const { FV } = H.pure();
const same = (a, b, m) => assert.strictEqual(FV.canonical(a), FV.canonical(b), m);
const noUpdated = d => { const c = JSON.parse(JSON.stringify(d)); delete c.updated; return c; };

let A = null;
const sheetA = () => A || (A = H.v1Sheet());

const testsA = [
  ['setupFromSite builds the 13 v1 tabs (plus the Scratch tab we add)', () => {
    const { env } = sheetA();
    assert.strictEqual(env.ss.sheets.map(s => s.name).join('|'), FV.V1_TABS.join('|') + '|Scratch');
  }],
  ['v1 layout code ran: 600-row FALSE fill on checkboxes, (k) protection headers, dropdown validation', () => {
    const { env } = sheetA(), laws = H.tab(env, 'Laws'), c = H.col(laws, 'Unclear');
    assert.strictEqual(laws.getRange(601, c).getValue(), false);
    assert.strictEqual(laws.getRange(601, c).getDataValidation().getCriteriaType(), 'CHECKBOX');
    assert.ok(H.headers(laws).some(h => /\(1\)$/.test(h)));
    assert.strictEqual(laws.getRange(2, H.col(laws, 'State')).getDataValidation().getCriteriaType(), 'VALUE_IN_RANGE');
  }],
  ['realism: Jake\'s notes column, a Quotes column, a cell note, a blank row in Bills, numeric years in General cells', () => {
    const { env } = sheetA(), bills = H.tab(env, 'Bills');
    assert.ok(H.headers(H.tab(env, 'Laws')).indexOf("Jake's notes") >= 0);
    assert.ok(H.headers(H.tab(env, 'Quotes')).indexOf('Reviewer notes') >= 0);
    assert.strictEqual(H.tab(env, 'Laws').getRange(2, H.col(H.tab(env, 'Laws'), 'Summary')).getNote(), 'Source: committee report p.4');
    assert.strictEqual(bills.getRange(10, 2).getValue(), '');
    assert.strictEqual(typeof bills.getRange(5, H.col(bills, 'Year')).getValue(), 'number');
  }],
  ['v1 reads its own sheet back as live.json (no errors)', () => {
    const { env } = sheetA(), ctx = H.loadV1(env), r = require('vm').runInContext('build_()', ctx);
    assert.strictEqual(r.errors.length, 0, JSON.stringify(r.errors));
    same(noUpdated(r.data), noUpdated(H.LIVE));
  }]
];

let B = null;
function sheetB() {
  if (B) return B;
  const { env } = H.v1Sheet(), ctx = H.loadV2(env);
  const before = JSON.stringify(H.mock.snapshot(env.ss)), w0 = env.fake.writes.length;
  const dry = ctx.menuUpgrade();
  B = { env, ctx, dry, before, after: JSON.stringify(H.mock.snapshot(env.ss)), w0, w1: env.fake.writes.length };
  return B;
}
const testsB = [
  ['the dry run changes nothing and makes no GitHub writes', () => {
    const b = sheetB();
    assert.ok(b.dry.ok, JSON.stringify(b.dry));
    assert.strictEqual(b.after, b.before, 'snapshot unchanged');
    assert.strictEqual(b.w1, b.w0); assert.strictEqual(b.env.fake.writes.length, 0);
  }],
  ['the dry-run report: row counts, conversions, Vermont, 2 drone heads-ups, kept column and tab', () => {
    const r = sheetB().dry.report;
    const want = { Laws: 24, Bills: 54, Quotes: 126, States: 51, Protections: 7, Limits: 18, Labels: 9, Stories: 6, Glossary: 10, 'Step notes → Words why.*': 5 };
    Object.keys(want).forEach(k => assert.strictEqual(r.rows[k], want[k], k));
    assert.ok(/10 "law as a whole", 1 "every protection it adds"/.test(r.conversions[0]));
    assert.ok(/Vermont · Moratorium.*Pause/.test(r.conversions[1]) && /Virginia.*Ban/.test(r.conversions[1]) && /H\.195.*Exception/.test(r.conversions[1]));
    assert.ok(/^121 numbered/.test(r.conversions[2])); assert.ok(/^1 story/.test(r.conversions[3]));
    assert.ok(/Vermont/.test(r.dataCheck) && /no visible change/.test(r.dataCheck));
    assert.strictEqual(r.heads.filter(h => /said twice/.test(h)).length, 2);
    assert.deepStrictEqual(Array.from(r.kept.columns), ["Laws › Jake's notes", 'Quotes › Reviewer notes']); assert.deepStrictEqual(Array.from(r.kept.tabs), ['Scratch']);
    assert.strictEqual(r.kept.notes.moved, 1); assert.strictEqual(r.kept.notes.onlyInBackup, 0); assert.strictEqual(r.kept.formulas, 0);
    assert.ok(/Column: Quotes › Reviewer notes/.test(sheetB().env.ui.last().html) && /1 cell note moves with their cells/.test(sheetB().env.ui.last().html));
    assert.strictEqual(r.blocking.length, 0);
    assert.strictEqual(sheetB().dry.liveDiff.count, 0, 'sheet matches live');
    assert.ok(/runUpgrade\(/.test(sheetB().env.ui.last().html), 'Upgrade now button');
  }],
  ['the dry run shows sheet edits that never reached the live site', () => {
    const { env } = H.v1Sheet({ realism: false }), laws = H.tab(env, 'Laws');
    H.set(laws, 'Summary', H.findRow(laws, 'Name', 'Lineup rule (SB 141)'), 'Changed after the last preview.');
    const dry = H.loadV2(env).menuUpgrade();
    assert.strictEqual(dry.liveDiff.count, 1);
    assert.ok(/Indiana · Lineup rule \(SB 141\)/.test(dry.liveDiff.details.join('\n')));
  }],
  ['Upgrade now: v2 tabs in order, hidden backups, Step notes gone, schema 2, one Change log row', () => {
    const b = sheetB(), run = b.ctx.runUpgrade(b.dry.hash, 'https://docs.google.com/spreadsheets/d/BACKUP/edit');
    assert.ok(run.ok, JSON.stringify(run));
    const ss = b.env.ss, names = ss.sheets.map(s => s.name);
    const visible = ss.sheets.filter(s => !s.hidden).map(s => s.name);
    assert.strictEqual(visible.join('|'), 'Start here|Words on the page|Laws|Bills|Quotes|States|Protections|Stories|Glossary|Limits|Labels|Settings|Refresh checklist|Change log|Scratch');
    assert.strictEqual(names.filter(n => /^v1 backup: /.test(n)).length, 13);
    ss.sheets.filter(s => /^v1 backup: /.test(s.name)).forEach(s => { assert.ok(s.hidden); assert.ok(s.protections.some(p => p.description === 'fv:backup' && p.warningOnly)); });
    assert.ok(names.indexOf('Step notes') < 0);
    assert.ok(ss.find('Lists').hidden && ss.find('Self-test').hidden);
    assert.strictEqual(ss.meta.find(m => m.key === 'fv.schema').value, '2');
    const log = H.tab(b.env, 'Change log').getDataRange().getValues().slice(1);
    assert.strictEqual(log.length, 1); assert.strictEqual(log[0][1], 'Upgrade');
    assert.ok(/BACKUP/.test(log[0][4]), 'backup link recorded');
    assert.strictEqual(H.tab(b.env, 'Scratch').getRange(2, 2).getValue(), 'me');
    const laws = H.tab(b.env, 'Laws'), jc = H.col(laws, "Jake's notes");
    assert.strictEqual(jc, H.headers(laws).length, 'kept column is last');
    assert.ok(/Kept from before the upgrade/.test(laws.getRange(1, jc).getNote()));
    assert.strictEqual(laws.getRange(H.findRow(laws, 'Name', H.LIVE.laws[1].name), jc).getValue(), 'Check the 2026 amendment');
    const quotes = H.tab(b.env, 'Quotes'), qc = H.col(quotes, 'Reviewer notes');
    assert.strictEqual(quotes.getRange(3, qc).getValue(), 'Drew: verify pinpoint', 'the Quotes column moved with its row');
    assert.strictEqual(H.get(quotes, 'Exact wording', 3), H.LIVE.quotes[1].text);
    assert.strictEqual(laws.getRange(H.findRow(laws, 'Name', H.LIVE.laws[0].name), H.col(laws, 'Summary')).getNote(), 'Source: committee report p.4', 'cell note kept');
    const selfBad = H.tab(b.env, 'Self-test').getDataRange().getValues().filter((r, i) => i && r[6] && r[6] !== 'OK');
    assert.strictEqual(selfBad.length, 0, JSON.stringify(selfBad.slice(0, 5)));
    b.env.ui.menus = {}; b.ctx.onOpen();
    assert.ok(b.env.ui.menus['Face Value'].items.some(i => i.caption === 'Deploy to live site…'));
    assert.strictEqual(b.env.fake.puts().length, 0, 'upgrade made no commits');
  }],
  ['user columns on every v1 tab move to the matching v2 rows; dates stay dates; notes move; formulas are reported', () => {
    const { env } = H.v1Sheet({ realism: false });
    const add = (name, header, cells) => { const sh = H.tab(env, name), c = sh.getLastColumn() + 1; sh.getRange(1, c).setValue(header); Object.keys(cells).forEach(r => sh.getRange(+r, c).setValue(cells[r])); return c; };
    const laws = H.tab(env, 'Laws');
    const dc = add('Laws', 'Date verified', {}); laws.getRange(2, dc).setValue(new Date(H.mock.instantOf({ y: 2026, m: 3, d: 15 }, env.ss.tz)));
    laws.getRange(2, dc).setNumberFormat('yyyy-mm-dd');
    const lc = add('Laws', 'Len', {}); laws.getRange(2, lc).setFormula('=LEN(A2)');
    laws.getRange(3, H.col(laws, 'Bar text')).setNote('Ask about the 2025 bill');
    const gr = H.findRow(H.tab(env, 'Glossary'), 'Key', 'bill');
    add('Glossary', 'Reviewer notes', { [gr]: 'Jake: simpler please' });
    H.tab(env, 'Glossary').getRange(gr, 3).setNote('Old definition was longer');
    const pr = H.findRow(H.tab(env, 'Protections'), 'ID', '3');
    add('Protections', 'Owner', { [pr]: 'Drew' });
    const sr = H.findRow(H.tab(env, 'Step notes'), 'Step', 'search');
    add('Step notes', 'Draft idea', { [sr]: 'Say "database" here' });
    const lr = H.findRow(H.tab(env, 'Limits'), 'Code', 'lineups only');
    add('Limits', 'Source', { [lr]: 'IN SB 141' });
    add('Labels', 'Comment', { 2: 'first label' });
    add('States', 'Owner', { [H.findRow(H.tab(env, 'States'), 'State', 'Ohio')]: 'Jake' });
    add('Stories', 'Used in class', { 2: 'yes' });
    const setr = H.findRow(H.tab(env, 'Settings'), 'Setting', 'Research note');
    add('Settings', 'Comment', { [setr]: 'Update each spring' });
    const ctx = H.loadV2(env), up = H.upgrade(env, ctx), k = up.dry.report.kept;
    ['Laws › Date verified', 'Laws › Len', 'Glossary › Reviewer notes (now "Reviewer notes (kept)")', 'Protections › Owner', 'Step notes › Draft idea', 'Limits › Source', 'Labels › Comment', 'States › Owner', 'Stories › Used in class', 'Settings › Comment']
      .forEach(c => assert.ok(k.columns.indexOf(c) >= 0, 'listed: ' + c + ' in ' + JSON.stringify(k.columns)));
    assert.strictEqual(k.formulas, 1); assert.ok(up.dry.report.heads.some(h => /1 cell held formulas \(Laws › Len\)/.test(h)));
    assert.strictEqual(k.notes.moved, 2);
    const v2 = name => H.tab(env, name);
    const L2 = v2('Laws'), r2 = H.findRow(L2, 'Name', H.LIVE.laws[0].name);
    assert.strictEqual(L2.getRange(r2, H.col(L2, 'Date verified')).getDisplayValue(), '2026-03-15', 'a date stays the date shown');
    assert.strictEqual(L2.getRange(H.findRow(L2, 'Name', H.LIVE.laws[1].name), H.col(L2, 'Bar text')).getNote(), 'Ask about the 2025 bill');
    const G2 = v2('Glossary'), g2 = H.findRow(G2, 'Key', 'bill');
    assert.strictEqual(G2.getRange(g2, H.col(G2, 'Reviewer notes (kept)')).getValue(), 'Jake: simpler please');
    assert.strictEqual(G2.getRange(g2, H.col(G2, 'Definition')).getNote(), 'Old definition was longer');
    assert.strictEqual(H.headers(G2).filter(h => h === 'Reviewer notes').length, 1, 'no second "Reviewer notes" header');
    assert.strictEqual(H.get(v2('Protections'), 'Owner', H.findRow(v2('Protections'), 'Key', '3')), 'Drew');
    const W2 = v2('Words on the page'); assert.strictEqual(H.get(W2, 'Draft idea', H.findRow(W2, 'Key', 'why.search')), 'Say "database" here');
    assert.strictEqual(H.get(v2('Limits'), 'Source', H.findRow(v2('Limits'), 'Code', 'lineups only')), 'IN SB 141');
    assert.strictEqual(H.get(v2('Labels'), 'Comment', 2), 'first label');
    assert.strictEqual(H.get(v2('States'), 'Owner', H.findRow(v2('States'), 'State', 'Ohio')), 'Jake');
    assert.strictEqual(H.get(v2('Stories'), 'Used in class', 2), 'yes');
    assert.strictEqual(H.get(v2('Settings'), 'Comment', H.findRow(v2('Settings'), 'Setting', 'Research note')), 'Update each spring');
    assert.ok(FV.additiveEqual(H.LIVE, H.buildOf(env, ctx, 'preview')).ok, 'site data unchanged');
    assert.strictEqual(H.checkOf(env, ctx).filter(p => p.sev === 'E').length, 0);
  }],
  ['a user tab named like a new v2 tab ("Change log") is renamed, listed in the dry run, kept, and named back by Undo', () => {
    const { env } = H.v1Sheet({ realism: false });
    const mine = env.ss.api.insertSheet('Change log'); mine.getRange(1, 1, 2, 2).setValues([['my', 'log'], ['2025-01-01', 'Jake fixed Ohio']]);
    const ctx = H.loadV2(env), dry = ctx.menuUpgrade();
    assert.ok(dry.ok);
    assert.deepStrictEqual(Array.from(dry.report.kept.renamed, r => r.from + ' > ' + r.to), ['Change log > Change log (before v2)']);
    assert.ok(/renamed &quot;Change log \(before v2\)&quot;/.test(env.ui.last().html), 'the dry run says so');
    assert.ok(env.ss.api.getSheetByName('Change log') && !env.ss.api.getSheetByName('Change log (before v2)'), 'the dry run renames nothing');
    assert.ok(ctx.runUpgrade(dry.hash, '').ok);
    const kept = env.ss.api.getSheetByName('Change log (before v2)');
    assert.strictEqual(kept.getRange(2, 2).getValue(), 'Jake fixed Ohio');
    assert.strictEqual(H.headers(H.tab(env, 'Change log'))[0], 'When', 'the new Change log is the script\'s');
    assert.strictEqual(H.tab(env, 'Change log').getDataRange().getValues().slice(1).length, 1);
    const u = ctx.menuUndoUpgrade(); assert.ok(u.ok);
    assert.strictEqual(env.ss.api.getSheetByName('Change log').getRange(2, 2).getValue(), 'Jake fixed Ohio', 'Undo gives the tab its name back');
  }],
  ['FV.V1_KNOWN matches the headers the v1 converter reads', () => {
    const { FV1 } = H.pure();
    Object.keys(FV1.HEAD).forEach(n => assert.strictEqual(FV.V1_KNOWN[n].join('|'), FV1.HEAD[n].join('|'), n));
  }],
  ['upgraded rows: why.* Approved, Words defaults Draft, Protections why Draft, 4 example stories ticked', () => {
    const { env } = H.fresh(), w = H.tab(env, 'Words on the page');
    const v = w.getDataRange().getValues(), h = v[0].map(String), k = h.indexOf('Key'), s = h.indexOf('Status'), n = h.indexOf('Reviewer notes');
    v.slice(1).forEach(r => { if (/^why\./.test(r[k])) assert.strictEqual(r[s], 'Approved', r[k]); else { assert.strictEqual(r[s], 'Draft', r[k]); assert.ok(/needs Jake\/Drew review/.test(r[n])); } });
    const st = H.tab(env, 'Stories'), sv = st.getDataRange().getValues(), sh = sv[0].map(String);
    assert.strictEqual(sv.slice(1).filter(r => r[sh.indexOf('Show on new page')] === true).length, 4);
    assert.strictEqual(sv.slice(1).find(r => r[sh.indexOf('State')] === 'Maryland')[sh.indexOf('Who searches')], 'Federal agent (old site only)');
    const p = H.tab(env, 'Protections').getDataRange().getValues(); assert.ok(p.slice(1).every(r => r[5] === 'Draft' && r[3]));
  }],
  ['a blocking issue (a ban that is also an exception) hides Upgrade now and runUpgrade refuses', () => {
    const { env } = H.v1Sheet({ realism: false }), laws = H.tab(env, 'Laws');
    H.set(laws, 'Exception to a ban', H.findRow(laws, 'Name', 'Moratorium (S.124, Act 166)'), true);
    const ctx = H.loadV2(env), dry = ctx.menuUpgrade();
    assert.ok(dry.report.blocking.some(b => /both a ban and an exception/.test(b)));
    assert.ok(!/runUpgrade\(/.test(env.ui.last().html), 'no Upgrade now button');
    const run = ctx.runUpgrade(dry.hash, '');
    assert.ok(!run.ok && /blocking/.test(run.error));
    assert.ok(!env.ss.sheets.some(s => /^v1 backup/.test(s.name)), 'no backups made');
  }],
  ['a sheet that is not v1 is left alone, with the exact header mismatch', () => {
    const { env } = H.v1Sheet({ realism: false }); H.tab(env, 'Quotes').getRange(1, 2).setValue('Item');
    const before = JSON.stringify(H.mock.snapshot(env.ss)), r = H.loadV2(env).menuUpgrade();
    assert.ok(!r.ok && r.mismatch.some(m => /Quotes headers/.test(m) && /Item/.test(m)));
    assert.strictEqual(JSON.stringify(H.mock.snapshot(env.ss)), before);
  }],
  ['runUpgrade aborts when the sheet changed after the dry run', () => {
    const { env } = H.v1Sheet({ realism: false }), ctx = H.loadV2(env), dry = ctx.menuUpgrade();
    H.set(H.tab(env, 'Laws'), 'Summary', 2, 'edited during the dialog');
    const run = ctx.runUpgrade(dry.hash, '');
    assert.ok(!run.ok && /while the dry run was open/.test(run.error));
  }],
  ['a run that times out resumes from the backups and ends identical to a clean upgrade', () => {
    const { env } = H.v1Sheet(), ctx = H.loadV2(env), dry = ctx.menuUpgrade();
    env.faults.push({ sheet: 'Quotes', op: 'clear', times: 1 });
    const r1 = ctx.runUpgrade(dry.hash, '');
    assert.ok(!r1.ok, 'first run failed');
    assert.strictEqual(env.ss.meta.find(m => m.key === 'fv.upgradeState').value, 'backed-up');
    const dry2 = ctx.menuUpgrade();
    assert.ok(dry2.ok && /did not finish/.test(env.ui.last().html));
    const r2 = ctx.runUpgrade(dry2.hash, '');
    assert.ok(r2.ok, JSON.stringify(r2));
    assert.strictEqual(env.ss.sheets.filter(s => /^v1 backup: /.test(s.name)).length, 13, 'no second set of backups');
    const clean = H.fresh();
    assert.strictEqual(FV.hashInput(H.buildOf(env, ctx, 'preview')), FV.hashInput(H.buildOf(clean.env, clean.ctx, 'preview')));
  }],
  ['Undo the upgrade puts v1 back exactly; upgrading again works', () => {
    const { env, ctx, J1 } = H.fresh();
    const r = ctx.menuUndoUpgrade();
    assert.ok(r.ok, JSON.stringify(r));
    const names = env.ss.sheets.filter(s => !s.hidden).map(s => s.name);
    assert.strictEqual(names.slice(0, 13).join('|'), FV.V1_TABS.join('|'));
    assert.ok(!env.ss.meta.some(m => m.key === 'fv.schema'));
    assert.ok(env.ss.sheets.filter(s => /^v2 undone: /.test(s.name)).every(s => s.hidden));
    same(noUpdated(H.v1Json(env)), noUpdated(J1), 'v1 reads the restored tabs as before');
    env.ui.menus = {}; ctx.onOpen(); assert.strictEqual(env.ui.menus['Face Value'].items[0].caption, 'Upgrade this sheet to v2…');
    const again = H.upgrade(env, ctx);
    assert.ok(again.run.ok);
    assert.ok(FV.additiveEqual(H.LIVE, H.buildOf(env, ctx, 'preview')).ok);
  }],
  ['Remove upgrade backups deletes the hidden tabs after a confirm', () => {
    const { env, ctx } = H.fresh();
    const r = ctx.menuRemoveBackups();
    assert.ok(r.ok && r.removed === 13);
    assert.ok(!env.ss.sheets.some(s => /^v1 backup/.test(s.name)));
  }]
];

module.exports = [
  { scenario: 'a', title: "v1 sheet built by v1's own setupFromSite()", tests: testsA },
  { scenario: 'b', title: 'dry run, upgrade, resume and undo', tests: testsB }
];
