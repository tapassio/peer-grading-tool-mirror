# Node 24 = LTS (security updates until April 2028).
FROM node:24 AS backendBuild
LABEL stage=build

COPY backend/ /backend

WORKDIR /backend

# npm ci installs exactly the versions from package-lock.json
# Prisma 7 no longer generates the client during npm install
RUN npm ci && npx prisma generate && npm run build

# Angular 22 supports Node 22, 24 and 26. Only used for building.
FROM node:24 AS frontendBuild
LABEL stage=build

COPY frontend/ /frontend

WORKDIR /frontend

RUN npm ci && npm run build

FROM node:24 AS prod

ENV NODE_ENV=production

COPY --from=backendBuild /backend/dist /dist

COPY --from=backendBuild /backend/node_modules/ /dist/node_modules

COPY --from=frontendBuild /frontend/dist /frontend

WORKDIR /dist

CMD ["node", "/dist/main.js"]
