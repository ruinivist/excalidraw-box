# Project: `excalidraw-box`

## Goal

Build a small self-hosted web app that provides:

```text
- Excalidraw editor
- Server-side autosave to SQLite
- No collaboration
- No accounts inside the app
- Reverse-proxy auth handled by Caddy
- Manual export to PNG/SVG/.excalidraw
- Docker Compose deployment
```

The app should be intentionally small and auditable.

---

# Non-goals

Do **not** implement:

```text
- real-time collaboration
- public sharing links
- user accounts
- teams/workspaces
- comments
- Firebase
- S3/MinIO in v1
- complex permissions
```

Authentication is handled outside the app by Caddy `basic_auth` or later Authelia/AuthentiK.

---

# Stack

Use:

```text
Next.js App Router
React
TypeScript
@excalidraw/excalidraw
better-sqlite3
Docker Compose
Caddy reverse proxy
```

Rationale:

- `@excalidraw/excalidraw` is the official embeddable package. ([npm][1])
- Excalidraw exposes `onChange(elements, appState, files)` for persistence. ([Excalidraw Docs][2])
- Excalidraw provides export utilities such as `exportToCanvas` for rendering scenes to images. ([Excalidraw Docs][3])
- Next.js officially supports standalone Docker deployment. ([Next.js][4])

---

# Version 1 feature set

## V1 must have

```text
1. Single default drawing
2. Load drawing from SQLite on page load
3. Autosave drawing to SQLite after edits
4. Debounce saves by 1.5 seconds
5. Show save status:
   - Saved
   - Saving…
   - Save failed
6. Export PNG from the current scene
7. Export .excalidraw JSON from the current scene
8. Persist SQLite database under /data
9. Dockerfile
10. docker-compose.yml
11. Caddyfile example
```

## V1 should avoid

```text
- multiple drawings
- login UI
- sharing
- collaboration
- migrations framework
- Prisma, unless really needed
```

Use plain `better-sqlite3` to keep the code small.

---

# Directory structure

```text
excalidraw-autosave/
  app/
    api/
      drawing/
        route.ts
    globals.css
    layout.tsx
    page.tsx

  components/
    ExcalidrawClient.tsx

  lib/
    db.ts
    scene.ts
    debounce.ts

  public/

  Dockerfile
  docker-compose.yml
  Caddyfile.example
  next.config.ts
  package.json
  tsconfig.json
  .dockerignore
  README.md
```

---

# Data model

Use one SQLite table.

```sql
CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

For v1, always use:

```text
id = "default"
```

Stored `data` should be the scene object:

```json
{
  "type": "excalidraw-autosave-scene",
  "version": 1,
  "elements": [],
  "appState": {},
  "files": {}
}
```

Do not store only rendered PNG. Store the editable scene JSON as the source of truth.

---

# API design

## `GET /api/drawing`

Returns the saved drawing.

If no drawing exists, return an empty scene:

```json
{
  "type": "excalidraw-autosave-scene",
  "version": 1,
  "elements": [],
  "appState": {},
  "files": {}
}
```

## `POST /api/drawing`

Accepts:

```json
{
  "elements": [],
  "appState": {},
  "files": {}
}
```

Behavior:

```text
- Validate body is an object.
- Validate elements is an array.
- Validate appState is an object.
- Validate files is an object.
- Strip volatile or UI-only appState fields if needed.
- Save JSON to SQLite.
- Upsert row id = "default".
- Return { "ok": true, "updatedAt": "..." }.
```

## Optional `GET /api/health`

Returns:

```json
{
  "ok": true
}
```

Useful for Docker health checks.

---

# Scene handling

Create `lib/scene.ts`.

Responsibilities:

```text
- define EmptyScene
- normalize incoming scene
- remove unwanted volatile appState fields
- cap payload size
```

Recommended payload size cap for v1:

```text
25 MB
```

If the scene exceeds this, return HTTP `413 Payload Too Large`.

Reason: Excalidraw embedded images are stored under `files`; they can make scene JSON large.

---

# Frontend behavior

## Page load

```text
1. Render loading state.
2. Fetch /api/drawing.
3. Pass returned scene to Excalidraw as initialData.
4. Render editor full-screen.
```

The official integration docs show that the Excalidraw component should be used client-side in Next.js, with `"use client"` and the Excalidraw CSS import. ([Excalidraw Docs][5])

## Autosave

Use Excalidraw’s `onChange`.

Pseudo-flow:

```tsx
onChange={(elements, appState, files) => {
  setSaveStatus("dirty");
  debouncedSave({ elements, appState, files });
}}
```

Debounced save:

```text
- wait 1500 ms after last change
- POST to /api/drawing
- set status Saving… while request in flight
- set status Saved after success
- set status Save failed after failure
```

Important: Do not save on every pointer movement without debounce.

## Save status UI

A small fixed indicator:

```text
top-right:
  Saved
  Saving…
  Save failed
```

Optionally show last saved timestamp.

---

# Export behavior

## `.excalidraw` export

Implement client-side export by taking the current scene and downloading JSON.

Filename:

```text
drawing-YYYY-MM-DD-HHMM.excalidraw
```

Content:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [],
  "appState": {},
  "files": {}
}
```

This keeps compatibility with regular Excalidraw import/export. The Excalidraw repo describes the open `.excalidraw` JSON file format as a supported feature. ([GitHub][6])

## PNG export

Use Excalidraw export utilities client-side.

The docs show `exportToCanvas` exported from `@excalidraw/excalidraw`; it takes `elements`, `appState`, and export dimensions. ([Excalidraw Docs][3])

Implementation idea:

```tsx
import { exportToCanvas } from "@excalidraw/excalidraw";

const canvas = await exportToCanvas({
  elements,
  appState: {
    ...appState,
    exportBackground: true,
  },
  files,
  getDimensions: (width, height) => ({
    width,
    height,
    scale: 2,
  }),
});

const blob = await new Promise<Blob>((resolve) =>
  canvas.toBlob((blob) => resolve(blob!), "image/png"),
);
```

Then trigger browser download.

Do PNG export client-side first. It avoids needing headless browser rendering on the server.

---

# Important implementation detail: access to current scene

Use `excalidrawAPI`.

The Excalidraw API exposes methods such as `getFiles`. ([Excalidraw Docs][7])

Store latest values from `onChange` in React refs:

```tsx
const latestSceneRef = useRef({
  elements: [],
  appState: {},
  files: {},
});
```

Update it inside `onChange`.

Use that ref for export buttons.

---

# Suggested files

## `package.json`

```json
{
  "name": "excalidraw-autosave",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@excalidraw/excalidraw": "latest",
    "better-sqlite3": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@types/better-sqlite3": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "typescript": "latest"
  }
}
```

## `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

---

# Database module

## `lib/db.ts`

Requirements:

```text
- Read DATABASE_PATH from env
- Default to /data/excalidraw.sqlite
- Ensure parent directory exists
- Initialize schema
- Export getDrawing() and saveDrawing()
```

Pseudo-code:

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH ?? "/data/excalidraw.sqlite";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS drawings (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

export function getDrawing(id = "default") {
  const row = db.prepare("SELECT data FROM drawings WHERE id = ?").get(id) as
    | { data: string }
    | undefined;

  return row ? JSON.parse(row.data) : null;
}

export function saveDrawing(data: unknown, id = "default") {
  const serialized = JSON.stringify(data);

  db.prepare(
    `
    INSERT INTO drawings (id, data, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      updated_at = CURRENT_TIMESTAMP
  `,
  ).run(id, serialized);

  return new Date().toISOString();
}
```

---

# API route

## `app/api/drawing/route.ts`

Requirements:

```text
- Force Node runtime, not Edge
- GET returns saved or empty scene
- POST saves normalized scene
- Handle invalid JSON
- Enforce payload size cap
```

Add:

```ts
export const runtime = "nodejs";
```

Pseudo-code:

```ts
import { NextResponse } from "next/server";
import { getDrawing, saveDrawing } from "@/lib/db";
import { emptyScene, normalizeScene } from "@/lib/scene";

export const runtime = "nodejs";

export async function GET() {
  const saved = getDrawing("default");
  return NextResponse.json(saved ?? emptyScene());
}

export async function POST(req: Request) {
  const text = await req.text();

  if (text.length > 25 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: "Scene too large" },
      { status: 413 },
    );
  }

  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const scene = normalizeScene(raw);
  const updatedAt = saveDrawing(scene, "default");

  return NextResponse.json({ ok: true, updatedAt });
}
```

---

# Client component

## `components/ExcalidrawClient.tsx`

Requirements:

```text
- "use client"
- import Excalidraw and CSS
- fetch initial data
- render full viewport
- onChange debounced autosave
- export JSON button
- export PNG button
- save status
```

Important:

```tsx
import "@excalidraw/excalidraw/index.css";
```

Use a custom debounce instead of lodash to avoid another dependency.

---

# CSS/UI

Keep UI minimal.

```text
- Editor fills viewport.
- Floating toolbar at top-right.
- Buttons:
  - Export PNG
  - Export .excalidraw
- Save status badge:
  - Saved
  - Saving…
  - Failed
```

Do not attempt to reproduce Excalidraw’s own toolbar.

---

# Docker

## `Dockerfile`

Use Next.js standalone output.

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/data/excalidraw.sqlite

RUN mkdir -p /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
```

## `docker-compose.yml`

```yaml
services:
  excalidraw-autosave:
    build: .
    container_name: excalidraw-autosave
    expose:
      - "3000"
    environment:
      DATABASE_PATH: /data/excalidraw.sqlite
    volumes:
      - ./data:/data
    restart: unless-stopped

  caddy:
    image: caddy:latest
    container_name: excalidraw-caddy
    depends_on:
      - excalidraw-autosave
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile.example:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

## `Caddyfile.example`

```caddyfile
draw.example.com {
  basic_auth {
    zero REPLACE_WITH_CADDY_HASH
  }

  reverse_proxy excalidraw-autosave:3000
}
```

Generate password hash:

```bash
docker run --rm -it caddy:latest caddy hash-password
```

---

# Backup plan

SQLite file:

```text
./data/excalidraw.sqlite
```

Backup command:

```bash
mkdir -p ./backups
sqlite3 ./data/excalidraw.sqlite ".backup './backups/excalidraw-$(date +%F-%H%M).sqlite'"
```

Recommended cron:

```cron
0 3 * * * cd /path/to/excalidraw-autosave && sqlite3 ./data/excalidraw.sqlite ".backup './backups/excalidraw-$(date +\%F-\%H\%M).sqlite'"
```

Also back up `.excalidraw` exports manually for critical drawings.

---

# Security model

V1 app assumes:

```text
- It is not public without reverse proxy auth.
- Caddy handles TLS.
- Caddy handles basic_auth.
- The app does not implement users.
- The app should not expose port 3000 to the public internet.
```

In Compose, use:

```yaml
expose:
  - "3000"
```

Do **not** use:

```yaml
ports:
  - "3000:3000"
```

unless testing locally.

---

# Acceptance criteria

Codex should finish with a repo that satisfies:

```text
1. `npm run dev` opens editor locally.
2. Drawing reloads after refresh.
3. Drawing persists after app restart.
4. Docker Compose starts Caddy + app.
5. SQLite DB is created under ./data.
6. No direct public app port is exposed.
7. Export PNG downloads a PNG.
8. Export .excalidraw downloads editable JSON.
9. Autosave status visibly changes.
10. No collaboration code exists.
```

Manual test:

```text
1. Start app.
2. Draw rectangle and text.
3. Wait until status says Saved.
4. Refresh browser.
5. Confirm rectangle and text remain.
6. Restart container.
7. Confirm drawing remains.
8. Export PNG.
9. Export .excalidraw.
10. Import .excalidraw into official Excalidraw and confirm it opens.
```

---

# Future V2, only after V1 works

Add these later, not now:

```text
- multiple named drawings
- drawing list page
- thumbnails
- duplicate drawing
- delete drawing
- server-side export endpoint
- periodic backup UI
- WebDAV/S3 export
- basic file manager
```

For V2 multiple drawings, change routes to:

```text
GET    /api/drawings
POST   /api/drawings
GET    /api/drawings/:id
PUT    /api/drawings/:id
DELETE /api/drawings/:id
```

Schema:

```sql
CREATE TABLE drawings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

# Instruction

Build the V1 exactly as specified. Keep code minimal. Do not add accounts, collaboration, sharing, Firebase, Prisma, Tailwind, or extra abstractions. Use the official `@excalidraw/excalidraw` package and SQLite persistence through `better-sqlite3`. Use Caddy for auth in the deployment example.
