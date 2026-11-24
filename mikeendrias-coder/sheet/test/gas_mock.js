'use strict';
// A small in-memory Google Apps Script for testing sheet/Code.gs in node.
// SpreadsheetApp (Spreadsheet, Sheet, Range, validation, conditional formats, protections, developer metadata,
// named ranges, filters), Ui, HtmlService, PropertiesService, LockService, Utilities, Session, UrlFetchApp.
// Dates are stored as wall-clock parts (like a Sheets serial) and read back as instants in the sheet's time zone.
const crypto = require('crypto');
const vm = require('vm');
const fs = require('fs');

/* ---------------- time zones ---------------- */
function wallOf(date, tz) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(date).forEach(x => { p[x.type] = x.value; });
  return { y: +p.year, m: +p.month, d: +p.day, H: +p.hour % 24, M: +p.minute, S: +p.second };
}
function instantOf(w, tz) {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.H || 0, w.M || 0, w.S || 0);
  let t = guess;
  for (let i = 0; i < 3; i++) { const x = wallOf(new Date(t), tz); t += guess - Date.UTC(x.y, x.m - 1, x.d, x.H, x.M, x.S); }
  return new Date(t);
}
const pad = (n, k = 2) => String(n).padStart(k, '0');
function fmtWall(w, fmt) { // Java-style tokens (Utilities.formatDate)
  return fmt.replace(/yyyy|MM|dd|HH|mm|ss|M|d/g, t => ({ yyyy: pad(w.y, 4), MM: pad(w.m), dd: pad(w.d), HH: pad(w.H), mm: pad(w.M), ss: pad(w.S), M: String(w.m), d: String(w.d) })[t]);
}
class WallDate { constructor(w) { this.w = { y: w.y, m: w.m, d: w.d, H: w.H || 0, M: w.M || 0, S: w.S || 0 }; } }

/* ---------------- enums ---------------- */
const ENUM = {
  ProtectionType: { RANGE: 'RANGE', SHEET: 'SHEET' },
  DeveloperMetadataVisibility: { DOCUMENT: 'DOCUMENT', PROJECT: 'PROJECT' },
  DeveloperMetadataLocationType: { SPREADSHEET: 'SPREADSHEET', SHEET: 'SHEET', COLUMN: 'COLUMN', ROW: 'ROW' },
  DataValidationCriteria: { CHECKBOX: 'CHECKBOX', DATE_IS_VALID_DATE: 'DATE_IS_VALID_DATE', VALUE_IN_RANGE: 'VALUE_IN_RANGE', VALUE_IN_LIST: 'VALUE_IN_LIST', CUSTOM_FORMULA: 'CUSTOM_FORMULA' }
};

/* ---------------- A1 helpers ---------------- */
const colLetter = c => { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const colNum = s => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
function parseA1(a1) {
  let m = /^([A-Z]+):([A-Z]+)$/.exec(a1); if (m) return { c: colNum(m[1]), nc: colNum(m[2]) - colNum(m[1]) + 1, fullCol: true };
  m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(a1); if (!m) throw new Error('mock: bad A1 ' + a1);
  const r = +m[2], c = colNum(m[1]); return m[3] ? { r, c, nr: +m[4] - r + 1, nc: colNum(m[3]) - c + 1 } : { r, c, nr: 1, nc: 1 };
}

/* ---------------- spreadsheet model ---------------- */
let SHEET_IDS = 100;
function newCell() { return { v: '', f: '', note: '', nf: '', dv: null, fmt: null }; }
function cloneVal(v) { return v instanceof WallDate ? new WallDate(v.w) : v; }
function cloneCell(c) { return { v: cloneVal(c.v), f: c.f, note: c.note, nf: c.nf, dv: c.dv ? JSON.parse(JSON.stringify(c.dv)) : null, fmt: c.fmt ? Object.assign({}, c.fmt) : null }; }

class SheetModel {
  constructor(ss, name) {
    this.ss = ss; this.name = name; this.id = SHEET_IDS++; this.hidden = false; this.tabColor = null; this.frozenRows = 0; this.frozenCols = 0;
    this.maxRows = 1000; this.maxCols = 26; this.rows = []; this.widths = {}; this.colMeta = []; this.meta = []; this.protections = []; this.cf = []; this.filter = null;
  }
  cell(r, c, create) {
    const row = this.rows[r - 1] || (create ? (this.rows[r - 1] = []) : null); if (!row) return null;
    return row[c - 1] || (create ? (row[c - 1] = newCell()) : null);
  }
  ensure(r, c) { if (r > this.maxRows) this.maxRows = r; if (c > this.maxCols) this.maxCols = c; }
  lastRow() { let n = 0; this.rows.forEach((row, i) => { if (row && row.some(c => c && (c.v !== '' || c.f))) n = i + 1; }); return n; }
  lastCol() { let n = 0; this.rows.forEach(row => { if (row) row.forEach((c, j) => { if (c && (c.v !== '' || c.f) && j + 1 > n) n = j + 1; }); }); return n; }
  shiftCols(at, n) { // insert n columns before column `at` (n < 0 deletes)
    this.rows.forEach(row => { if (!row) return; if (n > 0) row.splice(at - 1, 0, ...Array(n).fill(undefined)); else row.splice(at - 1, -n); });
    if (n > 0) this.colMeta.splice(at - 1, 0, ...Array(n).fill(undefined)); else this.colMeta.splice(at - 1, -n);
    const fix = g => { if (!g) return; if (g.c >= at) g.c = Math.max(at, g.c + n); else if (g.c + g.nc - 1 >= at) g.nc = Math.max(1, g.nc + n); };
    this.cf.forEach(rule => rule.ranges.forEach(fix)); this.protections.forEach(p => fix(p.g)); if (this.filter) fix(this.filter);
    Object.values(this.ss.named).forEach(nr => { if (nr.sheet === this) fix(nr.g); });
    const w = {}; Object.keys(this.widths).forEach(k => { const c = +k; w[c >= at ? Math.max(at, c + n) : c] = this.widths[k]; }); this.widths = w;
    this.maxCols = Math.max(1, this.maxCols + n);
  }
  shiftRows(at, n) {
    if (n > 0) this.rows.splice(at - 1, 0, ...Array(n).fill(undefined)); else this.rows.splice(at - 1, -n);
    const fix = g => { if (!g || g.full) return; if (g.r >= at) g.r = Math.max(at, g.r + n); else if (g.r + g.nr - 1 >= at) g.nr = Math.max(1, g.nr + n); };
    this.cf.forEach(rule => rule.ranges.forEach(fix)); this.protections.forEach(p => fix(p.g));
    Object.values(this.ss.named).forEach(nr => { if (nr.sheet === this) fix(nr.g); });
    this.maxRows = Math.max(1, this.maxRows + n);
  }
  clone(ss, name) {
    const s = new SheetModel(ss, name); s.id = SHEET_IDS++;
    ['hidden', 'tabColor', 'frozenRows', 'frozenCols', 'maxRows', 'maxCols'].forEach(k => { s[k] = this[k]; });
    s.rows = this.rows.map(row => row ? row.map(c => c ? cloneCell(c) : c) : row);
    s.widths = Object.assign({}, this.widths);
    s.cf = JSON.parse(JSON.stringify(this.cf));
    return s;
  }
}

class SpreadsheetModel {
  constructor(env, opts) { this.env = env; this.id = opts.id || 'SHEET-' + crypto.randomBytes(4).toString('hex'); this.name = opts.name || 'Face Value: site control sheet'; this.tz = opts.tz || 'America/New_York'; this.sheets = []; this.meta = []; this.named = {}; this.active = null; this.activeRange = null; }
  find(name) { return this.sheets.find(s => s.name === name) || null; }
  clone() {
    const ss = new SpreadsheetModel(this.env, { id: this.id, name: this.name, tz: this.tz });
    const map = new Map();
    this.sheets.forEach(s => { const c = s.clone(ss, s.name); c.id = s.id; c.colMeta = s.colMeta.map(a => a ? a.map(m => Object.assign({}, m)) : a); c.meta = s.meta.map(m => Object.assign({}, m));
      c.protections = s.protections.map(p => ({ type: p.type, g: p.g ? Object.assign({}, p.g) : null, description: p.description, warningOnly: p.warningOnly })); c.filter = s.filter ? Object.assign({}, s.filter) : null; ss.sheets.push(c); map.set(s, c); });
    ss.meta = this.meta.map(m => Object.assign({}, m));
    Object.keys(this.named).forEach(k => { const n = this.named[k]; ss.named[k] = { sheet: map.get(n.sheet), g: Object.assign({}, n.g) }; });
    ss.active = map.get(this.active) || ss.sheets[0];
    return ss;
  }
}

/* ---------------- value coercion and display ---------------- */
function coerce(ss, cell, v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) { const w = wallOf(v, ss.tz); return new WallDate(w); }
  if (v instanceof WallDate) return v;
  const text = cell.nf === '@';
  if (typeof v === 'number') return text ? String(v) : v;
  if (typeof v === 'boolean') return text ? (v ? 'TRUE' : 'FALSE') : v;
  const s = String(v);
  if (text) return s;
  if (/^-?\d+(\.\d+)?$/.test(s.trim()) && s.trim() !== '') return Number(s);
  if (/^(true|false)$/i.test(s.trim())) return /^true$/i.test(s.trim());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return new WallDate({ y: +m[1], m: +m[2], d: +m[3] });
  return s;
}
function display(cell) {
  if (!cell) return '';
  const v = cell.v;
  if (v instanceof WallDate) {
    if (/y+.*m+.*d+/i.test(cell.nf || '') && /-/.test(cell.nf)) return fmtWall(v.w, 'yyyy-MM-dd');
    return fmtWall(v.w, 'M/d/yyyy');
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}
function evalFormula(f) { const m = /^=\{"([^"]*)";/.exec(f); return m ? m[1] : ''; }

/* ---------------- wrappers ---------------- */
class DevMeta {
  constructor(list, item, loc) { this._list = list; this._item = item; this._loc = loc; }
  getKey() { return this._item.key; } getValue() { return this._item.value; } getVisibility() { return this._item.vis; }
  setValue(v) { this._item.value = v; return this; } remove() { const i = this._list.indexOf(this._item); if (i >= 0) this._list.splice(i, 1); }
  getLocation() { const loc = this._loc; return { getLocationType: () => loc.type, getColumn: () => ({ getColumn: () => loc.col() }), getSheet: () => loc.sheet }; }
}
function finderOver(items) {
  let key = null;
  const f = { withKey(k) { key = k; return f; }, withLocationType() { return f; }, find() { return items().filter(m => key === null || m.getKey() === key); } };
  return f;
}
class Protection {
  constructor(sheet, p) { this._s = sheet; this._p = p; }
  getDescription() { return this._p.description; } setDescription(d) { this._p.description = d; return this; }
  isWarningOnly() { return this._p.warningOnly; } setWarningOnly(b) { this._p.warningOnly = !!b; return this; }
  getProtectionType() { return this._p.type; }
  getRange() { const g = this._p.g; return g ? new Range(this._s, g.r, g.c, g.nr, g.nc) : new Range(this._s, 1, 1, this._s.maxRows, this._s.maxCols); }
  setRange(r) { this._p.g = { r: r._r, c: r._c, nr: r._nr, nc: r._nc }; return this; }
  remove() { const i = this._s.protections.indexOf(this._p); if (i >= 0) this._s.protections.splice(i, 1); }
  addEditor() { return this; } removeEditors() { return this; }
}

class Range {
  constructor(sheet, r, c, nr, nc, fullCol) { this._s = sheet; this._r = r; this._c = c; this._nr = nr; this._nc = nc; this._full = !!fullCol; sheet.env().guard(sheet, 'range'); if (!fullCol) sheet.ensure(r + nr - 1, c + nc - 1); }
  each(fn, create = true) { for (let i = 0; i < this._nr; i++) for (let j = 0; j < this._nc; j++) fn(this._s.cell(this._r + i, this._c + j, create), i, j); }
  grid(fn) { const out = []; for (let i = 0; i < this._nr; i++) { const row = []; for (let j = 0; j < this._nc; j++) row.push(fn(this._s.cell(this._r + i, this._c + j, false))); out.push(row); } return out; }
  getSheet() { return this._s.wrap(); }
  getRow() { return this._r; } getColumn() { return this._c; } getNumRows() { return this._nr; } getNumColumns() { return this._nc; }
  getLastRow() { return this._r + this._nr - 1; } getLastColumn() { return this._c + this._nc - 1; }
  getA1Notation() { return this._full ? colLetter(this._c) + ':' + colLetter(this._c + this._nc - 1) : colLetter(this._c) + this._r + (this._nr * this._nc > 1 ? ':' + colLetter(this._c + this._nc - 1) + (this._r + this._nr - 1) : ''); }
  getValues() { const tz = this._s.ss.tz; return this.grid(c => { if (!c) return ''; const v = c.v; return v instanceof WallDate ? instantOf(v.w, tz) : v; }); }
  getValue() { return this.getValues()[0][0]; }
  getDisplayValues() { return this.grid(display); } getDisplayValue() { return this.getDisplayValues()[0][0]; }
  setValues(vals) {
    if (!Array.isArray(vals) || vals.length !== this._nr || vals.some(r => !Array.isArray(r) || r.length !== this._nc)) throw new Error('The number of rows or columns in the data does not match the range (' + this.getA1Notation() + ').');
    this._s.env().guard(this._s, 'write');
    this.each((cell, i, j) => { const v = vals[i][j]; if (typeof v === 'string' && v.charAt(0) === '=' && v.length > 1) { cell.f = v; cell.v = evalFormula(v); } else { cell.f = ''; cell.v = coerce(this._s.ss, cell, v); } });
    return this;
  }
  setValue(v) { return this.setValues(Array.from({ length: this._nr }, () => Array(this._nc).fill(v))); }
  getFormulas() { return this.grid(c => c ? c.f : ''); } getFormula() { return this.getFormulas()[0][0]; }
  setFormula(f) { this.each(c => { c.f = f; c.v = evalFormula(f); }); return this; }
  setFormulas(fs2) { this.each((c, i, j) => { c.f = fs2[i][j]; c.v = evalFormula(fs2[i][j]); }); return this; }
  getNotes() { return this.grid(c => c ? c.note : ''); } getNote() { return this.getNotes()[0][0]; }
  setNote(n) { this.each(c => { c.note = n === null || n === undefined ? '' : String(n); }); return this; }
  setNotes(ns) { this.each((c, i, j) => { c.note = String(ns[i][j] || ''); }); return this; }
  clearNote() { this.each(c => { if (c) c.note = ''; }, false); return this; }
  setNumberFormat(f) { this.each(c => { c.nf = f; }); return this; } setNumberFormats(fs2) { this.each((c, i, j) => { c.nf = fs2[i][j]; }); return this; }
  getNumberFormat() { const c = this._s.cell(this._r, this._c); return c ? c.nf : ''; } getNumberFormats() { return this.grid(c => c ? c.nf : ''); }
  setDataValidation(rule) { this.each(c => { c.dv = rule ? rule._d : null; }); return this; }
  setDataValidations(rules) { this.each((c, i, j) => { c.dv = rules[i][j] ? rules[i][j]._d : null; }); return this; }
  getDataValidation() { const c = this._s.cell(this._r, this._c); return c && c.dv ? new DataValidation(c.dv) : null; }
  getDataValidations() { return this.grid(c => c && c.dv ? new DataValidation(c.dv) : null); }
  clearDataValidations() { this.each(c => { if (c) c.dv = null; }, false); return this; }
  fmtSet(k, v) { this.each(c => { if (v === null || v === undefined) { if (c.fmt) delete c.fmt[k]; } else { c.fmt = c.fmt || {}; c.fmt[k] = v; } }); return this; }
  setFontWeight(v) { return this.fmtSet('fontWeight', v); } setBackground(v) { return this.fmtSet('background', v); } setFontColor(v) { return this.fmtSet('fontColor', v); }
  setWrap(v) { return this.fmtSet('wrap', v); } setVerticalAlignment(v) { return this.fmtSet('vAlign', v); } setHorizontalAlignment(v) { return this.fmtSet('hAlign', v); }
  setFontFamily(v) { return this.fmtSet('fontFamily', v); } setFontSize(v) { return this.fmtSet('fontSize', v); } setFontLine(v) { return this.fmtSet('fontLine', v); }
  setBorder() { return this; } setWrapStrategy(v) { return this.fmtSet('wrapStrategy', v); }
  getBackground() { const c = this._s.cell(this._r, this._c); return (c && c.fmt && c.fmt.background) || '#ffffff'; }
  clear() { this.each(c => { if (c) { c.v = ''; c.f = ''; c.fmt = null; c.nf = ''; } }, false); return this; }
  clearContent() { this.each(c => { if (c) { c.v = ''; c.f = ''; } }, false); return this; }
  clearFormat() { this.each(c => { if (c) { c.fmt = null; c.nf = ''; } }, false); return this; }
  protect() { const p = { type: 'RANGE', g: { r: this._r, c: this._c, nr: this._nr, nc: this._nc }, description: '', warningOnly: false }; this._s.protections.push(p); return new Protection(this._s, p); }
  addDeveloperMetadata(key, value, vis) {
    if (!this._full) throw new Error('mock: developer metadata only on whole columns');
    const list = this._s.colMeta[this._c - 1] || (this._s.colMeta[this._c - 1] = []); list.push({ key, value: value === undefined ? '' : String(value), vis: vis || 'DOCUMENT' }); return this;
  }
  getDeveloperMetadata() { const list = this._s.colMeta[this._c - 1] || []; return list.map(m => new DevMeta(list, m, this._s.colLoc(m))); }
  createFilter() { this._s.filter = { r: this._r, c: this._c, nr: this._nr, nc: this._nc }; return {}; }
  activate() { this._s.ss.active = this._s; this._s.ss.activeRange = this; return this; }
  merge() { return this; } offset(r, c) { return new Range(this._s, this._r + r, this._c + c, this._nr, this._nc); }
}
class DataValidation {
  constructor(d) { this._d = d; }
  getCriteriaType() { return this._d.type; } getCriteriaValues() { return this._d.values.slice(); } getAllowInvalid() { return this._d.allowInvalid; } getHelpText() { return this._d.help; }
}
function dvBuilder() {
  const d = { type: null, values: [], allowInvalid: true, help: '' };
  const b = {
    requireCheckbox() { d.type = 'CHECKBOX'; return b; }, requireDate() { d.type = 'DATE_IS_VALID_DATE'; return b; },
    requireValueInRange(r, show) { d.type = 'VALUE_IN_RANGE'; d.values = ["'" + r._s.name + "'!" + r.getA1Notation(), show !== false]; return b; },
    requireValueInList(list, show) { d.type = 'VALUE_IN_LIST'; d.values = [list.slice(), show !== false]; return b; },
    requireFormulaSatisfied(f) { d.type = 'CUSTOM_FORMULA'; d.values = [f]; return b; },
    setAllowInvalid(x) { d.allowInvalid = !!x; return b; }, setHelpText(t) { d.help = t; return b; },
    build() { return new DataValidation(JSON.parse(JSON.stringify(d))); }
  };
  return b;
}
class CfRule {
  constructor(d, sheet) { this._d = d; this._s = sheet; }
  getBooleanCondition() { const d = this._d; return { getCriteriaValues: () => [d.formula], getCriteriaType: () => 'CUSTOM_FORMULA', getBackground: () => d.bg }; }
  getRanges() { return this._d.ranges.map(g => new Range(this._s || this._d._sheet, g.r, g.c, g.nr, g.nc)); }
}
function cfBuilder() {
  const d = { formula: '', bg: null, strike: false, fontColor: null, ranges: [] }; let sheet = null;
  const b = {
    whenFormulaSatisfied(f) { d.formula = f; return b; }, setBackground(c) { d.bg = c; return b; }, setStrikethrough(x) { d.strike = !!x; return b; }, setFontColor(c) { d.fontColor = c; return b; },
    setRanges(rs) { d.ranges = rs.map(r => { sheet = r._s; return { r: r._r, c: r._c, nr: r._nr, nc: r._nc }; }); return b; },
    build() { const r = new CfRule(JSON.parse(JSON.stringify(d)), sheet); return r; }
  };
  return b;
}

/* Sheet wrapper (the object scripts see). */
function sheetApi(s) {
  const env = () => s.ss.env;
  s.env = env;
  s.colLoc = m => ({ type: 'COLUMN', sheet: s, col: () => { for (let i = 0; i < s.colMeta.length; i++) if (s.colMeta[i] && s.colMeta[i].indexOf(m) >= 0) return i + 1; return -1; } });
  const api = {
    _m: s,
    getName: () => s.name,
    setName: n => { if (s.ss.sheets.some(x => x !== s && x.name === n)) throw new Error('A sheet with the name "' + n + '" already exists.'); s.name = n; return api; },
    getSheetId: () => s.id, getIndex: () => s.ss.sheets.indexOf(s) + 1, getParent: () => s.ss.api,
    getLastRow: () => s.lastRow(), getLastColumn: () => s.lastCol(), getMaxRows: () => s.maxRows, getMaxColumns: () => s.maxCols,
    getRange: (a, b2, c, d) => {
      if (typeof a === 'string') { const g = parseA1(a); return g.fullCol ? new Range(s, 1, g.c, s.maxRows, g.nc, true) : new Range(s, g.r, g.c, g.nr, g.nc); }
      if (a < 1 || b2 < 1 || (c !== undefined && c < 1) || (d !== undefined && d < 1)) throw new Error('mock: range out of bounds');
      return new Range(s, a, b2, c || 1, d || 1);
    },
    getDataRange: () => new Range(s, 1, 1, Math.max(s.lastRow(), 1), Math.max(s.lastCol(), 1)),
    clear: () => { env().guard(s, 'clear'); s.rows.forEach(row => row && row.forEach(c => { if (c) { c.v = ''; c.f = ''; c.fmt = null; c.nf = ''; } })); return api; },
    clearContents: () => { s.rows.forEach(row => row && row.forEach(c => { if (c) { c.v = ''; c.f = ''; } })); return api; },
    clearFormats: () => { s.rows.forEach(row => row && row.forEach(c => { if (c) { c.fmt = null; c.nf = ''; } })); return api; },
    clearConditionalFormatRules: () => { s.cf = []; },
    getConditionalFormatRules: () => s.cf.map(d => new CfRule(d, s)),
    setConditionalFormatRules: rules => { s.cf = rules.map(r => JSON.parse(JSON.stringify(r._d))); },
    setFrozenRows: n => { s.frozenRows = n; }, setFrozenColumns: n => { s.frozenCols = n; }, getFrozenRows: () => s.frozenRows, getFrozenColumns: () => s.frozenCols,
    setColumnWidth: (c, w) => { s.widths[c] = w; return api; }, getColumnWidth: c => s.widths[c] || 100, setRowHeight: () => api, autoResizeColumn: () => api,
    hideSheet: () => { s.hidden = true; return api; }, showSheet: () => { s.hidden = false; return api; }, isSheetHidden: () => s.hidden,
    setTabColor: c => { s.tabColor = c; return api; }, getTabColor: () => s.tabColor,
    activate: () => { s.ss.active = s; return api; },
    insertRowsAfter: (after, n) => { s.shiftRows(after + 1, n); return api; }, insertRowBefore: r => { s.shiftRows(r, 1); return api; }, insertRowsBefore: (r, n) => { s.shiftRows(r, n); return api; },
    deleteRow: r => { s.shiftRows(r, -1); return api; }, deleteRows: (r, n) => { s.shiftRows(r, -n); return api; },
    insertColumnsAfter: (after, n) => { s.shiftCols(after + 1, n); return api; }, insertColumnBefore: c => { s.shiftCols(c, 1); return api; }, insertColumnsBefore: (c, n) => { s.shiftCols(c, n); return api; },
    insertColumnAfter: c => { s.shiftCols(c + 1, 1); return api; }, deleteColumn: c => { s.shiftCols(c, -1); return api; }, deleteColumns: (c, n) => { s.shiftCols(c, -n); return api; },
    moveColumns: (range, dest) => { // move one column (with its cells and metadata) so it lands before `dest`
      const from = range._c; const cells = s.rows.map(row => row ? row[from - 1] : undefined), meta = s.colMeta[from - 1];
      s.rows.forEach(row => { if (row) row.splice(from - 1, 1); }); s.colMeta.splice(from - 1, 1);
      const to = dest > from ? dest - 2 : dest - 1;
      s.rows.forEach((row, i) => { if (row) { while (row.length < to) row.push(undefined); row.splice(to, 0, cells[i]); } });
      while (s.colMeta.length < to) s.colMeta.push(undefined); s.colMeta.splice(to, 0, meta);
    },
    appendRow: vals => { const r = s.lastRow() + 1; new Range(s, r, 1, 1, vals.length).setValues([vals]); return api; },
    copyTo: ssApi => { const target = ssApi._m; let name = 'Copy of ' + s.name, i = 2; while (target.find(name)) name = 'Copy of ' + s.name + ' ' + (i++); const c = s.clone(target, name); target.sheets.push(c); sheetApi(c); return c.api; },
    protect: () => { const p = { type: 'SHEET', g: null, description: '', warningOnly: false }; s.protections.push(p); return new Protection(s, p); },
    getProtections: type => s.protections.filter(p => p.type === type).map(p => new Protection(s, p)),
    addDeveloperMetadata: (key, value, vis) => { s.meta.push({ key, value: value === undefined ? '' : String(value), vis: vis || 'DOCUMENT' }); return api; },
    getDeveloperMetadata: () => s.meta.map(m => new DevMeta(s.meta, m, { type: 'SHEET', sheet: s, col: () => -1 })),
    createDeveloperMetadataFinder: () => finderOver(() => api.getDeveloperMetadata().concat(...s.colMeta.map(list => list ? list.map(m => new DevMeta(list, m, s.colLoc(m))) : []))),
    getFilter: () => s.filter ? { remove: () => { s.filter = null; }, getRange: () => new Range(s, s.filter.r, s.filter.c, s.filter.nr, s.filter.nc) } : null,
    sort: (col, asc = true) => {
      const start = Math.max(s.frozenRows, 1) + 1, last = s.lastRow(); if (last < start) return api;
      const part = s.rows.slice(start - 1, last);
      const key = row => { const c = row && row[col - 1]; return c ? String(c.v instanceof WallDate ? fmtWall(c.v.w, 'yyyy-MM-dd') : c.v) : ''; };
      part.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * (asc ? 1 : -1));
      s.rows.splice(start - 1, part.length, ...part); return api;
    }
  };
  s.api = api; return api;
}
SheetModel.prototype.wrap = function () { return this.api || sheetApi(this); };

function spreadsheetApi(ss) {
  const api = {
    _m: ss,
    getId: () => ss.id, getName: () => ss.name, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + ss.id + '/edit',
    getSpreadsheetTimeZone: () => ss.tz, setSpreadsheetTimeZone: tz => { ss.tz = tz; },
    getSheets: () => ss.sheets.map(s => s.wrap()), getSheetByName: n => { const s = ss.find(n); return s ? s.wrap() : null; },
    insertSheet: (name, index) => {
      ss.env.guard(null, 'insertSheet');
      if (name === undefined) { let i = 1; while (ss.find('Sheet' + i)) i++; name = 'Sheet' + i; }
      if (ss.find(name)) throw new Error('A sheet with the name "' + name + '" already exists. Please enter another name.');
      const s = new SheetModel(ss, name); sheetApi(s);
      if (index === undefined) ss.sheets.push(s); else ss.sheets.splice(index, 0, s);
      ss.active = s; return s.api;
    },
    deleteSheet: sh => { const i = ss.sheets.indexOf(sh._m); if (i < 0) throw new Error('mock: no such sheet'); if (ss.sheets.length === 1) throw new Error('You can\'t remove all the sheets in a document.'); ss.sheets.splice(i, 1); Object.keys(ss.named).forEach(k => { if (ss.named[k].sheet === sh._m) delete ss.named[k]; }); },
    setActiveSheet: sh => { ss.active = sh._m; return sh; }, getActiveSheet: () => (ss.active || ss.sheets[0]).wrap(),
    moveActiveSheet: pos => { const s = ss.active, i = ss.sheets.indexOf(s); ss.sheets.splice(i, 1); ss.sheets.splice(pos - 1, 0, s); },
    getActiveRange: () => ss.activeRange, setActiveRange: r => { ss.activeRange = r; ss.active = r._s; return r; },
    addDeveloperMetadata: (key, value, vis) => { ss.meta.push({ key, value: value === undefined ? '' : String(value), vis: vis || 'DOCUMENT' }); return api; },
    getDeveloperMetadata: () => ss.meta.map(m => new DevMeta(ss.meta, m, { type: 'SPREADSHEET', col: () => -1 })),
    createDeveloperMetadataFinder: () => finderOver(() => api.getDeveloperMetadata()),
    setNamedRange: (name, r) => { ss.named[name] = { sheet: r._s, g: { r: r._r, c: r._c, nr: r._nr, nc: r._nc } }; },
    getRangeByName: name => { const n = ss.named[name]; return n && ss.sheets.indexOf(n.sheet) >= 0 ? new Range(n.sheet, n.g.r, n.g.c, n.g.nr, n.g.nc) : null; },
    getNamedRanges: () => Object.keys(ss.named).map(k => ({ getName: () => k, remove: () => { delete ss.named[k]; } })),
    removeNamedRange: name => { delete ss.named[name]; },
    toast: () => {}, getUi: () => ss.env.ui.api
  };
  ss.api = api; return api;
}

/* ---------------- environment ---------------- */
function propsStore(obj) {
  return { getProperty: k => (Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : null), setProperty(k, v) { obj[k] = String(v); return this; }, deleteProperty(k) { delete obj[k]; return this; }, getProperties: () => Object.assign({}, obj), setProperties(o) { Object.assign(obj, o); return this; }, deleteAllProperties() { Object.keys(obj).forEach(k => delete obj[k]); return this; } };
}
const toSigned = buf => Array.from(buf).map(b => (b > 127 ? b - 256 : b));
const toBuf = x => (typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x.map(b => b & 255)));

function createEnv(opts = {}) {
  const env = {
    email: opts.email || 'mendrias@cdt.org', scriptTz: 'America/New_York', props: { script: {}, document: {}, user: {} }, lockBusy: false, slept: 0,
    fetchLog: [], web: opts.web || {}, github: opts.github || null, siteBase: opts.siteBase || 'https://mikeendrias-coder.github.io/2026-hackathon-sites/',
    faults: [], // [{sheet, op, times}] throws to simulate a timeout during writes
    guard(sheet, op) { for (const f of env.faults) { if (f.times > 0 && f.op === op && (!f.sheet || (sheet && sheet.name === f.sheet))) { f.times--; throw new Error('Exceeded maximum execution time'); } } }
  };
  env.ss = new SpreadsheetModel(env, { tz: opts.tz, id: opts.id });
  spreadsheetApi(env.ss);
  const first = new SheetModel(env.ss, 'Sheet1'); sheetApi(first); env.ss.sheets.push(first); env.ss.active = first;
  env.useSpreadsheet = ss => { env.ss = ss; ss.env = env; spreadsheetApi(ss); ss.sheets.forEach(s => { s.ss = ss; s.api = null; sheetApi(s); }); return ss; };

  const ui = env.ui = { menus: {}, alerts: [], prompts: [], dialogs: [], answers: [], promptAnswers: [] };
  const Button = { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO', CLOSE: 'CLOSE' };
  ui.api = {
    Button, ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO', YES_NO_CANCEL: 'YES_NO_CANCEL' },
    createMenu(name) { const m = { name, items: [], addItem(c, fn) { m.items.push({ caption: c, fn }); return m; }, addSeparator() { m.items.push({ sep: true }); return m; }, addSubMenu(sub) { m.items.push({ sub }); return m; }, addToUi() { ui.menus[name] = m; } }; return m; },
    alert(a, b, c) { const rec = c !== undefined ? { title: a, msg: b, buttons: c } : b !== undefined && /^(OK|OK_CANCEL|YES_NO|YES_NO_CANCEL)$/.test(b) ? { msg: a, buttons: b } : { title: a, msg: b }; ui.alerts.push(rec); return ui.answers.length ? ui.answers.shift() : (rec.buttons && /YES/.test(rec.buttons) ? Button.YES : Button.OK); },
    prompt(a, b, c) { ui.prompts.push({ title: a, msg: b }); const ans = ui.promptAnswers.shift() || { button: Button.CANCEL, text: '' }; return { getSelectedButton: () => ans.button, getResponseText: () => ans.text }; },
    showModalDialog(out, title) { ui.dialogs.push({ title, html: out.getContent() }); }, showModelessDialog(out, title) { ui.dialogs.push({ title, html: out.getContent() }); }, showSidebar(out) { ui.dialogs.push({ title: 'sidebar', html: out.getContent() }); }
  };
  ui.last = () => ui.dialogs[ui.dialogs.length - 1] || null;

  const SpreadsheetApp = Object.assign({
    getActive: () => env.ss.api, getActiveSpreadsheet: () => env.ss.api, getUi: () => ui.api, flush: () => {},
    newDataValidation: dvBuilder, newConditionalFormatRule: cfBuilder
  }, ENUM);
  const HtmlService = { createHtmlOutput(html) { let c = String(html || ''); const o = { setWidth: () => o, setHeight: () => o, setTitle: () => o, append: x => { c += x; return o; }, getContent: () => c }; return o; } };
  const PropertiesService = { getScriptProperties: () => propsStore(env.props.script), getDocumentProperties: () => propsStore(env.props.document), getUserProperties: () => propsStore(env.props.user) };
  const LockService = { getDocumentLock: () => ({ tryLock: () => !env.lockBusy, waitLock: () => { if (env.lockBusy) throw new Error('Lock timeout'); }, releaseLock: () => {}, hasLock: () => true }), getScriptLock: () => LockService.getDocumentLock() };
  const Session = { getActiveUser: () => ({ getEmail: () => env.email }), getEffectiveUser: () => ({ getEmail: () => env.email }), getScriptTimeZone: () => env.scriptTz };
  const Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256', SHA_1: 'sha1', MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, data) => toSigned(crypto.createHash(alg).update(toBuf(data)).digest()),
    base64Encode: data => toBuf(data).toString('base64'), base64Decode: s => toSigned(Buffer.from(s, 'base64')),
    newBlob: data => ({ getDataAsString: () => toBuf(data).toString('utf8'), getBytes: () => (typeof data === 'string' ? toSigned(Buffer.from(data)) : data) }),
    formatDate: (date, tz, fmt) => fmtWall(wallOf(date, tz), fmt), sleep: ms => { env.slept += ms; }, getUuid: () => crypto.randomUUID()
  };
  const UrlFetchApp = {
    fetch(url, o = {}) {
      env.fetchLog.push({ url, method: (o.method || 'get').toLowerCase() });
      if (env.fetchThrow) { const e = env.fetchThrow; if (e.times-- > 0) throw new Error(e.message); }
      let r;
      if (url.indexOf('https://api.github.com') === 0 && env.github) r = env.github.handle((o.method || 'get').toUpperCase(), url.slice('https://api.github.com'.length), o.headers || {}, o.payload);
      else if (url.indexOf(env.siteBase) === 0 && env.github) r = env.github.pages(url.slice(env.siteBase.length));
      else if (Object.prototype.hasOwnProperty.call(env.web, url)) r = { code: env.web[url], body: '', headers: {} };
      else r = { code: 404, body: 'not found', headers: {} };
      if (r.code >= 400 && !o.muteHttpExceptions) throw new Error('Request failed for ' + url + ' returned code ' + r.code);
      return { getResponseCode: () => r.code, getContentText: () => r.body, getHeaders: () => r.headers || {}, getAllHeaders: () => r.headers || {} };
    }
  };
  env.globals = { SpreadsheetApp, HtmlService, PropertiesService, LockService, Session, Utilities, UrlFetchApp, console: { log: () => {}, error: () => {}, warn: () => {} } };
  return env;
}

/** Runs a .gs file in a fresh vm context that shares env's services. Returns the context (its globals are the script's functions). */
function loadScript(env, file, extra) {
  const ctx = Object.assign({ module: { exports: {} }, Date, JSON, Math, encodeURIComponent, decodeURIComponent }, env.globals, extra || {});
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return ctx;
}

/** Everything a person could see or a script could read back, as plain JSON (properties excluded). */
function snapshot(ssModel) {
  const ss = ssModel || null;
  const val = v => (v instanceof WallDate ? { date: fmtWall(v.w, 'yyyy-MM-dd HH:mm:ss') } : v);
  return {
    id: ss.id, tz: ss.tz, meta: ss.meta.map(m => [m.key, m.value, m.vis]),
    named: Object.keys(ss.named).sort().map(k => [k, ss.named[k].sheet.name, ss.named[k].g]),
    sheets: ss.sheets.map(s => {
      const cells = {};
      s.rows.forEach((row, i) => row && row.forEach((c, j) => {
        if (!c) return; const o = {};
        if (c.v !== '') o.v = val(c.v); if (c.f) o.f = c.f; if (c.note) o.n = c.note; if (c.nf) o.nf = c.nf; if (c.dv) o.dv = c.dv; if (c.fmt && Object.keys(c.fmt).length) o.fmt = c.fmt;
        if (Object.keys(o).length) cells[colLetter(j + 1) + (i + 1)] = o;
      }));
      return { name: s.name, hidden: s.hidden, tabColor: s.tabColor, frozen: [s.frozenRows, s.frozenCols], max: [s.maxRows, s.maxCols], widths: s.widths,
        meta: s.meta.map(m => [m.key, m.value]), colMeta: s.colMeta.map(l => (l || []).map(m => [m.key, m.value])), protections: s.protections.map(p => [p.type, p.g, p.description, p.warningOnly]),
        cf: s.cf, filter: s.filter, cells };
    })
  };
}

module.exports = { createEnv, loadScript, snapshot, WallDate, wallOf, instantOf, colLetter };
