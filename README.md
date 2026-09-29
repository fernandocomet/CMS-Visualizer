# CMS Visualizer

Connect any Webflow site and see its CMS structure as an interactive graph — collections, fields, and reference relationships mapped out automatically, with PNG export.

## How it works

1. A user clicks **"Connect your Webflow site"** and authorizes the app via Webflow OAuth (Data Client, `cms:read` + `sites:read` scopes only — read-only).
2. The backend exchanges the OAuth code for an access token, encrypts it, and stores it per site in Postgres. The frontend never sees the token.
3. The frontend fetches collections through same-origin proxy endpoints, renders them with [React Flow](https://reactflow.dev/), and can export the graph as a PNG.

## Architecture

- **Frontend**: Vite + React ([src/App.jsx](src/App.jsx)).
- **Backend**: Vercel serverless functions under [api/](api).
  - `api/auth/start.js`, `api/auth/callback.js`, `api/auth/disconnect.js` — OAuth flow and revocation.
  - `api/collections/index.js`, `api/collections/[id].js` — authenticated proxies to the Webflow CMS API.
- **Storage**: Neon Postgres (via Vercel Marketplace), see [lib/db.js](lib/db.js) for schema (`sites`, `sessions`).
- **Crypto/session helpers**: [lib/crypto.js](lib/crypto.js) (AES-256-GCM token encryption), [lib/session.js](lib/session.js) (cookies).

## Local development

```
npm install
npm run dev
```

Note: the OAuth flow requires an HTTPS redirect URI, so it can't be fully tested against `localhost`. Use the deployed Vercel URL for end-to-end testing of the connect/disconnect flow. The graph rendering and PNG export can be iterated on locally once connected.

## Deployment

1. Deploy this repo on [Vercel](https://vercel.com) (auto-detects Vite).
2. Add the **Neon** Postgres integration from the Vercel Marketplace — injects `DATABASE_URL` automatically.
3. Register a **Data Client** app at [developers.webflow.com](https://developers.webflow.com) (Workspace → Settings → Apps & Integrations → App Development), with:
   - Redirect URI: `https://<your-vercel-domain>/api/auth/callback`
   - Scopes: `CMS` → Read-only, `Sites` → Read-only
4. Set these environment variables in Vercel:
   - `WEBFLOW_CLIENT_ID`, `WEBFLOW_CLIENT_SECRET` (from step 3)
   - `DATABASE_URL` (from step 2)
   - `TOKEN_ENCRYPTION_KEY` — a random base64-encoded 32-byte key, e.g. `openssl rand -base64 32`
   - `APP_URL` — your canonical production URL, e.g. `https://cms-visualizer-ten.vercel.app` (must match the Redirect URI domain registered in Webflow)
