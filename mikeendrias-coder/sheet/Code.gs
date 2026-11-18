/**
 * Face Value: control the website from this Google Sheet.
 *
 * Menu "Face Value" (appears when the sheet opens):
 *   Check for problems        finds broken rows before anything is published
 *   Preview changes           publishes the sheet to the hidden preview page (site address + ?preview)
 *   Open preview              shows the preview link
 *   Deploy preview to live    copies the last preview to the live site
 *   Setup > Set GitHub key    stores the GitHub key (kept in Script Properties, never in a cell)
 *   Setup > Rebuild sheet     refills every tab from the live site (replaces the sheet's contents)
 *
 * The site reads data/live.json and data/preview.json in the folder named on the Settings tab.
 * The conversion between tabs and that file is in FV below. It has no Google calls, so it can be
 * tested outside the sheet (sheet/test_roundtrip.js).
 */

var FV = (function () {
  var PIDS = ['1', '2', '3', '4', '5', '6', '7'];
  var APPLIES = { 'Local police and state agencies': ['local', 'state'], 'Local police only': ['local'], 'State agencies only': ['state'], 'Anyone': ['any'] };
  var FOOTAGE = { 'Drones': 'drone', 'Body cameras': 'bodycam' };
  var LTYPE = { 'Narrow': 'narrow', 'Weaker': 'weak', 'Loosens': 'loose' };
  var WHO = { 'Local police': 'local', 'State police': 'state', 'Federal agent': 'federal' };
  var SRC = { 'Still photo': 'photo', 'Security camera': 'cctv', 'Drone': 'drone', 'Body camera': 'bodycam' };
  var DB = { "Driver's license photos": 'dmv', 'Mugshots': 'mug' };
  var CRIME = { 'Armed robbery': 'serious', 'Shoplifting': 'minor' };
  var GROUPS = { 'Bill progress': 'billSteps', 'Law status': 'lawStatus' };
  var STEPKEYS = ['crime', 'approval', 'search', 'arrest', 'disclose'];
  var RELATED = 'Related, not scored';

  var inv = function (m) { var o = {}; Object.keys(m).forEach(function (k) { o[JSON.stringify(m[k])] = k; }); return o; };
  var nameOf = function (m, v) { return inv(m)[JSON.stringify(v)] || ''; };
  var str = function (v) { return v === null || v === undefined ? '' : String(v).trim(); };
  var yes = function (v) { return v === true || /^(true|yes|x)$/i.test(str(v)); };

  // Column layouts. Protection columns end in "(1)".."(7)" so renaming a protection doesn't break them.
  function lawHead(prot) {
    return ['State', 'Name', 'Year', 'Status', 'Who it covers (as written)', 'Applies to', 'Only covers footage from', 'Only covers license photos']
      .concat(PIDS.map(function (k) { return prot[k].short + ' (' + k + ')'; }))
      .concat(['Summary', 'Citation', 'Link', 'Unclear', 'Unclear note', 'Unclear protections', 'Note',
        'Ban or pause', 'Ban covers', 'Ban text', 'Ban exceptions', 'Exception to a ban', 'Bars footage from', 'Bar text']);
  }
  function billHead(prot) {
    return ['State', 'Name', 'Year', 'Progress', 'Still alive']
      .concat(PIDS.map(function (k) { return prot[k].short + ' (' + k + ')'; }))
      .concat(['Summary', 'Sponsor', 'Link', 'Note']);
  }
  var HEAD = {
    'States': ['State', 'Law status'],
    'Quotes': ['State', 'Law or bill', 'Kind', 'Protection', 'Citation', 'Exact wording'],
    'Protections': ['ID', 'Short name', 'Description'],
    'Limits': ['Code', 'Plain words', 'Type'],
    'Labels': ['Group', 'Code', 'Shown as'],
    'Stories': ['Title', 'Description', 'State', 'Who searches', 'Photo from', 'Searched against', 'Crime'],
    'Glossary': ['Key', 'Term', 'Definition'],
    'Step notes': ['Step', 'Why it matters'],
    'Settings': ['Setting', 'Value']
  };
  var protCell = function (x, k) { return x.rules.indexOf(k) < 0 ? '' : (x.limits[k] || 'Full'); };
  var protLabel = function (prot, k) { return k ? k + ' · ' + prot[k].short : RELATED; };

  /** Site data -> {tab: rows (first row is the header)} */
  function toRows(d, settings) {
    var C = d.config, prot = C.prot, t = {};
    t['Settings'] = [HEAD['Settings']].concat(settings || []);
    t['Protections'] = [HEAD['Protections']].concat(PIDS.map(function (k) { return [k, prot[k].short, prot[k].long]; }));
    t['Limits'] = [HEAD['Limits']].concat(Object.keys(C.limits).map(function (k) { return [k, C.limits[k].text, nameOf(LTYPE, C.limits[k].type) || 'Narrow']; }));
    t['Labels'] = [HEAD['Labels']].concat(
      Object.keys(C.billSteps).map(function (k) { return ['Bill progress', k, C.billSteps[k]]; }),
      Object.keys(C.lawStatus).map(function (k) { return ['Law status', k, C.lawStatus[k]]; }));
    t['States'] = [HEAD['States']].concat(d.states.map(function (s) { return [s.name, s.law]; }));
    t['Laws'] = [lawHead(prot)].concat(d.laws.map(function (l) {
      var rr = !l.review ? '' : JSON.stringify(l.reviewRules || []) === JSON.stringify(l.rules) ? '' : (l.reviewRules.length ? l.reviewRules.join(', ') : 'none');
      return [l.state, l.name, l.year, l.status, l.who, nameOf(APPLIES, l.whoFor), nameOf(FOOTAGE, l.source), l.db === 'dmv']
        .concat(PIDS.map(function (k) { return protCell(l, k); }))
        .concat([l.does, l.cite, l.link, !!l.review, l.reviewNote || '', rr, l.note || '',
          l.ban ? l.ban.kind : '', l.ban ? nameOf(APPLIES, l.ban.who) : '', l.ban ? l.ban.text : '', l.ban ? l.ban.except : '',
          !!l.banException, l.bars ? nameOf(FOOTAGE, l.bars.src) : '', l.bars ? l.bars.text : '']);
    }));
    t['Bills'] = [billHead(prot)].concat(d.bills.map(function (b) {
      return [b.state, b.name, b.year, b.step, !!b.pending].concat(PIDS.map(function (k) { return protCell(b, k); })).concat([b.does, b.sponsor, b.link, b.note || '']);
    }));
    t['Quotes'] = [HEAD['Quotes']].concat(d.quotes.map(function (q) { return [q.state, q.item, q.kind, protLabel(prot, q.rule), q.cite, q.text]; }));
    t['Stories'] = [HEAD['Stories']].concat(C.stories.map(function (s) { return [s.t, s.d, s.state, nameOf(WHO, s.who), nameOf(SRC, s.src), nameOf(DB, s.db), nameOf(CRIME, s.crime)]; }));
    t['Glossary'] = [HEAD['Glossary']].concat(Object.keys(C.glossary).map(function (k) { return [k, C.glossary[k].term, C.glossary[k].def]; }));
    t['Step notes'] = [HEAD['Step notes']].concat(Object.keys(C.why).map(function (k) { return [k, C.why[k]]; }));
    return t;
  }

  /** {tab: rows} -> {data, errors}. Errors are [tab, row number, message]. */
  function fromRows(t, source) {
    var errors = [], err = function (tab, i, m) { errors.push([tab, i + 2, m]); };
    var body = function (tab) { return (t[tab] || []).slice(1).filter(function (r) { return r.some(function (c) { return str(c) !== '' && c !== false; }); }); };
    var col = function (tab) { var h = (t[tab] || [[]])[0].map(str); return function (row, name) { var i = h.indexOf(name); return i < 0 ? '' : row[i]; }; };

    var prot = {};
    body('Protections').forEach(function (r, i) { var k = str(r[0]); if (PIDS.indexOf(k) < 0) err('Protections', i, 'ID must be 1 to 7'); else prot[k] = { short: str(r[1]), long: str(r[2]) }; });
    PIDS.forEach(function (k) { if (!prot[k] || !prot[k].short) errors.push(['Protections', '', 'Protection ' + k + ' needs a short name']); });

    var limits = {};
    body('Limits').forEach(function (r, i) {
      var k = str(r[0]).toLowerCase(); if (!k) return err('Limits', i, 'Code is empty');
      if (limits[k]) err('Limits', i, 'Code "' + k + '" is listed twice');
      if (!LTYPE[str(r[2])]) err('Limits', i, 'Type must be Narrow, Weaker or Loosens');
      limits[k] = { text: str(r[1]), type: LTYPE[str(r[2])] || 'narrow' };
    });
    var cfgLabels = { billSteps: {}, lawStatus: {} };
    body('Labels').forEach(function (r, i) { var g = GROUPS[str(r[0])]; if (!g) return err('Labels', i, 'Group must be Bill progress or Law status'); cfgLabels[g][str(r[1])] = str(r[2]); });

    var states = body('States').map(function (r) { return { name: str(r[0]), law: str(r[1]) }; });
    var stateSet = {}; states.forEach(function (s) { stateSet[s.name] = 1; });

    var readProt = function (tab, c, r, i, x) {
      x.rules = []; x.limits = {};
      PIDS.forEach(function (k) {
        var h = t[tab][0].map(str).filter(function (n) { return /\((\d)\)\s*$/.test(n) && n.match(/\((\d)\)\s*$/)[1] === k; })[0];
        var v = str(c(r, h)); if (!v) return;
        x.rules.push(k);
        if (v.toLowerCase() !== 'full') { if (!limits[v.toLowerCase()]) err(tab, i, 'Protection ' + k + ': "' + v + '" is not a code on the Limits tab'); x.limits[k] = v.toLowerCase(); }
      });
    };
    var seen = {};
    var keyCheck = function (tab, i, x) {
      if (!stateSet[x.state]) err(tab, i, 'State "' + x.state + '" is not on the States tab');
      if (!x.name) err(tab, i, 'Name is empty');
      var key = tab + '|' + x.state + '|' + x.name; if (seen[key]) err(tab, i, x.state + ' ' + x.name + ' is listed twice'); seen[key] = 1;
    };

    var cl = col('Laws');
    var laws = body('Laws').map(function (r, i) {
      var l = { whoFor: APPLIES[str(cl(r, 'Applies to'))] || null, source: FOOTAGE[str(cl(r, 'Only covers footage from'))] || null,
        db: yes(cl(r, 'Only covers license photos')) ? 'dmv' : null, state: str(cl(r, 'State')), name: str(cl(r, 'Name')),
        status: str(cl(r, 'Status')), year: str(cl(r, 'Year')), does: str(cl(r, 'Summary')), who: str(cl(r, 'Who it covers (as written)')) };
      if (!l.whoFor) { err('Laws', i, 'Pick who the law applies to'); l.whoFor = ['local', 'state']; }
      readProt('Laws', cl, r, i, l);
      l.review = yes(cl(r, 'Unclear')); l.cite = str(cl(r, 'Citation')); l.link = str(cl(r, 'Link'));
      if (l.review) {
        var rr = str(cl(r, 'Unclear protections'));
        l.reviewRules = !rr ? l.rules.slice() : /^none$/i.test(rr) ? [] : rr.split(/[\s,;]+/).filter(Boolean);
        l.reviewRules.forEach(function (k) { if (PIDS.indexOf(k) < 0) err('Laws', i, 'Unclear protections must be numbers 1 to 7, or "none"'); });
        var rn = str(cl(r, 'Unclear note')); if (rn) l.reviewNote = rn;
      }
      var note = str(cl(r, 'Note')); if (note) l.note = note;
      var bk = str(cl(r, 'Ban or pause'));
      if (bk) {
        l.ban = { who: APPLIES[str(cl(r, 'Ban covers'))] || null, kind: bk, text: str(cl(r, 'Ban text')), except: str(cl(r, 'Ban exceptions')) };
        if (!l.ban.who) err('Laws', i, 'Pick who the ban covers');
        if (!l.ban.text) err('Laws', i, 'A ban needs Ban text');
      }
      if (yes(cl(r, 'Exception to a ban'))) l.banException = true;
      var bs = str(cl(r, 'Bars footage from'));
      if (bs) { l.bars = { src: FOOTAGE[bs], text: str(cl(r, 'Bar text')) }; if (!l.bars.text) err('Laws', i, 'A bar needs Bar text'); }
      keyCheck('Laws', i, l);
      return l;
    });

    var cb = col('Bills');
    var bills = body('Bills').map(function (r, i) {
      var b = { state: str(cb(r, 'State')), name: str(cb(r, 'Name')), pending: yes(cb(r, 'Still alive')), year: str(cb(r, 'Year')), step: str(cb(r, 'Progress')), does: str(cb(r, 'Summary')) };
      readProt('Bills', cb, r, i, b);
      b.sponsor = str(cb(r, 'Sponsor')); b.link = str(cb(r, 'Link'));
      var note = str(cb(r, 'Note')); if (note) b.note = note;
      if (!cfgLabels.billSteps.hasOwnProperty(b.step)) err('Bills', i, 'Progress "' + b.step + '" is not on the Labels tab');
      keyCheck('Bills', i, b);
      return b;
    });

    var items = {}; laws.forEach(function (l) { items['Law|' + l.state + '|' + l.name] = 1; }); bills.forEach(function (b) { items['Bill|' + b.state + '|' + b.name] = 1; });
    var quotes = body('Quotes').map(function (r, i) {
      var p = str(r[3]), m = p.match(/^(\d)/);
      var q = { kind: str(r[2]), state: str(r[0]), item: str(r[1]), rule: m ? m[1] : null, cite: str(r[4]), text: str(r[5]) };
      if (!m && p !== RELATED) err('Quotes', i, 'Protection must be one from the list');
      if (!items[q.kind + '|' + q.state + '|' + q.item]) err('Quotes', i, 'No ' + (q.kind || 'law or bill').toLowerCase() + ' named "' + q.item + '" in ' + q.state);
      if (!q.text) err('Quotes', i, 'Exact wording is empty');
      var marks = marksProblem(q.text); if (marks) err('Quotes', i, marks);
      return q;
    });

    var stories = body('Stories').map(function (r, i) {
      var s = { t: str(r[0]), d: str(r[1]), state: str(r[2]), who: WHO[str(r[3])], src: SRC[str(r[4])], db: DB[str(r[5])], crime: CRIME[str(r[6])] };
      if (!stateSet[s.state]) err('Stories', i, 'State "' + s.state + '" is not on the States tab');
      if (!s.who || !s.src || !s.db || !s.crime) err('Stories', i, 'Pick a value from each dropdown');
      return s;
    });
    var glossary = {}; body('Glossary').forEach(function (r) { glossary[str(r[0])] = { term: str(r[1]), def: str(r[2]) }; });
    var why = {}; body('Step notes').forEach(function (r, i) { var k = str(r[0]); if (STEPKEYS.indexOf(k) < 0) err('Step notes', i, 'Step must be one of ' + STEPKEYS.join(', ')); why[k] = str(r[1]); });

    return { errors: errors, data: { source: source, updated: new Date().toISOString(),
      config: { prot: prot, limits: limits, billSteps: cfgLabels.billSteps, lawStatus: cfgLabels.lawStatus, stories: stories, glossary: glossary, why: why },
      states: states, laws: laws, bills: bills, quotes: quotes } };
  }

  function marksProblem(t) {
    var rest = t.replace(/\*\*[\s\S]+?\*\*|\(\([\s\S]+?\)\)|\[\[[\s\S]+?\]\]/g, '');
    if (/\*\*/.test(rest)) return 'A ** mark is not closed';
    if (/\(\(/.test(rest)) return 'A (( mark is not closed with ))';
    if (/\[\[/.test(rest)) return 'A [[ mark is not closed with ]]';
    return '';
  }

  return { toRows: toRows, fromRows: fromRows, HEAD: HEAD, APPLIES: APPLIES, FOOTAGE: FOOTAGE, LTYPE: LTYPE, WHO: WHO, SRC: SRC, DB: DB, CRIME: CRIME, RELATED: RELATED, STEPKEYS: STEPKEYS };
})();
if (typeof module !== 'undefined') module.exports = FV;

/* ======================= Google Sheets side ======================= */

var TABS = ['Start here', 'Laws', 'Bills', 'Quotes', 'States', 'Protections', 'Limits', 'Labels', 'Stories', 'Glossary', 'Step notes', 'Settings', 'Lists'];
var DEFAULT_SETTINGS = [
  ['GitHub owner', 'mikeendrias-coder'],
  ['GitHub repo', '2026-hackathon-sites'],
  ['Branch', 'mikeendrias-coder/face-value'],
  ['Folder', 'mikeendrias-coder'],
  ['Site address', 'https://mikeendrias-coder.github.io/2026-hackathon-sites/mikeendrias-coder/'],
  ['Research note', ''],
  ['Last preview', ''],
  ['Last deploy', '']
];

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Face Value')
    .addItem('Check for problems', 'menuCheck')
    .addItem('Preview changes', 'menuPreview')
    .addItem('Open preview', 'menuOpenPreview')
    .addSeparator()
    .addItem('Deploy preview to live site', 'menuDeploy')
    .addSeparator()
    .addSubMenu(ui.createMenu('Setup').addItem('Set GitHub key', 'menuSetKey').addItem('Rebuild sheet from live site', 'menuRebuild'))
    .addToUi();
}

function settings_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Settings'), o = {};
  if (sh) sh.getDataRange().getValues().slice(1).forEach(function (r) { o[String(r[0]).trim()] = String(r[1]).trim(); });
  DEFAULT_SETTINGS.forEach(function (d) { if (!o[d[0]] && d[1]) o[d[0]] = d[1]; });
  if (o['Site address'] && !/\/$/.test(o['Site address'])) o['Site address'] += '/';
  return o;
}
function setSetting_(key, value) {
  var sh = SpreadsheetApp.getActive().getSheetByName('Settings'); if (!sh) return;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  sh.appendRow([key, value]);
}

function readTabs_() {
  var ss = SpreadsheetApp.getActive(), t = {};
  ['Laws', 'Bills', 'Quotes', 'States', 'Protections', 'Limits', 'Labels', 'Stories', 'Glossary', 'Step notes'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh) throw new Error('The ' + n + ' tab is missing. Use Face Value > Setup > Rebuild sheet.');
    t[n] = sh.getDataRange().getValues().map(function (r) { return r.map(function (c) { return c instanceof Date ? Utilities.formatDate(c, 'UTC', 'yyyy') : c; }); });
  });
  return t;
}
function build_() { return FV.fromRows(readTabs_(), settings_()['Research note']); }
function hash_(d) { var c = JSON.parse(JSON.stringify(d)); delete c.updated; return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(c))); }

function showErrors_(errors) {
  var html = '<style>body{font:14px Arial;color:#202C53}table{border-collapse:collapse}td{padding:4px 8px;border-bottom:1px solid #ddd;vertical-align:top}</style>' +
    '<p><b>' + errors.length + ' problem' + (errors.length > 1 ? 's' : '') + ' to fix before publishing:</b></p><table>' +
    errors.slice(0, 200).map(function (e) { return '<tr><td>' + e[0] + '</td><td>' + (e[1] ? 'row ' + e[1] : '') + '</td><td>' + String(e[2]).replace(/</g, '&lt;') + '</td></tr>'; }).join('') + '</table>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(640).setHeight(420), 'Face Value check');
}

function menuCheck() {
  var r = build_();
  if (r.errors.length) return showErrors_(r.errors);
  var d = r.data;
  SpreadsheetApp.getUi().alert('No problems found. ' + d.laws.length + ' laws, ' + d.bills.length + ' bills, ' + d.quotes.length + ' quotes.');
}

function menuPreview() {
  var ui = SpreadsheetApp.getUi(), r = build_();
  if (r.errors.length) return showErrors_(r.errors);
  var s = settings_(), who = Session.getActiveUser().getEmail() || 'sheet';
  ghPut_(s, s['Folder'] + '/data/preview.json', JSON.stringify(r.data, null, 1), 'Face Value sheet: preview (' + who + ')');
  PropertiesService.getDocumentProperties().setProperty('previewHash', hash_(r.data));
  setSetting_('Last preview', new Date().toLocaleString() + ' by ' + who);
  previewDialog_(s, 'Preview published. It takes about a minute to show up.');
}
function menuOpenPreview() { previewDialog_(settings_(), 'The preview shows the last time someone pressed Preview.'); }
function previewDialog_(s, msg) {
  var url = s['Site address'] + '?preview';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<p style="font:14px Arial">' + msg + '</p><p style="font:14px Arial"><a href="' + url + '" target="_blank">' + url + '</a></p>').setWidth(520).setHeight(150), 'Face Value preview');
}

function menuDeploy() {
  var ui = SpreadsheetApp.getUi(), s = settings_();
  var r = build_(), changed = !r.errors.length && PropertiesService.getDocumentProperties().getProperty('previewHash') !== hash_(r.data);
  var msg = 'This copies the last preview to the live site at ' + s['Site address'] + '.' + (changed ? '\n\nThe sheet has changed since the last preview, and those changes will NOT go live. Press Preview first if you want them.' : '') + '\n\nDeploy now?';
  if (ui.alert('Deploy to the live site', msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var pv = ghGet_(s, s['Folder'] + '/data/preview.json');
  if (!pv) return ui.alert('There is no preview yet. Press Preview first.');
  var who = Session.getActiveUser().getEmail() || 'sheet';
  ghPut_(s, s['Folder'] + '/data/live.json', pv, 'Face Value sheet: deploy to live (' + who + ')');
  setSetting_('Last deploy', new Date().toLocaleString() + ' by ' + who);
  ui.alert('Deployed. The live site updates in about a minute: ' + s['Site address']);
}

function menuSetKey() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('GitHub key', 'Paste a fine-grained GitHub token that can write Contents on this one repository. It is stored with the script, not in the sheet.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || !r.getResponseText().trim()) return;
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', r.getResponseText().trim());
  var s = settings_();
  try { ghGet_(s, s['Folder'] + '/data/live.json'); ui.alert('Key saved. It can read the repository.'); }
  catch (e) { ui.alert('Key saved, but GitHub refused it: ' + e.message); }
}

/* GitHub contents API */
function gh_(s, method, path, body) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('No GitHub key yet. Use Face Value > Setup > Set GitHub key.');
  var url = 'https://api.github.com/repos/' + s['GitHub owner'] + '/' + s['GitHub repo'] + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  if (method === 'get') url += '?ref=' + encodeURIComponent(s['Branch']);
  var res = UrlFetchApp.fetch(url, { method: method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: body ? JSON.stringify(body) : undefined });
  var code = res.getResponseCode();
  if (method === 'get' && code === 404) return null;
  if (code >= 300) throw new Error('GitHub said ' + code + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}
function ghGet_(s, path) {
  var f = gh_(s, 'get', path); if (!f) return null;
  return Utilities.newBlob(Utilities.base64Decode(f.content.replace(/\n/g, ''))).getDataAsString('UTF-8');
}
function ghPut_(s, path, text, message) {
  var cur = gh_(s, 'get', path);
  return gh_(s, 'put', path, { message: message, branch: s['Branch'], sha: cur ? cur.sha : undefined,
    content: Utilities.base64Encode(text, Utilities.Charset.UTF_8) });
}

/* Setup: build every tab from the live site's data */
function menuRebuild() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Rebuild the sheet', 'This replaces every tab with the data on the live site. Edits not yet deployed will be lost. Continue?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  setupFromSite();
}
function setupFromSite() {
  var ss = SpreadsheetApp.getActive(), s = settings_();
  var d = JSON.parse(UrlFetchApp.fetch(s['Site address'] + 'data/live.json?t=' + Date.now()).getContentText());
  var settings = DEFAULT_SETTINGS.map(function (r) { return [r[0], r[0] === 'Research note' ? d.source : (s[r[0]] || r[1])]; });
  var rows = FV.toRows(d, settings);
  TABS.forEach(function (n, i) { var sh = ss.getSheetByName(n) || ss.insertSheet(n); sh.clear(); sh.clearConditionalFormatRules(); sh.getDataRange().clearDataValidations(); ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); });
  ss.getSheets().forEach(function (sh) { if (TABS.indexOf(sh.getName()) < 0 && ss.getSheets().length > TABS.length) ss.deleteSheet(sh); });
  writeStart_(ss.getSheetByName('Start here'));
  writeLists_(ss.getSheetByName('Lists'));
  Object.keys(rows).forEach(function (n) { writeTab_(ss.getSheetByName(n), rows[n]); });
  validate_(ss);
  ss.setActiveSheet(ss.getSheetByName('Start here'));
}

function writeTab_(sh, rows) {
  var w = rows[0].length;
  rows = rows.map(function (r) { while (r.length < w) r.push(''); return r.slice(0, w); });
  sh.getRange(1, 1, rows.length, w).setNumberFormat('@').setValues(rows).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('top');
  sh.getRange(1, 1, 1, w).setFontWeight('bold').setBackground('#202C53').setFontColor('#FFFFFF').setWrap(true).setVerticalAlignment('middle');
  sh.setFrozenRows(1); if (['Laws', 'Bills', 'Quotes'].indexOf(sh.getName()) >= 0) sh.setFrozenColumns(2);
  var long = /Summary|Exact wording|Description|Definition|Why it matters|Plain words|text|exceptions|note|Citation|Sponsor/i;
  rows[0].forEach(function (h, i) { sh.setColumnWidth(i + 1, long.test(h) ? 360 : /\(\d\)$/.test(h) ? 150 : 160); if (long.test(h)) sh.getRange(2, i + 1, Math.max(1, rows.length - 1), 1).setWrap(true); });
}

function writeLists_(sh) {
  var cols = [
    ['Protection values', '={"Full";FILTER(Limits!A2:A, Limits!A2:A<>"")}'],
    ['Quote protection', '={ARRAYFORMULA(Protections!A2:A8&" · "&Protections!B2:B8);"' + FV.RELATED + '"}'],
    ['States', '=FILTER(States!A2:A, States!A2:A<>"")'],
    ['Applies to', Object.keys(FV.APPLIES)], ['Footage', Object.keys(FV.FOOTAGE)], ['Ban or pause', ['Ban', 'Pause']],
    ['Law status', ['Unchanged', 'New', 'Amended']],
    ['State law status', ['No law', 'Unchanged', 'New', 'Amended', 'Unchanged (none of the seven)', 'New (none of the seven)', 'Amended (none of the seven)']],
    ['Bill progress', '=FILTER(Labels!B2:B, Labels!A2:A="Bill progress")'],
    ['Kind', ['Law', 'Bill']], ['Limit type', Object.keys(FV.LTYPE)], ['Label group', ['Bill progress', 'Law status']],
    ['Who searches', Object.keys(FV.WHO)], ['Photo from', Object.keys(FV.SRC)], ['Searched against', Object.keys(FV.DB)], ['Crime', Object.keys(FV.CRIME)],
    ['Step', FV.STEPKEYS]
  ];
  sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[0]; })]).setFontWeight('bold').setBackground('#202C53').setFontColor('#FFFFFF');
  cols.forEach(function (c, i) {
    if (typeof c[1] === 'string') sh.getRange(2, i + 1).setFormula(c[1]);
    else sh.getRange(2, i + 1, c[1].length, 1).setValues(c[1].map(function (v) { return [v]; }));
    sh.setColumnWidth(i + 1, 180);
  });
  sh.setFrozenRows(1);
  sh.getRange(1, cols.length + 2).setValue('These lists feed the dropdowns. Edit the source tabs instead of this one.');
}

function listRange_(ss, name) {
  var sh = ss.getSheetByName('Lists'), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], i = h.indexOf(name) + 1;
  return sh.getRange(2, i, 200, 1);
}
function validate_(ss) {
  var dd = function (name) { return SpreadsheetApp.newDataValidation().requireValueInRange(listRange_(ss, name), true).setAllowInvalid(false).build(); };
  var box = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  var apply = function (tab, header, rule) {
    var sh = ss.getSheetByName(tab), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    h.forEach(function (name, i) { if (header instanceof RegExp ? header.test(name) : name === header) sh.getRange(2, i + 1, 600, 1).setDataValidation(rule); });
  };
  var boxes = function (tab, header) {
    var sh = ss.getSheetByName(tab), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], i = h.indexOf(header) + 1;
    var r = sh.getRange(2, i, 600, 1), v = r.getValues().map(function (x) { return [x[0] === true || String(x[0]).toUpperCase() === 'TRUE']; });
    r.setNumberFormat('General').setValues(v).setDataValidation(box);
  };
  ['Laws', 'Bills', 'Quotes'].forEach(function (t) { apply(t, 'State', dd('States')); });
  apply('Stories', 'State', dd('States'));
  apply('Laws', /\(\d\)$/, dd('Protection values')); apply('Bills', /\(\d\)$/, dd('Protection values'));
  apply('Laws', 'Status', dd('Law status')); apply('Laws', 'Applies to', dd('Applies to')); apply('Laws', 'Ban covers', dd('Applies to'));
  apply('Laws', 'Only covers footage from', dd('Footage')); apply('Laws', 'Bars footage from', dd('Footage')); apply('Laws', 'Ban or pause', dd('Ban or pause'));
  ['Only covers license photos', 'Unclear', 'Exception to a ban'].forEach(function (h) { boxes('Laws', h); });
  boxes('Bills', 'Still alive'); apply('Bills', 'Progress', dd('Bill progress'));
  apply('Quotes', 'Kind', dd('Kind')); apply('Quotes', 'Protection', dd('Quote protection'));
  apply('States', 'Law status', dd('State law status'));
  apply('Limits', 'Type', dd('Limit type')); apply('Labels', 'Group', dd('Label group'));
  apply('Stories', 'Who searches', dd('Who searches')); apply('Stories', 'Photo from', dd('Photo from')); apply('Stories', 'Searched against', dd('Searched against')); apply('Stories', 'Crime', dd('Crime'));
  apply('Step notes', 'Step', dd('Step'));
}

function writeStart_(sh) {
  var lines = [
    ['Face Value: edit the website from this sheet'],
    [''],
    ['How it works'],
    ['1. Edit any tab. Add a bill by adding a row to Bills. Use the dropdowns and checkboxes.'],
    ['2. Face Value > Check for problems. Fix anything it lists.'],
    ['3. Face Value > Preview changes. In about a minute, the preview link shows your edits with a yellow PREVIEW bar.'],
    ['4. Face Value > Deploy preview to live site. This copies the last preview to the public site.'],
    [''],
    ['Protection columns on Laws and Bills'],
    ['Blank = the law or bill does not add this protection. "Full" = it adds it in full. A code from the Limits tab = it adds a limited version.'],
    [''],
    ['Marks in the Exact wording column (Quotes tab)'],
    ['**words**  shows the words in bold (the key words).'],
    ['((words))  highlights the words in amber with an "Also allowed" bubble (an extra permitted use).'],
    ['[[words]]  highlights the words in amber with an "Exception" bubble (a carve-out from the rule).'],
    [''],
    ['Bans'],
    ['On Laws, "Ban or pause" plus "Ban covers" and "Ban text" turn a law into a ban. A ban stops the search in Follow a case for the police it covers.'],
    ['"Bars footage from" makes a law stop any search that uses that kind of footage (for example Illinois and drones).'],
    [''],
    ['Who can publish'],
    ['Anyone who can edit this sheet can press Preview and Deploy. The GitHub key is stored with the script; people who can edit the script can see it, so share edit access only with people you trust.'],
    ['Settings holds where the site lives. To move the site to the CDT repository, change GitHub owner, Branch and Site address there and set a key for that repository.']
  ];
  sh.getRange(1, 1, lines.length, 1).setValues(lines).setFontFamily('Arial').setFontSize(11).setWrap(true).setVerticalAlignment('top');
  sh.setColumnWidth(1, 900);
  sh.getRange('A1').setFontSize(18).setFontWeight('bold').setFontColor('#202C53');
  [3, 9, 12, 17, 21].forEach(function (r) { sh.getRange(r, 1).setFontWeight('bold').setFontColor('#3F52E8'); });
}
