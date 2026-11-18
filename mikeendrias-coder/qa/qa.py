"""Face Value QA: WCAG 2.2 AA (axe-core), optical alignment, clipped text, overlaps, target size, text size,
broken images, reflow, keyboard focus, console errors, and no browser-native dropdowns, tooltips or autofill."""
import asyncio, json, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('FV_URL', 'http://localhost:8765/index.html')
from playwright.async_api import async_playwright
AXE=open(os.path.join(HERE, 'node_modules/axe-core/axe.min.js')).read()
CHECKS = r"""
() => {
  const out = { align: [], clip: [], overlap: [], target: [], font: [], img: [] };
  const dlg = document.querySelector('.drawer.on') || document.querySelector('.welcome.on');
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.sr-only, .drawer:not(.on), .welcome:not(.on), .tip, [aria-hidden="true"]') && (!dlg || dlg.contains(el)); };
  const clipRect = el => { let r = el.getBoundingClientRect(); r = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(cs.overflow + cs.overflowY + cs.overflowX)) { const q = p.getBoundingClientRect();
      r = { left: Math.max(r.left, q.left), right: Math.min(r.right, q.right), top: Math.max(r.top, q.top), bottom: Math.min(r.bottom, q.bottom) }; } }
    return r; };
  const name = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].slice(0, 2).join('.')) + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const textRect = (el, skip) => {
    const rg = document.createRange(); let box = null;
    const walk = n => { for (const c of n.childNodes) { if (skip && skip.contains(c)) continue; if (c.nodeType === 3 && c.textContent.trim()) { rg.selectNodeContents(c); for (const r of rg.getClientRects()) { if (!r.width) continue; box = box ? { t: Math.min(box.t, r.top), b: Math.max(box.b, r.bottom), l: Math.min(box.l, r.left), r: Math.max(box.r, r.right) } : { t: r.top, b: r.bottom, l: r.left, r: r.right }; } } else if (c.nodeType === 1 && getComputedStyle(c).display !== 'none' && !c.matches('.sr-only')) walk(c); } };
    walk(el); return box;
  };
  // ink center of text: where the capital letters sit, from real font metrics
  const cv = document.createElement('canvas').getContext('2d');
  const inkRect = (el, skip) => {
    let box = null; const rg = document.createRange();
    const walk = n => { for (const c of n.childNodes) { if (skip && skip.contains(c)) continue;
      if (c.nodeType === 3 && c.textContent.trim()) { const cs = getComputedStyle(c.parentElement); cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const H = cv.measureText('H'), fa = cv.measureText(c.textContent.trim());
        rg.selectNodeContents(c); const rs = [...rg.getClientRects()].filter(r => r.width);
        for (const r of rs) { const trimmed = /cap/.test(cs.textBoxEdge || '') || /trim/.test(cs.textBoxTrim || '');
          const asc = H.fontBoundingBoxAscent, desc = H.fontBoundingBoxDescent; const content = asc + desc;
          const base = r.top + (r.height - content) / 2 + asc;
          const top = base - H.actualBoundingBoxAscent;
          box = box ? { t: Math.min(box.t, top), b: Math.max(box.b, base) } : { t: top, b: base }; } }
      else if (c.nodeType === 1 && getComputedStyle(c).display !== 'none' && !c.matches('.sr-only')) walk(c); } };
    walk(el); return box;
  };
  const groups = [
    ['.tab', 1.5], ['.pill', 1.5], ['.btn', 1.5], ['.legendcard > div:not(.hd)', 1.5], ['.prot', 3], ['.res', 3], ['.stephead', 3], ['.storybox', 3],
    ['.cb', 1.5], ['.pb', 1.5], ['.dhead h2', 1.5], ['.stories button', 3], ['.natfact .nf', 3], ['.wchoices button', 99], ['.chipbtn', 1.5], ['.howto > div', 3], ['.brand', 3]
  ];
  for (const [sel, tol] of groups) for (const el of document.querySelectorAll(sel)) {
    if (!vis(el)) continue;
    const ico = [...el.querySelectorAll('img.px, svg')].find(i => vis(i) && i.parentElement.closest(sel) === el && !i.closest('.arrow'));
    if (!ico) continue;
    const t = tol <= 1.5 ? inkRect(el) : textRect(el); if (!t) continue;
    const ir = ico.getBoundingClientRect(); const ic = (ir.top + ir.bottom) / 2, tc = (t.t + t.b) / 2;
    if (Math.abs(ic - tc) > tol) out.align.push(`${sel}: icon ${(ic - tc).toFixed(1)}px off text center in ${name(el)}`);
  }
  for (const b of document.querySelectorAll('.info, .i-wrap')) { if (!vis(b)) continue; const s = b.querySelector('svg').getBoundingClientRect(), r = b.getBoundingClientRect();
    const dx = (s.left + s.right) / 2 - (r.left + r.right) / 2, dy = (s.top + s.bottom) / 2 - (r.top + r.bottom) / 2;
    if (Math.abs(dx) > .6 || Math.abs(dy) > .6) out.align.push(`info i off center by ${dx.toFixed(1)},${dy.toFixed(1)} in ${name(b)}`); }
  for (const row of document.querySelectorAll('.hd, .casehead, .lcount, #v-state .scroll > div:first-child, .stepnav, .subbar, .bar .right, .cmpverdict, .ctxchip')) { if (!vis(row)) continue; const kids = [...row.children].filter(vis); if (kids.length < 2) continue;
    const rs = kids.map(k => k.getBoundingClientRect()); if (Math.max(...rs.map(r => r.top)) > Math.min(...rs.map(r => r.bottom))) continue;
    const c = kids.map(k => { const r = k.matches('.label,.question,.small,.muted,span') && !k.matches('.arrow,.count') ? (k.matches('.question') ? textRect(k) : inkRect(k)) : null; const b = r ? { t: r.t, b: k.matches('.question') ? r.t + 30 : r.b } : k.getBoundingClientRect(); return ((b.t ?? b.top) + (b.b ?? b.bottom)) / 2; });
    if (!row.matches('.casehead') && Math.max(...c) - Math.min(...c) > 1.5) out.align.push(`row items not centered (${(Math.max(...c) - Math.min(...c)).toFixed(1)}px) in ${name(row)}`); }
  for (const el of document.querySelectorAll('.btn, .pill, .copy, .chipbtn, .tagline, .tab, .bnav button, .count, .ltabs button, .seg2 button, .sb-main, .label.dot, .stamp, .bubble')) {
    if (!vis(el)) continue; const k = inkRect(el); if (!k) continue; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const bt = parseFloat(cs.borderTopWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0;
    const mid = el.matches('.bnav button') ? null : (r.top + bt + r.bottom - bb) / 2;
    if (mid !== null && Math.abs((k.t + k.b) / 2 - mid) > 1) out.align.push(`text not centered in its box (${((k.t + k.b) / 2 - mid).toFixed(1)}px): ${name(el)}`);
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || el.closest('.scroll, .ltable, .tiles, .sky, .wscene, .track')) continue;
    const cs = getComputedStyle(el);
    if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim() && !el.matches('.trackcard,.hud,.wtop,.drawer,.view,.app,.mapcol,select'))
      out.clip.push(`text clipped: ${name(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    if (el.matches('select') && el.scrollWidth > el.clientWidth + 1) out.clip.push(`select text cut off: ${name(el)} "${el.selectedOptions[0]?.text}"`);
  }
  const hits = [...document.querySelectorAll('button, a[href], select, input, [role=button]')].filter(vis).filter(e => !e.closest('.tiles'));
  for (const e of hits) {
    const r = e.getBoundingClientRect();
    if (!e.matches('.term') && (r.width < 24 || r.height < 24)) out.target.push(`small target ${r.width.toFixed(0)}x${r.height.toFixed(0)}: ${name(e)}`);
  }
  for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
    const a = hits[i], b = hits[j]; if (a.contains(b) || b.contains(a)) continue;
    const r1 = clipRect(a), r2 = clipRect(b); if (r1.right - r1.left < 2 || r1.bottom - r1.top < 2 || r2.right - r2.left < 2 || r2.bottom - r2.top < 2) continue;
    const ox = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), oy = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
    if (ox > 2 && oy > 2) out.overlap.push(`${name(a)} overlaps ${name(b)} (${ox.toFixed(0)}x${oy.toFixed(0)})`);
  }
  const tiles = [...document.querySelectorAll('.tile')].filter(vis);
  for (const t of tiles) { const r = t.getBoundingClientRect(); if (r.width < 23.5) { out.target.push(`map tile ${r.width.toFixed(1)}px wide`); break; } }
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || el.closest('.sr-only')) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11) out.font.push(`${fs}px text: ${name(el)}`);
  }
  for (const im of document.querySelectorAll('img')) if (im.complete && im.naturalWidth === 0) out.img.push('broken image ' + im.getAttribute('src'));
  out.native = [];
  for (const s of document.querySelectorAll('select')) { const r = s.getBoundingClientRect(), cs = getComputedStyle(s); if (r.width > 2 && r.height > 2 && +cs.opacity > 0 && cs.visibility !== 'hidden' && cs.display !== 'none') out.native.push('native dropdown visible: ' + name(s)); if (!s._dd && !s.dataset.dd) out.native.push('dropdown not replaced: ' + name(s)); }
  for (const e of document.querySelectorAll('[title]')) if (e.tagName !== 'svg' && !e.closest('svg')) out.native.push('browser tooltip (title attribute): ' + name(e));
  for (const i of document.querySelectorAll('input:not([type=hidden])')) if (i.autocomplete !== 'off') out.native.push('browser autofill on: ' + name(i));
  return out;
}
"""
async def focus_walk(pg, n=60):
  bad=[]
  await pg.keyboard.press('Tab')
  for i in range(n):
    r = await pg.evaluate("""() => { const e = document.activeElement; if (!e || e === document.body) return null;
      const r = e.getClientRects()[0] || e.getBoundingClientRect(); const cs = getComputedStyle(e);
      const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 || cs.boxShadow !== 'none';
      const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      const top = document.elementFromPoint(cx, cy); const hidden = !top || !(e === top || e.contains(top) || top.closest('.tip'));
      return { n: (e.id || e.className || e.tagName).toString().slice(0, 30) + ' ' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20), ring, hidden, off: r.bottom < 0 || r.top > innerHeight }; }""")
    if r and (not r['ring'] or r['hidden'] or r['off']): bad.append(r)
    await pg.keyboard.press('Tab')
  return bad
async def run():
  async with async_playwright() as p:
    b = await p.chromium.launch(args=['--no-sandbox'])
    total = 0
    for w, h, mob in [(1440, 900, False), (1280, 720, False), (390, 844, True), (320, 640, True)]:
      ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob)
      pg = await ctx.new_page(); errs = []
      pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
      await pg.add_init_script("try{localStorage.setItem('fv-seen','1')}catch(e){}")
      for tab in ['state', 'case', 'compare', 'cmplaws', 'laws', 'drawer', 'welcome', 'result']:
        url = URL + f'#tab={"state" if tab in ("drawer","welcome") else "case" if tab=="result" else "compare" if tab=="cmplaws" else tab}&state=Maryland' + ('&cmode=laws&prot=1' if tab=='cmplaws' else '&cmode=states')
        await pg.goto('about:blank'); await pg.goto(url); await pg.wait_for_timeout(700)
        if tab == 'drawer': await pg.click('.prot >> nth=1'); await pg.wait_for_timeout(400)
        if tab == 'welcome': await pg.click('#home'); await pg.wait_for_timeout(400)
        if tab == 'result': await pg.click('.station >> nth=5'); await pg.wait_for_timeout(900)
        await pg.add_script_tag(content=AXE)
        ax = await pg.evaluate("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}).then(r=>r.violations.map(v=>v.id+' x'+v.nodes.length+': '+v.nodes[0].html.slice(0,70)))")
        res = await pg.evaluate(CHECKS)
        d = await pg.evaluate('({sw:document.documentElement.scrollWidth, iw:innerWidth, sh:document.documentElement.scrollHeight, ih:innerHeight})')
        res['axe'] = ax; res['reflow'] = [] if d['sw'] <= d['iw'] + 1 and d['sh'] <= d['ih'] + 1 and d['iw'] == w else [f"page wider/taller than screen {d}"]
        items = sum(len(v) for v in res.values()); total += items
        print(f"[{w}] {tab:8s} issues: {items}")
        for k, v in res.items():
          for x in sorted(set(v))[:5]: print(f"    {k:7s} {x}")
      await pg.goto(URL + '#tab=state&state=Maryland'); await pg.wait_for_timeout(500)
      fb = await focus_walk(pg, 45 if not mob else 30)
      print(f"[{w}] focus walk problems: {len(fb)}"); total += len(fb)
      for x in fb[:6]: print('    focus', x)
      print(f"[{w}] console errors: {errs}"); total += len(errs)
      await ctx.close()
    await b.close()
    print('TOTAL ISSUES', total)
asyncio.run(run())
