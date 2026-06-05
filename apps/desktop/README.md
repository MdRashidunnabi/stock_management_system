# ShopOS Desktop (Windows)

Electron shell for the ShopOS web app. It loads your hosted ShopOS URL (or `localhost` in dev), opens **POS kiosk mode**, and reuses the same PWA + offline sale queue as the browser.

## Prerequisites

- Node.js 20+
- **For local dev:** `npm run dev` in the repo root (Next.js on port 3000)
- **For Windows `.exe` builds:** run on Windows, or use a Windows CI runner (`electron-builder --win`)

## Quick start (development)

```bash
# Terminal 1 — web app
cd "../.."
npm run dev

# Terminal 2 — desktop shell
cd apps/desktop
npm install
SHOPOS_APP_URL=http://localhost:3000 npm run dev
```

Sign in with your shop owner or cashier account. The window opens `/pos?kiosk=1` (sidebar hidden, full-width till).

Optional: `SHOPOS_DEVTOOLS=1` opens Chromium DevTools.

## Point at production

Edit `config.default.json` before building, or set env when launching:

```json
{
  "appUrl": "https://your-shopos-domain.vercel.app",
  "startPath": "/pos?kiosk=1"
}
```

Packaged installs read `resources/config.json` (copied from `config.default.json` at build time).

## Build Windows installer

On **Windows** (recommended):

```bash
cd apps/desktop
npm install
# Set production URL in config.default.json first
npm run build:win
```

Output: `apps/desktop/dist/ShopOS-Setup-0.1.0.exe`

From repo root:

```bash
npm run desktop:build:win
```

Upload the `.exe` to your CDN or GitHub Releases, then set in `.env.local`:

```
NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL=https://downloads.example.com/ShopOS-Setup-0.1.0.exe
```

Owners will see a **Download for Windows** button under **Settings → Billing**.

## App icon (optional)

Add `apps/desktop/build/icon.ico` (256×256) before building. Without it, Electron uses the default icon.

## Architecture

| Piece         | Role                                                           |
| ------------- | -------------------------------------------------------------- |
| `main.mjs`    | Window, single-instance lock, external links in system browser |
| `preload.mjs` | Exposes `window.shopOSDesktop` to the web app                  |
| Web `/pos`    | Serwist PWA + IndexedDB offline queue (unchanged)              |
| `?kiosk=1`    | Hides sidebar; desktop auto-enables via `DesktopShell`         |

Same Supabase session cookies as Chrome — one login for web and desktop.
