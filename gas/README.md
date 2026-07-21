# Google Apps Script gateway (Milestone 3)

This folder holds the **cloud receptionist** for Home Inventory: a Web App that reads/writes your Google Sheet and stores item photos in a Drive folder.

The Expo app talks to this gateway from **Settings** (URL + folder id), **Export → Google Sheets**, and **Import → Import from Sheets**.

## Two places, one source of truth (read this first)

Beginners often confuse these. They are **not** the same thing:

| Place | What it is | Who edits it |
|-------|------------|--------------|
| **`gas/Code.gs` in this repo** | Local copy of the script for version control | You (in Cursor / your editor) |
| **Apps Script editor** (Sheet → **Extensions → Apps Script**) | The live code Google actually runs | You paste `Code.gs` here, then **deploy** |
| **Row 1 of the Google Sheet** | Headers the script **writes** | The script (`ensureHeaderRow`) — not you by hand |

**Mental model:** `Code.gs` is the recipe. The Apps Script editor is the kitchen. The Sheet’s header row is the plated dish.

- Change column names / layout in **`Code.gs`** (in Cursor), paste that whole file into the **Apps Script editor**, then **deploy a new version**.
- Do **not** hand-edit Sheet row 1 to “add columns.” The script owns that row and will overwrite the first 18 header cells from `HEADER_ROW` in `Code.gs`. Hand-edits leave leftover columns and confuse data.

Saving in the Apps Script editor alone does **nothing** for the phone. The app calls the **deployed Web App `/exec` URL**, which runs a **frozen version** until you deploy again.

## What it does

| HTTP | Action | Purpose |
|------|--------|---------|
| `GET ?action=ping` | Health check | Confirm the deployment URL works |
| `GET ?action=download` | Read Sheet | Return all inventory rows as JSON |
| `GET ?action=download&houseName=Beach%20House` | Filtered read | Same, one house only |
| `POST` `{ "action": "checkDuplicates", "items": [...] }` | Detect clashes | Find rows that already exist (no writes) |
| `POST` `{ "action": "upload", "duplicateMode": "skip"\|"override", ... }` | Write | Upload Base64 images to Drive + create/update Sheet rows |

Duplicate match rules (in order):

1. Same `sheetRowId` if the phone already has one  
2. Else same **house + room + item name** (case-insensitive)

## Sheet columns (header row 1)

These names live in `HEADER_ROW` inside [`Code.gs`](./Code.gs). On every ping / download / upload, the script writes them into **row 1 of the first tab** of the spreadsheet:

`sheet_row_id`, `house_name`, `room_name`, `item_name`, `brand`, `model`, `category`, `purchase_price_usd`, `purchase_date`, `description`, `Primary Photo`, `Additional Photo 1`, `Additional Photo 2`, `Additional Photo 3`, `Additional Photo 4`, `item_images_json`, `updated_at`, `client_item_id`

- `Primary Photo` contains the primary Drive URL; the next four columns contain additional photo URLs in order.
- `item_images_json` stores an ordered JSON array of `{ imageId, imageNumber, sortOrder, isPrimary, driveImageUrl }` so import can rebuild every photo, including photos beyond the five visible URL columns.

### After you change `Code.gs` (recommended path)

Local SQLite on the phone is the inventory source of truth. Prefer this over hand-editing Sheet columns:

1. Paste the updated [`Code.gs`](./Code.gs) into the Apps Script editor (**Extensions → Apps Script** on that Sheet) and Save.
2. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy** (keep the same Web App so the `/exec` URL stays the same when possible).
3. Put that Web App `/exec` URL in **both** local `.env` (`EXPO_PUBLIC_GAS_WEB_APP_URL`) **and** the phone’s in-app **Settings** (Settings wins if both are set). Restart Expo / rebuild if you only changed `.env`.
4. Clear the **first tab** of the Sheet (or use a fresh empty first tab).
5. Upload from the app (**Export → Google Sheets**) and choose **Override all** if asked about duplicates.
6. Confirm row 1 matches the list above and that sample cells line up (e.g. category under `category`, not under `model`).

### Advanced: keep existing Sheet rows (only if you must)

Only if you cannot clear the Sheet and must preserve live cloud rows under an older layout:

1. Update + redeploy `Code.gs` first (steps 1–3 above).
2. In the **Google Sheet** (not the Apps Script editor), carefully insert/rename columns so data stays under the matching headers — never rewrite headers alone without shifting cells.
3. Optionally convert year-only cells like `2020` → `2020-01-01`.

Rewriting only the header row without shifting data will misalign existing cells. Prefer the clear-and-reupload path above whenever you can.

## Deploy (do this once in Google)

### 1. Create a Sheet + Drive folder
1. Create a Google Spreadsheet (e.g. **Home Inventory**).  
2. Create a Drive folder for photos (e.g. **Home Inventory Photos**).  
3. Open the folder → copy the **folder id** from the URL (the long id after `/folders/`, **not** the whole URL):

`https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID`

### 2. Add the script
1. In the Sheet: **Extensions → Apps Script** (this opens the editor bound to *this* spreadsheet).  
2. Delete any stub code.  
3. Paste the **entire** contents of [`Code.gs`](./Code.gs) from this repo.  
4. Save the project (name it **Home Inventory Gateway**).

### 3. Script Property for Drive (recommended)
1. In Apps Script: **Project Settings** (gear) → **Script properties**.  
2. Add property:
   - Name: `DRIVE_FOLDER_ID`  
   - Value: your Drive folder id  
3. Save.

You can also pass `driveFolderId` in each upload JSON later from the app settings.

### 4. Deploy as Web App
1. **Deploy → New deployment**.  
2. Type: **Web app** (not Library).  
3. Execute as: **Me**.  
4. Who has access: **Anyone** (required so the phone can call it without Google login UI).  
5. Deploy → copy the **Web app URL** that ends in `/exec`  
   (`https://script.google.com/macros/s/.../exec`).

> **Saving ≠ deploying.** Every time you change `Code.gs` in the editor: Save, then **Deploy → Manage deployments → Edit → Version: New version → Deploy**.  
> Prefer editing the **existing** Web App deployment (same `/exec` URL) over creating a brand-new deployment (new URL → update `.env` + phone Settings again).

### 5. Smoke-test in a browser
Open:

`YOUR_WEB_APP_URL?action=ping`

You should see JSON like:

```json
{ "ok": true, "action": "ping", "message": "Home Inventory GAS gateway is reachable." }
```

Then try:

`YOUR_WEB_APP_URL?action=download`

A successful `ping` only proves the URL is reachable — it does **not** prove you deployed the latest `Code.gs`. After code changes, always deploy a **New version**.

### 6. Store the URL for the app
Paste the **Web App `/exec` URL** into:

- Local `.env` as `EXPO_PUBLIC_GAS_WEB_APP_URL=...` (see [`.env.example`](../.env.example)), and/or  
- Optional private notes file: copy [`secrets.local.md.example`](./secrets.local.md.example) → `secrets.local.md` (gitignored)  
- In-app **Settings** (gear icon in the header) → saves to `app_settings` on the phone

**Priority:** Export/Import use the URL from **in-app Settings first**, then fall back to `EXPO_PUBLIC_GAS_WEB_APP_URL`. If Settings still has an old URL, updating `.env` alone will not fix uploads.

`EXPO_PUBLIC_*` values are inlined when Metro/Expo builds the JS. After editing `.env`, restart with a clean cache (`npx expo start -c`) or rebuild the native app.

Export uses **Export → Google Sheets**; Import uses **Import → Import from Sheets**.

## Beginner glossary & checklist

| Term | Use this | Do not confuse with |
|------|----------|---------------------|
| **Web App URL** | Ends in `/exec` — what the phone calls | Library URL (for importing scripts into other Apps Script projects) |
| **`/exec`** | Stable deployed Web App endpoint | `/dev` (editor “test deployment”; not for the phone) |
| **Drive folder id** | Id after `/folders/` in the folder URL | The full Drive folder URL, or the Spreadsheet id |
| **Sheet row 1** | Written by the script from `HEADER_ROW` | Something you hand-edit to add columns |
| **Apps Script editor** | Where pasted `Code.gs` must live + be deployed | Editing cells in the Google Spreadsheet grid |

Quick checklist when columns look wrong after an upload:

- [ ] Apps Script editor’s `HEADER_ROW` matches [`Code.gs`](./Code.gs) in this repo  
- [ ] You deployed a **New version** *after* pasting that file  
- [ ] Phone Settings + `.env` both use that deployment’s **Web App `/exec`** URL (Settings wins)  
- [ ] You cleared the **first** tab (or used a fresh first tab) before re-uploading  
- [ ] Sample row: `model` / `category` / `purchase_price_usd` cells line up under those headers  

## Secrets checklist (treat like API keys)

Anyone with your Web App `/exec` URL can call the gateway. Keep Sheet links, Drive folder ids, and the Web App URL **private**.

### Never put real values in
- [ ] Git commits / pull requests / GitHub issues or discussions  
- [ ] `gas/README.md`, `.env.example`, or other tracked docs (placeholders only)  
- [ ] Screenshots, Slack/Discord, email threads, or public chat with Cursor/agents if the log might be shared  
- [ ] App store listings or public demo videos that zoom on Deploy → URL  

### Safe places for real values
- [ ] Local `.env` (already gitignored) — see [`.env.example`](../.env.example)  
- [ ] Optional `gas/secrets.local.md` (gitignored; start from `secrets.local.md.example`)  
- [ ] Apps Script **Script properties** (`DRIVE_FOLDER_ID`)  
- [ ] A password manager note labeled “Home Inventory GAS”  

### After deploy, verify
- [ ] `git status` does **not** show `.env` or `secrets.local.md` as new tracked files  
- [ ] Repo search / PR diff has no `script.google.com/macros/s/` live ids  
- [ ] Browser smoke tests use your private URL; you don’t paste that full URL into commits  

### Expo note (beginner-friendly)
`EXPO_PUBLIC_…` values are kept out of git, but they **are baked into the app binary**. Fine for a personal build you don’t redistribute widely — still don’t post the URL online.

## Security note (beginner-friendly)

“Anyone” access means **anyone who knows the URL** can read/write that Sheet via the script. For a personal inventory this is usually fine if you keep the URL private (like a house key). Do not post the URL publicly.

## Contract reference

TypeScript shapes the phone will use live in [`types/gasSync.ts`](../types/gasSync.ts). Keep `Code.gs` field names aligned with that file when you change either side.
