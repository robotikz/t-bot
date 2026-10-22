FROM node:22-alpine AS build
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/bybit-market-scanner/package.json apps/bybit-market-scanner/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN pnpm --dir apps/api exec tsc -p tsconfig.build.json --emitDeclarationOnly false --incremental false
RUN cp -R apps/api/dist /tmp/api-dist && pnpm --filter api --prod deploy /opt/api && rm -rf /opt/api/dist && cp -R /tmp/api-dist /opt/api/dist

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /opt/api ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
