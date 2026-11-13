# Peer Grading Tool

The Peer Grading Tool (PGT) is used for mutual and individual evaluation of group work.

## Origin and Attribution

This project was originally developed by **Nick Soland**
([@solandnick](https://github.com/solandnick)) at the
**Digital Sustainability Lab** of the Bern University of Applied Sciences
(BFH). It is released under the **MIT License** — see [`LICENSE`](./LICENSE).

- Upstream repository (authoritative source):
  <https://github.com/digital-sustainability-lab/peer-grading-tool-mirror>
- This fork (`tapassio/peer-grading-tool-mirror`) additionally carries the
  **DocPouch OIDC integration** and the **Toolchain Family hosting**
  extensions — see
  [`docs/toolchain-oidc-setup.md`](./docs/toolchain-oidc-setup.md) and
  [`docs/toolchain-integration-plan.md`](./docs/toolchain-integration-plan.md).

If you redistribute or build on this code, please retain the copyright
notice in `LICENSE`.

## Initial setup

1. First, the .env file must be set up for the backend. For this purpose, `.env.example` can be used as a template. (make sure to properly secure your environment variables when working in a productive environment)

   - DATABASE_URL, JWT-SECRET, JWT_REFRESH_SECRET and HOST can be left for local use.
   - SEND_GRID_KEY and SEND_GRID_SENDER_EMAIL must be obtained from sendgrid. see `https://sendgrid.com/`

2. Use `npm i` in the `frontend/` and `backend/` folder.

   - Then check whether the Prisma version in `/backend/package.json` and `/backend/package-lock.json` is at least 4.7.1.

3. Set up the database for the first time.
   - Copy `backend/prisma/seed.example.ts` in this folder and rename to `seed.ts`.
   - Change `seed.ts` according to your needs, such as creating a user with your e-mail adress.
   - Execute the command `npx prisma migrate dev --name init` in the `/backend` folder. This will create `dev.db` in the `backend/prisma/` folder.

## Start locally

To serve the frontend, use `npm run start` in the `/frontent`.

To serve the backend, `npm run start` in the `/backend` folder. `npm run start:dev` will start the backend in watch mode.

## Database

If required, the command `npm run db:reset` can be used in the `/backend` folder to reset the database using your `seed.ts` file

If a change has been made to the database model, i.e. to the file `/backend/prisma/schema.prisma`, you can delete `dev.db` or use `npx prisma migrate dev --create-only`.

## Local Deploy

PGT uses Docker Compose to deploy. You can deploy it locally by using `docker compose up` in the root directory.
You can have a look at the deployed app by going to `http://localhost:5000`.
This is useful for testing the localized build, because the angular server only allows for one language at a time.

## Open Sourcing

PGT is being open sourced. This is done through repository mirroring (push method) from Gitlab to GitHub. Only one branch is being tracked. It's called `open-source-mirror`. Make sure to not let your commits contain any sensitive data.

You can use the `package.json` file in the **root directory** to update the mirroring branch with `npm run merge-squash`.

### Fork differences

- **`digital-sustainability-lab/peer-grading-tool-mirror`** — upstream
  (canonical, see *Origin and Attribution* above).
- **`tapassio/peer-grading-tool-mirror`** — this fork, which adds the
  DocPouch OIDC integration and the Toolchain Family hosting features
  (PRs #1 and #2). The `open-source-mirror` mirroring workflow is upstream's
  and intentionally not used here.
- **`open-source-mirror` branch** in this repository — a snapshot of the
  last known good upstream state; see `package.json#scripts.merge-squash`.
