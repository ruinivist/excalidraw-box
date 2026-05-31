import { applyPatch, type Operation } from "fast-json-patch";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { createDrawingStore, type DrawingStore } from "./db";
import { normalizeScene, normalizeTitle } from "./scene";
import { type ScenePayload } from "./shared";

const sceneSchema = z.object({
  elements: z.array(z.unknown()),
  appState: z.record(z.string(), z.unknown()),
  files: z.record(z.string(), z.unknown()),
});

const patchOperationSchema = z.object({
  op: z.enum(["add", "remove", "replace", "move", "copy", "test"]),
  path: z.string(),
  from: z.string().optional(),
  value: z.unknown().optional(),
});

const idInput = z.object({ id: z.string().min(1) });
const createDrawingInput = z.object({ title: z.string(), scene: sceneSchema });
const replaceDrawingInput = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  scene: sceneSchema,
});
const patchDrawingInput = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  patch: z.array(patchOperationSchema).min(1),
});

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolvePublicBaseUrl(raw = process.env.PUBLIC_BASE_URL): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error("PUBLIC_BASE_URL is required for the MCP server");
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return trimTrailingSlash(url.toString());
    }
  } catch {
  }

  throw new Error("PUBLIC_BASE_URL must be an absolute http(s) URL");
}

function drawingUrl(baseUrl: string, id: string): string {
  return `${trimTrailingSlash(baseUrl)}/d/${id}`;
}

function jsonText(data: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function notFound(id: string): never {
  throw new Error(`Drawing not found: ${id}`);
}

function mutationResult(publicBaseUrl: string, drawing: { id: string; title: string }) {
  return {
    id: drawing.id,
    title: drawing.title,
    url: drawingUrl(publicBaseUrl, drawing.id),
  };
}

function updateExistingDrawing(
  store: DrawingStore,
  id: string,
  update: { scene?: ScenePayload; title?: string },
) {
  const updated = store.updateDrawing(id, update);
  return updated ?? notFound(id);
}

function applyScenePatch(scene: ScenePayload, patch: Operation[]): ScenePayload {
  try {
    const result = applyPatch(structuredClone(scene), patch, true, true, true);
    return normalizeScene(result.newDocument);
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid JSON Patch: ${error.message}` : "Invalid JSON Patch");
  }
}

export function createMcpToolHandlers(store: DrawingStore, publicBaseUrl: string) {
  return {
    list_drawings() {
      return store.listDrawings();
    },

    get_drawing(input: unknown) {
      const { id } = idInput.parse(input);
      const drawing = store.getDrawing(id) ?? notFound(id);
      return {
        id: drawing.id,
        title: drawing.title,
        createdAt: drawing.createdAt,
        updatedAt: drawing.updatedAt,
        url: drawingUrl(publicBaseUrl, drawing.id),
        scene: drawing.scene,
      };
    },

    create_drawing(input: unknown) {
      const { title, scene } = createDrawingInput.parse(input);
      const created = store.createDrawing(normalizeTitle(title));
      const updated = updateExistingDrawing(store, created.id, {
        title,
        scene: normalizeScene(scene),
      });
      return mutationResult(publicBaseUrl, updated);
    },

    replace_drawing(input: unknown) {
      const { id, title, scene } = replaceDrawingInput.parse(input);
      const updated = updateExistingDrawing(store, id, {
        title,
        scene: normalizeScene(scene),
      });
      return mutationResult(publicBaseUrl, updated);
    },

    patch_drawing(input: unknown) {
      const { id, title, patch } = patchDrawingInput.parse(input);
      const drawing = store.getDrawing(id) ?? notFound(id);
      const updated = updateExistingDrawing(store, id, {
        title,
        scene: applyScenePatch(drawing.scene, patch as Operation[]),
      });
      return mutationResult(publicBaseUrl, updated);
    },
  };
}

export function createExcaliMcpHandler(store: DrawingStore, publicBaseUrl: string) {
  const tools = createMcpToolHandlers(store, publicBaseUrl);

  return createMcpHandler(
    (server) => {
      server.registerTool(
        "list_drawings",
        {
          title: "List Drawings",
          description: "Returns drawing metadata ordered like the app list.",
        },
        async () => jsonText(tools.list_drawings()),
      );

      server.registerTool(
        "get_drawing",
        {
          title: "Get Drawing",
          description: "Returns drawing metadata, browser URL, and raw ScenePayload.",
          inputSchema: idInput.shape,
        },
        async (input) => jsonText(tools.get_drawing(input)),
      );

      server.registerTool(
        "create_drawing",
        {
          title: "Create Drawing",
          description: "Creates a drawing from an explicit Excalidraw ScenePayload.",
          inputSchema: createDrawingInput.shape,
        },
        async (input) => jsonText(tools.create_drawing(input)),
      );

      server.registerTool(
        "replace_drawing",
        {
          title: "Replace Drawing",
          description: "Replaces a drawing scene and optionally its title.",
          inputSchema: replaceDrawingInput.shape,
        },
        async (input) => jsonText(tools.replace_drawing(input)),
      );

      server.registerTool(
        "patch_drawing",
        {
          title: "Patch Drawing",
          description: "Applies RFC 6902 JSON Patch operations to a drawing scene and optionally updates its title.",
          inputSchema: patchDrawingInput.shape,
        },
        async (input) => jsonText(tools.patch_drawing(input)),
      );
    },
    {
      serverInfo: {
        name: "excali",
        version: "0.1.0",
      },
    },
    {
      basePath: "",
      disableSse: true,
      maxDuration: 60,
    },
  );
}

export function createMcpServer() {
  const store = createDrawingStore(process.env.DATABASE_PATH);
  const handler = createExcaliMcpHandler(store, resolvePublicBaseUrl());

  return {
    port: Number(process.env.MCP_PORT ?? "3001"),
    hostname: process.env.MCP_HOST ?? "127.0.0.1",
    fetch(request: Request) {
      const url = new URL(request.url);
      if (url.pathname !== "/mcp") {
        return Response.json({ ok: false, error: "Not found" }, { status: 404 });
      }

      return handler(request);
    },
  } satisfies Parameters<typeof Bun.serve>[0];
}

if (import.meta.main) {
  const server = Bun.serve(createMcpServer());
  console.log(`MCP listening on http://${server.hostname}:${server.port}/mcp`);
}
