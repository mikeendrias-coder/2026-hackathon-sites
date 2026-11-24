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
  /* copy.js reads these extras off W (copy-api.md §1): W.has(key) and W.keys() (the glossary lists every gloss.* key). */
  FV.W.has = FV.hasW;
  FV.W.keys = function () { return WF && typeof WF.keys === 'function' ? WF.keys() : []; };
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
      if (h !== location.hash && !(h === '#/' && !location.hash)) history[opt.push ? 'pushState' : 'replaceState'](null, '', h);
    } catch (e) {}
    var prev = FV.route; FV.route = r;
    render(prev, opt);
  };
  /* open (a row to open) is kept from any address: a "See the law" link or a shared link opens that row. */
  function fromHash() {
    var r = FV.L.parseHash(location.hash || '');
    FV.route = { st: r.st, view: r.view, ctx: r.ctx || Object.assign({}, FV.L.CASE_DEF), open: r.open, ex: r.ex };
    var canon = r.canonical || '#/';
    var cur = location.hash;
    // A page opened with no hash stays clean; any other non-canonical hash (old links included) is rewritten.
    if (cur && canon !== cur) {
      try { history.replaceState(null, '', canon); } catch (e) {}
    }
  }
  // Following a #link fires popstate and then hashchange; render once per address.
  var lastHash = null;
  function onNav() {
    if (!FV.ready || document.body.classList.contains('is-offline')) return;
    if (location.hash === lastHash) return;
    var prev = FV.route; fromHash(); render(prev, { pop: true });
  }
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', onNav);

  /* ---------- render ---------- */
  function show(id, on) { var el = $(id); if (el) el.hidden = !on; }
  function render(prev, opt) {
    opt = opt || {};
    var r = FV.route, M = FV.mods;
    // Where focus was before the render, so core.after() can put it back in the right place.
    var ae = document.activeElement;
    var origin = opt.pop ? 'pop' : opt.boot ? 'boot' : FV.originOf(ae);
    var hadPanelFocus = !!(ae && ae.closest && ae.closest('#panel'));
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
    if (M.core && M.core.after) M.core.after(r, prev, { stChanged: stChanged, viewChanged: viewChanged, opt: opt, origin: origin, hadPanelFocus: hadPanelFocus });
    FV.route.open = null;
    lastHash = location.hash;
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
    fromHash();
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
      FV.retried = true;
      window.FV_DATA.go().then(start, fail);
    }
  });

  /* ---------- where focus came from (used by core.after) ---------- */
  FV.originOf = function (el) {
    if (!el || el === document.body || !el.closest) return '';
    if (el.closest('#tiles')) return 'tile';
    if (el.closest('#state-dd') || el.closest('#state-dd-list')) return 'dd';
    if (el.closest('#examples')) return 'ex';
    if (el.closest('#view-switch')) return 'view';
    if (el.closest('.cs-law')) return 'law';
    if (el.closest('#panel')) return 'panel';
    return '';
  };

  /* ================= core: map, dropdown, tooltip, intro, footer, page states ================= */
  (function () {
    var esc = K.esc, W = function (k, v) { return FV.W(k, v); };
    var dd = null, bound = false;
    var wide = function () { return window.matchMedia && matchMedia('(min-width: 1024px)').matches; };
    var smooth = function () { return reduced() ? 'auto' : 'smooth'; };
    function todayISO() {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /* ---- map tiles ---- */
    function buildTiles() {
      var L = FV.L, C = FV.C, el = $('tiles');
      el.removeAttribute('aria-labelledby');
      el.setAttribute('aria-label', W('map.tilesLabel'));
      el.innerHTML = L.states().map(function (s) {
        var ab = L.ABBR[s], p = ab && L.POS[ab];
        if (!p) return ''; // places with no map spot (Puerto Rico in test data) are in the dropdown only
        var lab = C.tileLabel(s);
        return '<button type="button" class="tile ' + esc(L.mapLevel(s)) + '" data-st="' + esc(s) + '" data-x="' + p[0] + '" data-y="' + p[1] + '"' +
          ' aria-pressed="false" tabindex="-1" aria-label="' + esc(ab + ', ' + lab) + '" data-tip="' + esc(lab) + '"' +
          ' style="grid-column:' + (p[0] + 1) + ';grid-row:' + (p[1] + 1) + '">' + esc(ab) + '</button>';
      }).join('');
      var first = el.querySelector('.tile'); if (first) first.tabIndex = 0;
    }
    function tileKeys(e) {
      var t = e.target.closest && e.target.closest('.tile'); if (!t || !/^(Arrow(Right|Left|Up|Down)|Home|End)$/.test(e.key)) return;
      var all = [].slice.call($('tiles').querySelectorAll('.tile'));
      var pos = function (b) { return [+b.getAttribute('data-x'), +b.getAttribute('data-y')]; };
      var me = pos(t), best = null, bd = 1e9;
      if (e.key === 'Home') best = all[0];
      else if (e.key === 'End') best = all[all.length - 1];
      else all.forEach(function (b) {
        if (b === t) return;
        var q = pos(b), dx = q[0] - me[0], dy = q[1] - me[1];
        var ok = e.key === 'ArrowRight' ? dx > 0 : e.key === 'ArrowLeft' ? dx < 0 : e.key === 'ArrowDown' ? dy > 0 : dy < 0;
        if (!ok) return;
        var d = /Right|Left/.test(e.key) ? Math.abs(dx) + Math.abs(dy) * 3 : Math.abs(dy) + Math.abs(dx) * 3;
        if (d < bd) { bd = d; best = b; }
      });
      e.preventDefault();
      if (best) { all.forEach(function (b) { b.tabIndex = -1; }); best.tabIndex = 0; best.focus(); }
    }
    function pick(st) { if (st) FV.go({ st: st, view: 'score', open: null, ex: null }, { push: true }); }

    /* ---- legend ---- */
    function buildLegend() {
      var el = $('legend');
      el.setAttribute('aria-label', W('map.legendLabel'));
      el.innerHTML = FV.C.legend().map(function (g) {
        return '<li class="lg-chip"><span class="sw ' + esc(g.tier) + '" aria-hidden="true"></span>' +
          '<span class="lg-t" aria-hidden="true">' + esc(g.label) + '</span><b class="lg-n" aria-hidden="true">' + esc(g.n) + '</b>' +
          '<span class="sr-only">' + esc(g.aria) + '</span></li>';
      }).join('');
    }

    /* ---- the state dropdown ---- */
    function buildDropdown() {
      var opts = FV.L.states().map(function (s) { return { value: s, text: s }; });
      if (dd) { dd.setOptions(opts, FV.route.st); return; }
      dd = window.FVDropdown.mount($('state-dd'), {
        label: W('map.ddLabel'), listLabel: W('map.ddListLabel'), placeholder: W('map.ddPlaceholder'),
        options: opts, value: FV.route.st, listId: 'state-dd-list', onChange: pick
      });
    }
    /* "Change state": on a wide screen focus and open the dropdown; stacked, scroll up to the map and open it. */
    function openPicker() {
      var btn = $('state-dd'); if (!btn || !dd) return;
      if (wide()) btn.focus();
      else { $('map').scrollIntoView({ behavior: smooth(), block: 'start' }); btn.focus({ preventScroll: true }); }
      dd.open();
    }

    /* ---- tooltip (replaces title attributes; app.js:487-510 pattern) ---- */
    var tip = null, tipFor = null, tipHide = 0, lastPtr = 'mouse';
    function showTip(el) {
      var text = el.getAttribute('data-tip'); if (!text || !tip) return;
      if (tipFor && tipFor !== el) hideTip();
      tipFor = el; tip.textContent = text; tip.hidden = false;
      var name = el.getAttribute('aria-label') || el.textContent || '';
      if (name.indexOf(text) < 0) {
        var d = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (d.indexOf('tip') < 0) { d.push('tip'); el.setAttribute('aria-describedby', d.join(' ')); el.setAttribute('data-tip-desc', '1'); }
      }
      var r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight, vw = document.documentElement.clientWidth;
      var x = r.left + r.width / 2 - tw / 2, y = r.top - th - 10, below = false;
      if (y < 8) { y = r.bottom + 10; below = true; }
      x = Math.max(8, Math.min(vw - tw - 8, x));
      tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.toggle('below', below);
      tip.style.setProperty('--ax', (r.left + r.width / 2 - x) + 'px');
    }
    function hideTip() {
      if (tipFor && tipFor.getAttribute('data-tip-desc')) {
        var d = (tipFor.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== 'tip'; });
        if (d.length) tipFor.setAttribute('aria-describedby', d.join(' ')); else tipFor.removeAttribute('aria-describedby');
        tipFor.removeAttribute('data-tip-desc');
      }
      tipFor = null; if (tip) tip.hidden = true;
    }
    function bindTip() {
      tip = $('tip'); if (!tip) return;
      var canHover = window.matchMedia && matchMedia('(hover: hover)').matches;
      document.addEventListener('mouseover', function (e) {
        if (!canHover) return;
        if (e.target.closest('#tip')) { clearTimeout(tipHide); return; }
        var el = e.target.closest('[data-tip]'); clearTimeout(tipHide);
        if (el && el !== tipFor) showTip(el); else if (!el && tipFor) tipHide = setTimeout(hideTip, 200);
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tipFor) { hideTip(); e.stopPropagation(); e.preventDefault(); } }, true);
      document.addEventListener('pointerdown', function (e) { lastPtr = e.pointerType; }, true);
      document.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest('[data-tip]'); if (el && e.target.matches(':focus-visible')) showTip(el); });
      document.addEventListener('focusout', hideTip);
      document.addEventListener('scroll', hideTip, true);
      document.addEventListener('click', function (e) {
        hideTip(); if (lastPtr !== 'touch') return;
        var el = e.target.closest('[data-tip]');
        if (el && !el.closest('button:not([data-tip]),a') && !el.matches('button,a')) setTimeout(function () { showTip(el); }, 0);
      });
    }

    /* ---- intro ---- */
    function buildIntro() {
      var ul = document.querySelector('#risk .risk-lines');
      if (ul) ul.innerHTML = FV.C.riskLines().map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
      var a = $('risk-more'); if (!a) return;
      var url = K.safeUrl(W('risk.url')), html = url ? FV.h.lnk(url, W('risk.linkText'), { attrs: ' id="risk-more"' }) : '';
      if (html) a.outerHTML = html; else a.hidden = true;
    }

    /* ---- footer (design §2.8) ---- */
    function buildFooter() {
      var D = FV.D || {}, C = FV.C, site = (D.config && D.config.site) || {};
      var f = C.footer(D, site), stale = C.staleLine(site, todayISO());
      var p = function (cls, t) { return t ? '<p class="' + cls + '">' + esc(t) + '</p>' : ''; };
      var links = (f.method && f.methodUrl ? FV.h.lnk(f.methodUrl, f.method) : '') +
        '<a class="lnk" href="../">' + esc(f.live) + '</a>';
      var gloss = C.glossary();
      var body = '<dl class="gloss">' + gloss.map(function (g) { return '<div><dt>' + esc(g.term) + '</dt><dd>' + esc(g.def) + '</dd></div>'; }).join('') + '</dl>';
      document.querySelector('#foot .foot-in').innerHTML =
        '<div class="foot-main">' + p('foot-base', f.baseline) + p('foot-stale', stale) +
        '<div class="foot-meta">' + p('foot-src', f.source) + p('foot-upd', f.updated) + p('foot-disc', f.disclaimer) + p('foot-lk', f.links) + p('foot-by', f.by) + '</div>' +
        '<div class="foot-links">' + links + '</div></div>' +
        (gloss.length ? FV.h.acc({ id: 'gloss', cls: 'foot-gloss', level: 2, head: '<span>' + esc(f.glossaryHeading) + '</span>', body: body }) : '');
    }

    /* ---- preview bar ---- */
    function previewHref() { return location.pathname + (location.hash && location.hash !== '#/' ? location.hash : ''); }
    function buildPreview() {
      var bar = $('pv-bar'); if (!bar || !(window.FV_DATA && window.FV_DATA.pv)) return;
      var D = FV.D || {};
      bar.innerHTML = '<span class="pv-t">' + esc(FV.C.previewBar(D.updated || todayISO())) + '</span>' +
        '<a class="lnk" id="pv-live" href="' + esc(previewHref()) + '">' + esc(W('pv.link')) + '</a>';
      bar.hidden = false;
    }

    /* ---- focus and scroll after a render (design §2.9) ---- */
    function title() { return $('pn-title') || $('ov-title'); }
    function focusTitle() {
      var t = title(); if (!t) return;
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
      var r = t.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) t.scrollIntoView({ block: 'nearest' });
    }
    function toPanel() {
      $('panel').scrollIntoView({ behavior: smooth(), block: 'start' });
      var t = title(); if (t) { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    }
    function swap() {
      if (reduced()) return;
      [$('pn-head'), $('pn-overview'), $('pn-score'), $('pn-case')].forEach(function (el) {
        if (!el || el.hidden) return;
        el.classList.remove('pn-swap'); void el.offsetWidth; el.classList.add('pn-swap');
      });
    }
    function openRow(r, boot) {
      var key = r.open === 'bills' ? null : FV.L.protBySlug(r.open);
      var acc = key ? document.querySelector('#panel .sc-row[data-rule="' + key + '"], #panel .ov-row[data-rule="' + key + '"]')
        : document.querySelector('#panel .sc-bills');
      var btn = acc && acc.querySelector('.acc-b'); if (!btn) return false;
      FV.accToggle(btn, true);
      btn.focus({ preventScroll: true });
      // One frame later, so a module that also focuses the row in a frame callback cannot cut the scroll short.
      var go = function () { if (document.body.contains(acc)) acc.scrollIntoView({ behavior: boot ? 'auto' : smooth(), block: 'start' }); };
      if (window.requestAnimationFrame) requestAnimationFrame(go); else setTimeout(go, 0);
      return true;
    }

    FV.register('core', {
      init: function () {
        buildTiles(); buildLegend(); buildDropdown(); buildIntro(); buildFooter(); buildPreview();
        if (!bound) {
          bound = true;
          $('tiles').addEventListener('keydown', tileKeys);
          $('tiles').addEventListener('click', function (e) { var b = e.target.closest('.tile'); if (b) pick(b.getAttribute('data-st')); });
          bindTip();
        }
        if (FV.retried) FV.say(W('say.loaded'));
      },
      openPicker: openPicker,
      /* Mark the chosen state on the map and in the dropdown; keep exactly one tile in the Tab order. */
      select: function (st) {
        var tiles = [].slice.call($('tiles').querySelectorAll('.tile')), hit = null;
        tiles.forEach(function (t) {
          var on = !!st && t.getAttribute('data-st') === st;
          t.classList.toggle('is-sel', on); t.setAttribute('aria-pressed', String(on)); if (on) hit = t;
        });
        var cur = hit || tiles.filter(function (t) { return t.tabIndex === 0; })[0] || tiles[0];
        tiles.forEach(function (t) { t.tabIndex = t === cur ? 0 : -1; });
        if (dd) dd.set(st || null);
      },
      after: function (r, prev, info) {
        info = info || {};
        var C = FV.C, boot = !!(info.opt && info.opt.boot), stacked = !wide(), panel = $('panel');
        var changed = !!(info.stChanged || info.viewChanged);
        var exNew = r.view === 'case' && !!r.ex && (!prev || prev.ex !== r.ex);
        if (changed || exNew) { panel.scrollTop = 0; if (!boot) swap(); }
        var pl = $('pv-live'); if (pl) pl.setAttribute('href', previewHref());
        // A row named in the address: open it and take focus there.
        if (r.open && r.view !== 'case' && openRow(r, boot)) return;
        if (boot) {
          // A shared link to a state lands on its panel when the panel sits below the map.
          if (r.st && stacked) panel.scrollIntoView({ block: 'start' });
          return;
        }
        // Announcements.
        if (r.view === 'overview') { if (prev && prev.view !== 'overview') FV.say(W('say.overview')); }
        else if (r.view === 'case') { if (changed || exNew) FV.say(C.sayCase(r.st, FV.L.computeCase(r.st, r.ctx))); }
        else if (changed) FV.say(C.sayState(r.st));
        // Focus and scroll.
        var o = info.origin, lost = !document.activeElement || document.activeElement === document.body;
        if (o === 'pop' || (!changed && !exNew)) { if (lost && info.hadPanelFocus) focusTitle(); return; }
        if (o === 'tile' || o === 'dd') {
          if (stacked && r.st) toPanel();
          else if (lost) { var t = document.querySelector('.tile.is-sel'); if (t) t.focus({ preventScroll: true }); }
        } else if (o === 'ex' || exNew) {
          if (stacked) toPanel(); else focusTitle();
        } else if (o === 'view' || o === 'law' || o === 'panel' || lost) {
          focusTitle();
        }
      },
      offline: function () {
        var o = FV.C.offline(), sec = $('offline');
        sec.querySelector('h2').textContent = o.heading;
        sec.querySelector('p').textContent = o.message;
        var old = sec.querySelector('.lnk'); if (old) old.remove();
        if (o.linkText && o.linkUrl) sec.insertAdjacentHTML('beforeend', FV.h.lnk(o.linkUrl, o.linkText));
        sec.hidden = false;
        show('load-fail', false);
        buildFooter(); buildPreview();
      }
    });
  })();

  // ui-score.js and ui-case.js load after this file (defer keeps order); boot once they have registered.
  window.addEventListener('DOMContentLoaded', boot);
})();
