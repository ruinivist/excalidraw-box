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
      "/d/:id": index,
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
    fetch() {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    },
  } satisfies Parameters<typeof Bun.serve>[0];
}

if (import.meta.main) {
  const server = Bun.serve(createServer());
  console.log(`Listening on http://${server.hostname}:${server.port}`);
}
