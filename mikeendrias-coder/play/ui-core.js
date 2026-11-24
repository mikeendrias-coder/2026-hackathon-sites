/* Face Value one-page draft: core. Boot, words, router, panel shell, shared HTML helpers, module registry.
   Contract: /home/michael/work/face-value-handoff/contract.md §7. UI files hold no English; every string comes from W(). */
(function () {
  'use strict';
  var K = window.FVKit;
  var FV = window.FV = { mods: {}, route: { st: null, view: 'overview', ctx: null, open: null, ex: null }, ready: false };
  var $ = function (id) { return document.getElementById(id); };
  var reduced = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };
  FV.$ = $;
  FV.reduced = reduced;

  /* ---------- modules ---------- */
  FV.register = function (name, mod) { FV.mods[name] = mod; if (FV.ready && mod.init) mod.init(FV); };

  /* ---------- words ---------- */
  /* Merge order is FVCopy.merge (copy-api.md §1): FV_WORDS, FV_PROT_WHY, then the Sheet's config text. */
  var WF = null;
  function mergeWords(D) {
    var C = (D && D.config) || {};
    WF = window.FVCopy.wordFn(window.FVCopy.merge(window.FV_WORDS || {}, window.FV_PROT_WHY || {}, C));
  }
  FV.W = function (key, vars) {
    if (!WF || !WF.has(key)) return key; // QA flags a raw key on screen
    return WF(key, vars);
  };
  FV.hasW = function (key) { return !!(WF && WF.has(key)); };
  FV.examples = function () {
    var C = (FV.D && FV.D.config) || {}, L = FV.L;
    var ok = function (x) {
      return x && typeof x === 'object' && x.id && x.t && L.stateBySlug(x.state) &&
        L.CODES.who.indexOf(x.who) >= 0 && L.CODES.src.indexOf(x.src) >= 0 &&
        L.CODES.db.indexOf(x.db) >= 0 && L.CODES.crime.indexOf(x.crime) >= 0;
    };
    var list = Array.isArray(C.examples) ? C.examples.filter(ok) : [];
    if (!list.length) list = (window.FV_EXAMPLES || []).slice();
    return list.map(function (x, i) { return Object.assign({}, x, { state: L.stateBySlug(x.state), order: +x.order || i + 1 }); })
      .sort(function (a, b) { return a.order - b.order; });
  };

  /* ---------- HTML helpers (all text escaped) ---------- */
  var EXT = '<svg class="ext" viewBox="0 0 8 8" width="10" height="10" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M3 0h5v5H7V2L1 8 0 7l6-6H3z" fill="currentColor"/></svg>';
  FV.h = {
    esc: K.esc,
    img: function (name, size, cls) {
      size = size || 32;
      return '<img class="px' + (cls ? ' ' + K.esc(cls) : '') + '" src="icons/' + K.esc(name) + '.svg" width="' + size + '" height="' + size + '" alt="">';
    },
    /* Boxed link. External links (http/https) open in a new tab; anything else unsafe is dropped. */
    lnk: function (href, text, opt) {
      opt = opt || {};
      var internal = /^#/.test(href || '');
      var url = internal ? href : K.safeUrl(href);
      if (!url) return '';
      return '<a class="lnk' + (opt.cls ? ' ' + K.esc(opt.cls) : '') + '" href="' + K.esc(url) + '"' +
        (internal ? '' : ' target="_blank" rel="noopener"') + (opt.attrs || '') + '>' + K.esc(text) +
        (internal ? '' : EXT + '<span class="sr-only">' + K.esc(FV.W('a11y.newTab')) + '</span>') + '</a>';
    },
    tag: function (kind, text) { return '<span class="tag t-' + K.esc(kind) + '">' + K.esc(text) + '</span>'; },
    /* Accordion. head is HTML (already escaped by the caller); body is HTML. */
    acc: function (o) {
      var id = K.esc(o.id), open = !!o.open, lv = o.level || 3;
      var head = '<button class="acc-b" type="button" id="' + id + '-b" aria-expanded="' + open + '" aria-controls="' + id + '-p"' +
        (o.labelledby ? ' aria-labelledby="' + K.esc(o.labelledby) + '"' : '') + (o.describedby ? ' aria-describedby="' + K.esc(o.describedby) + '"' : '') + '>' +
        o.head + '<svg class="chev" viewBox="0 0 8 8" width="12" height="12" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M1 2h2v1h1v1h1V3h1V2h1v2H6v1H5v1H3V5H2V4H1z" fill="currentColor"/></svg></button>';
      return '<div class="acc' + (o.cls ? ' ' + K.esc(o.cls) : '') + '"' + (o.attrs || '') + '>' +
        (lv ? '<h' + lv + ' class="acc-h">' + head + '</h' + lv + '>' : head) +
        (o.after || '') +
        '<div class="acc-p" id="' + id + '-p" role="region" aria-labelledby="' + id + '-b"' + (open ? '' : ' hidden') + '>' + o.body + '</div></div>';
    }
  };
  FV.accToggle = function (btn, force) {
    var p = $(btn.getAttribute('aria-controls')); if (!p) return;
    var open = force == null ? btn.getAttribute('aria-expanded') !== 'true' : !!force;
    btn.setAttribute('aria-expanded', String(open)); p.hidden = !open;
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.acc-b');
    if (b) FV.accToggle(b);
  });

  /* ---------- announcements ---------- */
  FV.say = function (t) { var el = $('sr-live'); if (!el) return; el.textContent = ''; setTimeout(function () { el.textContent = t; }, 40); };

  /* ---------- router ---------- */
  FV.isPhone = function () { return window.matchMedia && matchMedia('(max-width: 599px)').matches; };
  FV.go = function (patch, opt) {
    opt = opt || {};
    var r = Object.assign({}, FV.route, patch || {});
    if (r.st && !r.view || r.st && r.view === 'overview') r.view = 'score';
    if (!r.st) { r.view = 'overview'; }
    if (!r.ctx) r.ctx = Object.assign({}, FV.L.CASE_DEF);
    var h = FV.L.hashFor(r) || '#/';
    try {
      if (h !== location.hash) history[opt.push ? 'pushState' : 'replaceState'](null, '', h === '#/' ? location.pathname + location.search : h);
    } catch (e) {}
    var prev = FV.route; FV.route = r;
    render(prev, opt);
  };
  function fromHash(first) {
    var r = FV.L.parseHash(location.hash || '');
    FV.route = { st: r.st, view: r.view, ctx: r.ctx || Object.assign({}, FV.L.CASE_DEF), open: first ? r.open : null, ex: r.ex };
    var canon = r.canonical || '#/';
    var cur = location.hash || '#/';
    if (canon !== cur && !(canon === '#/' && (cur === '#/' || cur === '#'))) {
      try { history.replaceState(null, '', canon === '#/' ? location.pathname + location.search : canon); } catch (e) {}
    }
  }
  window.addEventListener('popstate', function () { if (!FV.ready) return; var prev = FV.route; fromHash(false); render(prev, { pop: true }); });
  window.addEventListener('hashchange', function () { if (!FV.ready) return; var prev = FV.route; fromHash(false); render(prev, { pop: true }); });

  /* ---------- render ---------- */
  function show(id, on) { var el = $(id); if (el) el.hidden = !on; }
  function render(prev, opt) {
    opt = opt || {};
    var r = FV.route, M = FV.mods;
    var stChanged = !prev || prev.st !== r.st, viewChanged = !prev || prev.view !== r.view;
    show('pn-overview', r.view === 'overview');
    show('pn-score', r.view === 'score');
    show('pn-case', r.view === 'case');
    if (M.core && M.core.select) M.core.select(r.st);
    if (r.view === 'overview') {
      $('pn-head').innerHTML = '';
      if (M.score && M.score.overview) M.score.overview($('pn-overview'), r);
    } else {
      if (M.score && M.score.head) M.score.head($('pn-head'), r);
      if (r.view === 'score' && M.score && M.score.render) M.score.render($('pn-score'), r);
      if (r.view === 'case' && M.case && M.case.render) M.case.render($('pn-case'), r);
    }
    var panel = $('panel');
    panel.setAttribute('aria-labelledby', r.view === 'overview' ? 'ov-title' : 'pn-title');
    if (M.core && M.core.after) M.core.after(r, prev, { stChanged: stChanged, viewChanged: viewChanged, opt: opt });
    FV.route.open = null;
  }
  FV.render = function () { render(FV.route, {}); };

  /* ---------- boot ---------- */
  function fail(e) {
    if (window.console) console.warn('Face Value: data did not load', e); // copy-lint-ok (developer console only)
    document.body.classList.remove('is-loading'); document.body.classList.add('is-error');
    show('load-fail', true);
  }
  function offlineNow(D) {
    var s = (D.config && D.config.site) || {};
    if (s.status === 'offline') return true;
    if (s.offlineFrom && /^\d{4}-\d{2}-\d{2}$/.test(s.offlineFrom)) {
      var d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      return s.offlineFrom <= today;
    }
    return false;
  }
  function fillWords(root) {
    [].forEach.call((root || document).querySelectorAll('[data-w]'), function (el) {
      var k = el.getAttribute('data-w'); if (FV.hasW(k)) el.textContent = FV.W(k);
    });
  }
  FV.fillWords = fillWords;
  function start(D) {
    FV.D = D;
    mergeWords(D);
    FV.L = window.FVLogic.create(D);
    FV.C = window.FVCopy.create(FV.L, FV.W);
    document.body.classList.remove('is-loading', 'is-error');
    show('load-fail', false);
    if (window.FV_DATA.pv) document.body.classList.add('is-preview');
    fillWords(document);
    if (FV.hasW('site.docTitle')) document.title = FV.W('site.docTitle');
    FV.ready = true;
    if (offlineNow(D)) {
      document.body.classList.add('is-offline');
      Object.keys(FV.mods).forEach(function (n) { var m = FV.mods[n]; if (m.offline) m.offline(FV); });
      return;
    }
    // core first (map, dropdown, intro, footer), then the rest
    ['core', 'score', 'case'].concat(Object.keys(FV.mods).filter(function (n) { return ['core', 'score', 'case'].indexOf(n) < 0; }))
      .forEach(function (n) { var m = FV.mods[n]; if (m && m.init) m.init(FV); });
    fromHash(true);
    render(null, { boot: true });
    document.body.classList.add('is-ready');
  }
  function boot() {
    var p = window.FV_DATA && window.FV_DATA.p;
    if (!p) return fail(new Error('no loader'));
    p.then(start, fail);
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#retry')) {
      document.body.classList.remove('is-error'); document.body.classList.add('is-loading'); show('load-fail', false);
      window.FV_DATA.go().then(start, fail);
    }
  });
  // ui-score.js and ui-case.js load after this file (defer keeps order); boot once they have registered.
  window.addEventListener('DOMContentLoaded', boot);
})();
