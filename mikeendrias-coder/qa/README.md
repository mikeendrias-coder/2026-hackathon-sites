# Face Value checks

Runs 11 automated checks at 4 screen sizes (1440, 1280, 390 and 320 wide) on every tab, the drawer, the start screen and the result step:

1. WCAG 2.2 AA scan (axe-core)
2. Icon lined up with its text (tabs, buttons, rows, legend, step headers)
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
