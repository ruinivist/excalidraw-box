FROM oven/bun:1.3.11-alpine AS build
WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY README.md ./
RUN bun run build

FROM oven/bun:1.3.11-alpine AS runner
WORKDIR /app/dist

ENV NODE_ENV=production
ENV HOST=localhost
ENV PORT=3000
ENV DATABASE_PATH=/data/excalidraw.sqlite

COPY --from=build /app/dist ./

RUN mkdir -p /data

EXPOSE 3000

CMD ["bun", "./server.js"]
