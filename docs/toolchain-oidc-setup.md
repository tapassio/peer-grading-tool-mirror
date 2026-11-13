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
| `PGT_PUBLIC_URL` | Public PGT URL (fallback base) | `http://localhost:4200` | `https://tapassio.pantek.ch/tc/PeerGrading` |
| `PGT_OIDC_REDIRECT_URI` | Fallback OIDC redirect | `http://localhost:4200/auth/callback` | `https://tapassio.pantek.ch/tc/PeerGrading/auth/callback` |
| `PGT_POST_LOGOUT_REDIRECT_URI` | Fallback post-logout redirect | `http://localhost:4200/` | `https://tapassio.pantek.ch/tc/PeerGrading/` |
| `PGT_ACCESS_TOKEN_TTL` | PGT access token. OIDC: renewed by a new DocPouch exchange, so DocPouch blocks take effect after this time | `1h` in OIDC mode | `1h` |
| `PGT_REFRESH_TOKEN_TTL` | PGT refresh token (local mode only; `/auth/refresh` is disabled in OIDC mode) | `2d` | `2d` |
| `DOCPOUCH_REQUEST_BUDGET` | Max. DocPouch `whoami` requests per 15 min for the whole server | `60` | `60` |
| `PGT_RESULT_STRUCTURE_ID` | Fixed DocPouch structure for published results (recommended) | *(empty)* | id of the result structure |
| `APP_BASE_PATH` | Deployment sub-path | *(empty)* | `/tc/PeerGrading` |
| `CORS_ORIGINS` | Allowed origins (comma separated) | *(empty = all)* | `https://tapassio.pantek.ch` |
| `PRODUCTION` | Enables SPA fallback + serves static frontend | `false` | `true` |

`GET /api/auth/config` exposes the non-secret OIDC parameters to the frontend,
so the client id and issuer are never hardcoded in the build.

> **Localized redirect URIs.** The frontend is built per language and served
> under a language prefix (`…/de/`, `…/en/`). The browser therefore derives the
> OIDC `redirect_uri` and `post_logout_redirect_uri` from its own `<base href>`
> (`frontend/src/app/services/auth.service.ts`), so the effective values are
> `…/de/auth/callback`, `…/en/auth/callback`, etc. The `PGT_OIDC_REDIRECT_URI` /
> `PGT_POST_LOGOUT_REDIRECT_URI` variables are only fallbacks used when the
> browser cannot compute them. **Every language variant must be registered as a
> redirect / post-logout URI with DocPouch** (see §4.3).

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
# Fallbacks only — the browser derives the effective, language-prefixed URIs.
PGT_PUBLIC_URL=http://localhost:4200
PGT_OIDC_REDIRECT_URI=http://localhost:4200/en/auth/callback
PGT_POST_LOGOUT_REDIRECT_URI=http://localhost:4200/en/
```

Then:

```bash
cd backend && npm run start:dev
cd frontend && npm start        # serves English at http://localhost:4200/en/
# or: npx ng serve --configuration de   # serves German at /de/
```

Open <http://localhost:4200/en/> (or `/de/`). Use **Mit DocPouch anmelden** and
log in with `pgt-admin` / `peer-grading-test` (or the DocPouch `admin` account).

The setup script registers both language variants (`/en/auth/callback` and
`/de/auth/callback`); add locales to `PGT_LOCALES` (comma separated) if the
frontend is built for more.

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
# Fallbacks only — the browser derives the effective, language-prefixed URIs.
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
    "https://tapassio.pantek.ch/tc/PeerGrading/de/auth/callback",
    "https://tapassio.pantek.ch/tc/PeerGrading/en/auth/callback"
  ],
  "post_logout_redirect_uris": [
    "https://tapassio.pantek.ch/tc/PeerGrading/de/",
    "https://tapassio.pantek.ch/tc/PeerGrading/en/"
  ],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "web",
  "scope": "openid profile email offline_access"
}
```

- Every language the frontend is built for needs its own redirect and
  post-logout URI (the app is served per locale). `docpouch-dev/setup-local.mjs`
  does this automatically for local development via `PGT_LOCALES`.

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
- The target structure is resolved in this order:
  1. `PGT_RESULT_STRUCTURE_ID` (backend configuration, recommended for
     production: other DocPouch users cannot redirect it),
  2. the Tool Details Document whose **`url`** is this installation
     (`PGT_PUBLIC_URL`, language prefix ignored), role `peerGradingResult`.
     The tool name may be renamed in the Tool Manager. If several documents
     claim the same url, publishing stops (`PGT_TOOL_DOCUMENT_AMBIGUOUS`),
  3. development only (`PRODUCTION` not `true`): the structure named
     `Peer Grading Result`.
- The document gets **`type`/`subType` of the assignment** (or of the
  configured structure), not a fixed `100/0`: the Tool Manager gives newly
  created structures the next free type.

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
| Login redirects to `localhost` in production | Fallback redirect URIs not set to the Toolchain sub-path. |
| `invalid_redirect_uri` from DocPouch | The language-specific callback URI (`…/de/auth/callback`, `…/en/auth/callback`) is not registered for the client. Register every locale (§4.3). |
| 404 after login on a deep link | SPA fallback not active; set `PRODUCTION=true` and rebuild. |
| Publish button missing | Not in OIDC mode, or no campaign loaded. |
| `PGT_RESULT_STRUCTURE_MISSING` | No Tool Details Document with this url (`PGT_PUBLIC_URL`) and no `PGT_RESULT_STRUCTURE_ID`. Register the tool in the Tool Manager with exactly this url, or set the structure id. Locally: run `setup-local.mjs`. |
| `PGT_TOOL_DOCUMENT_AMBIGUOUS` | Several Tool Details Documents have this url. Remove the duplicates in the Tool Manager, or set `PGT_RESULT_STRUCTURE_ID`. |
| `PGT_RESULT_STRUCTURE_NOT_FOUND` | `PGT_RESULT_STRUCTURE_ID` does not exist or is not readable for the signed-in user. |
| `DOCPOUCH_RATE_LIMITED` right away | The PGT budget (`DOCPOUCH_REQUEST_BUDGET`) is used up, or this IP sent 3 invalid tokens (blocked for 15 min). |
| Language/assets 404 under the sub-path | Rebuild the frontend so the `/tc/PeerGrading/{de,en}/` base hrefs are applied. |

---

## 8. Verification checklist

- [ ] Admin logs in via DocPouch and reaches the dashboard.
- [ ] A DocPouch `member` receives a clear 403 message.
- [ ] An existing PGT admin with the same e-mail keeps roles and campaigns.
- [ ] Peer link works without login.
- [ ] Logout ends both the PGT and the DocPouch session.
- [ ] Deep link `/{de,en}/auth/callback` works (SPA fallback) and the language is preserved after login.
- [ ] `manifest.json` is reachable and returns `Access-Control-Allow-Origin: *`.
- [ ] Publishing creates a private document visible only to administrators.
- [ ] No DocPouch request is made per API request (only at exchange).
