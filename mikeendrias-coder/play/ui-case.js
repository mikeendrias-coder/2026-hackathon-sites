/* Face Value: case walkthrough + examples (FV.mods.case). Owner: B3.
   Contract §7 (case): .cs-lesson, .cs-controls with four [role=group][data-ctl] groups of button.chip[aria-pressed][data-val],
   .cs-question, .cs-note, ol.cs-steps with six li.cs-step[data-step], a.lnk.cs-law, .cs-result with .cs-stamp and .cs-tally.
   Design §2.6-2.7. No English here: every string comes from FV.W or FV.C. All steps show at once; no stepping, no motion. */
(function () {
  'use strict';
  var FV = window.FV;
  var esc = function (s) { return FV.h.esc(s == null ? '' : String(s)); };
  var CTL_CODE = { police: 'who', photo: 'src', search: 'db', crime: 'crime' };
  // Photo chips carry their source sprite (legacy code → icon name).
  var SRC_ICON = { photo: 'src-photo', cctv: 'src-cctv', drone: 'src-drone', bodycam: 'src-bodycam' };
  // Steps whose rule lines always show as a labelled list (design §2.6: Search rules 6, 5, 7; Arrest lineup and arrest).
  var LISTED = { search: true, arrest: true };

  function ctxOf(r) { return FV.L.normCtx(r && r.ctx ? r.ctx : FV.L.CASE_DEF); }
  function sameCtx(a, b) { return a.who === b.who && a.src === b.src && a.db === b.db && a.crime === b.crime; }
  function exById(id) {
    if (!id) return null;
    var list = FV.examples();
    for (var i = 0; i < list.length; i++) if (list[i].id === id || FV.L.slug(list[i].id) === id) return list[i];
    return null;
  }
  // The example that is still loaded: route.ex is set and the setup still equals the example's.
  function liveExample(r, ctx) {
    var ex = exById(r.ex);
    if (!ex || ex.state !== r.st) return null;
    return sameCtx(FV.L.normCtx(ex), ctx) ? ex : null;
  }
  function tagHtml(t, extra) {
    if (!t || !t.text) return '';
    return '<span class="tag ' + esc(t.cls) + (extra ? ' ' + extra : '') + '">' + esc(t.text) + '</span>';
  }

  /* ---------- controls ---------- */
  function controlsHtml(st, ctx) {
    var C = FV.C;
    return '<div class="cs-controls" role="group" aria-label="' + esc(FV.W('case.controlsLabel')) + '">' +
      C.controls(ctx, st).map(function (g) {
        var lid = 'cs-ctl-' + esc(g.ctl);
        var opts = g.options.filter(function (o) { return !o.hidden; });
        return '<div class="cs-ctl" role="group" data-ctl="' + esc(g.ctl) + '" aria-labelledby="' + lid + '">' +
          '<span class="cs-ctl-l" id="' + lid + '">' + esc(g.label) + '</span>' +
          '<div class="cs-chips">' + opts.map(function (o) {
            var icon = g.ctl === 'photo' && SRC_ICON[o.code] ? FV.h.img(SRC_ICON[o.code], 32) : '';
            var aria = o.aria && o.aria !== o.text ? ' aria-label="' + esc(o.aria) + '"' : '';
            return '<button class="chip' + (icon ? ' cs-chip-ico' : '') + '" type="button" data-val="' + esc(o.val) + '" data-code="' + esc(o.code) + '"' +
              ' aria-pressed="' + (o.pressed ? 'true' : 'false') + '"' + aria + '>' + icon + '<span class="cs-chip-t">' + esc(o.text) + '</span></button>';
          }).join('') + '</div></div>';
      }).join('') + '</div>';
  }
  function syncControls(el, ctx) {
    [].forEach.call(el.querySelectorAll('.cs-ctl[data-ctl]'), function (g) {
      var code = CTL_CODE[g.getAttribute('data-ctl')];
      [].forEach.call(g.querySelectorAll('button.chip'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-code') === ctx[code]));
      });
    });
  }

  /* ---------- lesson callout ---------- */
  function lessonHtml(ex, c) {
    if (!ex) return '';
    var o = FV.C.lessonCallout(ex, c);
    return '<div class="cs-lesson">' +
      '<p class="cs-lesson-l">' + esc(o.label) + '</p>' +
      '<p class="cs-lesson-t">' + esc(o.text) + '</p>' +
      (o.setup && o.setup !== o.text ? '<p class="cs-lesson-s">' + esc(o.setup) + '</p>' : '') +
      '<p class="cs-lesson-o">' + esc(o.outcome) + '</p></div>';
  }

  /* ---------- steps ---------- */
  function lineHtml(l, c) {
    var label = l.label;
    // A stop line caused by a bar on this footage names the law that bars it (data), so it never reads as an unrelated rule.
    if (l.tag && l.tag.cls === 't-stop' && c.why && c.why.kind === 'bar' && c.why.law && c.why.law.name && l.kind === 'rule') label = c.why.law.name;
    var gap = l.tag && l.tag.cls === 't-no' && !l.tag.note && l.kind === 'rule';
    return '<li class="cs-line cs-k-' + esc(l.kind) + '">' +
      '<span class="cs-line-l">' + esc(label) + '</span>' + tagHtml(l.tag) +
      (gap || !l.text ? '' : '<p class="cs-line-t">' + esc(l.text) + '</p>') + '</li>';
  }
  function stepHtml(st, c, s, i, ctx) {
    var C = FV.C, L = FV.L;
    var trial = s.key === 'trial';
    var agg = C.stepAgg(c, s, ctx);
    var tag = trial ? null : C.stepTag(agg);
    var stopAt = c.stopAt;
    var cls = 'cs-step' + (agg === 'skip' ? ' is-skip' : '') + (agg === 'stop' ? ' is-stop' : '') +
      (stopAt >= 0 && i >= stopAt ? ' cs-dash' : '') + (trial ? ' cs-trial' : '');
    var tid = 'cs-t-' + esc(s.key);
    var h = '<li class="' + cls + '" data-step="' + esc(s.key) + '" aria-labelledby="' + tid + '">' +
      '<span class="cs-node">' + FV.h.img(s.icon || ('step-' + s.key), 32) + '</span><div class="cs-sb">' +
      '<span class="cs-num" aria-hidden="true">' + esc(FV.W('step.label', { n: i + 1 })) + '</span>' +
      '<h3 class="cs-title" id="' + tid + '"><span class="sr-only">' + esc(FV.W('step.label', { n: i + 1 })) + ': </span>' + esc(C.stepTitle(s.key)) + '</h3>' +
      tagHtml(tag, 'cs-stag');
    if (trial) return h + resultHtml(st, c, ctx) + '</div></li>';
    h += '<p class="cs-head">' + esc(C.stepHead(st, c, s, ctx)) + '</p>';
    var lines = C.stepLines(st, c, s, ctx);
    if (LISTED[s.key] && lines.length) {
      h += '<ul class="cs-lines">' + lines.map(function (l) { return lineHtml(l, c); }).join('') + '</ul>';
    } else if (lines.length) {
      // One-rule steps: the tag already sits on the step, so show only the line's own sentence when it adds something.
      var extra = lines.filter(function (l) { return l.text && !(l.tag && l.tag.cls === 't-no' && !l.tag.note && l.kind === 'rule'); });
      if (lines.length === 1 && extra.length) h += '<p class="cs-detail">' + esc(extra[0].text) + '</p>';
      else if (lines.length > 1) h += '<ul class="cs-lines">' + lines.map(function (l) { return lineHtml(l, c); }).join('') + '</ul>';
    }
    // Open the rule that stopped the search here, else the first rule that applies to this case (copy-api stepOpen).
    var pslug = C.stepOpen(s, c, ctx);
    var rule = C.stepOpenRule ? C.stepOpenRule(s, c, ctx) : (s.checks && s.checks[0] && s.checks[0][0]);
    // Never-reached steps carry only the never-reached sentence; their row is one tap away in the scorecard.
    if (pslug && agg !== 'skip') {
      h += FV.h.lnk('#/' + L.slug(st) + '?open=' + pslug, FV.W('case.seeLaw'), {
        cls: 'cs-law', attrs: ' data-open="' + esc(pslug) + '" aria-label="' + esc(FV.W('case.seeLawAria', { name: C.protName(rule) })) + '"'
      });
    }
    return h + '</div></li>';
  }

  /* ---------- result ---------- */
  function resultHtml(st, c, ctx) {
    var C = FV.C, L = FV.L;
    var stopped = c.stopAt >= 0;
    var tl = C.tallyLabels(L.tally(c), c, ctx);
    var tally = tl.ban
      ? '<p class="cs-tally cs-tally-ban">' + esc(tl.line) + '</p>'
      : '<div class="cs-tally"><p class="sr-only">' + esc(tl.aria) + '</p><div class="cs-tally-n" aria-hidden="true">' +
        tl.items.map(function (x) {
          return '<span class="cs-tn cs-tn-' + esc(x.key) + '"><b>' + esc(x.n) + '</b><span>' + esc(x.label) + '</span></span>';
        }).join('') + '</div><p class="cs-of" aria-hidden="true">' + esc(tl.of) + '</p></div>';
    return '<div class="cs-result">' +
      '<p class="cs-stamp ' + (stopped ? 'is-stop' : 'is-through') + '">' + FV.h.img(stopped ? 'gate-closed' : 'status-bypassed', 24) +
      '<span>' + esc(C.resultStamp(c)) + '</span></p>' +
      '<p class="cs-rs">' + esc(C.resultSentence(st, c, ctx)) + '</p>' + tally + '</div>';
  }

  /* ---------- render ---------- */
  function noteHtml(st, ctx) {
    var t = FV.C.caseNote(st, ctx);
    if (!t) return '';
    var gap = FV.L.banGap(st, ctx);
    return '<p class="cs-note ' + (gap ? (gap.review ? 'cs-note-unclear' : 'cs-note-gap') : 'cs-note-none') + '">' + esc(t) + '</p>';
  }
  function mainHtml(st, c, ctx) {
    return '<p class="cs-question">' + esc(FV.C.question(st, ctx)) + '</p>' + noteHtml(st, ctx) +
      '<ol class="cs-steps" aria-label="' + esc(FV.W('case.stepsLabel')) + '">' +
      c.steps.map(function (s, i) { return stepHtml(st, c, s, i, ctx); }).join('') + '</ol>';
  }
  function render(el, r) {
    if (!el) return;
    if (!r || !r.st) { el.innerHTML = ''; el.removeAttribute('data-st'); return; }
    var st = r.st, ctx = ctxOf(r), c = FV.L.computeCase(st, ctx);
    var ex = liveExample(r, ctx);
    if (el.getAttribute('data-st') !== st || !el.querySelector('.cs-controls')) {
      el.setAttribute('data-st', st);
      el.innerHTML = '<div class="cs-lesson-slot">' + lessonHtml(ex, c) + '</div>' + controlsHtml(st, ctx) + '<div class="cs-main">' + mainHtml(st, c, ctx) + '</div>';
    } else {
      // Same state: keep the controls (and the focused chip) in place; refresh everything else.
      syncControls(el, ctx);
      el.querySelector('.cs-lesson-slot').innerHTML = lessonHtml(ex, c);
      el.querySelector('.cs-main').innerHTML = mainHtml(st, c, ctx);
    }
    markExamples(r.view === 'case' ? ex : null);
  }

  /* ---------- examples ---------- */
  function markExamples(ex) {
    [].forEach.call(document.querySelectorAll('#examples .ex-card[data-ex]'), function (b) {
      if (ex && b.getAttribute('data-ex') === ex.id) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }
  function examplesInit() {
    var box = document.querySelector('#examples .ex-list');
    if (!box) return;
    box.innerHTML = FV.examples().map(function (ex) {
      var o = FV.C.exampleCard(ex);
      return '<button class="ex-card" type="button" data-ex="' + esc(o.id) + '">' + FV.h.img('who-' + (ex.who === 'state' ? 'state' : 'local'), 32, 'ex-ico') +
        '<span class="ex-t">' + esc(o.title) + '</span>' + (o.lesson ? '<span class="ex-l">' + esc(o.lesson) + '</span>' : '') + '</button>';
    }).join('');
  }
  function openExample(id) {
    var ex = exById(id);
    if (!ex) return;
    var ctx = FV.L.normCtx(ex);
    var r0 = FV.route || {}, same = r0.view === 'case' && r0.st === ex.state && r0.ex === ex.id;
    FV.go({ st: ex.state, view: 'case', ctx: ctx, ex: ex.id, open: null }, { push: true });
    // ui-core's after() moves focus and scroll and announces a newly opened case (design §2.9).
    // Only if no core is registered, do the same here. Re-opening the open example still gets one announcement.
    var core = FV.mods.core && FV.mods.core.after;
    if (!core) {
      var head = document.getElementById('pn-title'), panel = document.getElementById('panel');
      if (FV.isPhone() && panel) panel.scrollIntoView({ behavior: FV.reduced() ? 'auto' : 'smooth', block: 'start' });
      if (head) head.focus({ preventScroll: true });
    }
    if (!core || same) FV.say(FV.C.sayCase(ex.state, FV.L.computeCase(ex.state, ctx)));
  }

  /* ---------- events ---------- */
  // Keep the tapped chip under the finger when the lesson callout above it goes away.
  function scroller(node) {
    for (var p = node.parentElement; p && p !== document.body; p = p.parentElement) {
      var oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
  }
  function onChip(b) {
    var g = b.closest('.cs-ctl[data-ctl]'); if (!g) return;
    var code = CTL_CODE[g.getAttribute('data-ctl')], val = b.getAttribute('data-code');
    var r = FV.route; if (!code || !val || !r.st) return;
    var ctx = Object.assign({}, ctxOf(r));
    if (ctx[code] === val) return;
    ctx[code] = val;
    var ctl = g.getAttribute('data-ctl'), top = b.getBoundingClientRect().top;
    FV.go({ ctx: ctx, ex: null });
    var nb = document.querySelector('#pn-case .cs-ctl[data-ctl="' + ctl + '"] button.chip[data-code="' + val + '"]');
    if (nb) {
      var d = nb.getBoundingClientRect().top - top;
      if (Math.abs(d) > 1) { var sc = scroller(nb); if (sc) sc.scrollTop += d; else window.scrollBy(0, d); }
      if (document.activeElement !== nb && (document.activeElement === document.body || !document.activeElement || !document.contains(b))) nb.focus({ preventScroll: true });
    }
    FV.say(FV.C.sayCase(r.st, FV.L.computeCase(r.st, ctx)));
  }
  function onLaw(a, e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var pslug = a.getAttribute('data-open'); if (!pslug || !FV.route.st) return;
    e.preventDefault();
    FV.go({ view: 'score', open: pslug }, { push: true });
  }

  FV.register('case', {
    init: function () {
      examplesInit();
      var ex = document.getElementById('examples');
      if (ex && !ex.getAttribute('data-cs')) {
        ex.setAttribute('data-cs', '1');
        ex.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('.ex-card[data-ex]');
          if (b) openExample(b.getAttribute('data-ex'));
        });
      }
      var pn = document.getElementById('pn-case');
      if (pn && !pn.getAttribute('data-cs')) {
        pn.setAttribute('data-cs', '1');
        pn.addEventListener('click', function (e) {
          var t = e.target.closest && e.target;
          if (!t) return;
          var chip = t.closest('.cs-ctl button.chip');
          if (chip) return onChip(chip);
          var law = t.closest('a.cs-law');
          if (law) onLaw(law, e);
        });
        // Leaving the case view clears the "current example" mark on the cards.
        if (window.MutationObserver) new MutationObserver(function () { if (pn.hidden) markExamples(null); }).observe(pn, { attributes: true, attributeFilter: ['hidden'] });
      }
    },
    render: render
  });
})();
