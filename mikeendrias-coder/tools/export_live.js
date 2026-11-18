// One-time export: data.js + decisions.js + the text tables in app.js -> data/live.json.
// After this, the Google Sheet is the source of truth and this script is only kept for the record.
// Run: node tools/export_live.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.window = {};
require(path.join(root, 'archive/data.js'));
require(path.join(root, 'archive/decisions.js'));
const D = window.FRT_DATA;
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

// Pull a `const NAME = {...};` or `[...]` block out of app.js and evaluate it.
function block(name) {
  const i = app.indexOf(`const ${name} = `); if (i < 0) throw new Error('missing ' + name);
  let j = app.indexOf('=', i) + 1; while (app[j] === ' ') j++;
  const open = app[j], close = open === '{' ? '}' : ']'; let depth = 0, k = j, q = null;
  for (; k < app.length; k++) {
    const c = app[k];
    if (q) { if (c === '\\') { k++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === open) depth++; else if (c === close && --depth === 0) break;
  }
  return eval('(' + app.slice(j, k + 1) + ')');
}
const PROT = block('PROT'), LIMIT = block('LIMIT'), LTYPE = block('LTYPE'), BILLSTEP = block('BILLSTEP'),
  LAWSTATUS = block('LAWSTATUS'), PRESETS = block('PRESETS'), GLOSS = block('GLOSS'), WHY = block('WHY'), KEYW = block('KEYW');
const MODALW = eval(app.match(/const MODALW = (.*);/)[1]), EXCW = eval(app.match(/const EXCW = (.*);/)[1]);

// Seed quote marks from the automatic highlighting the site used until now.
// **bold** = key words, ((text)) = "Also allowed", [[text]] = "Exception".
function seedMarks(text, rule) {
  const n = text.length, tag = new Uint8Array(n);
  const paint = (re, v) => { re.lastIndex = 0; let m; while ((m = re.exec(text))) { if (!m[0].length) { re.lastIndex++; continue; } for (let i = m.index; i < m.index + m[0].length; i++) if (tag[i] < v) tag[i] = v; } };
  (rule ? [rule] : Object.keys(KEYW)).forEach(r => paint(KEYW[r], 1)); paint(MODALW, 1); paint(EXCW, 2);
  let out = '', i = 0;
  while (i < n) {
    let j = i; while (j < n && tag[j] === tag[i]) j++;
    let s = text.slice(i, j);
    if (tag[i] === 1) s = `**${s}**`;
    if (tag[i] === 2) s = /^(except|without|judicially|notwithstanding|do(es)? not apply)/i.test(s) ? `[[${s}]]` : `((${s}))`;
    out += s; i = j;
  }
  return out;
}

const limits = {};
Object.entries(LIMIT).forEach(([k, t]) => { limits[k] = { text: t, type: LTYPE[k] || 'narrow' }; });
// Limit codes used in data but missing from the table keep their own words.
[...D.laws, ...D.bills].forEach(x => Object.values(x.limits).forEach(v => { const k = String(v).toLowerCase(); if (!limits[k]) limits[k] = { text: v, type: LTYPE[k] || 'narrow' }; }));

const out = {
  source: D.source,
  updated: new Date().toISOString(),
  config: {
    prot: Object.fromEntries(Object.entries(PROT).map(([k, v]) => [k, { short: v.short, long: v.long }])),
    limits, billSteps: BILLSTEP, lawStatus: LAWSTATUS,
    stories: PRESETS.map(p => ({ t: p.t, d: p.d, ...p.s })),
    glossary: Object.fromEntries(Object.entries(GLOSS).map(([k, v]) => [k, { term: v[0], def: v[1] }])),
    why: WHY
  },
  states: D.states,
  laws: D.laws.map(l => ({ ...l, limits: Object.fromEntries(Object.entries(l.limits).map(([r, v]) => [r, String(v).toLowerCase()])) })),
  bills: D.bills.map(b => ({ ...b, limits: Object.fromEntries(Object.entries(b.limits).map(([r, v]) => [r, String(v).toLowerCase()])) })),
  quotes: D.quotes.map(q => ({ ...q, text: seedMarks(q.text, q.rule) }))
};
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/live.json'), JSON.stringify(out, null, 1));
console.log('wrote data/live.json', out.laws.length, 'laws', out.bills.length, 'bills', out.quotes.length, 'quotes', Object.keys(limits).length, 'limits');
