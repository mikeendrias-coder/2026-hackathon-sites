#!/usr/bin/env node
// Copies sheet/test/fixtures/texts.json into the SHEET_TEXTS block of sheet/Code.gs.
//   node sheet/test/inline-texts.cjs           rewrite the block
//   node sheet/test/inline-texts.cjs --check   exit 1 if the block differs from texts.json
'use strict';
const fs = require('fs'), path = require('path');
const CODE = path.join(__dirname, '..', 'Code.gs'), TEXTS = path.join(__dirname, 'fixtures', 'texts.json');
const OPEN = '// <SHEET_TEXTS>', CLOSE = '// </SHEET_TEXTS>';

function render(texts) { return 'var SHEET_TEXTS = ' + JSON.stringify(texts, null, 1) + ';'; }
function split(src) {
  const a = src.indexOf('\n' + OPEN + '\n'), b = src.indexOf('\n' + CLOSE + '\n');
  if (a < 0 || b < a) throw new Error('Code.gs has no ' + OPEN + ' ... ' + CLOSE + ' block');
  const start = a + OPEN.length + 2;
  return { before: src.slice(0, start), inner: src.slice(start, b), after: src.slice(b) };
}
function main() {
  if (!fs.existsSync(TEXTS)) { console.log('inline-texts: ' + path.relative(process.cwd(), TEXTS) + ' does not exist; nothing to do'); return 0; }
  const texts = JSON.parse(fs.readFileSync(TEXTS, 'utf8')), src = fs.readFileSync(CODE, 'utf8'), parts = split(src), want = render(texts);
  if (process.argv.includes('--check')) {
    if (parts.inner.trim() === want) { console.log('inline-texts: SHEET_TEXTS matches texts.json'); return 0; }
    console.log('inline-texts: SHEET_TEXTS differs from texts.json (run node sheet/test/inline-texts.cjs)'); return 1;
  }
  fs.writeFileSync(CODE, parts.before + want + parts.after);
  console.log('inline-texts: wrote SHEET_TEXTS (' + want.length + ' characters)');
  return 0;
}
if (require.main === module) process.exit(main());
module.exports = { render, split };
