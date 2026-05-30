import { existsSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import index from "./index.html";
import { createApi } from "./api";
import { getDefaultDrawingStore } from "./db";

type ClientManifestFile = {
  path: string;
  loader: string;
  headers?: Record<string, string>;
};

type ClientManifest = {
  index: string;
  files: ClientManifestFile[];
};

type ProductionClientAssets = {
  serveHtml: (request: Request) => Response;
  serveAsset: (request: Request) => Response | null;
};

type AssetFile = ClientManifestFile & {
  brotliPath: string;
  fileUrl: URL;
};

function isClientManifest(value: unknown): value is ClientManifest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ClientManifest>;
  return typeof candidate.index === "string" && Array.isArray(candidate.files);
}

function toRequestPath(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }

  return `/${path.replace(/^\.\//, "")}`;
}

function isClientAssetFile(path: string): boolean {
  const name = basename(path);
  return name !== "server.js" && !name.startsWith("server-");
}

function acceptsBrotli(acceptEncoding: string | null): boolean {
  if (!acceptEncoding) {
    return false;
  }

  return acceptEncoding
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .some((value) => value === "br" || value.startsWith("br;"));
}

function createStaticResponse(
  fileUrl: URL,
  headersInit: Record<string, string> | undefined,
  cacheControl: string,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = new Headers(headersInit);
  headers.delete("ETag");
  headers.set("Cache-Control", cacheControl);
  if (extraHeaders) {
    for (const [name, value] of Object.entries(extraHeaders)) {
      headers.set(name, value);
    }
  }

  return new Response(Bun.file(fileUrl), {
    headers,
  });
}

export function createProductionClientAssets(
  manifest: ClientManifest,
  baseUrl = new URL("./", import.meta.url),
): ProductionClientAssets {
  const htmlEntry = manifest.files.find((file) => file.loader === "html" || file.path === manifest.index);
  if (!htmlEntry) {
    throw new Error("Production client manifest is missing the HTML shell");
  }

  const htmlUrl = new URL(htmlEntry.path, baseUrl);
  const assetEntries = new Map(
    manifest.files
      .filter((file) => file.path !== htmlEntry.path && isClientAssetFile(file.path))
      .map((file) => {
        const brotliPath = `${file.path}.br`;
        const brotliUrl = new URL(brotliPath, baseUrl);
        if (!existsSync(fileURLToPath(brotliUrl))) {
          throw new Error(`Missing Brotli asset for ${file.path}`);
        }

        return [
          toRequestPath(file.path),
          {
            ...file,
            brotliPath,
            fileUrl: new URL(file.path, baseUrl),
          } satisfies AssetFile,
        ] as const;
      }),
  );

  return {
    serveHtml() {
      return createStaticResponse(htmlUrl, htmlEntry.headers, "no-cache");
    },
    serveAsset(request) {
      const pathname = new URL(request.url).pathname;
      const asset = assetEntries.get(pathname);
      if (!asset) {
        return null;
      }
      if (!acceptsBrotli(request.headers.get("accept-encoding"))) {
        return new Response("Brotli encoding is required", {
          status: 406,
          headers: {
            "Cache-Control": "no-store",
            Vary: "Accept-Encoding",
          },
        });
      }

      return createStaticResponse(
        new URL(asset.brotliPath, asset.fileUrl),
        asset.headers,
        "public, max-age=31536000, immutable",
        {
          "Content-Encoding": "br",
          Vary: "Accept-Encoding",
        },
      );
    },
  };
}

export function createServer() {
  const drawingStore = getDefaultDrawingStore();
  const api = createApi(drawingStore);
  const productionClient = isClientManifest(index) ? createProductionClientAssets(index) : null;

  return {
    port: Number(process.env.PORT ?? "3000"),
    hostname: process.env.HOST ?? "localhost",
    routes: {
      "/": (request: Request) => {
        const drawing = drawingStore.ensureInitialDrawing();
        return Response.redirect(new URL(`/d/${drawing.id}`, request.url), 302);
      },
      "/d/:id": productionClient ? (request: Request) => productionClient.serveHtml(request) : index,
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
    fetch(request: Request) {
      const assetResponse = productionClient?.serveAsset(request);
      if (assetResponse) {
        return assetResponse;
      }

      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    },
  } satisfies Parameters<typeof Bun.serve>[0];
}

if (import.meta.main) {
  const server = Bun.serve(createServer());
  console.log(`Listening on http://${server.hostname}:${server.port}`);
}
