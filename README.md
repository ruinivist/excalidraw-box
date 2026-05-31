# excali-box

Private self-hosted Excalidraw with Bun, Caddy, and SQLite.

This is bare wrapper around the excalidraw packages that adds autosave and disk-persistence.

> GPT 5.5 generated

## Tl;dr

When building the image yourself

```
docker run --rm \
  -p 127.0.0.1:3000:80 \
  -e PUBLIC_BASE_URL=http://localhost:3000 \
  -v "$PWD/excali-box-data:/data" \
  excali
```

When pulling from GHCR ( you would want to change the `PUBLIC_BASE_URL` )

```
docker run --rm \
  -p 127.0.0.1:3000:80 \
  -e PUBLIC_BASE_URL=http://localhost:3000 \
  -v "$PWD/excali-box-data:/data" \
  ghcr.io/ruinivist/excalidraw-box:latest
```

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
discoverable as an MCP resource. Container images already include the repo `STYLES_GUIDE.md` at
`/config/styles-guide.md`, so the default guide is exposed automatically in Docker/GHCR.

```bash
docker run --rm \
  -p 127.0.0.1:3000:80 \
  -e PUBLIC_BASE_URL=http://localhost:3000 \
  -v "$PWD/excali-box-data:/data" \
  -v "$PWD/STYLES_GUIDE.md:/config/styles-guide.md:ro" \
  ghcr.io/ruinivist/excalidraw-box:latest
```

Bind-mounting a different file to `/config/styles-guide.md` overrides the bundled default for that container.
Local non-container runs are unchanged; if you want a styles guide there, you still need a file at `/config/styles-guide.md`.

## Authentication

By default, the application is protected by basic authentication using Caddy.
The default credentials are:
- **Username:** `admin`
- **Password:** `password`

You can customize these by setting the following environment variables when running the Docker container.
The password must be hashed using `bcrypt` since Caddy requires hashed passwords for basicauth.

**Intended flow to set a custom password:**
1. Generate a bcrypt hash of your desired password. For example, using a container to run Caddy's hash-password utility:
   ```bash
   docker run --rm caddy:2-alpine caddy hash-password --plaintext your_secure_password
   ```
2. Pass the generated hash and your desired username via environment variables when running the app:
   ```bash
   docker run --rm \
     -p 127.0.0.1:3000:80 \
     -e PUBLIC_BASE_URL=http://localhost:3000 \
     -e AUTH_USER=myuser \
     -e AUTH_HASH='\$2a\$14\$exampleHash...' \
     -v "$PWD/excali-box-data:/data" \
     ghcr.io/ruinivist/excalidraw-box:latest
   ```
