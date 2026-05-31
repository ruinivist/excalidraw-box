FROM oven/bun:1.3.11-alpine AS build
WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile

COPY src ./src
RUN bun run build

FROM caddy:2-alpine AS caddy

FROM oven/bun:1.3.11-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=127.0.0.1
ENV PORT=3000
ENV MCP_HOST=127.0.0.1
ENV MCP_PORT=3001
ENV DATABASE_PATH=/data/excalidraw.sqlite

COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY --from=build /app/dist/public /srv/public
COPY --from=build /app/dist/server /app/dist/server
COPY --from=build /app/dist/mcp /app/dist/mcp
COPY Caddyfile /etc/caddy/Caddyfile
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /data && chmod +x /usr/local/bin/docker-entrypoint.sh

VOLUME ["/data"]

EXPOSE 80

CMD ["/usr/local/bin/docker-entrypoint.sh"]
