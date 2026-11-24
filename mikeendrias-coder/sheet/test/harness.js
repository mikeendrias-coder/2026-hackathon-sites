'use strict';
// Shared helpers for the sheet tests: fixtures, a v1 sheet built by v1's own setupFromSite(), the v2 upgrade, cell helpers.
const fs = require('fs'), path = require('path'), vm = require('vm');
const mock = require('./gas_mock');
const { GitHubFake, blobSha } = require('./github_fake');

const SHEET = path.join(__dirname, '..'), FVDIR = path.join(SHEET, '..');
const CODE = path.join(SHEET, 'Code.gs'), CODE_V1 = path.join(SHEET, 'legacy', 'Code.v1.gs');
const LIVE_TEXT = fs.readFileSync(path.join(FVDIR, 'data', 'live.json'), 'utf8');
const LIVE = JSON.parse(LIVE_TEXT);
const NOW = '2026-11-24T15:00:00.000Z', TODAY = '2026-11-24';
const FOLDER = 'mikeendrias-coder';
const SITE = 'https://mikeendrias-coder.github.io/2026-hackathon-sites/mikeendrias-coder/';

/** The pure modules from Code.gs (FV, FV1, WORD_KEYS, SHEET_TEXTS), loaded without any Google services. */
function pure(file) {
  const box = { module: { exports: {} }, console };
  vm.createContext(box); vm.runInContext(fs.readFileSync(file || CODE, 'utf8'), box, { filename: file || CODE });
  return box.module.exports;
}
function newFake(liveText, extra) {
  const files = { [FOLDER + '/data/live.json']: liveText || LIVE_TEXT, [FOLDER + '/data/preview.json']: liveText || LIVE_TEXT, [FOLDER + '/sheet/Code.gs']: fs.readFileSync(CODE, 'utf8') };
  return new GitHubFake(Object.assign({ files }, extra || {}));
}
function newEnv(opts = {}) {
  const fake = opts.fake || newFake(opts.liveText);
  const env = mock.createEnv({ tz: opts.tz || 'America/New_York', github: fake, id: opts.id || 'SHEET-LIVE-1' });
  env.fake = fake;
  env.props.script.GITHUB_TOKEN = opts.token === undefined ? 'tok-good' : opts.token;
  return env;
}
function loadV2(env) { const ctx = mock.loadScript(env, CODE); ctx.fvNow_ = () => new Date(NOW); return ctx; }
function loadV1(env) { return mock.loadScript(env, CODE_V1); }

/* ---------- sheet helpers ---------- */
const tab = (env, name) => env.ss.api.getSheetByName(name);
function headers(sh) { return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String); }
function col(sh, header) { const i = headers(sh).indexOf(header); if (i < 0) throw new Error('no column "' + header + '" on ' + sh.getName() + ': ' + headers(sh).join(' | ')); return i + 1; }
function findRow(sh, header, value) { const c = col(sh, header), v = sh.getRange(1, c, Math.max(sh.getLastRow(), 1), 1).getValues(); for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(value)) return i + 1; throw new Error('no row with ' + header + ' = ' + value + ' on ' + sh.getName()); }
function findRowWhere(sh, pairs) {
  const h = headers(sh), v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (Object.keys(pairs).every(k => String(v[i][h.indexOf(k)]) === String(pairs[k]))) return i + 1;
  throw new Error('no row matching ' + JSON.stringify(pairs));
}
function get(sh, header, row) { return sh.getRange(row, col(sh, header)).getValue(); }
function set(sh, header, row, value) { sh.getRange(row, col(sh, header)).setValue(value); }
function settingRow(env, name) { return findRow(tab(env, 'Settings'), 'Setting', name); }
function setSetting(env, name, value) { set(tab(env, 'Settings'), 'Value', settingRow(env, name), value); }

/* ---------- building sheets ---------- */
/** A v1 sheet made by v1's own setupFromSite() (with its 600-row FALSE fill), plus the realism the design asks for. */
function v1Sheet(opts = {}) {
  const env = newEnv(opts), v1 = loadV1(env);
  v1.setupFromSite();
  if (opts.realism !== false) {
    const laws = tab(env, 'Laws'), lc = laws.getLastColumn() + 1;
    laws.getRange(1, lc).setValue("Jake's notes");
    laws.getRange(3, lc).setValue('Check the 2026 amendment');
    laws.getRange(9, lc).setValue('Ask Drew');
    const scratch = env.ss.api.insertSheet('Scratch'); scratch.getRange(1, 1, 2, 2).setValues([['scratch', 'notes'], ['keep', 'me']]);
    // A column added to a fixed-header v1 tab, and a researcher's note on a cell.
    const quotes = tab(env, 'Quotes'), qc = quotes.getLastColumn() + 1;
    quotes.getRange(1, qc).setValue('Reviewer notes'); quotes.getRange(3, qc).setValue('Drew: verify pinpoint');
    laws.getRange(2, col(laws, 'Summary')).setNote('Source: committee report p.4');
    const bills = tab(env, 'Bills'); bills.insertRowBefore(10);
    const yc = col(bills, 'Year');
    [5, 20].forEach(r => { const cell = bills.getRange(r, yc); const y = Number(cell.getValue()); cell.setNumberFormat('General'); cell.setValue(y); });
  }
  return { env, fake: env.fake, v1 };
}
function upgrade(env, ctx) {
  const dry = ctx.menuUpgrade();
  if (!dry || !dry.ok) throw new Error('dry run failed: ' + JSON.stringify(dry && (dry.error || dry.mismatch || dry)));
  const run = ctx.runUpgrade(dry.hash, 'https://docs.google.com/spreadsheets/d/BACKUP/edit');
  if (!run || !run.ok) throw new Error('upgrade failed: ' + JSON.stringify(run));
  return { dry, run };
}
/** Reads the v1 tabs the way v1 did and returns v1's own JSON (J1). */
function v1Json(env) {
  const ctx = loadV1(env); return vm.runInContext('build_().data', ctx);
}
let BASE = null;
/** One upgraded sheet, built once and cloned for each test. */
function base() {
  if (BASE) return BASE;
  const { env } = v1Sheet();
  const J1 = v1Json(env);
  const ctx = loadV2(env);
  const up = upgrade(env, ctx);
  BASE = { ss: env.ss.clone(), J1, dry: up.dry };
  return BASE;
}
/** A fresh copy of the upgraded sheet with its own fake GitHub. */
function fresh(opts = {}) {
  const b = base(), env = newEnv(opts);
  env.useSpreadsheet(b.ss.clone());
  if (opts.tz) env.ss.tz = opts.tz;
  const ctx = loadV2(env);
  return { env, ctx, fake: env.fake, J1: b.J1 };
}
function modelOf(env, ctx) { return ctx.readModel_(env.ss.api); }
function buildOf(env, ctx, mode, live) { const m = modelOf(env, ctx); return ctx.FV.build(m, { mode: mode || 'preview', live: live === undefined ? LIVE : live, now: NOW }); }
function checkOf(env, ctx) { return ctx.runCheck_(ctx.ctx_(), false).problems; }
function tokenFrom(html, fn) { const m = new RegExp(fn + "\\('([^']+)'").exec(html || ''); return m ? m[1] : null; }

module.exports = { mock, GitHubFake, blobSha, SHEET, FVDIR, CODE, CODE_V1, LIVE, LIVE_TEXT, NOW, TODAY, FOLDER, SITE,
  pure, newFake, newEnv, loadV1, loadV2, tab, headers, col, findRow, findRowWhere, get, set, settingRow, setSetting,
  v1Sheet, upgrade, v1Json, base, fresh, modelOf, buildOf, checkOf, tokenFrom };
