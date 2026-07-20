# Google Apps Script gateway (Milestone 3)

This folder holds the **cloud receptionist** for Home Inventory: a Web App that reads/writes your Google Sheet and stores item photos in a Drive folder.

The Expo app talks to this gateway from **Settings** (URL + folder id), **Export → Google Sheets**, and **Import → Import from Sheets**.

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

The script creates/fixes these headers on first use:

`sheet_row_id`, `house_name`, `room_name`, `item_name`, `brand`, `category`, `purchase_price_usd`, `purchase_year`, `description`, `drive_image_url`, `updated_at`, `client_item_id`

## Deploy (do this once in Google)

### 1. Create a Sheet + Drive folder
1. Create a Google Spreadsheet (e.g. **Home Inventory**).  
2. Create a Drive folder for photos (e.g. **Home Inventory Photos**).  
3. Open the folder → copy the **folder id** from the URL:

`https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID`

### 2. Add the script
1. In the Sheet: **Extensions → Apps Script**.  
2. Delete any stub code.  
3. Paste the contents of [`Code.gs`](./Code.gs).  
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
2. Type: **Web app**.  
3. Execute as: **Me**.  
4. Who has access: **Anyone** (required so the phone can call it without Google login UI).  
5. Deploy → copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).

> Re-deploy (**New version**) whenever you change `Code.gs`.

### 5. Smoke-test in a browser
Open:

`YOUR_WEB_APP_URL?action=ping`

You should see JSON like:

```json
{ "ok": true, "action": "ping", "message": "Home Inventory GAS gateway is reachable." }
```

Then try:

`YOUR_WEB_APP_URL?action=download`

### 6. Store the URL for the app
Paste the Web App URL into:

- Local `.env` as `EXPO_PUBLIC_GAS_WEB_APP_URL=...` (see [`.env.example`](../.env.example)), and/or  
- Optional private notes file: copy [`secrets.local.md.example`](./secrets.local.md.example) → `secrets.local.md` (gitignored)  
- In-app **Settings** (gear icon in the header) → saves to `app_settings` on the phone

Export uses **Export → Google Sheets**; Import uses **Import → Import from Sheets**. Both read the URL from Settings first, then fall back to `EXPO_PUBLIC_*`.

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
