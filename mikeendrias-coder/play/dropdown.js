/* Face Value draft: dropdown.js. A listbox popup drawn in the site's own style. No native select element anywhere.
   Fork of FV/dropdown.js: same popup placement, active option, keyboard and ARIA; options come from a JS list.
   FVDropdown.mount(btn, {label, listLabel, placeholder, options:[{value,text}], value, onChange, listId})
     -> {set(value), setOptions(options, value?), open(), close()}
   Keyboard: Enter, Space, Up or Down on the button opens. In the list: Up/Down, Home/End, PageUp/PageDown move,
   Enter or Space picks, Esc closes and returns to the button, Tab closes, typing jumps to a match. */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var CHECK = '<svg class="dd-check" viewBox="0 0 9 9" width="16" height="16" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="currentColor" d="M1 4h1v1H1zM2 5h1v1H2zM3 6h1v1H3zM4 5h1v1H4zM5 4h1v1H5zM6 3h1v1H6zM7 2h1v1H7zM1 5h1v1H1zM2 6h1v1H2zM3 7h1v1H3zM4 6h1v1H4zM5 5h1v1H5zM6 4h1v1H6zM7 3h1v1H7z"/></svg>';
  var current = null; // the one open dropdown, if any

  function mount(btn, o) {
    o = o || {};
    var opts = [], value = null, onChange = o.onChange || function () {};
    var listId = o.listId || ((btn.id || 'dd') + '-list');
    var pop = document.createElement('div');
    pop.className = 'dd-pop'; pop.hidden = true;
    var list = document.createElement('div');
    list.className = 'dd-list'; list.id = listId; list.tabIndex = 0; // the open list is the focused listbox (it only exists while open)
    list.setAttribute('role', 'listbox');
    if (o.listLabel || o.label) list.setAttribute('aria-label', o.listLabel || o.label);
    pop.appendChild(list);
    // Right after the button, so Tab and the focus starting point carry on from the button's place in the page.
    btn.insertAdjacentElement('afterend', pop);
    btn.classList.add('dd');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', listId);
    var valEl = btn.querySelector('.dd-val');
    var st = null; // open state: {active, typed, t, w}

    var index = function (v) { for (var i = 0; i < opts.length; i++) if (opts[i].value === v) return i; return -1; };
    function sync() {
      var i = index(value), text = i >= 0 ? opts[i].text : (o.placeholder || '');
      if (valEl) valEl.textContent = text; else btn.textContent = text;
      btn.classList.toggle('is-empty', i < 0);
    }
    function draw() {
      var sel = index(value);
      list.innerHTML = opts.map(function (x, i) {
        var on = i === sel;
        return '<div class="dd-opt' + (on ? ' is-on' : '') + '" role="option" id="' + esc(listId) + '-o' + i + '" data-i="' + i + '" aria-selected="' + on + '">' +
          '<span class="dd-txt">' + esc(x.text) + '</span>' + (on ? CHECK : '') + '</div>';
      }).join('');
    }
    function place() {
      if (!st) return;
      var r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth || innerWidth;
      var w = Math.min(Math.max(r.width, 220), vw - 16);
      pop.style.width = w + 'px';
      var gap = 8, below = innerHeight - r.bottom - gap - 12, above = r.top - gap - 12;
      var want = Math.min(list.scrollHeight + 14, 360);
      var up = below < Math.min(want, 220) && above > below;
      // A short screen (400% zoom) gets a shorter list, down to two rows, so the popup stays on screen.
      list.style.maxHeight = Math.max(80, Math.min(340, (up ? above : below) - 14)) + 'px';
      pop.style.left = Math.max(8, Math.min(vw - w - 8, r.left)) + 'px';
      var h = pop.offsetHeight, top = up ? r.top - gap - h : r.bottom + gap;
      // Keep it inside the screen while its button is on screen; once the page scrolls the button away, it follows.
      if (r.bottom > 0 && r.top < innerHeight) top = Math.max(8, Math.min(innerHeight - h - 8, top));
      pop.style.top = top + 'px';
      pop.classList.toggle('up', up);
    }
    function setActive(i, center) {
      var items = list.querySelectorAll('.dd-opt'); if (!items.length || !st) return;
      i = Math.max(0, Math.min(items.length - 1, i)); st.active = i;
      for (var k = 0; k < items.length; k++) items[k].classList.toggle('is-active', k === i);
      list.setAttribute('aria-activedescendant', items[i].id);
      var el = items[i];
      if (center) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
      else if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
      else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
    }
    function show() {
      if (current && current !== api) current.close();
      if (!opts.length) return;
      draw();
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open');
      st = { active: Math.max(0, index(value)), typed: '', t: 0, w: innerWidth };
      current = api;
      place(); setActive(st.active, true);
      list.focus({ preventScroll: true });
    }
    function close(refocus) {
      if (!st) return;
      st = null; if (current === api) current = null;
      pop.hidden = true; list.innerHTML = ''; list.removeAttribute('aria-activedescendant');
      btn.setAttribute('aria-expanded', 'false'); btn.classList.remove('open');
      if (refocus) btn.focus({ preventScroll: true });
    }
    function choose(i) {
      if (!st || !opts[i]) return;
      var v = opts[i].value, changed = v !== value;
      value = v; sync();
      close(true);
      if (changed) onChange(v);
    }

    btn.addEventListener('click', function (e) { e.preventDefault(); if (st) close(true); else show(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(); }
    });
    list.addEventListener('click', function (e) { var x = e.target.closest('.dd-opt'); if (x) choose(+x.getAttribute('data-i')); });
    list.addEventListener('mousemove', function (e) { var x = e.target.closest('.dd-opt'); if (x && st && +x.getAttribute('data-i') !== st.active) setActive(+x.getAttribute('data-i')); });
    list.addEventListener('keydown', function (e) {
      if (!st) return;
      var n = opts.length, k = e.key;
      if (k === 'ArrowDown') { e.preventDefault(); setActive(st.active + 1); }
      else if (k === 'ArrowUp') { e.preventDefault(); setActive(st.active - 1); }
      else if (k === 'Home') { e.preventDefault(); setActive(0); }
      else if (k === 'End') { e.preventDefault(); setActive(n - 1); }
      else if (k === 'PageDown') { e.preventDefault(); setActive(st.active + 8); }
      else if (k === 'PageUp') { e.preventDefault(); setActive(st.active - 8); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(st.active); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (k === 'Tab') { close(true); }
      else if (k.length === 1 && /\S/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var now = Date.now(); st.typed = (now - st.t < 700 ? st.typed : '') + k.toLowerCase(); st.t = now;
        var start = st.typed.length === 1 ? st.active + 1 : st.active;
        for (var j = 0; j < n; j++) {
          var m = (start + j) % n;
          if (String(opts[m].text).toLowerCase().indexOf(st.typed) === 0) { setActive(m, true); break; }
        }
      }
    });
    // Focus leaving the list and the button closes the popup.
    list.addEventListener('focusout', function (e) {
      var t = e.relatedTarget;
      if (!st || (t && (pop.contains(t) || t === btn))) return;
      setTimeout(function () { if (st && !pop.contains(document.activeElement)) close(false); }, 0);
    });
    document.addEventListener('pointerdown', function (e) {
      if (!st || pop.contains(e.target) || btn.contains(e.target)) return;
      var had = pop.contains(document.activeElement);
      close(false);
      // Keep the keyboard place unless the click lands on something that takes focus itself.
      if (had && !(e.target.closest && e.target.closest('button,a[href],input,textarea,[tabindex]'))) btn.focus({ preventScroll: true });
    }, true);
    addEventListener('resize', function () { if (!st) return; if (innerWidth !== st.w) close(false); else place(); });
    document.addEventListener('scroll', function (e) { if (st && !pop.contains(e.target)) place(); }, true);

    var api = {
      set: function (v) { value = v == null ? null : v; sync(); if (st) { draw(); setActive(Math.max(0, index(value))); } },
      setOptions: function (list2, v) { opts = (list2 || []).map(function (x) { return { value: x.value, text: x.text == null ? String(x.value) : String(x.text) }; }); if (arguments.length > 1) value = v == null ? null : v; sync(); if (st) close(false); },
      open: function () { if (!st) show(); },
      close: function () { close(false); },
      el: btn, list: list
    };
    api.setOptions(o.options, o.value);
    return api;
  }

  window.FVDropdown = { mount: mount };
})();
