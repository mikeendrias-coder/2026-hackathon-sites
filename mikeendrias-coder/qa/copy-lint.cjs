#!/usr/bin/env node
/* Copy rules for the new page (design-site §5.2).
   Errors (exit 1): built-in text breaks a rule. Built-in text is every value in play/words.js (FV_WORDS,
   FV_PROT_WHY, FV_EXAMPLES) and every sentence play/copy.js builds from them (a full dump with no Sheet config).
   Data text inside those sentences (law names, "does", ban text, research notes) is the Sheet's and is masked out.
   Warnings: Sheet text in data/live.json config breaks a rule. That text is Michael's; it never fails the run.
   Law and bill text in the data (does, note, research notes, ban and bar text) is checked the same way, as warnings.
   Facts (errors): no "N of the M protections" with M over 7 or N over M; in every case the tally total equals the
   number of check lines the reader sees; no line tagged Partly whose text says the law doesn't reach the case.
   Also errors when a play/ui-*.js file holds an English string literal of 3+ words (UI files hold no English).
   Mark a deliberate UI literal with a trailing "// copy-lint-ok" comment on its line.
   Usage: node qa/copy-lint.cjs [--data path] [--ui-dir dir] [--verbose]   (--ui-dir is for testing the UI check)
   Prints "COPY-LINT: E errors, N warnings". */
'use strict';
const fs = require('fs');
const path = require('path');

const FV = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const di = args.indexOf('--data');
const DATA = di >= 0 ? args[di + 1] : path.join(FV, 'data/live.json');
const VERBOSE = args.includes('--verbose');

const errors = [], warnings = [];
const norm = t => String(t).replace(/[’‘]/g, "'").replace(/[“”]/g, '"');

/* ---------- the rules ---------- */
const PHRASES = [
  [/\bnot\b[^.!?]{0,80}\bbut\b/i, 'a "not X, but Y" sentence'],
  [/\bnot (just|only)\b/i, 'a "not just / not only" phrase'],
  [/n't [^.!?]{0,60}\b(it's|they're)\b/i, 'a "isn\'t X, it\'s Y" sentence'],
  [/,\s*not\s+(a|an|the|just|only|to|by|for|in|on)?\s*\w+[^.!?]*[.!?]?$/i, 'an "X, not Y" ending'],
  [/\s[-\u2013\u2014]\s*not\s+\w+[^.!?]*[.!?]?$/i, 'an "X - not Y" ending'],
  [/\binstead of\b/i, 'an "instead of" contrast'],
  [/\brather than\b/i, 'a "rather than" contrast']
];
const words = s => (norm(s).match(/[A-Za-z0-9][A-Za-z0-9'’.-]*/g) || []).filter(x => /[A-Za-z0-9]/.test(x));
// Split into sentences; abbreviations like "U.S." and "Nov." stay inside their sentence.
function sentences(t) {
  const s = norm(t).replace(/\b(U\.S|Jan|Feb|Aug|Sept|Oct|Nov|Dec|Ann|Rev|Stat|Gen|Del|Sen|Rep|No|Md|Ky|Va|Vt|Me|Mont|Ind|Ill|Colo|Wash|Mass|Minn|Tex|Bus|Com|Proc|Crim)\./g, '$1\u0000')
    .replace(/\b([A-Z])\.(?=[A-Z]\.)/g, '$1\u0000');
  return s.split(/(?<=[.!?])\s+(?=["(]?[A-Z0-9])/).map(x => x.replace(/\u0000/g, '.').trim()).filter(Boolean);
}
function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
// Flesch-Kincaid grade of a string (needs about 10 words to mean anything).
function fkGrade(t) {
  const ws = words(t.replace(/-/g, ' ')).filter(x => /[A-Za-z]/.test(x)), ss = Math.max(1, sentences(t).length);
  if (!ws.length) return 0;
  const syl = ws.reduce((a, x) => a + syllables(x), 0);
  return 0.39 * (ws.length / ss) + 11.8 * (syl / ws.length) - 15.59;
}
const LEFTOVER = /\{[A-Za-z0-9_.]+\}|\bundefined\b|\bNaN\b|\bnull\b|\[object Object\]/;

// Check one string. kind: 'word' (a FV_WORDS value, fill-ins allowed) or 'out' (built output) or 'sheet'.
function check(where, text, push, kind) {
  const t = String(text == null ? '' : text);
  if (!t.trim()) return;
  if (/^https?:\/\//.test(t)) return;
  const plain = kind === 'word' ? t.replace(/\{[A-Za-z0-9_.]+\}/g, 'Ohio') : t;
  // Phrase rules run per sentence, so an "X, not Y." in the middle of a longer text is caught too.
  const ss = sentences(plain), hit = new Set();
  ss.forEach(s => PHRASES.forEach(([re, what]) => { if (!hit.has(what) && re.test(s)) { hit.add(what); push(`${where}: ${what}: "${t}"`); } }));
  ss.forEach(s => { const n = words(s).length; if (n > 25) push(`${where}: sentence of ${n} words (max 25): "${s}"`); });
  // Flesch-Kincaid swings wildly on short strings, so it is only scored from 15 words up.
  if (words(plain).length >= 15) {
    const g = fkGrade(plain);
    if (g > 9) push(`${where}: reading grade ${g.toFixed(1)} (max 9): "${t}"`);
  }
  if (kind !== 'word' && LEFTOVER.test(t)) push(`${where}: leftover placeholder or bad value: "${t}"`);
}

/* ---------- 1. built-in words ---------- */
const W = require(path.join(FV, 'play/words.js'));
const E = m => errors.push(m), Wn = m => warnings.push(m);
Object.keys(W.FV_WORDS).forEach(k => {
  const v = W.FV_WORDS[k], meta = W.FV_WORD_META[k];
  if (typeof v !== 'string') { E(`words ${k}: value is not a string`); return; }
  if (!meta || !meta.where || !(meta.max > 0)) E(`words ${k}: missing FV_WORD_META where/max`);
  else if (v.length > meta.max) E(`words ${k}: ${v.length} characters (max ${meta.max}): "${v}"`);
  if (/(url|Url)$/.test(k.split('.').pop()) && !/^https:\/\//.test(v)) E(`words ${k}: URL keys need an https address`);
  if (k === 'date.months') { if (v.split('|').length !== 12) E('words date.months: needs 12 names separated by |'); return; }
  // Keys another Sheet tab owns (Protections, Limits, Labels, Glossary, Step notes) hold copies of Sheet text: warnings.
  check('words ' + k, v, meta && meta.tab ? Wn : E, 'word');
});
Object.keys(W.FV_WORD_META).forEach(k => { if (!(k in W.FV_WORDS)) E(`words ${k}: in FV_WORD_META but not in FV_WORDS`); });
['offline.heading', 'offline.message', 'offline.linkText', 'offline.linkUrl', 'risk.url', 'risk.linkText']
  .forEach(k => { if (!(k in W.FV_WORDS)) E(`words: required key ${k} is missing`); });
['1', '2', '3', '4', '5', '6', '7'].forEach(k => {
  if (!W.FV_PROT_WHY[k]) E(`FV_PROT_WHY ${k}: missing`); else check('FV_PROT_WHY ' + k, W.FV_PROT_WHY[k], E, 'word');
});
(W.FV_EXAMPLES || []).forEach(x => ['t', 'd', 'lesson'].forEach(f => check(`FV_EXAMPLES ${x.id} ${f}`, x[f], E, 'word')));

/* ---------- 2. every sentence copy.js builds from built-in words ---------- */
let D = null;
try { D = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { E(`cannot read ${DATA}: ${e.message}`); }
let dumpOk = false;
if (D) {
  if (!fs.existsSync(path.join(FV, 'play/logic.js')) || !fs.existsSync(path.join(FV, 'play/copy.js'))) {
    Wn('play/logic.js or play/copy.js is missing, so built sentences were not checked');
  } else {
    try {
      const rows = require('./copy-dump.cjs').collect({ data: DATA, bare: true });
      // Mask Sheet data (names, descriptions, notes, citations) so only our own words are judged.
      const data = new Set();
      const addData = v => { if (typeof v === 'string' && v.trim().length > 2) data.add(norm(v.trim())); };
      (D.laws || []).forEach(l => { ['name', 'does', 'note', 'reviewNote', 'cite'].forEach(f => addData(l[f])); if (l.ban) { addData(l.ban.text); addData(l.ban.except); } if (l.bars) addData(l.bars.text); });
      (D.bills || []).forEach(b => ['name', 'does', 'note'].forEach(f => addData(b[f])));
      addData(D.source);
      (D.states || []).forEach(x => addData(x.name));
      const masks = [...data].sort((a, b) => b.length - a.length);
      const seen = new Set();
      rows.forEach(r => {
        // Glossary lines are Glossary-tab text, already checked above as words.
        if (/^glossary /.test(r.where) || seen.has(r.text)) return; seen.add(r.text);
        let t = norm(r.text);
        masks.forEach(m => { if (t.includes(m)) t = t.split(m).join('Ohio'); });
        check('built ' + r.where, t, E, 'out');
        if (LEFTOVER.test(r.text) && !LEFTOVER.test(t)) E(`built ${r.where}: leftover placeholder or bad value: "${r.text}"`);
      });
      dumpOk = true;
      if (VERBOSE) console.log(`checked ${seen.size} distinct built strings`);
    } catch (e) {
      E('copy-dump could not run: ' + (e && e.message || e));
    }
  }
}

/* ---------- 2b. facts the sentences state (errors) ---------- */
// Counts and tags that a reader can check against the page. Run on the bare build (built-in words only).
let factsOk = false;
if (D && dumpOk) {
  try {
    const FVLogic = require(path.join(FV, 'play/logic.js')), FVCopy = require(path.join(FV, 'play/copy.js'));
    const { SETUPS } = require('./copy-dump.cjs');
    const L = FVLogic.create(D), C = FVCopy.create(L, FVCopy.wordFn(FVCopy.merge(W.FV_WORDS, W.FV_PROT_WHY, {})));
    const reachWords = norm(W.FV_WORDS['tag.reach'] || '').replace(/^Law /, '').toLowerCase();
    const COUNT = /\b(\d+) of (?:the )?(\d+) protections\b/i;
    const fact = (where, msg) => errors.push(`fact ${where}: ${msg}`);
    L.states().forEach(st => SETUPS.forEach(ctx => {
      const where = `${st} ${[ctx.who, ctx.src, ctx.db, ctx.crime].join('/')}`;
      const c = L.computeCase(st, ctx), tl = C.tallyLabels(L.tally(c), c, ctx), t = C.tallyOf(c, ctx);
      const lines = c.steps.flatMap(s => C.stepLines(st, c, s, ctx).map(l => Object.assign({ step: s.key }, l)));
      const texts = [C.resultSentence(st, c, ctx), tl.aria, tl.of].concat(lines.map(l => l.text));
      texts.forEach(x => { const m = COUNT.exec(norm(x)); if (m && (+m[2] > 7 || +m[1] > +m[2])) fact(where, `count out of range: "${x}"`); });
      if (tl.ban) { if (tl.items.length) fact(where, 'a ban stop still shows tally counts'); }
      else {
        const shown = lines.filter(l => l.kind === 'rule' && l.tag && l.tag.cls !== 't-na').length;
        if (shown !== tl.total) fact(where, `tally says ${tl.total} checks apply, the steps show ${shown} check lines`);
        if (shown !== t.total) fact(where, `tallyOf says ${t.total} checks apply, the steps show ${shown} check lines`);
        if (tl.items.reduce((a, x) => a + x.n, 0) !== tl.total) fact(where, 'tally items do not add up to the total');
      }
      // A line's tag and its text must agree: "Partly" text only under a Partly tag, "doesn't reach" text never under one.
      const partWord = norm(W.FV_WORDS['tag.part'] || 'Partly') + '.';
      lines.forEach(l => {
        // "Partly, unclear" (a flagged law) is a Partly tag too.
        const part = !!l.tag && (l.tag.cls === 't-part' || (l.tag.cls === 't-unclear' && norm(l.tag.text).startsWith(partWord.slice(0, -1))));
        const x = norm(l.text);
        if (part && reachWords && x.toLowerCase().includes(reachWords)) fact(where, `line tagged Partly says the law misses the case: "${l.text}"`);
        if (!part && x.startsWith(partWord)) fact(where, `line says Partly under a "${l.tag ? l.tag.text : ''}" tag: "${l.text}"`);
      });
      c.steps.forEach(s => { const a = C.stepAgg(c, s, ctx); if (s.agg === 'skip' ? a !== 'skip' : false) fact(where, 'a skipped step changed status'); });
      // A line resting only on laws flagged unclear for its rule shows an Unclear tag and is never counted as Protected.
      c.steps.forEach(s => {
        if (s.agg === 'skip' || s.key === 'trial') return;
        if (s.agg !== 'stop') C.stepLines(st, c, s, ctx).filter(l => l.kind === 'rule').forEach(l => {
          const r = s.results.find(x => x.rule === l.rule && (x.at || null) === l.at); if (!r) return;
          // After the still-photo fix (a live-scanning-only catch misses a still photo, so that line reads No).
          const st0 = C.lineStatus(r, c, ctx).base || r.status;
          const win = (r.hits || []).filter(h => h.kind === st0 && (st0 === 'covered' || st0 === 'partial'));
          const flagged = win.length && win.every(h => h.law.review && (Array.isArray(h.law.reviewRules) ? h.law.reviewRules : h.law.rules || []).map(String).includes(String(r.rule)));
          if (flagged && (!l.tag || l.tag.cls !== 't-unclear')) fact(where, `line rests on a law flagged unclear but is tagged "${l.tag ? l.tag.text : ''}": "${l.text}"`);
        });
        // A one-rule step's detail line must not repeat the step head.
        const head = norm(C.stepHead(st, c, s, ctx)), ls = C.stepLines(st, c, s, ctx);
        if (ls.length === 1 && head && norm(ls[0].text).startsWith(head)) fact(where, `step ${s.key} line repeats the head: "${ls[0].text}"`);
      });
      // "{State} limits live scanning" only when the state has that rule in full.
      const fullNa = norm(W.FV_WORDS['line.na.has'] || '').replace(/\{TheState\}/g, norm(st === 'District of Columbia' ? 'The District of Columbia' : st));
      if (L.stateProt(st, '6').level !== 'yes' && lines.some(l => norm(l.text) === fullNa)) fact(where, 'a still-photo line says the state limits live scanning, but its rule is only partial');
    }));
    // NH HB 1688 is flagged for rules 1 and 6: the state/camera case must show it as unclear and count it as Partly.
    if (L.states().includes('New Hampshire')) {
      const nctx = { who: 'state', src: 'cctv', db: 'dmv', crime: 'serious' }, nc = L.computeCase('New Hampshire', nctx);
      const nl = nc.steps.flatMap(s => C.stepLines('New Hampshire', nc, s, nctx));
      const six = nl.find(l => l.rule === '6'), nt = C.tallyOf(nc, nctx);
      if (!six || !six.tag || six.tag.cls !== 't-unclear') fact('New Hampshire state/cctv/dmv/serious', 'the live-scanning line is not tagged unclear');
      if (nt.got !== 0) fact('New Hampshire state/cctv/dmv/serious', `the tally counts ${nt.got} unclear check(s) as Protected`);
    }
    // A law card under a row shows Unclear only when the row itself is flagged for that rule (Colorado SB 22-113).
    L.states().forEach(st => ['1', '2', '3', '4', '5', '6', '7'].forEach(rule => {
      const row = C.row(st, rule);
      if (!row.unclear && row.laws.some(k => k.unclear)) fact(`${st} row ${rule}`, 'a law card says Unclear under a row that is not flagged');
    }));
    factsOk = true;
  } catch (e) {
    E('fact checks could not run: ' + (e && e.stack || e));
  }
}

/* ---------- 3. Sheet text in config: warnings only ---------- */
const C = (D && D.config) || {};
const sheet = (where, v) => check('sheet ' + where, v, Wn, 'sheet');
Object.entries(C.prot || {}).forEach(([k, p]) => ['short', 'long', 'why'].forEach(f => p && sheet(`prot ${k} ${f}`, p[f])));
Object.entries(C.limits || {}).forEach(([k, v]) => sheet(`limit "${k}"`, v && v.text));
Object.entries(C.glossary || {}).forEach(([k, v]) => { if (k !== 'federal agent' && v) { sheet(`glossary ${k} term`, v.term); sheet(`glossary ${k} def`, v.def); } });
Object.entries(C.why || {}).forEach(([k, v]) => sheet(`why ${k}`, v));
Object.entries(C.words || {}).forEach(([k, v]) => sheet(`words ${k}`, v));
Object.entries(C.billSteps || {}).forEach(([k, v]) => sheet(`billStep ${k}`, v));
Object.entries(C.lawStatus || {}).forEach(([k, v]) => sheet(`lawStatus ${k}`, v));
(Array.isArray(C.examples) ? C.examples : []).forEach(x => x && ['t', 'd', 'lesson'].forEach(f => sheet(`example ${x.id} ${f}`, x[f])));
// Law and bill text from the Sheet's Laws and Bills tabs. It reaches the page as is, so it gets the same rules.
(D && D.laws || []).forEach(l => {
  if (!l) return;
  const id = `law ${l.state} ${l.name}`;
  ['does', 'note', 'reviewNote'].forEach(f => sheet(`${id} ${f}`, l[f]));
  if (l.ban) { sheet(`${id} ban text`, l.ban.text); sheet(`${id} ban except`, l.ban.except); }
  if (l.bars) sheet(`${id} bars text`, l.bars.text);
});
(D && D.bills || []).forEach(b => { if (b) { sheet(`bill ${b.state} ${b.name} does`, b.does); sheet(`bill ${b.state} ${b.name} note`, b.note); } });
Object.entries(C.words || {}).forEach(([k, v]) => {
  const meta = W.FV_WORD_META[k];
  if (meta && typeof v === 'string' && v.length > meta.max) Wn(`sheet words ${k}: ${v.length} characters (max ${meta.max})`);
});

/* ---------- 4. no English in play/ui-*.js ---------- */
// Walk the source and yield string literals (', ", `), skipping comments and regex literals.
function literals(src) {
  const out = []; let i = 0, line = 1, prev = '';
  const regexAllowed = () => /^$|[(,=:\[!&|?{};+\-*%<>~^]$|\breturn$|\btypeof$|\bcase$/.test(prev);
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const body = src.slice(i, e < 0 ? src.length : e + 2); line += (body.match(/\n/g) || []).length; i = e < 0 ? src.length : e + 2; continue; }
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false;
      while (j < src.length && src[j] !== '\n') { if (src[j] === '\\') { j += 2; continue; } if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break; j++; }
      i = j + 1; while (/[a-z]/i.test(src[i] || '')) i++; prev = 'x'; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, text = '', startLine = line, depth = 0;
      while (j < src.length) {
        const ch = src[j];
        if (ch === '\\') { text += src[j + 1] || ''; j += 2; continue; }
        if (ch === '\n') line++;
        if (c === '`' && ch === '$' && src[j + 1] === '{') { depth++; text += ' '; j += 2; let b = 1; while (j < src.length && b) { if (src[j] === '{') b++; else if (src[j] === '}') b--; if (src[j] === '\n') line++; j++; } continue; }
        if (ch === c) break;
        text += ch; j++;
      }
      out.push({ text, line: startLine, tpl: c === '`' });
      i = j + 1; prev = 'x'; continue;
    }
    // identifiers, numbers and punctuation
    let j = i; if (/[A-Za-z0-9_$]/.test(c)) { while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++; prev = src.slice(i, j); i = j; continue; }
    prev = c; i++;
  }
  return out;
}
const ENGLISH = /(^|[\s>"'(])[A-Za-z][a-z']*(?: +[A-Za-z][a-z',.?!]*){2,}/;
const ui = args.indexOf('--ui-dir'), UIDIR = ui >= 0 ? path.resolve(args[ui + 1]) : path.join(FV, 'play');
let uiFiles = [];
try { uiFiles = fs.readdirSync(UIDIR).filter(f => /^ui-.*\.js$/.test(f)); } catch (e) { uiFiles = []; }
// Class names used in play/*.css: a literal made only of these is a class list.
const CSSCLASS = new Set();
try { fs.readdirSync(path.join(FV, 'play')).filter(f => /\.css$/.test(f)).forEach(f => (fs.readFileSync(path.join(FV, 'play', f), 'utf8').match(/\.[A-Za-z_][\w-]*/g) || []).forEach(c => CSSCLASS.add(c.slice(1)))); } catch (e) { /* no css yet */ }
uiFiles.forEach(f => {
  const src = fs.readFileSync(path.join(UIDIR, f), 'utf8'), lines = src.split('\n');
  literals(src).forEach(l => {
    const ln = lines[l.line - 1] || '';
    if (/copy-lint-ok/.test(ln)) return;
    const toks = l.text.trim().split(/\s+/);
    if (toks.every(x => CSSCLASS.has(x)) || (/class(Name|List)|class=/.test(ln) && /^[a-z0-9 _-]+$/.test(l.text.trim()))) return;
    // Drop markup that is code: tags, attribute values (class lists, ids), CSS-like tokens.
    const t = l.text.replace(/<[^>]*>/g, ' ').replace(/[\w-]+="[^"]*"/g, ' ').trim();
    if (!t || /^[.#\[\]:\w\s>,*=~^$|()-]+$/.test(t) && !/\s[a-z]+\s[a-z]+/.test(t.replace(/[.#][\w-]+/g, ''))) return;
    if (ENGLISH.test(t)) errors.push(`play/${f}:${l.line}: English string in UI code (move it to words.js): "${l.text.slice(0, 80)}"`);
  });
});

/* ---------- report ---------- */
const show = (label, list) => list.forEach(m => console.log(`${label} ${m}`));
show('ERROR', errors);
show('WARN ', warnings);
if (!uiFiles.length) console.log('note: no play/ui-*.js files yet, so the UI English check was skipped');
if (!dumpOk && D) console.log('note: built sentences were not checked');
if (!factsOk && D) console.log('note: fact checks did not run');
console.log(`COPY-LINT: ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
