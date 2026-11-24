/* Face Value play: every sentence the page shows (FVCopy). Pure: no window, document, storage, fetch or clock.
   FVCopy.create(L, W) takes the logic object from FVLogic.create(D) and a word function W(key, vars).
   It returns C, whose builders take logic results and return plain strings (the UI escapes them) or small
   objects of plain strings. Nothing here returns HTML. All English lives in play/words.js (and the Sheet);
   this file only picks keys and fills them in. The full API is in face-value-handoff/copy-api.md.

   Also exported:
     FVCopy.merge(words, protWhy, config) -> flat {key: text}, the documented merge order (contract §3).
     FVCopy.wordFn(map) -> W(key, vars), with unknown placeholders left as they are. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.FVCopy = f(); })(this, function () {
  'use strict';

  const str = s => (s == null ? '' : String(s));
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const arr = x => (Array.isArray(x) ? x : []);
  const slug = t => str(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fmt = (t, vars) => str(t).replace(/\{([A-Za-z0-9_.]+)\}/g, (m, k) =>
    vars && Object.prototype.hasOwnProperty.call(vars, k) && vars[k] != null ? String(vars[k]) : m);
  // Same as FVKit.shortBill / sessionOf / theState; copied so this file has no load-order dependency.
  const shortBill = name => str(name).replace(/\s*\([^()]*\)\s*$/, '').trim() || str(name).trim();
  const sessionOf = name => {
    const m = /\(([^()]*)\)\s*$/.exec(str(name)); if (!m) return '';
    const y = m[1].match(/\b(?:19|20)\d{2}(?:-\d{2,4})?\b/g);
    return y ? y[y.length - 1] : '';
  };
  const theState = (name, cap) => (str(name) === 'District of Columbia' ? (cap ? 'The' : 'the') + ' District of Columbia' : str(name));
  const safeUrl = u => (/^https?:\/\//i.test(str(u).trim()) ? str(u).trim() : '');
  const cap1 = t => str(t).replace(/^./, c => c.toUpperCase());
  // Straight quotes and apostrophes in Sheet text become curly ones, so they match the built-in words.
  // Double quotes follow FVKit.curly; a single quote after a space or bracket opens, every other one is an apostrophe.
  const curly = t => str(t).replace(/"([^"]*)"/g, '\u201c$1\u201d').replace(/^"/, '\u201c').replace(/"/g, '\u201d')
    .replace(/(^|[\s(\[\u201c])'/g, '$1\u2018').replace(/'/g, '\u2019');
  const isUrlKey = k => /(url|Url)$/.test(str(k).split('.').pop());

  /* ---------- the word map ---------- */
  // Built-ins, then config.words (non-empty strings only), then the other Sheet tabs, which own their keys.
  function merge(words, protWhy, config) {
    const out = Object.assign({}, isObj(words) ? words : {});
    const C = isObj(config) ? config : {};
    const put = (k, v) => { if (typeof v === 'string' && v.trim()) out[k] = isUrlKey(k) ? v : curly(v); };
    if (isObj(protWhy)) Object.keys(protWhy).forEach(k => put('prot.' + k + '.why', protWhy[k]));
    if (isObj(C.words)) Object.keys(C.words).forEach(k => put(k, C.words[k]));
    if (isObj(C.prot)) Object.keys(C.prot).forEach(k => {
      const p = C.prot[k]; if (!isObj(p)) return;
      put('prot.' + k + '.short', p.short); put('prot.' + k + '.long', p.long); put('prot.' + k + '.why', p.why);
    });
    if (isObj(C.limits)) Object.keys(C.limits).forEach(k => { const v = C.limits[k]; put('limit.' + slug(k), isObj(v) ? v.text : v); });
    if (isObj(C.billSteps)) Object.keys(C.billSteps).forEach(k => put('billStep.' + slug(k), C.billSteps[k]));
    if (isObj(C.lawStatus)) Object.keys(C.lawStatus).forEach(k => put('lawStatus.' + slug(k), C.lawStatus[k]));
    if (isObj(C.glossary)) Object.keys(C.glossary).forEach(k => {
      const g = C.glossary[k]; if (!isObj(g)) return;
      put('gloss.' + slug(k) + '.term', g.term); put('gloss.' + slug(k) + '.def', g.def);
    });
    if (isObj(C.why)) Object.keys(C.why).forEach(k => put('why.' + k, C.why[k]));
    return out;
  }
  // W(key, vars): the word with fill-ins. A missing key returns ''. W.has(key) and W.keys() help callers.
  function wordFn(map) {
    const m = isObj(map) ? map : {};
    const W = (key, vars) => (Object.prototype.hasOwnProperty.call(m, key) ? fmt(m[key], vars) : '');
    W.has = key => Object.prototype.hasOwnProperty.call(m, key) && str(m[key]) !== '';
    W.keys = () => Object.keys(m);
    return W;
  }

  // Legacy codes -> the new address values, which are also the word-key suffixes.
  const NEW = {
    who: { local: 'local', state: 'state' },
    src: { photo: 'still', cctv: 'camera', drone: 'drone', bodycam: 'bodycam' },
    db: { dmv: 'licenses', mug: 'mugshots' },
    crime: { serious: 'robbery', minor: 'shoplifting' }
  };
  const CTL = [['police', 'who'], ['photo', 'src'], ['search', 'db'], ['crime', 'crime']];
  const PORDER0 = ['3', '1', '6', '5', '7', '4', '2'];
  const STEPKEYS = ['crime', 'approval', 'search', 'arrest', 'disclose', 'trial'];

  function create(L, Wfn) {
    L = L || {};
    const W0 = typeof Wfn === 'function' ? Wfn : () => '';
    // A word, or '' when the key is missing (or W echoes the key back).
    const w = (key, vars) => { const t = W0(key, vars); return t == null || t === key ? '' : str(t); };
    const has = key => w(key) !== '';
    const PORDER = arr(L.PORDER).length ? L.PORDER : PORDER0;
    const fn = (name, fb) => (typeof L[name] === 'function' ? L[name] : fb);

    const stateProt = fn('stateProt', () => ({ level: 'no', laws: [], review: false, reviewNote: null }));
    const groupOf = fn('groupOf', () => 'none');
    const banOf = fn('banOf', () => null);
    const protCount = fn('protCount', st => PORDER.filter(r => stateProt(st, r).level !== 'no').length);
    const fullCount = fn('fullCount', st => PORDER.filter(r => stateProt(st, r).level === 'yes').length);
    const limitsOf = fn('limitsOf', () => []);
    const catchOf = fn('catchOf', () => []);
    const billNote = fn('billNote', () => []);
    const billImpact = fn('billImpact', () => []);
    const sessionBills = fn('sessionBills', () => []);
    const otherLawsOf = fn('otherLawsOf', () => []);
    const otherLaws = fn('otherLaws', () => []);
    const nationalProt = fn('nationalProt', () => ({ yes: [], part: [] }));
    const banGap = fn('banGap', () => null);
    const states = fn('states', () => []);
    const mapLevel = fn('mapLevel', () => 'l0');

    /* ---------- small helpers ---------- */
    const sv = (state, extra) => Object.assign({ state: str(state), theState: theState(state, false), TheState: theState(state, true) }, extra || {});
    const plural = (base, n, vars) => w(base + (n === 1 ? '.one' : '.other'), Object.assign({ n }, vars || {}));
    const join = list => {
      const xs = arr(list).map(str).filter(Boolean);
      if (xs.length < 2) return xs[0] || '';
      if (xs.length === 2) return w('join.two', { a: xs[0], b: xs[1] });
      return w('join.many', { list: xs.slice(0, -1).join(', '), last: xs[xs.length - 1] });
    };
    const statesCount = n => plural('count.states', n);
    const protName = rule => w('prot.' + rule + '.short') || ('#' + rule);
    const protLong = rule => w('prot.' + rule + '.long');
    const protWhy = rule => w('prot.' + rule + '.why');
    const limitText = code => w('limit.' + slug(code)) || w('catch.unknown', { code: str(code) });
    // Who words. A code with no word (bad data) reads "some agencies" / "some police", never the raw code.
    const uniq = xs => [...new Set(xs)];
    const whoForText = who => join(uniq(arr(who).map(x => w('whoFor.' + x) || w('whoFor.other'))));
    // Police a ban covers: both kinds read as "all police".
    const policeText = who => {
      const xs = arr(who);
      if (xs.includes('local') && xs.includes('state')) return w('police.all');
      return join(uniq(xs.map(x => w('police.' + x) || w('police.other'))));
    };
    const banAll = ban => arr(ban && ban.who).includes('local') && arr(ban && ban.who).includes('state');
    // A ban that covers only some police uses the ".some" form of a key, with {who}.
    const banKey = (key, law) => (banAll(law && law.ban) ? key : key + '.some');
    const isPause = law => /pause|moratorium/i.test(str(law && law.ban && law.ban.kind));
    // "ban" or "pause", from words.js (the data's own kind word only decides which one).
    const kindWord = law => w(isPause(law) ? 'kind.pause' : 'kind.ban');
    const kindVars = law => ({ Kind: cap1(kindWord(law)), kind: kindWord(law), who: policeText(law && law.ban && law.ban.who) });
    // A photo-source code (legacy: photo, cctv, drone, bodycam) as a catch phrase.
    const srcCatch = src => w('catch.src.' + (NEW.src[src] || src)) || w('catch.unknown', { code: str(src) });
    // One limit from L.limitsOf / L.catchOf as a phrase that starts with "it".
    const catchPhrase = c => {
      if (!c) return '';
      if (c.kind === 'limit') return limitText(c.code);
      if (c.kind === 'source') return srcCatch(c.src);
      if (c.kind === 'db') return w('catch.db');
      if (c.kind === 'who') return w('catch.who', { who: whoForText(c.who) });
      return '';
    };
    const catchSentence = list => { const ps = arr(list).map(catchPhrase).filter(Boolean); return ps.length ? w('row.catch', { limits: join(ps) }) : ''; };
    const lawStatusText = law => { const s = str(law && law.status).replace(/\s*\(.*$/, ''); return w('lawStatus.' + slug(s)) || s; };
    const stepShort = key => w('step.' + key + '.short') || str(key);
    // With the case and the step: a ban or pause that stops the search at this step uses the step's ".ban" title
    // when it has one ("Can police use it at all?"). With only the key, the plain title.
    // A step where a ban or pause acts (it stopped the search, or it may cover these police: Virginia state police) gets the ban title.
    const stepTitle = (key, c, step, state, ctx) => (c && step && ((step.agg === 'stop' && c.why && c.why.kind === 'ban') || (state && gapUnclear(state, c, step, ctx))) && w('step.' + key + '.title.ban'))
      || w('step.' + key + '.title') || str(key);
    // A law's research flag covers this rule: its reviewRules when given, else every rule it adds (same test as L.stateProt).
    const flagFor = (law, rule) => !!law && !!law.review &&
      arr(Array.isArray(law.reviewRules) ? law.reviewRules : law.rules).map(String).includes(String(rule));

    /* ---------- dates ---------- */
    // "2026-11-18T22:14:41Z" or "2026-11-18" -> "Nov. 18, 2026". Read from the string, so no time zone shifts.
    function dateText(iso) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(iso));
      if (!m) return str(iso);
      const months = w('date.months').split('|');
      const mo = months[+m[2] - 1] || m[2];
      return w('date.format', { month: mo, day: String(+m[3]), year: m[1] });
    }

    /* ---------- map ---------- */
    function tileLabel(state) {
      const g = groupOf(state), v = sv(state);
      if (g === 'none') return w('tile.none', v);
      if (g === 'zero') return w('tile.zero', v);
      if (g === 'ban') { const law = banOf(state); return w(banKey(isPause(law) ? 'tile.pause' : 'tile.ban', law), sv(state, kindVars(law))); }
      return plural('tile.rules', protCount(state), v);
    }
    // States with a map tile. An extra place (no L.ABBR / L.POS tile) sits in the dropdown only, so the legend
    // and the no-law count leave it out. L.counts keeps every place (app.js parity).
    const hasTile = s => !L.ABBR || !L.POS || !!(L.ABBR[s] && L.POS[L.ABBR[s]]);
    const tileStates = () => arr(states()).filter(hasTile);
    // Legend chips in display order, with live counts (tiles only).
    function legend() {
      const n = {}; tileStates().forEach(s => { const t = mapLevel(s); n[t] = (n[t] || 0) + 1; });
      return ['l4', 'l3', 'l2', 'l1', 'lb', 'lz', 'l0'].map(tier => {
        const label = w('map.legend.' + tier);
        return { tier, label, n: n[tier] || 0, aria: w('map.legend.aria', { label, n: n[tier] || 0 }) };
      });
    }

    /* ---------- panel head ---------- */
    function summary(state) {
      const g = groupOf(state), v = sv(state);
      if (g === 'none') return w('sum.none', v);
      if (g === 'zero') return w('sum.zero', v);
      const n = protCount(state);
      if (g === 'ban') {
        const law = banOf(state), b = law && law.ban;
        const key = (isPause(law) ? 'sum.pause' : 'sum.ban') + (banAll(b) ? '.all' : '');
        const first = w(key, sv(state, { who: policeText(b && b.who) }));
        return n ? first + ' ' + plural('sum.banPlus', n) : first;
      }
      const full = fullCount(state), part = n - full;
      if (full === 7) return w('sum.rules.all', v);
      if (!part) return plural('sum.rules.full', n, v);
      if (!full) return plural('sum.rules.part', n, v);
      return w('sum.rules.mixed', sv(state, { n, full, part }));
    }
    function meterLabel(state) {
      if (groupOf(state) === 'ban') { const law = banOf(state); return w(banKey('meter.ban', law), kindVars(law)); }
      return w('meter.label', { n: protCount(state) });
    }
    // One entry per shield, in PORDER: {rule, level, ban, label}. label is the tooltip and screen-reader line.
    function meterItems(state) {
      const ban = groupOf(state) === 'ban' ? banOf(state) : null;
      return PORDER.map(rule => {
        const sp = stateProt(state, rule), byBan = !!ban && sp.level === 'no';
        const status = byBan ? w(banKey('tag.banCovers', ban), kindVars(ban)) : w('tag.' + sp.level);
        return { rule, level: sp.level, ban: byBan, label: w('meter.item', { name: protName(rule), status }) };
      });
    }
    const meterAria = state => w('meter.aria', sv(state));

    /* ---------- scorecard rows ---------- */
    // {cls, text}: the row's status tag. Unclear shows as a second tag (see rowUnclear).
    function rowTag(state, rule) {
      const sp = stateProt(state, rule);
      if (sp.level === 'no' && groupOf(state) === 'ban') { const law = banOf(state); return { cls: 't-ban', text: w(banKey('tag.banCovers', law), kindVars(law)) }; }
      return { cls: sp.level === 'yes' ? 't-yes' : sp.level === 'part' ? 't-part' : 't-no', text: w('tag.' + sp.level) };
    }
    function rowLabel(state, rule) {
      const sp = stateProt(state, rule);
      return w(sp.review ? 'row.nameUnclear' : 'row.name', { name: protName(rule), status: rowTag(state, rule).text });
    }
    const rowWhy = rule => protWhy(rule);
    // "The catch: …" for a Partly row, from every limit of every law that adds the rule. '' otherwise.
    const rowCatch = (state, rule) => (stateProt(state, rule).level === 'part' ? catchSentence(catchOf(state, rule)) : '');
    // The reused unclear sentence, plus what our research flagged. '' when the row is not flagged.
    function rowUnclear(state, rule) {
      const sp = stateProt(state, rule);
      if (!sp.review) return '';
      return sp.reviewNote ? w('row.unsettled') + ' ' + w('row.unclearWhy') + ' ' + str(sp.reviewNote) : w('row.unsettled');
    }
    // For a No row: the reused sentence ("No Ohio law adds this protection."), with the ban note in a ban or
    // pause state. The Fourth Amendment point lives once, in the footer (foot.baseline). '' for other rows.
    function rowNo(state, rule) {
      if (stateProt(state, rule).level !== 'no') return '';
      if (groupOf(state) !== 'ban') return w('row.no', sv(state));
      // A ban with exceptions (its own except text, or laws that carve out exceptions) says so.
      const law = banOf(state), b = (law && law.ban) || {};
      const exc = str(b.except).trim() || arr(otherLawsOf(state)).some(l => l.banException);
      return w(exc && has('row.no.banExcept') ? 'row.no.banExcept' : 'row.no.ban', sv(state, kindVars(law)));
    }
    // One bill note. Bills still alive read "would add this"; bills whose session is over (pending false)
    // read "tried to add this … did not become law". A note that mixes both gives two sentences.
    function billNoteText(note) {
      if (!note || !arr(note.bills).length) return '';
      const one = (bills, over) => {
        if (!bills.length) return '';
        const sessions = [...new Set(bills.map(b => sessionOf(b.name) || str(b.year)).filter(Boolean))];
        return plural('bill.' + note.kind + (over ? 'Over' : ''), bills.length, { session: join(sessions), bills: bills.map(b => shortBill(b.name)).join(', ') });
      };
      return [one(note.bills.filter(b => b && b.pending), false), one(note.bills.filter(b => !(b && b.pending)), true)].filter(Boolean).join(' ');
    }
    const rowBillNotes = (state, rule) => arr(billNote(state, rule)).map(billNoteText).filter(Boolean);
    function nationalLine(rule) {
      const np = nationalProt(rule), y = arr(np.yes).length, p = arr(np.part).length;
      if (y && p) return w('row.nat.both', { yes: statesCount(y), part: statesCount(p) });
      if (y) return w('row.nat.full', { yes: statesCount(y) });
      if (p) return w('row.nat.part', { part: statesCount(p) });
      return w('row.nat.none');
    }
    // Everything a scorecard row shows, in one object.
    function row(state, rule) {
      const sp = stateProt(state, rule);
      return {
        rule, level: sp.level, name: protName(rule), tag: rowTag(state, rule), label: rowLabel(state, rule),
        unclear: sp.review ? { cls: 't-unclear', text: w('tag.unclear') } : null, unclearText: rowUnclear(state, rule),
        why: rowWhy(rule), catchText: rowCatch(state, rule), noText: rowNo(state, rule), billNotes: rowBillNotes(state, rule),
        laws: sp.laws.map(l => lawCard(l, rule)), national: nationalLine(rule),
        hasFullLabel: sp.level === 'no' ? w('row.hasFull') : '', hasFull: sp.level === 'no' ? arr(nationalProt(rule).yes) : []
      };
    }
    function overviewRow(rule) {
      const np = nationalProt(rule), yes = arr(np.yes), part = arr(np.part), n = yes.length + part.length;
      return {
        rule, name: protName(rule), long: protLong(rule), why: protWhy(rule),
        count: n ? plural('ov.count', n) : w('ov.count.zero'),
        fullLabel: yes.length ? w('ov.full') : '', partLabel: part.length ? w('ov.part') : '', none: n ? '' : w('ov.none'),
        yes, part
      };
    }

    /* ---------- law cards ---------- */
    // Plain strings for one law. rule (optional) adds the catch for that protection.
    // With a rule, the Unclear tag shows only when the law's flag covers that rule. A flag that covers none of its
    // rules (reviewRules []) is a note on a part we did not count, so it shows as that plain note.
    function lawCard(law, rule) {
      const l = law || {}, link = safeUrl(l.link);
      // Status and year joined only when both are there, so a blank one leaves no lone separator.
      const st = lawStatusText(l), yr = str(l.year).trim();
      const flag = rule ? flagFor(l, rule) : !!l.review;
      const leftOut = !!rule && !!l.review && Array.isArray(l.reviewRules) && !l.reviewRules.length && !!l.reviewNote;
      return {
        name: str(l.name), meta: st && yr ? w('law.meta', { status: st, year: yr }) : st || yr, status: st,
        does: str(l.does), note: str(l.note),
        catchText: rule ? catchSentence(limitsOf(l, rule)) : '',
        unclear: flag ? { cls: 't-unclear', text: w('tag.unclear') } : null,
        unclearText: flag ? (l.reviewNote ? w('row.unsettled') + ' ' + w('row.unclearWhy') + ' ' + str(l.reviewNote) : w('row.unsettled')) : '',
        whyLabel: leftOut ? w('law.leftOut') : '', why: leftOut ? str(l.reviewNote) : '',
        citeLabel: w('law.cite'), cite: str(l.cite),
        link, linkText: link ? w('law.readLaw') : '', linkAria: link ? w('law.readLawAria', { name: str(l.name) }) + ' ' + w('a11y.newTab') : '',
        noQuote: w(link ? 'law.noQuote' : 'law.noQuote.noLink')
      };
    }
    function banCard(state) {
      if (groupOf(state) !== 'ban') return null;
      const law = banOf(state); if (!law) return null;
      const b = law.ban || {}, kv = kindVars(law), card = lawCard(law);
      const exc = arr(otherLawsOf(state)).filter(l => l.banException);
      return Object.assign(card, {
        kind: kv.Kind, tag: { cls: 't-ban', text: kv.Kind }, heading: w(banKey('ban.heading', law), kv),
        covers: w('ban.covers', { who: policeText(b.who) }), text: str(b.text), except: str(b.except),
        exceptionsHeading: exc.length ? w('ban.exceptions') : '', exceptions: exc.map(l => lawCard(l))
      });
    }
    // A law that adds none of the 7: its research note explains why it does not count, so it shows once,
    // under "Why it doesn't count:", and the card carries no Unclear tag or unsettled sentence.
    const notCountedCard = l => Object.assign(lawCard(l), {
      unclear: null, unclearText: '', whyLabel: l.reviewNote ? w('law.notCounted') : '', why: str(l.reviewNote)
    });
    function zeroCard(state) {
      if (groupOf(state) !== 'zero') return null;
      return { heading: w('zero.heading'), laws: otherLawsOf(state).map(notCountedCard) };
    }
    // The "Other laws" disclosure (not used in zero states, whose laws are already in the zero card).
    function otherCard(state) {
      if (groupOf(state) === 'zero') return null;
      const laws = otherLawsOf(state).filter(l => !l.banException || groupOf(state) !== 'ban');
      if (!laws.length) return null;
      return {
        heading: plural('other.heading', laws.length, sv(state)), intro: plural('other.intro', laws.length),
        laws: laws.map(notCountedCard)
      };
    }

    /* ---------- bills ---------- */
    const session = () => str(L.LAST && L.LAST !== '-Infinity' ? L.LAST : '');
    function billsHeading(state) {
      const n = arr(sessionBills(state)).length;
      return n ? w('bills.heading', { session: session(), n }) : noBills();
    }
    const noBills = () => (session() ? w('bills.none', { session: session() }) : w('bills.noneAny'));
    const billsNone = state => (arr(sessionBills(state)).length ? '' : noBills());
    const billStepText = b => w('billStep.' + slug(b && b.step)) || str(b && b.step);
    const billLine = b => w('bills.line', { bill: shortBill(b && b.name), year: sessionOf(b && b.name) || str(b && b.year), step: billStepText(b) });
    function billImpactChips(b) {
      const list = arr(billImpact(b));
      if (!list.length) return [{ kind: 'none', sym: '', text: w('impact.none'), aria: w('impact.none') }];
      const order = ['loose', 'add', 'addPart', 'up', 'same', 'have'], SYM = { add: '+', addPart: '+', up: '↑', same: '=', have: '=', loose: '!' };
      // A bill that adds a protection with a limit adds only part of it (same rule as L.billNote's addPart).
      const kindOf = x => (x.kind === 'add' && x.limit ? 'addPart' : x.kind);
      return list.map(x => Object.assign({}, x, { kind: kindOf(x) })).sort((a, c) => order.indexOf(a.kind) - order.indexOf(c.kind)).map(x => {
        const kind = w('impact.' + x.kind), name = protName(x.rule);
        return { kind: x.kind, rule: x.rule, sym: SYM[x.kind] || '', label: kind, text: name, aria: w('impact.aria', { kind, name }) };
      });
    }
    function billCard(b) {
      const link = safeUrl(b && b.link);
      return {
        name: shortBill(b && b.name), fullName: str(b && b.name), line: billLine(b),
        tag: b && b.pending ? { cls: 't-alive', text: w('bills.alive') } : { cls: 't-over', text: w('bills.over') },
        does: str(b && b.does), chips: billImpactChips(b),
        link, linkText: link ? w('bills.text') : '', linkAria: link ? w('bills.textAria', { bill: shortBill(b.name) }) + ' ' + w('a11y.newTab') : ''
      };
    }

    /* ---------- case: controls, question, notes ---------- */
    // DC has no state police. Its "State" chip is marked hidden (the UI leaves it out), and the question
    // names DC's police with q.police.dc whichever police code the address carries.
    const isDC = state => str(state) === 'District of Columbia';
    function controls(ctx, state) {
      const c = ctx || {};
      return CTL.map(([ctl, code]) => ({
        ctl, label: w('ctl.' + ctl),
        options: Object.keys(NEW[code]).map(k => {
          const val = NEW[code][k], text = w('ctl.' + ctl + '.' + val);
          const o = { val, code: k, text, aria: w('ctl.' + ctl + '.' + val + '.aria') || text, pressed: c[code] === k };
          if (code === 'who' && k === 'state' && isDC(state)) o.hidden = true;
          return o;
        })
      }));
    }
    const qWord = (ctl, code, val) => w('q.' + ctl + '.' + (NEW[code][val] || val));
    const qPolice = (state, who) => (isDC(state) && has('q.police.dc') ? w('q.police.dc') : qWord('police', 'who', who || 'local'));
    function question(state, ctx) {
      const c = ctx || {};
      return w('case.question', sv(state, {
        who: qPolice(state, c.who), photo: qWord('photo', 'src', c.src || 'photo'),
        crime: qWord('crime', 'crime', c.crime || 'serious'), search: qWord('search', 'db', c.db || 'dmv')
      }));
    }
    function banGapNote(state, ctx) {
      const law = banGap(state, ctx); if (!law) return '';
      // A ban flagged for review (Virginia: State Police not settled) gets the hedged sentence. The research
      // note itself stays on the ban card, so it is not repeated here.
      const v = sv(state, Object.assign(kindVars(law), { banWho: policeText(law.ban.who), who: qPolice(state, (ctx || {}).who) }));
      return w(law.review ? 'case.banGap.unclear' : 'case.banGap', v);
    }
    const noLawNote = state => (groupOf(state) === 'none' ? w('case.noLaw', sv(state)) : '');
    const zeroLawNote = state => (groupOf(state) === 'zero' ? w('case.zeroLaw', sv(state)) : '');
    // The one note shown above the timeline, or ''.
    const caseNote = (state, ctx) => banGapNote(state, ctx) || noLawNote(state) || zeroLawNote(state);

    /* ---------- case: steps ---------- */
    const AGG = {
      covered: ['t-yes', 'tag.yes'], stop: ['t-stop', 'tag.stop'], mixed: ['t-part', 'tag.part'], partial: ['t-part', 'tag.part'],
      would: ['t-yes', 'tag.yes'], review: ['t-unclear', 'tag.unclear'], bypassed: ['t-no', 'tag.no'], gap: ['t-no', 'tag.no'],
      skip: ['t-skip', 'tag.skip'], na: ['t-na', 'tag.na']
    };
    // {cls, text, note} for a step's agg (or one line's status). null for the result step.
    function stepTag(agg) {
      const a = AGG[agg]; if (!a) return null;
      return { cls: a[0], text: w(a[1]), note: agg === 'bypassed' ? w('tag.reach') : '' };
    }
    const stepNo = (c, step) => arr(c && c.steps).indexOf(step) + 1 || STEPKEYS.indexOf(step && step.key) + 1;
    const sameLaw = (a, b) => !!a && !!b && (a === b || (a.state === b.state && a.name === b.name));

    /* A "Partly" line whose catch cannot reach this case reads as "doesn't reach" (a copy-level fix; logic.js keeps
       app.js parity). Today: a live-scanning-only or surveillance-video-only limit, when the case uses one still photo.
       The still photo is read from ctx when given, else from the case itself (rule 6 is 'na' only for a still photo). */
    const MISS_ON_STILL = ['real-time only', 'biometric surveillance'];
    const isStill = (c, ctx) => (ctx && ctx.src ? ctx.src === 'photo'
      : arr(c && c.steps).some(s => arr(s.results).some(r => r.rule === '6' && r.status === 'na')));
    const misses = (h, c, ctx) => h && h.kind === 'partial' && isStill(c, ctx) && MISS_ON_STILL.includes(str(h.limit).toLowerCase())
      && (typeof L.limitType !== 'function' || L.limitType(h.limit) === 'narrow');
    /* A Yes or Partly line that rests only on laws flagged unclear for this rule (NH HB 1688, reviewRules 1 and 6)
       reads as Unclear, so the case matches the scorecard's "Partly, unclear" and the tally counts it as Partly.
       logic.js keeps app.js parity, so this is done here. */
    // {status, limit, base, flag}: the line's status after both fixes. limit is the code of the catch that misses, or null.
    // base is the status before the unclear fix and flag is the flagged law, when that fix applied.
    function lineStatus(r, c, ctx) {
      if (!r) return { status: '', limit: null, base: '', flag: null };
      let st = r.status, limit = null;
      const parts = arr(r.hits).filter(h => h.kind === 'partial');
      if (st === 'partial' && parts.length && parts.every(h => misses(h, c, ctx))) {
        st = arr(r.hits).some(h => h.kind === 'review') ? 'review' : 'bypassed'; limit = parts[0].limit;
      }
      const win = st === 'covered' || st === 'partial' ? arr(r.hits).filter(h => h.kind === st) : [];
      if (win.length && win.every(h => flagFor(h.law, r.rule))) return { status: 'review', limit, base: st, flag: win[0].law };
      return { status: st, limit, base: st, flag: null };
    }
    // A ban flagged for review that may not cover these police (Virginia, state police): the law, at step 1 only.
    function gapUnclear(state, c, step, ctx) {
      if (!state || !step || stepNo(c, step) !== 1) return null;
      const law = banGap(state, ctx);
      return law && law.review ? law : null;
    }
    // The step's agg after the fix above. Same rules as logic.computeCase; unchanged when no line changed.
    // With the state (optional), step 1 of a flagged ban-gap case reads 'review', since the ban may still cover
    // these police. Its lines, the later steps and the tally stay as logic.js gives them.
    function stepAgg(c, step, ctx, state) {
      if (!step) return '';
      const a = step.agg;
      if (step.key === 'trial' || a === 'stop' || a === 'skip' || a === 'none') return a;
      if (gapUnclear(state, c, step, ctx)) return 'review';
      const rs = arr(step.results);
      if (!rs.some(r => lineStatus(r, c, ctx).status !== r.status)) return a;
      const st = rs.map(r => lineStatus(r, c, ctx).status).filter(x => x !== 'na');
      return !st.length ? 'none'
        : st.every(x => x === 'covered') ? 'covered'
        : st.every(x => x === 'covered' || x === 'would') ? 'would'
        : st.some(x => x === 'covered' || x === 'would') && !st.some(x => x === 'partial' || x === 'review') ? 'mixed'
        : st.some(x => ['covered', 'partial', 'would'].includes(x)) ? 'partial'
        : st.includes('review') ? 'review'
        : st.includes('bypassed') ? 'bypassed' : 'gap';
    }
    // L.tally(c) with the same fixes applied, so the tally matches the lines the reader sees.
    const BUCKET = { covered: 'got', would: 'got', partial: 'soft', review: 'soft', bypassed: 'bypassed', gap: 'gap' };
    function tallyOf(c, ctx) {
      const t = Object.assign({ got: 0, soft: 0, bypassed: 0, gap: 0, total: 0 }, typeof L.tally === 'function' ? L.tally(c) : {});
      arr(c && c.steps).forEach(s => {
        if (s.agg === 'skip') return;
        arr(s.results).forEach(r => {
          const ls = lineStatus(r, c, ctx);
          if (ls.status === r.status) return;
          const from = BUCKET[r.status], to = BUCKET[ls.status];
          if (from) t[from]--; if (to) t[to]++;
        });
      });
      return t;
    }
    const banStop = c => !!(c && c.why && c.why.kind === 'ban');

    function stepHead(state, c, step, ctx) {
      if (!step) return '';
      if (step.key === 'trial') return resultStamp(c);
      const v = sv(state);
      switch (stepAgg(c, step, ctx, state)) {
        case 'skip': return w('never');
        case 'stop': {
          const why = (c && c.why) || {};
          if (why.kind === 'ban') return w(isPause(why.law) ? 'head.stop.pause' : 'head.stop.ban', sv(state, { who: qPolice(state, (ctx || {}).who) }));
          if (why.kind === 'bar') return w('head.stop.bar', v);
          return w('head.stop.crime', v);
        }
        case 'covered': case 'would': return w('head.covered', v);
        case 'mixed': {
          const live = arr(step.results).map(r => lineStatus(r, c, ctx).status).filter(x => x !== 'na');
          return w('head.mixed', sv(state, { have: live.filter(x => x === 'covered' || x === 'would').length, total: live.length }));
        }
        case 'partial': return w('head.partial', v);
        case 'review': {
          const gap = gapUnclear(state, c, step, ctx);
          if (gap) return w('head.banGap.unclear', sv(state, Object.assign(kindVars(gap), { who: qPolice(state, (ctx || {}).who) })));
          const n = stepSeen(c, step, ctx);
          return n ? w('head.unclearSame', { n }) : w('head.review') + ' ' + w('row.unsettled');
        }
        case 'bypassed': return w('head.bypassed', v);
        default: return w('head.gap', v);
      }
    }
    // Why a law misses this case, rebuilt from the law so the words come from words.js.
    function reasonFor(top, ctx) {
      const law = (top && top.law) || {}, cx = ctx || {}, by = top && top.by;
      if (by === 'source' || (!by && law.source && law.source !== cx.src)) return srcCatch(law.source);
      if (by === 'db' || (!by && law.db && law.db !== cx.db)) return w('catch.db');
      if (by === 'lineup') return w('catch.lineupArrest');
      const wf = arr(law.whoFor);
      if (by === 'who' || (!by && wf.length && !wf.includes('any') && !wf.includes(cx.who))) return w('catch.who', { who: whoForText(top.who || wf) });
      if (top && top.reason) return str(top.reason);
      return w('catch.lineupArrest');
    }
    // A step's results in the order its lines show: the line that stopped the search first.
    function shownResults(c, step) {
      const rs = arr(step && step.results).slice();
      const i = rs.findIndex(r => isStopLine(c, step, r));
      if (i > 0) rs.unshift(rs.splice(i, 1)[0]);
      return rs;
    }
    // A flagged line whose law's research note already showed on an earlier line of this case:
    // {n: that step's number, same: true when it is this step}. null for the first showing or an unflagged line.
    function flagShown(c, step, r, ctx) {
      const law = lineStatus(r, c, ctx).flag; if (!law) return null;
      for (const s of arr(c && c.steps)) {
        if (s.agg === 'skip' || s.key === 'trial' || (s.agg === 'stop' && banStop(c))) continue;
        for (const x of shownResults(c, s)) {
          if (s === step && x === r) return null;
          if (sameLaw(lineStatus(x, c, ctx).flag, law)) return { n: stepNo(c, s), same: s === step };
        }
      }
      return null;
    }
    // When every Unclear line in this step rests on a law already explained at an earlier step: that step's number, else 0.
    function stepSeen(c, step, ctx) {
      const ns = arr(step && step.results).filter(r => lineStatus(r, c, ctx).status === 'review')
        .map(r => { const f = flagShown(c, step, r, ctx); return f && !f.same ? f.n : 0; });
      return ns.length && ns.every(Boolean) ? Math.min(...ns) : 0;
    }
    // A line resting on a flagged law adds the research note, and the unsettled sentence when the step head lacks it.
    // The note shows once per case: a later line on the same law points back to the step that explained it.
    function lineText(state, c, step, r, ctx) {
      const base = baseLineText(state, c, step, r, ctx), ls = lineStatus(r, c, ctx);
      if (!ls.flag) return base;
      const review = stepAgg(c, step, ctx) === 'review', seen = flagShown(c, step, r, ctx);
      if (seen && !seen.same) return review && stepSeen(c, step, ctx) ? base : base + ' ' + w('head.unclearSame', { n: seen.n });
      const note = seen ? '' : str(ls.flag.reviewNote).trim();
      return [base, review ? '' : w('row.unsettled'), note ? w('row.unclearWhy') + ' ' + note : '']
        .filter(Boolean).join(' ');
    }
    function baseLineText(state, c, step, r, ctx) {
      const v = sv(state), cx = ctx || {};
      // A still photo: say the state limits live scanning only when it has the rule in full; a narrow rule says "some".
      if (r.status === 'na') {
        const lv = stateProt(state, r.rule).level;
        return w(!r.has ? 'line.na' : lv === 'yes' ? 'line.na.has' : 'line.na.part', v);
      }
      const ls = lineStatus(r, c, ctx);
      if (ls.limit) return ls.status === 'review' ? w('row.unsettled') : w('line.bypassed', sv(state, { reason: limitText(ls.limit) }));
      const why = (c && c.why) || {};
      if (why.kind === 'bar' && step.agg === 'stop' && r.top && sameLaw(r.top.law, why.law)) return w('line.stop', { text: str(why.text) });
      if (r.status === 'covered' || r.status === 'would') {
        if (r.rule === '3') return w(cx.crime === 'minor' ? 'line.stop.crime' : 'line.serious', v);
        if (r.rule === '4') return w(r.at === 'lineup' ? 'line.covered.4.lineup' : 'line.covered.4', v);
        return w('line.covered.' + r.rule, v);
      }
      if (r.status === 'partial') return w('line.partial', sv(state, { limit: limitText(r.top && r.top.limit) }));
      if (r.status === 'review') return w('row.unsettled');
      if (r.status === 'bypassed') return w('line.bypassed', sv(state, { reason: reasonFor(r.top, cx) }));
      return w('line.gap', v);
    }
    // A flagged line keeps its answer in the tag: "Yes, unclear" or "Partly, unclear".
    const lineTag = ls => (ls.flag && AGG[ls.base]
      ? { cls: 't-unclear', text: w('tag.unclearOf', { status: w(AGG[ls.base][1]) }) || w('tag.unclear'), note: '' }
      : stepTag(ls.status));
    const isStopLine = (c, step, r) => step.agg === 'stop' && c && c.why &&
      (c.why.kind === 'crime' ? r.rule === '3' : c.why.kind === 'bar' && r.top && sameLaw(r.top.law, c.why.law));
    // The lines under one step: [{kind, rule, at, label, tag, text, law?}]. kind is 'rule', 'ban', 'other' or 'note'.
    // Skipped steps have no lines (stepHead carries the never-reached sentence). Order follows app.js:766-775.
    function stepLines(state, c, step, ctx) {
      if (!step || step.agg === 'skip' || step.key === 'trial') return [];
      const out = [], cx = ctx || {};
      // A ban or pause stops the search before any rule is checked, so its step shows only the ban line.
      if (step.agg === 'stop' && banStop(c)) {
        const law = c.why.law, b = (law && law.ban) || {};
        return [{ kind: 'ban', rule: null, at: null, label: kindVars(law).Kind, tag: stepTag('stop'),
          text: w('line.stop', { text: [str(c.why.text), str(b.except)].filter(Boolean).join(' ') }), law }];
      }
      const rs = shownResults(c, step);
      const stopIdx = rs.length && isStopLine(c, step, rs[0]) ? 0 : -1;
      const mk = r => {
        const stop = isStopLine(c, step, r);
        return {
          kind: 'rule', rule: r.rule, at: r.at || null,
          label: r.rule === '4' && r.at === 'lineup' ? w('line.lineupLabel') : protName(r.rule),
          tag: stop ? stepTag('stop') : lineTag(lineStatus(r, c, ctx)), text: lineText(state, c, step, r, cx)
        };
      };
      if (rs.length && stopIdx >= 0) out.push(mk(rs.shift()));
      if (step.key === 'search') {
        arr(otherLaws(state, cx)).filter(l => !l.ban || !(c && c.why && sameLaw(c.why.law, l))).forEach(l => {
          out.push({ kind: 'other', rule: null, at: null, label: str(l.name), tag: { cls: 't-na', text: w('tag.other'), note: '' }, text: str(l.does), law: l });
        });
      }
      rs.forEach(r => out.push(mk(r)));
      if (step.key === 'arrest' && !arr(step.results).some(r => r.at === 'lineup')) {
        out.push({ kind: 'note', rule: '4', at: 'lineup', label: w('line.lineupLabel'), tag: { cls: 't-na', text: w('tag.lineupNone'), note: '' }, text: w('line.lineupNone', sv(state)) });
      }
      return out;
    }
    // "Why this step matters" (config.why, legacy Step notes). '' for the result step.
    const stepWhy = key => w('why.' + key);
    // The rule a step's "See the law" link opens. With the case c (and ctx): the rule that stopped the search here,
    // else the first rule that applies to this case. Without c, or when every rule is n/a: the step's first rule.
    function stepOpenRule(step, c, ctx) {
      const first = step && arr(step.checks)[0] && step.checks[0][0];
      if (!step || !c) return first ? str(first) : '';
      const rs = arr(step.results);
      const hit = rs.find(r => isStopLine(c, step, r)) || rs.find(r => lineStatus(r, c, ctx).status !== 'na');
      return hit && hit.rule ? str(hit.rule) : first ? str(first) : '';
    }
    // The scorecard row slug (PSLUG) for that rule, or ''.
    const stepOpen = (step, c, ctx) => { const r = stepOpenRule(step, c, ctx); return r && L.PSLUG ? str(L.PSLUG[r] || '') : ''; };
    function stepAria(state, c, step, ctx) {
      const t = stepTag(stepAgg(c, step, ctx, state));
      const v = { n: stepNo(c, step), total: arr(c && c.steps).length || 6, title: stepTitle(step && step.key, c, step, state, ctx), status: t ? t.text : '' };
      return w(t ? 'step.aria' : 'step.ariaPlain', v);
    }

    /* ---------- case: result ---------- */
    function resultStamp(c) {
      if (c && c.stopAt >= 0) return w('result.stop', { n: c.stopAt + 1 });
      return w('result.through');
    }
    // Another law in the state aimed at this exact photo source or database (NH and Oregon body cameras,
    // Maine license photos). Needs ctx; without it the result keeps the plain line, which is true either way.
    function otherOnCase(state, ctx) {
      if (!ctx) return false;
      const cx = typeof L.normCtx === 'function' ? L.normCtx(ctx) : ctx;
      return arr(otherLaws(state, cx)).some(l => !l.ban && !l.banException && ((l.source && l.source === cx.src) || (l.db && l.db === cx.db)));
    }
    // ctx is optional. With it, the went-through line can point to another law on this kind of search (step 3)
    // and the tally applies the "doesn't reach" fix for any photo source.
    function resultSentence(state, c, ctx) {
      if (c && c.stopAt >= 0) {
        const key = arr(c.steps)[c.stopAt] ? c.steps[c.stopAt].key : STEPKEYS[c.stopAt];
        const why = c.why || {};
        const v = sv(state, Object.assign({ n: c.stopAt + 1, step: stepShort(key) }, why.kind === 'ban' ? kindVars(why.law) : {}));
        const head = why.kind === 'ban' ? w(c.stopAt === 0 ? 'result.stopLine.banStart' : 'result.stopLine.ban', v) : w('result.stopLine', v);
        // A bar's full text already sits on the step line, so the result gives only the head. Ban text stays.
        return why.text && why.kind !== 'bar' ? head + ' ' + str(why.text) : head;
      }
      const t = tallyOf(c, ctx);
      const head = w(otherOnCase(state, ctx) ? 'result.throughOther' : 'result.throughLine', sv(state));
      const tail = !t.total ? w('result.noneApply')
        : plural(t.got ? 'result.got' : t.soft ? 'result.soft' : 'result.noneCovered', t.total, t);
      return head + ' ' + tail;
    }
    // tallyLabels(t, c?, ctx?). Pass c: the tally is then worked out from the case (tallyOf), and a search a ban
    // or pause stopped gets no counts, only {ban:true, line} ("The ban covered this case.").
    function tallyLabels(t, c, ctx) {
      if (banStop(c)) {
        const line = w('tally.ban', kindVars(c.why.law));
        return { ban: true, line, items: [], of: '', aria: line, total: 0 };
      }
      const x = c ? tallyOf(c, ctx) : t || { got: 0, soft: 0, bypassed: 0, gap: 0, total: 0 }, no = (x.bypassed || 0) + (x.gap || 0);
      return {
        ban: false, line: '', total: x.total || 0,
        items: [
          { key: 'got', n: x.got || 0, label: w('tally.got') },
          { key: 'soft', n: x.soft || 0, label: w('tally.soft') },
          { key: 'no', n: no, label: w('tally.no') }
        ],
        of: plural('tally.of', x.total || 0, { total: x.total || 0 }),
        aria: plural('tally.aria', x.total || 0, { got: x.got || 0, soft: x.soft || 0, no, total: x.total || 0 })
      };
    }

    /* ---------- examples ---------- */
    function exampleOutcome(c) {
      if (banStop(c) && c.stopAt === 0) return w('ex.outcome.ban', kindVars(c.why.law));
      if (c && c.stopAt >= 0) {
        const key = arr(c.steps)[c.stopAt] ? c.steps[c.stopAt].key : STEPKEYS[c.stopAt];
        return w('ex.outcome.stop', { n: c.stopAt + 1, step: stepShort(key) });
      }
      return w('ex.outcome.through');
    }
    const firstSentence = t => { const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(str(t).trim()); return m ? m[0] : str(t).trim(); };
    function exampleCard(ex) {
      const e = ex || {}, lesson = str(e.lesson) || firstSentence(e.d);
      return { id: str(e.id), title: str(e.t), lesson, aria: w('ex.cardAria', { title: str(e.t), lesson }) };
    }
    // The callout shown after an example loads: its lesson, and where this case stopped.
    function lessonCallout(ex, c) {
      const e = ex || {};
      return { label: w('case.lessonLabel'), text: str(e.lesson) || firstSentence(e.d), setup: str(e.d), outcome: exampleOutcome(c) };
    }

    /* ---------- footer, glossary, page states, announcements ---------- */
    function glossary() {
      const keys = typeof W0.keys === 'function' ? W0.keys() : [];
      const ids = [...new Set(keys.filter(k => /^gloss\.[^.]+\.term$/.test(k)).map(k => k.split('.')[1]))].filter(k => k !== 'federal-agent');
      return ids.map(k => ({ key: k, term: w('gloss.' + k + '.term'), def: w('gloss.' + k + '.def') })).filter(g => g.term && g.def);
    }
    function footer(D, site) {
      const d = D || {}, s = site || ((d.config || {}).site) || {};
      const methodUrl = safeUrl(w('foot.methodUrl'));
      return {
        baseline: w('foot.baseline'), source: d.source ? w('foot.source', { source: str(d.source) }) : '',
        updated: d.updated ? w('foot.updated', { date: dateText(d.updated) }) : '',
        disclaimer: w('foot.disclaimer'), links: w('foot.links'), by: w('foot.by'),
        method: methodUrl ? w('foot.method') : '', methodUrl, glossaryHeading: w('foot.glossary'), live: w('foot.live'),
        staleDate: s.nextUpdate ? dateText(s.nextUpdate) : ''
      };
    }
    // The stale line, given today's date as YYYY-MM-DD (the caller reads the clock).
    function staleLine(site, today) {
      const s = site || {}, due = str(s.staleAfter || s.nextUpdate);
      return due && today && str(today).slice(0, 10) > due.slice(0, 10) ? w('foot.stale', { date: dateText(due) }) : '';
    }
    function offline() {
      const url = safeUrl(w('offline.linkUrl'));
      return { heading: w('offline.heading'), message: w('offline.message'), linkText: url ? w('offline.linkText') : '', linkUrl: url };
    }
    const previewBar = iso => w('pv.bar', { date: dateText(iso) });
    // {n} = places on the map with no law (tiles only); L.counts.none when there is no state list.
    const noLawCount = () => (arr(states()).length ? tileStates().filter(s => groupOf(s) === 'none').length : (L.counts || {}).none || 0);
    const riskLines = () => ['risk.line1', 'risk.line2', 'risk.line3'].map(k => w(k, { n: noLawCount() })).filter(Boolean);
    const sayState = state => w('say.score', { label: tileLabel(state) });
    const sayCase = (state, c) => w('say.case', sv(state, { result: resultStamp(c) }));

    return {
      // helpers
      vars: sv, join, dateText, protName, protLong, protWhy, limitText, catchPhrase, lawStatusText, stepShort, stepTitle,
      // map and head
      tileLabel, legend, summary, meterLabel, meterItems, meterAria,
      // scorecard
      rowTag, rowLabel, rowWhy, rowCatch, rowUnclear, rowNo, rowBillNotes, billNoteText, nationalLine, row, overviewRow,
      lawCard, banCard, zeroCard, otherCard,
      billsHeading, billsNone, billLine, billImpactChips, billCard, billStepText,
      // case
      controls, question, banGapNote, noLawNote, zeroLawNote, caseNote,
      stepTag, stepAgg, lineStatus, tallyOf, stepHead, stepLines, stepWhy, stepOpen, stepOpenRule, stepAria, resultStamp, resultSentence, tallyLabels,
      exampleOutcome, exampleCard, lessonCallout,
      // page
      glossary, footer, staleLine, offline, previewBar, riskLines, sayState, sayCase
    };
  }

  return { create, merge, wordFn, NEW };
});
