// Checks that site data -> sheet tabs -> site data gives back the same thing.
// Run: node sheet/test_roundtrip.js
const fs = require('fs'), path = require('path');
const vm = require('vm'); const box = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), box); const FV = box.module.exports;
const live = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/live.json'), 'utf8'));
const rows = FV.toRows(live, []);
// Simulate the sheet: everything is stored as text, except checkboxes.
const asSheet = {}; Object.keys(rows).forEach(t => { asSheet[t] = rows[t].map(r => r.map(c => typeof c === 'boolean' ? c : String(c ?? ''))); });
const { data, errors } = FV.fromRows(asSheet, live.source);
const norm = d => { const c = JSON.parse(JSON.stringify(d)); delete c.updated; return c; };
const a = norm(live), b = norm(data);
let bad = 0;
const walk = (x, y, p) => {
  if (typeof x !== 'object' || x === null || typeof y !== 'object' || y === null) { if (JSON.stringify(x) !== JSON.stringify(y)) { if (bad++ < 25) console.log('DIFF', p, JSON.stringify(x)?.slice(0, 80), '->', JSON.stringify(y)?.slice(0, 80)); } return; }
  new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => walk(x[k], y[k], p + '.' + k));
};
walk(a, b, '');
console.log('errors:', errors.length, errors.slice(0, 10));
console.log(bad ? `${bad} differences` : 'ROUND TRIP OK');
process.exit(bad || errors.length ? 1 : 0);
