/* Face Value play: small pure helpers (FVKit). No window, document or storage.
   Quote marks come from the Sheet: **key words**, ((also allowed)), [[exception]]. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.FVKit = f(); })(this, function () {
  'use strict';

  const str = s => (s == null ? '' : String(s));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => str(s).replace(/[&<>"']/g, c => ESC[c]);

  // fmt('Hi {state}', {state: 'Ohio'}) -> 'Hi Ohio'. Unknown placeholders stay as they are, so QA can find them.
  const fmt = (template, vars) => str(template).replace(/\{([A-Za-z0-9_.]+)\}/g, (m, k) =>
    vars && Object.prototype.hasOwnProperty.call(vars, k) && vars[k] != null ? String(vars[k]) : m);

  const slug = t => str(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const curly = t => str(t).replace(/"([^"]*)"/g, '“$1”').replace(/^"/, '“').replace(/"/g, '”');
  const unq = t => str(t).replace(/^["“]|["”]$/g, '');
  const clip = (t, n) => { t = str(t); return n > 0 && t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };

  const MARKS = /\*\*([\s\S]+?)\*\*|\(\(([\s\S]+?)\)\)|\[\[([\s\S]+?)\]\]/g;
  const plainMarks = t => str(t).replace(MARKS, (m, a, b, c) => (a != null ? a : b != null ? b : c));

  /* Safe HTML for marked text (port of app.js:326-358, no search highlight).
     badge(kind) returns the HTML of the small label ('also' or 'exc'); it shows once per kind, as before.
     n (optional) cuts to about n visible characters; marks never split. */
  function markup(text, badge, n) {
    const bd = typeof badge === 'function' ? badge : () => '';
    const segs = []; let last = 0, m; text = str(text);
    const re = new RegExp(MARKS.source, 'g');
    while ((m = re.exec(text))) {
      if (m.index > last) segs.push([text.slice(last, m.index), 0]);
      segs.push(m[1] != null ? [m[1], 1] : m[2] != null ? [m[2], 2] : [m[3], 3]);
      last = re.lastIndex;
    }
    if (last < text.length) segs.push([text.slice(last), 0]);
    let plain = segs.map(s => s[0]).join(''), tag = new Uint8Array(plain.length), p = 0, cut = false;
    segs.forEach(([t, k]) => { tag.fill(k, p, p + t.length); p += t.length; });
    if (n && plain.length > n) { plain = plain.slice(0, n).replace(/\s+\S*$/, ''); tag = tag.slice(0, plain.length); cut = true; }
    plain = curly(plain);
    let out = '', i = 0; const flagged = {};
    while (i < plain.length) {
      let j = i; while (j < plain.length && tag[j] === tag[i]) j++;
      let s = esc(plain.slice(i, j));
      const k = tag[i];
      if (k === 1) s = `<b class="kw">${s}</b>`;
      if (k >= 2) {
        const first = !flagged[k] && (i === 0 || tag[i - 1] !== k);
        s = `<span class="${k === 3 ? 'q-exc' : 'q-also'}">${first ? str(bd(k === 3 ? 'exc' : 'also')) : ''}${s}</span>`;
        if (first) flagged[k] = true;
      }
      out += s; i = j;
    }
    return out + (cut ? '…' : '');
  }

  /* A quote as HTML with outer curly quotes (port of app.js:353-355 qt/qbody).
     A quote that opens with our own lead-in (no opening quote mark) keeps its inner marks and gets no outer ones. */
  function quoteBody(text, badge, n) {
    const lead = !/^\s*["“]/.test(plainMarks(text));
    const h = markup(lead ? str(text) : unq(text), badge, n);
    if (lead) return h;
    // A leading badge sits before the opening quote mark.
    const bd = typeof badge === 'function' ? badge : () => '';
    for (const [cls, kind] of [['q-also', 'also'], ['q-exc', 'exc']]) {
      const head = `<span class="${cls}">${str(bd(kind))}`;
      if (h.startsWith(head)) return head + '“' + h.slice(head.length) + '”';
    }
    return '“' + h + '”';
  }

  // "HB 756 (2026)" -> "HB 756"; "(2025-26)" -> "2025-26" for sessionOf.
  const shortBill = name => str(name).replace(/\s*\([^()]*\)\s*$/, '').trim() || str(name).trim();
  const sessionOf = name => {
    const m = /\(([^()]*)\)\s*$/.exec(str(name)); if (!m) return '';
    const y = m[1].match(/\b(?:19|20)\d{2}(?:-\d{2,4})?\b/g);
    return y ? y[y.length - 1] : '';
  };
  const safeUrl = u => (/^https?:\/\//i.test(str(u).trim()) ? str(u).trim() : '');
  const theState = (name, cap) => (str(name) === 'District of Columbia' ? (cap ? 'The' : 'the') + ' District of Columbia' : str(name));

  return { esc, fmt, slug, curly, unq, clip, plainMarks, markup, quoteBody, shortBill, sessionOf, safeUrl, theState };
});
