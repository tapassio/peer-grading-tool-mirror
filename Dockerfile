# Node 18 is end-of-life (no security updates since April 2025).
FROM node:22 AS backendBuild
LABEL stage=build

COPY backend/ /backend

WORKDIR /backend

# npm ci installs exactly the versions from package-lock.json
RUN npm ci && npm run build

# Angular 17 officially supports Node 18 and 20 only, so the frontend is
# built with Node 20. This image is only used for building, not at runtime.
FROM node:20 AS frontendBuild
LABEL stage=build

COPY frontend/ /frontend

WORKDIR /frontend

RUN npm ci && npm run build

FROM node:22 AS prod

ENV NODE_ENV=production

COPY --from=backendBuild /backend/dist /dist

COPY --from=backendBuild /backend/node_modules/ /dist/node_modules

COPY --from=frontendBuild /frontend/dist /frontend

WORKDIR /dist

CMD ["node", "/dist/main.js"]
