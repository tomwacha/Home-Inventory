# Home Inventory

A local-first Android app for cataloging home possessions for insurance documentation. Capture item details and photos offline, export PDF or CSV, and optionally sync to your own Google Spreadsheet and Drive folder through a lightweight Google Apps Script gateway—no Firebase or third-party database required.

| | |
|---|---|
| **Platform** | Android (Expo development build) |
| **Stack** | Expo SDK 54 · React Native · TypeScript · Expo Router |
| **Local data** | SQLite (`expo-sqlite`) + image files (`expo-file-system`) |
| **Cloud (optional)** | Google Apps Script → Sheets + Drive |
| **License** | [MIT](LICENSE.md) |

Product requirements: [Home-Inventory-Product-Brief.md](Home-Inventory-Product-Brief.md).  
Cloud gateway deploy guide: [gas/README.md](gas/README.md).

---

## Features

### Inventory management
- Multiple houses, rooms, and items with categories
- Item fields include brand, **model**, category, purchase price, **purchase date** (`YYYY-MM-DD`), and description
- Search items by name or description within a house, and within a single room
- House totals on the house page (rooms, item count, and purchase value)
- Required-name fields marked with `*` on house, room, item, category, and policy forms
- Per-house insurance policies (company, phone, policy number, expiration, declarations photo) — **local only**; not included in Sheets/Drive sync or PDF/CSV export. Manage from House → **View Policies**
- Edit screens to rename houses, rooms, and categories
- Confirmed local delete for houses, rooms, items, categories, and policies

### Photos
- Camera or gallery capture via `expo-image-picker`
- Settings → **Default photo source** auto-saves Camera/Gallery for empty photo taps (faster Add Item); changing an existing photo still shows camera / gallery / remove
- **Multiple photos per item**: primary photo + thumbnail strip + Add photo; filenames like `House Name - Item Name - NN - PhotoDatabaseID.jpg`
- Automatic downscale (max 1024px) and JPEG compression (quality 0.7)
- Per-house photo folders on device
- Thumbnails on room lists; primary + strip on item detail

### Offline export
- **Landscape Letter PDF** with a **2×2** inventory grid; items with 2+ photos also get full-page photo sheets (`expo-print`)
- CSV spreadsheet text (includes photo count and Drive image URLs when synced)
- System share sheet (`expo-sharing`) for email, Drive, Files, etc.

### Cloud sync (optional)
- Settings → **Cloud Sync Settings** for Web App URL and Drive folder id (separate from photo defaults)
- Settings footer shows the app version from `app.json`
- Export → Google Sheets: upload rows + **every item photo**; duplicate skip/override prompt
- Import → merge Sheet rows for the current house into SQLite (restores all photo URLs when present; does not wipe phone-only items)
- Sync status shown on item detail (`Local only` / `Synced`)

**Note:** Deletes are local only. Removing data on the phone does not remove Sheet rows or Drive files, and vice versa.

When upgrading an existing Sheet after this release, follow the column migration notes in [gas/README.md](gas/README.md) (`model`, `purchase_date`, `item_images_json`) before redeploying `Code.gs`.

---

## Architecture

```text
┌─────────────────────────────┐
│  Expo app (Android)         │
│  SQLite + local JPEG files  │
└──────────────┬──────────────┘
               │ fetch (JSON + Base64 images)
               ▼
┌─────────────────────────────┐
│  Google Apps Script Web App │
│  (gas/Code.gs)              │
└──────┬──────────────┬───────┘
       ▼              ▼
  Google Sheet   Drive folder
  (inventory)    (photos)
```

- The phone remains fully usable offline.
- Cloud sync is explicit (Export / Import), not continuous background sync.
- One shared Sheet and one Drive folder; houses are distinguished by a `house_name` column.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | React Native + Expo (managed workflow) |
| Language | TypeScript (strict) |
| Navigation | Expo Router (file-based routes under `app/`) |
| Local storage | `expo-sqlite`, `expo-file-system` |
| Images | `expo-image-picker`, `expo-image-manipulator` |
| Export | `expo-print`, `expo-sharing`, local CSV helpers |
| Cloud | `fetch` → Google Apps Script Web App |
| Tests | Jest + `jest-expo` + React Native Testing Library |

---

## Prerequisites

- [Node.js](https://nodejs.org) 18 or newer
- [Android Studio](https://developer.android.com/studio) (SDK + emulator) and/or a USB-connected Android device with debugging enabled
- JDK as provided by Android Studio (for native builds)

This project uses native modules (SQLite, camera, file system, print). **Expo Go is not sufficient**—use a development build (`npx expo run:android`).

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/tomwacha/Home-Inventory.git
cd Home-Inventory
npm install
```

### 2. Environment (optional for offline-only use)

```bash
cp .env.example .env
```

Edit `.env` when you are ready for cloud sync (see [Cloud sync setup](#cloud-sync-setup)):

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_GAS_WEB_APP_URL` | Apps Script Web App `/exec` URL |
| `EXPO_PUBLIC_DEFAULT_DRIVE_FOLDER_ID` | Optional Drive folder id for photo uploads |

You can also enter these values in-app under **Settings**. Values stored in SQLite on the device take precedence over `.env`.

`.env` is gitignored. Never commit live Web App URLs or folder ids.

### 3. Run on Android

First launch (or after adding native modules) builds and installs the app:

```bash
npx expo run:android
```

Later JS-only iteration:

```bash
npx expo start
```

Then press `a` for the emulator, or reconnect a device that already has the development build installed.

Rebuild with `npx expo run:android` whenever you change native dependencies or plugins in `app.json` / `package.json`.

---

## Cloud sync setup

1. Follow [gas/README.md](gas/README.md) to create a Sheet, Drive folder, paste `gas/Code.gs`, set Script property `DRIVE_FOLDER_ID`, and deploy a Web App (**Execute as: Me**, **Who has access: Anyone**).
2. Smoke-test in a browser: `YOUR_WEB_APP_URL?action=ping`.
3. Put the `/exec` URL in local `.env` and/or **Settings → Save**, then **Test connection**.
4. Use **Export → Google Sheets** and **Import → Import from Sheets** for a house whose name matches the Sheet `house_name` values.

Redeploy a **new version** of the Web App whenever you change `Code.gs`.

---

## Security

This repository is public. Treat the Apps Script `/exec` URL like an API key:

- Anyone who knows the URL can call your gateway (the script runs as your Google account).
- Spreadsheet or folder sharing set to “only you” does **not** block the Web App.
- Uploaded photos are shared as anyone-with-link view (so the app can display them).
- Prefer Restricted sharing on the Sheet and photo folder for browsing in the Drive UI.
- Keep real URLs in `.env`, in-app Settings, or a private notes file (`gas/secrets.local.md` from the example)—never in commits, PRs, or docs.
- `EXPO_PUBLIC_*` values are embedded in the app binary; do not redistribute builds that contain your live URL.

If a URL may have leaked, delete or replace the Apps Script deployment and update Settings / `.env`.

---

## Using the app

| Task | Where |
|------|--------|
| Add a house | Welcome → Add House |
| Open a house | Welcome list, or header **Select house** |
| Add rooms / items | House → Add Room → room → Add Item |
| Add another item in the same room | Item detail → **Add Another Item** |
| Search within a room | Room page search box (above Add Item) |
| Manage categories | House → Manage Categories |
| Rename / delete house | House → Edit House |
| Insurance policies (local) | House → View Policies |
| Rename / delete room | Room → Edit Room |
| Delete item | Item detail → Edit Item → Delete item |
| Photo default / cloud URL / app version | Header gear → Settings |
| PDF / CSV / Sheets | House → Export |
| Pull from Sheets | House → Import |

---

## Project structure

```text
app/                 Expo Router screens
components/          Shared UI (header, form scroll helpers, image picker)
constants/           Colors and shared StyleSheet tokens
db/                  SQLite schema helpers (houses, rooms, items, item images, categories, settings, insurance policies)
lib/                 Pure helpers (images, export, GAS client, import, photo filenames, confirms)
types/               Shared TypeScript contracts (inventory + gasSync)
gas/                 Apps Script source + deploy docs
__tests__/           Jest unit tests and light screen smoke tests
assets/              App icons and splash
.cursor/rules/       Cursor agent guidance (mentor, stack, secrets, version sync)
```

---

## Testing

```bash
npm test              # run the suite once
npm run test:watch    # watch mode
```

Strategy:

- Unit-test `lib/` helpers thoroughly (images, GAS client, import/upload builders, confirms).
- Keep a few screen smoke tests for critical navigation.
- Do not hit a live Apps Script deployment from CI.

Conventions:

- Test files: `__tests__/**/*-test.ts(x)` (jest-expo style).
- Path alias: `@/` → project root (`moduleNameMapper` in `package.json`).
- React Native Testing Library v14: always `await render(...)`.
- When mocking `useSQLiteContext`, return one **stable** object so focus effects do not loop.

---

## Development notes

- Typecheck: `npx tsc --noEmit`
- Styling: `StyleSheet.create()` with shared tokens in `constants/screenStyles.ts`
- Keyboard-heavy forms: `KeyboardAwareFormScroll` / `FormTextInput`
- Android soft keyboard: `softwareKeyboardLayoutMode: "resize"` in `app.json`
- Secrets checklist for agents and contributors: `.cursor/rules/secrets-and-google-exposure.mdc`
- Keep `app.json` and `package.json` versions in sync when shipping user-facing changes (Settings displays the Expo/`app.json` version)

---

## Documentation

| Document | Description |
|----------|-------------|
| [Home-Inventory-Product-Brief.md](Home-Inventory-Product-Brief.md) | Product requirements and feature list |
| [gas/README.md](gas/README.md) | Deploy and secure the Apps Script gateway |
| [gas/secrets.local.md.example](gas/secrets.local.md.example) | Template for private local secrets notes |
| [.env.example](.env.example) | Environment variable placeholders |

---

## Contributing

Issues and pull requests are welcome. Please:

1. Keep secrets out of git (no live `/exec` URLs, `.env`, or `gas/secrets.local.md`).
2. Run `npm test` and `npx tsc --noEmit` before opening a PR.
3. Prefer small, focused changes with clear commit messages.

---

## License

Released under the [MIT License](LICENSE.md).
