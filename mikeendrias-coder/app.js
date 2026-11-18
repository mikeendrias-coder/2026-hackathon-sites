/* Face Value app. Reads window.FRT_DATA from data.js.
   The legal logic (judge, ruleStatus, effective, computeCase) is carried over from the hackathon version. */
(() => {
const D = window.FRT_DATA;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IC = k => `icons/${k}.svg`;
const img = (k, w = 32, cls = '') => `<img class="px ${cls}" src="${IC(k)}" width="${w}" height="${w}" alt="">`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const find = (list, k) => list.find(x => x[0] === k);
const unq = t => String(t).replace(/^["“]|["”]$/g, '');

/* ================= plain-language content ================= */
const PROT = {
  '1': { short: 'Judge must approve', long: 'A judge has to approve the search first, with a warrant or court order.', step: 'approval' },
  '2': { short: 'Person charged is told', long: 'Someone charged with a crime has to be told face recognition was used on them.', step: 'disclose' },
  '3': { short: 'Serious crimes only', long: 'Police can only use face recognition to investigate serious crimes.', step: 'crime' },
  '4': { short: "A match isn't enough", long: "A face match alone isn't enough to arrest someone. Police need other evidence.", step: 'arrest' },
  '5': { short: 'Tested for accuracy', long: 'The software has to be tested to show it works accurately.', step: 'search' },
  '6': { short: 'No live crowd scanning', long: 'Limits on live scanning, or on scanning everyone in view instead of one suspect.', step: 'search' },
  '7': { short: 'Trained staff only', long: 'Only trained staff can run searches.', step: 'search' }
};
const PORDER = ['3', '1', '6', '5', '7', '4', '2'];
const PICON = { '1': 'step-approval', '2': 'step-disclose', '3': 'step-crime', '4': 'step-match', '5': 'p-accuracy', '6': 'p-crowd', '7': 'p-trained' };
const LIMIT = {
  'lineups only': 'it only covers lineups',
  'drones only': 'it only covers drones',
  'probable cause, no court': 'police need strong evidence (probable cause), but no judge has to approve',
  'court order, lower standard': 'a judge must approve, but the bar is lower than for a regular warrant',
  'fact of use': 'the person is told face recognition was used, but may not get the details',
  'real-time only': 'it only covers live scanning',
  'biometric surveillance': 'it only covers scanning surveillance video, not searching photo databases',
  'via drone law': "it comes from the state's drone rules, which require a warrant in criminal cases, with exceptions",
  'child exploitation only': 'it only covers child sexual exploitation cases',
  'body cameras only': 'it would only cover body-camera footage',
  'adds offenses': 'it would add more crimes to the existing list',
  'adds an offense': 'it would add a crime to the existing list',
  'court order, ongoing surveillance only': "it would require a judge's order, but only for ongoing surveillance",
  'ongoing surveillance only': 'it would only cover ongoing surveillance',
  'for ongoing, real-time or persistent tracking use only': 'it would only cover ongoing, live or long-term tracking',
  'alpr images only': 'it would only cover license-plate camera images',
  'purchased personal data only': 'it would only cover personal data police buy',
  'limited to students in school districts': 'it would only cover students in schools'
};
const plainLimit = l => LIMIT[String(l).toLowerCase()] || l;
const BILLSTEP = { 'Introduced': 'Introduced', 'Hearing held': 'Got a hearing', 'Committee vote': 'Committee vote',
  'Passed one chamber': 'Passed one chamber', 'Failed': 'Failed', 'Failed floor vote': 'Failed a full vote' };
const LAWSTATUS = { 'Unchanged': 'In effect', 'New': 'New this year', 'Amended': 'Changed this year' };

const WHO = [['local', 'Local police', 'local police'], ['state', 'State police', 'state police'], ['federal', 'Federal agent', 'a federal agent, like the FBI or ICE']];
const SRC = [['photo', 'Still photo', 'a still photo'], ['cctv', 'Security camera', 'security-camera footage'], ['drone', 'Drone', 'drone footage'], ['bodycam', 'Body camera', 'body-camera footage']];
const DB = [['dmv', "Driver's license photos", "everyone's driver's license photos"], ['mug', 'Mugshots', 'mugshots']];
const CRIME = [['serious', 'Armed robbery', 'an armed robbery'], ['minor', 'Shoplifting', 'a shoplifting case']];

// Six steps. Each check is [rule, special step handling].
const STEPS = [
  { key: 'crime',    icon: 'step-crime',    short: 'Crime',  title: 'Is this crime serious enough?', checks: [['3']] },
  { key: 'approval', icon: 'step-approval', short: 'Judge',  title: 'Do police need a judge’s OK?', checks: [['1']] },
  { key: 'search',   icon: 'step-search',   short: 'Search', title: 'They run the search', checks: [['6'], ['5'], ['7']] },
  { key: 'arrest',   icon: 'step-arrest',   short: 'Arrest', title: 'Can they arrest based on the match?', checks: [['4', 'lineup'], ['4', 'arrest']] },
  { key: 'disclose', icon: 'step-disclose', short: 'Told',   title: 'Is the person charged told?', checks: [['2']] },
  { key: 'trial',    icon: 'step-trial',    short: 'Result', title: 'What protected this person?', checks: [] }
];

// Display status: 3 gates plus a lime "would be" gate for what-ifs.
const SHOW = {
  covered:  { gate: 'gate-closed',  sh: 'shield-yes',  tag: 't-yes',   word: 'Protected' },
  stop:     { gate: 'gate-closed',  sh: 'shield-yes',  tag: 't-stop',  word: 'Search stopped' },
  partial:  { gate: 'gate-partial', sh: 'shield-part', tag: 't-part',  word: 'Partly protected' },
  review:   { gate: 'gate-partial', sh: 'shield-part', tag: 't-part',  word: 'Unclear' },
  would:    { gate: 'gate-would',   sh: 'shield-yes',  tag: 't-would', word: 'Would be protected' },
  bypassed: { gate: 'gate-open',    sh: 'shield-no',   tag: 't-no',    word: "Law doesn't reach this" },
  gap:      { gate: 'gate-open',    sh: 'shield-no',   tag: 't-no',    word: 'Not protected' },
  info:     { gate: 'gate-open',    sh: 'shield-no',   tag: 't-no',    word: 'No special rule' }
};
const LV = { yes: ['shield-yes', 'Yes', 't-yes'], part: ['shield-part', 'Partly', 't-part'], no: ['shield-no', 'No', 't-no'] };

const PRESETS = [
  { t: 'The lineup loophole', s: { state: 'Indiana', who: 'local', src: 'photo', db: 'dmv', crime: 'serious' },
    d: "Indiana says a face match alone can't put someone in a lineup. Watch what happens at the arrest step." },
  { t: 'Shoplifting in Montana', s: { state: 'Montana', who: 'local', src: 'cctv', db: 'mug', crime: 'minor' },
    d: 'Montana only allows face recognition for serious crimes. Here the search stops early.' },
  { t: 'Drone over a crowd', s: { state: 'Illinois', who: 'local', src: 'drone', db: 'dmv', crime: 'serious' },
    d: 'Illinois limits face recognition on police drones. Then switch the photo to a security camera.' },
  { t: 'The feds ask the DMV', s: { state: 'Maryland', who: 'federal', src: 'photo', db: 'dmv', crime: 'serious' },
    d: 'Maryland has strong rules for its own police. What happens when a federal agent asks?' },
  { t: 'A law with no limits', s: { state: 'Kentucky', who: 'local', src: 'photo', db: 'dmv', crime: 'minor' },
    d: 'Kentucky has a face recognition law. Does it actually hold police back?' },
  { t: 'No law at all', s: { state: 'Ohio', who: 'local', src: 'cctv', db: 'mug', crime: 'minor' },
    d: 'Ohio has no law yet. Every step of the search is open.' }
];

const GLOSS = {
  'face recognition': ['Face recognition', 'Software that compares a photo of a face to a collection of other photos and suggests who it might be. It can be wrong.'],
  'warrant': ['Warrant or court order', "A judge's written permission. Police have to show a judge why they need to search."],
  'probable cause': ['Probable cause', 'Strong enough evidence to make it reasonable to believe someone committed a crime. Police normally need it to arrest someone.'],
  'lineup': ['Lineup', 'When a witness is shown several people or photos and asked to pick out the person they saw.'],
  'live scanning': ['Live crowd scanning', "Running face recognition on video as it happens, or on everyone in view, instead of one suspect's photo."],
  'dmv': ["Driver's license photos", 'Photos the state takes for licenses and IDs. Most adults are in this database, not just people who have been arrested.'],
  'mugshots': ['Mugshots', 'Photos taken when someone is arrested.'],
  'federal agent': ['Federal agent', 'Someone working for the national government, like the FBI or ICE, rather than for a city, county or state.'],
  'bill': ['Bill', 'A proposed law. The bills here were introduced in state legislatures but have not become law.'],
  'unclear': ['Unclear', 'Our research flagged an open question about how this law should be counted, or who it covers. Most often: whether a state law also binds federal agents.']
};
const term = (key, text) => `<span class="term" role="button" tabindex="0" data-term="${esc(key)}" data-tip="${esc(GLOSS[key][1])}">${esc(text || GLOSS[key][0])}</span>`;

/* ================= map ================= */
const ABBR = {Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE','District of Columbia':'DC',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY'};
const POS = {AK:[0,0],ME:[11,0],WI:[6,1],VT:[10,1],NH:[11,1],WA:[1,2],ID:[2,2],MT:[3,2],ND:[4,2],MN:[5,2],IL:[6,2],MI:[7,2],NY:[9,2],MA:[10,2],OR:[1,3],NV:[2,3],WY:[3,3],SD:[4,3],IA:[5,3],IN:[6,3],OH:[7,3],PA:[8,3],NJ:[9,3],CT:[10,3],RI:[11,3],CA:[1,4],UT:[2,4],CO:[3,4],NE:[4,4],MO:[5,4],KY:[6,4],WV:[7,4],VA:[8,4],MD:[9,4],DE:[10,4],AZ:[2,5],NM:[3,5],KS:[4,5],AR:[5,5],TN:[6,5],NC:[7,5],SC:[8,5],DC:[9,5],OK:[4,6],LA:[5,6],MS:[6,6],AL:[7,6],GA:[8,6],HI:[0,7],TX:[4,7],FL:[9,7]};

const groupOf = name => {
  const law = (D.states.find(s => s.name === name) || {}).law || 'No law';
  if (law === 'No law') return 'none';
  return /none of the seven/i.test(law) ? 'zero' : 'rules';
};
const counts = { rules: 0, zero: 0, none: 0 };
D.states.forEach(s => counts[groupOf(s.name)]++);

// State-level answer for one protection, without a specific case.
function stateProt(state, rule) {
  const laws = D.laws.filter(l => l.state === state && l.rules.includes(rule));
  const full = laws.filter(l => !l.limits[rule] && !l.source && !l.db);
  const level = full.length ? 'yes' : laws.length ? 'part' : 'no';
  return { level, laws, review: laws.some(l => l.review) };
}
const protCount = state => PORDER.filter(r => stateProt(state, r).level !== 'no').length;
const mapLevel = name => {
  const g = groupOf(name); if (g === 'none') return 'l0'; if (g === 'zero') return 'lz';
  const n = protCount(name); return n >= 5 ? 'l4' : n >= 3 ? 'l3' : n === 2 ? 'l2' : 'l1';
};

/* ================= app state (kept in the address) ================= */
const HAD_HASH = location.hash.length > 1;
const S = { tab: HAD_HASH ? 'state' : 'home', state: 'Maryland', who: 'local', src: 'photo', db: 'dmv', crime: 'serious', step: 0, whatif: 'none', model: 'Montana', cmpB: 'Montana' };
const KEYS = ['tab', 'state', 'who', 'src', 'db', 'crime'];
try {
  const h = new URLSearchParams(location.hash.slice(1));
  KEYS.forEach(k => { if (h.get(k)) S[k] = h.get(k); });
} catch (e) {}
if (!D.states.some(s => s.name === S.state)) S.state = 'Maryland';
if (!['home', 'state', 'case', 'compare', 'laws'].includes(S.tab)) S.tab = 'home';
if (!find(WHO, S.who)) S.who = 'local'; if (!find(SRC, S.src)) S.src = 'photo'; if (!find(DB, S.db)) S.db = 'dmv'; if (!find(CRIME, S.crime)) S.crime = 'serious';
const saveHash = () => { try { history.replaceState(null, '', '#' + new URLSearchParams(Object.fromEntries(KEYS.map(k => [k, S[k]])))); } catch (e) {} };

/* ================= the legal logic (from v1) ================= */
const WHO_FOR = { local: 'local police', state: 'state agencies', any: 'anyone' };
const SRC_FOR = { drone: 'police drones', bodycam: 'body-camera footage' };

function judge(law, rule, ctx, at) {
  if (law.source && law.source !== ctx.src) return { kind: 'bypassed', reason: `it only covers ${SRC_FOR[law.source]}` };
  if (law.db && law.db !== ctx.db) return { kind: 'bypassed', reason: "it only covers searches of driver's license photos" };
  const whoOk = law.whoFor.includes('any') || law.whoFor.includes(ctx.who);
  if (!whoOk && ctx.who === 'federal') return { kind: 'review' };
  if (!whoOk) return { kind: 'bypassed', reason: `it only covers ${law.whoFor.map(w => WHO_FOR[w]).join(' and ')}` };
  let limit = law.limits[rule] || '';
  if (law.source && /drone|body/.test(limit)) limit = '';
  if (rule === '4' && limit === 'lineups only') {
    if (at === 'lineup') return { kind: 'covered' };
    return { kind: 'bypassed', reason: 'it only covers lineups, and police can arrest someone without holding a lineup' };
  }
  if (rule === '4' && at === 'lineup') return null;
  return limit ? { kind: 'partial', limit } : { kind: 'covered' };
}
function ruleStatus(state, rule, ctx, at) {
  const hits = [];
  for (const law of D.laws.filter(l => l.state === state && l.rules.includes(rule))) {
    const j = judge(law, rule, ctx, at);
    if (j) hits.push({ law, ...j });
  }
  for (const k of ['covered', 'partial', 'review', 'bypassed']) if (hits.some(h => h.kind === k)) return { status: k, hits, top: hits.find(h => h.kind === k) };
  return { status: at === 'lineup' ? 'info' : 'gap', hits };
}
const billsFor = (state, rule) => D.bills.filter(b => b.state === state && b.rules.includes(rule))
  .sort((a, b) => String(b.year).localeCompare(String(a.year)));
function effective(state, rule, ctx, at) {
  const r = ruleStatus(state, rule, ctx, at);
  if (r.status === 'covered' || at === 'lineup' || S.whatif === 'none') return r;
  if (S.whatif === 'bills') { const b = billsFor(state, rule)[0]; if (b) return { ...r, status: 'would', bill: b }; }
  if (S.whatif === 'borrow') { const m = ruleStatus(S.model, rule, ctx, at); if (m.status === 'covered') return { ...r, status: 'would', model: S.model, mhits: m.hits }; }
  return r;
}
const otherLaws = (state, ctx) => D.laws.filter(l => l.state === state && !l.rules.length).filter(l => {
  if (l.source && l.source !== ctx.src) return false;
  if (l.db && l.db !== ctx.db) return false;
  return l.whoFor.includes('any') || l.whoFor.includes(ctx.who) || ctx.who === 'federal';
});
function computeCase(state, ctx) {
  let stopAt = -1;
  const steps = STEPS.map((s, i) => {
    const results = s.checks.map(([rule, at]) => ({ rule, at, ...effective(state, rule, ctx, at) })).filter(r => r.status !== 'info');
    if (stopAt < 0 && s.key === 'crime' && ctx.crime === 'minor' && ['covered', 'would'].includes(results[0].status)) stopAt = i;
    return { ...s, results };
  });
  steps.forEach((s, i) => {
    const st = s.results.map(r => r.status);
    s.agg = s.key === 'trial' ? 'none' : stopAt === i ? 'stop' : stopAt >= 0 && i > stopAt ? 'skip'
      : !st.length ? 'none'
      : st.every(x => x === 'covered') ? 'covered'
      : st.every(x => x === 'covered' || x === 'would') ? 'would'
      : st.some(x => ['covered', 'partial', 'would'].includes(x)) ? 'partial'
      : st.includes('review') ? 'review'
      : st.includes('bypassed') ? 'bypassed' : 'gap';
  });
  return { steps, stopAt };
}

/* ================= drawer ================= */
let lastFocus = null;
function openDrawer(kicker, title, html, icon) {
  lastFocus = document.activeElement;
  $('d-kicker').textContent = kicker; $('d-title').innerHTML = (icon ? img(icon, 34) : '') + title; $('d-body').innerHTML = html; $('d-body').scrollTop = 0;
  $('drawer').inert = false; $('drawer').classList.add('on'); $('scrim').classList.add('on'); $('app').inert = true;
  setTimeout(() => $('d-close').focus(), 60);
}
function closeDrawer() {
  $('drawer').classList.remove('on'); $('scrim').classList.remove('on'); $('drawer').inert = true; $('app').inert = false;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
$('d-close').onclick = closeDrawer; $('scrim').onclick = closeDrawer;
function trap(e, box) {
  const f = [...box.querySelectorAll('a[href],button:not([disabled]),select,input,[tabindex="0"]')].filter(x => x.offsetParent !== null);
  if (!f.length) return; const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Tab' && $('drawer').classList.contains('on')) trap(e, $('drawer'));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('drawer').classList.contains('on')) closeDrawer();
});

/* shared pieces used inside the drawer */
const hilite = (text, q) => {
  const t = esc(text); if (!q) return t;
  const words = q.split(/\s+/).filter(w => w.length > 1).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return words.length ? t.replace(new RegExp(`(${words.join('|')})`, 'gi'), '<mark>$1</mark>') : t;
};
const quoteHTML = (q, hl) => `<blockquote class="quote"><div class="qh"><cite>${esc(q.cite)}</cite><button class="copy" data-copy="${esc(unq(q.text) + ' ' + q.cite)}" aria-label="Copy quote and citation">Copy</button></div>“${hilite(unq(q.text), hl)}”</blockquote>`;
const quotesFor = (item, state, rule) => D.quotes.filter(q => q.state === state && q.item === item && (!rule || q.rule === rule));
const lawLink = (href, text) => href ? `<a class="btn ghost" href="${esc(href)}" target="_blank" rel="noopener">${esc(text)} ↗</a>` : '';
const protChips = (rules, limits = {}) => rules.length ? `<div class="pchips">${rules.map(r => `<span class="pchip${limits[r] ? ' lim' : ''}" data-tip="${esc(PROT[r].long + (limits[r] ? ' Limited: ' + plainLimit(limits[r]) + '.' : ''))}">${esc(PROT[r].short)}${limits[r] ? ' (limited)' : ''}</span>`).join('')}</div>` : '<div class="pchips"><span class="pchip none">None of the 7</span></div>';
const billStatus = b => `<span class="tagline t-neutral">${esc(BILLSTEP[b.step] || b.step)} · ${esc(b.year)}</span>`;
const lawRef = l => `data-law="${esc(l.state + '|' + l.name)}"`;
const billRef = b => `data-bill="${esc(b.state + '|' + b.name)}"`;
const getLaw = ref => { const [s, n] = ref.split('|'); return D.laws.find(l => l.state === s && l.name === n); };
const getBill = ref => { const [s, n] = ref.split('|'); return D.bills.find(b => b.state === s && b.name === n); };

function lawDrawer(law, hl) {
  const qs = quotesFor(law.name, law.state);
  const lim = Object.entries(law.limits);
  openDrawer(`${law.state} · Law`, `<span>${esc(law.name)}</span>`, `
    <div class="sec"><p>${hilite(law.does, hl)}</p>${law.review ? `<p class="small"><span class="tagline t-would" style="margin:0 6px 0 0">Unclear</span>Our research flagged an open question about how to count this law. ${term('unclear', 'What this means')}</p>` : ''}</div>
    <dl class="kv"><dt>Status</dt><dd>${esc(LAWSTATUS[law.status.replace(/ \(.*/, '')] || law.status)} · ${esc(law.year)}</dd><dt>Who it covers</dt><dd>${esc(law.who)}</dd><dt>Citation</dt><dd>${esc(law.cite)}</dd></dl>
    <div class="sec"><h3>Protections it adds</h3>${protChips(law.rules, law.limits)}${lim.length ? `<ul class="small" style="margin:0;padding-left:18px">${lim.map(([r, v]) => `<li><b>${esc(PROT[r].short)}:</b> ${esc(plainLimit(v))}.</li>`).join('')}</ul>` : ''}</div>
    <div class="sec"><h3>The exact wording</h3>${qs.length ? qs.map(q => quoteHTML(q, hl)).join('') : '<p class="muted small">No quoted text recorded for this law. Open the official text below.</p>'}</div>
    <div class="linkrow">${lawLink(law.link, 'Official text')}<button class="btn ghost" data-goto="state" data-st="${esc(law.state)}">${esc(law.state)} scorecard</button><button class="btn lime" data-goto="case" data-st="${esc(law.state)}">Follow a case here</button></div>`, 'law');
}
function billDrawer(b, hl) {
  const qs = quotesFor(b.name, b.state);
  const lim = Object.entries(b.limits);
  openDrawer(`${b.state} · Bill`, `<span>${esc(b.name)}</span> ${billStatus(b)}`, `
    <div class="sec"><p>${hilite(b.does, hl)}</p></div>
    <dl class="kv"><dt>Furthest step</dt><dd>${esc(BILLSTEP[b.step] || b.step)}</dd><dt>Year</dt><dd>${esc(b.year)}</dd><dt>Sponsor</dt><dd>${esc(b.sponsor || 'Not recorded')}</dd></dl>
    <div class="sec"><h3>Protections it would add</h3>${protChips(b.rules, b.limits)}${lim.length ? `<ul class="small" style="margin:0;padding-left:18px">${lim.map(([r, v]) => `<li><b>${esc(PROT[r].short)}:</b> ${esc(plainLimit(v))}.</li>`).join('')}</ul>` : ''}</div>
    <div class="sec"><h3>The exact wording</h3>${qs.length ? qs.map(q => quoteHTML(q, hl)).join('') : '<p class="muted small">No quoted text recorded for this bill. Open the bill text below.</p>'}</div>
    <div class="linkrow">${lawLink(b.link, 'Bill text')}<button class="btn ghost" data-goto="state" data-st="${esc(b.state)}">${esc(b.state)} scorecard</button></div>`, 'bill');
}
function protDrawer(state, rule) {
  const sp = stateProt(state, rule);
  const word = { yes: 'Yes', part: 'Partly', no: 'No' }[sp.level];
  const here = billsFor(state, rule);
  const have = [...new Set(D.laws.filter(l => l.rules.includes(rule) && !l.limits[rule] && !l.source && !l.db).map(l => l.state))];
  const lawBlocks = sp.laws.map(l => {
    const qs = quotesFor(l.name, state, rule);
    return `<div class="sec" style="gap:8px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><b style="font:600 16px var(--head)">${esc(l.name)}</b><span class="small muted">${esc(l.year)}</span></div>
      ${l.limits[rule] ? `<p class="small"><span class="tagline t-part" style="margin:0 6px 0 0">Limited</span>${esc(plainLimit(l.limits[rule]))}.</p>` : ''}
      ${l.source ? `<p class="small"><span class="tagline t-part" style="margin:0 6px 0 0">Limited</span>It only covers ${esc(SRC_FOR[l.source])}.</p>` : ''}
      ${l.db ? `<p class="small"><span class="tagline t-part" style="margin:0 6px 0 0">Limited</span>It only covers searches of driver's license photos.</p>` : ''}
      ${qs.map(q => quoteHTML(q)).join('')}
      <div class="linkrow"><button class="copy" ${lawRef(l)}>Full law details</button>${l.link ? `<a class="copy" href="${esc(l.link)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">Official text ↗</a>` : ''}</div></div>`;
  }).join('<hr style="border:0;border-top:1px solid var(--rule);margin:0">');
  openDrawer(`${state} · Protection`, `<span>${esc(PROT[rule].short)}: ${word}</span>${img(LV[sp.level][0], 32)}`, `
    <p>${esc(PROT[rule].long)}</p>
    ${sp.laws.length ? lawBlocks : `<p>Nothing in ${esc(state)} law adds this protection. Only the U.S. Constitution's basic limits on searches and arrests apply.</p>`}
    <div class="sec"><h3>${esc(state)} bills that would add it</h3>${here.length ? `<div class="mini">${here.map(b => `<button ${billRef(b)}><span><b>${esc(b.name)}</b> ${billStatus(b)}<br><span class="small muted">${esc(b.does.slice(0, 140))}${b.does.length > 140 ? '…' : ''}</span></span><span class="arrow">→</span></button>`).join('')}</div>` : '<p class="small muted">None so far.</p>'}</div>
    ${have.length ? `<div class="sec"><h3>States that already have it in full</h3><div class="linkrow">${have.map(s => `<button class="chipbtn" data-goto="state" data-st="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>` : ''}`, PICON[rule]);
}
const INFO = {
  map: ['The map', 'What the colors mean', () => `<p>Each square is a state. The darker the square, the more of the 7 protections that state's laws include, in full or in part.</p>${legendHTML(true)}<p class="small muted">Click a state to see its scorecard, or to follow a case there.</p>`, 'pin'],
  protections: ['The basics', 'The 7 protections we check', () => `<p>Police can run a photo of an unknown person through software that compares it to millions of faces. Some states put limits on that. We check every state for these seven common ones:</p><div class="glist">${PORDER.map((r, i) => `<div style="display:grid;grid-template-columns:36px 1fr;gap:12px;align-items:center">${img(PICON[r], 36)}<span><dt>${i + 1}. ${esc(PROT[r].short)}</dt><dd>${esc(PROT[r].long)}</dd></span></div>`).join('')}</div>`, 'shield-full'],
  gates: ['How to read it', 'Gates on the road', () => `<p>Shields show whether state law protects people. On the case road, the same colors appear as gates the search has to get past.</p><div class="howto">
    <div>${img('shield-yes', 36)}<span><b>Protected</b> <span class="tagline t-yes">Yes</span><br>A state law protects people here. On the road: a closed gate.</span></div>
    <div>${img('shield-part', 36)}<span><b>Partly protected, or unclear</b> <span class="tagline t-part">Partly</span><br>A protection exists, but only in some situations, or it isn't settled who it covers. On the road: a half gate.</span></div>
    <div>${img('shield-no', 36)}<span><b>Not protected</b> <span class="tagline t-no">No</span><br>No state law steps in, or the law that exists doesn't reach this situation. On the road: two red posts, nothing in between.</span></div>
    <div>${img('gate-would', 36)}<span><b>Would be protected</b> <span class="tagline t-would">What if</span><br>Shown only when you try a "what if" on the Result step.</span></div></div>
    <p class="small muted">Where a state has no rule, the U.S. Constitution's basic limits on searches and arrests still apply. "Not protected" means no extra protection from state law.</p>`, 'shield-yes'],
  laws: ['The data', 'Where this comes from', () => `<p>Every law, bill and quote here comes from CDT's research memo on state facial recognition laws. ${esc(D.source)}</p><p>Laws marked ${term('unclear')} have open questions about how they should be counted.</p><p class="small muted">Tap any row to read the exact wording and open the official text.</p>`, 'law'],
};
const legendHTML = big => `<div class="mlegend"${big ? ' style="font-size:14px"' : ''}>
  <span><i class="sw" style="background:var(--navy)"></i>5 to 7</span><span><i class="sw" style="background:var(--peri)"></i>3 to 4</span>
  <span><i class="sw" style="background:var(--sky)"></i>2</span><span><i class="sw" style="background:var(--cyan)"></i>1</span>
  <span><i class="sw" style="background:#fff;box-shadow:inset 0 0 0 1.5px var(--slate)"></i>Law, none of the 7</span>
  <span><i class="sw" style="background:var(--paper);box-shadow:inset 0 0 0 1px var(--rule-2)"></i>No law</span></div>`;
function aboutDrawer() {
  openDrawer('About', 'About Face Value', `
    <p>Face Value shows, step by step, where state laws limit police use of ${term('face recognition', 'face recognition')} during a criminal investigation, and where they leave gaps.</p>
    <div class="sec"><h3>How to use it</h3><div class="mini">
      <button data-goto="state"><span><b>Your state</b><br><span class="small muted">A scorecard of the 7 protections</span></span><span class="arrow">→</span></button>
      <button data-goto="case"><span><b>Follow a case</b><br><span class="small muted">Walk one search from start to finish</span></span><span class="arrow">→</span></button>
      <button data-goto="compare"><span><b>Compare</b><br><span class="small muted">Two states, same case</span></span><span class="arrow">→</span></button>
      <button data-goto="laws"><span><b>Read the laws</b><br><span class="small muted">Search every law, bill and quote</span></span><span class="arrow">→</span></button></div></div>
    <div class="sec"><h3>Words on this page</h3><dl class="glist">${Object.values(GLOSS).map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl></div>
    <div class="sec"><h3>Fine print</h3><p class="small">Where a state has no rule, the U.S. Constitution's basic limits on searches and arrests still apply. Source: ${esc(D.source)} This is a CDT staff hackathon prototype and is not legal advice.</p>
    <p class="small">Made by Michael Endrias (Intern). <a href="archive/index.html">Original hackathon version</a></p></div>`, 'logo');
}
function storiesDrawer() {
  openDrawer('Follow a case', 'Start with a story', `<p class="muted">Each story loads a real situation. Then change anything you like.</p><div class="stories">${PRESETS.map((p, i) =>
    `<button data-preset="${i}">${img('who-' + p.s.who, 36)}<span><b>${esc(p.t)}</b><span class="small muted">${esc(p.d)}</span></span></button>`).join('')}</div>`, 'step-photo');
}

// One delegated click handler for everything the drawer and pages can contain.
document.addEventListener('click', e => {
  const t = e.target.closest('[data-term],[data-info],[data-law],[data-bill],[data-goto],[data-go],[data-preset],[data-copy],[data-open],[data-prot]');
  if (!t) return;
  if (t.dataset.term) { const [tt, dd] = GLOSS[t.dataset.term]; openDrawer('Plain language', esc(tt), `<p style="font-size:17px">${esc(dd)}</p><p class="small"><button class="copy" data-open="about">All terms</button></p>`); }
  else if (t.dataset.info) { const [k, ti, fn, ic] = INFO[t.dataset.info]; openDrawer(k, esc(ti), fn(), ic); }
  else if (t.dataset.law) lawDrawer(getLaw(t.dataset.law), t.dataset.hl);
  else if (t.dataset.bill) billDrawer(getBill(t.dataset.bill), t.dataset.hl);
  else if (t.dataset.prot) protDrawer(S.state, t.dataset.prot);
  else if (t.dataset.preset) { closeDrawer(); loadPreset(+t.dataset.preset); }
  else if (t.dataset.open === 'stories') storiesDrawer();
  else if (t.dataset.open === 'about') aboutDrawer();
  else if (t.dataset.copy) { navigator.clipboard?.writeText(t.dataset.copy).then(() => { t.textContent = 'Copied'; t.setAttribute('aria-live', 'polite'); setTimeout(() => t.textContent = 'Copy', 1400); }).catch(() => {}); }
  else if (t.dataset.go) setTab(t.dataset.go);
  else if (t.dataset.goto) { closeDrawer(); if (t.dataset.st) setState(t.dataset.st, false); setTab(t.dataset.goto); }
});
$('open-about').onclick = aboutDrawer;
document.addEventListener('keydown', e => { const t = e.target.closest && e.target.closest('span[role=button]'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); } });

/* ================= hover pop-outs (in-page, not browser tooltips) ================= */
const tip = document.createElement('div'); tip.className = 'tip'; tip.id = 'tip'; tip.setAttribute('aria-hidden', 'true'); document.body.appendChild(tip);
let tipFor = null;
function showTip(el) {
  const text = el.dataset.tip; if (!text) return;
  tipFor = el; tip.textContent = text; tip.setAttribute('role', 'tooltip'); tip.removeAttribute('aria-hidden'); tip.classList.add('on'); el.setAttribute('aria-describedby', 'tip');
  const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 10, below = false;
  if (y < 8) { y = r.bottom + 10; below = true; }
  x = Math.max(8, Math.min(innerWidth - tw - 8, x));
  tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.toggle('below', below);
  tip.style.setProperty('--ax', (r.left + r.width / 2 - x) + 'px');
}
function hideTip() { if (tipFor) tipFor.removeAttribute('aria-describedby'); tipFor = null; tip.classList.remove('on'); tip.removeAttribute('role'); tip.setAttribute('aria-hidden', 'true'); }
const canHover = matchMedia('(hover: hover)').matches;
document.addEventListener('mouseover', e => { if (!canHover) return; const el = e.target.closest('[data-tip]'); if (el && el !== tipFor) showTip(el); else if (!el && tipFor) hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el && e.target.matches(':focus-visible')) showTip(el); });
document.addEventListener('focusout', hideTip);
document.addEventListener('scroll', hideTip, true);
document.addEventListener('click', hideTip);
$('open-stories').onclick = storiesDrawer;

/* ================= tabs ================= */
function setTab(tab) {
  S.tab = tab;
  document.querySelectorAll('[role=tablist]').forEach(list => list.querySelectorAll('[role=tab][data-tab]').forEach((b, k) => { b.setAttribute('aria-selected', b.dataset.tab === tab); b.tabIndex = b.dataset.tab === tab || (tab === 'home' && k === 0) ? 0 : -1; }));
  ['home', 'state', 'case', 'compare', 'laws'].forEach(v => $('v-' + v).classList.toggle('on', v === tab));
  $('app').classList.toggle('wide', tab === 'compare' || tab === 'laws' || tab === 'home');
  $('home').toggleAttribute('aria-current', tab === 'home'); if (tab === 'home') $('home').setAttribute('aria-current', 'page');
  if (tab === 'compare') renderCompare();
  if (tab === 'laws') renderLaws();
  if (tab === 'case') go(S.step, false);
  saveHash();
}
document.querySelectorAll('[role=tab][data-tab]').forEach(b => b.onclick = () => setTab(b.dataset.tab));
const TABS = ['state', 'case', 'compare', 'laws'];
document.querySelectorAll('[role=tablist]').forEach(list => list.addEventListener('keydown', e => {
  const t = e.target.closest('[role=tab][data-tab]'); if (!t) return;
  let i = TABS.indexOf(t.dataset.tab);
  if (e.key === 'ArrowRight') i = (i + 1) % 4; else if (e.key === 'ArrowLeft') i = (i + 3) % 4; else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = 3; else return;
  e.preventDefault(); setTab(TABS[i]); list.querySelector(`[data-tab="${TABS[i]}"]`).focus();
}));
/* motion switch: pauses every animation on the page */
let still = false; try { still = localStorage.getItem('fv-still') === '1'; } catch (e) {}
if (reduced) still = true;
function setMotion(v) { still = v; document.body.classList.toggle('still', v); $('motion').setAttribute('aria-pressed', v); $('motion-t').textContent = v ? 'Play motion' : 'Pause motion'; $('motion-sr').textContent = v ? 'Animation is paused' : 'Pause all animation'; try { localStorage.setItem('fv-still', v ? '1' : '0'); } catch (e) {} }
$('motion').onclick = () => setMotion(!still); setMotion(still);

/* ================= state picking ================= */
const stateOpts = sel => D.states.map(s => `<option${s.name === sel ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
const tiles = $('tiles');
D.states.forEach(s => {
  const ab = ABBR[s.name], p = POS[ab];
  const b = document.createElement('button');
  b.className = 'tile ' + mapLevel(s.name); b.textContent = ab; b.dataset.state = s.name; b.dataset.tip = groupOf(s.name) === 'none' ? `${s.name}: no face recognition law` : groupOf(s.name) === 'zero' ? `${s.name}: a law, but none of the 7 protections` : `${s.name}: ${protCount(s.name)} of 7 protections`;
  b.setAttribute('aria-label', `${ab}, ${b.dataset.tip}`); b.style.gridColumn = p[0] + 1; b.style.gridRow = p[1] + 1;
  tiles.appendChild(b);
});
$('mlegend').outerHTML = legendHTML(false);
tiles.onclick = e => { const b = e.target.closest('.tile'); if (b) setState(b.dataset.state); };
$('state-pick').onchange = e => setState(e.target.value);
document.querySelectorAll('[data-statepick]').forEach(s => s.onchange = e => setState(e.target.value));

function setState(name, rerender = true) {
  S.state = name; S.whatif = 'none';
  tiles.querySelectorAll('.tile').forEach(t => { const on = t.dataset.state === name; t.classList.toggle('sel', on); t.setAttribute('aria-pressed', on); const p = t.querySelector('.pin'); if (on && !p) t.insertAdjacentHTML('beforeend', img('pin', 22, 'pin')); if (!on && p) p.remove(); });
  $('state-pick').innerHTML = stateOpts(name);
  document.querySelectorAll('[data-statepick]').forEach(s => s.innerHTML = stateOpts(name));
  renderState(); restartCase(rerender && S.tab === 'case');
  if (S.tab === 'compare') renderCompare();
  saveHash();
}

/* ================= YOUR STATE ================= */
function renderState() {
  const st = S.state, g = groupOf(st);
  const lawsHere = D.laws.filter(l => l.state === st);
  const billsHere = D.bills.filter(b => b.state === st);
  const n = protCount(st), nFull = PORDER.filter(r => stateProt(st, r).level === 'yes').length;
  $('s-kicker').textContent = 'State scorecard';
  $('s-name').textContent = st;
  const levels = PORDER.map(r => stateProt(st, r).level);
  $('s-hud').innerHTML = `<div class="top"><span class="pxf">PROTECTION METER</span>${img('capitol', 34)}</div>
    <div class="shields" role="img" aria-label="${n} of 7 protections">${levels.map((l, i) => `<img class="px" src="${IC(LV[l][0])}" alt="" tabindex="0" data-tip="${esc(PROT[PORDER[i]].short)}: ${LV[l][1]}" style="animation-delay:${i * 70}ms">`).join('')}</div>
    <div class="score"><b>${n}/7</b><span>${g === 'none' ? 'No face recognition law' : g === 'zero' ? 'Has a law, but none of the 7' : n > nFull ? `${nFull} full, ${n - nFull} partial` : 'All in full'}</span></div>`;
  $('s-sum').innerHTML = g === 'none'
    ? `${esc(st)} has no law about police ${term('face recognition', 'face recognition')}. It's one of ${counts.none} states with no law.${billsHere.length ? ` Lawmakers have introduced ${billsHere.length} ${term('bill', billsHere.length > 1 ? 'bills' : 'bill')} on it.` : ''}`
    : g === 'zero'
    ? `${esc(st)} has a face recognition law, but it doesn't add any of the 7 common protections. ${esc(lawsHere.map(l => l.does).join(' '))}`
    : `${esc(st)} has ${lawsHere.length === 1 ? 'one law' : lawsHere.length + ' laws'} on police face recognition. ${nFull ? `${nFull} protection${nFull > 1 ? 's apply' : ' applies'} in full` : 'None apply in full'}${n > nFull ? `, and ${n - nFull} only in some situations` : ''}.`;
  $('s-prots').innerHTML = PORDER.map(r => {
    const sp = stateProt(st, r);
    const w = LV[sp.level];
    const lim = sp.level === 'part' ? (() => { const l = sp.laws[0]; return l.limits[r] ? plainLimit(l.limits[r]) : l.source ? `only covers ${SRC_FOR[l.source]}` : l.db ? "only covers driver's license photo searches" : ''; })() : '';
    const nb = billsFor(st, r).length;
    return `<button class="prot" data-prot="${r}">${img(PICON[r], 44)}<span><b>${esc(PROT[r].short)}${sp.review ? '<span class="flag" data-tip="Unclear: our research flagged an open question about who this law covers.">?</span>' : ''}</b>
      <span class="st">${lim ? esc(lim.replace(/^it /, '').replace(/^./, c => c.toUpperCase())) : sp.level === 'yes' ? esc(sp.laws[0].name) : 'No state law adds this'}${nb ? ` · ${nb} bill${nb > 1 ? 's' : ''} proposed` : ''}</span></span><span class="end"><span class="tagline ${w[2]}">${w[1]}</span>${img(w[0], 36)}<span class="arrow" aria-hidden="true">→</span></span></button>`;
  }).join('') + `<button class="prot billcell" id="s-bills2">${img('bill', 44)}<span><b>Bills in ${esc(st)}</b>
      <span class="st">${billsHere.length ? `Proposed laws on face recognition. Tap to read ${billsHere.length > 1 ? 'them' : 'it'}.` : 'No bills recorded in this research'}</span></span><span class="end"><span class="count${billsHere.length ? '' : ' zero'}" aria-label="${billsHere.length} bills">${billsHere.length}</span><span class="arrow" aria-hidden="true">→</span></span></button>`;
  const other = lawsHere.filter(l => !l.rules.length);
  $('s-foot').innerHTML = `
    ${other.length ? `<button class="chipbtn" id="s-other"><span class="count sm">${other.length}</span>Other face recognition law${other.length > 1 ? 's' : ''}</button>` : ''}
    <span class="sp"></span>
    <button class="btn ghost" data-goto="compare">Compare</button>
    <button class="btn lime" data-goto="case">Follow a case in ${esc(st)} <span aria-hidden="true">→</span></button>`;
  $('s-bills2').onclick = () => billsHere.length ? openDrawer(`${st} · Bills`, `Bills in ${esc(st)}`, `<div class="mini">${billsHere.sort((a, b) => String(b.year).localeCompare(String(a.year))).map(b => `<button ${billRef(b)}><span><b>${esc(b.name)}</b> ${billStatus(b)}<br><span class="small muted">${esc(b.does)}</span></span><span class="arrow">→</span></button>`).join('')}</div>`) : openDrawer(`${st} · Bills`, `Bills in ${esc(st)}`, `<p>No face recognition bills are recorded for ${esc(st)} in this research.</p>`);
  const so = $('s-other'); if (so) so.onclick = () => openDrawer(`${st} · Laws`, `Other laws in ${esc(st)}`, `<p class="muted">These laws touch face recognition but aren't one of the 7 protections.</p><div class="mini">${other.map(l => `<button ${lawRef(l)}><span><b>${esc(l.name)}</b><br><span class="small muted">${esc(l.does)}</span></span><span class="arrow">→</span></button>`).join('')}</div>`);
}

/* ================= FOLLOW A CASE ================= */
const fill = (el, list, key) => { $(el).innerHTML = list.map(([k, t]) => `<option value="${k}"${S[key] === k ? ' selected' : ''}>${esc(t)}</option>`).join(''); $(el).onchange = e => { S[key] = e.target.value; S.whatif = 'none'; restartCase(true); saveHash(); }; };
fill('f-who', WHO, 'who'); fill('f-src', SRC, 'src'); fill('f-db', DB, 'db'); fill('f-crime', CRIME, 'crime');
const syncFilters = () => { $('f-who').value = S.who; $('f-src').value = S.src; $('f-db').value = S.db; $('f-crime').value = S.crime; };

let CASE = null;
const stepX = i => 4 + (92 * (i + 0.5)) / STEPS.length;
function restartCase(animate) {
  CASE = computeCase(S.state, S);
  const w = find(WHO, S.who), so = find(SRC, S.src), d = find(DB, S.db), c = find(CRIME, S.crime);
  $('question').innerHTML = `In <span class="hl">${esc(S.state)}</span>, ${S.who === 'federal' ? term('federal agent', 'a federal agent') + ' has' : esc(w[2]) + ' have'} <span class="hl">${esc(so[2])}</span> from ${esc(c[2])}. They search it against <span class="hl">${S.db === 'dmv' ? term('dmv', d[2]) : term('mugshots', 'mugshots')}</span>. What stops them?`;
  buildTrack();
  go(0, animate);
}
function buildTrack() {
  $('track').innerHTML = `<div class="road"></div><div class="done" id="done"></div>` +
    STEPS.map((s, i) => `<button class="station" data-i="${i}" style="left:${stepX(i)}%" aria-label="Step ${i + 1}: ${esc(s.short)}" data-tip="Step ${i + 1}: ${esc(s.title)}">${img(s.icon, 34)}<span class="gate"></span><span class="lbl">${esc(s.short)}</span></button>`).join('') +
    `<div class="walker" id="walker" style="left:${stepX(0)}%">${img('who-' + S.who, 44)}${img('src-' + S.src, 24, 'small')}<span class="bubble" id="bubble"></span></div>`;
  $('track').onclick = e => { const b = e.target.closest('.station'); if (b) go(+b.dataset.i, true); };
}
function narration(s) {
  const st = S.state;
  switch (s.key) {
    case 'crime': return `Before searching, does ${st} limit face recognition to serious crimes? This one is ${find(CRIME, S.crime)[1].toLowerCase()}.`;
    case 'approval': return 'Do they need a judge to approve the search first?';
    case 'search': return `They upload the face and search it against ${find(DB, S.db)[2]}. Are there rules on how this search is done?`;
    case 'arrest': return `The software suggests who it might be. Matches can be wrong. Can police put the person in a ${term('lineup', 'lineup')} or arrest them based on the match?`;
    case 'disclose': return 'If the person is charged with a crime, do they have to be told face recognition was used?';
    case 'trial': return CASE.stopAt >= 0 ? `The search was stopped at step ${CASE.stopAt + 1}. Here's the full picture.` : "The search made it all the way through. Here's what protected this person, and what didn't.";
  }
}
function sentence(r, step) {
  const st = S.state, minor = S.crime === 'minor';
  if (r.status === 'covered') switch (r.rule) {
    case '3': return minor ? `Stopped. ${st} only allows face recognition for serious crimes, and shoplifting isn't one.` : `Allowed, because this is a serious crime. ${st} only allows face recognition for serious crimes.`;
    case '1': return "Police must get a judge's approval before they search.";
    case '6': return 'Live scanning and scanning everyone in view are limited.';
    case '5': return 'The software has to be tested to show it works accurately.';
    case '7': return 'Only trained staff can run the search.';
    case '4': return r.at === 'lineup' ? "Police can't put someone in a lineup based only on the match." : "A match alone isn't enough. Police need other evidence before they arrest.";
    case '2': return 'The person charged must be told face recognition was used.';
  }
  if (r.status === 'partial') return `Partly. ${st} has this protection, with a catch: ${plainLimit(r.top.limit)}.`;
  if (r.status === 'review') return `${st} has this protection, but its law is written for “${r.top.law.who.toLowerCase()}.” Whether it also covers federal agents isn't settled.`;
  if (r.status === 'bypassed') return `${st} has a law here, but ${r.top.reason}. So it doesn't protect this person.`;
  if (r.status === 'would' && r.bill) return `Not protected today. ${r.bill.name} (${r.bill.year}) would add this${r.bill.limits[r.rule] ? `, but ${plainLimit(r.bill.limits[r.rule])}` : ''}.`;
  if (r.status === 'would' && r.model) return `Not protected today. If ${st} had ${r.model}'s law, this step would be protected${r.rule === '3' && minor ? ', and the search would stop here' : ''}.`;
  return `Nothing in ${st} law protects people at this step. Only the U.S. Constitution's basic limits apply.`;
}
function resultRow(r, step) {
  const kind = step.agg === 'stop' && r.rule === '3' ? 'stop' : r.status;
  const sh = SHOW[kind];
  const name = r.rule === '4' ? (r.at === 'lineup' ? 'Lineups' : "A match isn't enough") : PROT[r.rule].short;
  const src = r.bill ? `${billRef(r.bill)}` : r.top ? lawRef(r.top.law) : r.mhits ? lawRef(r.mhits[0].law) : `data-prot="${r.rule}"`;
  return `<div class="res">${img(sh.sh, 40)}<div><div class="rt">${esc(name)}<span class="tagline ${sh.tag}">${esc(sh.word)}</span></div><div class="rs">${esc(sentence(r, step))}</div></div>
    <button class="copy" ${src} aria-label="${r.status === 'gap' ? 'Fixes' : r.bill ? 'Read bill' : 'Read law'}: ${esc(name)}">${r.status === 'gap' ? 'Fixes' : r.bill ? 'Read bill' : 'Read law'}</button></div>`;
}
function otherRow(l) {
  return `<div class="res">${img('law', 34)}<div><div class="rt">${esc(l.name)}<span class="tagline t-part">Other ${esc(l.state)} law</span></div><div class="rs">${esc(l.does)}</div></div><button class="copy" ${lawRef(l)} aria-label="Read law: ${esc(l.name)}">Read law</button></div>`;
}
function verdictHTML() {
  const st = S.state, all = CASE.steps.flatMap(s => s.agg === 'skip' ? [] : s.results);
  const n = k => all.filter(r => r.status === k).length;
  const gaps = CASE.steps.flatMap(s => s.agg === 'skip' ? [] : s.results.filter(r => ['gap', 'bypassed', 'partial', 'review'].includes(r.status)).map(r => ({ r, s })));
  const stars = k => `<span class="sparkles" aria-hidden="true">${img('star', 20).repeat(k)}</span>`;
  const head = CASE.stopAt >= 0
    ? `<div class="verdict-row"><span class="stamp stop">${img('gate-closed', 22)}SEARCH STOPPED</span>${stars(3)}</div><p>${esc(st)} law stopped this search at step ${CASE.stopAt + 1}, ${esc(STEPS[CASE.stopAt].short.toLowerCase())}.</p>`
    : `<div class="verdict-row"><span class="stamp go">${img('gate-open', 22)}SEARCH WENT THROUGH</span>${n('covered') ? stars(Math.min(3, n('covered'))) : ''}</div><p><b>Nothing in ${esc(st)} law stopped this search.</b> ${n('covered') ? `It had to pass ${n('covered')} checkpoint${n('covered') > 1 ? 's' : ''} on the way.` : 'Not a single state protection applied.'}</p>`;
  const models = D.states.filter(s => groupOf(s.name) === 'rules' && s.name !== st).map(s => s.name);
  if (!models.includes(S.model)) S.model = models[0];
  return `${head}
    <div class="tally">
      <div><div class="n">${n('covered') + n('would')}</div><div class="l">${S.whatif === 'none' ? 'protections applied' : 'protections, with your what if'}</div></div>
      <div><div class="n">${n('partial') + n('review')}</div><div class="l">only partly, or unclear</div></div>
      <div><div class="n">${n('bypassed')}</div><div class="l">laws that exist but miss this case</div></div>
      <div><div class="n">${n('gap')}</div><div class="l">checks with no protection</div></div>
    </div>
    ${gaps.length ? `<div class="label" style="margin-bottom:4px">Where this person wasn't fully protected</div><div class="mini">${gaps.map(({ r, s }) => `<button data-stepjump="${STEPS.indexOf(STEPS.find(x => x.key === s.key))}"><span><b>${esc(s.short)}:</b> ${esc(r.rule === '4' && r.at === 'lineup' ? 'Lineups' : PROT[r.rule].short)}, ${esc(SHOW[r.status].word.toLowerCase())}</span><span class="arrow">→</span></button>`).join('')}</div>` : ''}
    <div class="label" style="margin:14px 0 4px">What if? Try closing the gaps</div>
    <div class="whatif">
      <div class="seg2" role="group" aria-label="What if">
        <button data-w="none" aria-pressed="${S.whatif === 'none'}">Today's law</button>
        <button data-w="bills" aria-pressed="${S.whatif === 'bills'}">Pass ${esc(st)}'s bills</button>
        <button data-w="borrow" aria-pressed="${S.whatif === 'borrow'}">Copy another state</button>
      </div>
      ${S.whatif === 'borrow' ? `<select class="select" id="model" aria-label="State to copy">${models.map(m => `<option${m === S.model ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>` : ''}
    </div>
    <p class="small muted" style="margin-top:8px">${S.whatif === 'bills' ? `Lime gates show what would change if every ${esc(st)} bill on this topic, had passed.` : S.whatif === 'borrow' ? `Lime gates show what would change if ${esc(st)} had ${esc(S.model)}'s law.` : 'Pick an option. Lime gates on the road show what would change.'}</p>`;
}
let walkTimer = null;
function go(i, animate) {
  if (!CASE) return;
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  const prev = S.step; S.step = i;
  const s = CASE.steps[i];
  const wk = $('walker');
  wk.style.left = stepX(Math.min(i, CASE.stopAt >= 0 ? CASE.stopAt : i)) + '%';
  wk.classList.remove('stopped', 'moving');
  if (animate && !reduced && prev !== i) { void wk.offsetWidth; wk.classList.add('moving'); clearTimeout(walkTimer); walkTimer = setTimeout(() => wk.classList.remove('moving'), 700); }
  if (CASE.stopAt >= 0 && i >= CASE.stopAt && i !== STEPS.length - 1) { void wk.offsetWidth; wk.classList.add('stopped'); }
  $('done').style.width = (stepX(i) - 4) + '%';
  const here = CASE.stopAt >= 0 && i > CASE.stopAt ? CASE.steps[CASE.stopAt] : s;
  const say = here.key === 'trial' ? (CASE.stopAt >= 0 ? ['STOPPED!', 'yes'] : ['MADE IT...', 'no'])
    : { covered: ['HALT!', 'yes'], stop: ['HALT!', 'yes'], partial: ['HMM...', ''], review: ['HMM?', ''], would: ['OOH!', 'yes'], bypassed: ['SNEAK BY', 'no'], gap: ['WIDE OPEN', 'no'], none: ['...', ''] }[here.agg] || ['...', ''];
  const bb = $('bubble'); bb.textContent = say[0]; bb.className = 'bubble ' + say[1]; void bb.offsetWidth; bb.style.animation = 'none'; void bb.offsetWidth; bb.style.animation = '';
  wk.classList.toggle('flip', Math.min(i, CASE.stopAt >= 0 ? CASE.stopAt : i) >= 4);
  document.querySelectorAll('.station').forEach((b, j) => {
    const sj = CASE.steps[j];
    b.classList.toggle('cur', j === i);
    b.classList.toggle('seen', j <= i && SHOW[sj.agg] !== undefined);
    b.classList.toggle('skip', sj.agg === 'skip' && j <= i);
    b.querySelector('.gate').innerHTML = SHOW[sj.agg] ? img(SHOW[sj.agg].gate, 26) : '';
  });
  $('stephead').innerHTML = `${img(s.icon, 56)}<div><div class="stepno">STEP ${i + 1} OF ${STEPS.length}</div><div class="stitle">${esc(s.title)}</div></div>`;
  let html = `<p class="narr">${narration(s)}</p>`;
  if (s.agg === 'skip') html += `<div class="res">${img('shield-yes', 34)}<div><div class="rs">This step never happens. The search was stopped at step ${CASE.stopAt + 1}.</div></div><span></span></div>`;
  else {
    if (s.key === 'search') html += otherLaws(S.state, S).map(otherRow).join('');
    html += s.results.map(r => resultRow(r, s)).join('');
    if (s.key === 'arrest' && !s.results.some(r => r.at === 'lineup')) html += `<p class="small muted" style="padding-top:8px;border-top:1px solid var(--rule)">${esc(S.state)} has no special rule about lineups.</p>`;
    if (s.key === 'trial') html += verdictHTML();
    const rules = [...new Set(s.checks.map(c => c[0]))];
    if (rules.length) html += `<div class="label" style="margin-top:var(--s4)">Across the country</div><div class="natfact">${rules.map(r => {
      const yes = D.states.filter(x => stateProt(x.name, r).level === 'yes').length, part = D.states.filter(x => stateProt(x.name, r).level === 'part').length;
      return `<div class="nf">${img(PICON[r], 28)}<span><b>${yes}</b> state${yes === 1 ? '' : 's'} require${yes === 1 ? 's' : ''} “${esc(PROT[r].short.toLowerCase())}” in full${part ? `, <b>${part}</b> in part` : ''}.</span></div>`;
    }).join('')}</div>`;
  }
  $('stepbody').innerHTML = html; $('stepbody').scrollTop = 0;
  const wi = $('stepbody').querySelector('.whatif');
  if (wi) {
    wi.onclick = e => { const b = e.target.closest('[data-w]'); if (b) { S.whatif = b.dataset.w; CASE = computeCase(S.state, S); go(STEPS.length - 1, false); } };
    const m = $('model'); if (m) m.onchange = e => { S.model = e.target.value; CASE = computeCase(S.state, S); go(STEPS.length - 1, false); };
  }
  $('stepbody').querySelectorAll('[data-stepjump]').forEach(b => b.onclick = () => go(+b.dataset.stepjump, true));
  $('back').disabled = i === 0;
  const last = i === STEPS.length - 1;
  $('next').innerHTML = last ? 'More stories →' : CASE.stopAt >= 0 && i >= CASE.stopAt ? 'Skip to the result →' : 'Next step →';
}
const nextStep = () => { const i = S.step; if (i === STEPS.length - 1) return storiesDrawer(); go(CASE.stopAt >= 0 && i >= CASE.stopAt ? STEPS.length - 1 : i + 1, true); };
$('next').onclick = nextStep;
$('back').onclick = () => go(S.step - 1, true);
$('restart').onclick = () => go(0, true);
document.addEventListener('keydown', e => {
  if (S.tab !== 'case' || $('drawer').classList.contains('on')) return;
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowRight') nextStep();
  if (e.key === 'ArrowLeft') go(S.step - 1, true);
});
function loadPreset(i) {
  Object.assign(S, PRESETS[i].s, { whatif: 'none' });
  syncFilters(); setState(S.state, false); setTab('case'); restartCase(true);
}

/* ================= COMPARE ================= */
$('cmp-a').onchange = e => setState(e.target.value);
$('cmp-b').onchange = e => { S.cmpB = e.target.value; renderCompare(); };
function renderCompare() {
  const A = S.state, B = S.cmpB === A ? (A === 'Montana' ? 'Maryland' : 'Montana') : S.cmpB;
  $('cmp-a').innerHTML = stateOpts(A); $('cmp-b').innerHTML = stateOpts(B);
  const wSave = S.whatif; S.whatif = 'none';
  const ca = computeCase(A, S), cb = computeCase(B, S);
  S.whatif = wSave;
  $('cmp-ctx').innerHTML = `<span class="label">Same case in both</span><span>${esc(find(WHO, S.who)[1])} · ${esc(find(SRC, S.src)[1])} · ${esc(find(DB, S.db)[1])} · ${esc(find(CRIME, S.crime)[1])}</span><button class="copy" data-goto="case">Change the case</button>`;
  let h = `<div class="h pn">Step</div><div class="h">${esc(A)}</div><div class="h">${esc(B)}</div>`;
  const cell = (cs, i, k, st) => {
    const s = cs.steps[i];
    if (s.agg === 'skip') return `<div class="muted small">Never reached</div>`;
    const r = s.results[k]; if (!r) return `<div class="muted small">No special rule</div>`;
    const kind = s.agg === 'stop' && r.rule === '3' ? 'stop' : r.status;
    const ref = r.top ? lawRef(r.top.law) : `data-cmpprot="${st}|${r.rule}"`;
    return `<div><button class="cell" ${ref}>${img(SHOW[kind].sh, 28)}<span class="tagline ${SHOW[kind].tag}">${esc(SHOW[kind].word)}</span></button></div>`;
  };
  STEPS.forEach((s, i) => {
    if (s.key === 'trial') return;
    h += `<div class="g">${img(s.icon, 22)}<span class="label">${i + 1} · ${esc(s.short)}</span></div>`;
    s.checks.forEach(([rule, at], k) => {
      const ka = ca.steps[i].results.findIndex(r => r.rule === rule && r.at === at);
      const kb = cb.steps[i].results.findIndex(r => r.rule === rule && r.at === at);
      if (ka < 0 && kb < 0) return;
      h += `<div class="pn">${esc(rule === '4' && at === 'lineup' ? 'Lineups' : PROT[rule].short)}</div>${cell(ca, i, ka, A)}${cell(cb, i, kb, B)}`;
    });
  });
  const v = c => c.stopAt >= 0 ? `Stopped at step ${c.stopAt + 1}` : 'Search goes through';
  const prot = c => c.steps.flatMap(s => s.agg === 'skip' ? [] : s.results).filter(r => r.status === 'covered').length;
  h += `<div class="pn res-row" style="border-bottom:0">Result</div><div class="res-row" style="border-bottom:0">${v(ca)} · <span class="pxf" style="margin:0 4px">${prot(ca)}</span> protected</div><div class="res-row" style="border-bottom:0">${v(cb)} · <span class="pxf" style="margin:0 4px">${prot(cb)}</span> protected</div>`;
  $('cmp-grid').innerHTML = h;
}
$('cmp-grid').addEventListener('click', e => { const b = e.target.closest('[data-cmpprot]'); if (b) { const [st, r] = b.dataset.cmpprot.split('|'); protDrawer(st, r); } });

/* ================= READ THE LAWS ================= */
let LT = 'laws', LS = { key: 'state', dir: 1 };
const LDEF = {
  laws: { label: 'Laws in effect', rows: () => D.laws, cols: [['state', 'State'], ['name', 'Law'], ['does', 'What it does'], ['rules', 'Protections']],
    status: [['', 'Any status'], ['clear', 'Settled'], ['check', 'Unclear']], ok: (r, s) => !s || (s === 'check' ? r.review : !r.review),
    open: (r, q) => lawDrawer(r, q), ref: r => lawRef(r) },
  bills: { label: 'Bills', rows: () => D.bills, cols: [['state', 'State'], ['name', 'Bill'], ['does', 'What it would do'], ['rules', 'Protections']],
    status: [['', 'Any progress'], ...Object.entries(BILLSTEP).map(([k, v]) => [k, v])], ok: (r, s) => !s || r.step === s,
    open: (r, q) => billDrawer(r, q), ref: r => billRef(r) },
  quotes: { label: 'Exact wording', rows: () => D.quotes, cols: [['state', 'State'], ['item', 'Law or bill'], ['text', 'Exact wording'], ['rule', 'Protection']],
    status: [['', 'Laws and bills'], ['law', 'Laws only'], ['bill', 'Bills only']], ok: (r, s) => !s || (s === 'law' ? r.kind === 'Law' : r.kind !== 'Law'),
    open: (r, q) => r.kind === 'Law' ? lawDrawer(D.laws.find(l => l.state === r.state && l.name === r.item), q) : billDrawer(D.bills.find(b => b.state === r.state && b.name === r.item), q),
    ref: r => r.kind === 'Law' ? `data-law="${esc(r.state + '|' + r.item)}"` : `data-bill="${esc(r.state + '|' + r.item)}"` }
};
$('ltabs').innerHTML = Object.entries(LDEF).map(([k, d]) => `<button role="tab" data-lt="${k}" aria-selected="${k === LT}">${esc(d.label)}<span class="n">${d.rows().length}</span></button>`).join('');
$('ltabs').onclick = e => { const b = e.target.closest('[data-lt]'); if (b) { LT = b.dataset.lt; LS = { key: 'state', dir: 1 }; $('l-status').innerHTML = statusOpts(); renderLaws(); } };
$('l-state').innerHTML = '<option value="">All states</option>' + D.states.map(s => `<option>${esc(s.name)}</option>`).join('');
$('l-prot').innerHTML = '<option value="">Any protection</option>' + PORDER.map(k => `<option value="${k}">${esc(PROT[k].short)}</option>`).join('');
const statusOpts = () => LDEF[LT].status.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
$('l-status').innerHTML = statusOpts();
['l-q', 'l-state', 'l-prot', 'l-status'].forEach(id => $(id).addEventListener('input', renderLaws));
$('l-clear').onclick = () => { $('l-q').value = ''; $('l-state').value = ''; $('l-prot').value = ''; $('l-status').value = ''; renderLaws(); };
function renderLaws() {
  document.querySelectorAll('#ltabs [data-lt]').forEach(b => b.setAttribute('aria-selected', b.dataset.lt === LT));
  const def = LDEF[LT], q = $('l-q').value.trim().toLowerCase(), st = $('l-state').value, pr = $('l-prot').value, ss = $('l-status').value;
  let rows = def.rows().filter(r => (!st || r.state === st) && (!pr || (r.rules ? r.rules.includes(pr) : r.rule === pr)) && def.ok(r, ss) &&
    (!q || q.split(/\s+/).every(w => JSON.stringify(r).toLowerCase().includes(w))));
  rows = rows.slice().sort((a, b) => {
    const va = Array.isArray(a[LS.key]) ? a[LS.key].length : a[LS.key], vb = Array.isArray(b[LS.key]) ? b[LS.key].length : b[LS.key];
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * LS.dir;
  });
  $('l-count').textContent = `${rows.length} of ${def.rows().length} shown`;
  const qq = $('l-q').value.trim();
  const cell = (r, k) => {
    if (k === 'state') return `<span class="s">${esc(r.state)}</span>`;
    if (k === 'name') return `<span class="t">${hilite(r.name, qq)}${r.review ? '<span class="tagline t-would">Unclear</span>' : ''}${r.step ? billStatus(r) : ''}</span>`;
    if (k === 'item') return `<span class="t">${hilite(r.item, qq)}<span class="tagline t-no">${r.kind === 'Law' ? 'law' : 'bill'}</span></span>`;
    if (k === 'does') return `<span class="d">${hilite(r.does.length > 170 ? r.does.slice(0, 170) + '…' : r.does, qq)}</span>`;
    if (k === 'text') { const t = unq(r.text); return `<span class="d q">“${hilite(t.length > 200 ? t.slice(0, 200) + '…' : t, qq)}”</span>`; }
    if (k === 'rules') return protChips(r.rules, r.limits);
    if (k === 'rule') return `<div class="pchips"><span class="pchip">${esc(PROT[r.rule].short)}</span></div>`;
  };
  const head = `<div class="lhead">${def.cols.map(([k, t]) => `<button data-sort="${k}" class="label">${esc(t)}${LS.key === k ? (LS.dir > 0 ? ' ▲' : ' ▼') : ''}</button>`).join('')}<span></span></div>`;
  $('ltable').innerHTML = head + (rows.length ? rows.map(r => `<button class="lrow" ${def.ref(r)} data-hl="${esc(qq)}">${def.cols.map(([k]) => cell(r, k)).join('')}<span class="arrow go" aria-hidden="true">→</span></button>`).join('')
    : `<div class="empty">${img('step-search', 64)}<b style="font:600 18px var(--head);color:var(--navy)">Nothing matches</b><span>Try fewer words or filters.</span><button class="copy" onclick="document.getElementById('l-clear').click()">Clear filters</button></div>`);
  $('ltable').querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { LS = { key: b.dataset.sort, dir: LS.key === b.dataset.sort ? -LS.dir : 1 }; renderLaws(); });
}

/* ================= home ================= */
$('w-sub').textContent = 'It depends on where you live. Pick a state, follow a police search step by step, or read the laws themselves.';
$('hstats').innerHTML = [[counts.rules, 'states have at least one of 7 common protections', 'shield-yes'], [counts.zero, 'have a face recognition law with none of them', 'shield-part'], [counts.none, 'have no face recognition law at all', 'shield-no']]
  .map(([n, t, ic]) => `<div class="hstat">${img(ic, 36)}<b>${n}</b><span>${esc(t)}</span></div>`).join('');
$('home').onclick = () => setTab('home');

/* ================= start ================= */
syncFilters();
setState(S.state, false);
restartCase(false);
setTab(S.tab);
})();
