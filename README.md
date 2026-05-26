# excali-box

Private self-hosted Excalidraw with Bun and SQLite.

This is bare wrapper around the excalidraw packages that adds autosave and disk-persistence.
No auth to keep things simple - you either run in a private network or put it behind a Caddy auth or similar solutions.

> GPT 5.5 generated

## Pull from GHCR and run

Images are published to:

`ghcr.io/ruinivist/excalidraw-box:<version>`

```bash
docker pull ghcr.io/ruinivist/excalidraw-box:latest
docker run --rm -p 127.0.0.1:3000:3000 -v "$PWD/excali-box-data:/data" ghcr.io/ruinivist/excalidraw-box:latest
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
docker run --rm -p 127.0.0.1:3000:3000 -v "$PWD/excali-box-data:/data" excali
```

This will make the data persistent in the `excali-box-data` folder in the current directory, the site will be available at `localhost:3000`.
