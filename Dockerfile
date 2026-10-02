FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm --filter @portfolio/content build \
  && pnpm --filter @portfolio/api build \
  && pnpm --filter @portfolio/web build
RUN pnpm deploy --filter @portfolio/api --prod --legacy --ignore-scripts /out/api

FROM build AS migrate
WORKDIR /repo/apps/api
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM node:24-slim AS api
WORKDIR /app
ENV NODE_ENV=production PORT=3201
COPY --from=build /out/api ./
COPY --from=build /repo/content/package.json /repo/content/package.json
COPY --from=build /repo/content/dist /repo/content/dist
USER node
EXPOSE 3201
CMD ["node", "dist/main.js"]

FROM node:24-slim AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3200 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3200
CMD ["node", "apps/web/server.js"]
