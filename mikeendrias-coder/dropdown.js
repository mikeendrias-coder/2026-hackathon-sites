/* Face Value dropdowns: replaces every <select> with a listbox drawn in the site's own style.
   The real <select> stays in the page (hidden) so existing code keeps reading .value and
   listening for change/input events. Keyboard: Enter/Space/Down opens, Up/Down/Home/End move,
   Enter picks, Esc closes, typing jumps to a match. */
(() => {
  const all = new Set();
  let open = null, seq = 0;

  const pop = document.createElement('div');
  pop.className = 'dd-pop'; pop.setAttribute('role', 'listbox'); pop.tabIndex = -1; pop.hidden = true;
  document.body.appendChild(pop);

  function labelText(sel) {
    const lab = sel.closest('label');
    if (lab) { const l = lab.querySelector('.label'); if (l) return l.textContent.trim(); }
    return sel.getAttribute('aria-label') || '';
  }

  function enhance(sel) {
    if (sel.dataset.dd) return;
    sel.dataset.dd = String(++seq);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dd-btn ' + (sel.classList.contains('select') ? 'select' : 'dd-plain');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="dd-val"></span><span class="dd-chev" aria-hidden="true"><svg viewBox="0 0 12 8" width="12" height="8"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="2" fill="none"/></svg></span>';
    sel.parentNode.insertBefore(btn, sel);
    sel.classList.add('dd-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    sel._dd = btn; btn._sel = sel;
    const name = labelText(sel);
    sync(sel, name);
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); open && open.btn === btn ? close(true) : show(btn); });
    btn.addEventListener('keydown', e => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(btn); }
    });
    new MutationObserver(() => sync(sel)).observe(sel, { childList: true, subtree: true, attributes: true });
    all.add(sel);
  }

  function sync(sel, name) {
    const b = sel._dd; if (!b) return;
    const o = sel.options[sel.selectedIndex];
    b.querySelector('.dd-val').textContent = o ? o.text : '';
    const n = name || b.dataset.name || labelText(sel);
    b.dataset.name = n;
    b.setAttribute('aria-label', n ? `${n}: ${o ? o.text : ''}` : (o ? o.text : ''));
  }

  function show(btn) {
    close(false);
    const sel = btn._sel, opts = [...sel.options];
    pop.innerHTML = '<div class="dd-list" role="presentation">' + opts.map((o, i) => `<div class="dd-opt${o.selected ? ' on' : ''}" role="option" id="dd-o-${i}" data-i="${i}" aria-selected="${o.selected}"><span class="dd-txt">${o.text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>${o.selected ? '<span class="dd-check" aria-hidden="true"></span>' : ''}</div>`).join('') + '</div>';
    pop.setAttribute('aria-label', btn.dataset.name || 'Options');
    const anchor = btn.closest('.seg') || btn;
    pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open'); anchor.classList.add('dd-anchor');
    open = { btn, sel, anchor, active: Math.max(0, sel.selectedIndex), typed: '', t: 0 };
    place(); setActive(open.active, true);
    pop.focus({ preventScroll: true });
  }

  function place() {
    if (!open) return;
    const r = open.anchor.getBoundingClientRect();
    const w = Math.max(r.width, 180);
    pop.style.width = w + 'px';
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const list = pop.firstElementChild;
    const h = Math.min(list.scrollHeight + 12, 340);
    const up = below < Math.min(h, 220) && above > below;
    list.style.maxHeight = (Math.max(120, Math.min(340, up ? above : below)) - 12) + 'px';
    let left = Math.min(r.left, innerWidth - pop.offsetWidth - 8); left = Math.max(8, left);
    pop.style.left = left + 'px';
    pop.style.top = up ? (r.top - Math.min(pop.offsetHeight, above) - 12) + 'px' : (r.bottom + 12) + 'px';
    pop.classList.toggle('up', up);
    const br = open.btn.getBoundingClientRect();
    pop.style.setProperty('--cx', Math.min(w - 24, Math.max(18, br.right - 18 - left)) + 'px');
  }

  function setActive(i, center) {
    const items = pop.querySelectorAll('.dd-opt'); if (!items.length) return;
    i = Math.max(0, Math.min(items.length - 1, i)); open.active = i;
    items.forEach((el, k) => el.classList.toggle('act', k === i));
    pop.setAttribute('aria-activedescendant', items[i].id);
    const el = items[i], L = pop.firstElementChild;
    if (center) L.scrollTop = el.offsetTop - L.clientHeight / 2 + el.offsetHeight / 2;
    else if (el.offsetTop < L.scrollTop) L.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > L.scrollTop + L.clientHeight) L.scrollTop = el.offsetTop + el.offsetHeight - L.clientHeight;
  }

  function choose(i) {
    const { sel, btn } = open;
    const changed = sel.selectedIndex !== i;
    sel.selectedIndex = i; sync(sel);
    close(true);
    if (changed) { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    btn.focus({ preventScroll: true });
  }

  function close(refocus) {
    if (!open) return;
    const b = open.btn; open.anchor.classList.remove('dd-anchor'); open = null;
    pop.hidden = true; pop.innerHTML = '';
    b.setAttribute('aria-expanded', 'false'); b.classList.remove('open');
    if (refocus) b.focus({ preventScroll: true });
  }

  pop.addEventListener('click', e => { const o = e.target.closest('.dd-opt'); if (o) choose(+o.dataset.i); });
  pop.addEventListener('mousemove', e => { const o = e.target.closest('.dd-opt'); if (o && open && +o.dataset.i !== open.active) setActive(+o.dataset.i); });
  pop.addEventListener('keydown', e => {
    if (!open) return;
    const n = open.sel.options.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(open.active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(open.active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(n - 1); }
    else if (e.key === 'PageDown') { e.preventDefault(); setActive(open.active + 8); }
    else if (e.key === 'PageUp') { e.preventDefault(); setActive(open.active - 8); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(open.active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') { close(false); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now(); open.typed = (now - open.t < 700 ? open.typed : '') + e.key.toLowerCase(); open.t = now;
      const opts = [...open.sel.options]; const start = open.typed.length === 1 ? open.active + 1 : open.active;
      const order = opts.map((_, k) => (start + k) % opts.length);
      const hit = order.find(k => opts[k].text.toLowerCase().startsWith(open.typed));
      if (hit !== undefined) setActive(hit, true);
    }
  });
  document.addEventListener('pointerdown', e => { if (open && !pop.contains(e.target) && !open.btn.contains(e.target)) close(false); }, true);
  addEventListener('resize', () => close(false));
  document.addEventListener('scroll', e => { if (open && !pop.contains(e.target)) place(); }, true);

  // Code elsewhere sets select.value directly; keep the visible button in step.
  for (const prop of ['value', 'selectedIndex']) {
    const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
    Object.defineProperty(HTMLSelectElement.prototype, prop, { configurable: true, get: d.get, set(v) { d.set.call(this, v); if (this._dd) sync(this); } });
  }

  const scan = root => (root.querySelectorAll ? root.querySelectorAll('select') : []).forEach(enhance);
  scan(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.tagName === 'SELECT') enhance(n); else scan(n); } })))
    .observe(document.body, { childList: true, subtree: true });
  window.ddClose = () => close(false);
})();
