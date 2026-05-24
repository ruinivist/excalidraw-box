# excali

Private self-hosted Excalidraw with Bun and SQLite.

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
docker run --rm -p 3000:3000 -v "$PWD/data:/data" excali
```
