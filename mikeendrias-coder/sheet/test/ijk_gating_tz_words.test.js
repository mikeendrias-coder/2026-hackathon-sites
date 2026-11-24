'use strict';
// (i) Approved gating; (j) time zones; (k) word keys work with any WORD_KEYS list, and the words-table drift check.
const assert = require('assert'), fs = require('fs'), path = require('path'), cp = require('child_process');
const H = require('./harness');
const { FV, WORD_KEYS, SHEET_TEXTS } = H.pure();
const LIVE_PATH = H.FOLDER + '/data/live.json', PREVIEW_PATH = H.FOLDER + '/data/preview.json';
const lastHtml = env => env.ui.last() ? env.ui.last().html : '';
const deploy = f => { assert.ok(f.ctx.menuPreview().ok); const d = f.ctx.menuDeploy(); assert.ok(d.ok, JSON.stringify(d).slice(0, 300)); const r = f.ctx.deployConfirmed(d.token); assert.ok(r.ok, JSON.stringify(r).slice(0, 300)); };
const fileJson = (f, p) => JSON.parse(f.fake.file(p).text);

const testsI = [
  ['a Draft Words row is on the preview and not live; once Approved it goes live', () => {
    const f = H.fresh(), w = H.tab(f.env, 'Words on the page'), key = WORD_KEYS.filter(x => !/^why\./.test(x.key) && !FV.isUrlKey(x.key) && !x.fills.length)[0].key, r = H.findRow(w, 'Key', key);
    H.set(w, 'Text', r, 'Brand new words');
    deploy(f);
    assert.strictEqual(fileJson(f, PREVIEW_PATH).config.words[key], 'Brand new words');
    assert.ok(!(key in fileJson(f, LIVE_PATH).config.words), 'Draft stays off live');
    H.set(w, 'Status', r, 'Approved');
    deploy(f);
    assert.strictEqual(fileJson(f, LIVE_PATH).config.words[key], 'Brand new words');
  }],
  ['an Approved row edited back to Draft keeps the live version at Deploy', () => {
    const f = H.fresh(), w = H.tab(f.env, 'Words on the page'), key = WORD_KEYS.filter(x => !/^why\./.test(x.key))[0].key, r = H.findRow(w, 'Key', key);
    H.set(w, 'Text', r, 'Approved text'); H.set(w, 'Status', r, 'Approved'); deploy(f);
    const liveBefore = f.fake.file(LIVE_PATH).text;
    H.set(w, 'Text', r, 'Draft rewrite'); H.set(w, 'Status', r, 'Draft');
    assert.ok(f.ctx.menuPreview().ok);
    assert.strictEqual(f.ctx.menuDeploy().msg, 'Nothing to deploy. The live site already matches the sheet.');
    assert.strictEqual(f.fake.file(LIVE_PATH).text, liveBefore);
    assert.strictEqual(fileJson(f, LIVE_PATH).config.words[key], 'Approved text');
    assert.strictEqual(fileJson(f, PREVIEW_PATH).config.words[key], 'Draft rewrite');
  }],
  ['why.* rows publish only to config.why; Protections why and the example stories wait for Approved', () => {
    const f = H.fresh(), w = H.tab(f.env, 'Words on the page');
    H.set(w, 'Text', H.findRow(w, 'Key', 'why.crime'), 'A new crime-step note.');
    const p = H.tab(f.env, 'Protections'), pr = H.findRow(p, 'Key', '3');
    H.set(p, 'Status', pr, 'Approved');
    const s = H.tab(f.env, 'Stories'), sr = H.findRow(s, 'State', 'Montana'); H.set(s, 'Status', sr, 'Approved');
    deploy(f);
    const live = fileJson(f, LIVE_PATH);
    assert.strictEqual(live.config.why.crime, 'A new crime-step note.');
    assert.ok(!Object.keys(live.config.words).some(k => /^why\./.test(k)));
    assert.ok(live.config.prot['3'].why && !live.config.prot['1'].why);
    assert.strictEqual(live.config.examples.map(e => e.id).join(','), 'montana-shoplifting');
    assert.strictEqual(FV.canonical(live.config.stories), FV.canonical(H.LIVE.config.stories), 'legacy stories unchanged');
  }],
  ['Ready for review rows (Words, Glossary, Protections, Stories) go on the preview only; live keeps the old text', () => {
    const f = H.fresh(), w = H.tab(f.env, 'Words on the page'), plain = WORD_KEYS.filter(x => !/^why\./.test(x.key) && !FV.isUrlKey(x.key) && !x.fills.length);
    // One Approved Words row, so there is something to deploy.
    const okKey = plain[0].key, okRow = H.findRow(w, 'Key', okKey);
    H.set(w, 'Text', okRow, 'Approved words'); H.set(w, 'Status', okRow, 'Approved');
    const rfrKey = plain[1].key, rfrRow = H.findRow(w, 'Key', rfrKey);
    H.set(w, 'Text', rfrRow, 'Words waiting for review'); H.set(w, 'Status', rfrRow, 'Ready for review');
    const g = H.tab(f.env, 'Glossary'), gr = H.findRow(g, 'Key', 'bill');
    H.set(g, 'Definition', gr, 'A glossary line waiting for review.'); H.set(g, 'Status', gr, 'Ready for review');
    const p = H.tab(f.env, 'Protections'), pr = H.findRow(p, 'Key', '1');
    H.set(p, 'Short name', pr, 'Judge says yes'); H.set(p, 'Why it matters', pr, 'A why line waiting for review.'); H.set(p, 'Status', pr, 'Ready for review');
    const st = H.tab(f.env, 'Stories'), sr = H.findRow(st, 'State', 'Montana');
    H.set(st, 'Title', sr, 'A story waiting for review'); H.set(st, 'Status', sr, 'Ready for review');
    deploy(f);
    const live = fileJson(f, LIVE_PATH), pv = fileJson(f, PREVIEW_PATH), L0 = H.LIVE.config;
    assert.strictEqual(live.config.words[okKey], 'Approved words', 'the Approved row went live');
    assert.ok(!(rfrKey in live.config.words), 'Ready for review words stay off live');
    assert.strictEqual(pv.config.words[rfrKey], 'Words waiting for review');
    assert.strictEqual(live.config.glossary.bill.def, L0.glossary.bill.def, 'glossary keeps the live text');
    assert.strictEqual(pv.config.glossary.bill.def, 'A glossary line waiting for review.');
    assert.strictEqual(live.config.prot['1'].short, L0.prot['1'].short, 'protection name keeps the live text');
    assert.ok(!live.config.prot['1'].why, 'no unapproved why on live');
    assert.strictEqual(pv.config.prot['1'].short, 'Judge says yes'); assert.strictEqual(pv.config.prot['1'].why, 'A why line waiting for review.');
    assert.ok(!live.config.examples.some(e => e.state === 'Montana'), 'the story is not a live example');
    assert.strictEqual(FV.canonical(live.config.stories), FV.canonical(L0.stories), 'legacy stories keep the live text');
    assert.ok(pv.config.stories.some(x => x.t === 'A story waiting for review') && pv.config.examples.some(e => e.t === 'A story waiting for review'));
  }],
  ['an edited Approved Glossary definition (onEdit makes it Ready for review) stays off live until approved', () => {
    const f = H.fresh(), g = H.tab(f.env, 'Glossary'), r = H.findRow(g, 'Key', 'bill'), cell = g.getRange(r, H.col(g, 'Definition'));
    const w = H.tab(f.env, 'Words on the page'), wk = WORD_KEYS.filter(x => !/^why\./.test(x.key) && !FV.isUrlKey(x.key) && !x.fills.length)[0].key, wr = H.findRow(w, 'Key', wk);
    H.set(w, 'Status', wr, 'Approved');
    cell.setValue('A proposed law, still being argued.');
    f.ctx.onEdit({ range: cell, value: 'A proposed law, still being argued.', oldValue: H.LIVE.config.glossary.bill.def, source: f.env.ss.api });
    assert.strictEqual(H.get(g, 'Status', r), 'Ready for review');
    deploy(f);
    assert.strictEqual(fileJson(f, LIVE_PATH).config.glossary.bill.def, H.LIVE.config.glossary.bill.def);
    assert.strictEqual(fileJson(f, PREVIEW_PATH).config.glossary.bill.def, 'A proposed law, still being argued.');
    H.set(g, 'Status', r, 'Approved');
    deploy(f);
    assert.strictEqual(fileJson(f, LIVE_PATH).config.glossary.bill.def, 'A proposed law, still being argued.');
  }],
  ['a Draft why.* row stays off live config.why; the preview has it', () => {
    const f = H.fresh(), w = H.tab(f.env, 'Words on the page'), r = H.findRow(w, 'Key', 'why.crime');
    assert.strictEqual(H.get(w, 'Status', r), 'Approved');
    H.set(w, 'Text', r, 'A crime-step note still in draft.'); H.set(w, 'Status', r, 'Draft');
    const r2 = H.findRow(w, 'Key', 'why.search');
    H.set(w, 'Text', r2, 'A search-step note waiting for review.'); H.set(w, 'Status', r2, 'Ready for review');
    const wk = WORD_KEYS.filter(x => !/^why\./.test(x.key) && !FV.isUrlKey(x.key) && !x.fills.length)[0].key;
    H.set(w, 'Status', H.findRow(w, 'Key', wk), 'Approved');
    deploy(f);
    const live = fileJson(f, LIVE_PATH), pv = fileJson(f, PREVIEW_PATH);
    assert.strictEqual(live.config.why.crime, H.LIVE.config.why.crime, 'live keeps the old step note');
    assert.strictEqual(live.config.why.search, H.LIVE.config.why.search);
    assert.strictEqual(pv.config.why.crime, 'A crime-step note still in draft.');
    assert.strictEqual(pv.config.why.search, 'A search-step note waiting for review.');
    assert.ok(!Object.keys(live.config.words).some(k => /^why\./.test(k)) && !Object.keys(pv.config.words).some(k => /^why\./.test(k)));
  }],
  ['editing Approved text flips it to Ready for review (onEdit); Mark selected rows Approved flips it back', () => {
    const f = H.fresh(), g = H.tab(f.env, 'Glossary'), r = H.findRow(g, 'Key', 'bill'), cell = g.getRange(r, H.col(g, 'Definition'));
    assert.strictEqual(H.get(g, 'Status', r), 'Approved');
    cell.setValue('A proposed law.');
    f.ctx.onEdit({ range: cell, value: 'A proposed law.', oldValue: 'old', source: f.env.ss.api });
    assert.strictEqual(H.get(g, 'Status', r), 'Ready for review');
    f.env.ss.api.setActiveRange(g.getRange(r, 1));
    f.ctx.menuApproveSelected();
    assert.strictEqual(H.get(g, 'Status', r), 'Approved');
  }],
  ['offline: Site status Offline with Approved offline words publishes config.site.status offline', () => {
    const f = H.fresh(), w = H.tab(f.env, 'Words on the page');
    WORD_KEYS.filter(x => /^offline\./.test(x.key)).forEach(x => H.set(w, 'Status', H.findRow(w, 'Key', x.key), 'Approved'));
    H.setSetting(f.env, 'Site status', 'Offline'); H.setSetting(f.env, 'Offline from', '2027-06-01');
    deploy(f);
    const live = fileJson(f, LIVE_PATH);
    assert.strictEqual(live.config.site.status, 'offline'); assert.strictEqual(live.config.site.offlineFrom, '2027-06-01');
    assert.ok(live.config.words['offline.message']);
  }]
];

const testsJ = ['Pacific/Auckland', 'America/Los_Angeles', 'America/New_York', 'UTC'].map(tz => ['a sheet in ' + tz + ' reads 2026-05-01 as 2026-05-01', () => {
  const f = H.fresh({ tz });
  H.setSetting(f.env, 'Research current through', '2026-05-01');
  const laws = H.tab(f.env, 'Laws'); H.set(laws, 'Last checked', 2, '2026-05-01');
  const cell = laws.getRange(3, H.col(laws, 'Last checked')); cell.setValue(new Date(H.mock.instantOf({ y: 2026, m: 5, d: 1 }, tz))); cell.setNumberFormat('M/d/yyyy');
  assert.ok(cell.getValue() instanceof Date, 'stored as a date');
  const m = H.modelOf(f.env, f.ctx);
  assert.strictEqual(m.settings['Research current through'], '2026-05-01');
  assert.strictEqual(m.tabs.laws.rows[0].lastChecked, '2026-05-01');
  assert.strictEqual(m.tabs.laws.rows[1].lastChecked, '2026-05-01', 'a date shown as M/d/yyyy still reads right');
  const d = f.ctx.FV.build(m, { mode: 'preview', now: H.NOW });
  assert.strictEqual(d.config.site.currentThrough, '2026-05-01');
  assert.strictEqual(d.source, H.LIVE.source.replace('Oct. 26, 2026', 'May 1, 2026'));
  assert.strictEqual(f.ctx.ctx_().today, f.ctx.Utilities.formatDate(new Date(H.NOW), tz, 'yyyy-MM-dd'));
}]);

function altWordKeys() {
  const file = path.join(H.FVDIR, 'play', 'words.js');
  if (fs.existsSync(file)) {
    try {
      const w = require(file);
      if (w.FV_WORDS && w.FV_WORD_META) return Object.keys(w.FV_WORDS).map(k => ({ key: k, where: w.FV_WORD_META[k] ? w.FV_WORD_META[k].where : '', max: (w.FV_WORD_META[k] && w.FV_WORD_META[k].max) || 200,
        fills: FV.fillsOf(w.FV_WORDS[k]), usedOn: 'New page', text: FV.isUrlKey(k) && !/^https:/.test(w.FV_WORDS[k]) ? 'https://example.com/x' : String(w.FV_WORDS[k]) })).concat(WORD_KEYS.filter(x => /^why\./.test(x.key)));
    } catch (e) { /* fall through to a synthetic list */ }
  }
  return [{ key: 'a.one', where: 'x', max: 50, fills: ['state'], usedOn: 'New page', text: 'In {state}' }, { key: 'offline.message', where: 'y', max: 400, fills: ['date'], usedOn: 'New page', text: 'Off {date}' }, { key: 'risk.url', where: 'z', max: 200, fills: [], usedOn: 'New page', text: 'https://example.com/r' }];
}
const testsK = [
  ['Code.gs works with another WORD_KEYS list (the page\'s real keys when play/words.js exists)', () => {
    const alt = altWordKeys(), f = H.fresh();
    f.ctx.WORD_KEYS = alt;
    let probs = H.checkOf(f.env, f.ctx);
    const missing = alt.filter(w => !WORD_KEYS.some(x => x.key === w.key));
    assert.strictEqual(probs.filter(p => p.id === 'W1' && p.sev === 'E').length, missing.length, 'each missing key is an error');
    const r = f.ctx.menuUpgrade();
    assert.ok(r.repaired >= missing.length, 'Repair adds the missing rows');
    probs = H.checkOf(f.env, f.ctx);
    // Rows seeded from the provisional list keep their old text; only a fill-in the new list does not allow is an error.
    const changedFills = {}; alt.forEach(a => { const o = WORD_KEYS.find(x => x.key === a.key); if (o && o.fills.join() !== a.fills.join()) changedFills[a.key] = 1; });
    const keyAt = row => H.get(H.tab(f.env, 'Words on the page'), 'Key', row);
    const bad = probs.filter(p => p.sev === 'E' && !(p.id === 'W4' && changedFills[keyAt(p.row)]));
    assert.strictEqual(bad.length, 0, JSON.stringify(bad.slice(0, 3)));
    assert.ok(FV.additiveEqual(H.LIVE, H.buildOf(f.env, f.ctx, 'preview')).ok);
    const plan = FV.planV1toV2(H.base().J1, {}, {}, { wordKeys: alt, texts: SHEET_TEXTS, today: H.TODAY, now: H.NOW });
    assert.ok(plan.report.blocking.every(b => !/Data check/.test(b)), 'parity holds with the other list');
  }],
  ['the SHEET_TEXTS block matches sheet/test/fixtures/texts.json (when it exists)', () => {
    if (!fs.existsSync(path.join(__dirname, 'fixtures', 'texts.json'))) return;
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'inline-texts.cjs'), '--check'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.ok(SHEET_TEXTS.startHere.length > 10 && SHEET_TEXTS.checklist.length >= 19 && SHEET_TEXTS.settingsHelp['Site status']);
  }],
  ['Start here and the Refresh checklist come from SHEET_TEXTS', () => {
    const f = H.fresh(), s = H.tab(f.env, 'Start here'), c = H.tab(f.env, 'Refresh checklist');
    assert.strictEqual(s.getRange(1, 1).getValue(), SHEET_TEXTS.startHere[0][0]);
    assert.ok(/^=/.test(s.getRange(4, 2).getFormula()), 'the status block is formulas');
    assert.strictEqual(c.getLastRow() - 1, SHEET_TEXTS.checklist.length);
    assert.strictEqual(H.get(H.tab(f.env, 'Settings'), 'What it does', H.settingRow(f.env, 'Site status')), SHEET_TEXTS.settingsHelp['Site status']);
  }],
  ['words-table drift check (qa/words-table.cjs --check) is run and reported', () => {
    const tool = path.join(H.FVDIR, 'qa', 'words-table.cjs');
    if (!fs.existsSync(tool)) { console.log('WARN (k) qa/words-table.cjs is not there yet; WORD_KEYS drift was not checked.'); return; }
    const r = cp.spawnSync(process.execPath, [tool, '--check'], { cwd: H.FVDIR, encoding: 'utf8', timeout: 60000 });
    // Contract section 6: play/words.js is the only source of word keys, so any drift fails the suite.
    assert.strictEqual(r.status, 0, 'qa/words-table.cjs --check exited ' + r.status + '. Run node qa/words-table.cjs --write-gs.\n' + r.stdout + r.stderr);
    const w = require(path.join(H.FVDIR, 'play', 'words.js'));
    // words-table leaves out keys other tabs own (prot.*, limit.*, gloss.* ...); every key it writes is a real page key.
    const gsKeys = WORD_KEYS.filter(x => !/^why\./.test(x.key)).map(x => x.key);
    const strays = gsKeys.filter(k => !Object.prototype.hasOwnProperty.call(w.FV_WORDS, k));
    assert.strictEqual(strays.length, 0, 'every WORD_KEYS key is in FV_WORDS: ' + strays.join(', '));
    assert.ok(gsKeys.length > 100, 'WORD_KEYS has the page keys (' + gsKeys.length + ')');
    assert.strictEqual(WORD_KEYS.filter(x => /^why\./.test(x.key)).map(x => x.key).sort().join(), Object.keys(H.LIVE.config.why).map(k => 'why.' + k).sort().join(), 'one why.* row per legacy step note');
  }],
  ['sheet/test_roundtrip.js is the shortcut that runs this suite', () => {
    const src = fs.readFileSync(path.join(H.SHEET, 'test_roundtrip.js'), 'utf8');
    assert.ok(/runAll/.test(src) && /ROUND TRIP OK/.test(src));
  }]
];

module.exports = [
  { scenario: 'i', title: 'Approved gating (preview vs live)', tests: testsI },
  { scenario: 'j', title: 'time zones', tests: testsJ },
  { scenario: 'k', title: 'word keys, sheet texts and the round-trip shortcut', tests: testsK }
];
