#!/usr/bin/env node
/* Prints every sentence play/copy.js can build, so people can read them all in one place.
   Usage: node qa/copy-dump.cjs [--data path/to/data.json] [--bare]
     --bare   use only the built-in words (no config from the data file), the way copy-lint checks defaults.
   Writes qa/out/copy-dump.txt and prints a count line.

   The 16 case setups (legacy codes who/src/db/crime) cover both police types, all four photo sources,
   both photo databases and both crimes:
     local: photo/dmv/serious, photo/dmv/minor, cctv/mug/minor, cctv/dmv/serious, drone/dmv/serious,
            drone/mug/minor, bodycam/dmv/serious, bodycam/mug/minor
     state: the same eight with who=state.
   Also exported for qa/copy-lint.cjs: collect({data, bare}) -> [{where, text}]. */
'use strict';
const fs = require('fs');
const path = require('path');

const FV = path.resolve(__dirname, '..');
const SETUPS = [];
['local', 'state'].forEach(who => [
  ['photo', 'dmv', 'serious'], ['photo', 'dmv', 'minor'], ['cctv', 'mug', 'minor'], ['cctv', 'dmv', 'serious'],
  ['drone', 'dmv', 'serious'], ['drone', 'mug', 'minor'], ['bodycam', 'dmv', 'serious'], ['bodycam', 'mug', 'minor']
].forEach(([src, db, crime]) => SETUPS.push({ who, src, db, crime })));

function load(dataPath, bare) {
  const words = require(path.join(FV, 'play/words.js'));
  const FVLogic = require(path.join(FV, 'play/logic.js'));
  const FVCopy = require(path.join(FV, 'play/copy.js'));
  const D = JSON.parse(fs.readFileSync(dataPath || path.join(FV, 'data/live.json'), 'utf8'));
  const L = FVLogic.create(D);
  const map = FVCopy.merge(words.FV_WORDS, words.FV_PROT_WHY, bare ? {} : D.config);
  const W = FVCopy.wordFn(map);
  const C = FVCopy.create(L, W);
  const examples = !bare && D.config && Array.isArray(D.config.examples) && D.config.examples.length ? D.config.examples : words.FV_EXAMPLES;
  return { D, L, C, W, words, examples };
}

function collect(opts) {
  const o = opts || {};
  const { D, L, C, examples } = load(o.data, o.bare);
  const out = [];
  const add = (where, t) => { if (t == null || t === '') return; if (Array.isArray(t)) t.forEach(x => add(where, x)); else out.push({ where, text: String(t) }); };
  const addCard = (where, k) => {
    if (!k) return;
    ['heading', 'covers', 'text', 'except', 'meta', 'catchText', 'unclearText', 'note', 'linkAria', 'noQuote', 'whyLabel', 'why', 'intro', 'exceptionsHeading']
      .forEach(f => add(where + ' ' + f, k[f]));
    (k.laws || []).forEach((l, i) => addCard(where + ' law' + (i + 1), l));
    (k.exceptions || []).forEach((l, i) => addCard(where + ' exception' + (i + 1), l));
  };

  add('page risk', C.riskLines());
  C.legend().forEach(g => add('legend ' + g.tier, g.aria));
  L.PORDER.forEach(r => {
    const ov = C.overviewRow(r);
    add('overview ' + r, [ov.name, ov.count, ov.why, ov.fullLabel, ov.partLabel, ov.none, C.nationalLine(r)]);
  });
  const ft = C.footer(D, (D.config || {}).site);
  add('footer', [ft.baseline, ft.source, ft.updated, ft.disclaimer, ft.links, ft.by, ft.method, ft.glossaryHeading, ft.live]);
  add('footer stale', C.staleLine({ nextUpdate: '2027-01-15' }, '2027-02-01'));
  C.glossary().forEach(g => add('glossary ' + g.key, g.term + ': ' + g.def));
  const off = C.offline(); add('offline', [off.heading, off.message, off.linkText]);
  add('preview bar', C.previewBar(D.updated));
  C.controls(L.CASE_DEF).forEach(g => add('controls ' + g.ctl, [g.label].concat(g.options.map(x => x.text + (x.aria !== x.text ? ' (' + x.aria + ')' : '')))));
  C.controls(L.CASE_DEF, 'District of Columbia').forEach(g => add('controls DC ' + g.ctl, g.options.filter(x => !x.hidden).map(x => x.text)));

  L.states().forEach(st => {
    const P = st + ' |';
    add(P + ' tile', C.tileLabel(st));
    add(P + ' say', C.sayState(st));
    add(P + ' summary', C.summary(st));
    add(P + ' meter', [C.meterLabel(st), C.meterAria(st)]);
    C.meterItems(st).forEach(m => add(P + ' meter ' + m.rule, m.label));
    addCard(P + ' ban card', C.banCard(st));
    addCard(P + ' zero card', C.zeroCard(st));
    L.PORDER.forEach(r => {
      const row = C.row(st, r), W = P + ' row ' + r;
      add(W + ' label', row.label);
      add(W + ' tag', [row.tag.text, row.unclear && row.unclear.text]);
      add(W + ' why', row.why);
      add(W + ' catch', row.catchText);
      add(W + ' unclear', row.unclearText);
      add(W + ' no', row.noText);
      add(W + ' bill note', row.billNotes);
      add(W + ' national', row.national);
      row.laws.forEach((l, i) => addCard(W + ' law' + (i + 1), l));
    });
    addCard(P + ' other laws', C.otherCard(st));
    add(P + ' bills', C.billsHeading(st));
    L.sessionBills(st).forEach(b => {
      const k = C.billCard(b);
      add(P + ' bill ' + k.name, [k.line, k.tag.text, k.linkAria].concat(k.chips.map(c => c.aria)));
    });
    SETUPS.forEach(ctx => {
      const S = P + ' case ' + [ctx.who, ctx.src, ctx.db, ctx.crime].join('/');
      const c = L.computeCase(st, ctx);
      add(S + ' question', C.question(st, ctx));
      add(S + ' note', C.caseNote(st, ctx));
      c.steps.forEach((s, i) => {
        const tag = C.stepTag(C.stepAgg(c, s, ctx, st));
        add(S + ' step' + (i + 1) + ' head' + (tag ? ' [' + tag.text + (tag.note ? ' · ' + tag.note : '') + ']' : ''), C.stepHead(st, c, s, ctx));
        add(S + ' step' + (i + 1) + ' aria', C.stepAria(st, c, s, ctx));
        C.stepLines(st, c, s, ctx).forEach(l => add(S + ' step' + (i + 1) + ' line: ' + l.label + ' [' + (l.tag ? l.tag.text : '') + ']', l.text));
      });
      add(S + ' result', [C.resultStamp(c), C.resultSentence(st, c, ctx), C.tallyLabels(L.tally(c), c, ctx).aria, C.sayCase(st, c)]);
    });
  });

  examples.forEach(ex => {
    const c = L.computeCase(ex.state, ex), card = C.exampleCard(ex), co = C.lessonCallout(ex, c);
    add('example ' + ex.id, [card.title, card.lesson, card.aria, co.label, co.outcome]);
  });
  // Every ban or pause state, as an example would show it (the built-in examples have none).
  L.states().filter(st => L.groupOf(st) === 'ban').forEach(st => {
    const c = L.computeCase(st, L.CASE_DEF);
    add('example-style ' + st, C.exampleOutcome(c));
  });
  return out;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const di = args.indexOf('--data');
  let rows;
  try {
    rows = collect({ data: di >= 0 ? args[di + 1] : null, bare: args.includes('--bare') });
  } catch (e) {
    console.error('copy-dump failed: ' + (e && e.stack || e));
    process.exit(1);
  }
  const dir = path.join(FV, 'qa/out');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'copy-dump.txt'), rows.map(r => r.where + '\t' + r.text).join('\n') + '\n');
  const uniq = new Set(rows.map(r => r.text)).size;
  console.log(`COPY-DUMP: ${rows.length} lines (${uniq} distinct) for 51 states × ${SETUPS.length} case setups → qa/out/copy-dump.txt`);
}

module.exports = { collect, SETUPS };
