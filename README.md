# excali-box

Private self-hosted Excalidraw with Bun, Caddy, and SQLite.

This is bare wrapper around the excalidraw packages that adds autosave and disk-persistence.
No auth to keep things simple - you either run in a private network or put it behind Caddy auth or similar solutions.

> GPT 5.5 generated

## Pull from GHCR and run

Images are published to:

`ghcr.io/ruinivist/excalidraw-box:<version>`

```bash
docker pull ghcr.io/ruinivist/excalidraw-box:latest
docker run --rm -p 127.0.0.1:3000:80 -e PUBLIC_BASE_URL=http://localhost:3000 -v "$PWD/excali-box-data:/data" ghcr.io/ruinivist/excalidraw-box:latest
```

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## Test

```bash
bun run test
bun run typecheck
```

## Build the image

```bash
docker build -t excali .
docker run --rm -p 127.0.0.1:3000:80 -e PUBLIC_BASE_URL=http://localhost:3000 -v "$PWD/excali-box-data:/data" excali
```

This will make the data persistent in the `excali-box-data` folder in the current directory, with Caddy serving the browser build on `localhost:3000`. `PUBLIC_BASE_URL` is required so MCP tools can return drawing URLs with the public browser origin. You would want it to be the same url you use to access the app in the browser - in case you reverse proxy or use a tailscale alias etc.

## Optional MCP styles guide resource

The MCP server can optionally expose one extra read-only resource at `excali://styles-guide`. This file is then
discoverable as an MCP resource.

```bash
docker run --rm \
  -p 127.0.0.1:3000:80 \
  -e PUBLIC_BASE_URL=http://localhost:3000 \
  -v "$PWD/excali-box-data:/data" \
  -v "$PWD/STYLES_GUIDE.md:/config/styles-guide.md:ro" \
  ghcr.io/ruinivist/excalidraw-box:latest
```

Repo-root `STYLES_GUIDE.md` which is what I wrote for myself is not used at all unless you explicitly mount it to `/config/styles-guide.md`.
