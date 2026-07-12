# Deployment

One command ships HuastexApp to both stores. Auth uses an **App Store Connect
API key** (iOS) and a **Google Play service-account JSON** (Android) — no
passwords, so 2FA can never break a release.

## TL;DR (every release)

```bash
npm run version:patch     # 2.4.0 → 2.4.1 (+ auto build number, both platforms)
npm run deploy:beta       # → TestFlight + Play internal track
# …test, then:
npm run deploy:release    # → App Store (upload) + Play production (draft)
git commit -am "release 2.4.1"
```

`deploy:*` bumps the build number once, then builds + uploads iOS and Android.
Platform-only: `npm run beta:ios`, `beta:android`, `release:ios`, `release:android`.
Artifacts only (no upload): `npm run build:android` / `build:ios`.

## Versioning

`scripts/bump-version.js` keeps `package.json`, Android (`versionName` /
`versionCode`) and iOS (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`) in sync.
The build number is `max(android, ios) + 1`, so it never regresses on either store.

| Command | Result |
|---|---|
| `npm run version:build` | keep name, just bump build number |
| `npm run version:patch` / `:minor` / `:major` | bump name + build number |

## One-time setup

1. **Install tooling**
   ```bash
   bundle install                 # installs fastlane (pinned in Gemfile.lock)
   ```
   > If `bundle install` complains about Ruby, install a modern Ruby
   > (`brew install ruby` or rbenv) — macOS system Ruby 2.6 is deprecated.

2. **Credentials** — copy the template and fill it in (it's git-ignored):
   ```bash
   cp fastlane/.env.example fastlane/.env
   ```
   - **iOS**: App Store Connect → Users and Access → Integrations → App Store
     Connect API → create an "App Manager" key, download the `.p8` into
     `fastlane/`, set `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_KEY_PATH`.
   - **Android**: Play Console → Setup → API access → service account with
     release permissions, download the JSON into `fastlane/`, set
     `PLAY_JSON_KEY_PATH`.

3. **Register the apps (required before the first upload):**
   - **App Store Connect**: create an app with bundle id **`com.huastexapp`**.
   - **Google Play**: the **very first** AAB must be uploaded **manually** in the
     Play Console (Google blocks the API for the first upload). After that,
     `npm run deploy:*` works.

## iOS signing

Automatic signing (Team `JR7W86BLMH`) + `-allowProvisioningUpdates` creates the
distribution profile on demand. You must be signed into your Apple account in
Xcode once so the distribution certificate exists in your keychain.

## Notes / safety

- `release:ios` **uploads** but does not submit — you click Submit in App Store Connect.
- `release:android` uploads to production as a **draft** — you roll it out in Play Console.
- Secrets (`fastlane/.env`, `*.p8`, the Play JSON) are git-ignored. Keep backups elsewhere.
