# Face Value runbook

Step-by-step guides for the jobs that come up a few times a year. For everyday edits, read [README.md](README.md) first.

Contents:

1. [The 6-month refresh](#1-the-6-month-refresh)
2. [The GitHub key](#2-the-github-key)
3. [Undo and restore](#3-undo-and-restore)
4. [The exit plan: taking the site offline](#4-the-exit-plan-taking-the-site-offline)
5. [Handing the site to CDT](#5-handing-the-site-to-cdt)
6. [First-time upgrade to sheet v2](#6-first-time-upgrade-to-sheet-v2)
7. [When something fails](#7-when-something-fails)

---

## 1. The 6-month refresh

**When:** twice a year.

- **January,** as state legislative sessions start.
- **Early summer,** before the NCSL summit. A summer intern can run this one.

Settings › Next update due holds the date. It turns amber 30 days before and red once it has passed.

**Before you start:** run **Face Value › Every 6 months › Start a new refresh checklist**. It saves last time's ticks to the Change log and clears the Refresh checklist tab. Then work down that tab. Tick each step and fill in Date done.

| # | Step | How |
|---|---|---|
| 1 | Back up | File › Make a copy. Name it "Face Value sheet backup YYYY-MM". Keep it private: it may carry the GitHub key. Don't edit it. |
| 2 | Check the GitHub key | Setup › Check GitHub key. If it expires within 60 days, renew it now (section 2). |
| 3 | January only: new bill session | Settings › Current bill session = the new year. Bills from a later year are refused until you do this. |
| 4 | Re-read every law | Open each law's Link and compare it with its Laws row. Fix the row. Set Status to New or Amended if it changed. Fill Last checked and Checked by. |
| 5 | Reset old statuses | Laws marked New or Amended at the last refresh go back to Unchanged, unless they changed again. |
| 6 | Bills | Add bills from the new session. On older bills, update Progress and untick Still alive for bills that died. |
| 7 | Quotes | Every protection a law or bill adds needs a quote. Laws › Quotes (auto) lists what is missing. Copy the wording exactly, with a pinpoint citation. |
| 8 | States | Read States › Scorecard (auto) for each state with a change. If it is right, fill Last checked and Checked by. |
| 9 | Research date | Settings › Research current through = the date the research is current to (yyyy-mm-dd). |
| 10 | Dated wording | On Words on the page, find rows that mention a date or a year. Fix them and set them to Ready for review. |
| 11 | Approve wording | Jake and comms read the Ready for review rows. They mark each one Approved or leave a Reviewer note. |
| 12 | Stories | Open each story on the preview page. Check its lesson still holds. If a law changed, the story may need new text. |
| 13 | Check for problems | Fix every error. Read every heads-up. |
| 14 | Preview | Preview changes, then Open preview. On a phone, check 5 states, including one with a new law. |
| 15 | Sign-off | Jake reads the preview and signs off. Write who and when in the Notes column. |
| 16 | Deploy | Deploy to live site…. After a minute, check the live site shows the new research date. |
| 17 | Next update | Settings › Next update due = 6 months from today. Move the calendar reminder to match. |
| 18 | Sunset check | If Settings › Sunset decision by is within 2 months, decide with comms: extend, or go offline (section 4). |
| 19 | Links | Every few refreshes: Every 6 months › Check links (slow). Fix any broken link. |

**A law changed what it covers?** Update its protection columns and quotes in the same sitting. Check for problems refuses a protection with no quote.

**A state passed a ban or a pause?** On Laws, set "Ban, pause or exception", "Ban covers" and "Ban text". Ask Jake to read the result on the preview before Deploy.

---

## 2. The GitHub key

The sheet publishes through a GitHub "fine-grained personal access token". It is stored inside the script (Script Properties), never in a cell.

### Check the key

**Face Value › Setup › Check GitHub key.** It makes no change on GitHub. The result goes to Settings › GitHub key (auto), for example "OK · owner cdt-face-value-bot · expires 2027-05-01".

If it says the branch is protected, direct writes may be refused. See section 7.

### Make a new key (rotation)

Do this before the old key expires. Preview and Deploy start warning 30 days ahead.

1. Sign in to GitHub as the account that should own the key (see "Moving the key to CDT" below).
2. Go to Settings › Developer settings › Personal access tokens › Fine-grained tokens › Generate new token.
3. Name: "Face Value sheet". Expiration: 1 year at most.
4. Resource owner: the account or organization that owns the repository.
5. Repository access: **Only select repositories**, and pick only the site's repository.
6. Permissions: **Contents: Read and write.** Leave everything else at No access. (Metadata: Read-only is added on its own.)
7. Generate the token and copy it. GitHub shows it only once.
8. In the sheet: **Face Value › Setup › Set GitHub key…** and paste it.
9. The sheet tests the key first. It saves the key only if the test passes. If it fails, the old key stays in place and the message says why.
10. On GitHub, delete the old token.
11. Put a calendar reminder 2 weeks before the new expiry date.

Never paste the key in a cell, an email or a chat. Anyone who can edit the script can read it, so give sheet edit access only to people who should publish.

### Moving the key to a CDT-owned account

Right now the key may belong to Michael's own GitHub account. When he leaves, it must belong to CDT.

1. CDT picks the owner: a shared CDT GitHub account (a "bot" account), or a CDT staff member's account in the CDT GitHub organization. A bot account is safer, since it doesn't leave when a person does.
2. That account needs write access to the repository. If the site moves into the CDT organization first, do that move before making the key.
3. If the repository is in an organization, an org owner may need to approve fine-grained tokens. Ask CDT's GitHub admin.
4. Make the key as above, signed in as the new owner.
5. Set GitHub key in the sheet, then Check GitHub key. Settings › GitHub key (auto) should show the new owner.
6. Ask Michael (or the old owner) to delete their old token.
7. Write the owner's name on the Start here tab under "Who to ask" if it changed.

### If the site's repository moves

Change these Settings rows to match the new home, then set a key for that repository:

- GitHub owner
- GitHub repo
- Branch
- Folder
- Site address (and New page address, if used)

Run Check GitHub key, then Preview, before any Deploy.

---

## 3. Undo and restore

### The live site looks wrong after a Deploy

**Face Value › Undo last deploy….** It shows what will change back, then asks you to confirm.

- It puts back the live site exactly as it was before the last Deploy.
- The sheet keeps your newer edits. Fix them, Preview, then Deploy again.
- Pressing Undo a second time redoes the Deploy you undid.
- Every Undo is written to the Change log.

### Going back further

The Change log lists every Deploy with a link to its change on GitHub.

- If your menu has **Restore an earlier version**, it lists the last 10 versions of the live site. Pick one and confirm.
- Otherwise, ask a developer to revert the commit on GitHub. The Change log row has the link.

### The sheet itself got messed up

- **A few cells or one tab:** File › Version history › See version history. Find a time before the mistake. Restore it, or copy the good cells back.
- **Headers, dropdowns, notes or colours broke:** Face Value › Setup › Upgrade or repair this sheet…. It repairs the structure and leaves your data alone.
- **A lot is gone:** open the backup copy from the last refresh and copy the good rows back.
- **The whole sheet is lost:** a developer can rebuild it from the live site. In Extensions › Apps Script, run `rebuildFromLive` inside a new, empty sheet. Sheet-only notes (Research notes, Reviewer notes, Last checked) can't come back this way.

---

## 4. The exit plan: taking the site offline

The team agreed the site may come offline about a year after launch. The offline message is written and approved in advance, so going offline is quick.

### Decide

- Settings › Sunset decision by holds the date to decide. The sheet warns 60 days before.
- Jake and comms decide: extend (set a new Sunset decision by and keep refreshing), or go offline.

### Get the offline wording ready

These rows live on **Words on the page**:

| Key | What it is |
|---|---|
| `offline.heading` | The heading visitors see. |
| `offline.message` | A short message saying the tool is no longer updated. It can use the `{date}` fill-in. |
| `offline.linkText` | The words on the link. |
| `offline.linkUrl` | Where the link goes, for example a CDT page on face recognition. It must start with `https://`. |

All four must be **Approved**. Check for problems shows an error while the switch is on and the message isn't Approved.

### Flip the switch

Pick one:

- **Now:** Settings › Site status = **Offline**. Then Preview, look, and Deploy.
- **On a set day:** Settings › Offline from = the date (yyyy-mm-dd). Then Preview and Deploy once. The new page goes offline on that day by itself.

Once offline, the new page shows only the offline heading, message and link. The map and the data stay in the sheet and on GitHub.

### The older four-tab site

The older site at the folder root does not read the offline switch. Before the sunset date, one of these must be true:

- the new page has replaced the old one at the root address; or
- a developer has replaced the old root page with a plain offline page.

Check the root address after the switch. If it still shows the old map, ask a developer.

### Going fully dark (optional)

If CDT wants the pages gone completely, a developer can remove the folder or turn off GitHub Pages for the repository. Keep the sheet as a read-only archive: set everyone except one owner to Viewer.

### Bringing it back

Set Settings › Site status = Live and clear Offline from. Then Preview and Deploy.

---

## 5. Handing the site to CDT

The goal: CDT can run the site with no help from Michael. Work through this list before his externship ends.

### People and access

1. Sheet sharing is **Restricted** (no "anyone with the link"). Add each CDT editor by name.
2. Jake Laperruque is an editor and approves wording.
3. At least two CDT people can run the refresh. Walk one of them through a Preview with this runbook open.

### Move the sheet to a CDT Shared Drive

Files in a Shared Drive belong to CDT, so they stay when a person leaves.

**Option A: move the sheet (best).** The sheet keeps its ID, its history, its script and its key.

1. A CDT Google admin or manager creates (or picks) a Shared Drive, for example "Face Value".
2. They add the sheet's current owner to it as **Content manager** for the move.
3. The owner opens Google Drive, right-clicks the sheet › Organize › Move, and picks the Shared Drive.
4. Drive may refuse the move, for example when the owner's account is outside CDT. Then use Option B.
5. Open the sheet. Run Check for problems and Preview. Both should work as before.

**Option B: copy the sheet.** Use it only if the move is blocked.

1. A CDT account opens the sheet, then File › Make a copy into the Shared Drive.
2. The copy brings the script along, and may carry the GitHub key too. In the copy, run Setup › Check GitHub key. If it fails, or the key should change owner, use Set GitHub key.
3. In the copy: **Face Value › Setup › Publish from this sheet.** Until then the copy refuses to publish, which stops two sheets from fighting.
4. Authorize the script in the copy when asked.
5. Run Check for problems, then Preview, from the copy.
6. Set the old sheet to view-only for everyone, and rename it "OLD, do not use".

### Move the key and the repository

1. Move the GitHub key to a CDT-owned account (section 2).
2. If the site moves into a CDT repository, update the Settings rows (section 2). Watch for a protected branch (section 7).

### Dates and reminders

1. Put Settings › Next update due and Sunset decision by on a shared CDT calendar.
2. Add a reminder for the GitHub key's expiry date.

### Last steps

1. Run one full refresh-and-Deploy with a CDT person at the keyboard.
2. Remove Michael's personal accounts from the sheet and the repository.
3. Update "Who to ask" on the Start here tab.

---

## 6. First-time upgrade to sheet v2

Michael does this once, by hand. The upgrade is in place: same sheet, same ID, no data lost.

**Before:**

1. Set the sheet's link sharing to **Restricted**. Add Jake as an editor.
2. File › Make a copy. Name it "Face Value sheet — BACKUP before v2 (date) — do not edit". Keep it private.
3. Open the sheet signed in as **mendrias@cdt.org**. This shows early whether CDT's admin settings block the script.

**Install the script:**

4. Extensions › Apps Script. In Code.gs, select all and paste the raw `sheet/Code.gs` from the branch. Save. The version near the top should read 2.0.0.
5. In Project Settings (the gear), set the time zone to America/New_York, matching File › Settings in the sheet.

**Run the upgrade:**

6. Reload the sheet. Pick **Face Value › Upgrade this sheet to v2…** and authorize the script.
   - It asks for: this spreadsheet only, outside requests (GitHub), dialogs, and your email address.
   - If Google says the app is unverified: Advanced › Go to Face Value.
   - Then pick the menu item again.
7. Read the dry run. It changes nothing.
   - Expected: no rows lost. The only label change is Vermont's, and the site looks the same.
   - Expected heads-ups: drone-only is marked twice on 2 laws.
   - Read the "sheet vs live" part closely. The sheet was edited on Nov. 23 after the last preview, so those edits show up here.
   - Paste the link to your backup copy in the box.
8. Ask other editors to close the sheet. Click **Upgrade now.** It takes about a minute.

**After:**

9. Setup › Check GitHub key. If it fails, make a new key (section 2) and use Set GitHub key.
10. Check for problems, then Preview changes, then Open preview. The old site's preview should look the same as the live site. Check Maryland, Vermont and Kentucky.
11. Turn on the Google Sheets connector in Claude, signed in as the account that edits the sheet. **Don't Deploy yet.** Claude checks the upgrade and drafts the new wording as Draft rows.

**If the upgrade goes wrong:** Setup › Undo the upgrade… puts the v1 tabs back from the hidden backups. After about 30 days of normal use, Setup › Remove upgrade backups… deletes the hidden "v1 backup:" tabs.

---

## 7. When something fails

| Message or problem | What to do |
|---|---|
| "Set a GitHub key" | No key is stored. Setup › Set GitHub key… (section 2). |
| Key wrong or expired (401) | Make a new key (section 2). |
| "Try in an hour" (rate limit) | GitHub is limiting requests. Wait an hour. |
| Key can't write (403) | The key needs Contents: Read and write on this repository. Make a new key. |
| Not found (404) | One of GitHub owner, GitHub repo, Branch or Folder on Settings is wrong. The message says which. |
| Branch is protected, or 422 | The branch needs reviews before changes. Ask the repo admin to publish the site from a branch the sheet can write to. |
| "Press again" (409) | Someone else published at the same moment. Press the button again. |
| "GitHub is having problems" | Wait a few minutes and try again. |
| "Try tomorrow" | Google's daily script limit ran out. Try the next day. |
| "Someone else is publishing" | Another person is running Preview or Deploy. Wait a minute. |
| "The sheet changed since the last preview" | Press Preview, look at it, then Deploy. |
| "Nothing to deploy" | Live already matches the sheet's Approved content. |
| This copy can't publish | You are in a copy. Use the main sheet, or run Setup › Publish from this sheet if CDT has moved to this copy. |
| Script is older than the one on GitHub | Paste the newer `sheet/Code.gs` into Extensions › Apps Script, as in section 6 step 4. |
| A header was renamed | Setup › Upgrade or repair this sheet… puts it back. |
| "GitHub is still building" after Deploy | Wait a minute and reload the site. |

Every error has a Details fold with the raw code. The Change log's Result column keeps it too. Send both to whoever owns the key.
