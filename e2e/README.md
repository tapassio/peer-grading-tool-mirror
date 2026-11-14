# End-to-end tests (Playwright)

A real browser (Chromium) clicks through the **built** app: backend in
production mode, serving the built frontend (German and English), with a
fresh test database for every run.

## What is tested

| File | Content |
|---|---|
| `tests/auth.spec.ts` | login (wrong password, header), tokens (nothing in `localStorage`, HttpOnly cookie), reload keeps the session, logout |
| `tests/campaign-form.spec.ts` | defaults (Swiss scale, half grades), add/delete criterion, language change resets the criteria, CSV import, add person, delete group, save |
| `tests/peer-grading.spec.ts` | peer form via personal link, average while typing, submit with confirmation, unknown link, the lecturer sees the grade |
| `tests/pages.spec.ts` | statistics, profile, English version, error page, Toolchain manifest |

## Run locally

Node 24. Build backend and frontend first:

```bash
cd backend  && npm ci && npx prisma generate && npm run build && cd ..
cd frontend && npm ci && npx ng build --configuration production && cd ..
cd e2e      && npm ci && npx playwright install chromium
npm test            # all tests, the server is started automatically
npm run test:headed # watch the browser
npm run report      # HTML report of the last run
```

With an installed Chrome instead of the Playwright download:
`E2E_CHROME=/usr/bin/google-chrome npm test`.

## How it works

`scripts/start-server.mjs` (started by Playwright, see `playwright.config.ts`):

1. creates `e2e/.data/e2e.db` from `backend/prisma/migrations`,
2. fills it with the fixed test data from `scripts/data.cjs` (`seed.cjs` uses
   the backend's own Prisma client),
3. starts `backend/dist/main.js` on port 3999 under `/tc/PeerGrading`.

Mails cannot be sent (fake SendGrid key); the app logs that and carries on.
`E2E_DISABLE_RATE_LIMIT=true` switches off the login limit, but only for
requests that come directly from localhost (see
`backend/src/security/rate-limit.ts`).

In GitHub Actions the job "End-to-end tests (Playwright)" runs on every pull
request. On failure, screenshots and traces are attached to the run as the
artifact `playwright-report` (open a trace with `npx playwright show-trace`).
