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

> Note that this command will bind to ALL interfaces. If you use a rev
> proxy, you may want to bind to locahost instead, you can do that by setting the `HOST` environment variable to `localhost`:

```bash
docker run --rm -p 3000:3000 -v "$PWD/excali-box-data:/data" -e HOST=localhost excali
```
