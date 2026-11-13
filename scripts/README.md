# scripts/

`dev-up.mjs` boots the entire local dev stack (DocPouch + backend + frontend) and keeps state under
`scripts/.pids/` and `scripts/logs/` (both git-ignored).

## Commands

```bash
node scripts/dev-up.mjs            # start everything
node scripts/dev-up.mjs --status   # report ports + pids
node scripts/dev-up.mjs --stop    # stop backend + frontend (DocPouch keeps running)
node scripts/dev-up.mjs --wait    # start everything + tail the logs in the foreground

# Common overrides
node scripts/dev-up.mjs --locale en
node scripts/dev-up.mjs --backend-port 3080 --frontend-port 4201
node scripts/dev-up.mjs --skip-build      # don't rebuild the backend
node scripts/dev-up.mjs --no-frontend    # backend only
node scripts/dev-up.mjs --docpouch-port 3034   # if the default 3033 is taken
```

## Test users (created by `setup-local.mjs`)

| User | Password | DocPouch role | PGT access |
|---|---|---|---|
| `pgt-admin` | `peer-grading-test` | `admin` | yes (`ADMIN`) |
| `pgt-member` | `peer-grading-test` | `member` | no (`403`) |

Log in via **Mit DocPouch anmelden** on `/de/login` (or `/en/login`). Open
`http://localhost:4200/de/` after the dev server is up.

## Layout of generated artefacts

```
scripts/
  .pids/
    backend.pid
    frontend.pid
  logs/
    backend.log
    frontend.log
```
