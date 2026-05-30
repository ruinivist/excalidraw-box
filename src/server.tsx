import index from "./index.html";
import { createApi } from "./api";
import { getDefaultDrawingStore } from "./db";

export function createServer() {
  const drawingStore = getDefaultDrawingStore();
  const api = createApi(drawingStore);

  return {
    port: Number(process.env.PORT ?? "3000"),
    hostname: process.env.HOST ?? "localhost",
    routes: {
      "/": (request: Request) => {
        const drawing = drawingStore.ensureInitialDrawing();
        return Response.redirect(new URL(`/d/${drawing.id}`, request.url), 302);
      },
      ...(process.cwd().endsWith("/dist") ? {
        "/d/:id": async (req: Request) => {
          let file = Bun.file("./public/index.html");
          return new Response(file, {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
      } : {
        "/d/:id": index
      }),
      "/api/health": {
        GET: () => api.health(),
      },
      "/api/drawings": {
        GET: () => api.listDrawings(),
        POST: () => api.createDrawing(),
      },
      "/api/drawings/:id": {
        GET: (request: Request & { params: Record<string, string> }) => api.getDrawing(request),
        PUT: (request: Request & { params: Record<string, string> }) => api.updateDrawing(request),
        DELETE: (request: Request & { params: Record<string, string> }) => api.deleteDrawing(request),
      },
    },
    async fetch(request: Request) {
      const url = new URL(request.url);

      const isProd = process.cwd().endsWith("/dist");

      if (!isProd) {
        return Response.json({ ok: false, error: "Not found" }, { status: 404 });
      }

      // Remove any "/public" prefix from the request URL if it accidentally got included
      let reqPath = url.pathname;
      if (reqPath.startsWith("/public/")) {
        reqPath = reqPath.substring(7);
      }

      // In dist, static files are inside public
      const path = "./public" + reqPath;
      const file = Bun.file(path);
      if (await file.exists()) {
        // Cache indefinitely except index.html
        const headers: Record<string, string> = {};
        if (!reqPath.endsWith("index.html")) {
          // Add etag logic or use bun's hashes by only caching files that actually have hashes in them.
          // Bun generates hashes like chunk-02ahh9r5.js, we can check for that pattern
          // If we wanted to do ETag we could use Bun.file(path).size + lastModified but hashing is safer
          const isHashed = reqPath.match(/-[a-zA-Z0-9]{8}\.(js|css)$/);
          if (isHashed) {
            headers["Cache-Control"] = "public, max-age=31536000, immutable";
          } else {
            headers["Cache-Control"] = "no-cache";
          }
        } else {
          headers["Content-Type"] = "text/html; charset=utf-8";
          headers["Cache-Control"] = "no-cache";
        }
        return new Response(file, { headers });
      }
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    },
  } satisfies Parameters<typeof Bun.serve>[0];
}

if (import.meta.main) {
  const server = Bun.serve(createServer());
  console.log(`Listening on http://${server.hostname}:${server.port}`);
}
