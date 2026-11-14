# Security hardening (November 2026)

This page explains what changed and what has to be done when deploying.

## What changed

| Topic | Before | Now |
|-------|--------|-----|
| Peer links | `md5(groupId-peerId) + ids`, can be calculated | 256 bit random (`crypto.randomBytes`) |
| Public group API | returned password hash and refresh token of lecturers | only `userId`, names, e-mail |
| Submitting gradings | `POST /api/group`, sender/group from the request body | `POST /api/group/:link`, sender/group from the link; targets are checked |
| Passwords | unsalted MD5 | bcrypt (12 rounds); old MD5 hashes are upgraded on the next login |
| Peer accounts | created with password `"p"` | no password |
| Refresh tokens | MD5, compared with `==` | SHA-256, constant-time comparison |
| Token storage in the browser | access and refresh token in `localStorage` (readable by any XSS) | access token only in memory; refresh token as `HttpOnly; SameSite=Strict` cookie (`Secure` in production), path `<base>/api/auth`; OIDC mode: no refresh token in the browser at all |
| Registration | overwrote password/names of an existing account before e-mail confirmation | data is only applied after confirmation; input is validated |
| Rate limiting | none | 100 req/min per IP; login 5/min, register 3/min, confirm 10/min |
| JWT secrets | example values like `secretKey` accepted | production refuses weak, short or identical secrets |
| CORS | open when `CORS_ORIGINS` empty | open only in development |
| HTTP headers | none | helmet (CSP, HSTS, X-Frame-Options, ...) |
| CampaignGuard | allowed unknown methods, `campaignId 0` | default deny, one DB query |
| Admin update | `{ ...data }` passed to Prisma | explicit field lists; errors are no longer swallowed |
| Passwords (new) | any length | at least 8 characters |
| Docker | Node 18 (EOL), `npm install` | Node 22 runtime, `npm ci` |

## Deployment checklist

1. **Set secrets** in `backend/.env` (three different values):
   ```sh
   openssl rand -base64 48
   ```
   With `PRODUCTION=true` the server will not start otherwise.
2. **Behind a reverse proxy:** set `TRUST_PROXY=1`, otherwise all users share
   one rate limit.
3. **Set `CORS_ORIGINS`** if the API is called from another origin.
4. **Deploy backend and frontend together** (the grading submit URL changed).
5. **Replace the old peer links** once:
   ```sh
   cd backend && node prisma/migrations/regenerate-peer-links.js
   ```
   Old links stop working. For running campaigns send reminder mails so that
   peers get their new link.
6. **Reset lecturer passwords.** The old API exposed MD5 hashes, so they must
   be considered leaked. Also rotate the JWT secrets (step 1). All users have
   to log in again after the update.

## Still open

- `docpouch-client` (1.3.1) stores its own OIDC session (DocPouch access and
  refresh token) in `localStorage` (`docpouch_oidc_session`). This can only be
  changed in DocPouch / docpouch-client.
- The container runs as root (changing it requires a writable data
  directory for the SQLite database, see `compose.yml`).
- Major updates: NestJS 9 → 10/11, Prisma 4 → 5/6, Angular 17 → current.
