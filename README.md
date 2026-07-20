# Home Inventory

A local-first mobile app for cataloging home possessions for insurance claims. Built with **Expo SDK 54**, **TypeScript**, and **Expo Router** for Android.

Data lives on your device (SQLite + local image files). Cloud backup uses your own **Google Sheet** and **Google Drive** via a lightweight **Google Apps Script** gateway — no Firebase required.

See [Home-Inventory-Product-Brief.md](Home-Inventory-Product-Brief.md) for full product requirements.

## Features (planned)

- Multi-house inventory with rooms and items
- Camera capture with automatic image downscaling
- 100% offline CRUD on Android
- PDF and CSV export via the system share sheet
- Two-way sync to Google Sheets + Drive (Milestone 3)

## Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [Android Studio](https://developer.android.com/studio) (emulator) or a physical Android device
- [Expo Go](https://expo.dev/go) for quick testing, or a [development build](https://docs.expo.dev/develop/development-builds/introduction/) for native modules (SQLite, file system)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/Home-Inventory.git
   cd Home-Inventory
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment (optional for Milestone 1):**

   Copy `.env.example` to `.env` and add your Google Apps Script Web App URL when cloud sync is ready (Milestone 3):

   ```bash
   cp .env.example .env
   ```

4. **Start the dev server:**

   ```bash
   npx expo start
   ```

   Press `a` to open on Android emulator, or scan the QR code with Expo Go.

## Android development build

Native modules (`expo-sqlite`, `expo-file-system`, etc.) require a development build:

```bash
npx expo run:android
```

## Testing

Hybrid approach: unit-test pure helpers as you write them; keep screen tests light.

```bash
npm test              # run all tests once
npm run test:watch    # re-run when files change
```

| Test these | Skip or defer |
|------------|---------------|
| `lib/` helpers (folder names, later CSV/PDF builders) | Styling / layout polish |
| `db/` query helpers when logic is non-trivial | Every screen in full |
| One smoke test per critical screen (e.g. Welcome) | 100% coverage goals |

Tests live under `__tests__/`. Naming uses `*-test.ts` / `*-test.tsx` (jest-expo convention).

**Gotchas for this stack:**
- `@testing-library/react-native` v14: always `await render(...)`.
- When mocking `useSQLiteContext`, return one **stable** object (not a new `{}` each call), or focus effects can loop forever.

## Project structure

```
app/              Expo Router screens (file-based navigation)
components/       Shared UI (AppHeader, themed primitives)
constants/        Colors and app-wide tokens
lib/              Pure helpers (safe to unit-test first)
db/               SQLite helpers
__tests__/        Jest unit + light screen smoke tests
assets/           App icons and splash images
```

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | React Native + Expo (managed workflow) |
| Language | TypeScript (strict) |
| Navigation | Expo Router |
| Local storage | expo-sqlite + expo-file-system |
| Images | expo-image-picker + expo-image-manipulator (max 1024px, JPEG 0.7) |
| Export | expo-print (PDF) + expo-sharing + local CSV |
| Cloud sync | Google Apps Script → Sheets + Drive |

## License

See [LICENSE.md](LICENSE.md).
