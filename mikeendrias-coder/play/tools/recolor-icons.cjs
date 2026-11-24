#!/usr/bin/env node
/*
 * Builds play/icons/ for the Face Value draft page.
 *
 *   node play/tools/recolor-icons.cjs           write all 34 icons
 *   node play/tools/recolor-icons.cjs --check   verify them, exit 1 on any problem
 *
 * 1. The 23 Nov 11 sprites are copied byte for byte from
 *    `git show upstream/main:mikeendrias-coder/icons/<n>.svg`.
 * 2. The 11 newer sprites are read from FV/icons/<n>.svg (left untouched there)
 *    and mapped to the original palette (design-site-v2.md section 3.7).
 *    Hex colors are matched in any case, in 3, 4, 6 or 8 digit form, anywhere in
 *    the file (attributes and style strings). rgb()/rgba() and the named colors
 *    white/black are turned into hex first. Any other color form (hsl(),
 *    currentColor, other names) stops the build so nobody ships a wrong color.
 * 3. --check fails if any play/icons file has a hex outside the palette, a color
 *    in some other form, a wrong byte for an original, a stale recolored icon,
 *    or a missing or extra file.
 *
 * Node only, no dependencies. Internal <title> and c2pa metadata are kept as is.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FV = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(FV, 'icons');
const OUT_DIR = path.join(FV, 'play', 'icons');
const UPSTREAM = 'upstream/main';
const UPSTREAM_DIR = 'mikeendrias-coder/icons';

const ORIGINALS = [
  'db-dmv', 'db-mug', 'logo', 'src-bodycam', 'src-cctv', 'src-drone', 'src-photo',
  'status-blocked', 'status-bypassed', 'status-limited', 'status-open',
  'step-approval', 'step-arrest', 'step-crime', 'step-disclose', 'step-lineup',
  'step-match', 'step-photo', 'step-search', 'step-trial',
  'who-federal', 'who-local', 'who-state'
];

const RECOLORED = [
  'shield-yes', 'shield-part', 'shield-no', 'shield-empty', 'gate-closed',
  'p-accuracy', 'p-crowd', 'p-trained', 'exception', 'bill', 'law'
];

// CDT hex -> original-palette hex (design-site-v2.md section 3.7).
const MAP = {
  '#202C53': '#0C2340', // navy
  '#5369FF': '#1F5BB8', // blue
  '#BFEAFF': '#DCE6F7', // light
  '#4CC6FF': '#9DB5E0', // mid
  '#9AA6CF': '#9DB5E0', // shield-empty outline
  '#E2FE90': '#FFFFFF', // lime check and shine -> white on blue
  '#D92D20': '#4D5F7A', // red outline and X -> slate
  '#FDE3E1': '#FFFFFF'  // pink shield-no fill -> white
};

const PALETTE = new Set([
  '#0C2340', '#1F5BB8', '#9DB5E0', '#DCE6F7', '#FFFFFF', '#4D5F7A', '#FFC94D'
]);

// A hex color: # then 3, 4, 6 or 8 hex digits, not followed by another word char.
const HEX_RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)/gi;
const NAMED = { white: '#FFFFFF', black: '#000000' };
// Color-bearing attributes or style properties whose value is a keyword.
const PAINT_RE = /\b(fill|stroke|stop-color|flood-color|lighting-color|color)\s*(=\s*["']|:\s*)\s*([a-zA-Z]+)\b(?!\s*\()/gi;
const PAINT_OK = new Set(['none', 'transparent', 'inherit']);

/* ---------- helpers ---------- */

// Expand #abc / #abcd / #aabbcc / #aabbccdd to upper-case #RRGGBB plus alpha.
function normHex(raw) {
  let h = raw.slice(1).toUpperCase();
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  return { rgb: '#' + h.slice(0, 6), alpha: h.length === 8 ? h.slice(6) : '' };
}

function upstreamBytes(name) {
  return execFileSync('git', ['-C', FV, 'show', `${UPSTREAM}:${UPSTREAM_DIR}/${name}.svg`], {
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

// Recolor one SVG string. Returns { out, found: Set of source colors, notes: [] }.
function recolor(name, src) {
  const notes = [];
  const found = new Set();
  let s = src;

  // rgb()/rgba() -> hex (then mapped below like any other hex).
  s = s.replace(RGB_RE, (m, r, g, b, a) => {
    const hex = '#' + [r, g, b].map((v) => Math.min(255, +v).toString(16).padStart(2, '0')).join('').toUpperCase();
    notes.push(`${name}: ${m} -> ${hex}`);
    if (a !== undefined && a !== '1' && a !== '100%') {
      throw new Error(`${name}: ${m} has transparency; map it by hand`);
    }
    return hex;
  });

  // Named paint values: white/black -> hex; none/transparent stay; anything else stops.
  s = s.replace(PAINT_RE, (m, prop, sep, word) => {
    const w = word.toLowerCase();
    if (PAINT_OK.has(w)) return m;
    if (NAMED[w]) {
      notes.push(`${name}: ${prop} ${word} -> ${NAMED[w]}`);
      return m.slice(0, m.length - word.length) + NAMED[w];
    }
    if (w === 'currentcolor') throw new Error(`${name}: uses currentColor, which renders black inside <img>; map it by hand`);
    throw new Error(`${name}: color keyword "${word}" on ${prop}; add it to the map`);
  });
  if (/\bhsla?\(/i.test(s)) throw new Error(`${name}: uses hsl(); add it to the map`);

  // Hex colors, any case, any length.
  s = s.replace(HEX_RE, (m) => {
    const { rgb, alpha } = normHex(m);
    found.add(rgb + alpha);
    const to = MAP[rgb] || rgb;
    if (!PALETTE.has(to)) throw new Error(`${name}: ${m} has no mapping into the palette`);
    if (alpha && alpha !== 'FF') throw new Error(`${name}: ${m} has transparency; map it by hand`);
    return to;
  });

  return { out: s, found, notes };
}

// Problems with colors in one finished file.
function colorProblems(name, text) {
  const bad = [];
  for (const m of text.matchAll(HEX_RE)) {
    const { rgb, alpha } = normHex(m[0]);
    if (!PALETTE.has(rgb) || (alpha && alpha !== 'FF')) bad.push(`${name}.svg: ${m[0]} is outside the palette`);
  }
  for (const m of text.matchAll(RGB_RE)) bad.push(`${name}.svg: ${m[0]} (use hex)`);
  if (/\bhsla?\(/i.test(text)) bad.push(`${name}.svg: hsl() color (use hex)`);
  for (const m of text.matchAll(PAINT_RE)) {
    if (!PAINT_OK.has(m[3].toLowerCase())) bad.push(`${name}.svg: ${m[1]} ${m[3]} (use hex)`);
  }
  return bad;
}

function buildRecolored(name) {
  const file = path.join(SRC_DIR, name + '.svg');
  return recolor(name, fs.readFileSync(file, 'utf8'));
}

/* ---------- modes ---------- */

function write() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const n of ORIGINALS) fs.writeFileSync(path.join(OUT_DIR, n + '.svg'), upstreamBytes(n));
  for (const n of RECOLORED) {
    const r = buildRecolored(n);
    r.notes.forEach((x) => console.log('  note ' + x));
    const used = [...new Set([...r.out.matchAll(HEX_RE)].map((m) => normHex(m[0]).rgb))].sort();
    console.log(`  ${n}: ${[...r.found].sort().join(' ')} -> ${used.join(' ')}`);
    fs.writeFileSync(path.join(OUT_DIR, n + '.svg'), r.out, 'utf8');
  }
  console.log(`Wrote ${ORIGINALS.length} originals and ${RECOLORED.length} recolored icons to play/icons/`);
}

function check() {
  const bad = [];
  const want = new Set([...ORIGINALS, ...RECOLORED].map((n) => n + '.svg'));
  const have = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : [];
  for (const f of have) if (!want.has(f)) bad.push(`extra file play/icons/${f}`);
  for (const f of want) if (!have.includes(f)) bad.push(`missing play/icons/${f}`);

  for (const n of ORIGINALS) {
    const p = path.join(OUT_DIR, n + '.svg');
    if (!fs.existsSync(p)) continue;
    const got = fs.readFileSync(p);
    if (!got.equals(upstreamBytes(n))) bad.push(`${n}.svg differs from ${UPSTREAM} bytes`);
    bad.push(...colorProblems(n, got.toString('utf8')));
  }
  for (const n of RECOLORED) {
    const p = path.join(OUT_DIR, n + '.svg');
    if (!fs.existsSync(p)) continue;
    const got = fs.readFileSync(p, 'utf8');
    bad.push(...colorProblems(n, got));
    let fresh = null;
    try { fresh = buildRecolored(n).out; } catch (e) { bad.push(e.message); }
    if (fresh !== null && fresh !== got) bad.push(`${n}.svg is stale; run node play/tools/recolor-icons.cjs`);
  }

  if (bad.length) {
    bad.forEach((b) => console.error('FAIL ' + b));
    console.error(`ICONS FAIL (${bad.length} problem${bad.length === 1 ? '' : 's'})`);
    process.exit(1);
  }
  console.log(`ICONS OK (${want.size} files)`);
}

try {
  if (process.argv.includes('--check')) check();
  else write();
} catch (e) {
  console.error('ICONS FAIL ' + (e && e.message ? e.message : e));
  process.exit(1);
}
