'use strict';
// (d) Seeded errors: each mutation runs on a fresh copy of the upgraded sheet and must yield its check ID on the right row.
// A clean sheet must have zero errors and a stable list of heads-ups.
const assert = require('assert');
const H = require('./harness');

const T = H.tab, R = H.findRow, RW = H.findRowWhere, S = H.set;
const lawRow = (env, name) => R(T(env, 'Laws'), 'Name', name);
const billRow = (env, name) => R(T(env, 'Bills'), 'Name', name);
const wordRow = (env, key) => R(T(env, 'Words on the page'), 'Key', key);
const quoteRows = (env, item, prot) => { const sh = T(env, 'Quotes'), v = sh.getDataRange().getValues(), h = v[0].map(String); const out = []; v.forEach((r, i) => { if (i && r[h.indexOf('Law or bill')] === item && (!prot || r[h.indexOf('Protection')] === prot)) out.push(i + 1); }); return out; };
const firstKey = (ctx, pred) => ctx.WORD_KEYS.filter(pred)[0].key;
const pickKey = (ctx, pred) => { const w = ctx.WORD_KEYS.filter(pred)[0]; if (!w) throw new Error('no WORD_KEYS entry fits this test'); return w; };
const HB3902 = 'Drone facial recognition limit (HB 3902)', SB56 = 'Sole-basis rule (SB 56)', VTP = 'Moratorium (S.124, Act 166)', VTX = 'Child exploitation exception (H.195, Act 17)';
const VA = 'Purchase and deployment ban (HB 2031)', TX = 'TRAIGA, government AI identification limit (HB 149)', NH1584 = 'Body camera law (HB 1584)';

// [name, check ID, severity, mutate(env, ctx) -> expected row (or null for tab-level problems), optional message regex]
const CASES = [
  ['Laws State "Ohioo"', 'L1', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'State', r, 'Ohioo'); return r; }],
  ['Laws Name blank', 'L2', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Name', r, ''); return r; }],
  ['Laws Name duplicated in the state', 'L2', 'E', env => { const r = lawRow(env, 'Limit on license photo searches (LD 1899)'); S(T(env, 'Laws'), 'Name', r, 'Facial surveillance law (LD 1585)'); return r; }],
  ['Laws Year "twenty"', 'L3', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Year', r, 'twenty'); return r; }],
  ['Laws Status "Old"', 'L4', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Status', r, 'Old'); return r; }],
  ['Laws Applies to "Everyone"', 'L5', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Applies to', r, 'Everyone'); return r; }],
  ['Laws protection cell "sometimes"', 'L6', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), "A match isn't enough", r, 'sometimes'); return r; }],
  ["delete Alabama's Protection 4 quotes", 'L7', 'E', env => { quoteRows(env, 'Alabama · ' + SB56, "A match isn't enough").reverse().forEach(r => T(env, 'Quotes').deleteRow(r)); return lawRow(env, SB56); }],
  ['Laws Citation blank', 'L8', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Citation', r, ''); return r; }],
  ['Laws Link blank', 'L9', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Link', r, ''); return r; }],
  ['Laws Link http://', 'L9', 'W', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Link', r, 'http://example.com/law'); return r; }],
  ['Unclear "only some" with no names', 'L10', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Unclear?', r, 'Yes: only some protections'); S(T(env, 'Laws'), 'Unclear note', r, 'x'); return r; }, /List the unclear/],
  ['Unclear "only some" with an unknown name', 'L10', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Unclear?', r, 'Yes: only some protections'); S(T(env, 'Laws'), 'Which protections are unclear', r, 'Flying cars'); return r; }, /not a protection name/],
  ['Unclear "only some" naming a protection the law does not add', 'L10', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Unclear?', r, 'Yes: only some protections'); S(T(env, 'Laws'), 'Which protections are unclear', r, 'Judge must approve'); return r; }, /not a protection this law adds/],
  ['Unclear with no note', 'L10', 'W', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Unclear?', r, 'Yes: the law as a whole'); return r; }],
  ['Ban without text', 'L11', 'E', env => { const r = lawRow(env, VA); S(T(env, 'Laws'), 'Ban text', r, ''); return r; }],
  ['Exception in a state with no ban', 'L11', 'E', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Ban, pause or exception', r, 'Exception to a ban or pause'); return r; }],
  ['two bans in one state', 'L11', 'W', env => { const sh = T(env, 'Laws'), r = lawRow(env, VTX); S(sh, 'Ban, pause or exception', r, 'Ban'); S(sh, 'Ban covers', r, 'Local police only'); S(sh, 'Ban text', r, 'x'); return r; }, /more than one ban/],
  ['bar without text', 'L12', 'E', env => { const r = lawRow(env, HB3902); S(T(env, 'Laws'), 'Bar text', r, ''); return r; }],
  ['body-camera limit said twice', 'L13', 'W', env => { const r = lawRow(env, NH1584); S(T(env, 'Laws'), 'Judge must approve', r, 'body cameras only'); return r; }],
  ['Last checked "yesterday"', 'L14', 'E', env => { const r = lawRow(env, SB56); const sh = T(env, 'Laws'); sh.getRange(r, H.col(sh, 'Last checked')).setNumberFormat('@').setValue('yesterday'); return r; }],
  ['Last checked over 6 months ago', 'L14', 'W', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Last checked', r, '2025-01-02'); return r; }, /over 6 months/],
  ['Status New with an old Year', 'L15', 'W', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Status', r, 'New'); return r; }],
  ['Summary over 450 characters', 'L16', 'W', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Summary', r, 'x'.repeat(460)); return r; }],
  ['Summary with a double space', 'L17', 'W', env => { const r = lawRow(env, SB56); S(T(env, 'Laws'), 'Summary', r, 'Two  spaces.'); return r; }],
  ['a law with nothing counts as none of the 7', 'L18', 'I', env => { const r = lawRow(env, TX); S(T(env, 'Laws'), 'Unclear?', r, 'No'); return r; }],
  ['Bills State "Atlantis"', 'B1', 'E', env => { const r = billRow(env, 'SB 1135 (2024)'); S(T(env, 'Bills'), 'State', r, 'Atlantis'); return r; }],
  ['Bills duplicate name', 'B2', 'E', env => { const r = billRow(env, 'AB 642 (2023)'); S(T(env, 'Bills'), 'Name', r, 'AB 1814 (2024)'); return r; }],
  ['Bills Year 2027 with session 2026', 'B3', 'E', env => { const r = billRow(env, 'SB 1135 (2024)'); S(T(env, 'Bills'), 'Year', r, '2027'); return r; }, /Current bill session/],
  ['Bills Year "26"', 'B3', 'E', env => { const r = billRow(env, 'SB 1135 (2024)'); S(T(env, 'Bills'), 'Year', r, '26'); return r; }],
  ['Bills Progress "Vetoed"', 'B4', 'E', env => { const r = billRow(env, 'SB 1135 (2024)'); S(T(env, 'Bills'), 'Progress', r, 'Vetoed'); return r; }],
  ['Bills protection cell "nope"', 'B5', 'E', env => { const r = billRow(env, 'SB 1135 (2024)'); S(T(env, 'Bills'), 'Judge must approve', r, 'nope'); return r; }],
  ['Bills Link blank', 'B6', 'E', env => { const r = billRow(env, 'SB 1135 (2024)'); S(T(env, 'Bills'), 'Link', r, ''); return r; }],
  ['Bills Sponsor blank', 'B7', 'W', env => { const r = billRow(env, 'SB 1135 (2024)'); S(T(env, 'Bills'), 'Sponsor', r, ''); return r; }],
  ['Still alive with Progress Failed', 'B8', 'W', env => { const r = billRow(env, 'SB 1135 (2024)'); S(T(env, 'Bills'), 'Still alive', r, true); S(T(env, 'Bills'), 'Progress', r, 'Failed'); return r; }],
  ['Quotes "Ohio · Nope"', 'Q1', 'E', env => { const r = quoteRows(env, 'Alabama · ' + SB56)[0]; S(T(env, 'Quotes'), 'Law or bill', r, 'Ohio · Nope'); return r; }],
  ['Quotes Protection "Flying"', 'Q2', 'E', env => { const r = quoteRows(env, 'Alabama · ' + SB56)[0]; S(T(env, 'Quotes'), 'Protection', r, 'Flying'); return r; }],
  ['Quotes protection the law does not add', 'Q3', 'E', env => { const r = quoteRows(env, 'Alabama · ' + SB56)[0]; S(T(env, 'Quotes'), 'Protection', r, 'Judge must approve'); return r; }],
  ['Quotes "**open"', 'Q4', 'E', env => { const r = quoteRows(env, 'Alabama · ' + SB56)[0]; S(T(env, 'Quotes'), 'Exact wording', r, '**open'); return r; }],
  ['Quotes Citation blank', 'Q5', 'E', env => { const r = quoteRows(env, 'Alabama · ' + SB56)[0]; S(T(env, 'Quotes'), 'Citation', r, ''); return r; }],
  ['Quotes exact duplicate', 'Q6', 'W', env => { const sh = T(env, 'Quotes'), r = quoteRows(env, 'Alabama · ' + SB56)[0], n = sh.getLastRow() + 1, w = sh.getLastColumn(); sh.getRange(n, 1, 1, w).setValues(sh.getRange(r, 1, 1, w).getValues()); return n; }],
  ['two Lead quotes for one law and protection', 'Q7', 'W', env => { const rs = quoteRows(env, 'Alabama · ' + SB56); S(T(env, 'Quotes'), 'Lead quote', rs[0], true); S(T(env, 'Quotes'), 'Lead quote', rs[1], true); return rs[1]; }],
  ['Quotes over 1,200 characters', 'Q8', 'W', env => { const r = quoteRows(env, 'Alabama · ' + SB56)[0]; S(T(env, 'Quotes'), 'Exact wording', r, 'y'.repeat(1300)); return r; }],
  ['States row renamed "Puerto Rico"', 'ST1', 'E', env => { const r = R(T(env, 'States'), 'State', 'Ohio'); S(T(env, 'States'), 'State', r, 'Puerto Rico'); return r; }],
  ['Protections Key "8"', 'P1', 'E', env => { const r = R(T(env, 'Protections'), 'Key', '7'); S(T(env, 'Protections'), 'Key', r, '8'); return r; }],
  ['Protections Short name blank', 'P2', 'E', env => { const r = R(T(env, 'Protections'), 'Key', '5'); S(T(env, 'Protections'), 'Short name', r, ''); return r; }],
  ['Protections Why blank', 'P3', 'W', env => { const r = R(T(env, 'Protections'), 'Key', '5'); S(T(env, 'Protections'), 'Why it matters', r, ''); return r; }],
  ['Protections Order used twice', 'P4', 'W', env => { const r = R(T(env, 'Protections'), 'Key', '5'); S(T(env, 'Protections'), 'Order on page', r, '1'); return r; }],
  ['remove the "lineups only" limit', 'LI2', 'E', env => { T(env, 'Limits').deleteRow(R(T(env, 'Limits'), 'Code', 'lineups only')); return null; }],
  ['Limits code in capitals', 'LI1', 'E', env => { const r = R(T(env, 'Limits'), 'Code', 'via drone law'); S(T(env, 'Limits'), 'Code', r, 'Via Drone Law'); return r; }],
  ['Limits Type "Huge"', 'LI3', 'E', env => { const r = R(T(env, 'Limits'), 'Code', 'via drone law'); S(T(env, 'Limits'), 'Type', r, 'Huge'); return r; }],
  ['Labels: delete Law status "New"', 'LA1', 'E', env => { T(env, 'Labels').deleteRow(RW(T(env, 'Labels'), { Group: 'Law status', Code: 'New' })); return null; }],
  ['a shown story with a federal agent', 'SS2', 'E', env => { const r = R(T(env, 'Stories'), 'State', 'Maryland'); S(T(env, 'Stories'), 'Show on new page', r, true); S(T(env, 'Stories'), 'What it shows', r, 'x'); S(T(env, 'Stories'), 'Order', r, '9'); return r; }],
  ['Stories State "Narnia"', 'SS1', 'E', env => { const r = R(T(env, 'Stories'), 'State', 'Ohio'); S(T(env, 'Stories'), 'State', r, 'Narnia'); return r; }],
  ['only 2 stories shown', 'SS3', 'W', env => { ['Montana', 'Indiana'].forEach(s => S(T(env, 'Stories'), 'Show on new page', R(T(env, 'Stories'), 'State', s), false)); return null; }],
  ['a shown story with no lesson', 'SS4', 'W', env => { const r = R(T(env, 'Stories'), 'State', 'Kentucky'); S(T(env, 'Stories'), 'What it shows', r, ''); return r; }],
  ['Stories Order used twice', 'SS5', 'W', env => { const r = R(T(env, 'Stories'), 'State', 'Kentucky'); S(T(env, 'Stories'), 'Order', r, '1'); return r; }],
  ['Glossary Key blank', 'G1', 'E', env => { const r = R(T(env, 'Glossary'), 'Key', 'bill'); S(T(env, 'Glossary'), 'Key', r, ''); return r; }],
  ['Glossary old-app key missing', 'G1', 'W', env => { T(env, 'Glossary').deleteRow(R(T(env, 'Glossary'), 'Key', 'lineup')); return null; }],
  ['Glossary Definition blank', 'G2', 'E', env => { const r = R(T(env, 'Glossary'), 'Key', 'bill'); S(T(env, 'Glossary'), 'Definition', r, ''); return r; }],
  ['Words {stat} fill-in', 'W4', 'E', (env, ctx) => { const k = firstKey(ctx, w => w.fills.length && !/^why\./.test(w.key)), r = wordRow(env, k); S(T(env, 'Words on the page'), 'Text', r, 'In {stat} now.'); return r; }],
  ['Words duplicate key', 'W1', 'E', (env, ctx) => { const sh = T(env, 'Words on the page'), r = wordRow(env, ctx.WORD_KEYS[0].key), n = sh.getLastRow() + 1, w = sh.getLastColumn(); sh.getRange(n, 1, 1, w).setValues(sh.getRange(r, 1, 1, w).getValues()); return n; }],
  ['Words known key deleted', 'W1', 'E', (env, ctx) => { T(env, 'Words on the page').deleteRow(wordRow(env, ctx.WORD_KEYS[1].key)); return null; }, /is missing/],
  ['Words unknown key typed in', 'W1', 'I', env => { const sh = T(env, 'Words on the page'), n = sh.getLastRow() + 1; sh.getRange(n, 1, 1, 4).setValues([['brand.new.key', 'Somewhere', 'Hello', 'Draft']]); return n; }],
  ['Words Text blank', 'W2', 'W', (env, ctx) => { const r = wordRow(env, firstKey(ctx, w => !/^why\./.test(w.key))); S(T(env, 'Words on the page'), 'Text', r, ''); return r; }],
  ['Words Text too long', 'W3', 'W', (env, ctx) => { const w = pickKey(ctx, x => !ctx.FV.isUrlKey(x.key) && !x.fills.length && x.max < 500), r = wordRow(env, w.key); S(T(env, 'Words on the page'), 'Text', r, 'z'.repeat(w.max + 5)); return r; }],
  ['Words URL key not https', 'W5', 'E', (env, ctx) => { const r = wordRow(env, firstKey(ctx, w => ctx.FV.isUrlKey(w.key))); S(T(env, 'Words on the page'), 'Text', r, 'http://example.com'); return r; }],
  ['Words Status "Maybe"', 'W6', 'E', (env, ctx) => { const r = wordRow(env, ctx.WORD_KEYS[0].key); S(T(env, 'Words on the page'), 'Status', r, 'Maybe'); return r; }],
  ['Offline from set while offline.message is Draft', 'W8', 'E', env => { H.setSetting(env, 'Offline from', '2026-12-31'); return wordRow(env, 'offline.message'); }],
  ['Site status Offline while the offline words are Draft', 'W8', 'E', env => { H.setSetting(env, 'Site status', 'Offline'); return wordRow(env, 'offline.heading'); }],
  ['Settings Branch blank', 'S4', 'E', env => { H.setSetting(env, 'Branch', ''); return H.settingRow(env, 'Branch'); }],
  ['Settings Site status "Paused"', 'SE2', 'E', env => { H.setSetting(env, 'Site status', 'Paused'); return H.settingRow(env, 'Site status'); }],
  ['Settings date "soon"', 'SE3', 'E', env => { const r = H.settingRow(env, 'Sunset decision by'); T(env, 'Settings').getRange(r, 2).setNumberFormat('@').setValue('soon'); return r; }],
  ['research date in the future', 'SE4', 'E', env => { H.setSetting(env, 'Research current through', '2027-01-01'); return H.settingRow(env, 'Research current through'); }],
  ['Next update due is past', 'SE5', 'W', env => { H.setSetting(env, 'Next update due', '2026-01-01'); return H.settingRow(env, 'Next update due'); }],
  ['Current bill session older than the newest bill', 'SE6', 'E', env => { H.setSetting(env, 'Current bill session', '2025'); return H.settingRow(env, 'Current bill session'); }],
  ['Sunset decision within 60 days', 'SE8', 'W', env => { H.setSetting(env, 'Sunset decision by', '2026-12-20'); return H.settingRow(env, 'Sunset decision by'); }],
  ['rename the Citation header (found by metadata)', 'S2', 'W', env => { const sh = T(env, 'Laws'); sh.getRange(1, H.col(sh, 'Citation')).setValue('Cite'); return 1; }, /renamed/],
  ['delete the Bills Sponsor column', 'S2', 'E', env => { const sh = T(env, 'Bills'); sh.deleteColumn(H.col(sh, 'Sponsor')); return 1; }],
  ['two columns with the same header', 'S3', 'E', env => { const sh = T(env, 'Laws'); sh.getRange(1, H.col(sh, 'Note')).setValue('Summary'); return 1; }],
  ['the Glossary tab deleted', 'S1', 'E', env => { env.ss.api.deleteSheet(T(env, 'Glossary')); return null; }],
  ['running from a copy', 'S8', 'W', env => { H.setSetting(env, 'Publishing sheet (auto)', 'ANOTHER-SHEET'); return H.settingRow(env, 'Publishing sheet (auto)'); }],
  ['a story the old site would crash on', 'X2', 'E', env => { const r = R(T(env, 'Stories'), 'State', 'Ohio'); S(T(env, 'Stories'), 'Who searches', r, 'Alien'); return null; }]
];

let CLEAN = null;
function clean() { if (CLEAN) return CLEAN; const f = H.fresh(); CLEAN = H.checkOf(f.env, f.ctx); return CLEAN; }
const sig = probs => { const o = {}; probs.forEach(p => { o[p.id + p.sev] = (o[p.id + p.sev] || 0) + 1; }); return JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]])); };

const tests = [
  ['a clean upgraded sheet has zero errors', () => { const e = clean().filter(p => p.sev === 'E'); assert.strictEqual(e.length, 0, JSON.stringify(e.slice(0, 3))); }],
  ['the clean list of heads-ups is stable', () => {
    const f = H.fresh(), again = H.checkOf(f.env, f.ctx);
    assert.strictEqual(sig(again), sig(clean()));
    const ids = new Set(clean().filter(p => p.sev === 'W').map(p => p.id));
    assert.deepStrictEqual([...ids].sort(), ['B9', 'L13', 'L14', 'ST2']);
    assert.strictEqual(clean().filter(p => p.id === 'L13').length, 2, 'drone said twice x2');
  }]
].concat(CASES.map(([name, id, sev, mutate, re]) => [id + ': ' + name, () => {
  const f = H.fresh(), row = mutate(f.env, f.ctx), probs = H.checkOf(f.env, f.ctx);
  const hit = probs.filter(p => p.id === id && p.sev === sev && (row === null || p.row === row) && (!re || re.test(p.msg)));
  assert.ok(hit.length, 'expected ' + id + '/' + sev + (row ? ' on row ' + row : '') + '; got ' + JSON.stringify(probs.filter(p => p.id === id || (p.row === row && p.sev !== 'W')).slice(0, 4).map(p => [p.id, p.sev, p.tab, p.row, p.msg])));
}]));
tests.push(['renamed Citation header: the data is still read', () => {
  const f = H.fresh(), sh = T(f.env, 'Laws'); sh.getRange(1, H.col(sh, 'Citation')).setValue('Cite');
  assert.strictEqual(H.buildOf(f.env, f.ctx, 'preview').laws[0].cite, H.LIVE.laws[0].cite);
}]);
tests.push(['errors block Preview (nothing is written)', () => {
  const f = H.fresh(); S(T(f.env, 'Laws'), 'State', 2, 'Ohioo');
  const r = f.ctx.menuPreview();
  assert.ok(!r.ok && r.problems.some(p => p.id === 'L1')); assert.strictEqual(f.fake.puts().length, 0);
}]);

module.exports = { scenario: 'd', title: 'seeded errors (' + CASES.length + ' mutations) and a clean sheet', tests };
