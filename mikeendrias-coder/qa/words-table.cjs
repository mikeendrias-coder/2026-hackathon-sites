#!/usr/bin/env node
/* The word keys for the Sheet's "Words on the page" tab, from play/words.js (the one source of keys).
   node qa/words-table.cjs              print a TSV: key, where, max, fill-ins, used on, default text
   node qa/words-table.cjs --all        the TSV also lists keys other Sheet tabs own (Protections, Limits, Labels, Glossary)
   node qa/words-table.cjs --write-gs   rewrite the block between "// <WORD_KEYS>" and "// </WORD_KEYS>" in sheet/Code.gs
   node qa/words-table.cjs --check      exit 1 if sheet/Code.gs's block differs (or is missing)
   The Words tab gets every key with no other owner, plus the why.* step notes (used on "Both"; text from
   data/live.json config.why, which is where the Sheet publishes them). */
'use strict';
const fs = require('fs');
const path = require('path');

const FV = path.resolve(__dirname, '..');
const GS = path.join(FV, 'sheet/Code.gs');
const OPEN = '// <WORD_KEYS>', CLOSE = '// </WORD_KEYS>';
const W = require(path.join(FV, 'play/words.js'));

function liveWhy() {
  try { return (JSON.parse(fs.readFileSync(path.join(FV, 'data/live.json'), 'utf8')).config || {}).why || {}; } catch (e) { return {}; }
}
const fills = t => [...new Set((String(t).match(/\{([A-Za-z0-9_.]+)\}/g) || []).map(x => x.slice(1, -1)))];

// Rows for the Words tab, in words.js order, why.* last.
function rows(all) {
  const why = liveWhy(), out = [], tail = [];
  Object.keys(W.FV_WORDS).forEach(key => {
    const m = W.FV_WORD_META[key] || {}, text = W.FV_WORDS[key];
    if (m.tab === 'why') {
      const t = typeof why[key.slice(4)] === 'string' && why[key.slice(4)] ? why[key.slice(4)] : text;
      tail.push({ key, where: m.where || '', max: 240, fills: fills(t), usedOn: 'Both', text: t });
    } else if (!m.tab) {
      out.push({ key, where: m.where || '', max: m.max || 0, fills: fills(text), usedOn: 'New page', text });
    } else if (all) {
      out.push({ key, where: m.where || '', max: m.max || 0, fills: fills(text), usedOn: 'New page (' + m.tab + ' tab)', text });
    }
  });
  return out.concat(tail);
}

function block() {
  const line = r => JSON.stringify({ key: r.key, where: r.where, max: r.max, fills: r.fills, usedOn: r.usedOn, text: r.text }) + ',';
  return ['var WORD_KEYS = ['].concat(rows(false).map(line)).concat(['];']).join('\n');
}

// Returns {src, start, end} where start/end bound the text strictly between the marker lines.
function findBlock(src) {
  const a = src.indexOf(OPEN); if (a < 0) return null;
  const startLine = src.indexOf('\n', a); if (startLine < 0) return null;
  const b = src.indexOf(CLOSE, startLine); if (b < 0) return null;
  const endLine = src.lastIndexOf('\n', b);
  return { start: startLine + 1, end: endLine + 1 };
}

const args = process.argv.slice(2);
if (args.includes('--write-gs') || args.includes('--check')) {
  if (!fs.existsSync(GS)) { console.error('words-table: sheet/Code.gs not found'); process.exit(1); }
  const src = fs.readFileSync(GS, 'utf8'), at = findBlock(src);
  if (!at) { console.error(`words-table: no "${OPEN}" … "${CLOSE}" block in sheet/Code.gs`); process.exit(1); }
  const want = block() + '\n', have = src.slice(at.start, at.end);
  if (args.includes('--check')) {
    if (have === want) { console.log(`WORDS-TABLE OK: sheet/Code.gs WORD_KEYS matches play/words.js (${rows(false).length} keys)`); process.exit(0); }
    const hl = have.split('\n'), wl = want.split('\n');
    const i = hl.findIndex((x, j) => x !== wl[j]);
    console.error(`WORDS-TABLE DRIFT: sheet/Code.gs WORD_KEYS differs from play/words.js at block line ${i + 1}`);
    console.error('  Code.gs:  ' + (hl[i] || '(end)').slice(0, 160));
    console.error('  words.js: ' + (wl[i] || '(end)').slice(0, 160));
    console.error('  Fix: node qa/words-table.cjs --write-gs');
    process.exit(1);
  }
  fs.writeFileSync(GS, src.slice(0, at.start) + want + src.slice(at.end));
  console.log(`words-table: wrote ${rows(false).length} keys into sheet/Code.gs`);
  process.exit(0);
}

const clean = t => String(t).replace(/[\t\r\n]+/g, ' ');
const list = rows(args.includes('--all'));
console.log(['key', 'where', 'max', 'fill-ins', 'used on', 'default text'].join('\t'));
list.forEach(r => console.log([r.key, r.where, r.max, r.fills.map(x => '{' + x + '}').join(' '), r.usedOn, r.text].map(clean).join('\t')));
