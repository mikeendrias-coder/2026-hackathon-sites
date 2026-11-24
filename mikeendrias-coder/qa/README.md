# Face Value checks

Runs 11 automated checks at 4 screen sizes (1440, 1280, 390 and 320 wide) on every tab, the drawer, the start screen and the result step:

1. WCAG 2.2 AA scan (axe-core)
2. Optical alignment: where the letters actually sit (from font metrics) against icons, rows and button boxes
3. Info "i" centered in its circle
4. Clipped or cut-off text
5. Clickable things overlapping
6. Clickable things at least 24 by 24 px (WCAG 2.5.8)
7. No visible text under 11 px
8. Broken images
9. No sideways scrolling, page fits the screen
10. Keyboard focus: visible ring, not covered
11. Console errors

## Run it
```
cd mikeendrias-coder/qa
npm install
pip install playwright && playwright install chromium
cd .. && python3 -m http.server 8765 &
python3 qa/qa.py
```
The last line should read `TOTAL ISSUES 0`.

## play/ checks

These check the one-page draft in `play/` and keep the root app safe. Run them from `mikeendrias-coder/` with the shared server on port 8765.
Node finds Playwright at `/home/michael/work/node_modules`. `check-defaults.cjs` needs `NODE_PATH` set to that folder; the others find it on their own.

```
node qa/play-qa.cjs                       # 6 sizes, 16 scenarios, keyboard and reduced-motion passes
node qa/play-qa.cjs --vp 390 --only maryland,keyboard --shots
node qa/worst-data.cjs                    # writes the worst-case data sets to qa/out/worst/
node qa/worst-data.cjs --run              # loads each set at 320, 390 and 1440, plus a slow network
node qa/root-compat.cjs                   # root app with v1 data vs v2 data
NODE_PATH=/home/michael/work/node_modules node qa/check-defaults.cjs \
  'http://127.0.0.1:8765/play/#/maryland@click=.acc-b' 'http://127.0.0.1:8765/play/#/maryland/case?photo=drone'
```

**play-qa.cjs.** Options: `--url` (default `http://127.0.0.1:8765/play/`), `--vp 390,1440`, `--only <ids>`, `--shots`.
Sizes: 320×640, 390×844 and 768×1024 as touch phones and tablets; 1024×768, 1280×720 and 1440×900 as desktops.
Scenario ids: overview, maryland, vermont, virginia-state, indiana-case, illinois-drone, montana-shoplifting, kentucky, ohio, dc, example, offline, preview, data-404, old-links, dropdown. Extra passes: keyboard, motion.
Each scenario checks its own content through the DOM contract (contract.md §7), then runs every page check:

1. DOM contract basics: lang, noindex, "(draft)" title, body state classes, header, board cells in order, 51 tiles, one tile in the Tab order
2. axe with wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa
3. No `select`, `details`, `[title]`, svg `<title>` or autofill inputs
4. Any `alert`, `confirm` or `prompt` call counts as an issue
5. No sideways scroll, measured against the page's clientWidth (phone emulation widens innerWidth), and no element past the right edge
6. Focus walk of up to 80 Tab stops: a 2px ring or a box-shadow, on screen, uncovered. An open listbox popup is closed with Escape first
7. Targets at least 24×24 (map tiles at least 23.5)
8. Text at least 11px, no clipped text, no overlapping controls, no broken images
   No squeezed text: over 8 characters of its own text in a box under 48px wide and over 3 lines tall
9. Icons centered on single-line text, and text centered in buttons, chips and tags
10. No leftover `{word}`, undefined, NaN, null or [object Object] in text or labels, and no raw word key (like `risk.heading`) on screen or in an aria-label
11. Board columns end flush at 1024 and wider
12. Text spacing override (WCAG 1.4.12) at 390: no clipping or overlap
13. Zero console errors (the data-404 case only counts errors after Try again)
14. Looping animation needs a `[data-motion-toggle]`; with reduced motion nothing runs after 600ms and nothing sits below 0.9 opacity
15. Static grep of `play/` for Epilogue, Geist, cdt-logo, the CDT hexes, `<select`, `<details`, `title=`, `alert(`, `confirm(` and `prompt(`

Output: `qa/out/play-qa.json`, screenshots in `qa/out/shots/<size>/<scenario>.png`, and a last line `TOTAL ISSUES N`. Exit code 1 when N is above 0.

**worst-data.cjs.** Builds 14 data sets from `data/live.json` (design §5.4): long-names, intl-text, html-injection, empty-quotes, missing-bits, zero-bills, many-bills, odd-rules, puerto-rico, no-config, long-words, offline-long, offline-empty, offline-from.
`require('./worst-data.cjs').build()` returns them for other scripts. `--run` serves each one by route interception and reports errors, clipping, overlap, squeezed text, sideways scroll, placeholders, dialogs, `javascript:` links and injected HTML.
The slow-network case throttles to 400 kbps with 400ms RTT at 390. It needs the `is-loading` state and CLS under 0.1. Last line: `WORST ISSUES N`.

**root-compat.cjs.** Loads the root app twice: (A) with `data/live.json` and (B) with a v2 file. B is `sheet/test/out/v2-preview.json` when it exists; otherwise the script builds one from live.json.
It compares page errors, the 51 tile classes, `#s-hud`, `#s-sum` and `#s-prots` for Maryland, Vermont, Kentucky and Ohio, every story's step 6 verdict, the Read the laws counts and "2026" search counts, two drawers and the `?preview` bar.
Use `--b <file>` to test another v2 file. It prints `ROOT-COMPAT OK` or the differences, with exit code 1.

**check-defaults.cjs.** A copy of `jobjd-revamp/tests/check-defaults.cjs` with a URL mode. An argument that starts with `http` is opened with `page.goto` and a 1.2s wait. An `@click=<css>` suffix clicks every match first. File arguments still use setContent.
Diff guard: the detection code is byte-identical. This command must show changes only in the loading lines:

```
diff /home/michael/work/jobjd-revamp/tests/check-defaults.cjs qa/check-defaults.cjs
12c12,14
<     await p.setContent('<meta charset="utf-8">' + fs.readFileSync(f, 'utf8'), { waitUntil: 'load' });
---
>     const [src, click] = f.split('@click='); // URL mode: "http…[@click=<css>]"; file args still use setContent
>     if (/^http/.test(src)) await p.goto(src, { waitUntil: 'load' });
>     else await p.setContent('<meta charset="utf-8">' + fs.readFileSync(src, 'utf8'), { waitUntil: 'load' });
13a16
>     if (click) { for (const h of await p.$$(click)) await h.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(300); }
```
