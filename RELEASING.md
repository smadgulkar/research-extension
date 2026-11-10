# Releasing

## Day to day (after one-time setup)

```bash
npm run release -- patch      # or minor / major / 2.1.0
```

That bumps the version, commits, tags, and pushes. GitHub Actions then:

1. Type-checks, builds Chrome and Firefox, runs Mozilla's validator, and runs the E2E suite (headless Chrome, mocked AI providers).
2. **Stops if anything fails.** Nothing is published.
3. Creates a GitHub Release with both zips.
4. Publishes to every store whose secrets are configured. Stores without secrets are skipped with a warning.
   - **Chrome Web Store**: uploads and publishes.
   - **Edge Add-ons**: uploads and submits for certification.
   - **Firefox (AMO)**: uploads with the source code and release notes.

Each store still runs its own review (hours to a few days). You get an email from each store when the release is live or if it's rejected.

Watch runs at: https://github.com/smadgulkar/research-extension/actions

Every push to any branch also runs the CI checks.

Local check before releasing (optional): `npm run verify`. Use `HEADFUL=1 npm run test:e2e` to watch the tests, or `E2E_DEBUG=1` to print popup console output.

---

## One-time setup

Only you can do these steps: they need your store accounts. Add each value as a GitHub secret:

```bash
gh secret set NAME --repo smadgulkar/research-extension   # paste the value when prompted
```

### Chrome Web Store (about 20 minutes)

1. In Google Cloud Console, create a project and enable **Chrome Web Store API**.
2. Configure the OAuth consent screen (External) and **set the publishing status to "In production"**. In "Testing" status, refresh tokens expire after 7 days and releases will start failing silently a week later.
3. Create an OAuth client ID of type **Desktop app**.
4. Run `npx chrome-webstore-upload-keys` and follow the prompts to get a refresh token.
5. Set these secrets:
   - `CWS_CLIENT_ID`
   - `CWS_CLIENT_SECRET`
   - `CWS_REFRESH_TOKEN`
   - `CWS_EXTENSION_ID`: the 32-letter ID in your dashboard / store URL
   - `CWS_PUBLISHER_ID`: your publisher ID from the Chrome Web Store developer dashboard
6. **Listing text is not updated by the API.** Paste the description from `STORE_LISTING.md` into the dashboard once, by hand.

### Microsoft Edge Add-ons (about 30 minutes plus first review)

1. Register at Partner Center (free): https://partner.microsoft.com/dashboard/microsoftedge
2. **First submission is manual.** Upload `mindstack-chrome-X.Y.Z.zip` from the latest GitHub Release, and reuse the text in `STORE_LISTING.md` and the privacy policy in `PRIVACY.md`.
3. Go to Microsoft Edge → **Publish API** → enable → **Create API credentials**.
4. Set these secrets:
   - `EDGE_CLIENT_ID`
   - `EDGE_API_KEY`
   - `EDGE_PRODUCT_ID`: the GUID on the extension's overview page, or in its URL
5. **API keys expire.** Partner Center shows the expiry date. Set a calendar reminder to rotate the key before then, or Edge releases will fail.

### Firefox / addons.mozilla.org (about 10 minutes)

1. Sign in at https://addons.mozilla.org/developers/ and create API credentials at https://addons.mozilla.org/developers/addon/api/key/
2. Set these secrets:
   - `AMO_JWT_ISSUER`
   - `AMO_JWT_SECRET`
3. The first release creates the listing using `amo-metadata.json`: category, summary, license, and reviewer notes. Review those values first. Note:
   - The license is set to `all-rights-reserved`, because the repo has no LICENSE file.
   - The add-on ID `research-assistant@smadgulkar.github.io` (set in `webpack.config.js`) is **permanent** once submitted.
4. After the first release, add screenshots and a full description on the AMO listing page by hand.

---

## How the builds differ

| Command | Output | Used for |
|---|---|---|
| `npm run build` | `dist/` | Chrome Web Store and Edge (same package) |
| `npm run build:firefox` | `dist-firefox/` | AMO. Uses `background.scripts`, a gecko ID, and data-collection declaration |
| `npm run build:e2e` | `dist-e2e/` | Tests only. Adds host permissions so tests can read a local page and mock provider APIs. **Never packaged.** |

## Paid tier

`PAID_TIER_ENABLED` in `src/services/premiumService.ts` is `false`, so all features are free. Before turning it on, replace `activateLicense()` with real server-side verification (e.g. ExtensionPay or Lemon Squeezy). It currently refuses every key on purpose.
