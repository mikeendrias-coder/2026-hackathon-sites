/** @OnlyCurrentDoc */
/*
 * Face Value sheet script v2.0.0 (sheet schema 2).
 *
 * This one file runs the Face Value control sheet. Paste all of it into Extensions > Apps Script > Code.gs.
 *
 * Menu "Face Value":
 *   Check for problems          lists errors (they block publishing), heads-ups and notes
 *   Preview changes             writes data/preview.json (drafts included); the site shows it with ?preview
 *   Open preview                links to the old site and the new page with ?preview
 *   Deploy to live site...      writes data/live.json (Approved wording only), after a diff and a confirm
 *   Undo last deploy...         puts back the version from before the last deploy
 *   Wording, Every 6 months, Setup   helpers; Setup holds the GitHub key, Upgrade or repair, and About
 *
 * Layout of this file:
 *   1. WORD_KEYS and SHEET_TEXTS (marked blocks that tools rewrite)
 *   2. FV: the pure core (no Google calls; tested in node by sheet/test/)
 *   3. FV1: the v1 converter, kept as it was, used only by Upgrade
 *   4. The Google side (menus, dialogs, GitHub)
 *   5. module.exports for node
 */
var FV_VERSION = '2.0.0';
var SCHEMA_VERSION = 2;

/* The page's word keys. qa/words-table.cjs --write-gs rewrites everything between these two marker lines. */
// <WORD_KEYS>
var WORD_KEYS = [
{"key":"site.name","where":"Header: site name next to the logo","max":24,"fills":[],"usedOn":"New page","text":"Face Value"},
{"key":"site.docTitle","where":"Browser tab title","max":80,"fills":[],"usedOn":"New page","text":"Face Value (draft): police face recognition laws by state"},
{"key":"site.draft","where":"Header: draft badge","max":12,"fills":[],"usedOn":"New page","text":"Draft"},
{"key":"site.liveLink","where":"Header: link to the current live site","max":24,"fills":[],"usedOn":"New page","text":"Live site"},
{"key":"site.banner","where":"Intro: small banner above the heading","max":40,"fills":[],"usedOn":"New page","text":"Prototype · Not legal advice"},
{"key":"site.skip","where":"Skip link for keyboard users (first Tab stop)","max":40,"fills":[],"usedOn":"New page","text":"Skip to the map"},
{"key":"intro.title","where":"Intro: main heading","max":80,"fills":[],"usedOn":"New page","text":"What stops police from using face recognition on you?"},
{"key":"intro.lede","where":"Intro: line under the heading","max":160,"fills":[],"usedOn":"New page","text":"It depends on your state. Pick yours to see which of 7 key protections its laws give you."},
{"key":"risk.heading","where":"Intro box: heading","max":40,"fills":[],"usedOn":"New page","text":"Why it’s risky"},
{"key":"risk.line1","where":"Intro box: first line","max":140,"fills":[],"usedOn":"New page","text":"Face recognition can point to the wrong person."},
{"key":"risk.line2","where":"Intro box: second line","max":140,"fills":[],"usedOn":"New page","text":"People have been arrested because of a bad match."},
{"key":"risk.line3","where":"Intro box: third line ({n} = places with no law)","max":140,"fills":["n"],"usedOn":"New page","text":"In {n} of the 50 states and DC, no law limits how police use it."},
{"key":"risk.linkText","where":"Intro box: \"Read more\" link","max":40,"fills":[],"usedOn":"New page","text":"Read more"},
{"key":"risk.url","where":"Intro box: address the \"Read more\" link opens (https only)","max":200,"fills":[],"usedOn":"New page","text":"https://example.com/face-value-read-more"},
{"key":"map.heading","where":"Map: heading","max":40,"fills":[],"usedOn":"New page","text":"Pick your state"},
{"key":"ov.pick","where":"Overview: bar at the end of the panel that opens the state picker","max":40,"fills":[],"usedOn":"New page","text":"Pick your state"},
{"key":"map.ddLabel","where":"Map: label of the state dropdown","max":30,"fills":[],"usedOn":"New page","text":"State"},
{"key":"map.ddPlaceholder","where":"Map: dropdown button before a state is picked","max":30,"fills":[],"usedOn":"New page","text":"Choose a state"},
{"key":"map.ddListLabel","where":"Map: name of the dropdown list, for screen readers","max":30,"fills":[],"usedOn":"New page","text":"States"},
{"key":"map.tilesLabel","where":"Map: name of the tile grid, for screen readers","max":40,"fills":[],"usedOn":"New page","text":"Map of the states"},
{"key":"map.loading","where":"Map: placeholder while the data loads","max":40,"fills":[],"usedOn":"New page","text":"Loading the map…"},
{"key":"map.legendLabel","where":"Map: name of the legend, for screen readers","max":40,"fills":[],"usedOn":"New page","text":"What the colors mean"},
{"key":"map.legend.l4","where":"Map legend: 5 to 7 protections","max":30,"fills":[],"usedOn":"New page","text":"5 to 7 protections"},
{"key":"map.legend.l3","where":"Map legend: 3 or 4 protections","max":30,"fills":[],"usedOn":"New page","text":"3 or 4 protections"},
{"key":"map.legend.l2","where":"Map legend: 2 protections","max":30,"fills":[],"usedOn":"New page","text":"2 protections"},
{"key":"map.legend.l1","where":"Map legend: 1 protection","max":30,"fills":[],"usedOn":"New page","text":"1 protection"},
{"key":"map.legend.lb","where":"Map legend: ban or pause","max":30,"fills":[],"usedOn":"New page","text":"Ban or pause"},
{"key":"map.legend.lz","where":"Map legend: a law with none of the 7","max":30,"fills":[],"usedOn":"New page","text":"Law, none of the 7"},
{"key":"map.legend.l0","where":"Map legend: no law","max":30,"fills":[],"usedOn":"New page","text":"No law"},
{"key":"map.legend.aria","where":"Map legend chip, for screen readers","max":60,"fills":["label","n"],"usedOn":"New page","text":"{label}: {n}"},
{"key":"tile.rules.one","where":"Map tile name and tooltip: 1 protection","max":60,"fills":["state"],"usedOn":"New page","text":"{state}: 1 of 7 protections"},
{"key":"tile.rules.other","where":"Map tile name and tooltip: several protections","max":60,"fills":["state","n"],"usedOn":"New page","text":"{state}: {n} of 7 protections"},
{"key":"tile.zero","where":"Map tile name and tooltip: law with none of the 7","max":60,"fills":["state"],"usedOn":"New page","text":"{state}: a law with none of the 7 protections"},
{"key":"tile.none","where":"Map tile name and tooltip: no law","max":60,"fills":["state"],"usedOn":"New page","text":"{state}: no law"},
{"key":"tile.ban","where":"Map tile name and tooltip: ban","max":60,"fills":["state"],"usedOn":"New page","text":"{state}: ban on police face recognition"},
{"key":"tile.pause","where":"Map tile name and tooltip: pause","max":60,"fills":["state"],"usedOn":"New page","text":"{state}: pause on police face recognition"},
{"key":"tile.ban.some","where":"Map tile name and tooltip: ban that covers only some police ({who})","max":60,"fills":["state","who"],"usedOn":"New page","text":"{state}: ban for {who}"},
{"key":"tile.pause.some","where":"Map tile name and tooltip: pause that covers only some police ({who})","max":60,"fills":["state","who"],"usedOn":"New page","text":"{state}: pause for {who}"},
{"key":"ov.kicker","where":"Panel, no state picked: small label","max":30,"fills":[],"usedOn":"New page","text":"The 7 protections"},
{"key":"ov.heading","where":"Panel, no state picked: heading","max":60,"fills":[],"usedOn":"New page","text":"What we check in every state"},
{"key":"ov.intro","where":"Panel, no state picked: line under the heading","max":140,"fills":[],"usedOn":"New page","text":"Tap a protection to see why it matters and which states have it."},
{"key":"ov.count.zero","where":"Overview row: no state has it","max":30,"fills":[],"usedOn":"New page","text":"In no state yet"},
{"key":"ov.count.one","where":"Overview row: 1 state has it","max":30,"fills":[],"usedOn":"New page","text":"In 1 state"},
{"key":"ov.count.other","where":"Overview row: several states have it","max":30,"fills":["n"],"usedOn":"New page","text":"In {n} states"},
{"key":"ov.full","where":"Overview row, opened: label before the states with it in full","max":40,"fills":[],"usedOn":"New page","text":"Has it in full:"},
{"key":"ov.part","where":"Overview row, opened: label before the states with part of it","max":40,"fills":[],"usedOn":"New page","text":"Has part of it:"},
{"key":"ov.none","where":"Overview row, opened: no state has it","max":80,"fills":[],"usedOn":"New page","text":"No state has this yet."},
{"key":"pn.kicker","where":"Panel: small label above the state name","max":30,"fills":[],"usedOn":"New page","text":"State scorecard"},
{"key":"pn.change","where":"Panel: button to pick another state","max":30,"fills":[],"usedOn":"New page","text":"Change state"},
{"key":"pn.again","where":"Panel: bar at the bottom","max":40,"fills":[],"usedOn":"New page","text":"Pick another state"},
{"key":"view.label","where":"Panel: name of the view switch, for screen readers","max":20,"fills":[],"usedOn":"New page","text":"View"},
{"key":"view.score","where":"Panel: view switch button","max":24,"fills":[],"usedOn":"New page","text":"Scorecard"},
{"key":"view.case","where":"Panel: view switch button","max":30,"fills":[],"usedOn":"New page","text":"Walk through a case"},
{"key":"sum.none","where":"Panel summary: no law","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has no law on police face recognition."},
{"key":"sum.zero","where":"Panel summary: a law with none of the 7","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has a face recognition law. It adds none of the 7 protections."},
{"key":"sum.ban","where":"Panel summary: ban on some police ({who})","max":160,"fills":["TheState","who"],"usedOn":"New page","text":"{TheState} bans face recognition for {who}."},
{"key":"sum.ban.all","where":"Panel summary: ban on all police","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} bans police face recognition."},
{"key":"sum.pause","where":"Panel summary: pause on some police ({who})","max":160,"fills":["TheState","who"],"usedOn":"New page","text":"{TheState} has paused face recognition for {who} until lawmakers allow it."},
{"key":"sum.pause.all","where":"Panel summary: pause on all police","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has paused police face recognition until lawmakers allow it."},
{"key":"sum.banPlus.one","where":"Panel summary: added after a ban, 1 protection","max":120,"fills":[],"usedOn":"New page","text":"It also has 1 of the 7 protections."},
{"key":"sum.banPlus.other","where":"Panel summary: added after a ban, several protections","max":120,"fills":["n"],"usedOn":"New page","text":"It also has {n} of the 7 protections."},
{"key":"sum.rules.full.one","where":"Panel summary: 1 protection, in full","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has 1 of the 7 protections, in full."},
{"key":"sum.rules.full.other","where":"Panel summary: several protections, all in full","max":160,"fills":["TheState","n"],"usedOn":"New page","text":"{TheState} has {n} of the 7 protections, all in full."},
{"key":"sum.rules.all","where":"Panel summary: all 7 in full","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has all 7 protections in full."},
{"key":"sum.rules.part.one","where":"Panel summary: 1 protection, in part","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has 1 of the 7 protections, only in part."},
{"key":"sum.rules.part.other","where":"Panel summary: several protections, all in part","max":160,"fills":["TheState","n"],"usedOn":"New page","text":"{TheState} has {n} of the 7 protections, all only in part."},
{"key":"sum.rules.mixed","where":"Panel summary: some in full, some in part","max":160,"fills":["TheState","n","full","part"],"usedOn":"New page","text":"{TheState} has {n} of the 7 protections: {full} in full and {part} in part."},
{"key":"meter.label","where":"Meter caption under the 7 shields","max":30,"fills":["n"],"usedOn":"New page","text":"{n} of 7"},
{"key":"meter.ban","where":"Meter caption in a ban or pause state","max":30,"fills":["Kind"],"usedOn":"New page","text":"{Kind} in place"},
{"key":"meter.ban.some","where":"Meter caption: ban or pause that covers only some police ({who})","max":30,"fills":["Kind","who"],"usedOn":"New page","text":"{Kind} for {who}"},
{"key":"meter.aria","where":"Meter, for screen readers","max":60,"fills":["theState"],"usedOn":"New page","text":"Protections in {theState}"},
{"key":"meter.item","where":"Meter shield tooltip and screen-reader line","max":80,"fills":["name","status"],"usedOn":"New page","text":"{name}: {status}"},
{"key":"tag.yes","where":"Tag: yes","max":16,"fills":[],"usedOn":"New page","text":"Yes"},
{"key":"tag.part","where":"Tag: partly","max":16,"fills":[],"usedOn":"New page","text":"Partly"},
{"key":"tag.no","where":"Tag: no","max":16,"fills":[],"usedOn":"New page","text":"No"},
{"key":"tag.unclear","where":"Tag: unclear","max":16,"fills":[],"usedOn":"New page","text":"Unclear"},
{"key":"tag.banCovers","where":"Tag on a protection row in a ban or pause state","max":24,"fills":["Kind"],"usedOn":"New page","text":"{Kind} covers it"},
{"key":"tag.banCovers.some","where":"Tag on a protection row: ban or pause on only some police ({who})","max":30,"fills":["Kind","who"],"usedOn":"New page","text":"{Kind} covers {who}"},
{"key":"tag.stop","where":"Case tag: the search stopped here","max":16,"fills":[],"usedOn":"New page","text":"Stopped"},
{"key":"tag.skip","where":"Case tag: step never reached","max":16,"fills":[],"usedOn":"New page","text":"Never reached"},
{"key":"tag.na","where":"Case tag: does not apply to this case","max":16,"fills":[],"usedOn":"New page","text":"Doesn’t apply"},
{"key":"tag.reach","where":"Case tag note: a law exists but misses this case","max":30,"fills":[],"usedOn":"New page","text":"Law doesn’t reach this"},
{"key":"tag.other","where":"Case tag: another law in the state","max":16,"fills":[],"usedOn":"New page","text":"Other law"},
{"key":"tag.lineupNone","where":"Case tag: no lineup rule","max":16,"fills":[],"usedOn":"New page","text":"No rule"},
{"key":"row.catch","where":"Row: the catch on a \"Partly\" row ({limits})","max":240,"fills":["limits"],"usedOn":"New page","text":"The catch: {limits}."},
{"key":"row.no","where":"Row: a protection the state lacks","max":160,"fills":["state"],"usedOn":"New page","text":"No {state} law adds this protection."},
{"key":"row.no.ban","where":"Row: a protection the state lacks, in a ban or pause state","max":160,"fills":["state","kind","who"],"usedOn":"New page","text":"No {state} law adds this protection. The {kind} stops {who} from using face recognition."},
{"key":"row.no.banExcept","where":"Row: a protection the state lacks, in a ban or pause state whose ban has exceptions","max":160,"fills":["state","kind","who"],"usedOn":"New page","text":"No {state} law adds this protection. The {kind} stops {who} from using face recognition, with some exceptions."},
{"key":"row.unsettled","where":"The one reused sentence for every \"Unclear\" answer","max":200,"fills":[],"usedOn":"New page","text":"Because of how the law is written, the answer isn’t settled."},
{"key":"row.unclearWhy","where":"Row: label before the reason a law is flagged unclear","max":30,"fills":[],"usedOn":"New page","text":"What’s unclear:"},
{"key":"row.hasFull","where":"Row, opened: label before the states with it in full","max":40,"fills":[],"usedOn":"New page","text":"Has it in full:"},
{"key":"row.nat.both","where":"Row, opened: national count, full and part","max":120,"fills":["yes","part"],"usedOn":"New page","text":"Across the country: {yes} in full, {part} in part."},
{"key":"row.nat.full","where":"Row, opened: national count, full only","max":120,"fills":["yes"],"usedOn":"New page","text":"Across the country: {yes} in full."},
{"key":"row.nat.part","where":"Row, opened: national count, part only","max":120,"fills":["part"],"usedOn":"New page","text":"Across the country: {part} in part, none in full."},
{"key":"row.nat.none","where":"Row, opened: no state has it","max":120,"fills":[],"usedOn":"New page","text":"Across the country: no state has this yet."},
{"key":"count.states.one","where":"Count of states, singular","max":20,"fills":[],"usedOn":"New page","text":"1 state"},
{"key":"count.states.other","where":"Count of states, plural","max":20,"fills":["n"],"usedOn":"New page","text":"{n} states"},
{"key":"row.name","where":"Row name for screen readers: protection and its status","max":80,"fills":["name","status"],"usedOn":"New page","text":"{name}: {status}"},
{"key":"row.nameUnclear","where":"Row name for screen readers when unclear","max":80,"fills":["name","status"],"usedOn":"New page","text":"{name}: {status}, unclear"},
{"key":"law.meta","where":"Law card: status and year","max":60,"fills":["status","year"],"usedOn":"New page","text":"{status} · {year}"},
{"key":"law.noQuote","where":"Law card: when no exact wording is recorded","max":120,"fills":[],"usedOn":"New page","text":"No exact wording recorded. Read the official text."},
{"key":"law.readLaw","where":"Law card: link to the official text","max":30,"fills":[],"usedOn":"New page","text":"Read the law"},
{"key":"law.readLawAria","where":"Law card link, for screen readers","max":160,"fills":["name"],"usedOn":"New page","text":"Read the law: {name}"},
{"key":"law.cite","where":"Law card: label before the citation","max":20,"fills":[],"usedOn":"New page","text":"Citation"},
{"key":"law.notCounted","where":"Zero-law and other-law cards: label before why it adds none of the 7","max":40,"fills":[],"usedOn":"New page","text":"Why it doesn’t count:"},
{"key":"a11y.newTab","where":"Screen-reader note on links that open a new tab","max":40,"fills":[],"usedOn":"New page","text":"(opens in a new tab)"},
{"key":"quote.also","where":"Quote badge before words the law also allows (marked ((…)) in the Sheet)","max":20,"fills":[],"usedOn":"New page","text":"Also allowed"},
{"key":"quote.exc","where":"Quote badge before an exception in the law (marked [[…]] in the Sheet)","max":20,"fills":[],"usedOn":"New page","text":"Exception"},
{"key":"catch.src.drone","where":"The catch: a law that only covers drones","max":80,"fills":[],"usedOn":"New page","text":"it only covers police drones"},
{"key":"catch.src.bodycam","where":"The catch: a law that only covers body cameras","max":80,"fills":[],"usedOn":"New page","text":"it only covers body-camera footage"},
{"key":"catch.src.camera","where":"The catch: a law that only covers security cameras","max":80,"fills":[],"usedOn":"New page","text":"it only covers security-camera footage"},
{"key":"catch.src.still","where":"The catch: a law that only covers still photos","max":80,"fills":[],"usedOn":"New page","text":"it only covers still photos"},
{"key":"catch.db","where":"The catch: a law that only covers license photos","max":80,"fills":[],"usedOn":"New page","text":"it only covers searches of driver’s license photos"},
{"key":"catch.who","where":"The catch: a law that only covers some agencies ({who})","max":80,"fills":["who"],"usedOn":"New page","text":"it only covers {who}"},
{"key":"catch.lineupArrest","where":"Case: why a lineup-only rule misses an arrest","max":120,"fills":[],"usedOn":"New page","text":"it only covers lineups, and police can arrest someone without a lineup"},
{"key":"catch.unknown","where":"The catch: a limit code with no plain words yet ({code})","max":120,"fills":["code"],"usedOn":"New page","text":"it has a limit ({code})"},
{"key":"whoFor.local","where":"Who a law covers: local police","max":30,"fills":[],"usedOn":"New page","text":"local police"},
{"key":"whoFor.state","where":"Who a law covers: state agencies","max":30,"fills":[],"usedOn":"New page","text":"state agencies"},
{"key":"whoFor.any","where":"Who a law covers: anyone","max":30,"fills":[],"usedOn":"New page","text":"anyone"},
{"key":"whoFor.other","where":"Who a law covers: a group with no words yet","max":30,"fills":[],"usedOn":"New page","text":"some agencies"},
{"key":"police.local","where":"Who a ban covers: local police","max":30,"fills":[],"usedOn":"New page","text":"local police"},
{"key":"police.state","where":"Who a ban covers: state police","max":30,"fills":[],"usedOn":"New page","text":"state police"},
{"key":"police.all","where":"Who a ban covers: all police","max":30,"fills":[],"usedOn":"New page","text":"all police"},
{"key":"police.other","where":"Who a ban covers: a group with no words yet","max":30,"fills":[],"usedOn":"New page","text":"some police"},
{"key":"kind.ban","where":"The word for a ban (lowercase; it is capitalized at the start of a line)","max":20,"fills":[],"usedOn":"New page","text":"ban"},
{"key":"kind.pause","where":"The word for a pause (lowercase; it is capitalized at the start of a line)","max":20,"fills":[],"usedOn":"New page","text":"pause"},
{"key":"join.two","where":"Joins two items in a list","max":20,"fills":["a","b"],"usedOn":"New page","text":"{a} and {b}"},
{"key":"join.many","where":"Joins the last item of a longer list","max":20,"fills":["list","last"],"usedOn":"New page","text":"{list} and {last}"},
{"key":"ban.heading","where":"Ban card: heading","max":60,"fills":["Kind"],"usedOn":"New page","text":"{Kind} on police face recognition"},
{"key":"ban.heading.some","where":"Ban card: heading, ban on only some police ({who})","max":60,"fills":["Kind","who"],"usedOn":"New page","text":"{Kind} on face recognition for {who}"},
{"key":"ban.covers","where":"Ban card: who it covers","max":120,"fills":["who"],"usedOn":"New page","text":"It covers {who}."},
{"key":"ban.exceptions","where":"Ban card: heading over the exception laws","max":40,"fills":[],"usedOn":"New page","text":"Exceptions in other laws"},
{"key":"zero.heading","where":"Zero-law card: heading","max":80,"fills":[],"usedOn":"New page","text":"A law with none of the 7 protections"},
{"key":"other.heading.one","where":"Other laws disclosure: 1 law","max":60,"fills":["theState"],"usedOn":"New page","text":"Other law in {theState} (1)"},
{"key":"other.heading.other","where":"Other laws disclosure: several laws","max":60,"fills":["theState","n"],"usedOn":"New page","text":"Other laws in {theState} ({n})"},
{"key":"other.intro","where":"Other laws disclosure, opened: first line","max":140,"fills":[],"usedOn":"New page","text":"These laws touch face recognition. They add none of the 7 protections."},
{"key":"bills.heading","where":"Bills disclosure: heading","max":60,"fills":["session","n"],"usedOn":"New page","text":"Bills in the {session} session ({n})"},
{"key":"bills.none","where":"Bills disclosure: no bills","max":120,"fills":["session"],"usedOn":"New page","text":"No face recognition bills in the {session} session."},
{"key":"bills.noneAny","where":"Bills disclosure: no bills in the data at all","max":120,"fills":[],"usedOn":"New page","text":"No face recognition bills are recorded."},
{"key":"bills.alive","where":"Bill tag: still alive","max":20,"fills":[],"usedOn":"New page","text":"Still alive"},
{"key":"bills.over","where":"Bill tag: session over","max":20,"fills":[],"usedOn":"New page","text":"Session over"},
{"key":"bills.line","where":"Bill line: name, year and furthest step","max":80,"fills":["bill","year","step"],"usedOn":"New page","text":"{bill}, {year}: {step}"},
{"key":"bills.text","where":"Bill: link to the bill text","max":30,"fills":[],"usedOn":"New page","text":"Bill text"},
{"key":"bills.textAria","where":"Bill link, for screen readers","max":120,"fills":["bill"],"usedOn":"New page","text":"Bill text: {bill}"},
{"key":"impact.add","where":"Bill impact chip: adds a protection","max":30,"fills":[],"usedOn":"New page","text":"Adds"},
{"key":"impact.addPart","where":"Bill impact chip: adds only part of a protection","max":30,"fills":[],"usedOn":"New page","text":"Adds part"},
{"key":"impact.up","where":"Bill impact chip: makes one stronger","max":30,"fills":[],"usedOn":"New page","text":"Stronger"},
{"key":"impact.have","where":"Bill impact chip: already law","max":30,"fills":[],"usedOn":"New page","text":"Already law"},
{"key":"impact.same","where":"Bill impact chip: already partly law","max":30,"fills":[],"usedOn":"New page","text":"Already partly law"},
{"key":"impact.loose","where":"Bill impact chip: widens police use","max":30,"fills":[],"usedOn":"New page","text":"Widens police use"},
{"key":"impact.none","where":"Bill impact: adds none of the 7","max":60,"fills":[],"usedOn":"New page","text":"Adds none of the 7 protections"},
{"key":"impact.aria","where":"Bill impact chip, for screen readers","max":80,"fills":["kind","name"],"usedOn":"New page","text":"{kind}: {name}"},
{"key":"bill.add.one","where":"Row note: 1 bill would add this","max":160,"fills":["session","bills"],"usedOn":"New page","text":"A {session} bill would add this ({bills})."},
{"key":"bill.add.other","where":"Row note: several bills would add this","max":160,"fills":["n","session","bills"],"usedOn":"New page","text":"{n} bills in {session} would add this ({bills})."},
{"key":"bill.addPart.one","where":"Row note: 1 bill would add part of this","max":160,"fills":["session","bills"],"usedOn":"New page","text":"A {session} bill would add part of this ({bills})."},
{"key":"bill.addPart.other","where":"Row note: several bills would add part of this","max":160,"fills":["n","session","bills"],"usedOn":"New page","text":"{n} bills in {session} would add part of this ({bills})."},
{"key":"bill.up.one","where":"Row note: 1 bill would make this stronger","max":160,"fills":["session","bills"],"usedOn":"New page","text":"A {session} bill would make this stronger ({bills})."},
{"key":"bill.up.other","where":"Row note: several bills would make this stronger","max":160,"fills":["n","session","bills"],"usedOn":"New page","text":"{n} bills in {session} would make this stronger ({bills})."},
{"key":"bill.loose.one","where":"Row note: 1 bill would widen police use","max":160,"fills":["session","bills"],"usedOn":"New page","text":"A {session} bill would let police use face recognition in more cases ({bills})."},
{"key":"bill.loose.other","where":"Row note: several bills would widen police use","max":160,"fills":["n","session","bills"],"usedOn":"New page","text":"{n} bills in {session} would let police use face recognition in more cases ({bills})."},
{"key":"bill.addOver.one","where":"Row note: 1 ended bill tried to add this","max":160,"fills":["session","bills"],"usedOn":"New page","text":"A {session} bill tried to add this ({bills}). It did not become law."},
{"key":"bill.addOver.other","where":"Row note: several ended bills tried to add this","max":160,"fills":["n","session","bills"],"usedOn":"New page","text":"{n} bills in {session} tried to add this ({bills}). None became law."},
{"key":"bill.addPartOver.one","where":"Row note: 1 ended bill tried to add part of this","max":160,"fills":["session","bills"],"usedOn":"New page","text":"A {session} bill tried to add part of this ({bills}). It did not become law."},
{"key":"bill.addPartOver.other","where":"Row note: several ended bills tried to add part of this","max":160,"fills":["n","session","bills"],"usedOn":"New page","text":"{n} bills in {session} tried to add part of this ({bills}). None became law."},
{"key":"bill.upOver.one","where":"Row note: 1 ended bill tried to make this stronger","max":160,"fills":["session","bills"],"usedOn":"New page","text":"A {session} bill tried to make this stronger ({bills}). It did not become law."},
{"key":"bill.upOver.other","where":"Row note: several ended bills tried to make this stronger","max":160,"fills":["n","session","bills"],"usedOn":"New page","text":"{n} bills in {session} tried to make this stronger ({bills}). None became law."},
{"key":"bill.looseOver.one","where":"Row note: 1 ended bill tried to widen police use","max":160,"fills":["session","bills"],"usedOn":"New page","text":"A {session} bill tried to let police use face recognition in more cases ({bills}). It did not become law."},
{"key":"bill.looseOver.other","where":"Row note: several ended bills tried to widen police use","max":160,"fills":["n","session","bills"],"usedOn":"New page","text":"{n} bills in {session} tried to let police use face recognition in more cases ({bills}). None became law."},
{"key":"case.controlsLabel","where":"Case: name of the settings area, for screen readers","max":40,"fills":[],"usedOn":"New page","text":"Case settings"},
{"key":"ctl.police","where":"Case control group label","max":30,"fills":[],"usedOn":"New page","text":"Police"},
{"key":"ctl.photo","where":"Case control group label","max":30,"fills":[],"usedOn":"New page","text":"Photo"},
{"key":"ctl.search","where":"Case control group label","max":30,"fills":[],"usedOn":"New page","text":"Searched against"},
{"key":"ctl.crime","where":"Case control group label","max":30,"fills":[],"usedOn":"New page","text":"Crime"},
{"key":"ctl.police.local","where":"Case chip","max":24,"fills":[],"usedOn":"New page","text":"Local"},
{"key":"ctl.police.state","where":"Case chip","max":24,"fills":[],"usedOn":"New page","text":"State"},
{"key":"ctl.photo.still","where":"Case chip","max":24,"fills":[],"usedOn":"New page","text":"Still photo"},
{"key":"ctl.photo.camera","where":"Case chip","max":24,"fills":[],"usedOn":"New page","text":"Security camera"},
{"key":"ctl.photo.drone","where":"Case chip","max":24,"fills":[],"usedOn":"New page","text":"Drone"},
{"key":"ctl.photo.bodycam","where":"Case chip","max":24,"fills":[],"usedOn":"New page","text":"Body camera"},
{"key":"ctl.search.licenses","where":"Case chip","max":30,"fills":[],"usedOn":"New page","text":"Driver’s license photos"},
{"key":"ctl.search.mugshots","where":"Case chip","max":24,"fills":[],"usedOn":"New page","text":"Mugshots"},
{"key":"ctl.crime.robbery","where":"Case chip","max":24,"fills":[],"usedOn":"New page","text":"Armed robbery"},
{"key":"ctl.crime.shoplifting","where":"Case chip","max":24,"fills":[],"usedOn":"New page","text":"Shoplifting"},
{"key":"ctl.police.local.aria","where":"Case chip, for screen readers","max":40,"fills":[],"usedOn":"New page","text":"Local police"},
{"key":"ctl.police.state.aria","where":"Case chip, for screen readers","max":40,"fills":[],"usedOn":"New page","text":"State police"},
{"key":"case.question","where":"Case: the setup sentence","max":240,"fills":["theState","who","photo","crime","search"],"usedOn":"New page","text":"In {theState}, {who} have {photo} from {crime}. They search it against {search}. What stops them?"},
{"key":"q.police.local","where":"Case question: local police","max":30,"fills":[],"usedOn":"New page","text":"local police"},
{"key":"q.police.state","where":"Case question: state police","max":30,"fills":[],"usedOn":"New page","text":"state police"},
{"key":"q.police.dc","where":"Case question: police in DC (DC has no state police)","max":30,"fills":[],"usedOn":"New page","text":"police"},
{"key":"q.photo.still","where":"Case question: a still photo","max":40,"fills":[],"usedOn":"New page","text":"a still photo"},
{"key":"q.photo.camera","where":"Case question: security-camera footage","max":40,"fills":[],"usedOn":"New page","text":"security-camera footage"},
{"key":"q.photo.drone","where":"Case question: drone footage","max":40,"fills":[],"usedOn":"New page","text":"drone footage"},
{"key":"q.photo.bodycam","where":"Case question: body-camera footage","max":40,"fills":[],"usedOn":"New page","text":"body-camera footage"},
{"key":"q.crime.robbery","where":"Case question: an armed robbery","max":40,"fills":[],"usedOn":"New page","text":"an armed robbery"},
{"key":"q.crime.shoplifting","where":"Case question: a shoplifting case","max":40,"fills":[],"usedOn":"New page","text":"a shoplifting case"},
{"key":"q.search.licenses","where":"Case question: license photos","max":60,"fills":[],"usedOn":"New page","text":"driver’s license photos"},
{"key":"q.search.mugshots","where":"Case question: mugshots","max":60,"fills":[],"usedOn":"New page","text":"mugshots"},
{"key":"case.banGap","where":"Case note: a ban that misses these police","max":200,"fills":["kind","theState","banWho","who"],"usedOn":"New page","text":"The {kind} in {theState} covers {banWho}. It does not cover {who}, so it doesn’t stop this search."},
{"key":"case.banGap.unclear","where":"Case note: a ban that may or may not cover these police","max":200,"fills":["kind","theState","banWho","who"],"usedOn":"New page","text":"The {kind} in {theState} clearly covers {banWho}. Whether it also covers {who} is not settled, so this walk-through treats the search as allowed."},
{"key":"case.noLaw","where":"Case note: no law","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has no law on police face recognition, so no step is protected."},
{"key":"case.zeroLaw","where":"Case note: a law with none of the 7","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has a face recognition law. It adds none of the 7 protections, so no step is protected."},
{"key":"case.lessonLabel","where":"Case: label on the example callout","max":30,"fills":[],"usedOn":"New page","text":"What this shows"},
{"key":"case.stepsLabel","where":"Case: name of the step list, for screen readers","max":40,"fills":[],"usedOn":"New page","text":"The steps of the case"},
{"key":"case.seeLaw","where":"Case step: link to the scorecard row","max":30,"fills":[],"usedOn":"New page","text":"See the law"},
{"key":"case.seeLawAria","where":"Case step link, for screen readers","max":80,"fills":["name"],"usedOn":"New page","text":"See the law: {name}"},
{"key":"case.whyLabel","where":"Case step: label before why the step matters","max":40,"fills":[],"usedOn":"New page","text":"Why this step matters"},
{"key":"step.label","where":"Case step number","max":20,"fills":["n"],"usedOn":"New page","text":"Step {n}"},
{"key":"step.ariaPlain","where":"Case step with no status, for screen readers","max":120,"fills":["n","total","title"],"usedOn":"New page","text":"Step {n} of {total}: {title}"},
{"key":"step.aria","where":"Case step, for screen readers","max":120,"fills":["n","total","title","status"],"usedOn":"New page","text":"Step {n} of {total}: {title} ({status})"},
{"key":"step.crime.title","where":"Case step 1 title","max":60,"fills":[],"usedOn":"New page","text":"Is the crime serious enough?"},
{"key":"step.approval.title","where":"Case step 2 title","max":60,"fills":[],"usedOn":"New page","text":"Does a judge have to approve?"},
{"key":"step.search.title","where":"Case step 3 title","max":60,"fills":[],"usedOn":"New page","text":"How the search is run"},
{"key":"step.arrest.title","where":"Case step 4 title","max":60,"fills":[],"usedOn":"New page","text":"Is a match enough to arrest?"},
{"key":"step.disclose.title","where":"Case step 5 title","max":60,"fills":[],"usedOn":"New page","text":"Is the person charged told?"},
{"key":"step.trial.title","where":"Case step 6 title","max":60,"fills":[],"usedOn":"New page","text":"Result"},
{"key":"step.crime.short","where":"Case step 1 short name","max":16,"fills":[],"usedOn":"New page","text":"Crime"},
{"key":"step.approval.short","where":"Case step 2 short name","max":16,"fills":[],"usedOn":"New page","text":"Judge"},
{"key":"step.search.short","where":"Case step 3 short name","max":16,"fills":[],"usedOn":"New page","text":"Search"},
{"key":"step.arrest.short","where":"Case step 4 short name","max":16,"fills":[],"usedOn":"New page","text":"Arrest"},
{"key":"step.disclose.short","where":"Case step 5 short name","max":16,"fills":[],"usedOn":"New page","text":"Told"},
{"key":"step.trial.short","where":"Case step 6 short name","max":16,"fills":[],"usedOn":"New page","text":"Result"},
{"key":"never","where":"The one reused sentence for a step the search never reached","max":120,"fills":[],"usedOn":"New page","text":"Never reached. The search had already stopped."},
{"key":"head.covered","where":"Case step answer: protected","max":120,"fills":["TheState"],"usedOn":"New page","text":"Yes. {TheState} law steps in here."},
{"key":"head.mixed","where":"Case step answer: some checks apply","max":120,"fills":["TheState","have","total"],"usedOn":"New page","text":"Partly. {TheState} has {have} of the {total} checks here."},
{"key":"head.partial","where":"Case step answer: a rule with a catch","max":120,"fills":["TheState"],"usedOn":"New page","text":"Partly. {TheState} has a rule here, with a catch."},
{"key":"head.review","where":"Case step answer: unclear","max":120,"fills":[],"usedOn":"New page","text":"Unclear."},
{"key":"head.bypassed","where":"Case step answer: a law that misses this case","max":120,"fills":["TheState"],"usedOn":"New page","text":"No. {TheState} has a law here. It doesn’t reach this case."},
{"key":"head.gap","where":"Case step answer: no law","max":120,"fills":["state"],"usedOn":"New page","text":"No. {state} law adds no protection here."},
{"key":"head.stop.ban","where":"Case step answer: stopped by a ban","max":120,"fills":["TheState","who"],"usedOn":"New page","text":"Stopped. {TheState} bans face recognition for {who}."},
{"key":"head.stop.pause","where":"Case step answer: stopped by a pause","max":120,"fills":["TheState","who"],"usedOn":"New page","text":"Stopped. {TheState} has paused face recognition for {who}."},
{"key":"head.stop.crime","where":"Case step answer: stopped, crime not serious enough","max":120,"fills":["TheState"],"usedOn":"New page","text":"Stopped. {TheState} only allows face recognition for serious crimes."},
{"key":"head.stop.bar","where":"Case step answer: stopped by a bar on this footage","max":120,"fills":["TheState"],"usedOn":"New page","text":"Stopped. {TheState} law bars this search."},
{"key":"line.na.has","where":"Case line: live scanning rule, still photo, state has the rule","max":160,"fills":["TheState"],"usedOn":"New page","text":"Doesn’t apply. This case uses one still photo. {TheState} limits live scanning."},
{"key":"line.na","where":"Case line: live scanning rule, still photo","max":160,"fills":[],"usedOn":"New page","text":"Doesn’t apply. This case uses one still photo, with no live scanning."},
{"key":"line.stop.crime","where":"Case line: stopped, crime not serious enough","max":160,"fills":["TheState"],"usedOn":"New page","text":"Stopped. {TheState} only allows face recognition for serious crimes. Shoplifting isn’t one."},
{"key":"line.serious","where":"Case line: serious-crimes rule, serious crime","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} limits face recognition to serious crimes. An armed robbery counts, so this rule doesn’t stop the search."},
{"key":"line.stop","where":"Case line: stopped by a ban or bar ({text})","max":400,"fills":["text"],"usedOn":"New page","text":"Stopped. {text}"},
{"key":"line.covered.1","where":"Case line: judge must approve","max":160,"fills":[],"usedOn":"New page","text":"Police must get a judge’s approval before they search."},
{"key":"line.covered.6","where":"Case line: no live crowd scanning","max":160,"fills":[],"usedOn":"New page","text":"Live scanning and scanning everyone in view are limited."},
{"key":"line.covered.5","where":"Case line: tested for accuracy","max":160,"fills":[],"usedOn":"New page","text":"The software has to be tested to show it works accurately."},
{"key":"line.covered.7","where":"Case line: staff must be trained","max":160,"fills":[],"usedOn":"New page","text":"Staff who run the search must be trained."},
{"key":"line.covered.4.lineup","where":"Case line: lineup rule","max":160,"fills":[],"usedOn":"New page","text":"Police can’t put someone in a lineup based only on the match."},
{"key":"line.covered.4","where":"Case line: a match isn’t enough","max":160,"fills":[],"usedOn":"New page","text":"A match alone isn’t enough. Police need other evidence before they arrest."},
{"key":"line.covered.2","where":"Case line: person charged is told","max":160,"fills":[],"usedOn":"New page","text":"The person charged must be told face recognition was used."},
{"key":"line.partial","where":"Case line: a rule with a catch ({limit})","max":240,"fills":["TheState","limit"],"usedOn":"New page","text":"Partly. {TheState} has this protection, with a catch: {limit}."},
{"key":"line.bypassed","where":"Case line: a law that misses this case ({reason})","max":240,"fills":["TheState","reason"],"usedOn":"New page","text":"{TheState} has a law here. It doesn’t reach this case: {reason}."},
{"key":"line.gap","where":"Case line: no law at this step","max":160,"fills":["state"],"usedOn":"New page","text":"No {state} law adds a protection at this step."},
{"key":"line.lineupNone","where":"Case line: no lineup rule","max":120,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has no special rule about lineups."},
{"key":"line.lineupLabel","where":"Case line name: lineups","max":30,"fills":[],"usedOn":"New page","text":"Lineups"},
{"key":"result.stop","where":"Case result stamp: stopped","max":40,"fills":["n"],"usedOn":"New page","text":"Search stopped at step {n}"},
{"key":"result.through","where":"Case result stamp: went through","max":40,"fills":[],"usedOn":"New page","text":"The search went through"},
{"key":"result.stopLine","where":"Case result: stopped","max":200,"fills":["TheState","n","step"],"usedOn":"New page","text":"{TheState} law stopped this search at step {n}: {step}."},
{"key":"result.stopLine.ban","where":"Case result: stopped by a ban or pause at a later step","max":200,"fills":["kind","theState","n","step"],"usedOn":"New page","text":"The {kind} in {theState} stopped this search at step {n}: {step}."},
{"key":"result.stopLine.banStart","where":"Case result: stopped by a ban or pause before it began","max":200,"fills":["kind","theState"],"usedOn":"New page","text":"The {kind} in {theState} stopped this search before it began."},
{"key":"result.throughLine","where":"Case result: went through","max":160,"fills":["theState"],"usedOn":"New page","text":"None of the 7 protections stopped this search in {theState}."},
{"key":"result.throughOther","where":"Case result: went through, and another state law is about this kind of search","max":160,"fills":["TheState"],"usedOn":"New page","text":"{TheState} has another law on this kind of search (see step 3). None of the 7 protections stopped it."},
{"key":"result.got.one","where":"Case result: some checks covered it (1 check applies)","max":160,"fills":["got","total"],"usedOn":"New page","text":"{got} of {total} check covered this case."},
{"key":"result.got.other","where":"Case result: some checks covered it (several checks apply)","max":160,"fills":["got","total"],"usedOn":"New page","text":"{got} of {total} checks covered this case."},
{"key":"result.soft.one","where":"Case result: only partly covered (1 check applies)","max":160,"fills":["soft","total"],"usedOn":"New page","text":"{soft} of {total} check covered it only partly, or might."},
{"key":"result.soft.other","where":"Case result: only partly covered (several checks apply)","max":160,"fills":["soft","total"],"usedOn":"New page","text":"{soft} of {total} checks covered it only partly, or might."},
{"key":"result.noneCovered.one","where":"Case result: none covered it (1 check applies)","max":160,"fills":["total"],"usedOn":"New page","text":"{total} check applies here. It did not cover this case."},
{"key":"result.noneCovered.other","where":"Case result: none covered it (several checks apply)","max":160,"fills":["total"],"usedOn":"New page","text":"{total} checks apply here. None covered this case."},
{"key":"result.noneApply","where":"Case result: none apply","max":160,"fills":[],"usedOn":"New page","text":"None of the 7 protections apply to this case."},
{"key":"tally.got","where":"Case tally: protected","max":20,"fills":[],"usedOn":"New page","text":"Protected"},
{"key":"tally.soft","where":"Case tally: partly","max":20,"fills":[],"usedOn":"New page","text":"Partly"},
{"key":"tally.no","where":"Case tally: not protected","max":20,"fills":[],"usedOn":"New page","text":"Not protected"},
{"key":"tally.of.one","where":"Case tally: total, 1 check","max":40,"fills":["total"],"usedOn":"New page","text":"of {total} check that applies"},
{"key":"tally.of.other","where":"Case tally: total, several checks","max":40,"fills":["total"],"usedOn":"New page","text":"of {total} checks that apply"},
{"key":"tally.aria.one","where":"Case tally, for screen readers, 1 check","max":120,"fills":["got","soft","no","total"],"usedOn":"New page","text":"Protected: {got}. Partly: {soft}. Not protected: {no}. Out of {total} check that applies."},
{"key":"tally.aria.other","where":"Case tally, for screen readers, several checks","max":120,"fills":["got","soft","no","total"],"usedOn":"New page","text":"Protected: {got}. Partly: {soft}. Not protected: {no}. Out of {total} checks that apply."},
{"key":"tally.ban","where":"Case tally when a ban or pause stopped the search","max":60,"fills":["kind"],"usedOn":"New page","text":"The {kind} covered this case."},
{"key":"ex.heading","where":"Examples: heading","max":40,"fills":[],"usedOn":"New page","text":"Try an example case"},
{"key":"ex.outcome.stop","where":"Example callout: where the search stopped","max":80,"fills":["n","step"],"usedOn":"New page","text":"The search stops at step {n}: {step}."},
{"key":"ex.outcome.through","where":"Example callout: the search went through","max":80,"fills":[],"usedOn":"New page","text":"The search goes through."},
{"key":"ex.outcome.ban","where":"Example callout: a ban or pause stopped the search","max":80,"fills":["kind"],"usedOn":"New page","text":"The {kind} stops the search before it starts."},
{"key":"ex.cardAria","where":"Example card, for screen readers","max":200,"fills":["title","lesson"],"usedOn":"New page","text":"Example: {title}. {lesson}"},
{"key":"foot.baseline","where":"Footer: what \"No\" means","max":240,"fills":[],"usedOn":"New page","text":"Everywhere, the Fourth Amendment still limits police searches and arrests. “No” here means state law adds nothing on top."},
{"key":"foot.source","where":"Footer: research source ({source})","max":240,"fills":["source"],"usedOn":"New page","text":"Source: {source}"},
{"key":"foot.updated","where":"Footer: last update ({date})","max":60,"fills":["date"],"usedOn":"New page","text":"Updated {date}"},
{"key":"foot.stale","where":"Footer: shown when the research is past its next update date","max":160,"fills":["date"],"usedOn":"New page","text":"This research may be out of date. It was due for an update on {date}."},
{"key":"foot.disclaimer","where":"Footer: disclaimer","max":60,"fills":[],"usedOn":"New page","text":"Prototype. Not legal advice."},
{"key":"foot.links","where":"Footer: where the law links go","max":80,"fills":[],"usedOn":"New page","text":"Each protection links to the official text."},
{"key":"foot.by","where":"Footer: credit","max":60,"fills":[],"usedOn":"New page","text":"Made by Michael Endrias."},
{"key":"foot.method","where":"Footer: link to sources and method","max":40,"fills":[],"usedOn":"New page","text":"Sources and method"},
{"key":"foot.methodUrl","where":"Footer: address of the sources and method link (https only)","max":200,"fills":[],"usedOn":"New page","text":"https://example.com/face-value-method"},
{"key":"foot.glossary","where":"Footer: glossary disclosure","max":40,"fills":[],"usedOn":"New page","text":"Words used here"},
{"key":"foot.live","where":"Footer: link to the current live site","max":30,"fills":[],"usedOn":"New page","text":"Live site"},
{"key":"date.months","where":"Dates: month names, separated by |","max":120,"fills":[],"usedOn":"New page","text":"Jan.|Feb.|March|April|May|June|July|Aug.|Sept.|Oct.|Nov.|Dec."},
{"key":"date.format","where":"Dates: order of month, day and year","max":30,"fills":["month","day","year"],"usedOn":"New page","text":"{month} {day}, {year}"},
{"key":"offline.heading","where":"Offline page: heading","max":60,"fills":[],"usedOn":"New page","text":"Face Value is offline"},
{"key":"offline.message","where":"Offline page: message","max":400,"fills":[],"usedOn":"New page","text":"This site is no longer updated, so it has been taken down. State laws on face recognition may have changed since the research was done."},
{"key":"offline.linkText","where":"Offline page: link text","max":60,"fills":[],"usedOn":"New page","text":"Read more"},
{"key":"offline.linkUrl","where":"Offline page: link address (https only)","max":200,"fills":[],"usedOn":"New page","text":"https://example.com/face-value-read-more"},
{"key":"load.message","where":"Load failure box: message","max":160,"fills":[],"usedOn":"New page","text":"The law data didn’t load. Check your connection and try again."},
{"key":"load.retry","where":"Load failure box: button","max":30,"fills":[],"usedOn":"New page","text":"Try again"},
{"key":"load.panel","where":"Panel placeholder while the data loads","max":40,"fills":[],"usedOn":"New page","text":"Loading…"},
{"key":"noscript.message","where":"Shown when JavaScript is off","max":160,"fills":[],"usedOn":"New page","text":"This page needs JavaScript for the map and scorecards."},
{"key":"noscript.link","where":"Shown when JavaScript is off: link","max":40,"fills":[],"usedOn":"New page","text":"Open the live site"},
{"key":"pv.bar","where":"Preview bar (only with ?preview)","max":160,"fills":["date"],"usedOn":"New page","text":"Preview of Sheet edits from {date}. Not live until someone presses Deploy."},
{"key":"pv.link","where":"Preview bar: link to the live data","max":40,"fills":[],"usedOn":"New page","text":"See the live version"},
{"key":"say.overview","where":"Announced when the overview shows","max":80,"fills":[],"usedOn":"New page","text":"Showing all 7 protections"},
{"key":"say.score","where":"Announced when a scorecard shows","max":120,"fills":["label"],"usedOn":"New page","text":"{label}"},
{"key":"say.case","where":"Announced when a case result shows","max":160,"fills":["theState","result"],"usedOn":"New page","text":"Case in {theState}. {result}."},
{"key":"say.loaded","where":"Announced when the data has loaded","max":60,"fills":[],"usedOn":"New page","text":"Map ready"},
{"key":"say.failed","where":"Announced when the data fails to load","max":120,"fills":[],"usedOn":"New page","text":"The law data didn’t load."},
{"key":"why.crime","where":"Case step 1: why this step matters","max":240,"fills":[],"usedOn":"Both","text":"Some states only allow face recognition for serious crimes. If the crime is not on the list, the search has to stop here."},
{"key":"why.approval","where":"Case step 2: why this step matters","max":240,"fills":[],"usedOn":"Both","text":"A judge reviewing the request first is the strongest check. Without one, police decide on their own whether to run the search."},
{"key":"why.search","where":"Case step 3: why this step matters","max":240,"fills":[],"usedOn":"Both","text":"These rules control how the search is run: no scanning crowds live, software tested for accuracy, and only trained staff at the controls."},
{"key":"why.arrest","where":"Case step 4: why this step matters","max":240,"fills":[],"usedOn":"Both","text":"Face recognition can point to the wrong person. Some states require other evidence before police can arrest someone or put them in a lineup."},
{"key":"why.disclose","where":"Case step 5: why this step matters","max":240,"fills":[],"usedOn":"Both","text":"If the person charged is never told face recognition was used, they cannot challenge a possible mistake in court."},
];
// </WORD_KEYS>

/* Start here text, Refresh checklist rows and Settings help lines. sheet/test/inline-texts.cjs rewrites this block
   from sheet/test/fixtures/texts.json. */
// <SHEET_TEXTS>
var SHEET_TEXTS = {
 "startHere": [
  [
   "Face Value: site control sheet",
   "This sheet holds every law, bill, quote and word on the Face Value site. The site reads what you publish from here."
  ],
  [
   "",
   ""
  ],
  [
   "Status right now",
   ""
  ],
  [
   "Site status",
   "=IFERROR(TO_TEXT(INDEX(Settings!B:B,MATCH(\"Site status\",Settings!A:A,0))),\"\")"
  ],
  [
   "Research current through",
   "=IFERROR(TO_TEXT(INDEX(Settings!B:B,MATCH(\"Research current through\",Settings!A:A,0))),\"\")"
  ],
  [
   "Last deploy",
   "=IFERROR(TO_TEXT(INDEX(Settings!B:B,MATCH(\"Last deploy (auto)\",Settings!A:A,0))),\"\")"
  ],
  [
   "Next update due",
   "=IFERROR(TO_TEXT(INDEX(Settings!B:B,MATCH(\"Next update due\",Settings!A:A,0))),\"\")"
  ],
  [
   "Sunset decision by",
   "=IFERROR(TO_TEXT(INDEX(Settings!B:B,MATCH(\"Sunset decision by\",Settings!A:A,0))),\"\")"
  ],
  [
   "GitHub key",
   "=IFERROR(TO_TEXT(INDEX(Settings!B:B,MATCH(\"GitHub key (auto)\",Settings!A:A,0))),\"\")"
  ],
  [
   "",
   ""
  ],
  [
   "What the colours mean",
   ""
  ],
  [
   "White cell",
   "Type here."
  ],
  [
   "Grey cell, header ends in (auto)",
   "The script fills this in. Anything you type here is ignored."
  ],
  [
   "Navy header row",
   "Column names. Hover a header to read its note. Please don't rename them."
  ],
  [
   "Red",
   "Must fix. Preview and Deploy stop until it is fixed."
  ],
  [
   "Amber",
   "Check this. For example, a law nobody has re-read in 6 months, or text that is too long."
  ],
  [
   "Lavender",
   "Unclear. The law has an open question about how to count it."
  ],
  [
   "Green Status",
   "Approved. This wording goes live at the next Deploy."
  ],
  [
   "Yellow Status",
   "Draft. Shows on the preview only."
  ],
  [
   "Orange Status",
   "Ready for review. Shows on the preview only, and waits for Jake."
  ],
  [
   "",
   ""
  ],
  [
   "How to make a change",
   ""
  ],
  [
   "1",
   "Edit the white cells. Use the dropdowns and checkboxes where there are any."
  ],
  [
   "2",
   "Face Value › Check for problems. Fix every error it lists. Read the heads-ups."
  ],
  [
   "3",
   "Face Value › Preview changes, then Face Value › Open preview. Look at your change on the preview page."
  ],
  [
   "4",
   "If you changed wording, set its Status to Ready for review. Jake marks it Approved."
  ],
  [
   "5",
   "Face Value › Deploy to live site…. Read the list of changes, then press Deploy now. The site updates in about a minute."
  ],
  [
   "",
   ""
  ],
  [
   "Wording and the Approved rule",
   ""
  ],
  [
   "Which tabs",
   "Words on the page, Protections, Stories and Glossary each have a Status column."
  ],
  [
   "Preview",
   "Preview shows every row, whatever its Status."
  ],
  [
   "Deploy",
   "Deploy publishes only Approved rows. Other rows keep the wording that is live today."
  ],
  [
   "Editing approved text",
   "If you edit text that is Approved, its Status goes back to Ready for review on its own."
  ],
  [
   "Who approves",
   "Jake Laperruque, or someone he names. Use Face Value › Wording to mark several rows at once."
  ],
  [
   "",
   ""
  ],
  [
   "Every 6 months → Refresh checklist",
   ""
  ],
  [
   "When",
   "Twice a year: in January, before state sessions start, and in early summer, before NCSL."
  ],
  [
   "How",
   "Open the Refresh checklist tab and work from the top. Tick each step and add the date."
  ],
  [
   "Start fresh",
   "Face Value › Every 6 months › Start a new refresh checklist saves the old ticks to the Change log and clears them."
  ],
  [
   "",
   ""
  ],
  [
   "Exit plan",
   ""
  ],
  [
   "The plan",
   "The site may come offline about a year after launch. CDT decides whether to extend it or take it down."
  ],
  [
   "Decide by",
   "Settings › Sunset decision by holds the date to decide. The sheet warns you 60 days before."
  ],
  [
   "Offline words",
   "The offline.heading, offline.message, offline.linkText and offline.linkUrl rows on Words on the page must be Approved first."
  ],
  [
   "Take it offline",
   "Set Settings › Site status to Offline, then Deploy. Or set Settings › Offline from to a date, and the page goes offline that day."
  ],
  [
   "What visitors see",
   "The page shows only the offline message and link. The full steps are in sheet/RUNBOOK.md in the GitHub folder."
  ],
  [
   "",
   ""
  ],
  [
   "If something goes wrong",
   ""
  ],
  [
   "The live site looks wrong",
   "Face Value › Undo last deploy…. This puts back the version from before the last Deploy. The sheet keeps your newer edits."
  ],
  [
   "A cell or tab got messed up",
   "File › Version history › See version history. Pick a time before the mistake and restore it."
  ],
  [
   "Something bigger broke",
   "Open the backup copy made at the last refresh and copy the good rows back."
  ],
  [
   "What happened when",
   "The Change log tab lists every Upgrade, Preview, Deploy and Undo, with a link to each change on GitHub."
  ],
  [
   "Hidden tabs",
   "Tabs named \"v1 backup:\" are a safety copy from the v2 upgrade. Leave them alone."
  ],
  [
   "",
   ""
  ],
  [
   "Marks in Quotes › Exact wording",
   ""
  ],
  [
   "**words**",
   "Bold. Use it for the key words."
  ],
  [
   "((words))",
   "Highlighted with an \"Also allowed\" label. Use it for an extra use the law permits."
  ],
  [
   "[[words]]",
   "Highlighted with an \"Exception\" label. Use it for a carve-out from the rule."
  ],
  [
   "Rule",
   "Every mark must be closed. Check for problems flags a mark that is left open."
  ],
  [
   "",
   ""
  ],
  [
   "Who to ask",
   ""
  ],
  [
   "Content and wording",
   "Jake Laperruque. He leads the project and approves all wording."
  ],
  [
   "Publishing or the GitHub key",
   "The GitHub key owner. Their GitHub name shows in Settings › GitHub key (auto)."
  ],
  [
   "Step-by-step guides",
   "sheet/README.md and sheet/RUNBOOK.md in the site's GitHub folder."
  ]
 ],
 "checklist": [
  {
   "step": "Make a backup copy",
   "how": "File › Make a copy. Name it \"Face Value sheet backup YYYY-MM\". Keep it private.",
   "who": "Whoever runs the refresh"
  },
  {
   "step": "Check the GitHub key",
   "how": "Face Value › Setup › Check GitHub key. If it expires within 60 days, make a new key and use Set GitHub key.",
   "who": "GitHub key owner"
  },
  {
   "step": "January only: set the bill session",
   "how": "Settings › Current bill session = the new year, for example 2027.",
   "who": "Whoever runs the refresh"
  },
  {
   "step": "Re-read every law",
   "how": "Compare each Laws row with the official text. Update the row, Status, Last checked and Checked by.",
   "who": "Researcher"
  },
  {
   "step": "Reset old New and Amended",
   "how": "Set last refresh's New or Amended laws back to Unchanged, unless they changed again.",
   "who": "Researcher"
  },
  {
   "step": "Update bills",
   "how": "Add new bills. On older bills, update Progress and Still alive.",
   "who": "Researcher"
  },
  {
   "step": "Add quotes",
   "how": "Add a Quotes row for every new protection. Laws › Quotes (auto) shows what is missing.",
   "who": "Researcher"
  },
  {
   "step": "Confirm each state",
   "how": "Read States › Scorecard (auto). If it is right, fill Last checked and Checked by.",
   "who": "Researcher"
  },
  {
   "step": "Set the research date",
   "how": "Settings › Research current through = the date the research is current to.",
   "who": "Researcher"
  },
  {
   "step": "Update dated words",
   "how": "Fix Words on the page rows that mention dates or years. Set them to Ready for review.",
   "who": "Whoever runs the refresh"
  },
  {
   "step": "Approve the wording",
   "how": "Read each Ready for review row. Mark it Approved, or add a Reviewer note.",
   "who": "Jake and comms"
  },
  {
   "step": "Re-run the stories",
   "how": "Open each story on the preview. Check its lesson still holds with the new data.",
   "who": "Researcher"
  },
  {
   "step": "Check for problems",
   "how": "Face Value › Check for problems. Fix every error. Read every heads-up.",
   "who": "Whoever runs the refresh"
  },
  {
   "step": "Preview on a phone",
   "how": "Preview changes, then Open preview. Check 5 states on a phone, including one with a new law.",
   "who": "Whoever runs the refresh"
  },
  {
   "step": "Sign-off",
   "how": "Jake reads the preview and signs off. Note who and when in Notes.",
   "who": "Jake"
  },
  {
   "step": "Deploy",
   "how": "Face Value › Deploy to live site…. Confirm the live site shows the new research date.",
   "who": "Whoever runs the refresh"
  },
  {
   "step": "Set the next update",
   "how": "Settings › Next update due = 6 months from now. Update the calendar reminder.",
   "who": "Whoever runs the refresh"
  },
  {
   "step": "Sunset check",
   "how": "If Settings › Sunset decision by is within 2 months, decide: extend the site or take it offline.",
   "who": "Jake and comms"
  },
  {
   "step": "Check links (every few refreshes)",
   "how": "Face Value › Every 6 months › Check links. It is slow. Fix any broken link.",
   "who": "Researcher"
  }
 ],
 "settingsHelp": {
  "GitHub owner": "The GitHub account or organization that owns the site's repository.",
  "GitHub repo": "The repository that holds the site.",
  "Branch": "The branch the site is published from.",
  "Folder": "The folder inside the repository that holds the site.",
  "Site address": "The public web address of the site. It must end with a slash.",
  "New page address": "Optional. The web address of the new page, used by Open preview.",
  "Research note": "The line shown on the site about how current the research is. {date} is filled in from the next row.",
  "Research current through": "The date the legal research is current to. Use the yyyy-mm-dd format.",
  "Current bill session": "The newest bill year, for example 2026. Change it each January.",
  "Site status": "Live or Offline. Offline makes the new page show only the offline message after the next Deploy.",
  "Offline from": "Optional date. From this day on, the new page shows the offline message on its own.",
  "Offline message (auto)": "A copy of Words on the page › offline.message. Edit the wording on that tab.",
  "Next update due": "When the next 6-month refresh is due. It turns amber 30 days before and red when past.",
  "Show out-of-date notice after": "Optional date. After it, the new page tells visitors the research may be out of date.",
  "Sunset decision by": "The date to decide whether to extend the site or take it offline. This stays in the sheet.",
  "Publishing sheet (auto)": "The ID of the one sheet allowed to Preview and Deploy. A copy can't publish until someone uses Setup › Publish from this sheet.",
  "Last preview (auto)": "When the last Preview ran, and who ran it.",
  "Last deploy (auto)": "When the last Deploy ran, and who ran it.",
  "GitHub key (auto)": "The result of the last key check: who owns the key and when it expires.",
  "Sheet version (auto)": "The sheet and script version, and the date of the upgrade."
 }
};
// </SHEET_TEXTS>

/* ======================= 2. FV: the pure core ======================= */

var FV = (function () {
  var PIDS = ['1', '2', '3', '4', '5', '6', '7'];
  var PORDER = ['3', '1', '6', '5', '7', '4', '2'];
  var STATE_NAMES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
    'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
    'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];
  var STATE_SET = {}; STATE_NAMES.forEach(function (n) { STATE_SET[n] = 1; });
  var PROT_DEFAULT = { '1': 'Judge must approve', '2': 'Person charged is told', '3': 'Serious crimes only', '4': "A match isn't enough",
    '5': 'Tested for accuracy', '6': 'No live crowd scanning', '7': 'Staff must be trained' };
  var PROT_WHY = { '1': 'Without a judge, police decide on their own whether to run the search.',
    '2': "If people are never told, they can't challenge a wrong match in court.",
    '3': 'It keeps face searches out of minor cases like shoplifting.',
    '4': 'Face recognition can point to the wrong person, so police need other evidence first.',
    '5': 'Testing shows how often the software gets a face wrong.',
    '6': 'Live scanning can track everyone in a crowd, including people suspected of nothing.',
    '7': 'Trained staff are less likely to treat a possible match as proof.' };
  /* The four teaching stories the new page starts with (Upgrade ticks them and adds a Draft lesson). */
  var EXAMPLE_SEEDS = [
    { id: 'montana-shoplifting', order: 1, state: 'Montana', who: 'local', src: 'cctv', db: 'mug', crime: 'minor', lesson: 'A serious-crimes rule keeps face searches out of small cases.' },
    { id: 'indiana-lineup', order: 2, state: 'Indiana', who: 'local', src: 'photo', db: 'dmv', crime: 'serious', lesson: 'A rule that only covers lineups leaves arrests open.' },
    { id: 'illinois-drone', order: 3, state: 'Illinois', who: 'local', src: 'drone', db: 'dmv', crime: 'serious', lesson: 'A rule for one kind of camera leaves the others open.' },
    { id: 'kentucky-no-limits', order: 4, state: 'Kentucky', who: 'local', src: 'photo', db: 'dmv', crime: 'minor', lesson: 'A law can name face recognition and still add no protections.' }
  ];
  var APPLIES = { 'Local police and state agencies': ['local', 'state'], 'Local police only': ['local'], 'State agencies only': ['state'], 'Anyone': ['any'] };
  var FOOTAGE = { 'Drones': 'drone', 'Body cameras': 'bodycam' };
  var LTYPE = { 'Narrow': 'narrow', 'Weaker': 'weak', 'Loosens': 'loose' };
  var WHO = { 'Local police': 'local', 'State police': 'state', 'Federal agent (old site only)': 'federal' };
  var WHO_ALIAS = { 'federal agent': 'federal' };
  var SRC = { 'Still photo': 'photo', 'Security camera': 'cctv', 'Drone': 'drone', 'Body camera': 'bodycam' };
  var DB = { "Driver's license photos": 'dmv', 'Mugshots': 'mug' };
  var CRIME = { 'Armed robbery': 'serious', 'Shoplifting': 'minor' };
  var BAN_ROLE = { 'Ban': 'Ban', 'Pause': 'Pause', 'Exception to a ban or pause': 'exception' };
  var UNCLEAR = ['No', 'Yes: the law as a whole', 'Yes: every protection it adds', 'Yes: only some protections'];
  var STATUS = ['Draft', 'Ready for review', 'Approved'];
  var SITE_STATUS = { 'Live': 'live', 'Offline': 'offline' };
  var GROUPS = { 'Bill progress': 'billSteps', 'Law status': 'lawStatus' };
  var STEPKEYS = ['crime', 'approval', 'search', 'arrest', 'disclose'];
  var RELATED = 'Related, not scored';
  var NEEDED_LIMITS = ['lineups only', 'drones only', 'body cameras only'];
  var OLD_GLOSS = ['face recognition', 'warrant', 'probable cause', 'lineup', 'live scanning', 'dmv', 'mugshots', 'federal agent', 'bill', 'unclear'];
  var LAW_KEYS = ['whoFor', 'source', 'db', 'state', 'name', 'status', 'year', 'does', 'who', 'rules', 'limits', 'review', 'cite', 'link',
    'reviewRules', 'reviewNote', 'note', 'ban', 'banException', 'bars'];
  var BILL_KEYS = ['state', 'name', 'pending', 'year', 'step', 'does', 'rules', 'limits', 'sponsor', 'link', 'note'];
  var QUOTE_KEYS = ['kind', 'state', 'item', 'rule', 'cite', 'text'];
  var V1_TABS = ['Start here', 'Laws', 'Bills', 'Quotes', 'States', 'Protections', 'Limits', 'Labels', 'Stories', 'Glossary', 'Step notes', 'Settings', 'Lists'];
  var DRAFT_NOTE = 'Default text from the new page; needs Jake/Drew review';
  var COLORS = { header: '#0C2340', headerText: '#FFFFFF', auto: '#EEF0F4', autoText: '#5A6275', red: '#F4C7C3', amber: '#FCE8B2',
    lavender: '#E8E0F7', green: '#D9EAD3', yellow: '#FFF2CC', orange: '#FCE5CD', grey: '#E6E8EC',
    data: '#1F5BB8', wording: '#38761D', reference: '#9AA3B5', admin: '#0C2340', backup: '#9AA3B5' };

  /* ---------- small helpers ---------- */
  var str = function (v) { return v === null || v === undefined ? '' : String(v).trim(); };
  var yes = function (v) { return v === true || /^(true|yes|x)$/i.test(str(v)); };
  var isObj = function (x) { return x !== null && typeof x === 'object' && !Array.isArray(x); };
  var norm = function (h) { return str(h).toLowerCase().replace(/\s+/g, ' ').replace(/ \(auto\)$/, '').trim(); };
  var copy = function (x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };
  var keyOf = function (map, v) { var ks = Object.keys(map); for (var i = 0; i < ks.length; i++) if (JSON.stringify(map[ks[i]]) === JSON.stringify(v)) return ks[i]; return ''; };
  function slug(t) { return str(t).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function letter(i0) { var s = '', n = i0 + 1; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function lookup(map, v) { var s = str(v); if (map.hasOwnProperty(s)) return map[s]; var n = norm(s), ks = Object.keys(map); for (var i = 0; i < ks.length; i++) if (norm(ks[i]) === n) return map[ks[i]]; return undefined; }
  function whoCode(v) { var w = lookup(WHO, v); return w || WHO_ALIAS[norm(v)]; }

  /* ---------- dates ---------- */
  var MONTHS_AP = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function isoDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(s)); if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? str(s) : '';
  }
  function addMonths(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); if (!m) return '';
    var y = +m[1], mo = +m[2] - 1 + n, d = +m[3]; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(); if (d > last) d = last;
    return y + '-' + ('0' + (mo + 1)).slice(-2) + '-' + ('0' + d).slice(-2);
  }
  function addDays(iso, n) { var t = Date.parse(iso + 'T00:00:00Z'); return new Date(t + n * 86400000).toISOString().slice(0, 10); }
  function todayOf(opts) { if (opts && opts.today) return opts.today; var d = opts && opts.now ? new Date(opts.now) : new Date(); return d.toISOString().slice(0, 10); }
  /** "2026-10-26" -> "Oct. 26, 2026" (AP style). */
  function apDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(iso)); return m ? MONTHS_AP[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : ''; }
  /** Finds the first AP-style (or full) date in a text -> {iso, match} or null. */
  function parseApDate(text) {
    var names = MONTHS_AP.concat(MONTHS_FULL, ['Sep.', 'Sept']).map(function (x) { return x.replace('.', '\\.'); }).join('|');
    var m = new RegExp('\\b(' + names + ')\\s+(\\d{1,2}),\\s+(\\d{4})').exec(str(text)); if (!m) return null;
    var mon = m[1].replace(/\.$/, '').slice(0, 3).toLowerCase(), i = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(mon);
    var iso = isoDate(m[3] + '-' + ('0' + (i + 1)).slice(-2) + '-' + ('0' + m[2]).slice(-2));
    return iso ? { iso: iso, match: m[0] } : null;
  }

  /* ---------- the single schema table ---------- */
  var TABS = [], TAB = {}, TAB_BY_NAME = {};
  function C(key, header, type, o) { o = o || {}; o.key = key; o.header = header; o.type = type; return o; }
  function addTab(t) { t.cols = t.cols || []; t.cols.forEach(function (c) { c.tab = t.key; if (c.type === 'auto') c.auto = true; }); TABS.push(t); TAB[t.key] = t; TAB_BY_NAME[t.name] = t; }
  var protCols = function () {
    return PIDS.map(function (k) {
      return C('p' + k, PROT_DEFAULT[k], 'dd:ProtValues', { prot: k, req: true, width: 150,
        note: 'Blank = not added; Full = added in full; a limit code = only a limited version (see Limits). The header follows Protections › Short name.' });
    });
  };
  var stdStatus = C('status', 'Status', 'dd:Status', { req: true, note: 'Draft and Ready for review show only on the preview; Approved goes live at the next Deploy.', width: 130, cf: ['status'] });
  var stdNotes = C('notes', 'Reviewer notes', 'text', { sheetOnly: true, wrap: true, width: 260, note: 'Comments for and from reviewers; not published.' });
  var lastChecked = function () { return C('lastChecked', 'Last checked', 'date', { sheetOnly: true, width: 110, note: 'When someone last re-read this row against the official text; turns amber after 6 months.', cf: ['stale'] }); };
  var checkedBy = C('checkedBy', 'Checked by', 'text', { sheetOnly: true, width: 90, note: 'Initials; not published.' });
  var research = C('research', 'Research notes', 'text', { sheetOnly: true, wrap: true, width: 260, note: 'Internal notes and doubts; never published.' });

  addTab({ key: 'start', name: 'Start here', kind: 'admin' });
  addTab({ key: 'words', name: 'Words on the page', kind: 'wording', frozenCols: 2, cols: [
    C('key', 'Key', 'text', { lock: true, req: true, width: 200, note: "Stable ID the page uses; don't change it." }),
    C('where', 'Where it appears', 'text', { lock: true, req: true, wrap: true, width: 220, note: 'Which part of which page shows this text.' }),
    C('text', 'Text', 'text', { req: true, wrap: true, width: 380, note: 'The wording; plain text only; use only the fill-ins listed.', cf: ['wordsEmpty', 'wordsLong'] }),
    stdStatus, stdNotes,
    C('len', 'Length (auto)', 'auto', { formulaHeader: true, width: 80, note: 'Characters in Text, updated as you type.' }),
    C('max', 'Max length', 'text', { lock: true, req: true, width: 80, note: 'Longest text that fits the phone layout.' }),
    C('fills', 'Fill-ins you can use', 'text', { lock: true, req: true, width: 160, note: 'The only {fill-ins} this text may use, e.g. {state} or {date}.' }),
    C('usedOn', 'Used on', 'text', { lock: true, req: true, width: 90, note: 'New page, Old site or Both.' }),
    C('live', 'Now on the live site (auto)', 'auto', { wrap: true, width: 300, note: 'The text visitors see today.' })
  ] });
  addTab({ key: 'laws', name: 'Laws', kind: 'data', frozenCols: 2, filter: true, cols: [
    C('state', 'State', 'dd:States', { req: true, width: 130, note: 'The state this law is in; pick from the list.' }),
    C('name', 'Name', 'text', { req: true, wrap: true, width: 240, note: 'Short name shown on the site with the bill number, e.g. "Lineup rule (SB 141)"; Quotes point to this name.', cf: ['unclearName'] }),
    C('year', 'Year', 'text', { req: true, width: 120, note: 'Year(s) as shown on the site, e.g. "2021; amended 2026"; must start with a 4-digit year.' }),
    C('status', 'Status', 'dd:LawStatus', { req: true, width: 110, note: 'What happened since the last research update; reset New/Amended at each 6-month refresh.' }),
    C('who', 'Who it covers (as written)', 'text', { req: true, wrap: true, width: 200, note: "Who the law says it covers, in its own words; shown on the law's details." }),
    C('applies', 'Applies to', 'dd:Applies', { req: true, width: 180, note: 'Which police the site treats this law as binding.' }),
    C('footage', 'Only covers footage from', 'dd:Footage', { req: true, width: 130, note: 'Leave blank unless the law only reaches one kind of footage.' }),
    C('dmv', 'Only covers license photos', 'checkbox', { req: true, width: 110, note: "Tick if the law only covers searches of driver's license photos." })
  ].concat(protCols(), [
    C('summary', 'Summary', 'text', { req: true, wrap: true, width: 360, aliases: ['What it does'], note: 'One or two plain sentences on what the law does; shown on the site.' }),
    C('cite', 'Citation', 'text', { req: true, wrap: true, width: 260, note: 'Official citation, e.g. "Ala. Code §§ 15-10-110 to -111".', cf: ['emptyRed'] }),
    C('link', 'Link', 'url', { req: true, width: 220, note: 'Link to the official text; must start with https://.', cf: ['httpsRed'] }),
    C('unclear', 'Unclear?', 'dd:Unclear', { req: true, width: 170, note: 'Is there an open question about how to count this law, and does it put a "?" on its protections?' }),
    C('unclearWhich', 'Which protections are unclear', 'text', { req: true, wrap: true, width: 200, note: 'Only for "only some protections": protection names separated by semicolons.' }),
    C('unclearNote', 'Unclear note', 'text', { req: true, wrap: true, width: 260, note: 'One sentence on what is unclear; shown next to the "?".' }),
    C('note', 'Note', 'text', { req: true, wrap: true, width: 220, note: "Optional public note shown on the law's details." }),
    C('banRole', 'Ban, pause or exception', 'dd:BanRole', { req: true, width: 150, aliases: ['Ban or pause'], note: "Ban or Pause stops every search by the police it covers; Exception marks a law that carves out of the state's ban." }),
    C('banCovers', 'Ban covers', 'dd:Applies', { req: true, width: 170, note: 'Which police the ban or pause covers; required for Ban or Pause.' }),
    C('banText', 'Ban text', 'text', { req: true, wrap: true, width: 260, note: 'One sentence describing the ban, shown on the site; required for Ban or Pause.', cf: ['banTextRed'] }),
    C('banExcept', 'Ban exceptions', 'text', { req: true, wrap: true, width: 260, note: "The ban's exceptions in one sentence (optional)." }),
    C('barsFrom', 'Bars footage from', 'dd:Footage', { req: true, width: 130, note: 'Set if this law stops any face search using this footage (e.g. Illinois drones).' }),
    C('barText', 'Bar text', 'text', { req: true, wrap: true, width: 260, note: 'One sentence shown when the bar stops a search; required if "Bars footage from" is set.' }),
    lastChecked(), checkedBy, research,
    C('quotesAuto', 'Quotes (auto)', 'auto', { wrap: true, width: 220, note: 'How many quotes this law has and which of its protections still need one.' })
  ]) });
  addTab({ key: 'bills', name: 'Bills', kind: 'data', frozenCols: 2, filter: true, cols: [
    C('state', 'State', 'dd:States', { req: true, width: 130, note: 'The state where the bill was introduced.' }),
    C('name', 'Name', 'text', { req: true, wrap: true, width: 200, note: 'Bill number and session as shown, e.g. "SB 1135 (2024)"; Quotes point to this name.' }),
    C('year', 'Year', 'year4', { req: true, width: 80, note: "Session year, exactly 4 digits; can't be later than Settings › Current bill session.", cf: ['billYear'] }),
    C('progress', 'Progress', 'dd:BillProgress', { req: true, width: 150, note: 'The furthest step the bill reached.' }),
    C('alive', 'Still alive', 'checkbox', { req: true, width: 90, note: 'Tick if the bill can still pass (two-year sessions carry bills over).', cf: ['aliveFailed'] })
  ].concat(protCols(), [
    C('summary', 'Summary', 'text', { req: true, wrap: true, width: 360, note: 'One or two plain sentences on what the bill would do.' }),
    C('sponsor', 'Sponsor', 'text', { req: true, wrap: true, width: 220, note: 'Lead sponsor(s) as shown on the site.' }),
    C('link', 'Link', 'url', { req: true, width: 220, note: 'Link to the bill text; must start with https://.', cf: ['httpsRed'] }),
    C('note', 'Note', 'text', { req: true, wrap: true, width: 220, note: "Optional public note (e.g. why it isn't scored)." }),
    lastChecked(), checkedBy, research,
    C('countsAs', 'Counts as (auto)', 'auto', { width: 150, note: '"2026 session", "Still alive (2025)" or "Earlier session", as the new page will treat it.' })
  ]) });
  addTab({ key: 'quotes', name: 'Quotes', kind: 'data', frozenCols: 1, filter: true, cols: [
    C('item', 'Law or bill', 'dd:LawsBills', { req: true, wrap: true, width: 280, note: 'Pick the law or bill this wording comes from; new Laws/Bills rows appear in the list right away.' }),
    C('prot', 'Protection', 'dd:QuoteProt', { req: true, width: 180, note: 'Which protection this wording supports; "Related, not scored" for context text.' }),
    C('cite', 'Citation', 'text', { req: true, wrap: true, width: 220, note: 'Pinpoint citation for this exact wording, e.g. "Ala. Code § 15-10-111(a)".', cf: ['emptyRed'] }),
    C('text', 'Exact wording', 'text', { req: true, wrap: true, width: 420, note: "The law's words copied exactly: **bold** key words, ((also allowed)), [[exception]].", cf: ['marksRed'] }),
    C('lead', 'Lead quote', 'checkbox', { req: true, width: 80, note: 'Tick the one quote the scorecard shows first for this law and protection; if none, the first row is used.' }),
    C('lastChecked', 'Last checked', 'date', { sheetOnly: true, width: 110, note: 'When this wording was last compared with the official text.' }),
    checkedBy,
    C('stateAuto', 'State (auto)', 'auto', { width: 130, note: 'Filled in from "Law or bill".' }),
    C('kindAuto', 'Kind (auto)', 'auto', { width: 80, note: 'Law or Bill from "Law or bill"; "?" means the name isn\'t on Laws or Bills.', cf: ['kindRed'] })
  ] });
  addTab({ key: 'states', name: 'States', kind: 'data', frozenCols: 1, cols: [
    C('state', 'State', 'text', { lock: true, req: true, width: 150, note: "One of the 51 places on the map; don't add, delete or rename rows." }),
    C('lawAuto', 'Law status (auto)', 'auto', { width: 200, aliases: ['Law status'], note: 'From Laws: newest change wins, plus "(none of the seven)" if no law adds a protection.' }),
    C('lawsAuto', 'Laws (auto)', 'auto', { width: 80, note: 'How many laws this state has on the Laws tab.' }),
    C('scoreAuto', 'Scorecard (auto)', 'auto', { width: 170, note: 'What the map shows: "4 of 7 (3 full)", "Pause", "Law, none of the 7", "No law".' }),
    C('billsAuto', 'Bills this session (auto)', 'auto', { width: 120, note: 'Bills from the current session year.' }),
    C('lastChecked', 'Last checked', 'date', { sheetOnly: true, width: 110, note: "When someone last confirmed this state's laws and bills are complete; amber after 6 months.", cf: ['staleState'] }),
    checkedBy, research
  ] });
  addTab({ key: 'prot', name: 'Protections', kind: 'wording', cols: [
    C('key', 'Key', 'text', { lock: true, req: true, width: 60, aliases: ['ID'], note: "The protection's number inside the site; don't change it." }),
    C('short', 'Short name', 'text', { req: true, width: 200, note: 'Name shown on the site; Laws/Bills column headers and the Quotes dropdown follow it.' }),
    C('long', 'What it means', 'text', { req: true, wrap: true, width: 360, aliases: ['Description'], note: 'One plain sentence describing the protection.' }),
    C('why', 'Why it matters', 'text', { req: true, wrap: true, width: 360, note: 'One plain sentence on why this protection matters, for the new page.' }),
    C('order', 'Order on page', 'number', { req: true, width: 80, note: "Position on the new page's scorecard (1 = top)." }),
    stdStatus, stdNotes,
    C('live', 'Now on the live site (auto)', 'auto', { wrap: true, width: 300, note: 'What the live site shows today (short name · why).' })
  ] });
  addTab({ key: 'stories', name: 'Stories', kind: 'wording', cols: [
    C('order', 'Order', 'number', { req: true, width: 60, note: 'Order on the new page (1 = first).' }),
    C('show', 'Show on new page', 'checkbox', { req: true, width: 90, note: 'Tick 3 or 4 stories for the new page; the old site shows every row.' }),
    C('t', 'Title', 'text', { req: true, wrap: true, width: 200, note: 'Short title (40 characters at most).' }),
    C('d', 'Description', 'text', { req: true, wrap: true, width: 320, note: 'One or two sentences setting up the case (160 characters at most).' }),
    C('lesson', 'What it shows', 'text', { req: true, wrap: true, width: 280, note: 'The one lesson this story teaches, in one sentence (140 characters at most).' }),
    C('state', 'State', 'dd:States', { req: true, width: 130, note: 'The state the story happens in.' }),
    C('who', 'Who searches', 'dd:WhoSearches', { req: true, width: 190, note: 'Who runs the search; the new page has no federal agent option.' }),
    C('src', 'Photo from', 'dd:PhotoFrom', { req: true, width: 130, note: 'Where the photo comes from.' }),
    C('db', 'Searched against', 'dd:SearchedAgainst', { req: true, width: 170, note: "Which photos it's compared with." }),
    C('crime', 'Crime', 'dd:Crime', { req: true, width: 120, note: 'The crime being investigated.' }),
    stdStatus, stdNotes,
    C('id', 'Story ID (auto)', 'auto', { read: true, width: 170, note: 'Made from the title the first time; links the row to its live version.' })
  ] });
  addTab({ key: 'glossary', name: 'Glossary', kind: 'wording', cols: [
    C('key', 'Key', 'text', { lock: true, req: true, width: 150, note: 'ID the site uses to find the term; keep existing keys as they are.' }),
    C('term', 'Term', 'text', { req: true, width: 200, note: 'The word as shown.' }),
    C('def', 'Definition', 'text', { req: true, wrap: true, width: 420, note: 'One plain sentence.' }),
    stdStatus, stdNotes
  ] });
  addTab({ key: 'limits', name: 'Limits', kind: 'reference', cols: [
    C('code', 'Code', 'text', { req: true, width: 260, note: 'ID used in Laws and Bills; some codes drive the site\'s logic ("lineups only", "drones only", "body cameras only"); add a new row for a new limit.' }),
    C('text', 'Plain words', 'text', { req: true, wrap: true, width: 380, note: 'How the site describes it, lower-case, e.g. "it only covers lineups".' }),
    C('type', 'Type', 'dd:LimitType', { req: true, width: 100, note: 'Narrow = covers fewer cases; Weaker = a lower bar; Loosens = widens police use.' }),
    C('usedBy', 'Used by (auto)', 'auto', { width: 100, note: 'How many laws and bills use it.' })
  ] });
  addTab({ key: 'labels', name: 'Labels', kind: 'reference', cols: [
    C('group', 'Group', 'dd:LabelGroup', { req: true, width: 140, note: 'Bill progress or Law status.' }),
    C('code', 'Code', 'text', { req: true, width: 180, note: 'The value used on Laws or Bills; keep existing codes as they are.' }),
    C('shown', 'Shown as', 'text', { req: true, width: 200, note: 'How the site shows this value.' })
  ] });
  addTab({ key: 'settings', name: 'Settings', kind: 'admin', cols: [
    C('setting', 'Setting', 'text', { lock: true, req: true, width: 230, note: "The setting's name; don't change it." }),
    C('value', 'Value', 'text', { req: true, width: 420, note: 'The value; grey rows are filled in by the script.' }),
    C('help', 'What it does', 'text', { lock: true, wrap: true, width: 460, note: 'What the setting does.' })
  ] });
  addTab({ key: 'checklist', name: 'Refresh checklist', kind: 'admin', cols: [
    C('done', 'Done', 'checkbox', { req: true, width: 60, note: 'Tick when the step is done.', cf: ['doneGrey'] }),
    C('step', 'Step', 'text', { req: true, wrap: true, width: 240, note: 'The step.' }),
    C('how', 'How', 'text', { req: true, wrap: true, width: 460, note: 'How to do it.' }),
    C('who', 'Who', 'text', { req: true, width: 180, note: 'Who usually does it.' }),
    C('date', 'Date done', 'date', { req: true, width: 110, note: 'The date it was done.' }),
    C('notes', 'Notes', 'text', { req: true, wrap: true, width: 260, note: 'Anything worth remembering.' })
  ] });
  addTab({ key: 'changelog', name: 'Change log', kind: 'admin', cols: [
    C('when', 'When', 'text', { req: true, width: 140, note: 'When it happened (sheet time zone).' }),
    C('action', 'Action', 'text', { req: true, width: 90, note: 'Upgrade, Repair, Preview, Deploy, Undo, Restore or Refresh.' }),
    C('by', 'By', 'text', { req: true, width: 100, note: 'Who ran it (the part of the email before @).' }),
    C('summary', 'Summary', 'text', { req: true, wrap: true, width: 320, note: 'What changed, in one line.' }),
    C('details', 'Details', 'text', { req: true, width: 320, note: 'The full list of changes.' }),
    C('commit', 'Commit', 'text', { req: true, width: 200, note: 'Link to the change on GitHub.' }),
    C('fileSha', 'File version', 'text', { req: true, width: 120, note: 'The file version (blob sha) this action wrote.' }),
    C('replacedSha', 'Replaced version', 'text', { req: true, width: 120, note: 'The file version it replaced; Undo puts this one back.' }),
    C('result', 'Result', 'text', { req: true, wrap: true, width: 220, note: 'OK, or what went wrong.' })
  ] });
  addTab({ key: 'lists', name: 'Lists', kind: 'admin', hidden: true });
  addTab({ key: 'selftest', name: 'Self-test', kind: 'admin', hidden: true, cols: [
    C('section', 'Section', 'text'), C('tab', 'Tab', 'text'), C('column', 'Column', 'text'), C('check', 'Check', 'text'),
    C('expected', 'Expected', 'text'), C('found', 'Found', 'text'), C('ok', 'OK', 'text')
  ] });
  var VISIBLE_ORDER = ['start', 'words', 'laws', 'bills', 'quotes', 'states', 'prot', 'stories', 'glossary', 'limits', 'labels', 'settings', 'checklist', 'changelog'];
  var READ_TABS = ['prot', 'words', 'laws', 'bills', 'quotes', 'states', 'stories', 'glossary', 'limits', 'labels', 'settings', 'checklist'];

  var SETTINGS_DEF = [
    { name: 'GitHub owner', req: 'S4' }, { name: 'GitHub repo', req: 'S4' }, { name: 'Branch', req: 'S4' }, { name: 'Folder', req: 'S4' },
    { name: 'Site address', req: 'S4' }, { name: 'New page address' },
    { name: 'Research note', req: 'SE1' }, { name: 'Research current through', type: 'date', req: 'SE1' },
    { name: 'Current bill session', req: 'SE1' }, { name: 'Site status', type: 'dd:SiteStatus', req: 'SE1' },
    { name: 'Offline from', type: 'date' }, { name: 'Offline message (auto)', auto: true },
    { name: 'Next update due', type: 'date' }, { name: 'Show out-of-date notice after', type: 'date' }, { name: 'Sunset decision by', type: 'date' },
    { name: 'Publishing sheet (auto)', auto: true }, { name: 'Last preview (auto)', auto: true }, { name: 'Last deploy (auto)', auto: true },
    { name: 'GitHub key (auto)', auto: true }, { name: 'Sheet version (auto)', auto: true }
  ];
  var SETTING_BY_NORM = {}; SETTINGS_DEF.forEach(function (s) { SETTING_BY_NORM[norm(s.name)] = s; });

  /** Static dropdown lists; tab-fed lists are formulas built from the current column letters. */
  function listsSpec(L) {
    var col = function (tab, key, dflt) { return (L && L[tab] && L[tab][key]) || dflt; };
    var lw = { s: col('laws', 'state', 'A'), n: col('laws', 'name', 'B') }, bl = { s: col('bills', 'state', 'A'), n: col('bills', 'name', 'B') };
    var st = col('states', 'state', 'A'), lc = col('limits', 'code', 'A'), ps = col('prot', 'short', 'B');
    var lg = col('labels', 'group', 'A'), lco = col('labels', 'code', 'B'), wk = col('words', 'key', 'A'), wt = col('words', 'text', 'C');
    var r = function (t, c) { return "'" + t + "'!" + c + '2:' + c; };
    return [
      { name: 'States', f: '=FILTER(' + r('States', st) + ',' + r('States', st) + '<>"")' },
      { name: 'LawsBills', f: '=SORT(FILTER({' + r('Laws', lw.s) + '&" · "&' + r('Laws', lw.n) + ';' + r('Bills', bl.s) + '&" · "&' + r('Bills', bl.n) + '},{' + r('Laws', lw.n) + ';' + r('Bills', bl.n) + '}<>""))' },
      { name: 'ProtValues', f: '={"Full";FILTER(' + r('Limits', lc) + ',' + r('Limits', lc) + '<>"")}' },
      { name: 'QuoteProt', f: '={FILTER(' + r('Protections', ps) + ',' + r('Protections', ps) + '<>"");"' + RELATED + '"}' },
      { name: 'LawStatus', f: '=FILTER(' + r('Labels', lco) + ',' + r('Labels', lg) + '="Law status")' },
      { name: 'BillProgress', f: '=FILTER(' + r('Labels', lco) + ',' + r('Labels', lg) + '="Bill progress")' },
      { name: 'Applies', values: Object.keys(APPLIES) }, { name: 'Footage', values: Object.keys(FOOTAGE) },
      { name: 'Unclear', values: UNCLEAR }, { name: 'BanRole', values: Object.keys(BAN_ROLE) }, { name: 'Status', values: STATUS },
      { name: 'WhoSearches', values: Object.keys(WHO) }, { name: 'PhotoFrom', values: Object.keys(SRC) },
      { name: 'SearchedAgainst', values: Object.keys(DB) }, { name: 'Crime', values: Object.keys(CRIME) },
      { name: 'LimitType', values: Object.keys(LTYPE) }, { name: 'LabelGroup', values: Object.keys(GROUPS) },
      { name: 'SiteStatus', values: Object.keys(SITE_STATUS) },
      { name: 'OfflineMessage', f: '=IFERROR(INDEX(' + r('Words on the page', wt) + ',MATCH("offline.message",' + r('Words on the page', wk) + ',0)),"")' }
    ];
  }

  /** Our conditional formats for a tab: [{formula, color, cols:[colKey], strike}]. Every formula carries N("fv") so Repair can find its own rules. */
  function cfSpec(tabKey, L) {
    var t = TAB[tabKey]; if (!t || !t.cols) return [];
    var c = function (k) { return (L && L[k]) || ''; }, out = [], fv = 'N("fv")=0';
    var row = function (k) { return '$' + c(k) + '2'; };
    t.cols.forEach(function (col) {
      (col.cf || []).forEach(function (kind) {
        var me = row(col.key), key = c('name') ? row('name') : c('key') ? row('key') : c('item') ? row('item') : c('state') ? row('state') : me;
        var f = null, color = COLORS.red, extra = {};
        if (!c(col.key)) return;
        if (kind === 'emptyRed') f = 'AND(' + fv + ',' + key + '<>"",LEN(' + me + ')=0)';
        else if (kind === 'httpsRed') f = 'AND(' + fv + ',' + key + '<>"",NOT(REGEXMATCH(TO_TEXT(' + me + '),"^https?://")))';
        else if (kind === 'stale') { f = 'AND(' + fv + ',' + key + '<>"",OR(' + me + '="",' + me + '<EDATE(TODAY(),-6)))'; color = COLORS.amber; }
        else if (kind === 'staleState') { if (!c('lawsAuto')) return; f = 'AND(' + fv + ',N(' + row('lawsAuto') + ')>0,OR(' + me + '="",' + me + '<EDATE(TODAY(),-6)))'; color = COLORS.amber; }
        else if (kind === 'unclearName') { if (!c('unclear')) return; f = 'AND(' + fv + ',LEFT(' + row('unclear') + ',3)="Yes")'; color = COLORS.lavender; }
        else if (kind === 'banTextRed') { if (!c('banRole')) return; f = 'AND(' + fv + ',OR(' + row('banRole') + '="Ban",' + row('banRole') + '="Pause"),LEN(' + me + ')=0)'; }
        else if (kind === 'billYear') f = 'AND(' + fv + ',' + key + '<>"",OR(NOT(REGEXMATCH(TO_TEXT(' + me + '),"^\\d{4}$")),VALUE(' + me + ')>VALUE(INDIRECT("FV_BillSession"))))';
        else if (kind === 'aliveFailed') { if (!c('progress')) return; f = 'AND(' + fv + ',' + me + '=TRUE,LEFT(' + row('progress') + ',6)="Failed")'; color = COLORS.amber; }
        else if (kind === 'marksRed') f = 'AND(' + fv + ',' + me + '<>"",OR(ISODD((LEN(' + me + ')-LEN(SUBSTITUTE(' + me + ',"**","")))/2),LEN(' + me + ')-LEN(SUBSTITUTE(' + me + ',"((",""))>LEN(' + me + ')-LEN(SUBSTITUTE(' + me + ',"))","")),LEN(' + me + ')-LEN(SUBSTITUTE(' + me + ',"[[",""))>LEN(' + me + ')-LEN(SUBSTITUTE(' + me + ',"]]",""))))';
        else if (kind === 'kindRed') f = 'AND(' + fv + ',' + me + '="?")';
        else if (kind === 'wordsEmpty') f = 'AND(' + fv + ',' + key + '<>"",LEN(' + me + ')=0)';
        else if (kind === 'wordsLong') { if (!c('max')) return; f = 'AND(' + fv + ',N(' + row('max') + ')>0,LEN(' + me + ')>N(' + row('max') + '))'; color = COLORS.amber; }
        else if (kind === 'doneGrey') { f = 'AND(' + fv + ',' + me + '=TRUE)'; color = COLORS.grey; extra.strike = true; extra.cols = t.cols.map(function (x) { return x.key; }); }
        else if (kind === 'status') {
          [['Approved', COLORS.green], ['Draft', COLORS.yellow], ['Ready for review', COLORS.orange]].forEach(function (p) {
            out.push({ formula: '=AND(' + fv + ',' + me + '="' + p[0] + '")', color: p[1], cols: [col.key] });
          });
          return;
        }
        if (f) out.push({ formula: '=' + f, color: color, cols: extra.cols || [col.key], strike: !!extra.strike });
      });
    });
    return out;
  }

  /* ---------- reading tabs by header name ---------- */
  function P(id, sev, tab, row, col, msg, fix) {
    var t = TAB[tab], c = null;
    if (t && col) (t.cols || []).forEach(function (x) { if (x.key === col) c = x.header; });
    return { id: id, sev: sev, tab: t ? t.name : (tab || ''), tabKey: tab || '', row: row || null, col: c || col || '', colKey: col || '', msg: msg, fix: fix || '' };
  }

  /** Header row -> {idx: {colKey: 0-based column}, problems}. metaByCol[i] lists the fv.col values on column i. */
  function mapHeaders(tabKey, headerRow, metaByCol, protNames) {
    var t = TAB[tabKey], idx = {}, problems = [], used = {}, heads = (headerRow || []).map(norm), seen = {};
    heads.forEach(function (h, i) {
      if (!h) return;
      if (seen.hasOwnProperty(h)) problems.push(P('S3', 'E', tabKey, 1, null, 'Two columns are both called "' + str(headerRow[i]) + '" (columns ' + letter(seen[h]) + ' and ' + letter(i) + ').', 'Rename or delete one of them.'));
      else seen[h] = i;
    });
    (t.cols || []).forEach(function (c) {
      var names = [c.header].concat(c.aliases || []).map(norm), hit = -1, i;
      if (c.prot && protNames && protNames[c.prot]) names.push(norm(protNames[c.prot]));
      for (i = 0; i < heads.length && hit < 0; i++) {
        if (used[i] || !heads[i]) continue;
        if (names.indexOf(heads[i]) >= 0 || (c.prot && new RegExp('\\(' + c.prot + '\\)$').test(heads[i]))) hit = i;
      }
      if (hit < 0 && metaByCol) {
        for (i = 0; i < metaByCol.length && hit < 0; i++) if (!used[i] && (metaByCol[i] || []).indexOf(tabKey + '.' + c.key) >= 0) hit = i;
        if (hit >= 0) problems.push(P('S2', 'W', tabKey, 1, c.key, 'The "' + c.header + '" column was renamed to "' + str(headerRow[hit]) + '". The data is still read.', 'Setup › Upgrade or repair restores the header.'));
      }
      if (hit < 0) {
        var sev = c.auto && !c.read ? 'I' : c.sheetOnly ? 'W' : 'E';
        problems.push(P('S2', sev, tabKey, 1, c.key, 'The "' + c.header + '" column is missing.', 'Setup › Upgrade or repair puts it back, or restore the column from Version history.'));
        return;
      }
      used[hit] = 1; idx[c.key] = hit;
    });
    heads.forEach(function (h, i) { if (h && !used[i]) problems.push(P('S6', 'I', tabKey, 1, str(headerRow[i]), 'Column "' + str(headerRow[i]) + '" is not one the script knows. It is kept and not published.', '')); });
    return { idx: idx, problems: problems };
  }

  /** Values (+ display values) -> row objects with _row (sheet row number). Blank rows are skipped. */
  function readRows(tabKey, values, display, idx) {
    var t = TAB[tabKey], rows = [];
    for (var r = 1; r < (values || []).length; r++) {
      var o = { _row: r + 1 }, any = false, vr = values[r] || [], dr = (display && display[r]) || [];
      (t.cols || []).forEach(function (c) {
        var i = idx[c.key], v, d, out;
        if (i === undefined) { o[c.key] = c.type === 'checkbox' ? false : ''; return; }
        v = vr[i]; d = dr[i];
        if (c.type === 'checkbox') out = yes(v);
        else if (c.type === 'date') { var ds = str(d); out = isoDate(ds) ? ds : (v instanceof Date ? ds : str(v)); }
        else out = (v instanceof Date) ? str(d) : str(v);
        o[c.key] = out;
        if ((!c.auto || c.read) && (out === true || (out !== false && out !== ''))) any = true;
      });
      if (any) rows.push(o);
    }
    return rows;
  }

  /** {tabKey: {values, display, metaByCol}} -> model. Missing tabs give S1. */
  function readModel(sheets, opts) {
    opts = opts || {};
    var model = { tabs: {}, problems: [], settings: {}, settingsRow: {}, settingsOrder: [], protNames: {} };
    READ_TABS.forEach(function (key) {
      var s = sheets[key];
      if (!s || !s.values || !s.values.length) {
        model.problems.push(P('S1', key === 'checklist' ? 'W' : 'E', key, null, null, 'The "' + TAB[key].name + '" tab is missing.', 'Setup › Upgrade or repair adds it back; restore its rows from Version history.'));
        model.tabs[key] = { rows: [], idx: {}, missing: true }; return;
      }
      var m = mapHeaders(key, s.values[0], s.metaByCol, model.protNames);
      var rows = readRows(key, s.values, s.display || s.values, m.idx);
      model.tabs[key] = { rows: rows, idx: m.idx, header: s.values[0].map(str) };
      model.problems = model.problems.concat(m.problems);
      if (key === 'prot') rows.forEach(function (r) { if (PIDS.indexOf(r.key) >= 0 && r.short && !model.protNames[r.key]) model.protNames[r.key] = r.short; });
    });
    model.tabs.settings.rows.forEach(function (r) {
      var def = SETTING_BY_NORM[norm(r.setting)], name = def ? def.name : r.setting;
      if (!name || model.settings.hasOwnProperty(name)) return;
      var v = r.value;
      if (def && def.type === 'date') { var raw = sheets.settings && sheets.settings.display ? str((sheets.settings.display[r._row - 1] || [])[model.tabs.settings.idx.value]) : v; v = isoDate(raw) ? raw : v; }
      if (name === 'Site address' && v && !/\/$/.test(v)) v += '/';
      model.settings[name] = v; model.settingsRow[name] = r._row; model.settingsOrder.push(name);
    });
    return model;
  }

  /** Planned grids ({tabName: {values, formulas}}) -> the sheets map readModel expects. */
  function sheetsFromGrids(grids) {
    var out = {};
    Object.keys(grids).forEach(function (name) {
      var t = TAB_BY_NAME[name]; if (!t) return;
      var g = grids[name];
      out[t.key] = { values: g.values, display: g.values.map(function (r) { return r.map(function (v) { return typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : str(v); }); }), metaByCol: null };
    });
    return out;
  }

  /* ---------- building the JSON ---------- */
  function parseItem(s) { var m = /^(.+?)\s+·\s+(.+)$/.exec(str(s)); return m ? { state: m[1].trim(), name: m[2].trim() } : { state: '', name: str(s) }; }
  function protKeyOf(v, protNames) {
    var s = str(v); if (!s) return undefined;
    if (norm(s) === norm(RELATED)) return null;
    var m = /^([1-7])(\s*·.*)?$/.exec(s); if (m) return m[1];
    for (var i = 0; i < PIDS.length; i++) { var k = PIDS[i]; if ((protNames[k] && norm(protNames[k]) === norm(s)) || norm(PROT_DEFAULT[k]) === norm(s)) return k; }
    return undefined;
  }
  function readProtCells(r, x) {
    x.rules = []; x.limits = {};
    PIDS.forEach(function (k) {
      var v = str(r['p' + k]); if (!v) return;
      x.rules.push(k);
      if (v.toLowerCase() !== 'full') x.limits[k] = v.toLowerCase();
    });
  }
  function unclearKind(v) { var s = norm(v); return /^yes/.test(s) ? (/every/.test(s) ? 'every' : /only some/.test(s) ? 'some' : 'whole') : 'no'; }
  function whichKeys(text, protNames) {
    var out = [], bad = [];
    str(text).split(/;/).map(str).filter(Boolean).forEach(function (n) { var k = protKeyOf(n, protNames); if (k) { if (out.indexOf(k) < 0) out.push(k); } else bad.push(n); });
    return { keys: out, bad: bad };
  }

  /** The state's legacy "law" string, computed from Laws. */
  function lawStatusOf(state, laws) {
    var L = (laws || []).filter(function (l) { return l.state === state; });
    if (!L.length) return 'No law';
    var s = L.some(function (l) { return l.status === 'New'; }) ? 'New' : L.some(function (l) { return l.status === 'Amended'; }) ? 'Amended' : 'Unchanged';
    if (!L.some(function (l) { return (l.rules || []).length; })) s += ' (none of the seven)';
    return s;
  }

  function rowsOf(model, key) { return (model.tabs[key] && model.tabs[key].rows) || []; }

  /** model -> site JSON v2. opts: {mode:'preview'|'live', live: current live.json (for gating), now}. */
  function build(model, opts) {
    opts = opts || {};
    var mode = opts.mode === 'live' ? 'live' : 'preview', live = opts.live || null, LC = (live && isObj(live.config)) ? live.config : {};
    var gate = function (r) { return mode === 'preview' || r.status === 'Approved'; };
    var S = model.settings || {}, protNames = model.protNames || {};

    var prot = {};
    rowsOf(model, 'prot').forEach(function (r) {
      var k = r.key; if (PIDS.indexOf(k) < 0 || prot[k]) return;
      var src = gate(r) ? r : (LC.prot && LC.prot[k]) ? { short: LC.prot[k].short, long: LC.prot[k].long, why: LC.prot[k].why } : null;
      if (!src) return;
      var o = { short: str(src.short), long: str(src.long) };
      if (str(src.why)) o.why = str(src.why);
      var ord = parseInt(r.order, 10); if (ord >= 1 && ord <= 7 && String(ord) === str(r.order)) o.order = ord;
      prot[k] = o;
    });

    var limits = {};
    rowsOf(model, 'limits').forEach(function (r) { var k = r.code.toLowerCase(); if (!k || limits[k]) return; limits[k] = { text: r.text, type: lookup(LTYPE, r.type) || 'narrow' }; });
    var labels = { billSteps: {}, lawStatus: {} };
    rowsOf(model, 'labels').forEach(function (r) { var g = lookup(GROUPS, r.group); if (g && r.code && !labels[g].hasOwnProperty(r.code)) labels[g][r.code] = r.shown; });

    // Stories: legacy config.stories (every row) and config.examples (rows ticked "Show on new page").
    var stories = [], examples = [], liveStories = Array.isArray(LC.stories) ? LC.stories : [], liveEx = Array.isArray(LC.examples) ? LC.examples : [], claimed = {};
    var storyOf = function (x) { return { t: str(x.t), d: str(x.d), state: str(x.state), who: x.who, src: x.src, db: x.db, crime: x.crime }; };
    var exOf = function (x, id, order) { return { id: id, t: str(x.t), d: str(x.d), lesson: str(x.lesson), state: str(x.state), who: x.who, src: x.src, db: x.db, crime: x.crime, order: order }; };
    rowsOf(model, 'stories').forEach(function (r, i) {
      var id = r.id || slug(r.t), codes = { t: r.t, d: r.d, lesson: r.lesson, state: r.state, who: whoCode(r.who), src: lookup(SRC, r.src), db: lookup(DB, r.db), crime: lookup(CRIME, r.crime) };
      var ord = parseInt(r.order, 10); ord = isFinite(ord) ? ord : null;
      if (gate(r)) {
        stories.push(storyOf(codes));
        if (r.show && codes.who && codes.who !== 'federal') examples.push(exOf(codes, id, ord));
        return;
      }
      var lex = liveEx.filter(function (e) { return e && e.id === id; })[0], j = -1, tries = [
        function (s) { return lex && s.t === lex.t; }, function (s) { return slug(s.t) === id; }, function (s) { return s.t === r.t; }
      ];
      for (var a = 0; a < tries.length && j < 0; a++) for (var b = 0; b < liveStories.length && j < 0; b++) if (!claimed[b] && liveStories[b] && tries[a](liveStories[b])) j = b;
      if (j < 0 && liveStories[i] && !claimed[i] && liveStories[i].state === r.state) j = i;
      if (j >= 0) { claimed[j] = 1; stories.push(storyOf(liveStories[j])); }
      if (lex) examples.push(exOf(lex, id, ord !== null ? ord : lex.order));
    });
    examples.sort(function (a, b) { return (a.order === null ? 99 : a.order) - (b.order === null ? 99 : b.order); });
    examples.forEach(function (e, i) { if (e.order === null) e.order = i + 1; });

    var glossary = {};
    rowsOf(model, 'glossary').forEach(function (r) {
      var k = r.key; if (!k || glossary.hasOwnProperty(k)) return;
      if (gate(r)) glossary[k] = { term: r.term, def: r.def };
      else if (LC.glossary && isObj(LC.glossary[k])) glossary[k] = { term: str(LC.glossary[k].term), def: str(LC.glossary[k].def) };
    });

    var whyRaw = {}, words = {};
    rowsOf(model, 'words').forEach(function (r) {
      var k = r.key; if (!k) return;
      var m = /^why\.(\w+)$/.exec(k);
      if (m) {
        if (STEPKEYS.indexOf(m[1]) < 0 || whyRaw.hasOwnProperty(m[1])) return;
        var t = gate(r) ? r.text : (LC.why && LC.why[m[1]]); whyRaw[m[1]] = str(t); return;
      }
      if (words.hasOwnProperty(k)) return;
      var t2 = gate(r) ? r.text : (LC.words && LC.words[k]); if (str(t2)) words[k] = str(t2);
    });
    var why = {}; STEPKEYS.forEach(function (k) { if (whyRaw[k]) why[k] = whyRaw[k]; });

    var through = isoDate(S['Research current through']) || '', tpl = str(S['Research note']);
    var source = tpl.indexOf('{date}') >= 0 ? tpl.split('{date}').join(apDate(through) || through) : tpl;
    var site = { status: lookup(SITE_STATUS, S['Site status']) || 'live', currentThrough: through, billYear: str(S['Current bill session']) };
    [['Next update due', 'nextUpdate'], ['Show out-of-date notice after', 'staleAfter'], ['Offline from', 'offlineFrom']].forEach(function (p) { if (isoDate(S[p[0]])) site[p[1]] = S[p[0]]; });

    var laws = rowsOf(model, 'laws').map(function (r) {
      var l = { whoFor: (lookup(APPLIES, r.applies) || ['local', 'state']).slice(), source: lookup(FOOTAGE, r.footage) || null, db: r.dmv ? 'dmv' : null,
        state: r.state, name: r.name, status: r.status, year: r.year, does: r.summary, who: r.who };
      readProtCells(r, l);
      var uk = unclearKind(r.unclear);
      l.review = uk !== 'no'; l.cite = r.cite; l.link = r.link;
      if (l.review) {
        l.reviewRules = uk === 'every' ? l.rules.slice() : uk === 'some' ? whichKeys(r.unclearWhich, protNames).keys : [];
        if (r.unclearNote) l.reviewNote = r.unclearNote;
      }
      if (r.note) l.note = r.note;
      var role = lookup(BAN_ROLE, r.banRole);
      if (role === 'Ban' || role === 'Pause') l.ban = { who: (lookup(APPLIES, r.banCovers) || []).slice(), kind: role, text: r.banText, except: r.banExcept };
      if (role === 'exception') l.banException = true;
      if (r.barsFrom) l.bars = { src: lookup(FOOTAGE, r.barsFrom) || null, text: r.barText };
      return l;
    });
    var bills = rowsOf(model, 'bills').map(function (r) {
      var b = { state: r.state, name: r.name, pending: !!r.alive, year: r.year, step: r.progress, does: r.summary };
      readProtCells(r, b);
      b.sponsor = r.sponsor; b.link = r.link;
      if (r.note) b.note = r.note;
      return b;
    });
    var lawSet = {}, billSet = {};
    laws.forEach(function (l) { lawSet[l.state + '|' + l.name] = 1; }); bills.forEach(function (b) { billSet[b.state + '|' + b.name] = 1; });
    var leadQuotes = {};
    var quotes = rowsOf(model, 'quotes').map(function (r, i) {
      var it = parseItem(r.item), k = it.state + '|' + it.name, rule = protKeyOf(r.prot, protNames);
      var q = { kind: lawSet[k] ? 'Law' : billSet[k] ? 'Bill' : '?', state: it.state, item: it.name, rule: rule === undefined ? null : rule, cite: r.cite, text: r.text };
      if (r.lead && q.rule && !leadQuotes.hasOwnProperty(k + '|' + q.rule)) leadQuotes[k + '|' + q.rule] = i;
      return q;
    });
    var states = rowsOf(model, 'states').map(function (r) { return { name: r.state, law: lawStatusOf(r.state, laws) }; });

    return {
      source: source, updated: (opts.now ? new Date(opts.now) : new Date()).toISOString(),
      config: { prot: prot, limits: limits, billSteps: labels.billSteps, lawStatus: labels.lawStatus, stories: stories, glossary: glossary, why: why,
        words: words, site: site, leadQuotes: leadQuotes, examples: examples },
      states: states, laws: laws, bills: bills, quotes: quotes,
      schema: SCHEMA_VERSION, generator: 'Face Value sheet ' + FV_VERSION
    };
  }

  /* ---------- scores (port of app.js:122-146), for the States "Scorecard (auto)" column and map diffs ---------- */
  function stateLevels(d) {
    var laws = (d && d.laws) || [], out = {};
    var broad = function (x) { return !x.whoFor || x.whoFor.indexOf('any') >= 0 || (x.whoFor.indexOf('local') >= 0 && x.whoFor.indexOf('state') >= 0); };
    ((d && d.states) || []).forEach(function (s) {
      var name = s.name, law = s.law || 'No law', ban = laws.filter(function (l) { return l.state === name && l.ban; })[0];
      var group = law === 'No law' ? 'none' : ban ? 'ban' : /none of the seven/i.test(law) ? 'zero' : 'rules';
      var count = 0, full = 0, prot = {};
      PORDER.forEach(function (rule) {
        var L = laws.filter(function (l) { return l.state === name && (l.rules || []).indexOf(rule) >= 0; });
        var f = L.filter(function (l) { return !(l.limits || {})[rule] && !l.source && !l.db && broad(l); });
        prot[rule] = f.length ? 'yes' : L.length ? 'part' : 'no';
        if (L.length) count++; if (f.length) full++;
      });
      var level = group === 'none' ? 'l0' : group === 'zero' ? 'lz' : group === 'ban' ? 'lb' : count >= 5 ? 'l4' : count >= 3 ? 'l3' : count === 2 ? 'l2' : 'l1';
      var label = group === 'none' ? 'No law' : group === 'zero' ? 'Law, none of the 7' : group === 'ban' ? str(ban.ban.kind) || 'Ban' : count + ' of 7 (' + full + ' full)';
      out[name] = { group: group, count: count, full: full, level: level, prot: prot, label: label };
    });
    return out;
  }

  /* ---------- the old app's contract ---------- */
  function oldAppContract(d) {
    var out = [], bad = function (m) { out.push(P('X2', 'E', 'output', null, null, 'The old site would break: ' + m, 'Fix the row it names, then check again.')); };
    if (!isObj(d)) { bad('the data is empty'); return out; }
    if (typeof d.source !== 'string') bad('the research note is missing');
    if (typeof d.updated !== 'string') bad('the update time is missing');
    var C = d.config;
    if (!isObj(C)) { bad('config is missing'); return out; }
    PIDS.forEach(function (k) {
      var p = C.prot && C.prot[k];
      if (!isObj(p) || typeof p.short !== 'string' || !p.short || typeof p.long !== 'string') bad('protection ' + k + ' needs a short name and a meaning');
      else if (p.hasOwnProperty('step')) bad('protection ' + k + ' has a "step" field');
    });
    if (!isObj(C.limits)) bad('limits are missing');
    else Object.keys(C.limits).forEach(function (k) { var x = C.limits[k]; if (!isObj(x) || typeof x.text !== 'string' || ['narrow', 'weak', 'loose'].indexOf(x.type) < 0) bad('limit "' + k + '" needs plain words and a type'); });
    ['billSteps', 'lawStatus'].forEach(function (g) { if (!isObj(C[g]) || Object.keys(C[g]).some(function (k) { return typeof C[g][k] !== 'string'; })) bad(g + ' must be a list of labels'); });
    var names = {}; (Array.isArray(d.states) ? d.states : []).forEach(function (s) { if (s && s.name) names[s.name] = 1; });
    if (!Array.isArray(C.stories)) bad('stories are missing');
    else C.stories.forEach(function (s, i) {
      if (!isObj(s) || typeof s.t !== 'string' || typeof s.d !== 'string') { bad('story ' + (i + 1) + ' needs a title and description'); return; }
      if (!names[s.state]) bad('story "' + s.t + '" has an unknown state');
      if (['local', 'state', 'federal'].indexOf(s.who) < 0 || ['photo', 'cctv', 'drone', 'bodycam'].indexOf(s.src) < 0 || ['dmv', 'mug'].indexOf(s.db) < 0 || ['serious', 'minor'].indexOf(s.crime) < 0) bad('story "' + s.t + '" has a bad dropdown value');
    });
    if (!isObj(C.glossary) || Object.keys(C.glossary).some(function (k) { var g = C.glossary[k]; return !isObj(g) || typeof g.term !== 'string' || typeof g.def !== 'string'; })) bad('the glossary needs a term and definition on every row');
    if (!isObj(C.why) || Object.keys(C.why).some(function (k) { return STEPKEYS.indexOf(k) < 0 || typeof C.why[k] !== 'string'; })) bad('step notes may only be ' + STEPKEYS.join(', '));
    if (!Array.isArray(d.states)) bad('states are missing');
    else {
      var seenS = {};
      d.states.forEach(function (s) {
        if (!isObj(s) || !STATE_SET[s.name]) bad('"' + (s && s.name) + '" is not one of the 51 map places');
        else if (seenS[s.name]) bad(s.name + ' is listed twice'); else seenS[s.name] = 1;
        if (isObj(s) && typeof s.law !== 'string') bad(s.name + ' has no law status');
        if (isObj(s) && Object.keys(s).some(function (k) { return ['name', 'law'].indexOf(k) < 0; })) bad(s.name + ' has extra fields');
      });
    }
    var items = {}, arr = function (x) { return Array.isArray(x) ? x : []; };
    if (!Array.isArray(d.laws)) bad('laws are missing');
    arr(d.laws).forEach(function (l) {
      var id = isObj(l) ? l.state + ' · ' + l.name : '?';
      if (!isObj(l)) return bad('a law row is empty');
      items['Law|' + l.state + '|' + l.name] = 1;
      Object.keys(l).forEach(function (k) { if (LAW_KEYS.indexOf(k) < 0) bad(id + ' has an extra field "' + k + '"'); });
      if (!STATE_SET[l.state]) bad(id + ': unknown state');
      ['state', 'name', 'status', 'year', 'who', 'does', 'cite', 'link'].forEach(function (k) { if (typeof l[k] !== 'string') bad(id + ': ' + k + ' must be text'); });
      if (!Array.isArray(l.whoFor) || !l.whoFor.length || l.whoFor.some(function (w) { return ['local', 'state', 'any'].indexOf(w) < 0; })) bad(id + ': bad "Applies to"');
      if ([null, 'drone', 'bodycam'].indexOf(l.source) < 0) bad(id + ': bad footage value');
      if ([null, 'dmv'].indexOf(l.db) < 0) bad(id + ': bad license-photo value');
      if (!Array.isArray(l.rules) || l.rules.some(function (k) { return PIDS.indexOf(k) < 0; })) bad(id + ': bad protections');
      if (!isObj(l.limits) || Object.keys(l.limits).some(function (k) { return typeof l.limits[k] !== 'string'; })) bad(id + ': bad limits');
      if (typeof l.review !== 'boolean') bad(id + ': review must be true or false');
      if (l.hasOwnProperty('reviewRules') && !Array.isArray(l.reviewRules)) bad(id + ': bad unclear protections');
      if (l.ban && (!Array.isArray(l.ban.who) || !l.ban.who.length || typeof l.ban.text !== 'string' || typeof l.ban.kind !== 'string')) bad(id + ': the ban needs who it covers and its text');
      if (l.hasOwnProperty('banException') && l.banException !== true) bad(id + ': bad exception flag');
      if (l.bars && (['drone', 'bodycam'].indexOf(l.bars.src) < 0 || typeof l.bars.text !== 'string')) bad(id + ': the bar needs its footage and text');
    });
    if (!Array.isArray(d.bills)) bad('bills are missing');
    arr(d.bills).forEach(function (b) {
      if (!isObj(b)) return bad('a bill row is empty');
      var id = b.state + ' · ' + b.name; items['Bill|' + b.state + '|' + b.name] = 1;
      Object.keys(b).forEach(function (k) { if (BILL_KEYS.indexOf(k) < 0) bad(id + ' has an extra field "' + k + '"'); });
      if (!/^\d{4}$/.test(b.year)) bad(id + ': the year must be 4 digits');
      if (typeof b.pending !== 'boolean') bad(id + ': bad "Still alive"');
      if (!Array.isArray(b.rules) || !isObj(b.limits)) bad(id + ': bad protections');
      ['state', 'name', 'step', 'does', 'sponsor', 'link'].forEach(function (k) { if (typeof b[k] !== 'string') bad(id + ': ' + k + ' must be text'); });
    });
    if (!Array.isArray(d.quotes)) bad('quotes are missing');
    arr(d.quotes).forEach(function (q, i) {
      if (!isObj(q)) return bad('quote ' + (i + 1) + ' is empty');
      Object.keys(q).forEach(function (k) { if (QUOTE_KEYS.indexOf(k) < 0) bad('quote ' + (i + 1) + ' has an extra field "' + k + '"'); });
      if (!items[(q.kind === 'Law' ? 'Law' : 'Bill') + '|' + q.state + '|' + q.item]) bad('quote ' + (i + 1) + ' points at a missing law or bill: ' + q.state + ' · ' + q.item);
      if (q.rule !== null && PIDS.indexOf(q.rule) < 0) bad('quote ' + (i + 1) + ' has a bad protection');
      if (typeof q.text !== 'string' || typeof q.cite !== 'string') bad('quote ' + (i + 1) + ' needs wording and a citation');
    });
    return out;
  }

  /* ---------- check for problems ---------- */
  function marksProblem(t) {
    var rest = str(t).replace(/\*\*[\s\S]+?\*\*|\(\([\s\S]+?\)\)|\[\[[\s\S]+?\]\]/g, '');
    if (/\*\*/.test(rest)) return 'A ** mark is not closed.';
    if (/\(\(/.test(rest)) return 'A (( mark is not closed with )).';
    if (/\[\[/.test(rest)) return 'A [[ mark is not closed with ]].';
    return '';
  }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j; for (i = 0; i <= m; i++) d[i] = [i]; for (j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function fillsOf(text) { var out = [], re = /\{([^{}]*)\}/g, m; while ((m = re.exec(str(text)))) out.push(m[1]); return out; }
  function parseFills(cell) { return fillsOf(cell).map(str).filter(Boolean); }
  function isUrlKey(k) { var last = str(k).split('.').pop(); return /(url|Url)$/.test(last); }

  /** model + built preview JSON -> [{id, sev, tab, row, col, msg, fix}]. opts: {today, live, lv, wordKeys, schema, sheetId, forPublish, branchVersion}. */
  function check(model, built, opts) {
    opts = opts || {};
    var out = (model.problems || []).slice(), add = function (id, sev, tab, row, col, msg, fix) { out.push(P(id, sev, tab, row, col, msg, fix)); };
    var today = todayOf(opts), sixAgo = addMonths(today, -6), S = model.settings || {}, protNames = model.protNames || {};
    var wordKeys = opts.wordKeys || [], live = opts.live || null;
    var session = str(S['Current bill session']), sessionN = /^\d{4}$/.test(session) ? +session : null;

    if (opts.schema !== undefined && String(opts.schema) !== String(SCHEMA_VERSION)) add('S5', 'E', 'settings', null, null, 'This sheet is not on schema 2 yet.', 'Setup › Upgrade or repair this sheet.');
    if (opts.branchVersion && cmpVersion(opts.branchVersion, FV_VERSION) > 0) add('S7', 'W', 'settings', null, null, 'The script here is ' + FV_VERSION + '; the copy on GitHub is ' + opts.branchVersion + '.', 'Paste the newer sheet/Code.gs into Extensions › Apps Script.');
    if (opts.sheetId && str(S['Publishing sheet (auto)']) !== opts.sheetId) add('S8', opts.forPublish ? 'E' : 'W', 'settings', model.settingsRow['Publishing sheet (auto)'], 'value', 'This is not the publishing sheet (it may be a copy).', 'If this sheet should publish, use Setup › Publish from this sheet.');

    // Settings
    SETTINGS_DEF.forEach(function (def) {
      var has = model.settings.hasOwnProperty(def.name), v = str(S[def.name]), row = model.settingsRow[def.name];
      if (!has && !model.tabs.settings.missing) { add('SE1', def.req ? 'E' : 'W', 'settings', null, null, 'Settings has no "' + def.name + '" row.', 'Setup › Upgrade or repair adds it.'); return; }
      if (def.req && !v) add(def.req, 'E', 'settings', row, 'value', '"' + def.name + '" is blank.', 'Fill in ' + def.name + ' on Settings.');
      if (def.type === 'date' && v && !isoDate(v)) add('SE3', 'E', 'settings', row, 'value', '"' + def.name + '" is not a date: "' + v + '".', 'Type the date as yyyy-mm-dd.');
    });
    model.settingsOrder.forEach(function (n) { if (!SETTING_BY_NORM[norm(n)]) add('S6', 'I', 'settings', model.settingsRow[n], 'setting', 'Settings row "' + n + '" is not one the script uses. It is kept.', ''); });
    if (S['Site status'] && !lookup(SITE_STATUS, S['Site status'])) add('SE2', 'E', 'settings', model.settingsRow['Site status'], 'value', 'Site status must be Live or Offline.', 'Pick Live or Offline.');
    var thr = isoDate(S['Research current through']);
    if (thr && thr > today) add('SE4', 'E', 'settings', model.settingsRow['Research current through'], 'value', 'Research current through is in the future.', 'Use the date the research is current to.');
    else if (thr && thr < addMonths(today, -8)) add('SE4', 'W', 'settings', model.settingsRow['Research current through'], 'value', 'The research date is more than 8 months old.', 'Run the 6-month refresh (Refresh checklist).');
    var nud = isoDate(S['Next update due']); if (nud && nud < today) add('SE5', 'W', 'settings', model.settingsRow['Next update due'], 'value', 'The next update was due ' + nud + '.', 'Run the Refresh checklist, then set a new date.');
    var maxBill = 0; rowsOf(model, 'bills').forEach(function (b) { if (/^\d{4}$/.test(b.year)) maxBill = Math.max(maxBill, +b.year); });
    if (session && (!sessionN || sessionN < maxBill)) add('SE6', 'E', 'settings', model.settingsRow['Current bill session'], 'value', 'Current bill session must be a 4-digit year, at least ' + maxBill + ' (the newest bill year).', 'Set it to ' + Math.max(maxBill, 2000) + ' or later.');
    var sa = str(S['Site address']);
    if (sa && S['GitHub owner'] && S['GitHub repo']) {
      var want = ('https://' + S['GitHub owner'] + '.github.io/' + S['GitHub repo'] + '/' + (S['Folder'] ? S['Folder'] + '/' : '')).toLowerCase();
      if (sa.toLowerCase() !== want) add('SE7', 'W', 'settings', model.settingsRow['Site address'], 'value', 'Site address does not look like owner/repo/folder (' + want + ').', 'Check it if the site moved.');
    }
    ['Offline from', 'Sunset decision by'].forEach(function (n) { var d = isoDate(S[n]); if (d && d <= addDays(today, 60)) add('SE8', 'W', 'settings', model.settingsRow[n], 'value', n + ' is ' + d + ', within 60 days.', n === 'Offline from' ? 'Make sure the offline words are Approved.' : 'Decide whether to extend the site or take it offline.'); });

    // Limits and labels
    var limitSet = {}, limitUse = {};
    rowsOf(model, 'limits').forEach(function (r) {
      var k = r.code;
      if (!k) return add('LI1', 'E', 'limits', r._row, 'code', 'Code is blank.', 'Type a code, or delete the row.');
      if (k !== k.toLowerCase()) add('LI1', 'E', 'limits', r._row, 'code', 'Code "' + k + '" must be lower-case.', 'Retype it in lower-case.');
      if (limitSet[k.toLowerCase()]) add('LI1', 'E', 'limits', r._row, 'code', 'Code "' + k + '" is listed twice.', 'Delete one of the rows.');
      limitSet[k.toLowerCase()] = r._row;
      if (!r.text) add('LI3', 'E', 'limits', r._row, 'text', 'Plain words are blank.', 'Describe the limit in lower-case words.');
      if (!lookup(LTYPE, r.type)) add('LI3', 'E', 'limits', r._row, 'type', 'Type must be Narrow, Weaker or Loosens.', 'Pick a Type.');
    });
    NEEDED_LIMITS.forEach(function (k) { if (!limitSet[k]) add('LI2', 'E', 'limits', null, 'code', 'The "' + k + '" limit is missing; the site\'s logic needs it.', 'Add it back with its plain words.'); });
    var lawCodes = {}, billCodes = {};
    rowsOf(model, 'labels').forEach(function (r) {
      var g = lookup(GROUPS, r.group);
      if (!g) return add('LA1', 'E', 'labels', r._row, 'group', 'Group must be Bill progress or Law status.', 'Pick a Group.');
      var set = g === 'lawStatus' ? lawCodes : billCodes;
      if (!r.code) add('LA1', 'E', 'labels', r._row, 'code', 'Code is blank.', 'Type a code.');
      else if (set[r.code]) add('LA1', 'E', 'labels', r._row, 'code', 'Code "' + r.code + '" is listed twice.', 'Delete one of the rows.');
      set[r.code] = 1;
    });
    ['Unchanged', 'New', 'Amended'].forEach(function (k) { if (!lawCodes[k]) add('LA1', 'E', 'labels', null, 'code', 'Law status "' + k + '" is missing.', 'Add a Law status row for ' + k + '.'); });

    // Protections
    var seenP = {}, seenShort = {}, orders = {};
    rowsOf(model, 'prot').forEach(function (r) {
      if (PIDS.indexOf(r.key) < 0) return add('P1', 'E', 'prot', r._row, 'key', 'Key must be 1 to 7.', "Don't change the Key column.");
      if (seenP[r.key]) add('P1', 'E', 'prot', r._row, 'key', 'Key ' + r.key + ' is listed twice.', 'Delete the extra row.');
      seenP[r.key] = 1;
      if (!r.short) add('P2', 'E', 'prot', r._row, 'short', 'Short name is blank.', 'Type a short name.');
      else { if (seenShort[norm(r.short)]) add('P2', 'E', 'prot', r._row, 'short', 'Two protections are called "' + r.short + '".', 'Give each a different name.'); seenShort[norm(r.short)] = 1; if (r.short.length > 24) add('P2', 'W', 'prot', r._row, 'short', 'Short name is ' + r.short.length + ' characters; 24 fits best.', 'Shorten it.'); }
      if (!r.long) add('P3', 'E', 'prot', r._row, 'long', 'What it means is blank.', 'Write one plain sentence.');
      if (!r.why) add('P3', 'W', 'prot', r._row, 'why', 'Why it matters is blank.', 'Write one plain sentence.');
      var o = str(r.order);
      if (!/^[1-7]$/.test(o) || orders[o]) add('P4', 'W', 'prot', r._row, 'order', 'Order on page must be 1 to 7, each used once.', 'Number the rows 1 to 7.');
      orders[o] = 1;
      statusCheck('prot', r);
    });
    PIDS.forEach(function (k) { if (!seenP[k]) add('P1', 'E', 'prot', null, 'key', 'Protection ' + k + ' is missing.', 'Add the row back with Key ' + k + '.'); });
    function statusCheck(tab, r) { if (STATUS.indexOf(r.status) < 0) add('W6', 'E', tab, r._row, 'status', 'Status must be Draft, Ready for review or Approved.', 'Pick a Status.'); }

    // Laws and bills
    var items = {}, itemRow = {};
    var protCellCheck = function (tab, id, r) {
      PIDS.forEach(function (k) {
        var v = str(r['p' + k]); if (!v || v.toLowerCase() === 'full') return;
        if (!limitSet[v.toLowerCase()]) add(id, 'E', tab, r._row, 'p' + k, '"' + v + '" is not Full or a code on the Limits tab.', 'Pick Full or a limit from the list.');
        else limitUse[v.toLowerCase()] = 1;
      });
    };
    var keyCheck = function (tab, ids, r) {
      if (!STATE_SET[r.state]) add(ids[0], 'E', tab, r._row, 'state', 'State "' + r.state + '" is not one of the 51.', 'Pick a state from the list.');
      if (!r.name) add(ids[1], 'E', tab, r._row, 'name', 'Name is blank.', 'Type the name shown on the site.');
      else { var k = r.state + '|' + r.name; if (items[k]) add(ids[1], 'E', tab, r._row, 'name', r.state + ' · ' + r.name + ' is already on ' + items[k] + '.', 'Give it a different name, or delete the duplicate.'); else { items[k] = TAB[tab].name + ' row ' + r._row; itemRow[k] = { tab: tab, row: r._row }; } }
    };
    var linkCheck = function (tab, id, r) { if (!r.link) add(id, 'E', tab, r._row, 'link', 'Link is blank.', 'Paste the official https:// link.'); else if (!/^https:\/\//i.test(r.link)) add(id, 'W', tab, r._row, 'link', 'Link does not start with https://.', 'Use the https:// address.'); };
    var staleCheck = function (tab, id, r, label) {
      if (!r.lastChecked) add(id, 'W', tab, r._row, 'lastChecked', label + ' has no Last checked date.', 'Re-read it and fill Last checked.');
      else if (!isoDate(r.lastChecked)) add(id, 'E', tab, r._row, 'lastChecked', 'Last checked is not a date: "' + r.lastChecked + '".', 'Type the date as yyyy-mm-dd.');
      else if (r.lastChecked < sixAgo) add(id, 'W', tab, r._row, 'lastChecked', label + ' was last checked ' + r.lastChecked + ', over 6 months ago.', 'Re-read it and update Last checked.');
    };
    var quoteSet = {};
    ((built && built.quotes) || []).forEach(function (q) { quoteSet[q.kind + '|' + q.state + '|' + q.item + '|' + q.rule] = 1; });
    var banCount = {}, banStates = {};
    rowsOf(model, 'laws').forEach(function (r) { var role = lookup(BAN_ROLE, r.banRole); if (role === 'Ban' || role === 'Pause') { banCount[r.state] = (banCount[r.state] || 0) + 1; banStates[r.state] = 1; } });
    var lastYear = String(+today.slice(0, 4) - 1), thisYear = today.slice(0, 4);
    rowsOf(model, 'laws').forEach(function (r) {
      keyCheck('laws', ['L1', 'L2'], r);
      if (!/^\d{4}/.test(r.year)) add('L3', 'E', 'laws', r._row, 'year', 'Year must start with a 4-digit year.', 'For example "2021" or "2021; amended 2026".');
      if (!lawCodes[r.status]) add('L4', 'E', 'laws', r._row, 'status', 'Status "' + r.status + '" is not a Law status on Labels.', 'Pick Unchanged, New or Amended.');
      if (!lookup(APPLIES, r.applies)) add('L5', 'E', 'laws', r._row, 'applies', 'Pick who the law applies to.', 'Pick a value from the list.');
      if (r.footage && !lookup(FOOTAGE, r.footage)) add('L5', 'E', 'laws', r._row, 'footage', '"' + r.footage + '" is not Drones or Body cameras.', 'Pick from the list or leave blank.');
      protCellCheck('laws', 'L6', r);
      var x = {}; readProtCells(r, x);
      x.rules.forEach(function (k) { if (!quoteSet['Law|' + r.state + '|' + r.name + '|' + k]) add('L7', 'E', 'laws', r._row, 'p' + k, 'No quote supports "' + (protNames[k] || PROT_DEFAULT[k]) + '" for this law.', 'Add a Quotes row for it.'); });
      if (!r.cite) add('L8', 'E', 'laws', r._row, 'cite', 'Citation is blank.', 'Add the official citation.');
      linkCheck('laws', 'L9', r);
      var uk = unclearKind(r.unclear);
      if (r.unclear && UNCLEAR.map(norm).indexOf(norm(r.unclear)) < 0) add('L10', 'E', 'laws', r._row, 'unclear', '"' + r.unclear + '" is not a choice for Unclear?.', 'Pick from the list.');
      if (uk === 'some') {
        var w = whichKeys(r.unclearWhich, protNames);
        if (!w.keys.length && !w.bad.length) add('L10', 'E', 'laws', r._row, 'unclearWhich', 'List the unclear protections.', 'Type their names, separated by semicolons.');
        w.bad.forEach(function (n) { add('L10', 'E', 'laws', r._row, 'unclearWhich', '"' + n + '" is not a protection name.', 'Use names from the Protections tab.'); });
        w.keys.forEach(function (k) { if (x.rules.indexOf(k) < 0) add('L10', 'E', 'laws', r._row, 'unclearWhich', '"' + (protNames[k] || k) + '" is not a protection this law adds.', 'Remove it, or set the protection.'); });
      }
      if (uk !== 'no' && !r.unclearNote) add('L10', 'W', 'laws', r._row, 'unclearNote', 'The law is marked unclear but has no Unclear note.', 'Say in one sentence what is unclear.');
      var role = lookup(BAN_ROLE, r.banRole);
      if (r.banRole && !role) add('L11', 'E', 'laws', r._row, 'banRole', '"' + r.banRole + '" is not Ban, Pause or Exception.', 'Pick from the list.');
      if (role === 'Ban' || role === 'Pause') {
        if (!lookup(APPLIES, r.banCovers)) add('L11', 'E', 'laws', r._row, 'banCovers', 'Pick who the ' + role.toLowerCase() + ' covers.', 'Pick from the list.');
        if (!r.banText) add('L11', 'E', 'laws', r._row, 'banText', 'A ' + role.toLowerCase() + ' needs Ban text.', 'Write one sentence describing it.');
        if (banCount[r.state] > 1) add('L11', 'W', 'laws', r._row, 'banRole', r.state + ' has more than one ban or pause; the site uses the first.', 'Check which one should count.');
      }
      if (role === 'exception' && !banStates[r.state]) add('L11', 'E', 'laws', r._row, 'banRole', 'This law is an exception, but ' + r.state + ' has no ban or pause.', 'Clear the value, or add the ban.');
      if (r.barsFrom && !lookup(FOOTAGE, r.barsFrom)) add('L12', 'E', 'laws', r._row, 'barsFrom', '"' + r.barsFrom + '" is not Drones or Body cameras.', 'Pick from the list.');
      if (r.barsFrom && !r.barText) add('L12', 'E', 'laws', r._row, 'barText', 'A bar needs Bar text.', 'Write one sentence shown when the bar stops a search.');
      var src = lookup(FOOTAGE, r.footage);
      PIDS.forEach(function (k) { var v = str(r['p' + k]).toLowerCase(); if ((src === 'drone' && v === 'drones only') || (src === 'bodycam' && v === 'body cameras only')) add('L13', 'W', 'laws', r._row, 'p' + k, 'The footage limit is said twice ("' + r.footage + '" and "' + v + '").', 'Fine as is; or set the protection to Full.'); });
      staleCheck('laws', 'L14', r, 'This law');
      if (r.status === 'New' && r.year.indexOf(thisYear) < 0 && r.year.indexOf(lastYear) < 0) add('L15', 'W', 'laws', r._row, 'status', 'Status is New, but the Year is not ' + lastYear + ' or ' + thisYear + '.', 'Reset it to Unchanged at the refresh, or fix the Year.');
      if (r.summary.length > 450) add('L16', 'W', 'laws', r._row, 'summary', 'Summary is ' + r.summary.length + ' characters; keep it under 450.', 'Shorten it.');
      ['name', 'year', 'who', 'summary', 'cite', 'link', 'unclearNote', 'note', 'banText', 'banExcept', 'barText'].forEach(function (k) {
        var v = r[k] || '';
        if (/[ ​-‍⁠﻿]/.test(v)) add('L17', 'W', 'laws', r._row, k, 'Hidden characters (non-breaking or zero-width spaces).', 'Retype the text.');
        else if (/[\r\n]/.test(v)) add('L17', 'W', 'laws', r._row, k, 'Line break in the text.', 'Join it into one line.');
        else if (/ {2}/.test(v)) add('L17', 'W', 'laws', r._row, k, 'Double space in the text.', 'Use one space.');
      });
      if (!x.rules.length && !role && !r.barsFrom && uk === 'no') add('L18', 'I', 'laws', r._row, 'name', 'This law adds no protection, ban or bar; it counts as "a law, none of the 7".', '');
    });
    rowsOf(model, 'bills').forEach(function (r) {
      keyCheck('bills', ['B1', 'B2'], r);
      if (!/^\d{4}$/.test(r.year) || +r.year < 2000) add('B3', 'E', 'bills', r._row, 'year', 'Year must be a 4-digit year from 2000 on.', 'Type the session year, e.g. ' + (session || '2026') + '.');
      else if (sessionN && +r.year > sessionN) add('B3', 'E', 'bills', r._row, 'year', 'Year ' + r.year + ' is later than Settings › Current bill session (' + session + ').', 'Set Current bill session to ' + r.year + ', or fix this Year.');
      if (!billCodes[r.progress]) add('B4', 'E', 'bills', r._row, 'progress', 'Progress "' + r.progress + '" is not a Bill progress code on Labels.', 'Pick from the list.');
      protCellCheck('bills', 'B5', r);
      linkCheck('bills', 'B6', r);
      if (!r.sponsor) add('B7', 'W', 'bills', r._row, 'sponsor', 'Sponsor is blank.', 'Add the lead sponsor.');
      if (r.alive && /^failed/i.test(r.progress)) add('B8', 'W', 'bills', r._row, 'alive', 'Still alive is ticked, but Progress says ' + r.progress + '.', 'Untick Still alive, or fix Progress.');
      else if (r.alive && sessionN && /^\d{4}$/.test(r.year) && +r.year <= sessionN - 2) add('B8', 'W', 'bills', r._row, 'alive', 'Still alive is ticked on a bill from ' + r.year + '.', 'Check whether it can still pass.');
      staleCheck('bills', 'B9', r, 'This bill');
      var x = {}; readProtCells(r, x);
      if (r.year === session && !x.rules.length && !r.note) add('B10', 'I', 'bills', r._row, 'note', 'A ' + session + ' bill with no protections and no note.', 'Add a Note saying why it is listed.');
    });

    // Quotes
    var allItems = Object.keys(itemRow).map(function (k) { return k.replace('|', ' · '); }), seenQ = {}, leads = {};
    rowsOf(model, 'quotes').forEach(function (r) {
      var it = parseItem(r.item), k = it.state + '|' + it.name, rule = protKeyOf(r.prot, protNames);
      if (!itemRow[k]) {
        var best = '', bd = 1e9; allItems.forEach(function (n) { var d = lev(n.toLowerCase(), str(r.item).toLowerCase()); if (d < bd) { bd = d; best = n; } });
        add('Q1', 'E', 'quotes', r._row, 'item', '"' + r.item + '" is not on Laws or Bills.', best ? 'Did you mean "' + best + '"?' : 'Pick from the list.');
      }
      if (rule === undefined) add('Q2', 'E', 'quotes', r._row, 'prot', '"' + r.prot + '" is not a protection name.', 'Pick from the list.');
      else if (rule && itemRow[k]) {
        var src = (itemRow[k].tab === 'laws' ? rowsOf(model, 'laws') : rowsOf(model, 'bills')).filter(function (x) { return x._row === itemRow[k].row; })[0];
        if (src && !str(src['p' + rule])) add('Q3', 'E', 'quotes', r._row, 'prot', it.name + ' does not add "' + (protNames[rule] || rule) + '".', 'Pick the protection it adds, or "' + RELATED + '".');
      }
      if (!r.text) add('Q4', 'E', 'quotes', r._row, 'text', 'Exact wording is blank.', 'Paste the law\'s words.');
      else { var mp = marksProblem(r.text); if (mp) add('Q4', 'E', 'quotes', r._row, 'text', mp, 'Close the mark.'); }
      if (!r.cite) add('Q5', 'E', 'quotes', r._row, 'cite', 'Citation is blank.', 'Add the pinpoint citation.');
      var dk = [r.item, r.prot, r.cite, r.text].join('\u0001'); if (seenQ[dk]) add('Q6', 'W', 'quotes', r._row, 'text', 'This quote repeats row ' + seenQ[dk] + '.', 'Delete one of them.'); else seenQ[dk] = r._row;
      if (r.lead && rule) { var lk = k + '|' + rule; if (leads[lk]) add('Q7', 'W', 'quotes', r._row, 'lead', 'More than one Lead quote for this law and protection (also row ' + leads[lk] + ').', 'Tick only one.'); else leads[lk] = r._row; }
      if (r.text.length > 1200) add('Q8', 'W', 'quotes', r._row, 'text', 'Exact wording is ' + r.text.length + ' characters; keep it under 1,200.', 'Quote the key part only.');
    });

    // States
    var seenSt = {};
    rowsOf(model, 'states').forEach(function (r) {
      if (!STATE_SET[r.state]) add('ST1', 'E', 'states', r._row, 'state', '"' + r.state + '" is not one of the 51 map places.', "Don't add or rename rows here.");
      else if (seenSt[r.state]) add('ST1', 'E', 'states', r._row, 'state', r.state + ' is listed twice.', 'Delete the extra row.');
      seenSt[r.state] = 1;
      var has = Object.keys(itemRow).some(function (k) { return k.split('|')[0] === r.state; });
      if (has && STATE_SET[r.state]) {
        if (!r.lastChecked) add('ST2', 'W', 'states', r._row, 'lastChecked', r.state + ' has no Last checked date.', 'Confirm its laws and bills, then fill Last checked.');
        else if (!isoDate(r.lastChecked)) add('ST2', 'E', 'states', r._row, 'lastChecked', 'Last checked is not a date.', 'Type the date as yyyy-mm-dd.');
        else if (r.lastChecked < sixAgo) add('ST2', 'W', 'states', r._row, 'lastChecked', r.state + ' was last checked over 6 months ago.', 'Confirm and update Last checked.');
      }
    });
    if (!model.tabs.states.missing) STATE_NAMES.forEach(function (n) { if (!seenSt[n]) add('ST1', 'E', 'states', null, 'state', n + ' is missing from States.', 'Add the row back.'); });
    Object.keys(limitSet).forEach(function (k) { if (!limitUse[k] && NEEDED_LIMITS.indexOf(k) < 0) add('LI4', 'I', 'limits', limitSet[k], 'code', '"' + k + '" is not used by any law or bill.', ''); });

    // Stories
    var shown = 0, sOrders = {};
    rowsOf(model, 'stories').forEach(function (r) {
      var who = whoCode(r.who);
      if (!STATE_SET[r.state]) add('SS1', 'E', 'stories', r._row, 'state', 'State "' + r.state + '" is not one of the 51.', 'Pick a state.');
      if (!who || !lookup(SRC, r.src) || !lookup(DB, r.db) || !lookup(CRIME, r.crime)) add('SS1', 'E', 'stories', r._row, 'who', 'Pick a value from each dropdown.', 'Fill Who searches, Photo from, Searched against and Crime.');
      statusCheck('stories', r);
      if (!r.show) return;
      shown++;
      if (who === 'federal') add('SS2', 'E', 'stories', r._row, 'who', 'The new page has no federal agent option.', 'Untick Show on new page, or pick Local or State police.');
      if (!r.lesson) add('SS4', 'W', 'stories', r._row, 'lesson', 'A shown story has no "What it shows".', 'Write its lesson in one sentence.');
      [['t', 40], ['d', 160], ['lesson', 140]].forEach(function (p) { if (r[p[0]].length > p[1]) add('SS4', 'W', 'stories', r._row, p[0], 'Text is ' + r[p[0]].length + ' characters; ' + p[1] + ' fits.', 'Shorten it.'); });
      var o = str(r.order); if (o && sOrders[o]) add('SS5', 'W', 'stories', r._row, 'order', 'Order ' + o + ' is used twice.', 'Give each shown story its own number.'); sOrders[o] = 1;
    });
    if (shown < 3 || shown > 4) add('SS3', 'W', 'stories', null, 'show', shown + ' stories are ticked for the new page; 3 or 4 fit best.', 'Tick 3 or 4 stories.');

    // Glossary
    var gk = {};
    rowsOf(model, 'glossary').forEach(function (r) {
      if (!r.key) add('G1', 'E', 'glossary', r._row, 'key', 'Key is blank.', 'Type a key.');
      else if (gk[r.key]) add('G1', 'E', 'glossary', r._row, 'key', 'Key "' + r.key + '" is listed twice.', 'Delete one.');
      gk[r.key] = 1;
      if (!r.term || !r.def) add('G2', 'E', 'glossary', r._row, r.term ? 'def' : 'term', 'Term or Definition is blank.', 'Fill both.');
      statusCheck('glossary', r);
    });
    OLD_GLOSS.forEach(function (k) { if (!gk[k]) add('G1', 'W', 'glossary', null, 'key', 'The old site\'s glossary key "' + k + '" is missing; it falls back to its own text.', 'Add it back if you want to change its wording.'); });

    // Words
    var wkMap = {}, seenW = {}, rowsW = rowsOf(model, 'words'), liveWords = (live && live.config && live.config.words) || {}, liveWhy = (live && live.config && live.config.why) || {};
    wordKeys.forEach(function (w) { wkMap[w.key] = w; });
    rowsW.forEach(function (r) {
      if (!r.key) return add('W1', 'E', 'words', r._row, 'key', 'Key is blank.', 'Type the key, or delete the row.');
      if (seenW[r.key]) add('W1', 'E', 'words', r._row, 'key', 'Key "' + r.key + '" is listed twice (also row ' + seenW[r.key] + ').', 'Delete one.');
      seenW[r.key] = r._row;
      var meta = wkMap[r.key], isWhy = /^why\./.test(r.key);
      if (!meta && !isWhy) add('W1', 'I', 'words', r._row, 'key', '"' + r.key + '" is not used by the site yet. It is still published.', '');
      if (!r.text) add('W2', 'W', 'words', r._row, 'text', 'Text is blank; the page uses its default.', 'Write the wording.');
      var max = meta ? +meta.max : parseInt(r.max, 10);
      if (max > 0 && r.text.length > max && !isUrlKey(r.key)) add('W3', 'W', 'words', r._row, 'text', 'Text is ' + r.text.length + ' characters; ' + max + ' fits.', 'Shorten it.');
      var allowed = meta ? (meta.fills || []) : parseFills(r.fills);
      fillsOf(r.text).forEach(function (f) { if (allowed.indexOf(f) < 0) add('W4', 'E', 'words', r._row, 'text', 'Fill-in {' + f + '} is not allowed here.', allowed.length ? 'Use only ' + allowed.map(function (a) { return '{' + a + '}'; }).join(' ') + '.' : 'This text takes no fill-ins.'); });
      if (isUrlKey(r.key) && r.text && !/^https:\/\/\S+$/.test(r.text)) add('W5', 'E', 'words', r._row, 'text', 'This must be an https:// address.', 'Paste the full https:// link.');
      statusCheck('words', r);
      if (live && r.status === 'Approved') {
        var lv = isWhy ? liveWhy[r.key.slice(4)] : liveWords[r.key];
        if (str(lv) !== r.text) add('W7', 'I', 'words', r._row, 'text', 'Approved wording that differs from the live site; it goes live at Deploy.', '');
      }
    });
    wordKeys.forEach(function (w) { if (!seenW[w.key]) add('W1', 'E', 'words', null, 'key', 'Key "' + w.key + '" is missing.', 'Setup › Upgrade or repair adds it back.'); });
    var offline = lookup(SITE_STATUS, S['Site status']) === 'offline' || !!isoDate(S['Offline from']);
    if (offline) rowsW.filter(function (r) { return /^offline\./.test(r.key); }).forEach(function (r) {
      if (r.status !== 'Approved') add('W8', 'E', 'words', r._row, 'status', 'The site is set to go offline, but ' + r.key + ' is not Approved.', 'Have the offline wording approved.');
    });

    // Output
    if (built) {
      var size = utf8Length(JSON.stringify(built, null, 1));
      if (size > 950000) add('X1', 'E', 'output', null, null, 'The site file would be ' + Math.round(size / 1000) + ' KB; GitHub reads at most 1 MB.', 'Shorten long quotes.');
      else if (size > 700000) add('X1', 'W', 'output', null, null, 'The site file would be ' + Math.round(size / 1000) + ' KB.', 'Keep it under 700 KB.');
      out = out.concat(oldAppContract(built));
      if (live && Array.isArray(live.states)) diff(live, opts.lv || built).map.forEach(function (m) { add('X3', 'I', 'states', null, null, 'Map change: ' + m, ''); });
    }
    return out;
  }
  function utf8Length(s) { var n = 0; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xD800 && c < 0xDC00) ? (i++, 4) : 3; } return n; }
  function cmpVersion(a, b) { var x = str(a).split('.').map(Number), y = str(b).split('.').map(Number); for (var i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }

  /* ---------- diff ---------- */
  function short(v) { var s = typeof v === 'string' ? v : JSON.stringify(v); s = s === undefined ? '(none)' : s; return s.length > 90 ? s.slice(0, 87) + '...' : s; }
  function diff(a, b) {
    a = a || {}; b = b || {};
    var ch = [], map = [];
    var add = function (area, what) { ch.push({ area: area, what: what }); };
    if (a.source !== b.source) add('Research note', short(a.source) + ' → ' + short(b.source));
    var la = Array.isArray(a.states) ? stateLevels(a) : {}, lb = Array.isArray(b.states) ? stateLevels(b) : {};
    Object.keys(lb).concat(Object.keys(la).filter(function (n) { return !lb[n]; })).forEach(function (n) {
      var x = la[n] ? la[n].label : '(not listed)', y = lb[n] ? lb[n].label : '(not listed)';
      if (x !== y) map.push(n + ': ' + x + ' → ' + y);
    });
    var rows = function (area, xa, xb, keyf) {
      var ia = {}, ib = {}; (xa || []).forEach(function (r) { ia[keyf(r)] = r; }); (xb || []).forEach(function (r) { ib[keyf(r)] = r; });
      Object.keys(ib).forEach(function (k) {
        if (!ia[k]) return add(area, 'added ' + k);
        var f = Object.keys(ia[k]).concat(Object.keys(ib[k])).filter(function (x, i, s) { return s.indexOf(x) === i && JSON.stringify(ia[k][x]) !== JSON.stringify(ib[k][x]); });
        if (f.length) add(area, 'changed ' + k + ' (' + f.join(', ') + ')');
      });
      Object.keys(ia).forEach(function (k) { if (!ib[k]) add(area, 'removed ' + k); });
    };
    rows('Laws', a.laws, b.laws, function (l) { return l.state + ' · ' + l.name; });
    rows('Bills', a.bills, b.bills, function (l) { return l.state + ' · ' + l.name; });
    var qa = {}, qb = {}, qk = function (q) { return canonical(q); };
    (a.quotes || []).forEach(function (q) { qa[qk(q)] = (qa[qk(q)] || 0) + 1; }); (b.quotes || []).forEach(function (q) { qb[qk(q)] = (qb[qk(q)] || 0) + 1; });
    var qlabel = function (k) { var q = JSON.parse(k); return q.state + ' · ' + q.item + (q.rule ? ' (' + q.rule + ')' : ''); };
    Object.keys(qb).forEach(function (k) { for (var i = qa[k] || 0; i < qb[k]; i++) add('Quotes', 'added ' + qlabel(k)); });
    Object.keys(qa).forEach(function (k) { for (var i = qb[k] || 0; i < qa[k]; i++) add('Quotes', 'removed ' + qlabel(k)); });
    if (JSON.stringify((a.quotes || []).map(qk)) !== JSON.stringify((b.quotes || []).map(qk)) && !ch.some(function (c) { return c.area === 'Quotes'; })) add('Quotes', 'order changed');
    var sa = {}; (a.states || []).forEach(function (s) { sa[s.name] = s.law; });
    (b.states || []).forEach(function (s) { if (sa.hasOwnProperty(s.name) && sa[s.name] !== s.law) add('States', s.name + ' law status: ' + sa[s.name] + ' → ' + s.law); });
    var A = a.config || {}, B = b.config || {};
    var obj = function (area, xa, xb) {
      xa = isObj(xa) ? xa : {}; xb = isObj(xb) ? xb : {};
      Object.keys(xa).concat(Object.keys(xb)).filter(function (k, i, s) { return s.indexOf(k) === i; }).forEach(function (k) {
        if (JSON.stringify(xa[k]) !== JSON.stringify(xb[k])) add(area, !xa.hasOwnProperty(k) ? 'added ' + k + ': ' + short(xb[k]) : !xb.hasOwnProperty(k) ? 'removed ' + k : k + ': ' + short(xa[k]) + ' → ' + short(xb[k]));
      });
    };
    obj('Protections', A.prot, B.prot); obj('Limits', A.limits, B.limits); obj('Labels', A.billSteps, B.billSteps); obj('Labels', A.lawStatus, B.lawStatus);
    obj('Glossary', A.glossary, B.glossary); obj('Step notes', A.why, B.why); obj('Words', A.words, B.words); obj('Site settings', A.site, B.site);
    if (JSON.stringify(A.stories) !== JSON.stringify(B.stories)) obj('Stories (old site)', listObj(A.stories, function (s) { return s.t; }), listObj(B.stories, function (s) { return s.t; }));
    if (JSON.stringify(A.examples) !== JSON.stringify(B.examples)) obj('Stories (new page)', listObj(A.examples, function (s) { return s.id; }), listObj(B.examples, function (s) { return s.id; }));
    var lq = function (d) { var o = {}, L = (d.config && d.config.leadQuotes) || {}; Object.keys(L).forEach(function (k) { o[k] = short(((d.quotes || [])[L[k]] || {}).text); }); return o; };
    obj('Lead quotes', lq(a), lq(b));
    if (a.schema !== b.schema) add('Format', 'schema ' + (a.schema || 1) + ' → ' + (b.schema || 1));
    var areas = {}; ch.forEach(function (c) { areas[c.area] = (areas[c.area] || 0) + 1; });
    var summary = (map.length ? ['Map: ' + map.length + ' state' + (map.length > 1 ? 's' : '') + ' change'] : ['Map: no change']).concat(Object.keys(areas).map(function (k) { return k + ': ' + areas[k] + ' change' + (areas[k] > 1 ? 's' : ''); }));
    var details = map.map(function (m) { return 'Map · ' + m; }).concat(ch.map(function (c) { return c.area + ' · ' + c.what; }));
    return { count: ch.length + map.length, map: map, changes: ch, summary: summary, details: details };
  }
  function listObj(list, keyf) { var o = {}; (Array.isArray(list) ? list : []).forEach(function (x, i) { if (isObj(x)) o[keyf(x) || '#' + (i + 1)] = x; }); return o; }

  /* ---------- additive equality: new = old + allowed new fields ---------- */
  var EXTRA_OK = [/^schema$/, /^generator$/, /^config\.prot\.[1-7]\.(why|order)$/, /^config\.(words|site|leadQuotes|examples)(\.|$)/];
  function additiveEqual(a, b) {
    var problems = [], allowed = [];
    var walk = function (x, y, p) {
      if (p === 'updated') return;
      if (x !== null && typeof x === 'object') {
        if (y === null || typeof y !== 'object' || Array.isArray(x) !== Array.isArray(y)) { problems.push(p + ': type changed'); return; }
        if (Array.isArray(x) && x.length !== y.length) problems.push(p + ': ' + x.length + ' items became ' + y.length);
        Object.keys(x).forEach(function (k) { var q = p ? p + '.' + k : k; if (!Object.prototype.hasOwnProperty.call(y, k)) problems.push(q + ' is missing'); else walk(x[k], y[k], q); });
        Object.keys(y).forEach(function (k) { var q = p ? p + '.' + k : k; if (!Object.prototype.hasOwnProperty.call(x, k) && !EXTRA_OK.some(function (r) { return r.test(q); })) problems.push(q + ' is a new field that is not allowed'); });
        return;
      }
      if (x !== y) {
        var m = /^states\.(\d+)\.law$/.exec(p);
        if (m && typeof x === 'string' && y === x + ' (none of the seven)') { allowed.push(((a.states[+m[1]] || {}).name || p) + ': "' + x + '" → "' + y + '"'); return; }
        problems.push(p + ': ' + short(x) + ' → ' + short(y));
      }
    };
    walk(a, b, '');
    return { ok: !problems.length, problems: problems, allowed: allowed };
  }
  /** Removes the v2-only fields (for the byte check against a v1 build). */
  function stripNew(d) {
    var c = copy(d); delete c.schema; delete c.generator;
    if (c.config) { ['words', 'site', 'leadQuotes', 'examples'].forEach(function (k) { delete c.config[k]; }); Object.keys(c.config.prot || {}).forEach(function (k) { delete c.config.prot[k].why; delete c.config.prot[k].order; }); }
    return c;
  }
  function canonical(x) {
    if (x instanceof Date) return JSON.stringify(x.toISOString());
    if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
    if (x !== null && typeof x === 'object') return '{' + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ':' + canonical(x[k]); }).join(',') + '}';
    return JSON.stringify(x === undefined ? null : x);
  }
  /** What the preview hash covers: everything except the update time. */
  function hashInput(d) { var c = copy(d) || {}; delete c.updated; return canonical(c); }

  /* ---------- JSON -> v2 rows (Upgrade and disaster recovery) ---------- */
  function protCellOf(x, k) { return (x.rules || []).indexOf(k) < 0 ? '' : ((x.limits || {})[k] || 'Full'); }
  function settingsFrom(json, v1, opts) {
    v1 = v1 || {}; opts = opts || {};
    var note = str(v1['Research note'] !== undefined ? v1['Research note'] : json.source), p = parseApDate(note), heads = [];
    var tpl = p ? note.replace(p.match, '{date}') : note, through = p ? p.iso : '';
    if (!p && note) heads.push('The research note has no date the script can read, so Research current through is blank. Fill it in after the upgrade.');
    var bills = json.bills || [], maxY = 0; bills.forEach(function (b) { if (/^\d{4}$/.test(b.year)) maxY = Math.max(maxY, +b.year); });
    var site = json.config && json.config.site ? json.config.site : {};
    var who = function (s) { return str(s).replace(/([A-Za-z0-9._%+-]+)@[A-Za-z0-9.-]+/g, '$1'); };
    var val = {
      'GitHub owner': str(v1['GitHub owner']), 'GitHub repo': str(v1['GitHub repo']), 'Branch': str(v1['Branch']), 'Folder': str(v1['Folder']),
      'Site address': str(v1['Site address']), 'New page address': str(v1['New page address']) || (str(v1['Site address']) ? str(v1['Site address']).replace(/\/?$/, '/') + 'play/' : ''),
      'Research note': tpl, 'Research current through': site.currentThrough || through, 'Current bill session': site.billYear || (maxY ? String(maxY) : ''),
      'Site status': site.status === 'offline' ? 'Offline' : 'Live', 'Offline from': site.offlineFrom || '', 'Offline message (auto)': '',
      'Next update due': site.nextUpdate || (site.currentThrough || through ? addMonths(site.currentThrough || through, 6) : ''),
      'Show out-of-date notice after': site.staleAfter || '', 'Sunset decision by': str(v1['Sunset decision by']),
      'Publishing sheet (auto)': opts.sheetId || '', 'Last preview (auto)': who(v1['Last preview (auto)'] || v1['Last preview']), 'Last deploy (auto)': who(v1['Last deploy (auto)'] || v1['Last deploy']),
      'GitHub key (auto)': '', 'Sheet version (auto)': SCHEMA_VERSION + ' · script ' + FV_VERSION + ' · upgraded ' + (opts.today || '')
    };
    SETTINGS_DEF.forEach(function (d) { if (d.req === 'S4' && !val[d.name]) heads.push('Settings › ' + d.name + ' is blank. The old script filled in a default; v2 needs the real value.'); });
    var help = (opts.texts && opts.texts.settingsHelp) || {};
    var rows = SETTINGS_DEF.map(function (d) { return { setting: d.name, value: val[d.name], help: str(help[d.name]), _auto: !!d.auto, _type: d.type || 'text' }; });
    Object.keys(v1).forEach(function (k) { if (!SETTING_BY_NORM[norm(k)] && str(k)) rows.push({ setting: k, value: str(v1[k]), help: 'Kept from before the upgrade; the script does not use it.', _type: 'text' }); });
    return { rows: rows, heads: heads };
  }

  /** Site JSON (+ seeds) -> {tabKey: [row objects]}. opts: {wordKeys, texts, settingsRows, seeds}. */
  function toRowsV2(json, opts) {
    opts = opts || {};
    var C = json.config || {}, prot = C.prot || {}, out = {}, wordKeys = opts.wordKeys || [], protNames = {};
    PIDS.forEach(function (k) { protNames[k] = prot[k] ? prot[k].short : PROT_DEFAULT[k]; });
    var words = C.words || {}, why = C.why || {}, seenW = {};
    out.words = [];
    var wordRow = function (key, where, text, status, note, max, fills, usedOn) { seenW[key] = 1; out.words.push({ key: key, where: where, text: text, status: status, notes: note, max: String(max || ''), fills: (fills || []).map(function (f) { return '{' + f + '}'; }).join(' '), usedOn: usedOn }); };
    wordKeys.forEach(function (w) {
      var m = /^why\.(\w+)$/.exec(w.key);
      if (m) { if (STEPKEYS.indexOf(m[1]) >= 0 && why.hasOwnProperty(m[1])) wordRow(w.key, w.where, why[m[1]], 'Approved', '', w.max, w.fills, w.usedOn || 'Both'); return; }
      if (words.hasOwnProperty(w.key)) wordRow(w.key, w.where, words[w.key], 'Approved', '', w.max, w.fills, w.usedOn);
      else wordRow(w.key, w.where, w.text, 'Draft', DRAFT_NOTE, w.max, w.fills, w.usedOn);
    });
    STEPKEYS.forEach(function (k) { if (why.hasOwnProperty(k) && !seenW['why.' + k]) wordRow('why.' + k, 'Case walkthrough: why the ' + k + ' step matters', why[k], 'Approved', '', 240, [], 'Both'); });
    Object.keys(words).forEach(function (k) { if (!seenW[k]) wordRow(k, '', words[k], 'Approved', '', '', fillsOf(words[k]), 'New page'); });

    out.laws = (json.laws || []).map(function (l) {
      var uk = !l.review ? 'No' : !(l.reviewRules || []).length ? 'Yes: the law as a whole' : JSON.stringify(l.reviewRules) === JSON.stringify(l.rules) ? 'Yes: every protection it adds' : 'Yes: only some protections';
      var r = { state: l.state, name: l.name, year: str(l.year), status: l.status, who: l.who, applies: keyOf(APPLIES, l.whoFor), footage: keyOf(FOOTAGE, l.source), dmv: l.db === 'dmv',
        summary: l.does, cite: l.cite, link: l.link, unclear: uk,
        unclearWhich: uk === 'Yes: only some protections' ? l.reviewRules.map(function (k) { return protNames[k] || k; }).join('; ') : '',
        unclearNote: l.review ? (l.reviewNote || '') : '', note: l.note || '',
        banRole: l.ban ? l.ban.kind : l.banException ? 'Exception to a ban or pause' : '', banCovers: l.ban ? keyOf(APPLIES, l.ban.who) : '', banText: l.ban ? l.ban.text : '', banExcept: l.ban ? (l.ban.except || '') : '',
        barsFrom: l.bars ? keyOf(FOOTAGE, l.bars.src) : '', barText: l.bars ? l.bars.text : '', lastChecked: '', checkedBy: '', research: '' };
      PIDS.forEach(function (k) { r['p' + k] = protCellOf(l, k); });
      return r;
    });
    out.bills = (json.bills || []).map(function (b) {
      var r = { state: b.state, name: b.name, year: str(b.year), progress: b.step, alive: !!b.pending, summary: b.does, sponsor: b.sponsor, link: b.link, note: b.note || '', lastChecked: '', checkedBy: '', research: '' };
      PIDS.forEach(function (k) { r['p' + k] = protCellOf(b, k); });
      return r;
    });
    var leadBy = {}; Object.keys(C.leadQuotes || {}).forEach(function (k) { leadBy[C.leadQuotes[k]] = 1; });
    out.quotes = (json.quotes || []).map(function (q, i) { return { item: q.state + ' · ' + q.item, prot: q.rule ? (protNames[q.rule] || q.rule) : RELATED, cite: q.cite, text: q.text, lead: !!leadBy[i], lastChecked: '', checkedBy: '' }; });
    out.states = (json.states || []).map(function (s) { return { state: s.name, lastChecked: '', checkedBy: '', research: '' }; });
    out.prot = PIDS.filter(function (k) { return prot[k]; }).map(function (k) {
      var p = prot[k], hasWhy = !!str(p.why);
      return { key: k, short: p.short, long: p.long, why: hasWhy ? p.why : opts.seeds ? (opts.protWhy || PROT_WHY)[k] || '' : '', order: String(p.order || PORDER.indexOf(k) + 1),
        status: hasWhy || !opts.seeds ? 'Approved' : 'Draft', notes: hasWhy || !opts.seeds ? '' : 'Why it matters: ' + DRAFT_NOTE };
    });
    var exs = Array.isArray(C.examples) ? C.examples : [], seeds = opts.seeds ? (opts.exampleSeeds || EXAMPLE_SEEDS) : [], usedSeed = {};
    out.stories = (C.stories || []).map(function (s) {
      var ex = exs.filter(function (e) { return e.t === s.t && e.state === s.state; })[0], seed = null;
      if (!ex && !exs.length) seed = seeds.filter(function (e) { return !usedSeed[e.id] && e.state === s.state && e.who === s.who && e.src === s.src && e.db === s.db && e.crime === s.crime; })[0];
      if (seed) usedSeed[seed.id] = 1;
      return { order: ex ? String(ex.order) : seed ? String(seed.order) : '', show: !!(ex || seed), t: s.t, d: s.d, lesson: ex ? ex.lesson : seed ? seed.lesson : '',
        state: s.state, who: keyOf(WHO, s.who), src: keyOf(SRC, s.src), db: keyOf(DB, s.db), crime: keyOf(CRIME, s.crime),
        status: seed ? 'Draft' : 'Approved', notes: seed ? 'What it shows and the tick: ' + DRAFT_NOTE : '', id: ex ? ex.id : seed ? seed.id : slug(s.t) };
    });
    out.glossary = Object.keys(C.glossary || {}).map(function (k) { return { key: k, term: C.glossary[k].term, def: C.glossary[k].def, status: 'Approved', notes: '' }; });
    out.limits = Object.keys(C.limits || {}).map(function (k) { return { code: k, text: C.limits[k].text, type: keyOf(LTYPE, C.limits[k].type) || 'Narrow' }; });
    out.labels = Object.keys(C.billSteps || {}).map(function (k) { return { group: 'Bill progress', code: k, shown: C.billSteps[k] }; })
      .concat(Object.keys(C.lawStatus || {}).map(function (k) { return { group: 'Law status', code: k, shown: C.lawStatus[k] }; }));
    out.settings = opts.settingsRows || settingsFrom(json, {}, opts).rows;
    out.checklist = ((opts.texts && opts.texts.checklist) || []).map(function (c) { return { done: false, step: str(c.step), how: str(c.how), who: str(c.who), date: '', notes: '' }; });
    out.changelog = [];
    return out;
  }

  /** Auto (grey) column values for one row. ctx: {json (the build these rows make), live, protNames}. */
  function autoValue(tabKey, key, r, ctx) {
    var d = ctx.json || {}, live = ctx.live || null, pn = ctx.protNames || {};
    if (tabKey === 'laws' && key === 'quotesAuto') {
      var qs = (d.quotes || []).filter(function (q) { return q.kind === 'Law' && q.state === r.state && q.item === r.name; });
      var x = {}; readProtCells(r, x);
      var miss = x.rules.filter(function (k) { return !qs.some(function (q) { return q.rule === k; }); });
      return qs.length + ' quote' + (qs.length === 1 ? '' : 's') + (miss.length ? ' · missing: ' + miss.map(function (k) { return pn[k] || PROT_DEFAULT[k]; }).join('; ') : x.rules.length ? ' · none missing' : '');
    }
    if (tabKey === 'bills' && key === 'countsAs') {
      var by = str((d.config && d.config.site && d.config.site.billYear) || '');
      return r.year === by ? r.year + ' session' : r.alive ? 'Still alive (' + r.year + ')' : 'Earlier session';
    }
    if (tabKey === 'quotes' && (key === 'stateAuto' || key === 'kindAuto')) {
      var it = parseItem(r.item);
      if (key === 'stateAuto') return it.state;
      var isL = (d.laws || []).some(function (l) { return l.state === it.state && l.name === it.name; }), isB = (d.bills || []).some(function (b) { return b.state === it.state && b.name === it.name; });
      return isL ? 'Law' : isB ? 'Bill' : '?';
    }
    if (tabKey === 'states') {
      if (key === 'lawAuto') return lawStatusOf(r.state, d.laws || []);
      if (key === 'lawsAuto') return String((d.laws || []).filter(function (l) { return l.state === r.state; }).length);
      if (key === 'scoreAuto') { var lv = (ctx.levels || (ctx.levels = stateLevels(d)))[r.state]; return lv ? lv.label : ''; }
      if (key === 'billsAuto') { var y = str(d.config && d.config.site && d.config.site.billYear); return String((d.bills || []).filter(function (b) { return b.state === r.state && b.year === y; }).length); }
    }
    if (tabKey === 'prot' && key === 'live') { var lp = live && live.config && live.config.prot && live.config.prot[r.key]; return lp ? lp.short + (lp.why ? ' · ' + lp.why : '') : ''; }
    if (tabKey === 'words' && key === 'live') {
      if (!live || !live.config) return '';
      var m = /^why\.(\w+)$/.exec(r.key);
      return str(m ? (live.config.why || {})[m[1]] : (live.config.words || {})[r.key]);
    }
    if (tabKey === 'limits' && key === 'usedBy') {
      var n = 0; (d.laws || []).concat(d.bills || []).forEach(function (x) { Object.keys(x.limits || {}).forEach(function (k) { if (x.limits[k] === str(r.code).toLowerCase()) n++; }); });
      return String(n);
    }
    if (tabKey === 'stories' && key === 'id') return r.id || slug(r.t);
    return '';
  }

  /** Row objects -> {values, formulas:[{r,c,f}], notes:[{r,c,note}]} ready to write. extras: [{header, values}] kept columns. */
  function gridOf(tabKey, rows, ctx) {
    ctx = ctx || {};
    var t = TAB[tabKey], pn = ctx.protNames || {}, extras = ctx.extras || [], values = [], formulas = [], notes = [];
    var header = t.cols.map(function (c) { return c.prot ? (pn[c.prot] || PROT_DEFAULT[c.prot]) : c.header; }).concat(extras.map(function (e) { return e.header; }));
    values.push(header);
    var L = {}; t.cols.forEach(function (c, i) { L[c.key] = letter(i); });
    t.cols.forEach(function (c, i) { if (c.formulaHeader) formulas.push({ r: 0, c: i, f: '={"' + c.header + '";ARRAYFORMULA(IF(' + L.text + '2:' + L.text + '="",,LEN(' + L.text + '2:' + L.text + ')))}' }); });
    extras.forEach(function (e, j) { notes.push({ r: 0, c: t.cols.length + j, note: 'Kept from before the upgrade; not published.' + (e.headNote ? '\n\n' + e.headNote : '') }); });
    rows.forEach(function (r, ri) {
      var line = t.cols.map(function (c) {
        if (c.formulaHeader) return '';
        if (c.auto) return autoValue(tabKey, c.key, r, ctx);
        var v = r[c.key];
        return c.type === 'checkbox' ? !!v : str(v);
      });
      extras.forEach(function (e) { var v = e.values[ri]; line.push(v === undefined || v === null ? '' : v); });
      if (tabKey === 'settings' && r.setting === 'Offline message (auto)') { var vi = t.cols.map(function (c) { return c.key; }).indexOf('value'); formulas.push({ r: ri + 1, c: vi, f: '=IFERROR(INDEX(Lists!A:ZZ,2,MATCH("OfflineMessage",Lists!1:1,0)),"")' }); line[vi] = autoOfflineMessage(ctx); }
      values.push(line);
    });
    return { values: values, formulas: formulas, notes: notes, letters: L };
  }
  function autoOfflineMessage(ctx) { var w = (ctx.wordsRows || []).filter(function (r) { return r.key === 'offline.message'; })[0]; return w ? str(w.text) : ''; }
  function startGrid(texts) {
    var rows = (texts && texts.startHere) || [['Face Value: site control sheet', '']], values = [], formulas = [];
    rows.forEach(function (r, i) { var a = str(r[0]), b = r[1] === undefined ? '' : String(r[1]); if (/^=/.test(b)) { formulas.push({ r: i, c: 1, f: b }); b = ''; } values.push([a, b]); });
    return { values: values, formulas: formulas, notes: [] };
  }

  /* ---------- carrying user columns and cell notes from v1 tabs ---------- */
  // The v1 headers the v1 script reads, per tab. Columns past these (fixed tabs) or not in these (Laws, Bills) are the user's own.
  var V1_KNOWN = {
    'Laws': ['State', 'Name', 'Year', 'Status', 'Who it covers (as written)', 'Applies to', 'Only covers footage from', 'Only covers license photos', 'Summary', 'Citation', 'Link', 'Unclear', 'Unclear note', 'Unclear protections', 'Note', 'Ban or pause', 'Ban covers', 'Ban text', 'Ban exceptions', 'Exception to a ban', 'Bars footage from', 'Bar text'],
    'Bills': ['State', 'Name', 'Year', 'Progress', 'Still alive', 'Summary', 'Sponsor', 'Link', 'Note'],
    'States': ['State', 'Law status'], 'Quotes': ['State', 'Law or bill', 'Kind', 'Protection', 'Citation', 'Exact wording'],
    'Protections': ['ID', 'Short name', 'Description'], 'Limits': ['Code', 'Plain words', 'Type'], 'Labels': ['Group', 'Code', 'Shown as'],
    'Stories': ['Title', 'Description', 'State', 'Who searches', 'Photo from', 'Searched against', 'Crime'],
    'Glossary': ['Key', 'Term', 'Definition'], 'Step notes': ['Step', 'Why it matters'], 'Settings': ['Setting', 'Value']
  };
  var V1_FIXED = ['States', 'Quotes', 'Protections', 'Limits', 'Labels', 'Stories', 'Glossary', 'Step notes', 'Settings'];
  var V1_TO_V2 = { 'Laws': 'laws', 'Bills': 'bills', 'Quotes': 'quotes', 'States': 'states', 'Protections': 'prot', 'Limits': 'limits', 'Labels': 'labels', 'Stories': 'stories', 'Glossary': 'glossary', 'Step notes': 'words', 'Settings': 'settings' };
  // v1 headers whose v2 column has a different name (the rest match by header or alias).
  var V1_COL = { 'Laws': { 'Unclear': 'unclear', 'Unclear protections': 'unclearWhich', 'Exception to a ban': 'banRole' },
    'Quotes': { 'State': 'stateAuto', 'Kind': 'kindAuto', 'Exact wording': 'text' }, 'Stories': { 'Title': 't', 'Description': 'd' },
    'Step notes': { 'Step': 'key', 'Why it matters': 'text' } };
  var isDateLike = function (v) { return v !== null && typeof v === 'object' && typeof v.getTime === 'function' && typeof v.getFullYear === 'function'; };
  /** How a v1 body row and a v2 row object are matched. Tabs v1 reads row by row keep their order, so the index is the match. */
  function v1RowId(name, r, i) {
    if (name === 'Protections' || name === 'Glossary') return str(r[0]);
    if (name === 'Limits') return str(r[0]).toLowerCase();
    if (name === 'Labels') return str(r[0]) + '|' + str(r[1]);
    if (name === 'Step notes') return 'why.' + str(r[0]);
    if (name === 'Settings') return norm(str(r[0]).replace(/\s*\(auto\)$/i, ''));
    return '#' + i;
  }
  function v2RowId(key, r, i) {
    if (key === 'prot' || key === 'glossary' || key === 'words') return str(r.key);
    if (key === 'limits') return str(r.code);
    if (key === 'labels') return str(r.group) + '|' + str(r.code);
    if (key === 'settings') return norm(str(r.setting).replace(/\s*\(auto\)$/i, ''));
    return '#' + i;
  }
  /** Which v2 column a known v1 header lands in (null if none). */
  function v2ColOf(name, key, h) {
    var map = V1_COL[name] || {}, t = TAB[key];
    if (map.hasOwnProperty(h)) return map[h];
    var pm = /\((\d)\)\s*$/.exec(h); if (pm) return 'p' + pm[1];
    var n = norm(h), hit = (t.cols || []).filter(function (c) { return [c.header].concat(c.aliases || []).map(norm).indexOf(n) >= 0; })[0];
    return hit ? hit.key : null;
  }
  /**
   * v1tabs: {tab: values} (dates already read as years, as v1 reads them). keep: {tab: {values, display, notes, formulas}} straight from the sheet.
   * Returns extras per v2 tab, cell notes per v2 tab, and report lines. Kept values are the raw cell values; dates are kept as the text shown.
   */
  function carryV1(v1tabs, objs, keep, protNames) {
    var out = { extras: {}, cellNotes: {}, columns: [], notes: { moved: 0, onlyInBackup: 0 }, formulas: 0, orphans: [], heads: [] }, formulaCols = {};
    Object.keys(V1_TO_V2).forEach(function (name) {
      var g = v1tabs[name]; if (!g || !g.length) return;
      var key = V1_TO_V2[name], t = TAB[key], k1 = keep[name] || {}, head = g[0].map(str), known = V1_KNOWN[name];
      var raw = k1.values || g, disp = k1.display || null, notes = k1.notes || null, forms = k1.formulas || null;
      var cell = function (grid, r, c) { return grid && grid[r] ? grid[r][c] : undefined; };
      // Body rows the way v1 reads them (blank rows skipped), with their sheet row index.
      var body = []; g.forEach(function (r, ri) { if (ri && r.some(function (c) { return str(c) !== '' && c !== false; })) body.push({ r: r, ri: ri }); });
      var rowsV2 = objs[key] || [], at = {}; rowsV2.forEach(function (r, i) { var id = v2RowId(key, r, i); if (!at.hasOwnProperty(id)) at[id] = i; });
      var v2Row = function (b, bi) { var id = v1RowId(name, b.r, bi); return at.hasOwnProperty(id) ? at[id] : -1; };
      // The user's own columns.
      var taken = {}; (t.cols || []).forEach(function (c) { [c.header].concat(c.aliases || []).forEach(function (x) { taken[norm(x)] = 1; }); if (c.prot) { taken[norm(PROT_DEFAULT[c.prot])] = 1; if (protNames && protNames[c.prot]) taken[norm(protNames[c.prot])] = 1; } });
      var width = Math.max.apply(null, g.map(function (r) { return r.length; }));
      var mine = [];
      for (var ci = 0; ci < width; ci++) {
        var h = str(head[ci]), isKnown = V1_FIXED.indexOf(name) >= 0 ? ci < known.length : (known.indexOf(h) >= 0 || /\(\d\)\s*$/.test(h));
        if (isKnown) continue;
        var hasData = body.some(function (b) { var v = cell(raw, b.ri, ci); return str(v) !== '' && v !== false; });
        if (!h && !hasData) continue;
        var label = h || 'Column ' + letter(ci), shown = label, n2 = 2;
        if (taken[norm(shown)]) { shown = label + ' (kept)'; while (taken[norm(shown)]) shown = label + ' (kept ' + (n2++) + ')'; }
        taken[norm(shown)] = 1;
        mine.push({ ci: ci, header: shown, from: label });
      }
      var ex = mine.map(function (m) { return { header: m.header, values: rowsV2.map(function () { return ''; }), headNote: str(cell(notes, 0, m.ci)) }; });
      var lost = {};
      body.forEach(function (b, bi) {
        var j = v2Row(b, bi);
        mine.forEach(function (m, mi) {
          var v = cell(raw, b.ri, m.ci); if (v === undefined || v === null || v === '') return;
          if (isDateLike(v)) v = disp ? str(cell(disp, b.ri, m.ci)) : str(v);
          if (j < 0) { if (v !== false) lost[m.from] = (lost[m.from] || 0) + 1; return; }
          var prev = ex[mi].values[j]; ex[mi].values[j] = prev === '' ? v : str(prev) + ' / ' + str(v);
        });
        // Cell notes: on the same row and the matching column.
        head.forEach(function (h, ci) {
          var note = str(cell(notes, b.ri, ci)); if (!note) return;
          var mi = -1; mine.forEach(function (m, x) { if (m.ci === ci) mi = x; });
          var colKey = mi >= 0 ? null : v2ColOf(name, key, str(h)), cIdx = mi >= 0 ? (t.cols || []).length + mi : -1;
          if (colKey) (t.cols || []).forEach(function (c, x) { if (c.key === colKey) cIdx = x; });
          if (j < 0 || cIdx < 0) { out.notes.onlyInBackup++; return; }
          (out.cellNotes[key] = out.cellNotes[key] || []).push({ r: j + 1, c: cIdx, note: note });
          out.notes.moved++;
        });
        head.forEach(function (h, ci) { if (str(cell(forms, b.ri, ci))) { out.formulas++; formulaCols[name + ' › ' + (str(h) || 'Column ' + letter(ci))] = 1; } });
      });
      Object.keys(lost).forEach(function (c) { out.orphans.push(name + ' › ' + c + ': ' + lost[c] + ' value' + (lost[c] > 1 ? 's' : '') + ' on rows the upgrade could not match'); });
      if (ex.length) out.extras[key] = ex;
      mine.forEach(function (m) { out.columns.push(name + ' › ' + m.from + (m.header !== m.from ? ' (now "' + m.header + '")' : '')); });
    });
    if (out.formulas) out.heads.push(out.formulas + ' cell' + (out.formulas > 1 ? 's' : '') + ' held formulas (' + Object.keys(formulaCols).join(', ') + '). The new tabs keep their values; the formulas stay in the hidden "v1 backup:" tabs.');
    if (out.notes.onlyInBackup) out.heads.push(out.notes.onlyInBackup + ' cell note' + (out.notes.onlyInBackup > 1 ? 's have' : ' has') + ' no matching cell in v2. They stay in the hidden "v1 backup:" tabs.');
    out.orphans.forEach(function (o) { out.heads.push(o + '. They stay in the hidden "v1 backup:" tabs.'); });
    return out;
  }

  /** Plan the v1 -> v2 upgrade. Pure: it reads nothing and writes nothing. */
  function planV1toV2(J1, v1tabs, v1settings, opts) {
    opts = opts || {};
    var wordKeys = opts.wordKeys || [], st = settingsFrom(J1, v1settings, opts);
    var objs = toRowsV2(J1, { wordKeys: wordKeys, texts: opts.texts, settingsRows: st.rows, seeds: true });
    var protNames = {}; objs.prot.forEach(function (p) { protNames[p.key] = p.short; });
    // Columns the user added to any v1 tab, plus cell notes, move to the matching v2 rows (see carryV1).
    var carry = carryV1(v1tabs, objs, opts.v1keep || {}, protNames), extras = carry.extras;
    var kept = { columns: carry.columns, tabs: (opts.otherTabs || []).slice(), renamed: (opts.renameTabs || []).slice(), notes: carry.notes, formulas: carry.formulas, orphans: carry.orphans };
    var through = (objs.settings.filter(function (r) { return r.setting === 'Research current through'; })[0] || {}).value;
    var ctx = { json: J1, live: opts.live || null, protNames: protNames, wordsRows: objs.words };
    var grids = {};
    VISIBLE_ORDER.concat(['selftest']).forEach(function (key) {
      if (key === 'start') { grids[TAB.start.name] = startGrid(opts.texts); return; }
      var c = { json: ctx.json, live: ctx.live, protNames: protNames, wordsRows: objs.words, extras: extras[key] || [] };
      if (key === 'bills' || key === 'states') c.json = withSite(J1, objs.settings);
      var g = gridOf(key, objs[key] || [], c);
      (carry.cellNotes[key] || []).forEach(function (n) { g.notes.push(n); });
      grids[TAB[key].name] = g;
    });
    // Read the plan back the way the sheet will be read, and compare.
    var model = readModel(sheetsFromGrids(grids));
    var J2 = build(model, { mode: 'preview', now: opts.now });
    var ae = additiveEqual(J1, J2), contract = oldAppContract(J2);
    var unclear = { whole: 0, every: 0, some: 0 }, roles = [], blocking = [], heads = st.heads.slice();
    (J1.laws || []).forEach(function (l) {
      if (l.review) { var r = objs.laws.filter(function (x) { return x.state === l.state && x.name === l.name; })[0]; unclear[r && /every/.test(r.unclear) ? 'every' : r && /only some/.test(r.unclear) ? 'some' : 'whole']++; }
      if (l.ban) roles.push(l.state + ' · ' + l.name + ': ' + l.ban.kind);
      if (l.banException) roles.push(l.state + ' · ' + l.name + ': Exception');
      if (l.ban && l.banException) blocking.push(l.state + ' · ' + l.name + ' is both a ban and an exception to a ban. Fix it in the old sheet first.');
      if (l.ban && !BAN_ROLE[l.ban.kind]) blocking.push(l.state + ' · ' + l.name + ': ban kind "' + l.ban.kind + '" must be Ban or Pause.');
      if (l.ban && !keyOf(APPLIES, l.ban.who)) blocking.push(l.state + ' · ' + l.name + ': the ban has no "Ban covers" value.');
      if (l.bars && !keyOf(FOOTAGE, l.bars.src)) blocking.push(l.state + ' · ' + l.name + ': the bar has no footage value.');
      PIDS.forEach(function (k) { var v = (l.limits || {})[k]; if ((l.source === 'drone' && v === 'drones only') || (l.source === 'bodycam' && v === 'body cameras only')) heads.push(l.state + ' · ' + l.name + ': the footage limit is said twice (fine as is).'); });
    });
    heads = heads.concat(carry.heads);
    if (!ae.ok) ae.problems.forEach(function (p) { blocking.push('Data check: ' + p); });
    contract.forEach(function (p) { blocking.push(p.msg); });
    var report = {
      rows: { 'Laws': (J1.laws || []).length, 'Bills': (J1.bills || []).length, 'Quotes': (J1.quotes || []).length, 'States': (J1.states || []).length,
        'Protections': Object.keys((J1.config || {}).prot || {}).length, 'Limits': Object.keys((J1.config || {}).limits || {}).length,
        'Labels': objs.labels.length, 'Stories': ((J1.config || {}).stories || []).length, 'Glossary': objs.glossary.length,
        'Step notes → Words why.*': Object.keys((J1.config || {}).why || {}).length, 'Words on the page': objs.words.length },
      conversions: [
        'Unclear: ' + unclear.whole + ' "law as a whole", ' + unclear.every + ' "every protection it adds", ' + unclear.some + ' "only some protections".',
        'Ban, pause or exception: ' + (roles.length ? roles.join('; ') : 'none') + '.',
        (J1.quotes || []).filter(function (q) { return q.rule; }).length + ' numbered quote protections → names.',
        ((J1.config || {}).stories || []).filter(function (s) { return s.who === 'federal'; }).length + ' story → "Federal agent (old site only)".',
        'Research note → template with {date}; Research current through = ' + (through || '(blank)') + '.'
      ],
      dataCheck: ae.ok ? 'Site data = the old data + new fields' + (ae.allowed.length ? '; label change: ' + ae.allowed.join('; ') + ' (no visible change).' : '.') : 'The data check failed (see blocking issues).',
      allowed: ae.allowed, heads: heads, kept: kept, blocking: blocking
    };
    return { grids: grids, objs: objs, report: report, J2: J2, protNames: protNames, extras: extras };
  }
  function withSite(J1, settingsRows) {
    var c = copy(J1); c.config = c.config || {};
    var v = {}; settingsRows.forEach(function (r) { v[r.setting] = r.value; });
    c.config.site = { billYear: str(v['Current bill session']) };
    return c;
  }

  return {
    PIDS: PIDS, PORDER: PORDER, STATE_NAMES: STATE_NAMES, PROT_DEFAULT: PROT_DEFAULT, PROT_WHY: PROT_WHY, EXAMPLE_SEEDS: EXAMPLE_SEEDS,
    APPLIES: APPLIES, FOOTAGE: FOOTAGE, LTYPE: LTYPE, WHO: WHO, SRC: SRC, DB: DB, CRIME: CRIME, BAN_ROLE: BAN_ROLE, UNCLEAR: UNCLEAR, STATUS: STATUS,
    SITE_STATUS: SITE_STATUS, STEPKEYS: STEPKEYS, RELATED: RELATED, V1_TABS: V1_TABS, COLORS: COLORS, DRAFT_NOTE: DRAFT_NOTE,
    SCHEMA: { tabs: TABS, tab: TAB, byName: TAB_BY_NAME, settings: SETTINGS_DEF, visibleOrder: VISIBLE_ORDER, readTabs: READ_TABS },
    str: str, norm: norm, slug: slug, letter: letter, isoDate: isoDate, addMonths: addMonths,
    mapHeaders: mapHeaders, readRows: readRows, readModel: readModel, sheetsFromGrids: sheetsFromGrids,
    build: build, check: check, oldAppContract: oldAppContract, stateLevels: stateLevels, lawStatusOf: lawStatusOf,
    diff: diff, additiveEqual: additiveEqual, stripNew: stripNew, planV1toV2: planV1toV2, toRowsV2: toRowsV2, settingsFrom: settingsFrom,
    gridOf: gridOf, startGrid: startGrid, autoValue: autoValue, listsSpec: listsSpec, cfSpec: cfSpec,
    apDate: apDate, parseApDate: parseApDate, canonical: canonical, hashInput: hashInput, marksProblem: marksProblem, fillsOf: fillsOf, isUrlKey: isUrlKey,
    parseItem: parseItem, cmpVersion: cmpVersion, utf8Length: utf8Length, V1_KNOWN: V1_KNOWN, carryV1: carryV1
  };
})();

/* ======================= 3. FV1: the v1 converter, kept exactly as it was (used only by Upgrade) ======================= */

var FV1 = (function () {
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

/* ======================= 4. Google Sheets side ======================= */

var BACKUP_PREFIX = 'v1 backup: ';
var UNDONE_PREFIX = 'v2 undone: ';
var WORDING_TABS = ['words', 'prot', 'stories', 'glossary'];
var WORDING_EDIT_COLS = { words: ['text'], prot: ['short', 'long', 'why'], stories: ['t', 'd', 'lesson', 'show', 'order', 'state', 'who', 'src', 'db', 'crime'], glossary: ['term', 'def'] };

/* ---------- menus and simple triggers ---------- */
function onOpen() {
  var ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive();
  if (!isV2_(ss)) {
    var m = ui.createMenu('Face Value').addItem('Upgrade this sheet to v2…', 'menuUpgrade');
    if (hasBackups_(ss)) m.addItem('Undo the upgrade…', 'menuUndoUpgrade');
    m.addSeparator().addItem('About this script', 'menuAbout').addToUi();
    return;
  }
  ui.createMenu('Face Value')
    .addItem('Check for problems', 'menuCheck')
    .addItem('Preview changes', 'menuPreview')
    .addItem('Open preview', 'menuOpenPreview')
    .addSeparator()
    .addItem('Deploy to live site…', 'menuDeploy')
    .addItem('Undo last deploy…', 'menuUndoDeploy')
    .addItem('Restore an earlier version…', 'menuRestoreVersion')
    .addSeparator()
    .addSubMenu(ui.createMenu('Wording').addItem('Mark selected rows Approved', 'menuApproveSelected').addItem('Mark selected rows Ready for review', 'menuReadySelected'))
    .addSubMenu(ui.createMenu('Every 6 months').addItem('Start a new refresh checklist', 'menuStartRefresh').addItem('Check links (slow)', 'menuCheckLinks'))
    .addSubMenu(ui.createMenu('Setup').addItem('Check GitHub key', 'menuCheckKey').addItem('Set GitHub key…', 'menuSetKey').addItem('Publish from this sheet', 'menuClaimPublishing')
      .addSeparator().addItem('Upgrade or repair this sheet…', 'menuUpgrade').addItem('Undo the upgrade…', 'menuUndoUpgrade').addItem('Remove upgrade backups…', 'menuRemoveBackups')
      .addSeparator().addItem('About this script', 'menuAbout'))
    .addToUi();
}

/** Simple trigger: keeps wording review honest and keeps Quotes in step with renames. Single cells only. */
function onEdit(e) {
  try {
    if (!e || !e.range || e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;
    var ss = e.source || SpreadsheetApp.getActive(), sh = e.range.getSheet(), key = tabKeyOf_(sh), row = e.range.getRow();
    if (!key || row < 2 || !isV2_(ss)) return;
    var m = headerIdx_(ss, sh, key), col = e.range.getColumn() - 1, colKey = null;
    Object.keys(m).forEach(function (k) { if (m[k] === col) colKey = k; });
    if (!colKey) return;
    var oldV = e.oldValue === undefined ? '' : String(e.oldValue), newV = e.value === undefined ? '' : String(e.value);
    if (WORDING_EDIT_COLS[key] && WORDING_EDIT_COLS[key].indexOf(colKey) >= 0 && m.status !== undefined && oldV !== newV) {
      var st = sh.getRange(row, m.status + 1);
      if (String(st.getValue()) === 'Approved') st.setValue('Ready for review');
    }
    if ((key === 'laws' || key === 'bills') && (colKey === 'state' || colKey === 'name') && oldV && newV && oldV !== newV) {
      var other = String(sh.getRange(row, (colKey === 'state' ? m.name : m.state) + 1).getValue());
      var from = colKey === 'state' ? oldV + ' · ' + other : other + ' · ' + oldV, to = colKey === 'state' ? newV + ' · ' + other : other + ' · ' + newV;
      replaceInColumn_(ss, 'quotes', 'item', from, to);
    }
    if (key === 'prot' && colKey === 'short' && oldV && newV && oldV !== newV) {
      replaceInColumn_(ss, 'quotes', 'prot', oldV, newV);
      ['laws', 'bills'].forEach(function (t) {
        var s2 = fvTab_(ss, t); if (!s2) return;
        s2.getRange(1, 1, 1, s2.getLastColumn()).getValues()[0].forEach(function (h, i) { if (String(h) === oldV) s2.getRange(1, i + 1).setValue(newV); });
      });
    }
  } catch (err) { console.log('onEdit: ' + err); }
}

/* ---------- context and reading ---------- */
function fvNow_() { return new Date(); }
function ctx_() {
  var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone(), now = fvNow_();
  return { ss: ss, tz: tz, now: now, today: Utilities.formatDate(now, tz, 'yyyy-MM-dd'), user: userName_() };
}
function userName_() { var e = ''; try { e = Session.getActiveUser().getEmail(); } catch (x) { e = ''; } return (String(e || '') || 'someone').split('@')[0]; }
function props_() { return PropertiesService.getDocumentProperties(); }
function ghToken_() { return PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'); }

function meta_(holder, key) { var m = holder.getDeveloperMetadata().filter(function (x) { return x.getKey() === key; })[0]; return m ? m.getValue() : null; }
function setMeta_(holder, key, value) {
  var ms = holder.getDeveloperMetadata().filter(function (x) { return x.getKey() === key; });
  ms.slice(1).forEach(function (x) { x.remove(); });
  if (ms.length) { if (ms[0].getValue() === value) return false; ms[0].setValue(value); return true; }
  holder.addDeveloperMetadata(key, value, SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT); return true;
}
function delMeta_(holder, key) { holder.getDeveloperMetadata().forEach(function (x) { if (x.getKey() === key) x.remove(); }); }
function isV2_(ss) { return meta_(ss, 'fv.schema') === String(SCHEMA_VERSION); }
function isFvAside_(name) { return name.indexOf(BACKUP_PREFIX) === 0 || name.indexOf(UNDONE_PREFIX) === 0; }
function hasBackups_(ss) { return ss.getSheets().some(function (s) { return s.getName().indexOf(BACKUP_PREFIX) === 0; }); }
function fvTab_(ss, key) {
  var t = FV.SCHEMA.tab[key], sh = ss.getSheetByName(t.name); if (sh) return sh;
  var found = null;
  ss.getSheets().forEach(function (s) { if (!found && !isFvAside_(s.getName()) && meta_(s, 'fv.tab') === key) found = s; });
  return found;
}
function tabKeyOf_(sh) {
  var name = sh.getName(); if (isFvAside_(name)) return null;
  var t = FV.SCHEMA.byName[name]; if (t) return t.key;
  return meta_(sh, 'fv.tab');
}
function metaByCol_(sh) {
  var out = [];
  sh.createDeveloperMetadataFinder().withKey('fv.col').find().forEach(function (m) {
    var loc = m.getLocation(); if (loc.getLocationType() !== SpreadsheetApp.DeveloperMetadataLocationType.COLUMN) return;
    var c = loc.getColumn().getColumn() - 1; (out[c] = out[c] || []).push(m.getValue());
  });
  return out;
}
function protNames_(ss) {
  var sh = fvTab_(ss, 'prot'), out = {}; if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues(), m = FV.mapHeaders('prot', v[0], metaByCol_(sh), {}).idx;
  if (m.key === undefined || m.short === undefined) return out;
  v.slice(1).forEach(function (r) { var k = String(r[m.key]).trim(); if (FV.PIDS.indexOf(k) >= 0 && String(r[m.short]).trim() && !out[k]) out[k] = String(r[m.short]).trim(); });
  return out;
}
function headerIdx_(ss, sh, key) {
  var w = Math.max(sh.getLastColumn(), 1);
  return FV.mapHeaders(key, sh.getRange(1, 1, 1, w).getValues()[0], metaByCol_(sh), key === 'prot' ? {} : protNames_(ss)).idx;
}
function readSheet_(sh, tz) {
  var rng = sh.getDataRange(), values = rng.getValues(), display = rng.getDisplayValues();
  values = values.map(function (r) { return r.map(function (v) { return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v; }); });
  return { values: values, display: display, metaByCol: metaByCol_(sh) };
}
function readModel_(ss) {
  var tz = ss.getSpreadsheetTimeZone(), sheets = {};
  FV.SCHEMA.readTabs.forEach(function (key) { var sh = fvTab_(ss, key); if (sh) sheets[key] = readSheet_(sh, tz); });
  return FV.readModel(sheets);
}
function settingsOf_(model) {
  var s = model.settings, miss = ['GitHub owner', 'GitHub repo', 'Branch', 'Folder', 'Site address'].filter(function (k) { return !String(s[k] || '').trim(); });
  if (miss.length) throw fvErr_('Settings is missing: ' + miss.join(', ') + '. Fill them in on the Settings tab.', '', 'settings');
  return s;
}

/* ---------- errors and dialogs ---------- */
function fvErr_(msg, details, code) { var e = new Error(msg); e.fv = true; e.details = details || ''; e.code = code || 0; return e; }
function friendlyOf_(e) {
  if (e && e.fv) return { msg: e.message, details: e.details || '' };
  var m = String((e && e.message) || e);
  if (/too many times|quota|Bandwidth|limit exceeded/i.test(m)) return { msg: "Google's daily limit for this script was reached. Try again tomorrow.", details: m };
  if (/timed out|timeout|Address unavailable|DNS error|unable to connect/i.test(m)) return { msg: 'GitHub is having problems. Try again in a few minutes.', details: m };
  return { msg: 'Something went wrong: ' + m, details: String((e && e.stack) || '') };
}
function run_(label, logIt, fn) {
  try { return fn(); } catch (e) {
    var f = friendlyOf_(e);
    showMessage_(label + ': it did not work', f.msg, f.details);
    if (logIt) { try { log_(ctx_(), label, f.msg, f.details, '', '', '', 'Failed: ' + f.msg); } catch (x) { /* the log is optional here */ } }
    return { ok: false, error: f.msg, details: f.details };
  }
}
function withLock_(fn) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) throw fvErr_('Someone else is publishing right now. Try again in a minute.', '', 'lock');
  try { return fn(); } finally { lock.releaseLock(); }
}
function esc_(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
var CSS_ = '<style>body{font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#0C2340;margin:0;padding:4px 2px}' +
  'h3{font-size:15px;margin:14px 0 6px}ul{margin:4px 0 8px 18px;padding:0}li{margin:2px 0}.muted{color:#5A6275}.err{color:#9B1C1C}.box{border:2px solid #0C2340;padding:8px 10px;margin:8px 0;box-shadow:4px 4px 0 #0C2340}' +
  'button{font:inherit;font-weight:600;padding:6px 14px;margin:8px 8px 0 0;border:2px solid #0C2340;background:#fff;color:#0C2340;box-shadow:3px 3px 0 #0C2340;cursor:pointer;border-radius:0}' +
  'button.primary{background:#1F5BB8;color:#fff}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #1F5BB8;outline-offset:2px}button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #0C2340}' +
  'a{color:#1F5BB8;text-decoration:none;border:1px solid #1F5BB8;padding:0 4px}input{font:inherit;width:96%;padding:4px;border:2px solid #0C2340}pre{white-space:pre-wrap;font-size:12px}</style>';
var FOLD_JS_ = '<script>function fvFold(id,b){var e=document.getElementById(id);var open=e.hidden;e.hidden=!open;b.setAttribute("aria-expanded",open?"true":"false");}</script>';
function fold_(id, label, inner) { return '<button type="button" aria-expanded="false" aria-controls="' + id + '" onclick="fvFold(\'' + id + '\',this)">' + esc_(label) + '</button><div id="' + id + '" hidden>' + inner + '</div>'; }
function dialog_(html, title, w, h) { SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(CSS_ + FOLD_JS_ + html).setWidth(w || 620).setHeight(h || 440), title); }
function showMessage_(title, msg, details) {
  dialog_('<p>' + esc_(msg) + '</p>' + (details ? fold_('det', 'Details', '<pre>' + esc_(details) + '</pre>') : '') + '<div><button class="primary" onclick="google.script.host.close()">Close</button></div>', title, 520, details ? 320 : 200);
}
function showProblems_(probs, title) {
  var groups = [['E', 'Errors (fix these before publishing)'], ['W', 'Heads-ups'], ['I', 'Notes']], html = '';
  var n = probs.filter(function (p) { return p.sev === 'E'; }).length;
  html += '<p><b>' + (n ? n + ' error' + (n > 1 ? 's' : '') + ' to fix.' : 'No errors.') + '</b> ' + probs.filter(function (p) { return p.sev === 'W'; }).length + ' heads-ups.</p>';
  groups.forEach(function (g, gi) {
    var list = probs.filter(function (p) { return p.sev === g[0]; }); if (!list.length) return;
    var items = '<ul>' + list.slice(0, 300).map(function (p) {
      var go = p.tabKey && p.row ? ' <a href="#" onclick="google.script.run.goTo(\'' + esc_(p.tabKey) + '\',' + p.row + ',\'' + esc_(p.colKey) + '\');return false;">Go to</a>' : '';
      return '<li><b>' + esc_(p.id) + '</b> ' + esc_(p.tab) + (p.row ? ' row ' + p.row : '') + (p.col ? ' · ' + esc_(p.col) : '') + ': ' + esc_(p.msg) + (p.fix ? ' <span class="muted">' + esc_(p.fix) + '</span>' : '') + go + '</li>';
    }).join('') + (list.length > 300 ? '<li>…and ' + (list.length - 300) + ' more</li>' : '') + '</ul>';
    html += '<h3>' + g[1] + ' (' + list.length + ')</h3>' + (g[0] === 'I' ? fold_('f' + gi, 'Show notes', items) : items);
  });
  dialog_(html, title || 'Face Value check', 720, 520);
}
/** Called from the problems dialog. */
function goTo(tabKey, row, colKey) {
  var ss = SpreadsheetApp.getActive(), sh = FV.SCHEMA.tab[tabKey] ? fvTab_(ss, tabKey) : null; if (!sh) return;
  var m = headerIdx_(ss, sh, tabKey), col = m[colKey] !== undefined ? m[colKey] + 1 : 1;
  ss.setActiveSheet(sh); sh.getRange(row || 1, col).activate();
}

/* ---------- the Change log and Settings ---------- */
function log_(c, action, summary, details, commit, fileSha, replacedSha, result) {
  var sh = fvTab_(c.ss, 'changelog'); if (!sh) return;
  var row = [Utilities.formatDate(c.now, c.tz, 'yyyy-MM-dd HH:mm'), action, c.user, String(summary || '').slice(0, 1000), String(details || '').slice(0, 45000), commit || '', fileSha || '', replacedSha || '', result || ''];
  sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, 1, row.length).setValues([row]);
}
function changeLog_(ss) {
  var sh = fvTab_(ss, 'changelog'); if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), m = FV.mapHeaders('changelog', v[0], null, {}).idx;
  return v.slice(1).map(function (r, i) { var o = { _row: i + 2 }; Object.keys(m).forEach(function (k) { o[k] = String(r[m[k]] === undefined ? '' : r[m[k]]); }); return o; });
}
function setSetting_(ss, name, value) {
  var sh = fvTab_(ss, 'settings'); if (!sh) return;
  var v = sh.getDataRange().getValues(), want = FV.norm(name);
  for (var i = 1; i < v.length; i++) if (FV.norm(v[i][0]) === want) { if (String(v[i][1]) !== String(value)) sh.getRange(i + 1, 2).setValue(value); return; }
  sh.getRange(v.length + 1, 1, 1, 2).setValues([[name, value]]);
}
function stamp_(c) { return Utilities.formatDate(c.now, c.tz, 'yyyy-MM-dd HH:mm') + ' · ' + c.user; }

/* ---------- GitHub ---------- */
var GH_LAST_EXPIRY_ = '';
function repoPath_(s) { return '/repos/' + encodeURIComponent(s['GitHub owner']) + '/' + encodeURIComponent(s['GitHub repo']); }
function filePath_(s, rel) { var f = String(s['Folder'] || '').replace(/^\/+|\/+$/g, ''); return (f ? f + '/' : '') + rel; }
function contentsPath_(s, rel) { return repoPath_(s) + '/contents/' + filePath_(s, rel).split('/').map(encodeURIComponent).join('/'); }
function header_(r, name) { var h = r.headers || {}, k = Object.keys(h).filter(function (x) { return x.toLowerCase() === name.toLowerCase(); })[0]; return k ? String(h[k]) : ''; }
/** One GitHub API call. Retries 5xx and network errors 3 times with backoff. Returns {code, text, json, headers}. */
function ghFetch_(token, method, path, body) {
  var last = null;
  for (var attempt = 0; attempt < 4; attempt++) {
    if (attempt) Utilities.sleep(500 * Math.pow(2, attempt));
    var res;
    try {
      res = UrlFetchApp.fetch('https://api.github.com' + path, { method: method, muteHttpExceptions: true, contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        payload: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      if (/too many times|quota|Bandwidth/i.test(String(e.message))) throw e;
      last = { code: 0, text: String(e.message), json: null, headers: {} }; continue;
    }
    var r = { code: res.getResponseCode(), text: res.getContentText(), json: null, headers: res.getAllHeaders ? res.getAllHeaders() : res.getHeaders() };
    try { r.json = r.text ? JSON.parse(r.text) : null; } catch (x) { r.json = null; }
    var exp = header_(r, 'github-authentication-token-expiration'); if (exp) GH_LAST_EXPIRY_ = exp;
    if (r.code >= 500 && attempt < 3) { last = r; continue; }
    return r;
  }
  return last;
}
function gh_(s, method, path, body) {
  var t = ghToken_(); if (!t) throw fvErr_('No GitHub key yet. Use Face Value › Setup › Set GitHub key.', '', 'nokey');
  return ghFetch_(t, method, path, body);
}
function friendlyCode_(s, r) {
  var c = r.code;
  if (c === 401) return 'The GitHub key is wrong or has expired. Use Face Value › Setup › Set GitHub key.';
  if (c === 403 && (header_(r, 'x-ratelimit-remaining') === '0' || /rate limit/i.test(r.text))) return "GitHub's rate limit was reached. Try again in an hour.";
  if (c === 403) return "The GitHub key can't write here. It needs Contents: Read and write on " + s['GitHub owner'] + '/' + s['GitHub repo'] + '.';
  if (c === 404) return 'GitHub could not find the file ' + filePath_(s, '…') + '. Check Settings › Folder.';
  if (c === 409) return 'Someone else changed the file at the same moment. Press the menu item again.';
  if (c === 422) return 'GitHub refused the file. It may be too big, or the branch is protected.';
  return 'GitHub is having problems. Try again in a few minutes.';
}
function ghFail_(s, r) { throw fvErr_(friendlyCode_(s, r), 'GitHub said ' + r.code + ': ' + String(r.text || '').slice(0, 500), r.code); }
function probe404_(s) {
  var r = gh_(s, 'get', repoPath_(s));
  if (r.code === 404) throw fvErr_('GitHub has no repository ' + s['GitHub owner'] + '/' + s['GitHub repo'] + ' that this key can see. Check Settings › GitHub owner and GitHub repo.', 'GitHub said 404', 404);
  if (r.code !== 200) ghFail_(s, r);
  r = gh_(s, 'get', repoPath_(s) + '/branches/' + encodeURIComponent(s['Branch']));
  if (r.code === 404) throw fvErr_('The branch "' + s['Branch'] + '" does not exist. Check Settings › Branch.', 'GitHub said 404', 404);
  if (r.code !== 200) ghFail_(s, r);
}
function b64decode_(c) { return Utilities.newBlob(Utilities.base64Decode(String(c).replace(/\s/g, ''))).getDataAsString('UTF-8'); }
function ghGetFile_(s, rel, ref) {
  var r = gh_(s, 'get', contentsPath_(s, rel) + '?ref=' + encodeURIComponent(ref || s['Branch']));
  if (r.code === 404) { probe404_(s); return null; }
  if (r.code !== 200 || !r.json) ghFail_(s, r);
  var text = r.json.encoding === 'base64' && r.json.content ? b64decode_(r.json.content) : ghGetBlob_(s, r.json.sha);
  return { sha: r.json.sha, text: text };
}
function ghGetBlob_(s, sha) {
  var r = gh_(s, 'get', repoPath_(s) + '/git/blobs/' + encodeURIComponent(sha));
  if (r.code !== 200 || !r.json) ghFail_(s, r);
  return b64decode_(r.json.content);
}
function ghPutFile_(s, rel, text, message, sha) {
  var body = { message: String(message).replace(/@/g, ' at '), content: Utilities.base64Encode(text, Utilities.Charset.UTF_8), branch: s['Branch'] };
  if (sha) body.sha = sha;
  return gh_(s, 'put', contentsPath_(s, rel), body);
}
function ghCommits_(s, rel) {
  var r = gh_(s, 'get', repoPath_(s) + '/commits?path=' + encodeURIComponent(filePath_(s, rel)) + '&sha=' + encodeURIComponent(s['Branch']) + '&per_page=10');
  if (r.code !== 200) ghFail_(s, r);
  return r.json || [];
}
function fetchLive_(s) {
  var f = ghGetFile_(s, 'data/live.json'); if (!f) return null;
  try { f.json = JSON.parse(f.text); } catch (e) { throw fvErr_('The live site file (data/live.json) is not valid JSON. Use Undo last deploy or Restore.', String(e.message)); }
  return f;
}
function putRetry_(s, rel, text, message) {
  var cur = ghGetFile_(s, rel);
  for (var i = 0; i < 4; i++) {
    var r = ghPutFile_(s, rel, text, message, cur && cur.sha);
    if (r.code === 200 || r.code === 201) return { json: r.json, replaced: cur ? cur.sha : '' };
    if (r.code === 409 && i < 3) { cur = ghGetFile_(s, rel); continue; }
    ghFail_(s, r);
  }
}
function sha256_(text) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
}
function commitMsg_(title, d, j) {
  var counts = (j.laws || []).length + ' laws, ' + (j.bills || []).length + ' bills, ' + (j.quotes || []).length + ' quotes.';
  return (title + '\n\n' + counts + '\n' + (d ? d.summary.join('\n') : '')).replace(/@/g, ' at ');
}
function commitUrl_(j) { return (j && j.commit && j.commit.html_url) || ''; }
function expiryNote_(today) {
  if (!GH_LAST_EXPIRY_) return '';
  var d = String(GH_LAST_EXPIRY_).slice(0, 10);
  return FV.isoDate(d) && d <= FV.addMonths(today, 1) ? 'The GitHub key expires on ' + d + '. Make a new one soon (Setup › Set GitHub key).' : '';
}
function branchVersion_(s) {
  try { var f = ghGetFile_(s, 'sheet/Code.gs'); var m = f && /FV_VERSION\s*=\s*'([\d.]+)'/.exec(f.text); return m ? m[1] : null; } catch (e) { return null; }
}

/* ---------- Check ---------- */
function checkOpts_(c, model, live, lv, forPublish, branchV) {
  return { today: c.today, live: live ? live.json : null, lv: lv, wordKeys: WORD_KEYS, schema: meta_(c.ss, 'fv.schema') || 1, sheetId: c.ss.getId(), forPublish: !!forPublish, branchVersion: branchV || null };
}
function runCheck_(c, wantLive) {
  var model = readModel_(c.ss), live = null, note = '', bv = null;
  if (wantLive && ghToken_()) {
    try { var s = settingsOf_(model); live = fetchLive_(s); bv = branchVersion_(s); } catch (e) { note = friendlyOf_(e).msg; }
  }
  var pv = FV.build(model, { mode: 'preview', live: live && live.json, now: c.now });
  var lv = FV.build(model, { mode: 'live', live: live && live.json, now: c.now });
  var probs = FV.check(model, pv, checkOpts_(c, model, live, lv, false, bv));
  if (note) probs.push({ id: 'X3', sev: 'I', tab: 'GitHub', tabKey: '', row: null, col: '', colKey: '', msg: 'Could not read the live site: ' + note, fix: '' });
  return { model: model, live: live, pv: pv, lv: lv, problems: probs };
}
function menuCheck() {
  return run_('Check', false, function () {
    var c = ctx_(), r = runCheck_(c, true);
    refreshComputed_(c, r.model, r.pv, r.live && r.live.json);
    writeCheckResults_(c.ss, r.problems);
    showProblems_(r.problems, 'Face Value check');
    return { ok: !r.problems.some(function (p) { return p.sev === 'E'; }), problems: r.problems };
  });
}
function writeCheckResults_(ss, probs) {
  var sh = fvTab_(ss, 'selftest'); if (!sh) return;
  var rows = [['Check', 'ID', 'Severity', 'Tab', 'Row', 'Message']].concat(probs.slice(0, 2000).map(function (p) { return ['Check', p.id, p.sev, p.tab, p.row || '', p.msg]; }));
  var maxR = sh.getMaxRows(); if (maxR < rows.length) sh.insertRowsAfter(maxR, rows.length - maxR);
  sh.getRange(1, 9, sh.getMaxRows(), 6).clearContent();
  sh.getRange(1, 9, rows.length, 6).setValues(rows);
}

/* ---------- Preview ---------- */
function menuPreview() {
  return run_('Preview', true, function () {
    return withLock_(function () {
      var c = ctx_(), model = readModel_(c.ss), s = settingsOf_(model), live = fetchLive_(s);
      var pv = FV.build(model, { mode: 'preview', live: live && live.json, now: c.now }), lv = FV.build(model, { mode: 'live', live: live && live.json, now: c.now });
      var probs = FV.check(model, pv, checkOpts_(c, model, live, lv, true, branchVersion_(s))).concat(FV.oldAppContract(lv));
      refreshComputed_(c, model, pv, live && live.json);
      if (probs.some(function (p) { return p.sev === 'E'; })) { showProblems_(probs, 'Preview stopped: fix the errors first'); return { ok: false, problems: probs }; }
      var d = FV.diff(live && live.json, pv), dl = FV.diff(live && live.json, lv), drafts = FV.diff(lv, pv);
      var res = putRetry_(s, 'data/preview.json', JSON.stringify(pv, null, 1), commitMsg_('Face Value: preview from the sheet', d, pv));
      var h = sha256_(FV.hashInput(lv));
      props_().setProperty('previewLiveHash', h);
      log_(c, 'Preview', 'Preview differs from live: ' + d.summary.join('; '), d.details.join('\n'), commitUrl_(res.json), res.json && res.json.content ? res.json.content.sha : '', res.replaced, 'OK');
      setSetting_(c.ss, 'Last preview (auto)', stamp_(c));
      var html = '<p>The preview is published. It shows up in about a minute.</p>' + previewLinks_(s) +
        '<h3>If you deploy now</h3><ul>' + dl.summary.map(function (x) { return '<li>' + esc_(x) + '</li>'; }).join('') + '</ul>' +
        (drafts.count ? '<p>' + drafts.count + ' wording change' + (drafts.count > 1 ? 's are' : ' is') + ' still waiting for approval and will not go live.</p>' : '') +
        (expiryNote_(c.today) ? '<p class="err">' + esc_(expiryNote_(c.today)) + '</p>' : '') +
        '<button class="primary" onclick="google.script.host.close()">Close</button>';
      dialog_(html, 'Face Value preview', 560, 420);
      return { ok: true, hash: h, diff: d, liveDiff: dl, drafts: drafts.count };
    });
  });
}
function previewLinks_(s) {
  var site = String(s['Site address'] || ''), np = String(s['New page address'] || '');
  return '<p><a href="' + esc_(site + '?preview') + '" target="_blank" rel="noopener">Old site preview</a>' + (np ? ' <a href="' + esc_(np + (np.indexOf('?') >= 0 ? '&' : '?') + 'preview') + '" target="_blank" rel="noopener">New page preview</a>' : '') + '</p>';
}
function menuOpenPreview() {
  return run_('Open preview', false, function () {
    var s = settingsOf_(readModel_(SpreadsheetApp.getActive()));
    dialog_('<p>The preview shows the last time someone pressed Preview changes.</p>' + previewLinks_(s) + '<button class="primary" onclick="google.script.host.close()">Close</button>', 'Face Value preview', 480, 200);
    return { ok: true };
  });
}

/* ---------- Deploy ---------- */
function prepareDeploy_(c) {
  var model = readModel_(c.ss), s = settingsOf_(model), live = fetchLive_(s);
  var lv = FV.build(model, { mode: 'live', live: live && live.json, now: c.now }), pv = FV.build(model, { mode: 'preview', live: live && live.json, now: c.now });
  var probs = FV.check(model, pv, checkOpts_(c, model, live, lv, true)).concat(FV.oldAppContract(lv));
  if (probs.some(function (p) { return p.sev === 'E'; })) return { ok: false, problems: probs, msg: 'Fix the errors first (Check for problems).' };
  var h = sha256_(FV.hashInput(lv));
  if (h !== props_().getProperty('previewLiveHash')) return { ok: false, msg: 'The sheet (or the live site) changed since the last preview. Press Preview, look, then Deploy.' };
  if (live && FV.hashInput(live.json) === FV.hashInput(lv)) return { ok: false, msg: 'Nothing to deploy. The live site already matches the sheet.' };
  var d = FV.diff(live && live.json, lv), drafts = FV.diff(lv, pv);
  return { ok: true, s: s, live: live, lv: lv, diff: d, drafts: drafts, warnings: probs.filter(function (p) { return p.sev === 'W'; }), token: sha256_((live ? live.sha : 'none') + '|' + h) };
}
function deployDialog_(p, lead) {
  var html = (lead ? '<p class="err">' + esc_(lead) + '</p>' : '') + '<p>This changes the live site at ' + esc_(p.s['Site address']) + '.</p>' +
    (p.diff.map.length ? '<h3>Map changes</h3><ul>' + p.diff.map.map(function (x) { return '<li>' + esc_(x) + '</li>'; }).join('') + '</ul>' : '<p>No map changes.</p>') +
    '<h3>All changes</h3><ul>' + p.diff.summary.map(function (x) { return '<li>' + esc_(x) + '</li>'; }).join('') + '</ul>' +
    fold_('dd', 'Show every change', '<pre>' + esc_(p.diff.details.join('\n')) + '</pre>') +
    (p.drafts.count ? '<p>' + p.drafts.count + ' wording change' + (p.drafts.count > 1 ? 's stay' : ' stays') + ' in draft and will not go live.</p>' : '') +
    (p.warnings.length ? '<p class="muted">' + p.warnings.length + ' heads-ups from the check.</p>' : '') +
    '<div><button class="primary" id="go" data-token="' + esc_(p.token) + '" onclick="this.disabled=true;google.script.run.withSuccessHandler(function(){google.script.host.close();}).deployConfirmed(\'' + esc_(p.token) + '\')">Deploy now</button>' +
    '<button onclick="google.script.host.close()">Cancel</button></div>';
  dialog_(html, 'Deploy to the live site', 640, 480);
}
function menuDeploy() {
  return run_('Deploy', true, function () {
    return withLock_(function () {
      var c = ctx_(), model = readModel_(c.ss);
      var guard = FV.check(model, null, { sheetId: c.ss.getId(), forPublish: true, today: c.today }).filter(function (x) { return x.id === 'S8'; });
      if (guard.length) { showMessage_('Deploy', guard[0].msg + ' ' + guard[0].fix); return { ok: false, msg: guard[0].msg }; }
      var p = prepareDeploy_(c);
      if (!p.ok) { if (p.problems) showProblems_(p.problems, 'Deploy stopped'); else showMessage_('Deploy', p.msg); return p; }
      deployDialog_(p, expiryNote_(c.today));
      return { ok: true, token: p.token, diff: p.diff };
    });
  });
}
/** Called from the Deploy dialog. */
function deployConfirmed(token) {
  return run_('Deploy', true, function () {
    return withLock_(function () {
      var c = ctx_(), p = prepareDeploy_(c);
      if (!p.ok) { showMessage_('Deploy', p.msg || 'Fix the errors first.'); return p; }
      if (p.token !== token) { deployDialog_(p, 'The live site or the sheet changed since you opened this. Here is the new list of changes.'); return { ok: false, again: true, token: p.token }; }
      var text = JSON.stringify(p.lv, null, 1), r = ghPutFile_(p.s, 'data/live.json', text, commitMsg_('Face Value: deploy from the sheet', p.diff, p.lv), p.live && p.live.sha);
      if (r.code === 409) {
        var cur = fetchLive_(p.s);
        if (cur && FV.hashInput(cur.json) === FV.hashInput(p.lv)) { log_(c, 'Deploy', 'Already live (someone deployed the same data).', '', '', cur.sha, '', 'OK'); return { ok: true, already: true }; }
        var p2 = prepareDeploy_(c);
        if (!p2.ok) { showMessage_('Deploy', p2.msg || 'Fix the errors first.'); return p2; }
        deployDialog_(p2, 'Someone else deployed at the same moment. Here is the new list of changes.');
        return { ok: false, again: true, token: p2.token };
      }
      if (r.code !== 200 && r.code !== 201) ghFail_(p.s, r);
      var newSha = r.json && r.json.content ? r.json.content.sha : '';
      log_(c, 'Deploy', p.diff.summary.join('; '), p.diff.details.join('\n'), commitUrl_(r.json), newSha, p.live ? p.live.sha : '', 'OK');
      setSetting_(c.ss, 'Last deploy (auto)', stamp_(c));
      refreshComputed_(c, readModel_(c.ss), FV.build(readModel_(c.ss), { mode: 'preview', live: p.lv, now: c.now }), p.lv);
      var shown = pollLive_(p.s, p.lv.updated);
      showMessage_('Deployed', shown ? 'Live now: ' + p.s['Site address'] : 'Deployed. GitHub is still building; check the site in a minute.');
      return { ok: true, sha: newSha, live: shown };
    });
  });
}
function pollLive_(s, updated) {
  for (var i = 0; i < 9; i++) {
    try {
      var res = UrlFetchApp.fetch(String(s['Site address']) + 'data/live.json?t=' + fvNow_().getTime() + i, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200 && JSON.parse(res.getContentText()).updated === updated) return true;
    } catch (e) { /* keep polling */ }
    Utilities.sleep(10000);
  }
  return false;
}

/* ---------- Undo last deploy / Restore ---------- */
function menuUndoDeploy() {
  return run_('Undo', true, function () {
    return withLock_(function () {
      var c = ctx_(), s = settingsOf_(readModel_(c.ss)), cur = fetchLive_(s);
      if (!cur) throw fvErr_('There is no live file to undo.');
      var rows = changeLog_(c.ss).filter(function (r) { return ['Deploy', 'Undo', 'Restore'].indexOf(r.action) >= 0 && /^OK/.test(r.result) && r.replacedSha; });
      var target = rows.length ? { blob: rows[rows.length - 1].replacedSha, label: 'the version from before the last ' + rows[rows.length - 1].action.toLowerCase() } : null;
      if (!target) {
        var commits = ghCommits_(s, 'data/live.json');
        if (commits.length < 2) throw fvErr_('There is no earlier version to go back to.');
        target = { commit: commits[1].sha, label: 'the version from ' + String(((commits[1].commit || {}).committer || {}).date || '').slice(0, 10) };
      }
      return prepareRestore_(c, s, cur, target, 'Undo');
    });
  });
}
function menuRestoreVersion() {
  return run_('Restore', false, function () {
    var c = ctx_(), s = settingsOf_(readModel_(c.ss)), items = [];
    changeLog_(c.ss).filter(function (r) { return ['Deploy', 'Undo', 'Restore'].indexOf(r.action) >= 0 && r.fileSha; }).slice(-10).reverse()
      .forEach(function (r) { items.push({ ref: 'blob:' + r.fileSha, label: r.when + ' · ' + r.action + ' · ' + r.summary.slice(0, 80) }); });
    ghCommits_(s, 'data/live.json').forEach(function (k) { items.push({ ref: 'commit:' + k.sha, label: String(((k.commit || {}).committer || {}).date || '').slice(0, 16) + ' · ' + String((k.commit || {}).message || '').split('\n')[0] }); });
    var html = '<p>Pick a version of the live site to put back. You will see the changes before anything happens.</p><ul>' + items.slice(0, 20).map(function (it) {
      return '<li>' + esc_(it.label) + ' <button onclick="google.script.run.restoreConfirmed(\'' + esc_(it.ref) + '\')">Choose</button></li>';
    }).join('') + '</ul><button onclick="google.script.host.close()">Cancel</button>';
    dialog_(html, 'Restore an earlier version', 640, 480);
    return { ok: true, items: items };
  });
}
/** Called from the Restore dialog: shows the diff for the chosen version. */
function restoreConfirmed(ref) {
  return run_('Restore', true, function () {
    return withLock_(function () {
      var c = ctx_(), s = settingsOf_(readModel_(c.ss)), cur = fetchLive_(s), m = /^(blob|commit):(.+)$/.exec(String(ref));
      if (!m || !cur) throw fvErr_('That version could not be read.');
      return prepareRestore_(c, s, cur, m[1] === 'blob' ? { blob: m[2], label: 'the chosen version' } : { commit: m[2], label: 'the chosen version' }, 'Restore');
    });
  });
}
function restoreText_(s, target) { return target.blob ? ghGetBlob_(s, target.blob) : ghGetFile_(s, 'data/live.json', target.commit).text; }
function prepareRestore_(c, s, cur, target, action) {
  var text = restoreText_(s, target), json;
  try { json = JSON.parse(text); } catch (e) { throw fvErr_('That version is not valid site data.', String(e.message)); }
  var bad = FV.oldAppContract(json);
  if (bad.length) throw fvErr_('That version would break the old site, so it was not restored.', bad.map(function (b) { return b.msg; }).join('\n'));
  var d = FV.diff(cur.json, json), token = sha256_(cur.sha + '|' + JSON.stringify(target) + '|' + action);
  props_().setProperty('pendingRestore', JSON.stringify({ token: token, target: target, curSha: cur.sha, action: action }));
  dialog_('<p>This puts back ' + esc_(target.label) + ' on the live site. The sheet still has the newer edits.</p>' +
    '<h3>Changes on the live site</h3><ul>' + d.summary.map(function (x) { return '<li>' + esc_(x) + '</li>'; }).join('') + '</ul>' +
    fold_('ud', 'Show every change', '<pre>' + esc_(d.details.join('\n')) + '</pre>') +
    '<div><button class="primary" data-token="' + esc_(token) + '" onclick="this.disabled=true;google.script.run.withSuccessHandler(function(){google.script.host.close();}).undoConfirmed(\'' + esc_(token) + '\')">' + (action === 'Undo' ? 'Undo now' : 'Restore now') + '</button>' +
    '<button onclick="google.script.host.close()">Cancel</button></div>', action === 'Undo' ? 'Undo last deploy' : 'Restore an earlier version', 620, 440);
  return { ok: true, token: token, diff: d };
}
/** Called from the Undo/Restore dialog. */
function undoConfirmed(token) {
  return run_('Undo', true, function () {
    return withLock_(function () {
      var c = ctx_(), pend = JSON.parse(props_().getProperty('pendingRestore') || 'null');
      if (!pend || pend.token !== token) throw fvErr_('This confirmation has expired. Start again from the menu.');
      var s = settingsOf_(readModel_(c.ss)), cur = fetchLive_(s);
      if (!cur || cur.sha !== pend.curSha) throw fvErr_('The live site changed since you opened this. Start again from the menu.');
      var text = restoreText_(s, pend.target);
      var r = ghPutFile_(s, 'data/live.json', text, (pend.action === 'Undo' ? 'Face Value: undo the last deploy' : 'Face Value: restore an earlier version') + '\n\nPut back by the sheet.', cur.sha);
      if (r.code === 409) {
        var now = fetchLive_(s);
        if (!(now && now.text === text)) throw fvErr_('Someone else changed the live site at the same moment. Start again from the menu.', 'GitHub said 409', 409);
        r = { code: 200, json: { content: { sha: now.sha } } };
      } else if (r.code !== 200 && r.code !== 201) ghFail_(s, r);
      props_().deleteProperty('pendingRestore');
      var newSha = r.json && r.json.content ? r.json.content.sha : '';
      log_(c, pend.action, 'Put back ' + pend.target.label + '.', '', commitUrl_(r.json), newSha, cur.sha, 'OK');
      setSetting_(c.ss, 'Last deploy (auto)', stamp_(c) + ' (' + pend.action.toLowerCase() + ')');
      props_().deleteProperty('previewLiveHash');
      showMessage_(pend.action, 'Done. The live site updates in about a minute. Press Undo last deploy again to go forward.');
      return { ok: true, sha: newSha };
    });
  });
}

/* ---------- GitHub key ---------- */
/** Reads the key's owner and expiry, checks repo, branch and file, and proves write access by creating one tiny unreferenced blob. No commit. */
function checkKey_(token, s) {
  var out = { ok: false, login: '', expires: '', protected: false, msg: '' }, r;
  var fail = function (r2, what) { out.msg = what + ': ' + friendlyCode_(s, r2); out.code = r2.code; return out; };
  r = ghFetch_(token, 'get', '/user'); if (r.code !== 200) return fail(r, 'Key');
  out.login = r.json.login; out.expires = String(header_(r, 'github-authentication-token-expiration')).slice(0, 10);
  r = ghFetch_(token, 'get', repoPath_(s)); if (r.code !== 200) return fail(r, 'Repository ' + s['GitHub owner'] + '/' + s['GitHub repo']);
  r = ghFetch_(token, 'get', repoPath_(s) + '/branches/' + encodeURIComponent(s['Branch'])); if (r.code !== 200) return fail(r, 'Branch ' + s['Branch']);
  out.protected = !!(r.json && r.json.protected);
  r = ghFetch_(token, 'get', contentsPath_(s, 'data/live.json') + '?ref=' + encodeURIComponent(s['Branch'])); if (r.code !== 200 && r.code !== 404) return fail(r, 'Site file');
  r = ghFetch_(token, 'post', repoPath_(s) + '/git/blobs', { content: 'Face Value key check', encoding: 'utf-8' }); if (r.code !== 201) return fail(r, 'Write access');
  out.ok = true;
  out.msg = 'OK · owner ' + out.login + (out.expires ? ' · expires ' + out.expires : ' · no expiry date') + (out.protected ? ' · branch is protected; direct writes may be refused' : '');
  return out;
}
function menuCheckKey() {
  return run_('Check GitHub key', false, function () {
    var c = ctx_(), s = settingsOf_(readModel_(c.ss)), t = ghToken_();
    if (!t) { showMessage_('GitHub key', 'No GitHub key yet. Use Setup › Set GitHub key.'); return { ok: false }; }
    var k = checkKey_(t, s);
    setSetting_(c.ss, 'GitHub key (auto)', (k.ok ? k.msg : 'Failed: ' + k.msg) + ' · checked ' + c.today);
    showMessage_('GitHub key', k.ok ? 'The key works. ' + k.msg : k.msg);
    return k;
  });
}
function menuSetKey() {
  return run_('Set GitHub key', false, function () {
    var ui = SpreadsheetApp.getUi(), c = ctx_(), s = settingsOf_(readModel_(c.ss));
    var r = ui.prompt('GitHub key', 'Paste a fine-grained GitHub key with Contents: Read and write on this one repository. It is stored with the script, never in a cell.', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK || !String(r.getResponseText()).trim()) return { ok: false };
    var t = String(r.getResponseText()).trim(), k = checkKey_(t, s);
    if (!k.ok) { showMessage_('GitHub key', 'The new key did not pass the check, so the old key is kept. ' + k.msg); return k; }
    PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', t);
    setSetting_(c.ss, 'GitHub key (auto)', k.msg + ' · checked ' + c.today);
    showMessage_('GitHub key', 'Key saved. ' + k.msg);
    return k;
  });
}

/* ---------- writing tabs ---------- */
function numFmt_(c) { return c.type === 'date' ? 'yyyy-mm-dd' : c.type === 'checkbox' || c.type === 'number' || c.formulaHeader ? 'General' : '@'; }
function writeGrid_(ss, sh, key, grid) {
  var t = FV.SCHEMA.tab[key], rows = grid.values.length, cols = Math.max.apply(null, grid.values.map(function (r) { return r.length; }));
  grid.values.forEach(function (r) { while (r.length < cols) r.push(''); });
  sh.clear(); sh.clearConditionalFormatRules();
  var all = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()); all.clearDataValidations(); all.clearNote();
  sh.createDeveloperMetadataFinder().withKey('fv.col').find().forEach(function (m) { m.remove(); });
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).concat(sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)).forEach(function (p) { if (/^fv:/.test(p.getDescription())) p.remove(); });
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
  if (sh.getMaxRows() < rows + 200) sh.insertRowsAfter(sh.getMaxRows(), rows + 200 - sh.getMaxRows());
  var maxR = sh.getMaxRows();
  sh.getRange(1, 1, 1, cols).setNumberFormat('@');
  (t.cols || []).forEach(function (c, i) { sh.getRange(2, i + 1, maxR - 1, 1).setNumberFormat(numFmt_(c)); });
  if (!t.cols.length) sh.getRange(1, 1, maxR, cols).setNumberFormat('@');
  for (var j = t.cols.length; t.cols.length && j < cols; j++) sh.getRange(2, j + 1, maxR - 1, 1).setNumberFormat('@');
  if (key === 'settings') {
    var types = {}; FV.SCHEMA.settings.forEach(function (d) { types[d.name] = d.type; });
    grid.values.forEach(function (r, i) { if (i && types[r[0]] === 'date') sh.getRange(i + 1, 2).setNumberFormat('yyyy-mm-dd'); });
  }
  sh.getRange(1, 1, rows, cols).setValues(grid.values);
  (grid.formulas || []).forEach(function (f) { sh.getRange(f.r + 1, f.c + 1).setFormula(f.f); });
  (grid.notes || []).forEach(function (n) { sh.getRange(n.r + 1, n.c + 1).setNote(n.note); });
  sh.getRange(2, 1, maxR - 1, cols).setVerticalAlignment('top');
  if (t.cols.length) { t.cols.forEach(function (c, i) { sh.setColumnWidth(i + 1, c.width || 140); }); for (var k = t.cols.length; k < cols; k++) sh.setColumnWidth(k + 1, 200); }
  else if (key === 'start') { sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 720); sh.getRange(1, 1, rows, 2).setWrap(true); }
}
function emptyGrid_(key) {
  var t = FV.SCHEMA.tab[key];
  if (key === 'start') return FV.startGrid(SHEET_TEXTS);
  return FV.gridOf(key, key === 'checklist' ? FV.toRowsV2({}, { texts: SHEET_TEXTS }).checklist : [], {});
}
function lettersAll_(ss) {
  var out = {};
  ['laws', 'bills', 'states', 'limits', 'prot', 'labels', 'words'].forEach(function (k) {
    var sh = fvTab_(ss, k); if (!sh) return; var m = headerIdx_(ss, sh, k); out[k] = {};
    Object.keys(m).forEach(function (c) { out[k][c] = FV.letter(m[c]); });
  });
  return out;
}
function writeLists_(ss) {
  var sh = fvTab_(ss, 'lists') || ss.insertSheet('Lists'), spec = FV.listsSpec(lettersAll_(ss)), changed = false;
  var want = spec.map(function (x) { return x.name; }), maxLen = Math.max.apply(null, spec.map(function (x) { return x.values ? x.values.length : 1; }));
  var grid = [want].concat(Array.apply(null, Array(maxLen)).map(function (_, i) { return spec.map(function (x) { return x.values ? (x.values[i] === undefined ? '' : x.values[i]) : ''; }); }));
  var curW = Math.max(sh.getLastColumn(), 1), cur = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), curW).getFormulas();
  var curV = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), curW).getValues();
  spec.forEach(function (x, i) { if (x.f && (!cur[1] || cur[1][i] !== x.f)) changed = true; });
  if (JSON.stringify(curV[0].slice(0, want.length)) !== JSON.stringify(want)) changed = true;
  if (!changed) return false;
  sh.clear();
  if (sh.getMaxColumns() < want.length) sh.insertColumnsAfter(sh.getMaxColumns(), want.length - sh.getMaxColumns());
  sh.getRange(1, 1, grid.length, want.length).setNumberFormat('@').setValues(grid);
  spec.forEach(function (x, i) { if (x.f) sh.getRange(2, i + 1).setFormula(x.f); });
  sh.getRange(1, 1, 1, want.length).setFontWeight('bold').setBackground(FV.COLORS.header).setFontColor(FV.COLORS.headerText);
  return true;
}
function listRange_(ss, name) {
  var sh = fvTab_(ss, 'lists'), h = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0], i = h.indexOf(name) + 1;
  return i ? sh.getRange(2, i, 400, 1) : null;
}
function validation_(ss, c, colLetter) {
  var b = SpreadsheetApp.newDataValidation();
  if (c.type === 'checkbox') return b.requireCheckbox().build();
  if (c.type === 'date') return b.requireDate().setAllowInvalid(false).setHelpText('Type a date as yyyy-mm-dd.').build();
  if (c.type === 'year4') return b.requireFormulaSatisfied('=REGEXMATCH(TO_TEXT(' + colLetter + '2),"^\\d{4}$")').setAllowInvalid(false).setHelpText('Exactly 4 digits, e.g. 2026.').build();
  var m = /^dd:(\w+)$/.exec(c.type || '');
  if (m) { var r = listRange_(ss, m[1]); if (r) return b.requireValueInRange(r, true).setAllowInvalid(false).build(); }
  return null;
}
function protect_(sh, range, desc) {
  var type = range ? SpreadsheetApp.ProtectionType.RANGE : SpreadsheetApp.ProtectionType.SHEET;
  var ps = sh.getProtections(type).filter(function (p) { return p.getDescription() === desc; });
  ps.slice(1).forEach(function (p) { p.remove(); });
  var p = ps[0];
  if (!p) { p = range ? range.protect() : sh.protect(); p.setDescription(desc); p.setWarningOnly(true); return 1; }
  if (range && p.getRange().getA1Notation() !== range.getA1Notation()) { p.setRange(range); return 1; }
  if (!p.isWarningOnly()) { p.setWarningOnly(true); return 1; }
  return 0;
}
/** Headers, notes, metadata, validation, conditional formats, protections, freeze and colours. Data values are untouched. */
function applyStructure_(ss, key) {
  var t = FV.SCHEMA.tab[key], sh = fvTab_(ss, key), changes = 0; if (!sh) return 0;
  if (setMeta_(sh, 'fv.tab', key)) changes++;
  sh.setTabColor(FV.COLORS[t.kind]);
  if (t.hidden) sh.hideSheet();
  if (!t.cols.length) { if (key === 'start') sh.getRange(1, 1).setFontWeight('bold').setFontSize(16).setFontColor(FV.COLORS.header); return changes; }
  var maxR = sh.getMaxRows(), lastCol = Math.max(sh.getLastColumn(), 1), head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var pn = protNames_(ss), metas = metaByCol_(sh), m = FV.mapHeaders(key, head, metas, key === 'prot' ? {} : pn).idx, letters = {};
  sh.getRange(1, 1, 1, lastCol).setBackground(FV.COLORS.header).setFontColor(FV.COLORS.headerText).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
  sh.setFrozenRows(1); sh.setFrozenColumns(t.frozenCols || 0);
  t.cols.forEach(function (c) {
    var i = m[c.key]; if (i === undefined) return;
    var col = i + 1, L = FV.letter(i), body = sh.getRange(2, col, maxR - 1, 1); letters[c.key] = L;
    if (c.formulaHeader) {
      var TL = FV.letter(m.text === undefined ? 2 : m.text), f = '={"' + c.header + '";ARRAYFORMULA(IF(' + TL + '2:' + TL + '="",,LEN(' + TL + '2:' + TL + ')))}';
      if (sh.getRange(1, col).getFormula() !== f) { sh.getRange(1, col).setFormula(f); changes++; }
    } else {
      var want = c.prot ? (pn[c.prot] || FV.PROT_DEFAULT[c.prot]) : c.header;
      if (String(head[i]) !== want) { sh.getRange(1, col).setValue(want); changes++; }
    }
    sh.getRange(1, col).setNote(c.note || '');
    var has = metas[i] || [];
    if (has.indexOf(key + '.' + c.key) < 0) { sh.getRange(L + ':' + L).addDeveloperMetadata('fv.col', key + '.' + c.key, SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT); changes++; }
    if (key !== 'settings') body.setDataValidation(validation_(ss, c, L));
    if (c.auto || c.lock) { body.setBackground(FV.COLORS.auto).setFontColor(FV.COLORS.autoText); changes += protect_(sh, body, 'fv:col:' + c.key); }
    if (c.wrap) body.setWrap(true);
  });
  if (key === 'settings' && m.value !== undefined && m.setting !== undefined) {
    var sv = sh.getDataRange().getValues(), defs = {}; FV.SCHEMA.settings.forEach(function (d) { defs[FV.norm(d.name)] = d; });
    if (maxR > sv.length) sh.getRange(sv.length + 1, m.value + 1, maxR - sv.length, 1).setDataValidation(null);
    for (var r = 2; r <= sv.length; r++) {
      var d = defs[FV.norm(sv[r - 1][m.setting])] || null, cell = sh.getRange(r, m.value + 1);
      cell.setDataValidation(d && d.type ? validation_(ss, { type: d.type }, FV.letter(m.value)) : null);
      if (d && d.auto) cell.setBackground(FV.COLORS.auto).setFontColor(FV.COLORS.autoText);
      if (d && d.name === 'Current bill session') ss.setNamedRange('FV_BillSession', cell);
    }
  }
  var ours = FV.cfSpec(key, letters).map(function (spec) {
    var b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(spec.formula).setBackground(spec.color);
    if (spec.strike) b = b.setStrikethrough(true);
    return b.setRanges(spec.cols.filter(function (k) { return m[k] !== undefined; }).map(function (k) { return sh.getRange(2, m[k] + 1, maxR - 1, 1); })).build();
  });
  var keep = sh.getConditionalFormatRules().filter(function (r) { var bc = r.getBooleanCondition(), v = bc ? bc.getCriteriaValues() : []; return !(v[0] && String(v[0]).indexOf('N("fv")') >= 0); });
  sh.setConditionalFormatRules(keep.concat(ours));
  changes += protect_(sh, sh.getRange(1, 1, 1, lastCol), 'fv:header');
  if (key === 'changelog') changes += protect_(sh, null, 'fv:sheet');
  if (t.filter && !sh.getFilter()) { sh.getRange(1, 1, Math.max(sh.getLastRow(), 2), lastCol).createFilter(); changes++; }
  return changes;
}
function orderTabs_(ss) {
  var names = FV.SCHEMA.visibleOrder.map(function (k) { return FV.SCHEMA.tab[k].name; }), all = ss.getSheets().map(function (s) { return s.getName(); });
  var others = all.filter(function (n) { return names.indexOf(n) < 0 && n !== 'Lists' && n !== 'Self-test' && !isFvAside_(n); });
  var want = names.concat(others, ['Lists', 'Self-test'], all.filter(isFvAside_)).filter(function (n) { return all.indexOf(n) >= 0; });
  want.forEach(function (n, i) { var sh = ss.getSheetByName(n); if (sh.getIndex() !== i + 1) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); } });
  ss.getSheets().forEach(function (s) { if (isFvAside_(s.getName()) || s.getName() === 'Lists' || s.getName() === 'Self-test') { if (!s.isSheetHidden()) s.hideSheet(); } });
}
function refreshComputed_(c, model, pv, liveJson) {
  var ctxA = { json: pv, live: liveJson || null, protNames: model.protNames };
  ['laws', 'bills', 'quotes', 'states', 'prot', 'words', 'limits', 'stories'].forEach(function (key) {
    var sh = fvTab_(c.ss, key), tab = model.tabs[key]; if (!sh || !tab || tab.missing) return;
    var n = sh.getLastRow(); if (n < 2) return;
    FV.SCHEMA.tab[key].cols.forEach(function (col) {
      if (!col.auto || col.formulaHeader || tab.idx[col.key] === undefined) return;
      var cur = sh.getRange(2, tab.idx[col.key] + 1, n - 1, 1).getValues(), want = cur.map(function () { return ['']; });
      if (col.key === 'id') want = cur.map(function (x) { return [x[0]]; });
      tab.rows.forEach(function (r) { want[r._row - 2] = [FV.autoValue(key, col.key, r, ctxA)]; });
      if (JSON.stringify(cur.map(function (x) { return [String(x[0])]; })) !== JSON.stringify(want.map(function (x) { return [String(x[0])]; }))) sh.getRange(2, tab.idx[col.key] + 1, n - 1, 1).setValues(want);
    });
  });
}
function writeSelfTest_(ss) {
  var sh = fvTab_(ss, 'selftest') || ss.insertSheet('Self-test'), rows = [['Section', 'Tab', 'Column', 'Check', 'Expected', 'Found', 'OK']];
  var ok = function (a, b) { return a === b ? 'OK' : 'CHECK'; };
  rows.push(['Sheet', '', '', 'Schema version', String(SCHEMA_VERSION), String(meta_(ss, 'fv.schema') || ''), ok(String(SCHEMA_VERSION), String(meta_(ss, 'fv.schema') || ''))]);
  FV.SCHEMA.visibleOrder.forEach(function (key) {
    var t = FV.SCHEMA.tab[key], s = fvTab_(ss, key);
    rows.push(['Tab', t.name, '', 'Tab exists', 'yes', s ? 'yes' : 'no', ok('yes', s ? 'yes' : 'no')]);
    if (!s || !t.cols.length) return;
    var m = headerIdx_(ss, s, key), head = s.getRange(1, 1, 1, Math.max(s.getLastColumn(), 1)).getValues()[0], metas = metaByCol_(s), pn = protNames_(ss);
    var hp = s.getProtections(SpreadsheetApp.ProtectionType.RANGE).filter(function (p) { return p.getDescription() === 'fv:header' && p.isWarningOnly(); }).length ? 'yes' : 'no';
    rows.push(['Protection', t.name, 'row 1', 'Header row protected (warning only)', 'yes', hp, ok('yes', hp)]);
    rows.push(['Freeze', t.name, '', 'Frozen rows', '1', String(s.getFrozenRows()), ok('1', String(s.getFrozenRows()))]);
    t.cols.forEach(function (c) {
      var i = m[c.key], want = c.prot ? (pn[c.prot] || FV.PROT_DEFAULT[c.prot]) : c.header;
      if (i === undefined) { rows.push(['Header', t.name, want, 'Column present', 'yes', 'no', 'CHECK']); return; }
      rows.push(['Header', t.name, want, 'Header text', want, String(head[i]), ok(want, String(head[i]))]);
      var note = s.getRange(1, i + 1).getNote() ? 'yes' : 'no';
      rows.push(['Note', t.name, want, 'Header note', 'yes', note, ok('yes', note)]);
      var md = (metas[i] || []).indexOf(key + '.' + c.key) >= 0 ? 'yes' : 'no';
      rows.push(['Metadata', t.name, want, 'fv.col', key + '.' + c.key, md === 'yes' ? key + '.' + c.key : '(none)', ok('yes', md)]);
      if (key !== 'settings') {
        var exp = c.type === 'checkbox' ? 'CHECKBOX' : c.type === 'date' ? 'DATE_IS_VALID_DATE' : c.type === 'year4' ? 'CUSTOM_FORMULA' : /^dd:/.test(c.type) ? 'VALUE_IN_RANGE' : 'none';
        var dv = s.getRange(2, i + 1).getDataValidation(), got = dv ? String(dv.getCriteriaType()) : 'none';
        rows.push(['Validation', t.name, want, 'Row 2 validation', exp, got, ok(exp, got)]);
      }
    });
  });
  rows.push(['Lists', 'Lists', '', 'Tab exists and is hidden', 'yes', fvTab_(ss, 'lists') && fvTab_(ss, 'lists').isSheetHidden() ? 'yes' : 'no', fvTab_(ss, 'lists') && fvTab_(ss, 'lists').isSheetHidden() ? 'OK' : 'CHECK']);
  rows.push(['Named range', 'Settings', '', 'FV_BillSession', 'yes', ss.getRangeByName('FV_BillSession') ? 'yes' : 'no', ss.getRangeByName('FV_BillSession') ? 'OK' : 'CHECK']);
  var maxR = sh.getMaxRows(); if (maxR < rows.length) sh.insertRowsAfter(maxR, rows.length - maxR);
  sh.getRange(1, 1, sh.getMaxRows(), 7).clearContent();
  sh.getRange(1, 1, rows.length, 7).setNumberFormat('@').setValues(rows);
  return rows;
}

/* ---------- Upgrade or repair ---------- */
function upgradeSource_(ss) {
  var fromBackup = hasBackups_(ss), tabs = {}, keep = {}, mismatch = [];
  FV.V1_TABS.forEach(function (n) {
    var sh = ss.getSheetByName((fromBackup ? BACKUP_PREFIX : '') + n);
    if (!sh) { if (n !== 'Start here' && n !== 'Lists') mismatch.push('The "' + n + '" tab is missing.'); return; }
    var rg = sh.getDataRange(), values = rg.getValues();
    // v1 read every date as its year (the Year columns); the same rule keeps the data identical. Kept columns use the raw cells below.
    tabs[n] = values.map(function (r) { return r.map(function (v) { return v instanceof Date ? Utilities.formatDate(v, 'UTC', 'yyyy') : v; }); });
    if (n !== 'Start here' && n !== 'Lists') keep[n] = { values: values, display: rg.getDisplayValues(), notes: rg.getNotes(), formulas: rg.getFormulas() };
  });
  var fixed = ['Quotes', 'States', 'Protections', 'Limits', 'Labels', 'Stories', 'Glossary', 'Step notes', 'Settings'];
  fixed.forEach(function (n) {
    if (!tabs[n]) return;
    var want = FV1.HEAD[n], got = (tabs[n][0] || []).slice(0, want.length).map(function (x) { return String(x).trim(); });
    if (JSON.stringify(got) !== JSON.stringify(want)) mismatch.push(n + ' headers are "' + got.join(' | ') + '"; the upgrade expects "' + want.join(' | ') + '".');
  });
  var need = {
    'Laws': ['State', 'Name', 'Year', 'Status', 'Who it covers (as written)', 'Applies to', 'Only covers footage from', 'Only covers license photos', 'Summary', 'Citation', 'Link', 'Unclear', 'Unclear note', 'Unclear protections', 'Note', 'Ban or pause', 'Ban covers', 'Ban text', 'Ban exceptions', 'Exception to a ban', 'Bars footage from', 'Bar text'],
    'Bills': ['State', 'Name', 'Year', 'Progress', 'Still alive', 'Summary', 'Sponsor', 'Link', 'Note']
  };
  Object.keys(need).forEach(function (n) {
    if (!tabs[n]) return;
    var h = (tabs[n][0] || []).map(function (x) { return String(x).trim(); });
    var miss = need[n].filter(function (x) { return h.indexOf(x) < 0; }), pc = FV.PIDS.filter(function (k) { return !h.some(function (x) { return new RegExp('\\(' + k + '\\)$').test(x); }); });
    if (miss.length || pc.length) mismatch.push(n + ' is missing the columns: ' + miss.concat(pc.map(function (k) { return 'protection (' + k + ')'; })).join(', ') + '.');
  });
  var settings = {};
  (tabs['Settings'] || []).slice(1).forEach(function (r) { var k = String(r[0]).trim(); if (k && !settings.hasOwnProperty(k)) settings[k] = String(r[1] === undefined ? '' : r[1]).trim(); });
  var v2 = FV.SCHEMA.tabs.map(function (t) { return t.name; }), names = ss.getSheets().map(function (s) { return s.getName(); });
  var otherTabs = names.filter(function (n) { return FV.V1_TABS.indexOf(n) < 0 && v2.indexOf(n) < 0 && !isFvAside_(n); });
  // A tab of the user's that has the name of a new v2 tab (e.g. "Change log") is renamed, so the upgrade never writes over it.
  // On a resumed run the first try already renamed them, and tabs with these names are the upgrade's own.
  var renameTabs = [], used = names.slice();
  if (!fromBackup) names.forEach(function (n) {
    if (FV.V1_TABS.indexOf(n) >= 0 || v2.indexOf(n) < 0) return;
    var to = n + ' (before v2)', i = 2; while (used.indexOf(to) >= 0) to = n + ' (before v2 ' + (i++) + ')';
    used.push(to); renameTabs.push({ from: n, to: to });
  });
  return { tabs: tabs, keep: keep, settings: settings, fromBackup: fromBackup, mismatch: mismatch, otherTabs: otherTabs, renameTabs: renameTabs };
}
function planUpgrade_(c, src) {
  var r1 = FV1.fromRows(src.tabs, src.settings['Research note']), J1 = r1.data, live = null, liveNote = '';
  J1.updated = c.now.toISOString();
  var ls = src.settings;
  if (ghToken_() && ls['GitHub owner'] && ls['GitHub repo'] && ls['Branch']) {
    try { live = fetchLive_({ 'GitHub owner': ls['GitHub owner'], 'GitHub repo': ls['GitHub repo'], 'Branch': ls['Branch'], 'Folder': ls['Folder'] || '' }); } catch (e) { liveNote = friendlyOf_(e).msg; }
  } else liveNote = 'No GitHub key or settings yet, so the sheet was not compared with the live site.';
  var plan = FV.planV1toV2(J1, src.tabs, src.settings, { wordKeys: WORD_KEYS, texts: SHEET_TEXTS, live: live && live.json, today: c.today, now: c.now, sheetId: c.ss.getId(), otherTabs: src.otherTabs, renameTabs: src.renameTabs, v1keep: src.keep });
  var seen = {}; Object.keys(src.keep).forEach(function (n) { seen[n] = { d: src.keep[n].display, n: src.keep[n].notes, f: src.keep[n].formulas }; });
  var hash = sha256_(FV.canonical({ tabs: src.tabs, settings: src.settings, seen: seen, renames: src.renameTabs, version: FV_VERSION }));
  return { J1: J1, v1errors: r1.errors, live: live, liveNote: liveNote, liveDiff: live ? FV.diff(live.json, J1) : null, plan: plan, hash: hash };
}
function menuUpgrade() {
  return run_('Upgrade', false, function () {
    var c = ctx_(), ss = c.ss;
    if (isV2_(ss)) return withLock_(function () { return repair_(c, true); });
    var src = upgradeSource_(ss);
    if (src.mismatch.length) {
      dialog_('<p>This sheet does not look like a v1 Face Value sheet, so nothing was changed.</p><ul>' + src.mismatch.map(function (m) { return '<li>' + esc_(m) + '</li>'; }).join('') + '</ul><button onclick="google.script.host.close()">Close</button>', 'Upgrade this sheet', 620, 360);
      return { ok: false, mismatch: src.mismatch };
    }
    var up = planUpgrade_(c, src), rep = up.plan.report, li = function (a) { return '<ul>' + a.map(function (x) { return '<li>' + esc_(x) + '</li>'; }).join('') + '</ul>'; };
    var html = '<p><b>Dry run.</b> Nothing has changed yet. Read this, then press Upgrade now.</p>' + (src.fromBackup ? '<p class="err">A first try did not finish. The upgrade will start again from the "v1 backup:" tabs.</p>' : '') +
      '<h3>Rows per tab</h3>' + li(Object.keys(rep.rows).map(function (k) { return k + ': ' + rep.rows[k]; })) +
      '<h3>Conversions</h3>' + li(rep.conversions) + '<h3>Data check</h3><p>' + esc_(rep.dataCheck) + '</p>' +
      '<h3>Sheet compared with the live site</h3>' + (up.liveDiff ? (up.liveDiff.count ? '<p>The sheet has edits that are not on the live site yet:</p>' + li(up.liveDiff.details.slice(0, 60)) : '<p>The sheet matches the live site.</p>') : '<p>' + esc_(up.liveNote) + '</p>') +
      (rep.heads.length ? '<h3>Heads-ups</h3>' + li(rep.heads) : '') + (up.v1errors.length ? '<h3>Problems the old check already lists</h3>' + li(up.v1errors.map(function (e) { return e[0] + (e[1] ? ' row ' + e[1] : '') + ': ' + e[2]; })) : '') +
      ((rep.kept.tabs.length || rep.kept.columns.length || rep.kept.renamed.length || rep.kept.notes.moved) ? '<h3>Kept as they are</h3>' + li(rep.kept.tabs.map(function (t) { return 'Tab: ' + t; })
        .concat(rep.kept.renamed.map(function (r) { return 'Tab: ' + r.from + ' (renamed "' + r.to + '", because v2 adds its own "' + r.from + '" tab)'; }))
        .concat(rep.kept.columns.map(function (x) { return 'Column: ' + x; }))
        .concat(rep.kept.notes.moved ? [rep.kept.notes.moved + ' cell note' + (rep.kept.notes.moved > 1 ? 's move' : ' moves') + ' with their cells'] : [])) : '') +
      (rep.blocking.length ? '<h3 class="err">Blocking issues (fix these first)</h3>' + li(rep.blocking) :
        '<p><label for="bk">Link to your backup copy (optional)</label><br><input id="bk" type="url"></p><p>Ask other editors to close the sheet first. It takes about a minute.</p>' +
        '<button class="primary" data-hash="' + up.hash + '" onclick="this.disabled=true;google.script.run.withSuccessHandler(function(){google.script.host.close();}).runUpgrade(\'' + up.hash + '\',document.getElementById(\'bk\').value)">Upgrade now</button>') +
      '<button onclick="google.script.host.close()">Cancel</button>';
    dialog_(html, 'Upgrade this sheet to v2', 720, 560);
    return { ok: true, hash: up.hash, report: rep, liveDiff: up.liveDiff };
  });
}
/** Called from the dry-run dialog. */
function runUpgrade(planHash, backupLink) {
  return run_('Upgrade', true, function () {
    return withLock_(function () {
      var c = ctx_(), ss = c.ss;
      if (isV2_(ss)) return { ok: false, msg: 'This sheet is already on v2.' };
      var src = upgradeSource_(ss); if (src.mismatch.length) throw fvErr_('The sheet changed shape since the dry run. Run Upgrade again.', src.mismatch.join('\n'));
      var up = planUpgrade_(c, src);
      if (up.hash !== planHash) throw fvErr_('Someone edited the sheet while the dry run was open. Run Upgrade again to see the new report.');
      if (up.plan.report.blocking.length) throw fvErr_('The dry run lists blocking issues. Fix them first.', up.plan.report.blocking.join('\n'));
      if (!src.fromBackup) {
        src.renameTabs.forEach(function (r) { var sh = ss.getSheetByName(r.from); if (sh) sh.setName(r.to); });
        if (src.renameTabs.length) setMeta_(ss, 'fv.renamedTabs', JSON.stringify(src.renameTabs));
        FV.V1_TABS.forEach(function (n) {
          var sh = ss.getSheetByName(n); if (!sh) return;
          var b = sh.copyTo(ss); b.setName(BACKUP_PREFIX + n); b.setTabColor(FV.COLORS.backup); b.hideSheet();
          var p = b.protect(); p.setDescription('fv:backup'); p.setWarningOnly(true);
        });
        setMeta_(ss, 'fv.upgradeState', 'backed-up');
      }
      writeV2_(c, up.plan);
      var model = readModel_(ss), J2 = FV.build(model, { mode: 'preview', now: c.now }), ae = FV.additiveEqual(up.J1, J2), bad = FV.oldAppContract(J2);
      if (!ae.ok || bad.length) { setMeta_(ss, 'fv.upgradeState', 'failed'); throw fvErr_('The tabs were written, but the check after the upgrade failed. Use Setup › Undo the upgrade.', ae.problems.concat(bad.map(function (b) { return b.msg; })).join('\n')); }
      setMeta_(ss, 'fv.schema', String(SCHEMA_VERSION)); setMeta_(ss, 'fv.upgradeState', 'done');
      writeSelfTest_(ss);
      log_(c, 'Upgrade', 'Upgraded the sheet to v2. ' + up.plan.report.dataCheck, up.plan.report.conversions.concat(up.plan.report.heads, backupLink ? ['Backup copy: ' + backupLink] : []).join('\n'), '', '', '', 'OK');
      var t = ghToken_(); if (t) { try { var k = checkKey_(t, settingsOf_(model)); setSetting_(ss, 'GitHub key (auto)', (k.ok ? k.msg : 'Failed: ' + k.msg) + ' · checked ' + c.today); } catch (e) { /* the key check is optional here */ } }
      onOpen();
      showMessage_('Upgrade done', 'The sheet is on v2. Next: Setup › Check GitHub key, then Check for problems, then Preview changes.');
      return { ok: true };
    });
  });
}
function writeV2_(c, plan) {
  var ss = c.ss;
  FV.SCHEMA.visibleOrder.concat(['selftest']).forEach(function (key) {
    var t = FV.SCHEMA.tab[key], sh = ss.getSheetByName(t.name) || ss.insertSheet(t.name);
    writeGrid_(ss, sh, key, plan.grids[t.name]);
  });
  var sn = ss.getSheetByName('Step notes'); if (sn) ss.deleteSheet(sn);
  finishStructure_(ss);
}
function finishStructure_(ss) {
  var n = 0;
  if (writeLists_(ss)) n++;
  FV.SCHEMA.visibleOrder.concat(['lists', 'selftest']).forEach(function (key) { n += applyStructure_(ss, key); });
  orderTabs_(ss);
  return n;
}
function repair_(c, interactive) {
  var ss = c.ss, notes = [], n = 0;
  FV.SCHEMA.visibleOrder.concat(['selftest']).forEach(function (key) {
    if (fvTab_(ss, key)) return;
    var t = FV.SCHEMA.tab[key], sh = ss.insertSheet(t.name); writeGrid_(ss, sh, key, emptyGrid_(key)); notes.push('Added the ' + t.name + ' tab.'); n++;
  });
  var model = readModel_(ss), have = {}, wsh = fvTab_(ss, 'words');
  model.tabs.words.rows.forEach(function (r) { have[r.key] = 1; });
  var miss = WORD_KEYS.filter(function (w) { return !have[w.key]; });
  if (miss.length && wsh) {
    var m = headerIdx_(ss, wsh, 'words'), width = wsh.getLastColumn(), start = wsh.getLastRow() + 1;
    var rows = FV.toRowsV2({ config: {} }, { wordKeys: miss }).words.map(function (o) { var line = []; for (var i = 0; i < width; i++) line.push(''); Object.keys(m).forEach(function (k) { if (o[k] !== undefined) line[m[k]] = o[k]; }); return line; });
    wsh.getRange(start, 1, rows.length, width).setValues(rows);
    notes.push('Added ' + miss.length + ' missing Words rows (Draft).'); n += miss.length;
  }
  var ssh = fvTab_(ss, 'settings');
  FV.SCHEMA.settings.forEach(function (d) {
    if (model.settings.hasOwnProperty(d.name) || !ssh) return;
    ssh.getRange(ssh.getLastRow() + 1, 1, 1, 3).setValues([[d.name, '', String((SHEET_TEXTS.settingsHelp || {})[d.name] || '')]]); notes.push('Added the Settings row "' + d.name + '".'); n++;
  });
  n += finishStructure_(ss);
  var before = selfTestValues_(ss); writeSelfTest_(ss); if (selfTestValues_(ss) !== before) n++;
  if (n) log_(c, 'Repair', 'Repaired the sheet structure (' + n + ' fixes).', notes.join('\n'), '', '', '', 'OK');
  if (interactive) showMessage_('Repair', n ? 'Repaired the sheet: ' + n + ' fixes. ' + notes.join(' ') : 'Nothing to repair. The sheet structure is fine.');
  return { ok: true, repaired: n, notes: notes };
}
function selfTestValues_(ss) { var sh = fvTab_(ss, 'selftest'); return sh ? JSON.stringify(sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 7).getValues()) : ''; }
function menuUndoUpgrade() {
  return run_('Undo the upgrade', false, function () {
    var ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive();
    if (!hasBackups_(ss)) { showMessage_('Undo the upgrade', 'There are no "v1 backup:" tabs, so there is nothing to undo.'); return { ok: false }; }
    if (ui.alert('Undo the upgrade', 'This puts the v1 tabs back and hides the v2 tabs as "v2 undone:". Edits made since the upgrade stay only in the hidden tabs. Continue?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return { ok: false };
    return withLock_(function () {
      var v2 = FV.SCHEMA.tabs.map(function (t) { return t.name; }).concat(['Step notes']);
      ss.getSheets().forEach(function (sh) {
        var n = sh.getName(); if (v2.indexOf(n) < 0) return;
        var name = UNDONE_PREFIX + n, i = 2; while (ss.getSheetByName(name)) name = UNDONE_PREFIX + n + ' (' + (i++) + ')';
        sh.setName(name); sh.hideSheet();
      });
      FV.V1_TABS.forEach(function (n, i) {
        var b = ss.getSheetByName(BACKUP_PREFIX + n); if (!b) return;
        b.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) { if (p.getDescription() === 'fv:backup') p.remove(); });
        b.setName(n); b.showSheet(); b.setTabColor(null);
      });
      FV.V1_TABS.filter(function (n) { return ss.getSheetByName(n); }).forEach(function (n, i) { ss.setActiveSheet(ss.getSheetByName(n)); ss.moveActiveSheet(i + 1); });
      // Tabs the upgrade renamed to free a v2 name get their own names back.
      var renamed = []; try { renamed = JSON.parse(meta_(ss, 'fv.renamedTabs') || '[]'); } catch (e) { renamed = []; }
      renamed.forEach(function (r) { var sh = ss.getSheetByName(r.to); if (sh && !ss.getSheetByName(r.from)) sh.setName(r.from); });
      delMeta_(ss, 'fv.renamedTabs');
      delMeta_(ss, 'fv.schema'); setMeta_(ss, 'fv.upgradeState', 'undone');
      onOpen();
      showMessage_('Undo the upgrade', 'The v1 tabs are back. The v2 tabs are hidden as "v2 undone:". Paste the v1 script back if you need its menu.');
      return { ok: true };
    });
  });
}
function menuRemoveBackups() {
  return run_('Remove upgrade backups', false, function () {
    var ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive();
    var list = ss.getSheets().filter(function (s) { return isFvAside_(s.getName()); });
    if (!list.length) { showMessage_('Remove upgrade backups', 'There are no backup tabs.'); return { ok: false }; }
    if (ui.alert('Remove upgrade backups', 'This deletes ' + list.length + ' hidden tabs ("v1 backup:" and "v2 undone:"). After this, Undo the upgrade is no longer possible. Continue?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return { ok: false };
    list.forEach(function (s) { ss.deleteSheet(s); });
    if (isV2_(ss)) setMeta_(ss, 'fv.upgradeState', 'done');
    return { ok: true, removed: list.length };
  });
}
/** Disaster recovery (not in the menu): fills a sheet whose Settings tab names the repository from the live site. */
function rebuildFromLive() {
  var c = ctx_(), ss = c.ss, model = readModel_(ss), s = settingsOf_(model), live = fetchLive_(s);
  if (!live) throw fvErr_('There is no live site file to rebuild from.');
  var st = FV.settingsFrom(live.json, model.settings, { texts: SHEET_TEXTS, today: c.today, sheetId: ss.getId() });
  var objs = FV.toRowsV2(live.json, { wordKeys: WORD_KEYS, texts: SHEET_TEXTS, settingsRows: st.rows }), pn = {};
  objs.prot.forEach(function (p) { pn[p.key] = p.short; });
  FV.SCHEMA.visibleOrder.concat(['selftest']).forEach(function (key) {
    var t = FV.SCHEMA.tab[key], sh = ss.getSheetByName(t.name) || ss.insertSheet(t.name);
    writeGrid_(ss, sh, key, key === 'start' ? FV.startGrid(SHEET_TEXTS) : FV.gridOf(key, objs[key] || [], { json: live.json, live: live.json, protNames: pn, wordsRows: objs.words }));
  });
  finishStructure_(ss);
  setMeta_(ss, 'fv.schema', String(SCHEMA_VERSION));
  writeSelfTest_(ss);
  log_(c, 'Repair', 'Rebuilt the sheet from the live site.', '', '', live.sha, '', 'OK');
  return { ok: true };
}

/* ---------- helpers on the menu ---------- */
function replaceInColumn_(ss, key, colKey, from, to) {
  var sh = fvTab_(ss, key); if (!sh || sh.getLastRow() < 2) return 0;
  var m = headerIdx_(ss, sh, key); if (m[colKey] === undefined) return 0;
  var rng = sh.getRange(2, m[colKey] + 1, sh.getLastRow() - 1, 1), v = rng.getValues(), n = 0;
  v.forEach(function (r) { if (String(r[0]) === from) { r[0] = to; n++; } });
  if (n) rng.setValues(v);
  return n;
}
function setStatusSelected_(status) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getActiveSheet(), key = tabKeyOf_(sh), r = ss.getActiveRange();
  if (WORDING_TABS.indexOf(key) < 0 || !r) { showMessage_('Wording', 'Select rows on Words on the page, Protections, Stories or Glossary first.'); return { ok: false }; }
  var m = headerIdx_(ss, sh, key); if (m.status === undefined) return { ok: false };
  var top = Math.max(2, r.getRow()), bottom = r.getLastRow(), n = 0;
  if (bottom < top) return { ok: false };
  var rng = sh.getRange(top, m.status + 1, bottom - top + 1, 1), v = rng.getValues(), rowsV = sh.getRange(top, 1, bottom - top + 1, sh.getLastColumn()).getValues();
  v.forEach(function (x, i) { if (rowsV[i].some(function (c) { return String(c).trim() !== '' && c !== false; })) { if (x[0] !== status) n++; x[0] = status; } });
  rng.setValues(v);
  return { ok: true, changed: n };
}
function menuApproveSelected() { return run_('Wording', false, function () { return setStatusSelected_('Approved'); }); }
function menuReadySelected() { return run_('Wording', false, function () { return setStatusSelected_('Ready for review'); }); }
function menuStartRefresh() {
  return run_('Refresh', false, function () {
    var ui = SpreadsheetApp.getUi(), c = ctx_(), sh = fvTab_(c.ss, 'checklist');
    if (!sh) throw fvErr_('The Refresh checklist tab is missing. Use Setup › Upgrade or repair.');
    if (ui.alert('Start a new refresh', 'This saves the current ticks to the Change log, then clears Done and Date done.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return { ok: false };
    var m = headerIdx_(c.ss, sh, 'checklist'), n = sh.getLastRow(); if (n < 2) return { ok: true };
    var v = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
    var done = v.filter(function (r) { return r[m.done] === true; }).map(function (r) { return '[x] ' + r[m.step] + (r[m.date] ? ' · ' + (r[m.date] instanceof Date ? Utilities.formatDate(r[m.date], c.tz, 'yyyy-MM-dd') : r[m.date]) : '') + (r[m.notes] ? ' · ' + r[m.notes] : ''); });
    log_(c, 'Refresh', 'Started a new refresh. ' + done.length + ' of ' + v.length + ' steps were ticked.', done.join('\n'), '', '', '', 'OK');
    sh.getRange(2, m.done + 1, n - 1, 1).setValues(v.map(function () { return [false]; }));
    sh.getRange(2, m.date + 1, n - 1, 1).setValues(v.map(function () { return ['']; }));
    return { ok: true, saved: done.length };
  });
}
function menuCheckLinks() {
  return run_('Check links', false, function () {
    var c = ctx_(), model = readModel_(c.ss), links = [], bad = [];
    ['laws', 'bills'].forEach(function (k) { model.tabs[k].rows.forEach(function (r) { if (r.link) links.push({ tab: FV.SCHEMA.tab[k].name, row: r._row, url: r.link }); }); });
    model.tabs.words.rows.forEach(function (r) { if (FV.isUrlKey(r.key) && r.text) links.push({ tab: 'Words on the page', row: r._row, url: r.text }); });
    links.forEach(function (l) {
      var code = 0;
      try { code = UrlFetchApp.fetch(l.url, { muteHttpExceptions: true, followRedirects: true }).getResponseCode(); } catch (e) { code = 0; }
      if (!code || code >= 400) bad.push(l.tab + ' row ' + l.row + ': ' + l.url + ' (' + (code || 'no answer') + ')');
    });
    dialog_('<p>Checked ' + links.length + ' links. ' + (bad.length ? bad.length + ' did not open:' : 'All of them opened.') + '</p>' + (bad.length ? '<ul>' + bad.map(function (b) { return '<li>' + esc_(b) + '</li>'; }).join('') + '</ul>' : '') + '<p class="muted">Some official sites block scripts; open those by hand before changing anything.</p><button class="primary" onclick="google.script.host.close()">Close</button>', 'Check links', 640, 440);
    return { ok: true, checked: links.length, bad: bad };
  });
}
function menuClaimPublishing() {
  return run_('Publish from this sheet', false, function () {
    var ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive();
    if (ui.alert('Publish from this sheet', 'Make this sheet the one that can Preview and Deploy? Other copies stop being able to publish.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return { ok: false };
    setSetting_(ss, 'Publishing sheet (auto)', ss.getId());
    return { ok: true };
  });
}
function menuAbout() {
  var ss = SpreadsheetApp.getActive(), v = '';
  try { v = isV2_(ss) ? String(readModel_(ss).settings['Sheet version (auto)'] || '') : 'not upgraded yet'; } catch (e) { v = ''; }
  showMessage_('About Face Value', 'Face Value sheet script ' + FV_VERSION + ' (schema ' + SCHEMA_VERSION + '). This sheet: ' + (v || 'unknown') + '. The script lives in the site repository at sheet/Code.gs.');
  return { ok: true, version: FV_VERSION };
}

/* ======================= 5. node ======================= */
if (typeof module !== 'undefined' && module.exports) module.exports = { FV: FV, FV1: FV1, WORD_KEYS: WORD_KEYS, SHEET_TEXTS: SHEET_TEXTS, FV_VERSION: FV_VERSION, SCHEMA_VERSION: SCHEMA_VERSION };
