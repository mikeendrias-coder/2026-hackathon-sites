# Editing Face Value from the Google Sheet

The site reads `data/live.json`. With `?preview` at the end of the address it reads `data/preview.json`
and shows a yellow PREVIEW bar. The Google Sheet writes both files through GitHub.

Sheet: "Face Value: site control sheet" in Michael's Google Drive.

## Everyday use
1. Edit any tab. Add a law or bill by adding a row.
2. **Face Value > Check for problems**, and fix what it lists.
3. **Face Value > Preview changes**. About a minute later the preview link shows the edits.
4. **Face Value > Deploy preview to live site** copies the last preview to the public site.

Protection columns on Laws and Bills: blank = not added, `Full` = added in full, or a code from the Limits tab = a limited version.

Marks in the Quotes tab's Exact wording column:
- `**words**` bold key words
- `((words))` amber highlight with an "Also allowed" bubble
- `[[words]]` amber highlight with an "Exception" bubble

## One-time install
1. In the sheet: Extensions > Apps Script. Replace the contents of `Code.gs` with `sheet/Code.gs` from this folder. Save.
2. In the editor, pick `setupFromSite` in the function list and press Run. Google asks to authorize the script; approve it. This fills every tab from the live site.
3. Reload the sheet. The **Face Value** menu appears.
4. Make a GitHub key: github.com > Settings > Developer settings > Fine-grained tokens > Generate new token.
   Repository access: only `2026-hackathon-sites`. Permissions: Contents, Read and write. Nothing else.
5. In the sheet: Face Value > Setup > Set GitHub key, and paste it.

The key is stored in the script's properties, not in a cell. Anyone who can edit the script can read it,
so give edit access only to people who should be able to publish.

## Moving to the CDT repository
Change GitHub owner, Branch, Folder and Site address on the Settings tab, and set a key for that repository.

## Checks
`node sheet/test_roundtrip.js` confirms that site data -> sheet tabs -> site data gives back the same data.
