/* Face Value play: the legal logic and the address scheme (FVLogic).
   FVLogic.create(D) takes the parsed data file and returns L. Pure: no window, document, storage, fetch or clock.
   The case logic is lifted from app.js@1ea0c6b (lines cited below) with the what-if fixed at 'none'.
   qa/parity.cjs runs that old file as an oracle and must match this one exactly. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.FVLogic = f(); })(this, function () {
  'use strict';

  const PORDER = ['3', '1', '6', '5', '7', '4', '2'];
  const PSLUG = { '1': 'judge', '2': 'told', '3': 'serious-crimes', '4': 'match', '5': 'accuracy', '6': 'crowds', '7': 'training' };
  const PICON = { '1': 'step-approval', '2': 'step-disclose', '3': 'step-crime', '4': 'step-match', '5': 'p-accuracy', '6': 'p-crowd', '7': 'p-trained' };
  const ABBR = {Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE','District of Columbia':'DC',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY'};
  const POS = {AK:[0,0],ME:[11,0],WI:[6,1],VT:[10,1],NH:[11,1],WA:[1,2],ID:[2,2],MT:[3,2],ND:[4,2],MN:[5,2],IL:[6,2],MI:[7,2],NY:[9,2],MA:[10,2],OR:[1,3],NV:[2,3],WY:[3,3],SD:[4,3],IA:[5,3],IN:[6,3],OH:[7,3],PA:[8,3],NJ:[9,3],CT:[10,3],RI:[11,3],CA:[1,4],UT:[2,4],CO:[3,4],NE:[4,4],MO:[5,4],KY:[6,4],WV:[7,4],VA:[8,4],MD:[9,4],DE:[10,4],AZ:[2,5],NM:[3,5],KS:[4,5],AR:[5,5],TN:[6,5],NC:[7,5],SC:[8,5],DC:[9,5],OK:[4,6],LA:[5,6],MS:[6,6],AL:[7,6],GA:[8,6],HI:[0,7],TX:[4,7],FL:[9,7]};
  // app.js:63-70, keys, icons and checks only. Each check is [rule, special step handling].
  const STEPS = [
    { key: 'crime',    icon: 'step-crime',    checks: [['3']] },
    { key: 'approval', icon: 'step-approval', checks: [['1']] },
    { key: 'search',   icon: 'step-search',   checks: [['6'], ['5'], ['7']] },
    { key: 'arrest',   icon: 'step-arrest',   checks: [['4', 'lineup'], ['4', 'arrest']] },
    { key: 'disclose', icon: 'step-disclose', checks: [['2']] },
    { key: 'trial',    icon: 'step-trial',    checks: [] }
  ];
  const CASE_DEF = { who: 'local', src: 'photo', db: 'dmv', crime: 'serious' };
  const CODES = { who: ['local', 'state'], src: ['photo', 'cctv', 'drone', 'bodycam'], db: ['dmv', 'mug'], crime: ['serious', 'minor'] };
  // Address names: new param name, old param name, new values for each legacy code.
  const PARAMS = [
    { k: 'who', name: 'police', vals: { local: 'local', state: 'state' } },
    { k: 'src', name: 'photo', vals: { photo: 'still', cctv: 'camera', drone: 'drone', bodycam: 'bodycam' } },
    { k: 'db', name: 'search', vals: { dmv: 'licenses', mug: 'mugshots' } },
    { k: 'crime', name: 'crime', vals: { serious: 'robbery', minor: 'shoplifting' } }
  ];
  // app.js:859, merged with config.limits[k].type in create().
  const LTYPE0 = { 'adds offenses': 'loose', 'adds an offense': 'loose', 'probable cause, no court': 'weak', 'court order, lower standard': 'weak', 'fact of use': 'weak', 'via drone law': 'weak' };
  const WHO_FOR = { local: 'local police', state: 'state agencies', any: 'anyone' };
  const SRC_FOR = { drone: 'police drones', bodycam: 'body-camera footage' };

  const slug = t => String(t == null ? '' : t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const arr = x => (Array.isArray(x) ? x : []);
  // Guarded field access. Data objects are never changed or copied, so callers can compare them by identity.
  const rulesOf = x => arr(x.rules).map(String).filter(r => has(PSLUG, r)); // only the keys '1'..'7'
  const limOf = x => (isObj(x.limits) ? x.limits : {});
  const whoOf = x => (Array.isArray(x.whoFor) ? x.whoFor : ['any']);

  function create(D) {
    D = isObj(D) ? D : {};
    const C = isObj(D.config) ? D.config : {};
    const STATES = arr(D.states).filter(s => isObj(s) && typeof s.name === 'string' && s.name);
    const LAWS = arr(D.laws).filter(isObj);
    const BILLS = arr(D.bills).filter(isObj);
    const NAMES = STATES.map(s => s.name);

    // Two choices on purpose, unlike app.js:860: config keys match codes in any case (the lookup already ignored case),
    // and a missing or unknown type keeps the built-in type. qa/parity.cjs feeds the oracle the same normalized config.
    const LTYPE = Object.assign({}, LTYPE0);
    if (isObj(C.limits)) Object.keys(C.limits).forEach(k => {
      const v = C.limits[k], t = isObj(v) ? v.type : null;
      if (t === 'narrow' || t === 'weak' || t === 'loose') LTYPE[String(k).toLowerCase()] = t;
    });
    const limitType = code => (code == null || code === '' ? 'narrow' : LTYPE[String(code).toLowerCase()] || 'narrow');

    /* ---------- states ---------- */
    const states = () => NAMES.slice();
    const ALIAS = { 'dc': 'District of Columbia', 'washington-dc': 'District of Columbia', 'washington-d-c': 'District of Columbia' };
    const stateBySlug = x => {
      const s = slug(x); if (!s) return null;
      const hit = STATES.find(st => slug(st.name) === s);
      if (hit) return hit.name;
      return ALIAS[s] && NAMES.includes(ALIAS[s]) ? ALIAS[s] : null;
    };

    /* ---------- groups and scorecard (app.js:122-146) ---------- */
    const lawsIn = state => LAWS.filter(l => l.state === state);
    const banOf = name => LAWS.find(l => l.state === name && l.ban) || null;
    const groupOf = name => {
      const law = (STATES.find(s => s.name === name) || {}).law || 'No law';
      if (law === 'No law') return 'none';
      if (banOf(name)) return 'ban';
      return /none of the seven/i.test(String(law)) ? 'zero' : 'rules';
    };
    const counts = { rules: 0, zero: 0, none: 0, ban: 0 };
    STATES.forEach(s => counts[groupOf(s.name)]++);

    // Default reach is local police plus state agencies; anything narrower is a limited form.
    const broad = x => !x.whoFor || x.whoFor.includes('any') || (x.whoFor.includes('local') && x.whoFor.includes('state'));
    const isFull = (l, rule) => !limOf(l)[rule] && !l.source && !l.db && broad(l);
    function stateProt(state, rule) {
      rule = String(rule);
      const laws = LAWS.filter(l => l.state === state && rulesOf(l).includes(rule));
      const full = laws.filter(l => isFull(l, rule));
      const level = full.length ? 'yes' : laws.length ? 'part' : 'no';
      const rv = laws.find(l => l.review && (Array.isArray(l.reviewRules) ? l.reviewRules : rulesOf(l)).map(String).includes(rule));
      return { level, laws, review: !!rv, reviewNote: rv ? (rv.reviewNote || null) : null };
    }
    const protCount = state => PORDER.filter(r => stateProt(state, r).level !== 'no').length;
    const fullCount = state => PORDER.filter(r => stateProt(state, r).level === 'yes').length;
    const mapLevel = name => {
      const g = groupOf(name); if (g === 'none') return 'l0'; if (g === 'zero') return 'lz'; if (g === 'ban') return 'lb';
      const n = protCount(name); return n >= 5 ? 'l4' : n >= 3 ? 'l3' : n === 2 ? 'l2' : 'l1';
    };
    // app.js:407-408: states with the rule in full, and states with only limited forms. Listed states only, sorted.
    const nationalProt = rule => {
      rule = String(rule);
      const withRule = LAWS.filter(l => rulesOf(l).includes(rule) && NAMES.includes(l.state));
      const yes = [...new Set(withRule.filter(l => isFull(l, rule)).map(l => l.state))].sort();
      const part = [...new Set(withRule.map(l => l.state))].filter(s => !yes.includes(s)).sort();
      return { yes, part };
    };

    /* ---------- limits (app.js:861-868, as codes) ---------- */
    function limitsOf(x, rule) {
      if (!isObj(x)) return [];
      const raw = limOf(x)[String(rule)] || '', out = [];
      if (raw) out.push({ code: String(raw), type: limitType(raw), kind: 'limit' });
      if (x.source && !/drone|body/i.test(String(raw))) out.push({ code: null, type: 'narrow', kind: 'source', src: x.source });
      if (x.db) out.push({ code: null, type: 'narrow', kind: 'db', db: x.db });
      if (!broad(x)) out.push({ code: null, type: 'narrow', kind: 'who', who: x.whoFor.slice() });
      return out;
    }
    const limKey = c => [c.kind, c.code, c.src, c.db, c.who && c.who.join('+')].join('|');
    // Every limit on a 'part' row, over every law that adds the rule (so NH rule 1 shows both of its limits).
    function catchOf(state, rule) {
      const sp = stateProt(state, rule); if (sp.level !== 'part') return [];
      const seen = {}, out = [];
      sp.laws.forEach(l => limitsOf(l, rule).forEach(c => { const k = limKey(c); if (!seen[k]) { seen[k] = 1; out.push(c); } }));
      return out;
    }
    // The one limit the old scorecard line showed (app.js:599, first law only). Kept for parity.
    function catchFirst(state, rule) {
      const sp = stateProt(state, rule); if (sp.level !== 'part') return null;
      const l = sp.laws[0], r = String(rule), lim = limOf(l)[r];
      return lim ? { kind: 'limit', code: String(lim) } : l.source ? { kind: 'source', src: l.source } : l.db ? { kind: 'db', db: l.db }
        : !broad(l) ? { kind: 'who', who: l.whoFor.slice() } : null;
    }

    /* ---------- bills (app.js:245-248, 365-370) ---------- */
    // "Last session": bills from the newest year in the data, plus older bills still alive. '-Infinity' with no bills.
    const LAST = String(Math.max(...BILLS.map(b => +b.year || 0)));
    const inSession = b => isObj(b) && (String(b.year) === LAST || !!b.pending);
    const byYear = (a, b) => String(b.year).localeCompare(String(a.year));
    const billsFor = (state, rule) => BILLS.filter(b => b.state === state && rulesOf(b).includes(String(rule)) && inSession(b)).sort(byYear);
    const sessionBills = state => BILLS.filter(b => b.state === state && inSession(b)).sort(byYear);
    function billImpact(b) {
      if (!isObj(b)) return [];
      return rulesOf(b).map(r => {
        const cur = stateProt(b.state, r).level, lim = limOf(b)[r] || null, full = !lim;
        const k = cur === 'no' ? 'add' : cur === 'part' && full ? 'up' : cur === 'part' ? 'same' : 'have';
        return { rule: r, kind: lim && limitType(lim) === 'loose' ? 'loose' : k, limit: lim };
      });
    }
    // Session bills that would change this row, grouped: loose (widens police use), add, addPart, up. At most 2 groups.
    function billNote(state, rule) {
      const r = String(rule), level = stateProt(state, r).level, g = { loose: [], add: [], addPart: [], up: [] };
      billsFor(state, r).forEach(b => {
        const lim = limOf(b)[r];
        if (lim && limitType(lim) === 'loose') g.loose.push(b);
        else if (level === 'no') g[lim ? 'addPart' : 'add'].push(b);
        else if (level === 'part' && !lim) g.up.push(b);
      });
      return ['loose', 'add', 'addPart', 'up'].filter(k => g[k].length).slice(0, 2).map(kind => ({ kind, bills: g[kind] }));
    }

    const otherLawsOf = state => LAWS.filter(l => l.state === state && !rulesOf(l).length && !l.ban);

    /* ---------- the case (app.js:217-287, what-if 'none') ---------- */
    function judge(law, rule, ctx, at) {
      if (law.source && law.source !== ctx.src) return { kind: 'bypassed', reason: `it only covers ${SRC_FOR[law.source]}`, by: 'source', src: law.source };
      if (law.db && law.db !== ctx.db) return { kind: 'bypassed', reason: "it only covers searches of driver's license photos", by: 'db', db: law.db };
      const wf = whoOf(law);
      const whoOk = wf.includes('any') || wf.includes(ctx.who);
      if (!whoOk && ctx.who === 'federal') return { kind: 'review' }; // dead: input never carries federal
      if (!whoOk) return { kind: 'bypassed', reason: `it only covers ${wf.map(w => WHO_FOR[w]).join(' and ')}`, by: 'who', who: wf.slice() };
      let limit = limOf(law)[rule] || '';
      if (law.source && /drone|body/.test(limit)) limit = '';
      if (rule === '4' && limit === 'lineups only') {
        if (at === 'lineup') return { kind: 'covered' };
        return { kind: 'bypassed', reason: 'it only covers lineups, and police can arrest someone without holding a lineup', by: 'lineup' };
      }
      if (rule === '4' && at === 'lineup') return null;
      return limit ? { kind: 'partial', limit } : { kind: 'covered' };
    }
    function ruleStatus(state, rule, ctx, at) {
      const hits = [];
      for (const law of LAWS.filter(l => l.state === state && rulesOf(l).includes(rule))) {
        const j = judge(law, rule, ctx, at);
        if (j) hits.push(Object.assign({ law }, j));
      }
      /* PRECEDENCE */ for (const k of ['covered', 'partial', 'review', 'bypassed']) if (hits.some(h => h.kind === k)) return { status: k, hits, top: hits.find(h => h.kind === k) };
      return { status: at === 'lineup' ? 'info' : 'gap', hits };
    }
    const normCtx = ctx => {
      const c = isObj(ctx) ? ctx : {}, out = {};
      Object.keys(CASE_DEF).forEach(k => { out[k] = CODES[k].includes(c[k]) ? c[k] : CASE_DEF[k]; });
      return out; // who=federal (never offered) becomes local
    };
    function effective(state, rule, ctx, at) {
      ctx = normCtx(ctx); rule = String(rule);
      if (rule === '6' && ctx.src === 'photo') return { status: 'na', hits: [], has: stateProt(state, '6').level !== 'no' };
      return ruleStatus(state, rule, ctx, at);
    }
    const otherLaws = (state, ctx) => { ctx = normCtx(ctx); return LAWS.filter(l => l.state === state && !rulesOf(l).length).filter(l => {
      if (l.source && l.source !== ctx.src) return false;
      if (l.db && l.db !== ctx.db) return false;
      return whoOf(l).includes('any') || whoOf(l).includes(ctx.who);
    }); };
    // A ban (or pause) on this kind of police, or a bar on this kind of footage, stops the search outright.
    const banFor = (state, ctx) => { ctx = normCtx(ctx); return LAWS.find(l => l.state === state && isObj(l.ban) && arr(l.ban.who).includes(ctx.who)) || null; };
    const barFor = (state, ctx) => { ctx = normCtx(ctx); return LAWS.find(l => l.state === state && isObj(l.bars) && l.bars.src === ctx.src && (whoOf(l).includes('any') || whoOf(l).includes(ctx.who))) || null; };
    function computeCase(state, ctx) {
      ctx = normCtx(ctx);
      let stopAt = -1, why = null;
      const ban = banFor(state, ctx), bar = barFor(state, ctx);
      const steps = STEPS.map((s, i) => {
        const results = s.checks.map(([rule, at]) => Object.assign({ rule, at }, effective(state, rule, ctx, at))).filter(r => r.status !== 'info');
        if (stopAt < 0 && ban && i === 0) { stopAt = i; why = { kind: 'ban', law: ban, text: ban.ban.text }; }
        if (stopAt < 0 && s.key === 'crime' && ctx.crime === 'minor' && results[0] && ['covered', 'would'].includes(results[0].status)) { stopAt = i; why = { kind: 'crime' }; }
        if (stopAt < 0 && bar && s.key === 'search') { stopAt = i; why = { kind: 'bar', law: bar, text: bar.bars.text }; }
        return { key: s.key, icon: s.icon, checks: s.checks, results };
      });
      steps.forEach((s, i) => {
        const st = s.results.map(r => r.status).filter(x => x !== 'na');
        s.agg = s.key === 'trial' ? 'none' : stopAt === i ? 'stop' : stopAt >= 0 && i > stopAt ? 'skip'
          : !st.length ? 'none'
          : st.every(x => x === 'covered') ? 'covered'
          : st.every(x => x === 'covered' || x === 'would') ? 'would'
          : st.some(x => x === 'covered' || x === 'would') && !st.some(x => x === 'partial' || x === 'review') ? 'mixed'
          : st.some(x => ['covered', 'partial', 'would'].includes(x)) ? 'partial'
          : st.includes('review') ? 'review'
          : st.includes('bypassed') ? 'bypassed' : 'gap';
      });
      return { steps, stopAt, why };
    }
    // app.js:710-715: skipped steps are left out; 'na' rows do not count toward the total.
    function tally(c) {
      const all = arr(c && c.steps).flatMap(s => (s.agg === 'skip' ? [] : arr(s.results)));
      const n = k => all.filter(r => r.status === k).length;
      return { got: n('covered') + n('would'), soft: n('partial') + n('review'), bypassed: n('bypassed'), gap: n('gap'), total: all.filter(r => r.status !== 'na').length };
    }
    // The state's ban when it does not reach this kind of police (Virginia with state police).
    const banGap = (state, ctx) => { ctx = normCtx(ctx); const b = banOf(state); return b && isObj(b.ban) && !arr(b.ban.who).includes(ctx.who) ? b : null; };

    /* ---------- the address (design-site §2.10) ---------- */
    const protBySlug = x => { const s = String(x == null ? '' : x).toLowerCase(); return Object.keys(PSLUG).find(k => PSLUG[k] === s || k === s) || null; };
    const VIEWS = ['overview', 'score', 'case'];
    // Read a setup value given under the new or the old name, in new or old wording.
    function readCtx(q) {
      const ctx = Object.assign({}, CASE_DEF);
      PARAMS.forEach(p => {
        for (const name of [p.name, p.k]) {
          if (!q.has(name)) continue;
          const v = String(q.get(name)).toLowerCase();
          const code = has(p.vals, v) ? v : Object.keys(p.vals).find(c => p.vals[c] === v);
          if (code) { ctx[p.k] = code; break; }
          if (p.k === 'who' && v === 'federal') { ctx.who = 'local'; break; }
        }
      });
      return ctx;
    }
    function hashFor(route) {
      const r = isObj(route) ? route : {};
      const st = r.st ? stateBySlug(r.st) : null;
      const view = st ? (r.view === 'case' ? 'case' : 'score') : 'overview';
      const qs = [];
      if (view === 'case') {
        const ctx = normCtx(r.ctx);
        PARAMS.forEach(p => { if (ctx[p.k] !== CASE_DEF[p.k]) qs.push(p.name + '=' + p.vals[ctx[p.k]]); });
        const ex = slug(r.ex); if (ex) qs.push('ex=' + ex);
      } else {
        const open = r.open === 'bills' && view === 'score' ? 'bills' : protBySlug(r.open) ? PSLUG[protBySlug(r.open)] : null;
        if (open) qs.push('open=' + open);
      }
      const q = qs.length ? '?' + qs.join('&') : '';
      return view === 'overview' ? '#/' + q : view === 'score' ? '#/' + slug(st) + q : '#/' + slug(st) + '/case' + q;
    }
    function route(st, view, ctx, open, ex) {
      st = st ? stateBySlug(st) : null;
      if (!st) { view = 'overview'; ex = null; if (open === 'bills') open = null; }
      else if (view !== 'case') view = 'score';
      if (view === 'case') open = null; else ex = null;
      if (open && open !== 'bills') open = protBySlug(open) ? PSLUG[protBySlug(open)] : null;
      ex = ex ? slug(ex) || null : null;
      const r = { st, view, ctx: normCtx(ctx), open: open || null, ex };
      r.canonical = hashFor(r);
      return r;
    }
    function parseHash(h) {
      try {
        let raw = String(h == null ? '' : h);
        const at = raw.indexOf('#'); if (at >= 0) raw = raw.slice(at + 1);
        raw = raw.trim();
        if (!raw || raw === '/') return route(null);
        if (raw[0] !== '/') {
          // Old forms: #tab=case&state=Maryland&who=…, the Nov 11 form #state=Indiana&who=…, and #start, #case, #top…
          const q = new URLSearchParams(raw), tab = q.get('tab'), st = q.get('state');
          if (tab) {
            if (tab === 'case') return route(st, 'case', readCtx(q));
            // The old "compare every version" view (cmode=laws, prot=1..7, default 1) opens that row on the overview.
            if (tab === 'compare' && q.get('cmode') === 'laws') return route(null, 'overview', null, protBySlug(q.get('prot')) || '1');
            if (tab === 'state' || tab === 'compare') return route(st, 'score', null);
            if (tab === 'laws') return route(st, 'score', null, q.get('p'));
            return route(null);
          }
          if (st) return route(st, 'case', readCtx(q));
          return route(null);
        }
        const [path, qs] = raw.slice(1).split('?');
        const parts = path.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return p; } });
        const q = new URLSearchParams(qs || '');
        if (!parts.length) return route(null, 'overview', null, q.get('open'));
        if (parts[0] === 'compare') {
          if (parts[1] === 'laws') return route(null, 'overview', null, parts[2]);
          return route(parts[1], 'score', null);
        }
        if (parts[0] === 'laws') {
          const st = q.get('state');
          return route(st, 'score', null, parts[1] === 'bills' ? 'bills' : q.get('p'));
        }
        if (!stateBySlug(parts[0])) return route(null);
        return parts[1] === 'case' ? route(parts[0], 'case', readCtx(q), null, q.get('ex'))
          : route(parts[0], 'score', null, q.get('open'));
      } catch (e) {
        return route(null);
      }
    }

    return {
      PORDER, PSLUG, PICON, ABBR, POS, STEPS, CASE_DEF, CODES, VIEWS, LAST, counts,
      states, slug, stateBySlug, protBySlug,
      banOf, groupOf, broad, stateProt, protCount, fullCount, mapLevel, nationalProt,
      limitType, limitsOf, catchOf, catchFirst,
      inSession, billsFor, sessionBills, billImpact, billNote, otherLawsOf,
      judge, ruleStatus, effective, otherLaws, banFor, barFor, computeCase, tally, banGap, normCtx,
      parseHash, hashFor
    };
  }

  return { create };
});
