/* Face Value one-page draft: the overview and the state scorecard (FV.mods.score).
   ui-core calls overview(el, route), head(el, route) and render(el, route).
   No English here: every string comes from FV.W(key) or FV.C (play/copy.js). Contract §7; design §2.5. */
(function () {
  'use strict';
  var FV = window.FV, K = window.FVKit;

  /* ---------- small helpers ---------- */
  var esc = function (s) { return K.esc(s == null ? '' : String(s)); };
  var W = function (k, v) { return FV.W(k, v); };
  var img = function (n, s, cls) { return FV.h.img(n, s, cls); };
  var p = function (cls, html) { return html ? '<p class="' + cls + '">' + html + '</p>' : ''; };
  // A tag from copy.js ({cls:'t-yes', text}); cls already carries the t- prefix.
  var tag = function (t) { return t && t.text ? '<span class="tag ' + esc(t.cls) + '">' + esc(t.text) + '</span>' : ''; };
  var ARROW = '<svg class="arrow" viewBox="0 0 8 8" width="12" height="12" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="M3 0h2v1h1v1h1v1h1v2H5v3H3V5H0V3h1V2h1V1h1z" fill="currentColor"/></svg>';
  var D = function () { return FV.D || {}; };

  /* Quotes for one item (law name) in one state. rule null = every quote for the item.
     config.leadQuotes {"State|Name|k": index into D.quotes} puts the chosen quote first. */
  function quotesFor(state, name, rule) {
    var all = Array.isArray(D().quotes) ? D().quotes : [], out = [];
    all.forEach(function (q, i) {
      if (q && q.state === state && q.item === name && q.kind !== 'Bill' && (rule == null || String(q.rule) === String(rule))) out.push({ q: q, i: i });
    });
    var lead = rule != null && D().config && D().config.leadQuotes;
    var li = lead ? lead[state + '|' + name + '|' + rule] : null;
    if (li != null) {
      var at = -1;
      out.forEach(function (x, j) { if (x.i === +li) at = j; });
      if (at > 0) out.unshift(out.splice(at, 1)[0]);
    }
    return out.map(function (x) { return x.q; });
  }
  // The "Also allowed" / "Exception" badge that FVKit.markup puts before a marked span.
  function badge(kind) {
    return '<span class="sc-xb">' + img('exception', 16) + esc(W(kind === 'exc' ? 'quote.exc' : 'quote.also')) + '</span>';
  }
  function quoteHTML(q) {
    return '<blockquote class="sc-q"><p>' + K.quoteBody(q.text, badge) + '</p>' +
      (q.cite ? '<p class="sc-qcite">' + esc(q.cite) + '</p>' : '') + '</blockquote>';
  }
  // Boxed "Read the law" link (http/https only; copy.js leaves link '' otherwise).
  function readLink(card) {
    if (!card.link) return '';
    return '<p class="sc-links">' + FV.h.lnk(card.link, card.linkText, { cls: 'sc-read', attrs: ' aria-label="' + esc(card.linkAria) + '"' }) + '</p>';
  }
  /* One law inside a row, the ban card, the zero card or the other-laws list.
     opt.rule: quotes for that protection only. opt.does: always show what the law does.
     opt.rowCatch: the catch line the row already shows; the card skips the same line. */
  function lawHTML(state, law, card, opt) {
    opt = opt || {};
    var qs = quotesFor(state, law.name, opt.rule == null ? null : opt.rule);
    var body = '';
    if (opt.does || !qs.length) body += p('sc-does', esc(card.does));
    if (card.whyLabel || card.why) body += p('sc-whynot', (card.whyLabel ? '<span class="sc-label">' + esc(card.whyLabel) + '</span> ' : '') + esc(card.why));
    if (card.catchText && card.catchText !== opt.rowCatch) body += p('sc-catch', esc(card.catchText));
    if (card.unclearText) body += p('sc-unclear', esc(card.unclearText));
    body += qs.map(quoteHTML).join('');
    if (!qs.length) body += p('sc-noq', esc(card.noQuote));
    if (card.note) body += p('sc-note', esc(card.note));
    return '<div class="sc-law">' +
      '<h4 class="sc-law-name">' + esc(card.name) + '</h4>' +
      '<p class="sc-meta"><span>' + esc(card.meta) + '</span>' + tag(card.unclear) + '</p>' +
      body +
      p('sc-cite', '<span class="sc-label">' + esc(card.citeLabel) + '</span> ' + esc(card.cite)) +
      readLink(card) + '</div>';
  }
  // A labelled list of state chips; each chip opens that state's scorecard.
  // pre keeps ids apart per view ('ov-sl-' or 'sc-sl-'): the hidden overview stays in the DOM.
  var chipN = 0;
  function states(label, list, pre) {
    if (!list || !list.length) return '';
    var id = pre + (++chipN);
    return '<div class="pn-states"><p class="sc-label" id="' + id + '">' + esc(label) + '</p>' +
      '<ul class="pn-chips" aria-labelledby="' + id + '">' + list.map(function (s) {
        return '<li><button class="chip" type="button" data-st="' + esc(s) + '">' + esc(s) + '</button></li>';
      }).join('') + '</ul></div>';
  }

  /* ---------- overview: the 7 protections ---------- */
  function overview(el, r) {
    var C = FV.C, L = FV.L, open = r && r.open ? L.protBySlug(r.open) : null;
    chipN = 0;
    var h = '<div class="ov">' +
      '<p class="pn-kicker">' + esc(W('ov.kicker')) + '</p>' +
      '<h2 id="ov-title" class="pn-h2" tabindex="-1">' + esc(W('ov.heading')) + '</h2>' +
      p('ov-intro', esc(W('ov.intro'))) + '<div class="ov-rows">';
    L.PORDER.forEach(function (k) {
      var o = C.overviewRow(k);
      var head = '<span class="ov-hd">' + img(L.PICON[k], 32, 'ov-ico') +
        '<span class="ov-name">' + esc(o.name) + '</span> <span class="ov-count">' + esc(o.count) + '</span></span>';
      var body = '<div class="ov-body">' + p('ov-why', esc(o.why)) +
        states(o.fullLabel, o.yes, 'ov-sl-') + states(o.partLabel, o.part, 'ov-sl-') + p('ov-none', esc(o.none)) + '</div>';
      h += FV.h.acc({ id: 'ov-' + k, cls: 'ov-row', attrs: ' data-rule="' + esc(k) + '"', head: head, body: body, open: open === k });
    });
    // The bar ends the panel flush (packed rule). ov.pick is new (B2 r1); map.heading has the same words until it lands.
    var pick = W(FV.hasW('ov.pick') ? 'ov.pick' : 'map.heading');
    el.innerHTML = h + '</div><button class="btn ghost ov-pick" type="button">' + esc(pick) + ARROW + '</button></div>';
    if (open) openLater(el.querySelector('.ov-row[data-rule="' + open + '"] .acc-b'));
  }

  /* ---------- panel head: state name, summary, meter, view switch ---------- */
  function head(el, r) {
    var C = FV.C, st = r.st, view = r.view === 'case' ? 'case' : 'score';
    var t = el.querySelector('#pn-title');
    if (t && t.getAttribute('data-st') === st) { setView(el, view); return; } // same state: keep focus where it is
    var shields = C.meterItems(st).map(function (m) {
      var ic = m.level === 'yes' ? 'shield-yes' : m.level === 'part' ? 'shield-part' : m.ban ? 'gate-closed' : 'shield-no';
      return '<li class="pn-shield lv-' + esc(m.ban ? 'ban' : m.level) + '">' + img(ic, 24) + '<span class="sr-only">' + esc(m.label) + '</span></li>';
    }).join('');
    el.innerHTML =
      '<p class="pn-kicker">' + esc(W('pn.kicker')) + '</p>' +
      '<div class="pn-titlerow"><h2 id="pn-title" class="pn-h2" tabindex="-1" data-st="' + esc(st) + '">' + esc(st) + '</h2>' +
      '<button class="btn ghost pn-change" type="button">' + esc(W('pn.change')) + '</button></div>' +
      p('pn-sum', esc(C.summary(st))) +
      '<div class="pn-meter"><ul class="pn-shields" aria-label="' + esc(C.meterAria(st)) + '">' + shields + '</ul>' +
      '<p class="pn-mcap" aria-hidden="true">' + esc(C.meterLabel(st)) + '</p></div>' +
      '<div id="view-switch" class="pn-views" role="group" aria-label="' + esc(W('view.label')) + '">' +
      ['score', 'case'].map(function (v) {
        return '<button class="pn-view" type="button" data-view="' + v + '" aria-pressed="' + (v === view) + '">' + esc(W('view.' + v)) + '</button>';
      }).join('') + '</div>';
  }
  function setView(el, view) {
    [].forEach.call(el.querySelectorAll('#view-switch [data-view]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view));
    });
  }

  /* ---------- scorecard body ---------- */
  function banHTML(st, b) {
    var L = FV.L, law = L.banOf(st) || {};
    var exc = (L.otherLawsOf(st) || []).filter(function (l) { return l.banException; });
    var banQ = quotesFor(st, law.name, null);
    return '<div class="sc-ban box">' +
      '<div class="sc-ban-top">' + img('gate-closed', 48, 'sc-ban-ico') +
      '<div class="sc-ban-tt"><h3 class="sc-card-h" id="sc-ban-h">' + esc(b.heading) + '</h3>' +
      '<p class="sc-tags">' + tag(b.tag) + ' ' + tag(b.unclear) + '</p></div></div>' +
      p('sc-ban-text', esc(b.text)) + p('sc-ban-covers', esc(b.covers)) + p('sc-ban-except', esc(b.except)) +
      p('sc-unclear', esc(b.unclearText)) +
      '<div class="sc-ban-law"><h4 class="sc-law-name">' + esc(b.name) + '</h4>' +
      '<p class="sc-meta"><span>' + esc(b.meta) + '</span></p>' +
      (banQ.length ? banQ.map(quoteHTML).join('') : p('sc-noq', esc(b.noQuote))) +
      p('sc-cite', '<span class="sc-label">' + esc(b.citeLabel) + '</span> ' + esc(b.cite)) + readLink(b) + '</div>' +
      (b.exceptions && b.exceptions.length ? '<div class="sc-exc"><p class="sc-label sc-exc-h">' + esc(b.exceptionsHeading) + '</p>' +
        b.exceptions.map(function (card, i) { return lawHTML(st, exc[i] || {}, card, { does: true }); }).join('') + '</div>' : '') +
      '</div>';
  }
  function zeroHTML(st, z) {
    var laws = FV.L.otherLawsOf(st) || [];
    return '<div class="sc-zero box"><div class="sc-zero-top">' + img('law', 32, 'sc-zero-ico') +
      '<h3 class="sc-card-h">' + esc(z.heading) + '</h3></div>' +
      z.laws.map(function (card, i) { return lawHTML(st, laws[i] || {}, card, { does: true }); }).join('') + '</div>';
  }
  function rowHTML(st, k, open) {
    var C = FV.C, L = FV.L, o = C.row(st, k), sp = L.stateProt(st, k), id = 'sc-' + k;
    var head = '<span class="sc-hd">' + img(L.PICON[k], 32, 'sc-ico') +
      '<span class="sc-name">' + esc(o.name) + '</span> ' +
      '<span class="sc-tags">' + tag(o.tag) + ' ' + tag(o.unclear) + '</span></span>';
    var sum = '<span id="' + id + '-l" hidden>' + esc(o.label) + '</span>' +
      '<div class="sc-sum" id="' + id + '-d">' + p('sc-why', esc(o.why)) + p('sc-catch', esc(o.catchText)) +
      (o.billNotes || []).slice(0, 2).map(function (t) { return p('sc-bnote', esc(t)); }).join('') + '</div>';
    var body = '<div class="sc-body">';
    if (o.level === 'no') {
      body += p('sc-no', esc(o.noText)) + states(o.hasFullLabel, o.hasFull, 'sc-sl-');
    } else {
      body += o.laws.map(function (card, i) { return lawHTML(st, sp.laws[i] || {}, card, { rule: k, rowCatch: o.catchText }); }).join('');
    }
    body += p('sc-nat', esc(o.national)) + '</div>';
    return FV.h.acc({
      id: id, cls: 'sc-row lv-' + (o.tag && o.tag.cls === 't-ban' ? 'ban' : o.level), attrs: ' data-rule="' + esc(k) + '"',
      labelledby: id + '-l', describedby: id + '-d', head: head, after: sum, body: body, open: open
    });
  }
  function otherHTML(st, oc) {
    var laws = (FV.L.otherLawsOf(st) || []).filter(function (l) { return !l.banException || FV.L.groupOf(st) !== 'ban'; });
    var head = '<span class="sc-hd">' + img('law', 32, 'sc-ico') + '<span class="sc-name">' + esc(oc.heading) + '</span></span>';
    var body = '<div class="sc-body">' + p('sc-intro', esc(oc.intro)) +
      oc.laws.map(function (card, i) { return lawHTML(st, laws[i] || {}, card, { does: true }); }).join('') + '</div>';
    return FV.h.acc({ id: 'sc-other', cls: 'sc-other', head: head, body: body });
  }
  function billHTML(b) {
    var c = FV.C.billCard(b);
    var chips = (c.chips || []).map(function (x) {
      return '<li class="sc-imp k-' + esc(x.kind) + '">' + (x.sym ? '<span class="sc-sym" aria-hidden="true">' + esc(x.sym) + '</span>' : '') +
        (x.label ? '<b>' + esc(x.label) + '</b><span class="sr-only">: </span>' : '') + '<span>' + esc(x.text) + '</span></li>';
    }).join('');
    return '<div class="sc-bill"><div class="sc-bill-top"><h4 class="sc-bill-h">' + esc(c.line) + '</h4>' + tag(c.tag) + '</div>' +
      p('sc-does', esc(c.does)) + (chips ? '<ul class="sc-imps">' + chips + '</ul>' : '') +
      (c.link ? '<p class="sc-links">' + FV.h.lnk(c.link, c.linkText, { cls: 'sc-read', attrs: ' aria-label="' + esc(c.linkAria) + '"' }) + '</p>' : '') + '</div>';
  }
  function billsHTML(st, open) {
    var L = FV.L, C = FV.C;
    if (String(L.LAST) === '-Infinity' || !L.LAST) return '';
    var bills = L.sessionBills(st) || [];
    if (!bills.length) return '<div class="sc-bills sc-bills-none"><span class="sc-hd">' + img('bill', 32, 'sc-ico') + '<span class="sc-name">' + esc(C.billsNone(st)) + '</span></span></div>';
    var head = '<span class="sc-hd">' + img('bill', 32, 'sc-ico') + '<span class="sc-name">' + esc(C.billsHeading(st)) + '</span></span>';
    return FV.h.acc({ id: 'sc-bills', cls: 'sc-bills', head: head, body: '<div class="sc-body">' + bills.map(billHTML).join('') + '</div>', open: open });
  }
  function render(el, r) {
    var C = FV.C, L = FV.L, st = r.st;
    if (!st) { el.innerHTML = ''; return; }
    chipN = 0;
    var open = r.open === 'bills' ? 'bills' : r.open ? L.protBySlug(r.open) : null;
    var ban = C.banCard(st), zero = C.zeroCard(st), oc = C.otherCard(st);
    el.innerHTML = '<div class="sc">' +
      (ban ? banHTML(st, ban) : '') + (zero ? zeroHTML(st, zero) : '') +
      '<div class="sc-rows">' + L.PORDER.map(function (k) { return rowHTML(st, k, open === k); }).join('') +
      (oc ? otherHTML(st, oc) : '') + billsHTML(st, open === 'bills') + '</div>' +
      '<button class="btn ghost pn-again" type="button">' + esc(W('pn.again')) + ARROW + '</button></div>';
    if (open) openLater(el.querySelector(open === 'bills' ? '.sc-bills .acc-b' : '.sc-row[data-rule="' + open + '"] .acc-b'));
  }
  // A row opened from the address: after the first render, scroll it into view; later (See the law), focus it.
  function openLater(btn) {
    if (!btn) return;
    var live = document.body.classList.contains('is-ready');
    var go = function () {
      if (!document.body.contains(btn)) return;
      if (live) btn.focus();
      else btn.scrollIntoView({ block: 'nearest' });
    };
    if (window.requestAnimationFrame) requestAnimationFrame(go); else setTimeout(go, 0);
  }

  /* ---------- actions ---------- */
  function openPicker() {
    var core = FV.mods.core;
    if (core && typeof core.openPicker === 'function') { core.openPicker(); return; }
    var dd = FV.$('state-dd'); if (!dd) return;
    if (FV.isPhone()) dd.scrollIntoView({ block: 'start', behavior: FV.reduced() ? 'auto' : 'smooth' });
    dd.focus({ preventScroll: FV.isPhone() });
  }
  function pickState(st) {
    FV.go({ st: st, view: 'score', open: null, ex: null }, { push: true });
    var a = document.activeElement;
    if (a && a !== document.body && document.body.contains(a) && !a.closest('[hidden]')) return; // ui-core already placed focus
    var t = FV.$('pn-title'); if (!t) return;
    var pn = FV.$('panel'); if (pn) pn.scrollTop = 0;
    t.focus({ preventScroll: true });
    var rc = t.getBoundingClientRect();
    if (rc.top < 0 || rc.bottom > window.innerHeight) t.scrollIntoView({ block: 'start', behavior: FV.reduced() ? 'auto' : 'smooth' });
  }
  function onClick(e) {
    var tg = e.target; if (!tg || !tg.closest) return;
    if (!tg.closest('#panel')) return;
    var b;
    if ((b = tg.closest('.pn-chips [data-st]'))) { e.preventDefault(); pickState(b.getAttribute('data-st')); return; }
    if ((b = tg.closest('#view-switch [data-view]'))) {
      var v = b.getAttribute('data-view');
      if (v !== FV.route.view) FV.go({ view: v }, { push: true });
      var nb = document.querySelector('#view-switch [data-view="' + v + '"]');
      if (nb && document.activeElement !== nb) nb.focus({ preventScroll: true });
      return;
    }
    if (tg.closest('.pn-change') || tg.closest('.pn-again') || tg.closest('.ov-pick')) { openPicker(); return; }
    // Tapping a row's summary lines opens the row too (the button stays the keyboard control).
    var sum = tg.closest('.sc-sum');
    if (sum && !tg.closest('a, button')) {
      var sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      var acc = sum.parentNode, ab = acc && acc.querySelector('.acc-b');
      if (ab) FV.accToggle(ab);
    }
  }

  var wired = false;
  FV.register('score', {
    init: function () { if (wired) return; wired = true; document.addEventListener('click', onClick); },
    overview: overview,
    head: head,
    render: render,
    openPicker: openPicker
  });
})();
