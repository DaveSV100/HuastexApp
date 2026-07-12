# CONTEXT.md — Onboarding & Operational Knowledge

> Companion to `CLAUDE.md`. `CLAUDE.md` describes the code architecture; this file
> captures the **tribal knowledge** that isn't obvious from reading the source:
> deployment, production topology, API contracts, and hard-won gotchas.
> No secret values are stored here (keys/`.p8`/service-account JSON stay in
> git-ignored `fastlane/.env`).

---

## 1. System topology (mobile + web + backend)

There are **three** codebases that make up the Huastex product:

| Piece | Location | Notes |
|---|---|---|
| **Mobile app** (this repo) | `HuastexApp` | React Native 0.83 / React 19, TypeScript. B2B back-office + public storefront. |
| **Web client** | `~/Documents/huastex/client` (separate repo, Vercel) | React web store + the **payment page** (`/card-payment`). |
| **Backend / API** | `~/Documents/huastex/server` (locally accessible) | Express on port 4000. Deployed to DigitalOcean. |

**Critical fact:** the mobile app talks to **production `https://api.huastex.com`**
(`API_BASE` in `src/api.js`), **NOT** the local `huastex/server` (which listens on
`:4000` against a separate local DB). So route/env/seed changes only affect the app
once deployed to the prod box.

### Production backend (DigitalOcean)
- Droplet: `ubuntu-s-1vcpu-512mb-...-nyc1-01`
- Repo: `/var/www/Huastex` (git remote `DaveSV100/Huastex`, deploy branch **`production`**)
- Server code under `server/`; env at `/var/www/Huastex/server/.env`
- Process manager: **pm2**, app name **`server`** (id 0, fork mode), listens `:4000` behind `https://api.huastex.com`
- Node **v18.19.1** (has global `fetch`)
- Deploy = SSH in, `git pull`, restart pm2. `dotenv` reads `.env` from cwd, so a
  plain `pm2 restart server` reloads it; `--update-env` only matters for
  shell/ecosystem vars.

### Backend gotcha
`server/database.js` is a **STALE** pg pool (hardcoded creds, no SSL, fails with
Postgres `28000`). The live pool is `const { pool } = require('./config/db')`
(env-driven + SSL). **Always import that one.**

---

## 2. Auth & API contract

- Single Axios instance in `src/api.js`. A **request interceptor** attaches
  `x-auth-token: <JWT>` from AsyncStorage on every call. A **response interceptor**
  clears storage on 401 and calls a registered `setUnauthorizedHandler` →
  `AuthProvider` sets `user=null` → `AppNavigator` shows SignIn.
- **Any call NOT made through `api` bypasses the token.** Use `api.*`, never raw
  `fetch()`, for locked routes.
- Locked routes return **401** without a valid token, **403** if the role isn't allowed.
- Roles for back-office endpoints: `admin | superadmin | staff | iT`. The `normal`
  role only gets public routes.
- `DELETE /transactions`, `DELETE /sales`, `DELETE /payments` all allow
  `admin|superadmin|staff|iT` (only `normal` excluded).

### Public (tokenless) endpoints — must keep working
`GET /products*`, `POST /sales/add`, `GET /sales/:id`, `GET /payments/:saleId`,
`/auth/login|signup|verify-token`, `POST /api/openpay/charge`.

- **Self-signup uses `POST /auth/signup`** (public). `/auth/register` is
  superadmin-only — don't point signup at it.

---

## 3. Sales ↔ Payments ↔ Daily-report linkage

The "daily report" (`ReportScreen`) is backed by the **`transactions`** table, not a
separate report table.

- A **sale** creates one income `transaction` with `payment_type` `sale` (contado)
  or `down_payment` (credit/msi/apartado), carrying `sale_id` (no `payment_id`).
- An **abono** (`PaymentsModal`) creates a `payment` row **AND** one income
  `transaction` carrying **both** `sale_id` and `payment_id`.
- Transactions with neither id are independent incomes/outcomes — leave them alone.

### Field casing differs per endpoint (easy to get wrong)
- `POST /transactions` — **snake_case** body; persists `sale_id` AND `payment_id`
  (camelCase is silently dropped). Send ids as integers.
- `POST /payments/add` — **camelCase** `{ saleId, fecha, cantidad, cajero }`;
  returns 201 full payment row incl `id`. Server does **not** create a transaction —
  the app must create exactly one, stamped with `payment_id` + `sale_id`.
- `POST /sales/add` — returns 201 `{ id, totalPrice }`; use `id` as `sale_id`.
- `PUT /transactions/:id` — preserves `sale_id`/`payment_id` when omitted; you
  **cannot** null them via PUT.

### Deletes cascade server-side (Postgres FKs) — don't manually clean up
- `transactions.payment_id → payments(id) ON DELETE CASCADE`
- `transactions.sale_id → sales(id) ON DELETE CASCADE`

So call **only** the single delete endpoint then refetch: `DELETE /payments/:id`
(cascades its transaction) / `DELETE /sales/:id` (cascades payments, sale_products,
AND transactions). Do NOT manually `DELETE /transactions` to clean up.
(Legacy rows created before `payment_id` existed won't carry it → `ReportScreen`
falls back to deleting just that transaction row.)

### Payment plans, estado & promo window (July 2026)

- `sales.payment_frequency` (`Semanal|Quincenal|Mensual|Al terminar`, nullable) and
  `sales.pp_enabled` (nullable boolean) were added July 2026. The web client doesn't
  send `paymentFrequency` on PUT — the server uses `COALESCE` so it can't wipe it.
- `plazo` exists in the DB in three shapes ("40 weeks", JSON string, nested JSON).
  The server normalizes on **read** (`normalizePlazo`) and canonicalizes to
  `"40 weeks"` on **write** (`serializePlazo`) — clients always receive a clean
  `{ value, unit }` and must not re-parse nested JSON for new rows.
- `PATCH /sales/:id/pp` `{ enabled: true }` (staff/iT/admin/superadmin) = the app's
  "Habilitar PP" button. Deliberately NOT part of `PUT /sales/:id` so edits can't
  reset it.
- All estado/atraso/recargo math lives in `src/utils/paymentStatus.ts` (unit-tested)
  and is **display-only**: promo price stops applying 15 days past
  `fechavencimiento` unless `pp_enabled`; saldo normal gains +6% per full month past
  due starting at 2 months (simple, never persisted to the DB). Conversions:
  1 month = 4 weeks, 1 quincena = 2 weeks.

---

## 4. Shop cart → web payment handoff

Customer checkout does **not** post to the backend from mobile.
`src/screens/shop/CartScreen.tsx` base64-encodes the cart and opens
`https://www.huastex.com/card-payment?cart=<encodeURIComponent(base64)>` in an
in-app browser; the **web** charges via OpenPay and saves the sale on `/success`.

- The deployed web reads the `{ id, title, price, quantity }` shape. The cart
  encodes a **superset** — that shape PLUS `{ producto, product_id, inventory_id:null,
  unitPrice, serial_number:'', totalProductPrice }` (what `/sales/add` wants) so it's
  forward-compatible. **Don't replace** title/price with producto/unitPrice — that
  breaks the live web.
- **Known web-side bug (fix lives in the `client` repo, needs Vercel redeploy):**
  `CheckoutSideMenu` mounts after routes and its effect overwrites the decoded URL
  cart with `localStorage.cartProducts` (`[]` on any non-first visit) → "empty cart
  on web". Fix = in `client/src/Components/PaymentForm/index.jsx`, write the decoded
  cart to `localStorage` **before** `setCartProducts(decoded)`.
- ⚠️ The payment page handles **live OpenPay charges**. The user wants exact
  before/after line diffs presented for approval before ANY edit to it.

---

## 5. AI shop assistant (public, in production)

- Backend `server/routes/aiRoutes.js` mounted at `/ai`: `GET /ai/status` (public),
  `POST /ai/shop-assistant` (now **public** — auth removed).
- Gemini **free tier** via OpenAI-compatible endpoint. Env: `GEMINI_MODEL`
  (default `gemini-2.5-flash`), key **`GEMINI_API_KEY`**.
- ⚠️ **Gotcha that cost real time:** a 502 `AI_ERROR` was caused by the prod `.env`
  naming the key `DB_GEMINI_API_KEY` (the app's `DB_` convention leaked onto it)
  while the code reads `process.env.GEMINI_API_KEY`. Fix = rename the `.env` line to
  `GEMINI_API_KEY=...` then `pm2 restart server`. A startup guard now logs whether
  the key loaded, visible in `pm2 logs` at boot.
- Retrieval is keyword search over the **`products`** table (NOT `inventory`)
  injected into the prompt; no tool calling.
- Quota contract: in-memory daily budget (1200) + Gemini daily-429 detection →
  `/status` flips `available:false` and chat answers 503 `AI_QUOTA_EXHAUSTED` until
  midnight US Pacific. `src/components/ShopAssistant.tsx` hides its FAB when
  unavailable and re-checks on focus.
- Prod verified: `/ai/status` `available:true`, `products` has 13 rows.

---

## 6. Receipts, signatures & printing

### Signature capture
- `react-native-signature-canvas` renders a WebView. Its peer
  `react-native-webview` **must be declared in package.json** — RN CLI autolinking
  only links declared packages; a transitive-only install crashes the app on mount
  ("Agregar Firma" crash). Diagnostic: compare `npx react-native config` deps vs
  what the JS imports.
- Sale signature is stored as `firmadigital` (base64 data-URI from the canvas `onOK`).

### Sale-as-image download (`SalesScreen`)
- "Descargar Imagen" opens a receipt Modal wrapped in `ViewShot`; "Guardar en
  galería" does `receiptRef.capture()` → `CameraRoll.saveAsset(uri,{type:'photo'})`.
- iOS needs **BOTH** `NSPhotoLibraryAddUsageDescription` AND
  `NSPhotoLibraryUsageDescription` (saveAsset reads the asset back; add-only key →
  TCC SIGABRT). Android: `WRITE_EXTERNAL_STORAGE` `maxSdkVersion="28"`.

### Thermal printing (58mm Bluetooth)
- **BLE** via `react-native-ble-plx` (iOS only allows generic thermal printers over
  BLE GATT; Classic/SPP needs MFi). One implementation for iOS + Android.
- Pipeline: `ReceiptTicket.tsx` (RN replica of web ticket, 276pt) → ViewShot PNG →
  `escposImage.ts` (upng decode → 384-dot resample → Floyd-Steinberg dither →
  `GS v 0` raster bands) → `thermalPrinter.ts` (connect, pick first writable
  characteristic, stream MTU-3 chunks).
- Ticket design must mirror web `client/src/Utils/ticketPrinter.js` (sale) &
  `paymentTicketPrinter.js` (abono) exactly — shared formatters in
  `src/utils/ticketFormat.ts` (`deriveTicketModel()`).
- ⚠️ **Simulator has no Bluetooth** — BLE flow must be tested on a real device
  with the printer.

### PDF share (`ticketPdf.ts`)
- Pure-JS invoice-style **text** PDF (US-Letter, Helvetica/WinAnsi), not a
  screenshot. Signature embedded as JPEG (`/DCTDecode`) via `signatureRef`.
- Android gotcha: RNShare decodes data-URIs into `getExternalCacheDir()` which can
  be **null** on emulators → NPE. Always pass `useInternalStorage: true` to
  `Share.open`.
- `src/utils/smartSearch.ts` = web-parity product search (accent/case-insensitive,
  word-order free) used by `SaleModal`'s product picker.
- Note: `src/components/SalesGrid.tsx` is **dead code** (imported nowhere).

---

## 7. Deployment & versioning

Automation is in `package.json` scripts + `scripts/` + `fastlane/`. Full guide in
`DEPLOYMENT.md`.

- **Version source of truth:** `package.json` `version` = the version NAME, mirrored
  to Android `versionName` and iOS `MARKETING_VERSION`. Build number is auto-set to
  `max(Android versionCode, iOS CURRENT_PROJECT_VERSION) + 1` on both platforms by
  `scripts/bump-version.js` (never regresses).
- **Scripts:** `version:build|patch|minor|major`; `build:android`/`build:ios`
  (local only); `beta:ios`/`beta:android`, `release:ios`/`release:android`;
  `deploy:beta` (bump + TestFlight + Play internal); `deploy:release` (bump + App
  Store upload-only + Play production draft).
- Always run `npm run version:build` before any new upload — a duplicate build
  number is rejected.
- **Fastlane** auth: App Store Connect API key (`.p8`) + Google Play service-account
  JSON, all in **git-ignored `fastlane/.env`** (template `fastlane/.env.example`).
  Ruby is system 2.6.10 but works via `bundle config set --local path vendor/bundle`.

### iOS bundle id ⚠️ MUST be `org.reactjs.native.example.HuastexApp`
The app is already live on App Store Connect (app "Huastex", appId `6757963906`)
under this **boilerplate** id. Apple permanently ties a listing to its bundle id, so
shipping updates REQUIRES this id in **two** places:
1. `project.pbxproj` `PRODUCT_BUNDLE_IDENTIFIER` (Debug + Release) — what the ipa is signed with
2. `fastlane/Appfile` `app_identifier` — what `upload_to_testflight` uses to find the app

`Appfile` `package_name` stays `com.huastexapp` for **Android**.

### Signing facts
- iOS `DEVELOPMENT_TEAM = JR7W86BLMH`; `build-ios.sh` uses `-allowProvisioningUpdates`
  + automatic signing → builds/signs headlessly with 0 keychain certs (the API key
  auto-creates signing assets). No Xcode login needed.
- Android release signing via `android/key.properties` + keystore. Android app id = `com.huastexapp`.
- `Info.plist` has `ITSAppUsesNonExemptEncryption=false` (skips export-compliance
  prompt) and a filled `NSLocationWhenInUseUsageDescription` (empty purpose strings
  get rejected).

### First-upload gotchas
- App Store Connect app record must exist first.
- Google Play blocks the API for the **very first** aab — upload that one manually in
  Play Console; the API works afterward.

### Publishing state (as of the last deploy session)
- Build **6** (v2.4.0) uploaded and Apple-processed (`state=VALID`). The only
  remaining step is **manual** in the ASC website: Apple renamed the "App Store" tab
  to **"Distribution"**; prepare a version numbered 2.4.0, attach build 6, then
  Add for Review → Submit. `release:ios` uploads but never submits
  (`submit_for_review:false`).

---

## 8. Local dev environment gotchas

- **iCloud eviction stalls the toolchain.** This repo lives in `~/Documents`
  (iCloud-synced). When the disk fills, macOS evicts parts of `node_modules`
  (`dataless` flag, visible via `ls -lO`). Any content read of a dataless file blocks
  in `pread` forever if sync is wedged → **jest/tsc/eslint hang at ~0 CPU**.
  - If the toolchain hangs at 0 CPU, check `ls -lO` for `dataless` BEFORE debugging
    code. Don't chase watchman/jest theories.
  - Workaround: copy pure-TS sources + tests to `/tmp` and run there. Real fixes
    (user's call): free disk, Finder "Download Now", `rm -rf node_modules && npm
    install`, or move the repo out of iCloud.
- **iOS simulator** (iPhone 16) works great; `npm run ios` builds clean. But it has
  **no Bluetooth** (BLE printing untestable) and **no camera roll automation**.
- **Android emulator** (`Medium_Phone_API_36.1`) only boots with
  `-gpu swiftshader_indirect`; the default Guest Angle GPU path is unstable for API
  >35 and leaves adb offline.
