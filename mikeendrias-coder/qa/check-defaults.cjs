// House rule check: nothing on a page may look like the browser made it.
// Loads each built page, tabs through every control and clicks some, and reports anything that still shows a default:
// blue or auto focus rings, native tooltips (title attributes), system selects, unstyled checkboxes or sliders,
// browser search clear buttons, default link blue or underlines, and fat scrollbars.
// node check-defaults.cjs <page.html> [...]
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); let total = 0;
  for (const f of process.argv.slice(2)) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const [src, click] = f.split('@click='); // URL mode: "http…[@click=<css>]"; file args still use setContent
    if (/^http/.test(src)) await p.goto(src, { waitUntil: 'load' });
    else await p.setContent('<meta charset="utf-8">' + fs.readFileSync(src, 'utf8'), { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    if (click) { for (const h of await p.$$(click)) await h.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(300); }
    const found = await p.evaluate(async () => {
      const out = [], roots = [document]; document.querySelectorAll('*').forEach((e) => e.shadowRoot && roots.push(e.shadowRoot));
      const all = (sel) => roots.flatMap((r) => [...r.querySelectorAll(sel)]);
      const name = (e) => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 40);
      all('[title]').forEach((e) => { if (e.tagName !== 'svg' && e.closest && !e.closest('svg')) out.push(`native tooltip (title) on ${e.tagName.toLowerCase()} "${name(e)}"`); });
      all('select').forEach((e) => out.push(`a system select "${name(e)}"`));
      all('input[type=checkbox],input[type=radio],input[type=range],input[type=search],button,input,select,textarea').forEach((e) => { if (getComputedStyle(e).appearance !== 'none' && getComputedStyle(e).webkitAppearance !== 'none') out.push(`native look on ${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''} "${name(e)}"`); });
      all('a').forEach((e) => { const c = getComputedStyle(e); if (/rgb\(0, 0, 238\)|rgb\(85, 26, 139\)/.test(c.color)) out.push(`browser link blue on "${name(e)}"`); if (c.textDecorationLine.includes('underline')) out.push(`underlined link "${name(e)}"`); });
      // focus every control and read the ring it gets
      const focusable = all('a[href],button,input,select,textarea,[tabindex]').filter((e) => e.tabIndex >= 0 && e.offsetParent !== null || (e.ownerSVGElement && e.tabIndex >= 0));
      for (const e of focusable.slice(0, 400)) {
        e.focus({ focusVisible: true }); const c = getComputedStyle(e);
        const blue = /rgb\(0, 95, 204\)|rgb\(16, 16, 16\)\s*auto|-webkit-focus-ring-color/.test(c.outlineColor + ' ' + c.outlineStyle);
        if (c.outlineStyle === 'auto' || blue) out.push(`browser focus ring on ${e.tagName.toLowerCase()} "${name(e)}"`);
      }
      document.activeElement?.blur?.();
      // scrollbars: anything that scrolls must use the thin house scrollbar or hide it
      all('*').forEach((e) => { const c = getComputedStyle(e); if (/(auto|scroll)/.test(c.overflowX + c.overflowY) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) && c.scrollbarWidth === 'auto') out.push(`fat browser scrollbar on ${e.tagName.toLowerCase()}.${e.className}`); });
      return [...new Set(out)];
    });
    total += found.length;
    console.log(`${f.split('/').pop()}: ${found.length ? found.length + ' default(s)' : 'clean'}`);
    found.slice(0, 12).forEach((x) => console.log('   - ' + x));
    await p.close();
  }
  console.log(total ? `FAIL ${total}` : 'OK: no browser defaults'); await b.close(); process.exit(total ? 1 : 0);
})();
