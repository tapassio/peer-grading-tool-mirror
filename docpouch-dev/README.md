# Local DocPouch for the Peer Grading Tool

Runs a local [DocPouch](https://github.com/BFH-JTF/doc-pouch) instance on
<http://localhost:3031> and provisions everything the PGT needs for OIDC login
and result publishing.

## Quick start

```bash
# 1. Start DocPouch
docker compose -f docpouch-dev/docker-compose.yml up -d

# 2. Configure helper credentials
cp docpouch-dev/.env.example .env    # adjust DP_PASSWORD if needed

# 3. Provision structure, TDD, test users and the OIDC client
node docpouch-dev/setup-local.mjs
```

The script prints the `client_id` at the end — put it into `backend/.env` as
`DOCPOUCH_CLIENT_ID` and set `AUTH_MODE=oidc`.

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local DocPouch on port 3031 (admin password `admin`). |
| `.env.example` | Credentials and options read by the setup script. |
| `setup-local.mjs` | Idempotent provisioning: structure, TDD, test users, OIDC client. |
| `structure-peer-grading-result.json` | Result structure (`type 100` / `subType 0`). |
| `tdd-peer-grading.json` | Tool Details Document template (`type 0` / `subType 0`). |
| `.oidc-client.json` | Generated OIDC client registration (git-ignored). |

## Test users

| User | Password | DocPouch role | PGT access |
|---|---|---|---|
| `pgt-admin` | `peer-grading-test` | `admin` | yes (`ADMIN`) |
| `pgt-member` | `peer-grading-test` | `member` | no (`403`) |

Set `DP_CREATE_TEST_USERS=false` to skip them.

## Notes

- DocPouch has a rate limit of 100 GET requests / 15 min / IP; the setup script
  paces its requests accordingly.
- The admin password on first start comes from `ADMIN_INITIAL_PASSWORD` in
  `docker-compose.yml`. If unset, DocPouch prints a generated password once:
  `docker compose -f docpouch-dev/docker-compose.yml logs docpouch`.
- Full setup and deployment instructions: [`../docs/toolchain-oidc-setup.md`](../docs/toolchain-oidc-setup.md).
