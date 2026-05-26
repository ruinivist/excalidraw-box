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
docker run --rm -p 3000:3000 -v "$PWD/excali-box-data:/data" excali
```

This will make the data persistent in the `excali-box-data` folder in the current directory, the site will be available at `localhost:3000`.

By default, this image binds to `localhost`. To expose it on all interfaces, set `HOST=0.0.0.0`:

```bash
docker run --rm -p 3000:3000 -v "$PWD/excali-box-data:/data" -e HOST=0.0.0.0 excali
```
