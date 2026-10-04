FROM node:22-alpine AS build
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bybit-market-scanner/package.json apps/bybit-market-scanner/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps/bybit-market-scanner apps/bybit-market-scanner
COPY packages/shared packages/shared

RUN pnpm --dir apps/bybit-market-scanner build
RUN pnpm --filter bybit-market-scanner --prod deploy /opt/scanner

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /opt/scanner ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
