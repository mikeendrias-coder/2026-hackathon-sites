'use strict';
// (h) Publish flows against the fake GitHub: Preview, Deploy with diff and preview-hash guard, 409 handling,
// Undo/Restore byte for byte, the key check (no commit, one blob), friendly errors, the copy guard and the lock.
const assert = require('assert');
const H = require('./harness');
const { FV } = H.pure();
const LIVE_PATH = H.FOLDER + '/data/live.json', PREVIEW_PATH = H.FOLDER + '/data/preview.json';
const noAt = fake => fake.puts().forEach(w => assert.ok(w.message.indexOf('@') < 0, 'no @ in: ' + w.message));
const lastHtml = env => env.ui.last() ? env.ui.last().html : '';

function previewAndDeploy(f) {
  const p = f.ctx.menuPreview(); assert.ok(p.ok, JSON.stringify(p).slice(0, 400));
  const d = f.ctx.menuDeploy(); assert.ok(d.ok, JSON.stringify(d).slice(0, 400));
  assert.strictEqual(H.tokenFrom(lastHtml(f.env), 'deployConfirmed'), d.token);
  return d;
}

const tests = [
  ['Preview writes only data/preview.json, with no names or emails in the commit', () => {
    const f = H.fresh(), r = f.ctx.menuPreview();
    assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
    assert.deepStrictEqual(f.fake.puts().map(w => w.path), [PREVIEW_PATH]);
    noAt(f.fake);
    assert.ok(!/mendrias/.test(f.fake.puts()[0].message));
    const pv = JSON.parse(f.fake.file(PREVIEW_PATH).text);
    assert.ok(pv.config.words && pv.config.examples.length === 4, 'drafts are on the preview');
    assert.ok(f.env.props.document.previewLiveHash, 'preview hash stored');
    const log = H.tab(f.env, 'Change log').getDataRange().getValues().slice(-1)[0];
    assert.strictEqual(log[1], 'Preview'); assert.strictEqual(log[2], 'mendrias');
    assert.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} · mendrias$/.test(H.get(H.tab(f.env, 'Settings'), 'Value', H.settingRow(f.env, 'Last preview (auto)'))));
  }],
  ['Deploy shows the diff, then writes only data/live.json; the live file stays additive', () => {
    const f = H.fresh(), d = previewAndDeploy(f);
    assert.ok(/No map changes/.test(lastHtml(f.env)), 'map changes first');
    assert.strictEqual(f.fake.puts().length, 1, 'menuDeploy itself writes nothing');
    const putTries = () => f.fake.calls.filter(c => c.method === 'PUT').map(c => /preview\.json/.test(c.url) ? 'preview' : /live\.json/.test(c.url) ? 'live' : c.url);
    const before = putTries().length;
    const r = f.ctx.deployConfirmed(d.token);
    assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
    assert.deepStrictEqual(f.fake.puts().map(w => w.path), [PREVIEW_PATH, LIVE_PATH]);
    assert.deepStrictEqual(putTries().slice(before), ['live'], 'Deploy tries one PUT, on live.json only (even failed tries count)');
    noAt(f.fake);
    const live = JSON.parse(f.fake.file(LIVE_PATH).text);
    assert.ok(FV.additiveEqual(H.LIVE, live).ok);
    assert.strictEqual(Object.keys(live.config.words).length, 0, 'no Draft wording went live');
    assert.ok(r.live, 'the site poll saw the new file');
    const log = H.tab(f.env, 'Change log').getDataRange().getValues().slice(-1)[0];
    assert.strictEqual(log[1], 'Deploy'); assert.strictEqual(log[7], H.blobSha(H.LIVE_TEXT), 'replaced version recorded'); assert.strictEqual(log[6], H.blobSha(f.fake.file(LIVE_PATH).text));
    assert.strictEqual(f.ctx.menuDeploy().msg, 'Nothing to deploy. The live site already matches the sheet.');
  }],
  ['Deploy is blocked after an edit made since the preview', () => {
    const f = H.fresh(); assert.ok(f.ctx.menuPreview().ok);
    H.set(H.tab(f.env, 'Laws'), 'Summary', 2, 'Edited after the preview.');
    const r = f.ctx.menuDeploy();
    assert.ok(!r.ok && /changed since the last preview/.test(r.msg));
    assert.strictEqual(f.fake.puts().length, 1);
  }],
  ['Deploy is blocked after wording is approved or a site setting changes since the preview (new fields count too)', () => {
    const { WORD_KEYS } = H.pure();
    let f = H.fresh(); assert.ok(f.ctx.menuPreview().ok);
    const w = H.tab(f.env, 'Words on the page'), k = WORD_KEYS.filter(x => !/^why\./.test(x.key) && !FV.isUrlKey(x.key) && !x.fills.length)[0].key;
    H.set(w, 'Status', H.findRow(w, 'Key', k), 'Approved');
    let r = f.ctx.menuDeploy();
    assert.ok(!r.ok && /changed since the last preview/.test(r.msg), JSON.stringify(r).slice(0, 300));
    assert.strictEqual(f.fake.puts().length, 1, 'only the preview was written');
    f = H.fresh(); assert.ok(f.ctx.menuPreview().ok);
    H.setSetting(f.env, 'Next update due', '2027-03-01');
    r = f.ctx.menuDeploy();
    assert.ok(!r.ok && /changed since the last preview/.test(r.msg), JSON.stringify(r).slice(0, 300));
    f = H.fresh(); assert.ok(f.ctx.menuPreview().ok);
    const p = H.tab(f.env, 'Protections'), pr = H.findRow(p, 'Key', '3');
    H.set(p, 'Status', pr, 'Approved');
    r = f.ctx.menuDeploy();
    assert.ok(!r.ok && /changed since the last preview/.test(r.msg), 'an approved protection why counts');
    assert.strictEqual(f.fake.puts().length, 1);
  }],
  ['Preview retries a 409 on data/preview.json (re-reading the file first), then succeeds', () => {
    const f = H.fresh();
    f.fake.fail({ method: 'PUT', path: /data\/preview\.json/, code: 409, times: 2 });
    const r = f.ctx.menuPreview();
    assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
    assert.deepStrictEqual(f.fake.puts().map(w => w.path), [PREVIEW_PATH]);
    const pv = JSON.parse(f.fake.file(PREVIEW_PATH).text);
    assert.strictEqual(FV.hashInput(pv), FV.hashInput(H.buildOf(f.env, f.ctx, 'preview', H.LIVE)), 'preview.json holds the preview build');
    const seq = f.fake.calls.filter(c => /data\/preview\.json/.test(c.url)).map(c => c.method);
    assert.deepStrictEqual(seq, ['GET', 'PUT', 'GET', 'PUT', 'GET', 'PUT'], 'a fresh GET before every retry');
    assert.ok(f.env.props.document.previewLiveHash);
  }],
  ['Preview gives up after four 409s with a friendly message and writes nothing', () => {
    const f = H.fresh();
    f.fake.fail({ method: 'PUT', path: /data\/preview\.json/, code: 409, times: 4 });
    const r = f.ctx.menuPreview();
    assert.ok(!r.ok && /Someone else changed the file at the same moment/.test(r.error), JSON.stringify(r).slice(0, 300));
    assert.strictEqual(f.fake.puts().length, 0);
    assert.strictEqual(f.fake.calls.filter(c => c.method === 'PUT').length, 4, 'four tries');
    assert.ok(!f.env.props.document.previewLiveHash, 'no preview hash, so Deploy stays blocked');
    assert.strictEqual(f.fake.file(PREVIEW_PATH).text, H.LIVE_TEXT);
  }],
  ['Undo: a 409 when the live file already holds the target counts as done; other bytes give a clear error', () => {
    let f = H.fresh(), d = previewAndDeploy(f);
    assert.ok(f.ctx.deployConfirmed(d.token).ok);
    let u = f.ctx.menuUndoDeploy(); assert.ok(u.ok, JSON.stringify(u));
    f.fake.hooks.beforePut = () => { f.fake.commit({ [LIVE_PATH]: H.LIVE_TEXT }, 'someone undid it first'); };
    let r = f.ctx.undoConfirmed(u.token);
    assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
    assert.strictEqual(f.fake.file(LIVE_PATH).text, H.LIVE_TEXT);
    assert.strictEqual(r.sha, H.blobSha(H.LIVE_TEXT));
    assert.strictEqual(H.tab(f.env, 'Change log').getDataRange().getValues().slice(-1)[0][1], 'Undo');
    f = H.fresh(); d = previewAndDeploy(f);
    assert.ok(f.ctx.deployConfirmed(d.token).ok);
    u = f.ctx.menuUndoDeploy(); assert.ok(u.ok);
    const other = H.LIVE_TEXT.replace('Oct. 26, 2026', 'Oct. 27, 2026');
    f.fake.hooks.beforePut = () => { f.fake.commit({ [LIVE_PATH]: other }, 'someone else'); };
    r = f.ctx.undoConfirmed(u.token);
    assert.ok(!r.ok && /Someone else changed the live site/.test(r.error), JSON.stringify(r).slice(0, 300));
    assert.strictEqual(f.fake.file(LIVE_PATH).text, other, 'their file is left alone');
  }],
  ['a token from an old dialog does not deploy newer edits', () => {
    const f = H.fresh(), d = previewAndDeploy(f);
    H.set(H.tab(f.env, 'Laws'), 'Summary', 2, 'Edited while the dialog was open.');
    const r = f.ctx.deployConfirmed(d.token);
    assert.ok(!r.ok); assert.strictEqual(f.fake.puts().length, 1);
  }],
  ['a 409 leads to a fresh diff, then success', () => {
    const f = H.fresh(), d = previewAndDeploy(f);
    f.fake.fail({ method: 'PUT', path: /data\/live\.json/, code: 409, times: 1 });
    const r1 = f.ctx.deployConfirmed(d.token);
    assert.ok(!r1.ok && r1.again, JSON.stringify(r1));
    assert.ok(/at the same moment/.test(lastHtml(f.env)));
    const r2 = f.ctx.deployConfirmed(H.tokenFrom(lastHtml(f.env), 'deployConfirmed'));
    assert.ok(r2.ok, JSON.stringify(r2));
    assert.ok(FV.additiveEqual(H.LIVE, JSON.parse(f.fake.file(LIVE_PATH).text)).ok);
  }],
  ['someone else deploys the same data at the same moment: treated as done', () => {
    const f = H.fresh(), d = previewAndDeploy(f);
    f.fake.hooks.beforePut = () => { f.fake.commit({ [LIVE_PATH]: JSON.stringify(H.buildOf(f.env, f.ctx, 'live'), null, 1) }, 'other deploy'); };
    const r = f.ctx.deployConfirmed(d.token);
    assert.ok(r.ok && r.already, JSON.stringify(r));
  }],
  ['Undo restores the previous file byte for byte; a second Undo goes forward again', () => {
    const f = H.fresh(), d = previewAndDeploy(f);
    assert.ok(f.ctx.deployConfirmed(d.token).ok);
    const deployed = f.fake.file(LIVE_PATH).text;
    const u = f.ctx.menuUndoDeploy(); assert.ok(u.ok, JSON.stringify(u));
    assert.ok(/The sheet still has the newer edits/.test(lastHtml(f.env)));
    assert.ok(f.ctx.undoConfirmed(H.tokenFrom(lastHtml(f.env), 'undoConfirmed')).ok);
    assert.strictEqual(f.fake.file(LIVE_PATH).text, H.LIVE_TEXT);
    assert.strictEqual(f.fake.file(LIVE_PATH).sha, H.blobSha(H.LIVE_TEXT));
    f.ctx.menuUndoDeploy(); assert.ok(f.ctx.undoConfirmed(H.tokenFrom(lastHtml(f.env), 'undoConfirmed')).ok);
    assert.strictEqual(f.fake.file(LIVE_PATH).text, deployed, 'redo');
    noAt(f.fake);
  }],
  ['Undo with no deploy in the Change log falls back to the commits list', () => {
    const f = H.fresh(), older = H.LIVE_TEXT.replace('Oct. 26, 2026', 'Oct. 1, 2026');
    f.fake.commit({ [LIVE_PATH]: older }, 'older'); f.fake.commit({ [LIVE_PATH]: H.LIVE_TEXT }, 'current');
    const u = f.ctx.menuUndoDeploy(); assert.ok(u.ok, JSON.stringify(u));
    assert.ok(f.ctx.undoConfirmed(u.token).ok);
    assert.strictEqual(f.fake.file(LIVE_PATH).text, older);
  }],
  ['Restore an earlier version lists versions and restores the chosen one', () => {
    const f = H.fresh(), d = previewAndDeploy(f); f.ctx.deployConfirmed(d.token);
    const list = f.ctx.menuRestoreVersion(); assert.ok(list.ok && list.items.length >= 2);
    const first = list.items.find(i => /^commit:/.test(i.ref) && f.fake.commits.find(c => c.sha === i.ref.slice(7)).tree[LIVE_PATH] === H.blobSha(H.LIVE_TEXT));
    const r = f.ctx.restoreConfirmed(first.ref); assert.ok(r.ok);
    assert.ok(f.ctx.undoConfirmed(r.token).ok);
    assert.strictEqual(f.fake.file(LIVE_PATH).text, H.LIVE_TEXT);
    assert.strictEqual(H.tab(f.env, 'Change log').getDataRange().getValues().slice(-1)[0][1], 'Restore');
  }],
  ['the key check makes no commit and at most one blob; it reports owner, expiry and protection', () => {
    const f = H.fresh({ fake: H.newFake(null, { protected: true }) });
    const k = f.ctx.menuCheckKey();
    assert.ok(k.ok, JSON.stringify(k));
    assert.strictEqual(f.fake.puts().length, 0); assert.strictEqual(f.fake.blobPosts().length, 1);
    assert.ok(/owner mikeendrias-coder · expires 2027-02-01 · branch is protected/.test(k.msg));
    assert.ok(/^OK · owner/.test(H.get(H.tab(f.env, 'Settings'), 'Value', H.settingRow(f.env, 'GitHub key (auto)'))));
  }],
  ['Set GitHub key keeps the old key when the new one fails; saves a good one', () => {
    const f = H.fresh({ token: 'tok-good' });
    f.env.ui.promptAnswers.push({ button: 'OK', text: 'tok-bad' });
    assert.ok(!f.ctx.menuSetKey().ok); assert.strictEqual(f.env.props.script.GITHUB_TOKEN, 'tok-good');
    f.fake.tokens['tok-new'] = { login: 'cdt-bot', expires: '2027-06-01', write: true };
    f.env.ui.promptAnswers.push({ button: 'OK', text: 'tok-new' });
    assert.ok(f.ctx.menuSetKey().ok); assert.strictEqual(f.env.props.script.GITHUB_TOKEN, 'tok-new');
    assert.strictEqual(f.fake.puts().length, 0);
  }],
  ['friendly messages for 401, 403 (no write), 403 (rate limit), 404 (repo, branch) and 500', () => {
    let f = H.fresh({ token: 'tok-wrong' }); let r = f.ctx.menuPreview();
    assert.ok(/wrong or has expired/.test(r.error), r.error);
    assert.ok(/Failed: The GitHub key is wrong/.test(H.tab(f.env, 'Change log').getDataRange().getValues().slice(-1)[0][8]), 'logged');
    const ro = H.newFake(); ro.tokens['tok-ro'] = { login: 'reader', expires: '', write: false };
    f = H.fresh({ fake: ro, token: 'tok-ro' }); r = f.ctx.menuPreview();
    assert.ok(/can't write here.*Contents: Read and write/.test(r.error), r.error);
    f = H.fresh(); f.fake.fail({ method: 'GET', path: /contents/, code: 403, headers: { 'x-ratelimit-remaining': '0' } }); r = f.ctx.menuPreview();
    assert.ok(/rate limit.*hour/.test(r.error), r.error);
    f = H.fresh(); H.setSetting(f.env, 'GitHub repo', 'no-such-repo'); H.setSetting(f.env, 'Site address', 'https://mikeendrias-coder.github.io/no-such-repo/mikeendrias-coder/'); r = f.ctx.menuPreview();
    assert.ok(/no repository mikeendrias-coder\/no-such-repo/.test(r.error), r.error);
    f = H.fresh(); H.setSetting(f.env, 'Branch', 'nope'); r = f.ctx.menuPreview();
    assert.ok(/branch "nope" does not exist/.test(r.error), r.error);
    f = H.fresh(); f.fake.fail({ code: 500, times: 4 }); r = f.ctx.menuPreview();
    assert.ok(/GitHub is having problems/.test(r.error), r.error);
    assert.ok(/Details/.test(lastHtml(f.env)) && /GitHub said 500/.test(lastHtml(f.env)), 'details fold carries the raw code');
    f = H.fresh(); f.env.props.script = {}; r = f.ctx.menuPreview();
    assert.ok(/Setup › Set GitHub key/.test(r.error), r.error);
  }],
  ['5xx is retried with backoff: two 500s, then success', () => {
    const f = H.fresh(); f.fake.fail({ code: 500, times: 2 });
    assert.ok(f.ctx.menuPreview().ok); assert.ok(f.env.slept > 0);
  }],
  ['a copy of the sheet cannot publish until Publish from this sheet', () => {
    const f = H.fresh(); H.setSetting(f.env, 'Publishing sheet (auto)', 'THE-REAL-ONE');
    let r = f.ctx.menuPreview(); assert.ok(!r.ok && r.problems.some(p => p.id === 'S8' && p.sev === 'E'));
    r = f.ctx.menuDeploy(); assert.ok(!r.ok && /publishing sheet/.test(r.msg));
    assert.ok(f.ctx.menuClaimPublishing().ok);
    assert.ok(f.ctx.menuPreview().ok);
    assert.strictEqual(f.fake.puts().length, 1);
  }],
  ['someone else holding the lock stops Preview and Deploy', () => {
    const f = H.fresh(); f.env.lockBusy = true;
    assert.ok(/Someone else is publishing/.test(f.ctx.menuPreview().error));
    assert.ok(/Someone else is publishing/.test(f.ctx.menuDeploy().error));
    assert.strictEqual(f.fake.puts().length, 0);
  }],
  ['Check for problems writes nothing to GitHub and fills the grey columns', () => {
    const f = H.fresh(), quotes = H.tab(f.env, 'Quotes');
    H.set(quotes, 'Kind (auto)', 2, 'stale');
    const r = f.ctx.menuCheck(); assert.ok(r.ok, JSON.stringify(r.problems && r.problems.filter(p => p.sev === 'E').slice(0, 3)));
    assert.strictEqual(f.fake.writes.length, 0);
    assert.strictEqual(H.get(quotes, 'Kind (auto)', 2), 'Law');
    assert.strictEqual(H.get(H.tab(f.env, 'States'), 'Scorecard (auto)', H.findRow(H.tab(f.env, 'States'), 'State', 'Maryland')), '5 of 7 (5 full)');
    assert.ok(/none missing/.test(H.get(H.tab(f.env, 'Laws'), 'Quotes (auto)', 2)));
    assert.ok(/Face Value check/.test(f.env.ui.last().title));
  }],
  ['Check warns when GitHub has a newer script (S7); Preview warns when the key expires within 30 days', () => {
    const f = H.fresh();
    f.fake.commit({ [H.FOLDER + '/sheet/Code.gs']: "var FV_VERSION = '2.1.0';" }, 'newer script');
    assert.ok(f.ctx.menuCheck().problems.some(p => p.id === 'S7' && p.sev === 'W'));
    f.fake.tokens['tok-good'].expires = '2026-12-10 00:00:00 UTC';
    assert.ok(f.ctx.menuPreview().ok);
    assert.ok(/expires on 2026-12-10/.test(lastHtml(f.env)));
  }],
  ['menus: Start a new refresh logs the ticks and clears them; Approve selected; Check links; About', () => {
    const f = H.fresh(), cl = H.tab(f.env, 'Refresh checklist');
    H.set(cl, 'Done', 2, true); H.set(cl, 'Date done', 2, '2026-11-20');
    assert.ok(f.ctx.menuStartRefresh().saved === 1);
    assert.strictEqual(H.get(cl, 'Done', 2), false);
    assert.ok(/\[x\] Make a backup copy · 2026-11-20/.test(H.tab(f.env, 'Change log').getDataRange().getValues().slice(-1)[0][4]));
    const w = H.tab(f.env, 'Words on the page'); f.env.ss.api.setActiveRange(w.getRange('A2:C4'));
    assert.strictEqual(f.ctx.menuApproveSelected().changed, 3);
    f.env.web[H.LIVE.laws[0].link] = 200; f.env.web[H.LIVE.laws[1].link] = 404;
    const links = f.ctx.menuCheckLinks(); assert.ok(links.checked > 70 && links.bad.length > 0);
    assert.ok(/2\.0\.0/.test(f.ctx.menuAbout().version));
  }]
];
module.exports = { scenario: 'h', title: 'publish flows with fault injection', tests };
