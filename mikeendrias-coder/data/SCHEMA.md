# Face Value data files: the JSON contract

For developers of any page that reads Face Value data.

The Google Sheet writes two files in this folder through the GitHub Contents API:

| File | Written by | Holds |
|---|---|---|
| `live.json` | Sheet › Deploy | Approved content. The public site. |
| `preview.json` | Sheet › Preview | The same shape, with Draft and Ready for review wording included. |

A page loads `preview.json` when its address has `?preview`, and `live.json` otherwise. **Never edit either file by hand.** The next Preview or Deploy overwrites it.

Two pages read these files today:

- the **old app** (`index.html` + `app.js` at the folder root), which reads the v1 fields only;
- the **new page** (`play/`), which reads the v1 fields plus the v2 additions.

Both must keep working on every file the sheet writes.

---

## 1. The rules

1. **Additive only.** v2 keeps every v1 field, with the same name, type and meaning. New data is added in new places only.
2. **Never add keys inside `states`, `laws`, `bills` or `quotes` objects.** The old app's search runs `JSON.stringify` over each law, bill and quote row (app.js:932). A new key such as a date would change what a search for "2026" finds. New per-row data goes in a map under `config`, keyed by row (see `config.leadQuotes`).
3. **The four top-level arrays keep their v1 key order.** New top-level and `config` keys come after the v1 ones, so a git diff of the first v2 Deploy shows only additions.
4. **One legacy value changes:** `states[Vermont].law` goes from `"Unchanged"` to `"Unchanged (none of the seven)"`. The rule that computes `law` now adds that suffix whenever no law in the state adds a protection. The old map still shows Vermont as a ban, because the ban check runs first (app.js:122-128). Nothing visible changes.
5. **`config.scores` is never written.** The new page computes scores with its own `play/logic.js`. One scoring source, no drift.
6. **`config.stories` stays exactly as it is,** including the federal-agent story the old app needs. The new page reads `config.examples` instead and never reads `config.stories`.
7. **`config.why` keeps exactly five keys:** `crime`, `approval`, `search`, `arrest`, `disclose`. An extra key (such as `trial`) would show up as a step note in the old app.
8. **Never write a `step` key inside `config.prot[k]`.** The old app merges `config.prot` into its own protection objects (app.js:52), and `step` would overwrite one of its fields.
9. **Pages must ignore fields they don't know,** and must not crash when a v2 field is missing. A v1 file has no `schema` key; treat it as schema 1 and use built-in defaults.

Sheet-only columns are never published: Last checked, Checked by, Research notes, Reviewer notes, Status, and the Settings dates that are not in `config.site`.

---

## 2. Top level

| Key | Type | Meaning | Since |
|---|---|---|---|
| `source` | string | The research note the site shows as its source line, e.g. "State Facial Recognition Laws and Bills memo, research current through Oct. 26, 2026." Built from Settings › Research note, with `{date}` filled in AP style. Byte-identical to v1 for the same date. | v1 |
| `updated` | string | ISO timestamp of the Preview or Deploy that wrote the file. The old app shows it in the preview bar. | v1 |
| `config` | object | Labels, wording and settings. See section 3. | v1 |
| `states` | array | One object per place on the map. Exactly 51. | v1 |
| `laws` | array | One object per state law. | v1 |
| `bills` | array | One object per bill. | v1 |
| `quotes` | array | Exact law or bill wording, one object per quote. | v1 |
| `schema` | number | `2`. A page can use it to tell a v2 file from a v1 file. | v2 |
| `generator` | string | `"Face Value sheet 2.0.0"`: the script version that wrote the file. For debugging only. | v2 |

---

## 3. `config` (v1 fields)

| Key | Shape | Meaning | Old app use |
|---|---|---|---|
| `config.prot` | `{"1".."7": {short, long}}` | The 7 protections. `short` is the name ("Judge must approve"); `long` is one plain sentence on what it means. Keys are the strings `"1"` to `"7"`. | app.js:52 |
| `config.limits` | `{code: {text, type}}` | Limited forms of a protection, keyed by the code used in `laws[].limits` and `bills[].limits`. `text` is lower-case plain words, e.g. "it only covers lineups". `type` is `narrow` (covers fewer cases), `weak` (a lower bar) or `loose` (widens police use). | app.js:53, 860 |
| `config.billSteps` | `{code: label}` | How bill progress is worded, keyed by `bills[].step`. | app.js:54 |
| `config.lawStatus` | `{code: label}` | How law status is worded, keyed by `laws[].status` (`Unchanged`, `New`, `Amended`). | app.js:55 |
| `config.stories` | `[{t, d, state, who, src, db, crime}]` | Teaching stories for the old app, all rows. `t` title, `d` description; the rest are case codes (section 7). `who` may be `federal` here. | app.js:101, 624-626 |
| `config.glossary` | `{key: {term, def}}` | Short definitions. Keys are stable IDs such as `face recognition`, `warrant`, `dmv`. | app.js:115 |
| `config.why` | `{crime, approval, search, arrest, disclose}` | One "why this step matters" note per case step. Exactly these five keys. | app.js:643 |

Some limit codes carry logic and must never be renamed: `lineups only` (app.js:228), and any code matching `/drone|body/` such as `drones only` and `body cameras only` (app.js:227, 864).

---

## 4. `config` (v2 additions)

| Key | Shape | Meaning |
|---|---|---|
| `config.prot[k].why` | string | One plain sentence on why protection `k` matters. Shown on the new page's scorecard. If missing, the page falls back to its built-in `FV_PROT_WHY[k]`. |
| `config.prot[k].order` | integer 1–7 | Position on the new page's scorecard, 1 = top. Seeded from the old order 3, 1, 6, 5, 7, 4, 2. |
| `config.words` | `{key: text}` | Wording for the new page, from the sheet's Words on the page tab. Only non-empty texts are written. Keys are defined in `play/words.js` (section 6). |
| `config.site` | object | Site status and dates. See below. |
| `config.leadQuotes` | `{"State\|Name\|k": index}` | Which quote the scorecard shows first for one law or bill and one protection. `index` is the 0-based position in the top-level `quotes` array. Only ticked rows appear; with no entry, use the first matching quote. |
| `config.examples` | `[{id, t, d, lesson, state, who, src, db, crime, order}]` | The 3 or 4 teaching stories the new page shows, from Stories rows with "Show on new page" ticked. |

### `config.site`

| Field | Type | Meaning |
|---|---|---|
| `status` | `"live"` or `"offline"` | From Settings › Site status. Always present. |
| `currentThrough` | `"YYYY-MM-DD"` | The date the legal research is current to. Always present. |
| `billYear` | `"YYYY"` | The current bill session, from Settings › Current bill session. Always present. The new page uses it for "Bills proposed in {year}". |
| `nextUpdate` | `"YYYY-MM-DD"` | Optional. When the next 6-month refresh is due. |
| `staleAfter` | `"YYYY-MM-DD"` | Optional. After this date the new page may show an out-of-date notice. |
| `offlineFrom` | `"YYYY-MM-DD"` | Optional. From this date on, the new page goes offline by itself. |

**Offline rule.** The new page goes offline when `config.site.status === "offline"`, or when `config.site.offlineFrom` is on or before today. When offline, it shows only the `offline.heading`, `offline.message`, `offline.linkText` and `offline.linkUrl` words, and adds the `is-offline` body class. The old app ignores `config.site`; see sheet/RUNBOOK.md section 4 for how the root is handled at sunset.

### `config.examples`

| Field | Meaning |
|---|---|
| `id` | A stable slug made from the title the first time, e.g. `indiana-lineup`. Used in links to the story. It doesn't change when the title is edited. |
| `t`, `d` | Title and short description. |
| `lesson` | One sentence on what the story teaches. |
| `state` | One of the 51 state names. |
| `who`, `src`, `db`, `crime` | Case codes (section 7). `who` is `local` or `state` only; the sheet refuses a shown story with a federal agent. |
| `order` | Order on the page, 1 = first. |

The new page uses `config.examples` when it is a non-empty array. It drops entries with an unknown state or code, and falls back to its built-in `FV_EXAMPLES` when nothing valid is left.

---

## 5. The four arrays (v1; frozen)

### `states[]`

| Key | Meaning |
|---|---|
| `name` | One of the 51 names: the 50 states plus "District of Columbia". An unknown name crashes the old app (app.js:544-547). |
| `law` | Computed by the sheet. `"No law"` when the state has no law. Otherwise the newest change wins: `New`, then `Amended`, then `Unchanged`. Then `" (none of the seven)"` is added when no law in the state adds a protection. |

### `laws[]`

| Key | Type | Meaning |
|---|---|---|
| `whoFor` | array | Which police the law binds: `["local","state"]`, `["local"]`, `["state"]` or `["any"]`. Must be an array (app.js:223). |
| `source` | `"drone"`, `"bodycam"` or null | Set when the law only reaches one kind of footage. |
| `db` | `"dmv"` or null | `"dmv"` when the law only covers searches of driver's license photos. |
| `state` | string | One of the 51 names. |
| `name` | string | Short name with the bill number, e.g. "Sole-basis rule (SB 56)". Unique within a state across laws and bills. Quotes point to it. |
| `status` | string | `Unchanged`, `New` or `Amended`, worded through `config.lawStatus`. |
| `year` | string | As shown, e.g. "2021; amended 2026". Starts with a 4-digit year. |
| `does` | string | One or two plain sentences on what the law does. |
| `who` | string | Who the law covers, in its own words. Must be a string (app.js:687). |
| `rules` | array | The protections the law adds, as `"1"`–`"7"`. Empty for a law that adds none. |
| `limits` | object | `{rule: limitCode}` for each protection added only in a limited form. A rule in `rules` with no entry here is added in full. |
| `review` | boolean | True when how to count this law is unclear. |
| `cite` | string | Official citation. |
| `link` | string | Link to the official text (https). |
| `reviewRules` | array | Only when `review` is true. The protections that are unclear. Empty means the law as a whole is unclear, with no protection marked. |
| `reviewNote` | string | Optional, only when `review` is true. One sentence on what is unclear. |
| `bars` | object | Optional. `{src, text}`: the law stops any face search using footage `src` (e.g. Illinois and drones). |
| `note` | string | Optional public note. |
| `ban` | object | Optional. `{who, kind, text, except}`. `kind` is `Ban` or `Pause`; `who` is an array like `whoFor` (app.js:263); `text` is one sentence; `except` lists exceptions (may be empty). A ban stops every search by the police it covers. |
| `banException` | true | Optional. Marks a law that carves out of the state's ban (Vermont H.195). |

Optional keys are left out when empty. A law's protection is counted in full only when it has no limit, no `source`, no `db`, and binds both local and state police (app.js:134-140).

### `bills[]`

| Key | Type | Meaning |
|---|---|---|
| `state`, `name` | string | As for laws. `name` includes the session, e.g. "SB 1135 (2024)". |
| `pending` | boolean | True when the bill can still pass (two-year sessions carry bills over). |
| `year` | string | Session year, exactly 4 digits. The highest year in the file is the "last session" (app.js:245). |
| `step` | string | How far it got, a key of `config.billSteps`. |
| `does` | string | What the bill would do. |
| `rules`, `limits` | array, object | What the bill would add if passed, as for laws. |
| `sponsor` | string | Lead sponsor(s). |
| `link` | string | Link to the bill text. |
| `note` | string | Optional public note. |

A bill counts as "this session" when its `year` equals the highest bill year, or it is `pending`.

### `quotes[]`

| Key | Type | Meaning |
|---|---|---|
| `kind` | string | `"Law"` or `"Bill"`. |
| `state`, `item` | string | The law or bill this wording comes from. `state` + `item` must match a law's or bill's `state` + `name` (app.js:909). |
| `rule` | string or null | The protection it supports, `"1"`–`"7"`, or null for related wording that isn't scored. |
| `cite` | string | Pinpoint citation. |
| `text` | string | The exact wording, with marks: `**bold**` key words, `((also allowed))` an extra permitted use, `[[exception]]` a carve-out. Marks are always balanced. |

---

## 6. Word keys and gating

`play/words.js` is the one source of word keys and their default text. `node qa/words-table.cjs --write-gs` copies them into the `WORD_KEYS` block of `sheet/Code.gs`, and `--check` fails if the two drift. To add a key, add it to `words.js` first.

- **Placeholders** look like `{state}` or `{count}`. The sheet refuses a fill-in a key doesn't list.
- **URL keys** are the keys whose last segment ends in `url` or `Url`, e.g. `offline.linkUrl`, `risk.url`. Their values are always https URLs.
- **Unknown keys** typed into the sheet are still published, so a developer can add a key from the sheet side first.
- **`why.*` rows** on the Words tab are published only to `config.why`, never to `config.words`.

**Merge order on the new page:** `FV_WORDS`, then `config.words` (empty strings ignored). Protection names and meanings come from `config.prot[k].short` and `.long`; the why line from `config.prot[k].why`, falling back to `FV_PROT_WHY`. Limits text comes from `config.limits[k].text`.

**Gating.** Words on the page, Protections, Stories and Glossary rows each have a Status in the sheet.

| | Preview (`preview.json`) | Deploy (`live.json`) |
|---|---|---|
| Draft or Ready for review | published | not published; the value already live is kept |
| Approved | published | published |
| New row, still in Draft or Ready for review | published | left out |

So `live.json` only ever changes wording that someone approved.

---

## 7. Case codes

| Field | Values |
|---|---|
| `who` | `local`, `state` (and `federal` in `config.stories` only) |
| `src` | `photo` (still photo), `cctv` (security camera), `drone`, `bodycam` |
| `db` | `dmv` (driver's license photos), `mug` (mugshots) |
| `crime` | `serious` (armed robbery), `minor` (shoplifting) |

An invalid code in `config.stories` crashes the old app (app.js:624-626), so the sheet refuses one.

---

## 8. Size and safety

- `live.json` is about 120 KB. The sheet warns above 700 KB and refuses above 950 KB (the Contents API read limit is 1 MB).
- Every build is run through the old app's contract checks (types, known state names, quotes that resolve) before it is written.
- Wording from the sheet is plain text. Pages must escape it before putting it in HTML. Quote marks are turned into HTML only by `FVKit.markup`, after escaping.
