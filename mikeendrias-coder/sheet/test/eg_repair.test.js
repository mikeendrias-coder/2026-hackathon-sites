'use strict';
// (e) Idempotency: Upgrade again on a v2 sheet is Repair; with nothing broken it changes nothing and logs nothing.
// (g) Structural robustness: inserted, moved and sorted columns and rows give the same JSON.
const assert = require('assert');
const H = require('./harness');
const { FV } = H.pure();
const snap = env => JSON.stringify(H.mock.snapshot(env.ss));
const logRows = env => H.tab(env, 'Change log').getLastRow() - 1;

const testsE = [
  ['Upgrade again: full snapshot identical, no new backups, no log row', () => {
    const { env, ctx } = H.fresh(), before = snap(env), logs = logRows(env);
    const r = ctx.menuUpgrade();
    assert.ok(r.ok, JSON.stringify(r)); assert.strictEqual(r.repaired, 0, JSON.stringify(r.notes));
    assert.strictEqual(snap(env), before);
    assert.strictEqual(env.ss.sheets.filter(s => /^v1 backup: /.test(s.name)).length, 13);
    assert.strictEqual(logRows(env), logs);
    ctx.menuUpgrade(); assert.strictEqual(snap(env), before, 'a third run too');
  }],
  ['Repair restores a renamed header, a deleted Words row and lost validation, then settles', () => {
    const { env, ctx } = H.fresh(), laws = H.tab(env, 'Laws'), words = H.tab(env, 'Words on the page');
    const cc = H.col(laws, 'Citation'), key = ctx.WORD_KEYS[2].key;
    laws.getRange(1, cc).setValue('Cite');
    words.deleteRow(H.findRow(words, 'Key', key));
    laws.getRange(2, H.col(laws, 'State'), 50, 1).clearDataValidations();
    const r = ctx.menuUpgrade();
    assert.ok(r.repaired > 0);
    assert.strictEqual(laws.getRange(1, cc).getValue(), 'Citation');
    assert.ok(H.findRow(words, 'Key', key) > 1);
    assert.strictEqual(H.get(words, 'Status', H.findRow(words, 'Key', key)), 'Draft');
    assert.strictEqual(laws.getRange(10, H.col(laws, 'State')).getDataValidation().getCriteriaType(), 'VALUE_IN_RANGE');
    assert.strictEqual(H.tab(env, 'Change log').getDataRange().getValues().slice(-1)[0][1], 'Repair');
    const settled = snap(env), r2 = ctx.menuUpgrade();
    assert.strictEqual(r2.repaired, 0); assert.strictEqual(snap(env), settled);
  }],
  ['Repair keeps user conditional formats and adds back a deleted tab', () => {
    const { env, ctx } = H.fresh(), laws = H.tab(env, 'Laws');
    const mine = env.globals.SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$A2="Ohio"').setBackground('#000000').setRanges([laws.getRange('A2:A10')]).build();
    laws.setConditionalFormatRules(laws.getConditionalFormatRules().concat([mine]));
    env.ss.api.deleteSheet(H.tab(env, 'Refresh checklist'));
    ctx.menuUpgrade();
    assert.ok(laws.getConditionalFormatRules().some(r => r.getBooleanCondition().getCriteriaValues()[0] === '=$A2="Ohio"'));
    assert.ok(H.tab(env, 'Refresh checklist').getLastRow() > 10);
  }],
  ['rebuildFromLive (disaster recovery) fills an empty sheet from the live file with parity', () => {
    const env = H.newEnv(), ctx = H.loadV2(env), s = env.ss.api.insertSheet('Settings');
    s.getRange(1, 1, 6, 2).setValues([['Setting', 'Value'], ['GitHub owner', 'mikeendrias-coder'], ['GitHub repo', '2026-hackathon-sites'], ['Branch', 'mikeendrias-coder/face-value'], ['Folder', 'mikeendrias-coder'], ['Site address', H.SITE]]);
    assert.ok(ctx.rebuildFromLive().ok);
    assert.ok(FV.additiveEqual(H.LIVE, H.buildOf(env, ctx, 'live')).ok);
    assert.strictEqual(H.checkOf(env, ctx).filter(p => p.sev === 'E').length, 0);
    assert.strictEqual(env.fake.puts().length, 0);
  }]
];

function lawsKeyed(d) { return FV.canonical({ states: d.states, laws: d.laws, bills: d.bills, config: Object.assign({}, d.config, { leadQuotes: null }), source: d.source }); }
function quotesBag(d) { return d.quotes.map(q => FV.canonical(q)).sort().join('\n'); }
function leadsByContent(d) { const o = {}; Object.keys(d.config.leadQuotes).forEach(k => { o[k] = FV.canonical(d.quotes[d.config.leadQuotes[k]]); }); return FV.canonical(o); }

const testsG = [
  ['insert a column before Name, move Summary to the end, sort Quotes: same JSON', () => {
    const { env, ctx } = H.fresh(), quotes = H.tab(env, 'Quotes');
    H.set(quotes, 'Lead quote', 3, true);
    const before = H.buildOf(env, ctx, 'preview');
    const laws = H.tab(env, 'Laws');
    laws.insertColumnBefore(H.col(laws, 'Name'));
    laws.getRange(1, 2).setValue('');
    laws.moveColumns(laws.getRange(1, H.col(laws, 'Summary')), laws.getLastColumn() + 1);
    assert.strictEqual(H.headers(laws)[laws.getLastColumn() - 1], 'Summary');
    quotes.sort(H.col(quotes, 'Exact wording'));
    const after = H.buildOf(env, ctx, 'preview');
    assert.strictEqual(lawsKeyed(after), lawsKeyed(before));
    assert.strictEqual(quotesBag(after), quotesBag(before));
    assert.strictEqual(leadsByContent(after), leadsByContent(before));
    assert.ok(FV.additiveEqual(H.LIVE, H.buildOf(env, ctx, 'live')).problems.every(p => /^quotes\./.test(p)), 'only quote order differs');
    const errs = H.checkOf(env, ctx).filter(p => p.sev === 'E'); assert.strictEqual(errs.length, 0, JSON.stringify(errs.slice(0, 3)));
  }],
  ['metadata follows a moved column even after its header is renamed', () => {
    const { env, ctx } = H.fresh(), laws = H.tab(env, 'Laws');
    laws.moveColumns(laws.getRange(1, H.col(laws, 'Citation')), 1);
    laws.getRange(1, 1).setValue('Official cite');
    const d = H.buildOf(env, ctx, 'preview');
    assert.strictEqual(d.laws[5].cite, H.LIVE.laws[5].cite);
    assert.ok(H.checkOf(env, ctx).some(p => p.id === 'S2' && p.sev === 'W'));
  }],
  ['v1-style headers still read: "Judge must approve (1)", "Description", "ID"', () => {
    const { env, ctx } = H.fresh(), laws = H.tab(env, 'Laws'), prot = H.tab(env, 'Protections');
    laws.getRange(1, H.col(laws, 'Judge must approve')).setValue('Judge (1)');
    prot.getRange(1, H.col(prot, 'What it means')).setValue('Description'); prot.getRange(1, H.col(prot, 'Key')).setValue('ID');
    laws.getRange(1, H.col(laws, 'Summary')).setValue('What it does'); laws.getRange(1, H.col(laws, 'Ban, pause or exception')).setValue('Ban or pause');
    // Drop the fv.col column tags so only the header names (and their v1 aliases) can find the columns.
    [laws, prot].forEach(sh => sh.createDeveloperMetadataFinder().withKey('fv.col').find().forEach(m => m.remove()));
    assert.ok(FV.additiveEqual(H.LIVE, H.buildOf(env, ctx, 'preview')).ok);
    const s2 = H.checkOf(env, ctx).filter(p => (p.id === 'S2' || p.id === 'S6') && (p.tabKey === 'laws' || p.tabKey === 'prot'));
    const bad = s2.map(p => p.tab + ': ' + p.msg).filter(m => !/Jake's notes/.test(m));
    assert.strictEqual(bad.length, 0, 'the v1 names are read as headers, with no renamed or missing column: ' + bad.join(' / '));
  }],
  ['mapHeaders reads v1 header names with no column tags: "(k)" suffixes, ID, Description, What it does, Ban or pause, Law status', () => {
    const lawHead = ['State', 'Name', 'Year', 'Status', 'Who it covers (as written)', 'Applies to', 'Only covers footage from', 'Only covers license photos']
      .concat(['Judge (1)', 'Told (2)', 'Serious (3)', 'Match (4)', 'Accuracy (5)', 'Crowds (6)', 'Training (7)'])
      .concat(['What it does', 'Citation', 'Link', 'Unclear?', 'Which protections are unclear', 'Unclear note', 'Note', 'Ban or pause', 'Ban covers', 'Ban text', 'Ban exceptions', 'Bars footage from', 'Bar text']);
    const m = FV.mapHeaders('laws', lawHead, null, null);
    ['1', '2', '3', '4', '5', '6', '7'].forEach((k, i) => assert.strictEqual(m.idx['p' + k], 8 + i, 'protection ' + k + ' by its (k) suffix'));
    assert.strictEqual(m.idx.summary, lawHead.indexOf('What it does'));
    assert.strictEqual(m.idx.banRole, lawHead.indexOf('Ban or pause'));
    const none = (list, what) => assert.strictEqual(list.length, 0, what + ': ' + JSON.stringify(list.map(x => x.msg)));
    none(m.problems.filter(p => p.id === 'S2' && p.sev === 'E'), 'no required column is missing');
    none(m.problems.filter(p => p.id === 'S6'), 'no column is unknown');
    const p = FV.mapHeaders('prot', ['ID', 'Short name', 'Description', 'Why it matters', 'Order on page', 'Status', 'Reviewer notes'], null, null);
    assert.strictEqual(p.idx.key, 0); assert.strictEqual(p.idx.long, 2);
    none(p.problems.filter(x => (x.id === 'S2' && x.sev === 'E') || x.id === 'S6'), 'Protections with v1 names');
    const st = FV.mapHeaders('states', ['State', 'Law status'], null, null);
    assert.strictEqual(st.idx.lawAuto, 1);
    // The protection-name match (the header follows Protections › Short name) also works with no tags.
    const named = FV.mapHeaders('bills', ['State', 'Name', 'Year', 'Progress', 'Still alive', 'Judge must approve'], null, { '1': 'Judge must approve' });
    assert.strictEqual(named.idx.p1, 5);
  }],
  ['a protection renamed on Protections: onEdit renames Laws/Bills headers and Quotes cells', () => {
    const { env, ctx } = H.fresh(), prot = H.tab(env, 'Protections'), r = H.findRow(prot, 'Key', '1'), cell = prot.getRange(r, H.col(prot, 'Short name'));
    cell.setValue('Judge approval');
    ctx.onEdit({ range: cell, value: 'Judge approval', oldValue: 'Judge must approve', source: env.ss.api });
    assert.ok(H.headers(H.tab(env, 'Laws')).indexOf('Judge approval') >= 0);
    const d = H.buildOf(env, ctx, 'preview', null);
    assert.strictEqual(d.config.prot['1'].short, 'Judge approval');
    assert.strictEqual(d.quotes.filter(q => q.rule === '1').length, H.LIVE.quotes.filter(q => q.rule === '1').length);
    assert.strictEqual(H.checkOf(env, ctx).filter(p => p.sev === 'E').length, 0);
  }],
  ['a law renamed on Laws: onEdit rewrites its Quotes', () => {
    const { env, ctx } = H.fresh(), laws = H.tab(env, 'Laws'), r = H.findRow(laws, 'Name', 'Sole-basis rule (SB 56)'), cell = laws.getRange(r, H.col(laws, 'Name'));
    cell.setValue('Sole-basis rule (SB 56, 2022)');
    ctx.onEdit({ range: cell, value: 'Sole-basis rule (SB 56, 2022)', oldValue: 'Sole-basis rule (SB 56)', source: env.ss.api });
    assert.strictEqual(H.buildOf(env, ctx, 'preview').quotes.filter(q => q.item === 'Sole-basis rule (SB 56, 2022)').length, 2);
    assert.strictEqual(H.checkOf(env, ctx).filter(p => p.sev === 'E').length, 0);
  }]
];

module.exports = [
  { scenario: 'e', title: 'idempotency and repair', tests: testsE },
  { scenario: 'g', title: 'structural robustness', tests: testsG }
];
