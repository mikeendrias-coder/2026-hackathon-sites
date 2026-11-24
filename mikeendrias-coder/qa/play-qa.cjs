// Face Value play/ page checks (Node Playwright + axe).
// Usage: node qa/play-qa.cjs [--url http://127.0.0.1:8765/play/] [--vp 390[,1440]] [--only maryland[,keyboard]] [--shots]
// Runs 16 scenarios at 6 screen sizes, plus a keyboard script and a reduced-motion pass per size.
// Writes qa/out/play-qa.json (and qa/out/shots/<vp>/<scenario>.png with --shots).
// Last line: TOTAL ISSUES N. Exit code 1 when N > 0.
'use strict';
const fs = require('fs');
const path = require('path');

const need = (m) => require(require.resolve(m, { paths: [__dirname, process.cwd(), '/home/michael/work'] }));
const QA = __dirname;
const FV = path.resolve(QA, '..');
const PLAY = path.join(FV, 'play');
const AXE = path.join(QA, 'node_modules/axe-core/axe.min.js');
const OUT = path.join(QA, 'out');

const VIEWPORTS = [
  { w: 320, h: 640, mobile: true },
  { w: 390, h: 844, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 1024, h: 768, mobile: false },
  { w: 1280, h: 720, mobile: false },
  { w: 1440, h: 900, mobile: false },
];
const PORDER = ['3', '1', '6', '5', '7', '4', '2'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const DATA_RE = /\/data\/(live|preview)\.json(\?.*)?$/;

// ---------- helpers put into every page before it loads ----------
const INIT = `(() => {
  window.__qaDialogs = [];
  for (const k of ['alert', 'confirm', 'prompt']) {
    try { window[k] = function (m) { window.__qaDialogs.push(k + ': ' + String(m).slice(0, 60)); return k === 'confirm' ? false : null; }; } catch (e) {}
  }
  window.__qaCls = 0;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__qaCls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  window.__qaH = {
    el(s) { return typeof s === 'string' ? document.querySelector(s) : s; },
    vis(s) { const e = this.el(s); if (!e || e.closest('[hidden]')) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; },
    n(s) { return document.querySelectorAll(s).length; },
    text(s) { const e = this.el(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; },
    tagClasses(s) { const e = this.el(s); if (!e) return null; const head = e.querySelector('.acc-b') || e;
      const tags = [...head.querySelectorAll('.tag')]; const all = tags.length ? tags : [...e.querySelectorAll('.tag')].slice(0, 1);
      return all.flatMap((t) => [...t.classList].filter((c) => c.startsWith('t-'))); },
    pressed(ctl) { const g = document.querySelector('[data-ctl="' + ctl + '"]'); if (!g) return null;
      const b = g.querySelector('[aria-pressed="true"]'); return b ? b.dataset.val : ''; },
  };
})();`;

// ---------- the in-page layout checks (ported from qa.py CHECKS) ----------
// opts: { only: ['clip','overlap',...] }  Returns { category: [messages] }.
const PAGE_CHECKS = (opts) => {
  opts = opts || {};
  const want = (k) => !opts.only || opts.only.includes(k);
  const out = { align: [], clip: [], overlap: [], squeeze: [], target: [], font: [], img: [], native: [], placeholder: [] };
  const pop = [...document.querySelectorAll('[role=listbox]')].find((p) => !p.closest('[hidden]') && p.getClientRects().length && getComputedStyle(p).visibility !== 'hidden');
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0 && !el.closest('.sr-only, #tip, [aria-hidden="true"], [inert]'); };
  const visIcon = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const clipRect = (el) => { let r = el.getBoundingClientRect(); r = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(cs.overflow + cs.overflowY + cs.overflowX)) { const q = p.getBoundingClientRect();
      r = { left: Math.max(r.left, q.left), right: Math.min(r.right, q.right), top: Math.max(r.top, q.top), bottom: Math.min(r.bottom, q.bottom) }; } }
    return r; };
  const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '')) + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const textRect = (el) => { const rg = document.createRange(); let box = null; const tops = new Set();
    const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3 && c.textContent.trim()) { rg.selectNodeContents(c); for (const r of rg.getClientRects()) { if (!r.width) continue; tops.add(Math.round(r.top / 4));
      box = box ? { t: Math.min(box.t, r.top), b: Math.max(box.b, r.bottom), l: Math.min(box.l, r.left), r: Math.max(box.r, r.right) } : { t: r.top, b: r.bottom, l: r.left, r: r.right }; } }
      else if (c.nodeType === 1 && getComputedStyle(c).display !== 'none' && !c.matches('.sr-only')) walk(c); } };
    walk(el); if (box) box.lines = tops.size; return box; };
  // ink box of text: where the capital letters sit, from real font metrics
  const cv = document.createElement('canvas').getContext('2d');
  const inkRect = (el) => { let box = null; const rg = document.createRange(); const tops = new Set();
    const walk = (n) => { for (const c of n.childNodes) {
      if (c.nodeType === 3 && c.textContent.trim()) { const cs = getComputedStyle(c.parentElement); cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const H = cv.measureText('H'); rg.selectNodeContents(c);
        for (const r of [...rg.getClientRects()].filter((x) => x.width)) { tops.add(Math.round(r.top / 4));
          const asc = H.fontBoundingBoxAscent, desc = H.fontBoundingBoxDescent; const base = r.top + (r.height - (asc + desc)) / 2 + asc; const top = base - H.actualBoundingBoxAscent;
          box = box ? { t: Math.min(box.t, top), b: Math.max(box.b, base) } : { t: top, b: base }; } }
      else if (c.nodeType === 1 && getComputedStyle(c).display !== 'none' && !c.matches('.sr-only')) walk(c); } };
    walk(el); if (box) box.lines = tops.size; return box; };

  if (want('align')) {
    // icon centered on its text, for single-line content (top-aligned icons beside several lines are skipped)
    const groups = [['.btn', 1.5], ['.chip', 1.5], ['.tag', 1.5], ['.acc-b', 3], ['.ex-card', 3], ['.cs-step', 3]];
    for (const [sel, tol] of groups) for (const el of document.querySelectorAll(sel)) {
      if (!vis(el)) continue;
      const ico = [...el.querySelectorAll('img.px, img, svg')].find((i) => visIcon(i) && i.parentElement.closest(sel) === el && !i.closest('.chev, .arrow'));
      if (!ico) continue;
      const t = tol <= 1.5 ? inkRect(el) : textRect(el); if (!t || t.lines > 1) continue;
      const ir = ico.getBoundingClientRect(); const ic = (ir.top + ir.bottom) / 2, tc = (t.t + t.b) / 2;
      if (Math.abs(ic - tc) > tol) out.align.push(`${sel}: icon ${(ic - tc).toFixed(1)}px off text center in ${name(el)}`);
    }
    // text centered in its box (single-line boxes only)
    for (const el of document.querySelectorAll('.btn, .chip, .tag, .badge-draft, .dd, .lg-chip')) {
      if (!vis(el)) continue; const k = inkRect(el); if (!k || k.lines > 1) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const mid = (r.top + (parseFloat(cs.borderTopWidth) || 0) + r.bottom - (parseFloat(cs.borderBottomWidth) || 0)) / 2;
      if (Math.abs((k.t + k.b) / 2 - mid) > 1) out.align.push(`text not centered in its box (${((k.t + k.b) / 2 - mid).toFixed(1)}px): ${name(el)}`);
    }
  }
  if (want('clip')) for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || !el.textContent.trim()) continue;
    const cs = getComputedStyle(el);
    if ((/hidden|clip/.test(cs.overflowX) || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) out.clip.push(`text clipped: ${name(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    else if ((/hidden|clip/.test(cs.overflowY) || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) && el.scrollHeight > el.clientHeight + 1) out.clip.push(`text cut off at the bottom: ${name(el)} (${el.scrollHeight} > ${el.clientHeight})`);
  }
  // text squeezed into a sliver: over 8 characters of its own text, under 48px wide, taller than 3 lines
  if (want('squeeze')) for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
    if (own.length <= 8) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || 1.2 * parseFloat(cs.fontSize);
    if (r.width < 48 && r.height > 3 * lh) out.squeeze.push(`text squeezed into a sliver ${r.width.toFixed(0)}x${r.height.toFixed(0)}: ${name(el)}`);
  }
  const hits = [...document.querySelectorAll('button, a[href], input, select, textarea, [role=button], [role=option], [role=tab], [tabindex]:not([tabindex="-1"])')]
    .filter(vis).filter((e) => !pop || pop.contains(e) || !e.closest('[role=listbox]'));
  if (want('target')) {
    for (const e of hits) { const r = e.getBoundingClientRect(); const min = e.matches('.tile') ? 23.5 : 24;
      if (r.width < min || r.height < min) out.target.push(`small target ${r.width.toFixed(1)}x${r.height.toFixed(1)}: ${name(e)}`); }
  }
  if (want('overlap')) for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
    const a = hits[i], b = hits[j]; if (a.contains(b) || b.contains(a)) continue;
    if (pop && pop.contains(a) !== pop.contains(b)) continue; // an open popup sits on top by design
    const r1 = clipRect(a), r2 = clipRect(b); if (r1.right - r1.left < 2 || r1.bottom - r1.top < 2 || r2.right - r2.left < 2 || r2.bottom - r2.top < 2) continue;
    const ox = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), oy = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
    if (ox > 2 && oy > 2) out.overlap.push(`${name(a)} overlaps ${name(b)} (${ox.toFixed(0)}x${oy.toFixed(0)})`);
  }
  if (want('font')) for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11) out.font.push(`${fs}px text: ${name(el)}`);
  }
  if (want('img')) for (const im of document.querySelectorAll('img')) if (im.complete && im.naturalWidth === 0) out.img.push('broken image ' + im.getAttribute('src'));
  if (want('native')) {
    for (const s of document.querySelectorAll('select')) out.native.push('native select: ' + name(s));
    for (const s of document.querySelectorAll('details')) out.native.push('native details: ' + name(s));
    for (const e of document.querySelectorAll('[title]')) if (e.tagName.toLowerCase() !== 'svg' && !e.closest('svg')) out.native.push('browser tooltip (title attribute): ' + name(e));
    for (const t of document.querySelectorAll('svg title')) out.native.push('svg <title> tooltip in ' + name(t.closest('svg').parentElement || t));
    for (const i of document.querySelectorAll('input:not([type=hidden])')) if (i.autocomplete !== 'off') out.native.push('browser autofill on: ' + name(i));
  }
  if (want('placeholder')) {
    const bad = [/\{[A-Za-z_][\w.]*\}/g, /\bundefined\b/g, /\bNaN\b/g, /\bnull\b/g, /\[object Object\]/g];
    const texts = [['text', document.body ? document.body.innerText : '']];
    for (const e of document.querySelectorAll('[aria-label], [aria-description]')) texts.push(['aria', (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('aria-description') || '')]);
    texts.push(['title', document.title]);
    for (const [where, t] of texts) for (const re of bad) { re.lastIndex = 0; let m; while ((m = re.exec(t))) { out.placeholder.push(`${where}: "${t.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25).replace(/\s+/g, ' ')}"`); if (out.placeholder.length > 30) break; } }
    // raw word keys on screen: a text node or aria-label that is a FV_WORDS key, or has the key shape with a known key prefix
    const W = window.FV_WORDS || {};
    const heads = new Set(Object.keys(W).map((k) => k.split('.')[0]));
    const isKey = (s) => !!s && (Object.prototype.hasOwnProperty.call(W, s) || (/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9-]+)+$/.test(s) && heads.has(s.split('.')[0])));
    if (document.body) {
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const s = n.textContent.trim(), p = n.parentElement;
        if (!isKey(s) || !p || p.closest('script, style, noscript, template, [hidden]') || !p.getClientRects().length || getComputedStyle(p).visibility === 'hidden') continue;
        out.placeholder.push(`raw word key on screen: "${s}" in ${name(p)}`);
      }
    }
    for (const e of document.querySelectorAll('[aria-label], [aria-description]')) for (const a of ['aria-label', 'aria-description']) {
      const s = (e.getAttribute(a) || '').trim(); if (isKey(s)) out.placeholder.push(`raw word key in ${a}: "${s}" on ${name(e)}`);
    }
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])];
  return out;
};

// Sideways scroll, measured against documentElement.clientWidth. Under isMobile emulation Chrome widens the
// layout viewport to fit wide content, so innerWidth grows with scrollWidth and can't catch overflow.
// Returns { sw, cw, wide: [innermost elements whose right edge passes cw + 1, unless an inner scroller clips them] }.
const SIDEWAYS = () => {
  const cw = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
  const over = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[hidden], script, style, noscript, template')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || (cs.position === 'fixed' && r.left >= cw)) continue;
    let right = r.right + scrollX;
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) right = Math.min(right, p.getBoundingClientRect().right + scrollX);
    }
    if (right > cw + 1) over.push(el);
  }
  const inner = over.filter((e) => !over.some((o) => o !== e && e.contains(o)));
  const nm = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''));
  return { sw, cw, wide: [...new Set(inner.map((e) => `${nm(e)} right edge ${Math.round(e.getBoundingClientRect().right + scrollX)}`))].slice(0, 6) };
};
const sidewaysIssues = (d, label) => [
  ...(d.sw > d.cw + 1 ? [`${label}page scrolls sideways: ${d.sw} > ${d.cw}`] : []),
  ...d.wide.map((x) => `${label}past the screen edge (${d.cw}): ${x}`),
];

const TEXT_SPACING_CSS = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';

// ---------- small node helpers ----------
const slugOf = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const readLive = () => JSON.parse(fs.readFileSync(path.join(FV, 'data/live.json'), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitReady(pg, ms = 6000) {
  try { await pg.waitForFunction(() => document.body && /\b(is-ready|is-error|is-offline)\b/.test(document.body.className), null, { timeout: ms }); await pg.waitForTimeout(300); return true; }
  catch (e) { await pg.waitForTimeout(200); return false; }
}
async function tryClick(pg, sel, { tap = false, timeout = 2000 } = {}) {
  const loc = typeof sel === 'string' ? pg.locator(sel).first() : sel.first();
  try { await loc.waitFor({ state: 'visible', timeout }); if (tap) await loc.tap({ timeout }); else await loc.click({ timeout }); await pg.waitForTimeout(250); return null; }
  catch (e) { return `could not ${tap ? 'tap' : 'click'} ${typeof sel === 'string' ? sel : 'element'}: ${String(e.message).split('\n')[0].slice(0, 90)}`; }
}
async function routeData(ctx, dataFor) {
  // dataFor(n) -> object to serve as JSON | {status} | null to pass through
  let n = 0;
  await ctx.route(DATA_RE, async (route) => {
    const r = dataFor(n++);
    if (r == null) return route.continue();
    if (r.__status) return route.fulfill({ status: r.__status, contentType: 'text/plain', body: 'not found' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: typeof r === 'string' ? r : JSON.stringify(r) });
  });
}
async function runAxe(pg) {
  try {
    if (!(await pg.evaluate(() => !!window.axe))) await pg.addScriptTag({ path: AXE });
    return await pg.evaluate((tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } })
      .then((r) => r.violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0].target.join(' ')} ${v.nodes[0].html.replace(/\s+/g, ' ').slice(0, 70)}`)), AXE_TAGS);
  } catch (e) { return [`axe could not run: ${String(e.message).split('\n')[0].slice(0, 90)}`]; }
}
async function focusWalk(pg, max = 80) {
  const bad = [];
  // A popup left open by an earlier step would cover the first Tab stops. A keyboard user can't reach that
  // state (Tab closes it), so close it the way a user would: Escape, then blur as a fallback.
  const OPEN = '[aria-expanded="true"][aria-haspopup="listbox"]';
  const closed = () => pg.waitForFunction((s) => !document.querySelector(s), OPEN, { timeout: 1500 }).then(() => true, () => false);
  if (await pg.$(OPEN)) {
    await pg.keyboard.press('Escape');
    if (!(await closed())) { await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); }); if (!(await closed())) bad.push('a listbox popup stays open after Escape and blur'); }
  }
  await pg.evaluate(() => { window.scrollTo(0, 0); const a = document.activeElement; if (a && a.blur) a.blur(); window.__qaSeen = new WeakSet(); });
  let stops = 0;
  for (let i = 0; i < max; i++) {
    await pg.keyboard.press('Tab');
    const r = await pg.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body || e === document.documentElement) return { end: true };
      if (window.__qaSeen.has(e)) return { end: true }; window.__qaSeen.add(e);
      const rect = e.getClientRects()[0] || e.getBoundingClientRect(); const cs = getComputedStyle(e);
      const ring = (cs.outlineStyle !== 'none' && cs.outlineStyle !== 'auto' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none';
      const off = rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth;
      const cx = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const top = document.elementFromPoint(cx, cy); const covered = !off && (!top || !(e === top || e.contains(top) || top.closest('#tip')));
      const n = (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')) + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
      return { n, ring, covered, off, coveredBy: covered && top ? (top.id ? '#' + top.id : top.tagName.toLowerCase() + '.' + [...top.classList].slice(0, 1).join('')) : '' };
    });
    if (r.end) break;
    stops++;
    if (!r.ring) bad.push(`no visible 2px ring: ${r.n}`);
    if (r.off) bad.push(`focused but off screen: ${r.n}`);
    if (r.covered) bad.push(`focused but covered by ${r.coveredBy}: ${r.n}`);
  }
  if (stops === 0) bad.push('Tab reaches nothing on the page');
  return { bad, stops };
}

// ---------- expectations shared by every normal scenario (DOM contract §7) ----------
const CONTRACT = () => {
  const H = window.__qaH, f = [];
  if (document.documentElement.lang !== 'en') f.push('html lang is not "en"');
  const robots = document.querySelector('meta[name=robots]'); if (!robots || !/noindex/.test(robots.content) || !/nofollow/.test(robots.content)) f.push('missing robots noindex, nofollow');
  if (!/\(draft\)/.test(document.title)) f.push('title lacks "(draft)"');
  const b = document.body.classList;
  if (!b.contains('is-ready')) f.push('body never got is-ready'); if (b.contains('is-loading')) f.push('body still is-loading');
  if (!document.querySelector('header.site-head .brand')) f.push('missing header.site-head .brand');
  if (!document.querySelector('header.site-head .badge-draft')) f.push('missing .badge-draft');
  const live = document.querySelector('a.lnk#live-link'); if (!live || live.getAttribute('href') !== '../') f.push('missing a.lnk#live-link to ../');
  if (!document.querySelector('section#intro h1#title')) f.push('missing #intro h1#title');
  if (!document.querySelector('#risk a.lnk#risk-more')) f.push('missing #risk a#risk-more');
  const board = document.querySelector('main#board.board');
  if (!board) f.push('missing main#board.board');
  else { const ids = [...board.children].map((c) => c.id).filter(Boolean); if (ids.join(',') !== 'map,panel,examples') f.push(`board cells are [${ids}], want map,panel,examples`); }
  const dd = document.querySelector('button.dd#state-dd'); if (!dd) f.push('missing button.dd#state-dd'); else if (dd.getAttribute('aria-haspopup') !== 'listbox' || !dd.hasAttribute('aria-expanded')) f.push('#state-dd lacks aria-haspopup=listbox / aria-expanded');
  const tiles = document.querySelectorAll('#tiles button.tile[data-st]'); if (tiles.length !== 51) f.push(`${tiles.length} map tiles, want 51`);
  const t0 = [...tiles].filter((t) => t.tabIndex === 0).length; if (tiles.length && t0 !== 1) f.push(`${t0} tiles have tabindex=0, want exactly 1`);
  for (const t of tiles) if (![...t.classList].some((c) => /^l[0zb1-4]$/.test(c))) { f.push('tile without a tier class: ' + t.dataset.st); break; }
  if (!H.n('ul#legend li.lg-chip')) f.push('missing ul#legend li.lg-chip');
  const views = ['#pn-overview', '#pn-score', '#pn-case'].filter((s) => H.vis(s)); if (views.length !== 1) f.push(`${views.length} panel views visible (${views}), want 1`);
  if (!H.n('#examples .ex-card[data-ex]')) f.push('missing .ex-card buttons');
  if (!document.querySelector('footer#foot')) f.push('missing footer#foot');
  const tip = document.querySelector('#tip'); if (!tip || tip.getAttribute('role') !== 'tooltip') f.push('missing #tip role=tooltip');
  const sr = document.querySelector('#sr-live'); if (!sr || sr.getAttribute('aria-live') !== 'polite') f.push('missing #sr-live aria-live=polite');
  if (!document.querySelector('noscript')) f.push('missing <noscript>');
  if (H.vis('#offline')) f.push('#offline shows while live'); if (H.vis('#load-fail')) f.push('#load-fail shows after a good load');
  return f;
};

// chip values may use the new URL words or the legacy codes
const CHIPS = { still: 'photo', camera: 'cctv', licenses: 'dmv', mugshots: 'mug', robbery: 'serious', shoplifting: 'minor', local: 'local', state: 'state', drone: 'drone', bodycam: 'bodycam' };
const CHIP_CHECK = (want) => {
  const H = window.__qaH, f = [];
  for (const [ctl, [a, b]] of Object.entries(want)) { const v = H.pressed(ctl); if (v === null) f.push(`missing [data-ctl=${ctl}] group`); else if (v !== a && v !== b) f.push(`${ctl} chip pressed is "${v}", want ${a}`); }
  return f;
};
const caseChips = (police, photo, search, crime) => ({ police: [police, CHIPS[police]], photo: [photo, CHIPS[photo]], search: [search, CHIPS[search]], crime: [crime, CHIPS[crime]] });

// ---------- the 16 scenarios (design §5.2) ----------
function scenarios(baseUrl) {
  const live = readLive();
  return [
    { id: 'overview', hash: '#/', act: async (pg) => {
        const sel = (await pg.$('.ov-row[data-rule="1"] .acc-b')) ? '.ov-row[data-rule="1"] .acc-b' : pg.locator('#pn-overview .ov-row .acc-b', { hasText: /judge/i });
        const e = await tryClick(pg, sel); return e ? [e] : [];
      },
      expect: () => { const H = window.__qaH, f = [];
        if (!H.vis('#pn-overview')) f.push('#pn-overview not visible');
        if (H.n('.ov-row') !== 7) f.push(`${H.n('.ov-row')} .ov-row, want 7`);
        if (H.n('.tile.is-sel')) f.push('a tile is selected on the overview');
        const open = [...document.querySelectorAll('.ov-row .acc-b[aria-expanded="true"]')];
        if (open.length !== 1) f.push(`${open.length} overview rows open, want 1 (Judge must approve)`);
        else { if (!/judge/i.test(open[0].textContent)) f.push('the open overview row is not "Judge must approve"');
          const p = document.getElementById(open[0].getAttribute('aria-controls')); if (!p || p.hidden) f.push('open overview row panel is hidden');
          else if (!p.querySelector('.chip')) f.push('open overview row has no state chips'); }
        return f; } },
    { id: 'maryland', hash: '#/maryland', act: async (pg) => {
        const errs = [];
        for (const s of ['.sc-row[data-rule="3"] .acc-b', '.sc-row[data-rule="1"] .acc-b', '.sc-bills .acc-b']) { const e = await tryClick(pg, s); if (e) errs.push(e); }
        return errs;
      },
      expect: () => { const H = window.__qaH, f = [];
        if (!H.vis('#pn-score')) f.push('#pn-score not visible');
        if (!/Maryland/.test(H.text('#pn-title') || '')) f.push('#pn-title is not Maryland');
        const t = document.querySelector('.tile[data-st="Maryland"]'); if (!t || !t.classList.contains('is-sel') || t.getAttribute('aria-pressed') !== 'true') f.push('Maryland tile not .is-sel aria-pressed=true');
        const rows = [...document.querySelectorAll('.sc-row[data-rule]')].map((r) => r.dataset.rule);
        if (rows.join() !== '3,1,6,5,7,4,2') f.push(`.sc-row order is [${rows}], want 3,1,6,5,7,4,2`);
        if (!(H.tagClasses('.sc-row[data-rule="3"]') || []).includes('t-yes')) f.push('Serious crimes row tag is not t-yes');
        if (!(H.tagClasses('.sc-row[data-rule="1"]') || []).includes('t-no')) f.push('Judge row tag is not t-no');
        for (const s of ['.sc-row[data-rule="3"]', '.sc-row[data-rule="1"]', '.sc-bills']) { const b = document.querySelector(s + ' .acc-b');
          if (!b || b.getAttribute('aria-expanded') !== 'true') f.push(s + ' did not open'); else { const p = document.getElementById(b.getAttribute('aria-controls')); if (!p || p.hidden) f.push(s + ' panel hidden after opening'); } }
        if (!/HB 756/.test(H.text('.sc-row[data-rule="3"]') || '')) f.push('Serious crimes row lacks the HB 756 bill note (loose)');
        if (!/HB 756/.test(H.text('.sc-bills') || '')) f.push('bills disclosure lacks HB 756');
        if (H.vis('.sc-ban') || H.vis('.sc-zero')) f.push('Maryland shows a ban or zero-law card');
        if (!H.n('.pn-again')) f.push('missing .pn-again');
        return f; } },
    { id: 'vermont', hash: '#/vermont',
      expect: () => { const H = window.__qaH, f = [];
        if (!H.vis('.sc-ban')) f.push('.sc-ban not visible');
        if (!/Pause/i.test(H.text('.sc-ban') || '')) f.push('.sc-ban lacks the pause wording');
        if (!/H\.195/.test(H.text('.sc-ban') || '')) f.push('.sc-ban lacks the H.195 exception law');
        const t = document.querySelector('.tile[data-st="Vermont"]'); if (!t || !t.classList.contains('lb')) f.push('Vermont tile not tier lb');
        if (H.n('.sc-row[data-rule]') !== 7) f.push(`${H.n('.sc-row[data-rule]')} .sc-row, want 7`);
        return f; } },
    { id: 'virginia-state', hash: '#/virginia/case?police=state',
      expect: () => { const H = window.__qaH, f = [];
        if (!H.vis('#pn-case')) f.push('#pn-case not visible');
        const v = H.pressed('police'); if (v !== 'state') f.push(`police chip pressed is "${v}", want state`);
        if (!H.vis('.cs-note') || !(H.text('.cs-note') || '').length) f.push('ban-gap .cs-note not visible');
        if (H.n('ol.cs-steps li.cs-step[data-step]') !== 6) f.push(`${H.n('li.cs-step[data-step]')} .cs-step, want 6`);
        return f; } },
    { id: 'indiana-case', hash: '#/indiana/case',
      expect: () => { const H = window.__qaH, f = [];
        if (!H.vis('#pn-case')) f.push('#pn-case not visible');
        const steps = [...document.querySelectorAll('li.cs-step[data-step]')].map((s) => s.dataset.step);
        if (steps.join() !== 'crime,approval,search,arrest,disclose,trial') f.push(`steps are [${steps}]`);
        if (!(H.tagClasses('.cs-step[data-step="arrest"]') || []).includes('t-part')) f.push('arrest step tag is not t-part');
        if (!H.vis('.cs-result .cs-stamp') || !H.vis('.cs-result .cs-tally')) f.push('.cs-result stamp/tally not visible');
        const law = document.querySelector('.cs-step a.lnk.cs-law'); if (!law || !/^#\/indiana\?open=/.test(law.getAttribute('href') || '')) f.push('no "See the law" link of form #/indiana?open=…');
        return f; }, chips: caseChips('local', 'still', 'licenses', 'robbery') },
    { id: 'illinois-drone', hash: '#/illinois/case?photo=drone',
      expect: () => { const H = window.__qaH, f = [];
        if (!(H.tagClasses('.cs-step[data-step="search"]') || []).includes('t-stop')) f.push('search step tag is not t-stop');
        for (const s of ['arrest', 'disclose']) if (!(H.tagClasses(`.cs-step[data-step="${s}"]`) || []).includes('t-skip')) f.push(`${s} step tag is not t-skip`);
        if (!H.vis('.cs-stamp')) f.push('.cs-stamp not visible');
        return f; }, chips: caseChips('local', 'drone', 'licenses', 'robbery') },
    { id: 'montana-shoplifting', hash: '#/montana/case?photo=camera&search=mugshots&crime=shoplifting',
      expect: () => { const H = window.__qaH, f = [];
        if (!(H.tagClasses('.cs-step[data-step="crime"]') || []).includes('t-stop')) f.push('crime step tag is not t-stop');
        if (!(H.tagClasses('.cs-step[data-step="approval"]') || []).includes('t-skip')) f.push('approval step tag is not t-skip');
        return f; }, chips: caseChips('local', 'camera', 'mugshots', 'shoplifting') },
    { id: 'kentucky', hash: '#/kentucky',
      expect: () => { const H = window.__qaH, f = [];
        if (!H.vis('.sc-zero')) f.push('.sc-zero not visible');
        const t = document.querySelector('.tile[data-st="Kentucky"]'); if (!t || !t.classList.contains('lz')) f.push('Kentucky tile not tier lz');
        const rows = [...document.querySelectorAll('.sc-row[data-rule]')]; if (rows.length !== 7) f.push(`${rows.length} .sc-row, want 7`);
        if (rows.some((r) => !(H.tagClasses(r) || []).includes('t-no'))) f.push('a Kentucky row is not t-no');
        if (H.vis('.sc-other')) f.push('.sc-other shows in a zero state');
        return f; } },
    { id: 'ohio', hash: '#/ohio', act: async (pg) => { const e = await tryClick(pg, '.sc-bills .acc-b'); return e ? [e] : []; },
      expect: () => { const H = window.__qaH, f = [];
        const t = document.querySelector('.tile[data-st="Ohio"]'); if (!t || !t.classList.contains('l0')) f.push('Ohio tile not tier l0');
        const b = document.querySelector('.sc-bills .acc-b'); if (!b || b.getAttribute('aria-expanded') !== 'true') f.push('Ohio bills did not open');
        else { const p = document.getElementById(b.getAttribute('aria-controls')); if (!p || p.hidden || !p.textContent.trim()) f.push('Ohio bills panel empty or hidden'); }
        if ([...document.querySelectorAll('.sc-row[data-rule]')].some((r) => !(H.tagClasses(r) || []).includes('t-no'))) f.push('an Ohio row is not t-no');
        return f; } },
    { id: 'dc', hash: '#/district-of-columbia',
      expect: () => { const H = window.__qaH, f = [];
        if (!/District of Columbia/.test(H.text('#pn-title') || '')) f.push('#pn-title is not District of Columbia');
        const t = document.querySelector('.tile[data-st="District of Columbia"]'); if (!t || !t.classList.contains('is-sel')) f.push('DC tile not selected');
        if (location.hash !== '#/district-of-columbia') f.push(`hash became ${location.hash}`);
        return f; } },
    { id: 'example', hash: '#/', act: async (pg, vp) => { const e = await tryClick(pg, '.ex-card[data-ex="indiana-lineup"]', { tap: vp.mobile }); await pg.waitForTimeout(400); return e ? [e] : []; },
      expect: () => { const H = window.__qaH, f = [];
        if (!/^#\/indiana\/case/.test(location.hash) || !/ex=indiana-lineup/.test(location.hash)) f.push(`hash after the example is ${location.hash}`);
        if (!H.vis('#pn-case')) f.push('#pn-case not visible');
        if (!H.vis('.cs-lesson')) f.push('.cs-lesson not visible after an example');
        if (!(H.tagClasses('.cs-step[data-step="arrest"]') || []).includes('t-part')) f.push('arrest step tag is not t-part');
        return f; } },
    { id: 'offline', hash: '#/', noContract: true,
      route: () => (n) => { const d = clone(live); d.config.site = { status: 'offline', currentThrough: '2026-10-26', billYear: '2026' }; return d; },
      expect: () => { const H = window.__qaH, f = [];
        if (!document.body.classList.contains('is-offline')) f.push('body lacks is-offline');
        if (!H.vis('#offline')) f.push('#offline not visible'); else if (!(H.text('#offline h2') || '').length || !(H.text('#offline p') || '').length) f.push('#offline lacks h2 or p text');
        if (H.vis('#board')) f.push('#board still visible while offline');
        if (H.vis('#load-fail')) f.push('#load-fail visible while offline');
        if (!H.vis('header.site-head') || !H.vis('#title') || !H.vis('footer#foot')) f.push('header, h1 or footer hidden while offline');
        return f; } },
    { id: 'preview', hash: '#/', query: '?preview',
      expect: () => { const H = window.__qaH, f = [];
        const bar = document.querySelector('#pv-bar'); if (!bar || !H.vis(bar)) f.push('#pv-bar not visible'); else if (bar.getAttribute('role') !== 'status') f.push('#pv-bar lacks role=status');
        if (!document.body.classList.contains('is-preview')) f.push('body lacks is-preview');
        return f; } },
    { id: 'data-404', hash: '#/', route: () => (n) => (n === 0 ? { __status: 404 } : null), errorsUntilRetry: true,
      act: async (pg) => {
        const f = [];
        const st = await pg.evaluate(() => ({ err: document.body.classList.contains('is-error'), box: window.__qaH.vis('#load-fail'), btn: window.__qaH.vis('#retry') }));
        if (!st.err) f.push('body lacks is-error after a 404'); if (!st.box) f.push('#load-fail not visible after a 404'); if (!st.btn) f.push('#retry not visible after a 404');
        await pg.evaluate(() => { window.__qaRetried = true; });
        const e = await tryClick(pg, '#retry'); if (e) f.push(e);
        try { await pg.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 5000 }); } catch (x) { f.push('Try again did not reach is-ready'); }
        await pg.waitForTimeout(300);
        return f;
      },
      expect: () => { const H = window.__qaH, f = [];
        if (document.body.classList.contains('is-error')) f.push('body still is-error after Try again');
        if (H.vis('#load-fail')) f.push('#load-fail still visible after Try again');
        if (H.n('#tiles .tile') !== 51) f.push(`${H.n('#tiles .tile')} tiles after Try again`);
        return f; } },
    { id: 'old-links', hash: '#tab=case&state=Maryland&who=federal&src=drone', noContract: true,
      act: async (pg) => {
        const pairs = [
          ['#tab=case&state=Maryland&who=federal&src=drone', '#/maryland/case?photo=drone'],
          ['#state=Indiana&who=local', '#/indiana/case'],
          ['#/compare/maryland/montana', '#/maryland'],
          ['#/laws/bills?state=ohio', '#/ohio?open=bills'],
          ['#/compare/laws/judge', '#/?open=judge'],
          ['#/dc', '#/district-of-columbia'],
          ['#/washington-dc', '#/district-of-columbia'],
          ['#tab=state&state=Ohio', '#/ohio'],
          ['#/maryland/case?who=state&src=cctv&db=mug&crime=minor', '#/maryland/case?police=state&photo=camera&search=mugshots&crime=shoplifting'],
          ['#/maryland/case?step=3&whatif=bills', '#/maryland/case'],
          ['#start', '#/'],
          ['#nonsense', '#/'],
        ];
        const f = []; const base = pg.url().split('#')[0];
        for (const [from, to] of pairs) {
          await pg.goto('about:blank'); await pg.goto(base + from); await waitReady(pg);
          const h = await pg.evaluate(() => location.hash);
          if (h !== to) f.push(`${from} reached ${h || '(empty)'}, want ${to}`);
        }
        // end on the first form so the page checks see a state case view
        await pg.goto('about:blank'); await pg.goto(base + pairs[0][0]); await waitReady(pg);
        return f;
      },
      expect: () => { const H = window.__qaH, f = [];
        if (!H.vis('#pn-case')) f.push('old case link did not open the case view');
        const v = H.pressed('police'); if (v !== 'local') f.push(`who=federal should become police local, got "${v}"`);
        return f; } },
    { id: 'dropdown', hash: '#/', act: async (pg) => { const e = await tryClick(pg, '#state-dd'); return e ? [e] : []; },
      expect: () => { const H = window.__qaH, f = [];
        const dd = document.querySelector('#state-dd'); if (!dd || dd.getAttribute('aria-expanded') !== 'true') f.push('#state-dd not aria-expanded=true after click');
        if (!H.vis('#state-dd-list[role=listbox]')) f.push('#state-dd-list listbox not visible');
        const n = document.querySelectorAll('#state-dd-list [role=option]').length; if (n < 51) f.push(`${n} dropdown options, want 51`);
        return f; } },
  ];
}

// ---------- per-viewport extra passes ----------
async function keyboardScript(ctx, base) {
  const f = []; const pg = await ctx.newPage();
  const step = async (label, fn) => { try { const r = await fn(); if (r) f.push(`${label}: ${r}`); } catch (e) { f.push(`${label}: ${String(e.message).split('\n')[0].slice(0, 100)}`); } };
  try {
    await pg.goto(base + '#/'); await waitReady(pg);
    await step('tiles', async () => {
      const t = pg.locator('#tiles .tile[tabindex="0"]').first(); if (!(await t.count())) return 'no tile with tabindex=0';
      await t.focus(); const before = await pg.evaluate(() => document.activeElement.dataset.st);
      await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(80);
      const a = await pg.evaluate(() => { const e = document.activeElement; return { st: e.dataset.st, tile: e.matches('.tile'), ti: e.tabIndex, zeros: [...document.querySelectorAll('#tiles .tile')].filter((x) => x.tabIndex === 0).length }; });
      if (!a.tile || a.st === before) return 'ArrowRight did not move focus to another tile';
      if (a.ti !== 0 || a.zeros !== 1) return 'roving tabindex not updated by ArrowRight';
      await pg.keyboard.press('ArrowDown'); await pg.waitForTimeout(80);
      await pg.keyboard.press('Home'); await pg.waitForTimeout(80);
      const first = await pg.evaluate(() => document.activeElement === document.querySelector('#tiles .tile'));
      if (!first) return 'Home did not reach the first tile';
      await pg.keyboard.press('End'); await pg.waitForTimeout(80);
      const last = await pg.evaluate(() => { const all = document.querySelectorAll('#tiles .tile'); return document.activeElement === all[all.length - 1] ? all[all.length - 1].dataset.st : null; });
      if (!last) return 'End did not reach the last tile';
      await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
      const r = await pg.evaluate((st) => ({ h: location.hash, sel: !!document.querySelector(`.tile.is-sel[data-st="${st}"]`) }), last);
      const want = '#/' + slugOf(last);
      if (r.h !== want) return `Enter on ${last} gave hash ${r.h}, want ${want}`;
      if (!r.sel) return `Enter did not select ${last}`;
      return null;
    });
    await pg.goto('about:blank'); await pg.goto(base + '#/'); await waitReady(pg);
    await step('dropdown', async () => {
      const dd = pg.locator('#state-dd'); if (!(await dd.count())) return 'no #state-dd';
      await dd.focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
      if ((await dd.getAttribute('aria-expanded')) !== 'true') return 'Enter did not open the dropdown';
      await pg.keyboard.type('mar', { delay: 60 }); await pg.waitForTimeout(200);
      const act = await pg.evaluate(() => { const a = document.activeElement; let o = a && a.getAttribute('role') === 'option' ? a : null;
        if (!o && a) { const id = a.getAttribute('aria-activedescendant'); if (id) o = document.getElementById(id); }
        if (!o) { const l = document.querySelector('#state-dd-list'); const id = l && l.getAttribute('aria-activedescendant'); if (id) o = document.getElementById(id); }
        if (!o) o = document.querySelector('#state-dd-list [role=option].is-active, #state-dd-list [role=option][aria-selected="true"]');
        return o ? o.textContent.trim() : null; });
      if (!act || !/^Maryland/.test(act)) return `typing "mar" reached ${act || 'nothing'}`;
      await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
      const r = await pg.evaluate(() => ({ h: location.hash, x: document.querySelector('#state-dd').getAttribute('aria-expanded') }));
      if (r.h !== '#/maryland') return `Enter on Maryland gave hash ${r.h}`;
      if (r.x !== 'false') return 'dropdown still expanded after Enter';
      await dd.focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
      const e = await pg.evaluate(() => ({ x: document.querySelector('#state-dd').getAttribute('aria-expanded'), vis: window.__qaH.vis('#state-dd-list'), back: document.activeElement && document.activeElement.id === 'state-dd' }));
      if (e.x !== 'false' || e.vis) return 'Escape did not close the dropdown';
      if (!e.back) return 'Escape did not return focus to #state-dd';
      return null;
    });
    await pg.goto('about:blank'); await pg.goto(base + '#/maryland'); await waitReady(pg);
    await step('accordion', async () => {
      const b = pg.locator('.sc-row .acc-b').first(); if (!(await b.count())) return 'no .sc-row .acc-b';
      const state = () => b.evaluate((e) => ({ x: e.getAttribute('aria-expanded'), hid: (document.getElementById(e.getAttribute('aria-controls')) || { hidden: 'none' }).hidden }));
      const s0 = await state(); await b.focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
      const s1 = await state(); if (s1.x === s0.x) return 'Enter did not toggle aria-expanded';
      if (s1.x === 'true' && s1.hid !== false) return 'panel stays hidden after Enter';
      await b.focus(); await pg.keyboard.press(' '); await pg.waitForTimeout(150);
      const s2 = await state(); if (s2.x !== s0.x) return 'Space did not toggle it back';
      return null;
    });
    await step('view switch', async () => {
      const c = pg.locator('#view-switch [data-view="case"]'); if (!(await c.count())) return 'no #view-switch [data-view=case]';
      await c.focus(); await pg.keyboard.press(' '); await pg.waitForTimeout(300);
      const a = await pg.evaluate(() => ({ v: window.__qaH.vis('#pn-case'), h: location.hash }));
      if (!a.v || !/\/case/.test(a.h)) return `Space on "case" gave visible=${a.v} hash=${a.h}`;
      const s = pg.locator('#view-switch [data-view="score"]'); await s.focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
      const b = await pg.evaluate(() => ({ v: window.__qaH.vis('#pn-score'), h: location.hash }));
      if (!b.v || /\/case/.test(b.h)) return `Enter on "score" gave visible=${b.v} hash=${b.h}`;
      return null;
    });
    // Back and Forward: focus comes back to the link or title, fully inside its scroll box with room for the ring.
    // Two frames, a short delay for late fixes, then wait until the page and #panel stop scrolling.
    const settle = () => pg.evaluate(() => new Promise((res) => {
      const p = document.getElementById('panel'); const pos = () => scrollX + ',' + scrollY + ',' + (p ? p.scrollTop : 0);
      let last = pos(), still = 0, n = 0;
      const tick = () => { const now = pos(); still = now === last ? still + 1 : 0; last = now; if (still >= 5 || ++n > 150) res(); else requestAnimationFrame(tick); };
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => { last = pos(); requestAnimationFrame(tick); }, 400)));
    }));
    const fits = async (label, want) => { await settle(); const m = await pg.evaluate(FOCUS_FITS, want); if (m) f.push(`history ${label}: ${m}`); };
    const seeLaw = async (where, pickLast) => {
      const law = pg.locator('#panel a.cs-law[data-open]'); const n = await law.count();
      if (!n) { f.push(`history: no "See the law" link in ${where}`); return null; }
      const a = law.nth(pickLast ? n - 1 : Math.min(3, n - 1)); const slug = await a.getAttribute('data-open');
      await a.focus(); await pg.keyboard.press('Enter'); await settle();
      const h = await pg.evaluate(() => location.hash);
      if (!h.includes('open=' + slug)) { f.push(`history: Enter on "See the law" in ${where} gave hash ${h}`); return null; }
      return `#panel a.cs-law[data-open="${slug}"]`;
    };
    await pg.goto('about:blank'); await pg.goto(base + '#/'); await waitReady(pg);
    await step('history', async () => {
      await pg.locator('#tiles .tile[data-st="Indiana"]').focus(); await pg.keyboard.press('Enter'); await settle();
      await pg.locator('#view-switch [data-view="case"]').focus(); await pg.keyboard.press('Enter'); await settle();
      const LAW = await seeLaw('the Indiana case'); if (!LAW) return null;
      const ROW = '#pn-title, #panel .sc-row .acc-b[aria-expanded="true"]';
      await pg.goBack(); await fits('Indiana Back', LAW);
      await pg.goForward(); await fits('Indiana Forward', ROW);
      await pg.goBack(); await fits('Indiana Back again', LAW);
      await pg.goBack(); await fits('Indiana Back to the scorecard', '#pn-title');
      await pg.goBack(); await fits('Indiana Back to the overview', '#ov-title');
      await pg.goto('about:blank'); await pg.goto(base + '#/'); await waitReady(pg);
      const ex = pg.locator('#examples .ex-card[data-ex^="montana"]'); if (!(await ex.count())) return 'no Montana example card';
      await ex.focus(); await pg.keyboard.press('Enter'); await settle();
      const MT = await seeLaw('the Montana example', true); if (!MT) return null;
      await pg.goBack(); await fits('Montana Back', MT);
      return null;
    });
  } finally { await pg.close(); }
  return f;
}
// In the page: the focused element matches `want`, and its box plus 6px for the ring sits inside the screen
// and inside #panel when #panel is the scroller (overflow-y auto at 1024 and wider).
const FOCUS_FITS = (want) => {
  const a = document.activeElement, R = Math.round;
  const name = !a || a === document.body ? 'body' : (a.id ? '#' + a.id : a.tagName.toLowerCase() + '.' + [...a.classList].join('.')) + (a.getAttribute('data-open') ? `[data-open=${a.getAttribute('data-open')}]` : '');
  if (!a || !a.matches(want)) return `focus is on ${name} at ${location.hash}, want ${want}`;
  const r = a.getBoundingClientRect(), m = 6;
  let box = { top: 0, bottom: innerHeight, left: 0, right: innerWidth }, by = 'the screen';
  const p = document.getElementById('panel');
  if (p && p.contains(a) && getComputedStyle(p).overflowY === 'auto') {
    const q = p.getBoundingClientRect(); by = '#panel';
    box = { top: Math.max(0, q.top), bottom: Math.min(innerHeight, q.bottom), left: Math.max(0, q.left), right: Math.min(innerWidth, q.right) };
  }
  const tol = 0.5;
  if (r.top - m < box.top - tol || r.bottom + m > box.bottom + tol || r.left - m < box.left - tol || r.right + m > box.right + tol)
    return `${name} at y ${R(r.top)}-${R(r.bottom)} x ${R(r.left)}-${R(r.right)} is cut off by ${by} (y ${R(box.top)}-${R(box.bottom)} x ${R(box.left)}-${R(box.right)}) once 6px of ring is added`;
  return null;
};

async function motionPass(browser, vp, base) {
  const f = [];
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, reducedMotion: 'reduce' });
  await ctx.addInitScript(INIT);
  try {
    for (const h of ['#/', '#/maryland', '#/illinois/case?photo=drone']) {
      const pg = await ctx.newPage();
      await pg.goto(base + h); await waitReady(pg); await pg.waitForTimeout(600);
      const r = await pg.evaluate(() => {
        const running = document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a.animationName || a.constructor.name) + ' on ' + ((a.effect && a.effect.target && (a.effect.target.id || a.effect.target.className)) || '?'));
        const stuck = [...document.querySelectorAll('.sc-row, .ov-row, .cs-step, .cs-result, .cs-stamp, .tile, .ex-card, .tag, #pn-title, .lede')].filter((e) => {
          const r = e.getBoundingClientRect(); if (!r.width) return false; let o = 1; for (let p = e; p; p = p.parentElement) o *= +getComputedStyle(p).opacity; return o < 0.9; })
          .map((e) => (e.id || e.className)).slice(0, 5);
        return { running: [...new Set(running)].slice(0, 5), stuck };
      });
      if (r.running.length) f.push(`reduced motion ${h}: still animating after 600ms: ${r.running.join(', ')}`);
      if (r.stuck.length) f.push(`reduced motion ${h}: content stuck below 0.9 opacity: ${r.stuck.join(', ')}`);
      await pg.close();
    }
  } finally { await ctx.close(); }
  return f;
}

// ---------- static grep of play/ ----------
function staticGrep() {
  const f = [];
  const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
  const files = walk(PLAY).filter((p) => /\.(html|css|js|svg|json|md|txt)$/i.test(p));
  const rules = [
    [/Epilogue/i, 'CDT font Epilogue'], [/Geist/i, 'CDT font Geist'], [/cdt-logo/i, 'CDT logo'],
    [/#202C53\b/i, 'CDT hex #202C53'], [/#5369FF\b/i, 'CDT hex #5369FF'], [/#BFEAFF\b/i, 'CDT hex #BFEAFF'], [/#4CC6FF\b/i, 'CDT hex #4CC6FF'], [/#E2FE90\b/i, 'CDT lime #E2FE90'],
    [/<select\b/i, 'native <select'], [/<details\b/i, 'native <details'], [/(^|[^-\w.])title=/, 'title= attribute'],
    [/(^|[^.\w])(window\.)?alert\(/, 'alert('], [/(^|[^.\w])(window\.)?confirm\(/, 'confirm('], [/(^|[^.\w])(window\.)?prompt\(/, 'prompt('],
  ];
  for (const p of files) {
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => { for (const [re, what] of rules) if (re.test(line)) f.push(`${path.relative(FV, p)}:${i + 1} ${what}`); });
  }
  return f;
}

// ---------- one scenario at one viewport ----------
async function runScenario(browser, vp, sc, base, opts) {
  const issues = {};
  const add = (k, arr) => { if (arr && arr.length) issues[k] = (issues[k] || []).concat(arr); };
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile });
  await ctx.addInitScript(INIT);
  if (sc.route) await routeData(ctx, sc.route());
  const pg = await ctx.newPage();
  const errs = []; let retried = false;
  const keep = (m) => { if (sc.errorsUntilRetry && !retried) return; errs.push(m.slice(0, 160)); };
  pg.on('pageerror', (e) => keep('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') keep('console: ' + m.text()); });
  const dialogs = [];
  pg.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
  try {
    await pg.goto(base + (sc.query || '') + sc.hash);
    const ready = await waitReady(pg);
    if (!ready) add('ready', ['page never reached is-ready, is-error or is-offline within 6s']);
    if (sc.act) { add('expect', await sc.act(pg, vp)); }
    if (sc.errorsUntilRetry) retried = true;
    if (!sc.noContract) add('contract', await pg.evaluate(CONTRACT));
    add('expect', await pg.evaluate(sc.expect));
    if (sc.chips) add('expect', await pg.evaluate(CHIP_CHECK, sc.chips));
    await pg.waitForTimeout(150);
    if (opts.shots) { const d = path.join(OUT, 'shots', String(vp.w)); fs.mkdirSync(d, { recursive: true }); await pg.screenshot({ path: path.join(d, sc.id + '.png'), fullPage: true }); }
    add('axe', await runAxe(pg));
    const res = await pg.evaluate(PAGE_CHECKS, {});
    for (const [k, v] of Object.entries(res)) add(k, v);
    add('reflow', sidewaysIssues(await pg.evaluate(SIDEWAYS), ''));
    const mo = await pg.evaluate(() => { const inf = document.getAnimations().filter((a) => { const t = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming(); return t && t.iterations === Infinity; });
      return inf.length && !document.querySelector('[data-motion-toggle]') ? inf.map((a) => a.animationName || 'animation').slice(0, 3) : []; });
    if (mo.length) add('motion', [`looping animation with no [data-motion-toggle]: ${mo.join(', ')}`]);
    if (vp.w >= 1024) {
      const b = await pg.evaluate(async () => {
        const q = (s) => document.querySelector(s); const H = window.__qaH;
        if (!H.vis('#board') || !H.vis('#panel') || !H.vis('#map')) return null;
        window.scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 250));
        const L = Math.max(q('#map').getBoundingClientRect().bottom, H.vis('#examples') ? q('#examples').getBoundingClientRect().bottom : 0), R = q('#panel').getBoundingClientRect().bottom;
        window.scrollTo(0, 0); return { L: +L.toFixed(1), R: +R.toFixed(1) };
      });
      if (b && Math.abs(b.L - b.R) > 1) add('board', [`columns not flush at the end: left ends ${b.L}, panel ends ${b.R}`]);
    }
    const dl = await pg.evaluate(() => window.__qaDialogs || []);
    add('dialog', dl.concat(dialogs.map((t) => 'native ' + t)));
    if (!opts.noFocus) { const fw = await focusWalk(pg, 80); add('focus', fw.bad); }
    if (vp.w === 390) {
      await pg.addStyleTag({ content: TEXT_SPACING_CSS }); await pg.waitForTimeout(250);
      const sp = await pg.evaluate(PAGE_CHECKS, { only: ['clip', 'overlap'] });
      add('spacing', [...sp.clip, ...sp.overlap].map((x) => 'text spacing: ' + x));
      add('spacing', sidewaysIssues(await pg.evaluate(SIDEWAYS), 'text spacing: '));
    }
  } catch (e) {
    add('harness', ['scenario crashed: ' + String(e.message).split('\n')[0].slice(0, 160)]);
  } finally {
    add('console', [...new Set(errs)]);
    await ctx.close();
  }
  return issues;
}

function parseArgs(argv) {
  const o = { url: 'http://127.0.0.1:8765/play/', vp: null, only: null, shots: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') o.url = argv[++i];
    else if (a === '--vp') o.vp = argv[++i].split(',').map(Number);
    else if (a === '--only') o.only = argv[++i].split(',');
    else if (a === '--shots') o.shots = true;
    else if (a.startsWith('--url=')) o.url = a.slice(6);
    else if (a.startsWith('--vp=')) o.vp = a.slice(5).split(',').map(Number);
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',');
  }
  o.url = o.url.split('#')[0];
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { chromium } = need('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  const vps = VIEWPORTS.filter((v) => !opts.vp || opts.vp.includes(v.w));
  if (!vps.length) { console.error('no viewport matches --vp ' + opts.vp); process.exit(2); }
  const all = scenarios(opts.url);
  const pick = (id) => !opts.only || opts.only.includes(id);
  const report = { url: opts.url, when: new Date().toISOString(), viewports: vps.map((v) => `${v.w}x${v.h}`), static: [], results: [], total: 0 };
  let total = 0;
  const print = (label, issues) => {
    const n = Object.values(issues).reduce((s, v) => s + v.length, 0);
    console.log(`${label} issues: ${n}`);
    for (const [k, v] of Object.entries(issues)) for (const x of v.slice(0, 6)) console.log(`    ${k.padEnd(9)} ${x}`);
    return n;
  };
  report.static = staticGrep();
  total += print('[static] play/ grep', report.static.length ? { static: report.static } : {});
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const vp of vps) {
      for (const sc of all.filter((s) => pick(s.id))) {
        const issues = await runScenario(browser, vp, sc, opts.url, opts);
        const n = print(`[${vp.w}] ${sc.id.padEnd(19)}`, issues);
        total += n; report.results.push({ vp: vp.w, scenario: sc.id, count: n, issues });
      }
      if (pick('keyboard')) {
        const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile });
        await ctx.addInitScript(INIT);
        let k; try { k = await keyboardScript(ctx, opts.url); } catch (e) { k = ['keyboard script crashed: ' + String(e.message).split('\n')[0]]; } finally { await ctx.close(); }
        const n = print(`[${vp.w}] ${'keyboard'.padEnd(19)}`, k.length ? { keyboard: k } : {});
        total += n; report.results.push({ vp: vp.w, scenario: 'keyboard', count: n, issues: k.length ? { keyboard: k } : {} });
      }
      if (pick('motion')) {
        let m; try { m = await motionPass(browser, vp, opts.url); } catch (e) { m = ['motion pass crashed: ' + String(e.message).split('\n')[0]]; }
        const n = print(`[${vp.w}] ${'reduced-motion'.padEnd(19)}`, m.length ? { motion: m } : {});
        total += n; report.results.push({ vp: vp.w, scenario: 'reduced-motion', count: n, issues: m.length ? { motion: m } : {} });
      }
    }
  } finally { await browser.close(); }
  report.total = total;
  fs.writeFileSync(path.join(OUT, 'play-qa.json'), JSON.stringify(report, null, 1));
  console.log('TOTAL ISSUES', total);
  process.exit(total ? 1 : 0);
}

module.exports = { PAGE_CHECKS, SIDEWAYS, sidewaysIssues, INIT, TEXT_SPACING_CSS, VIEWPORTS, DATA_RE, waitReady, tryClick, routeData, runAxe, focusWalk, staticGrep, readLive, clone, need, slugOf };
if (require.main === module) main().catch((e) => { console.error(e); console.log('TOTAL ISSUES 1'); process.exit(1); });
