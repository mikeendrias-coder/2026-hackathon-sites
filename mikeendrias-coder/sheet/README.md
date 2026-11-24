# Updating Face Value from the Google Sheet

This guide is for anyone at CDT who updates the Face Value site. You don't need to know any code.

For the twice-a-year refresh, the GitHub key, undo, the exit plan and the handoff, read [RUNBOOK.md](RUNBOOK.md).

## What the sheet is

The Google Sheet "Face Value: site control sheet" holds everything the site shows: laws, bills, quotes, protections, stories and the words on the page.

The site never reads the sheet directly. A script inside the sheet publishes two files to GitHub:

- `data/preview.json` is the preview. Only people with the preview link see it.
- `data/live.json` is the public site.

Two pages read those files:

- the new one-page site (the `play/` folder for now);
- the older four-tab site (the folder root), which still runs until the new page replaces it.

Add `?preview` to the end of either address to see the preview. A yellow bar at the top tells you it is a preview.

## The tabs

| Tab | What it holds |
|---|---|
| Start here | Status at a glance, the colour key, and the short how-to. Read it first. |
| Words on the page | Every sentence, heading and button label on the new page. One row per piece of text. |
| Laws | One row per state law. The 7 protection columns say what each law adds. |
| Bills | One row per bill, with how far it got and whether it is still alive. |
| Quotes | The exact wording of each law or bill, with its citation. |
| States | The 51 places on the map. Mostly filled in by the script. |
| Protections | The 7 protections: name, what it means, why it matters, and order on the page. |
| Stories | The teaching stories. Tick "Show on new page" for the 3 or 4 the new page shows. |
| Glossary | Short definitions for the "Words used here" list. |
| Limits | The codes for limited protections, such as "lineups only", and their plain words. |
| Labels | How law status and bill progress are worded on the site. |
| Settings | Where the site lives, key dates, and the on/off switch for the site. |
| Refresh checklist | The steps for the 6-month refresh. |
| Change log | A record of every Preview, Deploy and Undo. The script writes it. |

Some tabs are hidden on purpose. "Lists" feeds the dropdowns. "Self-test" holds the script's own checks. Tabs named "v1 backup:" are a safety copy from the upgrade. Leave them alone.

## Colours

- **White cells:** type here.
- **Grey cells,** with a header ending in "(auto)": the script fills these in. Anything typed there is ignored.
- **Red:** must fix. Preview and Deploy stop until it is fixed.
- **Amber:** check this. For example, a law nobody has re-read in 6 months.
- **Lavender:** the law has an open question about how to count it.
- **Status cells:** green is Approved, yellow is Draft, orange is Ready for review.

Hover over any header to read a one-line note on what goes in that column.

## How to make a change

1. Edit the white cells. Use the dropdowns and checkboxes.
2. **Face Value › Check for problems.** Fix every error it lists. Read the heads-ups too.
3. **Face Value › Preview changes.** Wait about a minute.
4. **Face Value › Open preview.** Look at your change on the preview page.
5. If you changed wording, set its Status to **Ready for review** and ask Jake to approve it.
6. **Face Value › Deploy to live site….** Read the list of changes, then press **Deploy now**.

The public site updates about a minute after Deploy.

## Changing wording

Most visible text lives on the **Words on the page** tab.

- Edit only the **Text** column. The Key, Where it appears, Max length and Fill-ins columns are locked.
- Keep within **Max length**. The Length (auto) column counts as you type and turns amber when the text is too long.
- Words in curly brackets, like `{state}` or `{count}`, are fill-ins. The page swaps in the real value. Use only the fill-ins listed for that row.
- Write plain text. No bold, links or line breaks. Rows whose key ends in `url` or `Url` hold a web address that starts with `https://`.

The "why it matters" line for each protection is on the **Protections** tab. Story text and lessons are on **Stories**. Definitions are on **Glossary**.

## The Approved rule

Words on the page, Protections, Stories and Glossary each have a **Status** column: Draft, Ready for review or Approved.

- **Preview** shows every row, whatever its Status. Use it to see drafts in place.
- **Deploy** publishes only **Approved** rows. Every other row keeps the wording that is live today. A brand-new row that isn't Approved stays off the public site.
- If you edit text that is already Approved, its Status goes back to **Ready for review** on its own. It needs approval again.
- Jake Laperruque approves wording, or someone he names. **Face Value › Wording** marks several selected rows at once.

## Preview and Deploy

| | Preview changes | Deploy to live site |
|---|---|---|
| Who sees it | Anyone with the `?preview` link | Everyone |
| Wording it uses | Every row | Approved rows only |
| File it writes | `data/preview.json` | `data/live.json` |
| Safe to press any time? | Yes | Only after a Preview you have looked at |

Deploy refuses to run if the sheet changed after the last Preview. Press Preview, look, then Deploy.

Before it publishes, Deploy shows a list of what will change. Changes to the map come first. Read it. If anything looks wrong, press Cancel.

## The menu

| Menu item | What it does |
|---|---|
| Check for problems | Finds mistakes and lists them, with a "Go to" link for each one. Changes nothing. |
| Preview changes | Publishes the preview, drafts included. |
| Open preview | Opens the preview pages in a new tab. |
| Deploy to live site… | Shows what will change, then publishes to the public site if you confirm. |
| Undo last deploy… | Puts back the live site as it was before the last Deploy. The sheet keeps your edits. |
| Wording › Mark selected rows Approved | Approves the rows you selected. |
| Wording › Mark selected rows Ready for review | Sends the selected rows back for review. |
| Every 6 months › Start a new refresh checklist | Saves the old ticks to the Change log and clears the checklist. |
| Every 6 months › Check links (slow) | Tries every law and bill link and lists the ones that fail. |
| Setup › Check GitHub key | Tests the publishing key without changing anything. |
| Setup › Set GitHub key… | Saves a new key, only if it passes the test. |
| Setup › Publish from this sheet | Makes this sheet the one allowed to publish. Use it only when CDT moves to a new copy. |
| Setup › Upgrade or repair this sheet… | Puts back headers, dropdowns, notes and colours if they got broken. Your data stays as it is. |
| Setup › Undo the upgrade… / Remove upgrade backups… | One-time upgrade tools. See RUNBOOK.md. |
| Setup › About this script | Shows the script version. |

## Marks in Quotes › Exact wording

- `**words**` shows the words in bold. Use it for the key words.
- `((words))` highlights the words with an "Also allowed" label. Use it for an extra use the law permits.
- `[[words]]` highlights the words with an "Exception" label. Use it for a carve-out from the rule.

Every mark must be closed. Check for problems flags one left open.

## Protection columns on Laws and Bills

- **Blank:** the law or bill doesn't add this protection.
- **Full:** it adds the protection in full.
- **A code from the Limits tab,** such as "lineups only": it adds a limited version.

Every protection a law adds needs at least one quote on the Quotes tab. Laws › Quotes (auto) shows what is missing.

## What never to do

- **Never rename, delete or move the header row.** The script finds columns by their names. If it happens, use Setup › Upgrade or repair this sheet.
- **Never type in grey "(auto)" cells** or in the Change log. The script overwrites them.
- **Never add, delete or rename rows on the States tab.** The map has exactly 51 places.
- **Never change a Key** on Words on the page, Protections, Glossary, Limits or Labels. The site looks rows up by key.
- **Never Deploy without looking at the preview first.**
- **Never put the GitHub key in a cell, an email or a chat.** Use Setup › Set GitHub key only.
- **Never edit `data/live.json` or `data/preview.json` by hand** on GitHub. Only the sheet writes them.
- **Never share the sheet as "Anyone with the link".** It holds drafts and reviewer notes. Add people by name.
- **Never delete the hidden tabs.** Use Setup › Remove upgrade backups when the runbook says so.

## Who to ask

- **Content and wording:** Jake Laperruque.
- **Publishing and the GitHub key:** the key owner. Their GitHub name shows in Settings › GitHub key (auto).
- **Everything else:** [RUNBOOK.md](RUNBOOK.md).

## For developers

- The JSON the sheet writes is described in [../data/SCHEMA.md](../data/SCHEMA.md).
- `node sheet/test_roundtrip.js` runs the sheet's test suite and ends with ROUND TRIP OK.
- `sheet/Code.gs` is the whole script. The copy inside the sheet is pasted in by hand, so keep the two the same. Check for problems warns when the sheet's copy is older.
