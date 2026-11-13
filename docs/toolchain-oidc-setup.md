# Peer Grading Tool — DocPouch / Toolchain Family setup

This document describes how to run the Peer Grading Tool (PGT) with DocPouch as
identity provider and how to publish aggregated results into the Toolchain
Family.

Two parts:

- **Phase 1 — Authentication:** DocPouch OIDC login, one-time token exchange for
  a PGT JWT, direct DocPouch role mapping.
- **Phase 2 — Toolchain integration:** Toolchain manifest, Tool Details Document
  (TDD), and publishing aggregated results to DocPouch.

The rationale and the considered alternatives are documented in
[`toolchain-integration-plan.md`](./toolchain-integration-plan.md).

---

## 1. Architecture

```
Browser (Angular PGT)
  │  1. OIDC redirect
  ▼
DocPouch  ── OIDC provider, users, roles, documents
  ▲
  │  2. POST /api/auth/oidc/exchange  (Bearer <DocPouch token>)
  │     backend calls GET /users/whoami once, maps roles, issues PGT JWT
  │
PGT backend (NestJS)
  │  3. all further requests use the PGT JWT
  ▼
Prisma / SQLite  ── system of record for campaigns, groups, peers, gradings
```

Key decisions:

- **DocPouch is the identity provider; the PGT backend stays the system of
  record** for campaigns, groups, peers, gradings and comments.
- **One-time token exchange instead of per-request `whoami`.** DocPouch allows
  100 GET requests per 15 minutes per IP. Exchanging only at login keeps the PGT
  far below that and makes it independent of DocPouch availability during a
  session.
- **DocPouch roles are adopted directly** (no PGT-local authorization override).
- **OIDC only in production.** Local e-mail/password login exists for development
  (`AUTH_MODE=local`).
- **Peer links stay public** (no login), because DocPouch documents require an
  authenticated user and the peer flow is deliberately anonymous.

### Role mapping

| DocPouch | PGT roles | Access |
|---|---|---|
| `isAdmin: true` / `superadmin` | `SUPER`, `ADMIN` | full access |
| `admin` | `ADMIN` | admin access |
| `manager` | — | `403 PGT_ACCESS_DENIED` |
| `member` | — | `403 PGT_ACCESS_DENIED` |

The mapping lives in `backend/src/user/user.service.ts`
(`mapDocPouchRoles`). Existing PGT users are matched by DocPouch id first and by
e-mail second, so campaigns and roles are preserved.

---

## 2. Backend configuration

All variables are documented in `backend/.env.example`.

| Variable | Meaning | Local dev | Production |
|---|---|---|---|
| `AUTH_MODE` | `local` or `oidc` | `local` | `oidc` |
| `DOCPOUCH_URL` | DocPouch base URL | `http://localhost:3033` | `https://docpouch.pantek.app` |
| `DOCPOUCH_OIDC_ISSUER` | OIDC issuer | `http://localhost:3033/oidc` | `https://docpouch.pantek.app/oidc` |
| `DOCPOUCH_CLIENT_ID` | Client id from `/oidc/reg` | from setup script | registered client |
| `DOCPOUCH_OIDC_SCOPE` | Requested scopes | `openid profile email offline_access` | same |
| `DOCPOUCH_TIMEOUT_MS` | `whoami` timeout | `5000` | `5000` |
| `PGT_PUBLIC_URL` | Public PGT URL | `http://localhost:4200` | `https://tapassio.pantek.ch/tc/PeerGrading` |
| `PGT_OIDC_REDIRECT_URI` | OIDC redirect | `http://localhost:4200/auth/callback` | `https://tapassio.pantek.ch/tc/PeerGrading/auth/callback` |
| `PGT_POST_LOGOUT_REDIRECT_URI` | Post-logout redirect | `http://localhost:4200/` | `https://tapassio.pantek.ch/tc/PeerGrading/` |
| `PGT_ACCESS_TOKEN_TTL` | PGT access token | `8h` in OIDC mode | `8h` |
| `PGT_REFRESH_TOKEN_TTL` | PGT refresh token | `2d` | `2d` |
| `APP_BASE_PATH` | Deployment sub-path | *(empty)* | `/tc/PeerGrading` |
| `CORS_ORIGINS` | Allowed origins (comma separated) | *(empty = all)* | `https://tapassio.pantek.ch` |
| `PRODUCTION` | Enables SPA fallback + serves static frontend | `false` | `true` |

`GET /api/auth/config` exposes the non-secret OIDC parameters to the frontend,
so the client id and issuer are never hardcoded in the build.

---

## 3. Local development

### 3.1 Start a local DocPouch

```bash
docker compose -f docpouch-dev/docker-compose.yml up -d
```

DocPouch then runs on <http://localhost:3033>. The image is pinned to `1.27.4`
(roles + `ADMIN_INITIAL_PASSWORD`); on first start it creates the super-admin
`admin` with the password from `ADMIN_INITIAL_PASSWORD` (`peer-grading-admin`).

### 3.2 Provision structures, TDD, test users and the OIDC client

```bash
cp docpouch-dev/.env.example .env     # then adjust DP_PASSWORD if needed
node docpouch-dev/setup-local.mjs
```

The script is idempotent and creates:

1. the document structure **Peer Grading Result** (`type 100` / `subType 0`),
2. the **Tool Details Document** (TDD, `type 0` / `subType 0`) with the
   `peerGradingResult` assignment,
3. test users `pgt-admin` (DocPouch `admin`) and `pgt-member` (DocPouch
   `member`) — useful for verifying the role mapping,
4. the **OIDC client** via dynamic registration (PKCE public client). The
   resulting `client_id` is written to `docpouch-dev/.oidc-client.json` and
   printed at the end.

### 3.3 Configure and start the PGT

`backend/.env` (development with OIDC):

```env
AUTH_MODE=oidc
DOCPOUCH_URL=http://localhost:3033
DOCPOUCH_OIDC_ISSUER=http://localhost:3033/oidc
DOCPOUCH_CLIENT_ID=<client_id from setup-local.mjs>
PGT_PUBLIC_URL=http://localhost:4200
PGT_OIDC_REDIRECT_URI=http://localhost:4200/auth/callback
PGT_POST_LOGOUT_REDIRECT_URI=http://localhost:4200/
```

Then:

```bash
cd backend && npm run start:dev
cd frontend && npm start
```

Open <http://localhost:4200>. Use **Mit DocPouch anmelden** and log in with
`pgt-admin` / `peer-grading-test` (or the DocPouch `admin` account).

To keep using the legacy local login, leave `AUTH_MODE=local` (the default).

---

## 4. Production deployment (Toolchain sub-path)

The PGT is deployed under the Toolchain host:

```
https://tapassio.pantek.ch/tc/PeerGrading/
```

Both frontend and API are served by the NestJS backend (static files +
`/tc/PeerGrading/api`).

### 4.1 Backend `.env`

```env
PRODUCTION=true
APP_BASE_PATH=/tc/PeerGrading
HOST=https://tapassio.pantek.ch/tc/PeerGrading/

AUTH_MODE=oidc
DOCPOUCH_URL=https://docpouch.pantek.app
DOCPOUCH_OIDC_ISSUER=https://docpouch.pantek.app/oidc
DOCPOUCH_CLIENT_ID=<production client id>
PGT_PUBLIC_URL=https://tapassio.pantek.ch/tc/PeerGrading
PGT_OIDC_REDIRECT_URI=https://tapassio.pantek.ch/tc/PeerGrading/auth/callback
PGT_POST_LOGOUT_REDIRECT_URI=https://tapassio.pantek.ch/tc/PeerGrading/
CORS_ORIGINS=https://tapassio.pantek.ch

JWT_SECRET=<strong random value>
JWT_REFRESH_SECRET=<strong random value>
JWT_REGISTRATION_SECRET=<strong random value>
```

What the backend does with `APP_BASE_PATH`:

- API global prefix becomes `/tc/PeerGrading/api`.
- Static frontend is served from the same prefix (`/tc/PeerGrading/en/`,
  `/tc/PeerGrading/de/`).
- `manifest.json` is served at `/tc/PeerGrading/manifest.json` with
  `Access-Control-Allow-Origin: *`.
- A SPA fallback serves `index.html` for deep links (e.g. `/auth/callback`).

### 4.2 Frontend build

`frontend/angular.json` already sets the language base hrefs:

```json
"i18n": {
  "sourceLocale": { "code": "de", "baseHref": "/tc/PeerGrading/de/" },
  "locales": {
    "en": { "translation": "src/locale/messages.en.xlf", "baseHref": "/tc/PeerGrading/en/" }
  }
}
```

The production API base is resolved at runtime from `document.baseURI`
(`frontend/src/environments/environment.prod.ts`), so no rebuild is needed when
the sub-path changes.

```bash
cd frontend && npx ng build --configuration production
cd ../backend && npm run build
```

The backend serves `frontend/dist` (see `ServeStaticModule` in
`backend/src/app.module.ts`). `/tc/PeerGrading/` redirects to the default
language.

### 4.3 Register the production OIDC client

```http
POST https://docpouch.pantek.app/oidc/reg
Authorization: Bearer <OIDC_REGISTRATION_TOKEN>
Content-Type: application/json

{
  "client_name": "Peer Grading Tool",
  "redirect_uris": [
    "https://tapassio.pantek.ch/tc/PeerGrading/auth/callback"
  ],
  "post_logout_redirect_uris": [
    "https://tapassio.pantek.ch/tc/PeerGrading/"
  ],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "web",
  "scope": "openid profile email offline_access"
}
```

- `token_endpoint_auth_method: "none"` + PKCE = public SPA client, no secret in
  the browser.
- If the DocPouch admin has not enabled `offline_access` for dynamically
  registered clients, refresh tokens may be unavailable; the PGT then works with
  the 8 h access token and a re-login after expiry.
- Add the PGT origin to DocPouch's `ALLOWED_ORIGINS`.

### 4.4 Provision structure and TDD in production

Run the same provisioning logic against production DocPouch (for example by
pointing `DP_BASE` at the production URL):

```bash
DP_BASE=https://docpouch.pantek.app DP_USER=<superadmin> DP_PASSWORD=<...> \
  node docpouch-dev/setup-local.mjs
```

The Toolchain dashboard reads the TDD from DocPouch; the tool URL in the TDD
should be `https://tapassio.pantek.ch/tc/PeerGrading/`.

---

## 5. Publishing results to DocPouch

On the campaign summary page an administrator sees a **Toolchain Family**
section with a **In Toolchain veröffentlichen** button (only in OIDC mode).

- The document is created by the **signed-in administrator's own DocPouch
  client** — there is no service account and no DocPouch token in the PGT
  backend.
- The document is **private** (`public: false`): visible only to the owner and
  DocPouch administrators.
- Only **aggregated, anonymised** data is published: per-peer running numbers
  (`Peer 1`, `Peer 2`, …), per-criteria averages, self score and weighted score.
  **No names, e-mail addresses or free-text comments.**
- The result structure id is resolved from the TDD assignment
  (`content.assignments.peerGradingResult.structureId`) and falls back to the
  structure with type `100` / subType `0` or the name `Peer Grading Result`.

The publishing logic lives in
`frontend/src/app/services/toolchain.service.ts`; the UI in
`frontend/src/app/campaign-summary/campaign-summary.component.*`.

---

## 6. Toolchain manifest

The manifest is served at `<base>/manifest.json` with
`Access-Control-Allow-Origin: *` (see `backend/src/toolchain/manifest.ts` and
`backend/src/main.ts`). Role keys (`peerGradingResult`) must stay stable across
versions because they become keys in `content.assignments` of the TDD.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `LOCAL_AUTH_DISABLED` | `AUTH_MODE=oidc`; use the DocPouch login button. |
| `PGT_ACCESS_DENIED` after login | DocPouch role is `manager`/`member`; only `admin`/`superadmin` may use the PGT. |
| `DOCPOUCH_UNAVAILABLE` / `DOCPOUCH_RATE_LIMITED` | DocPouch unreachable or rate limited; try again later. Existing PGT sessions keep working. |
| Login redirects to `localhost` in production | `PGT_PUBLIC_URL` / redirect URIs not set to the Toolchain sub-path. |
| 404 after login on a deep link | SPA fallback not active; set `PRODUCTION=true` and rebuild. |
| Publish button missing | Not in OIDC mode, or no campaign loaded. |
| `PGT_RESULT_STRUCTURE_MISSING` | Run `setup-local.mjs` (or provision production) to create the result structure. |
| Language/assets 404 under the sub-path | Rebuild the frontend so the `/tc/PeerGrading/{de,en}/` base hrefs are applied. |

---

## 8. Verification checklist

- [ ] Admin logs in via DocPouch and reaches the dashboard.
- [ ] A DocPouch `member` receives a clear 403 message.
- [ ] An existing PGT admin with the same e-mail keeps roles and campaigns.
- [ ] Peer link works without login.
- [ ] Logout ends both the PGT and the DocPouch session.
- [ ] Deep link `/auth/callback` works (SPA fallback).
- [ ] `manifest.json` is reachable and returns `Access-Control-Allow-Origin: *`.
- [ ] Publishing creates a private document visible only to administrators.
- [ ] No DocPouch request is made per API request (only at exchange).
