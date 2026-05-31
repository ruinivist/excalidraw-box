import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type ScenePayload } from "../core/shared";
import { createDrawingStore, type DrawingStore } from "../server/db";
import {
  DEFAULT_STYLES_GUIDE_PATH,
  createExcaliMcpHandler,
  createMcpToolHandlers,
  resolvePublicBaseUrl,
  resolveStylesGuidePath,
} from "./server";

const cleanup: Array<{ dir: string; store?: DrawingStore; client?: Client }> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    const item = cleanup.pop();
    if (item) {
      await item.client?.close().catch(() => undefined);
      item.store?.close();
      rmSync(item.dir, { recursive: true, force: true });
    }
  }
});

function createTempTools() {
  const dir = mkdtempSync(join(tmpdir(), "excali-mcp-"));
  const store = createDrawingStore(join(dir, "test.sqlite"));
  cleanup.push({ dir, store });
  return {
    store,
    tools: createMcpToolHandlers(store, "http://example.test"),
  };
}

function createTempStylesGuidePath(content?: string) {
  const dir = mkdtempSync(join(tmpdir(), "excali-mcp-"));
  const path = join(dir, DEFAULT_STYLES_GUIDE_PATH.slice(1));
  mkdirSync(dirname(path), { recursive: true });
  if (content !== undefined) {
    writeFileSync(path, content);
  }
  cleanup.push({ dir });
  return path;
}

async function createTempClient(stylesGuidePath?: string) {
  const dir = mkdtempSync(join(tmpdir(), "excali-mcp-"));
  const store = createDrawingStore(join(dir, "test.sqlite"));
  const handler = createExcaliMcpHandler(
    store,
    "http://example.test",
    stylesGuidePath ? resolveStylesGuidePath(stylesGuidePath) : undefined,
  );
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/mcp"), {
    fetch: async (input, init) => handler(new Request(input, init)),
  });
  const client = new Client({ name: "excali-test", version: "1.0.0" });

  await client.connect(transport);
  cleanup.push({ dir, store, client });
  return { client, store };
}

function testScene(): ScenePayload {
  return {
    elements: [
      { id: "one", type: "rectangle", x: 10, y: 20 },
      { id: "two", type: "text", text: "hello" },
    ],
    appState: { theme: "dark" },
    files: {},
  };
}

describe("mcp tool handlers", () => {
  test("PUBLIC_BASE_URL is required", () => {
    expect(() => resolvePublicBaseUrl("")).toThrow("PUBLIC_BASE_URL is required");
  });

  test("missing fixed styles-guide path exposes no styles-guide resource", async () => {
    const stylesGuidePath = createTempStylesGuidePath();
    expect(resolveStylesGuidePath(stylesGuidePath)).toBeUndefined();

    const { client } = await createTempClient(stylesGuidePath);

    expect(client.getServerCapabilities()?.resources).toBeUndefined();
  });

  test("valid fixed styles-guide path registers the styles-guide resource", async () => {
    const contents = "# Scene style\n\nKeep labels terse.\n";
    const stylesGuidePath = createTempStylesGuidePath(contents);
    const resolved = resolveStylesGuidePath(stylesGuidePath);
    const { client } = await createTempClient(stylesGuidePath);
    const resources = await client.listResources();
    const readResult = await client.readResource({ uri: "excali://styles-guide" });

    expect(resolved).toEqual({ path: stylesGuidePath });
    expect(resources.resources).toContainEqual({
      name: "styles-guide",
      uri: "excali://styles-guide",
      title: "Styles Guide",
      description: "User-provided drawing styles guide for scene generation",
      mimeType: "text/markdown",
    });
    expect(readResult.contents).toEqual([
      {
        uri: "excali://styles-guide",
        mimeType: "text/markdown",
        text: contents,
      },
    ]);
  });

  test("create_drawing writes an explicit scene to a temp SQLite DB", () => {
    const { store, tools } = createTempTools();
    const scene = testScene();

    const result = tools.create_drawing({ title: "explicit", scene });
    const drawing = store.getDrawing(result.id);

    expect(result).toEqual({
      id: result.id,
      title: "explicit",
      revision: 1,
      url: `http://example.test/d/${result.id}`,
    });
    expect(drawing?.revision).toBe(1);
    expect(drawing?.scene).toEqual(scene);
  });

  test("get_drawing returns raw scene plus URL", () => {
    const { tools } = createTempTools();
    const scene = testScene();
    const result = tools.create_drawing({ title: "read", scene });

    const drawing = tools.get_drawing({ id: result.id });

    expect(drawing).toMatchObject({
      id: result.id,
      title: "read",
      revision: 1,
      url: `http://example.test/d/${result.id}`,
      scene,
    });
  });

  test("replace_drawing updates the existing drawing", () => {
    const { store, tools } = createTempTools();
    const result = tools.create_drawing({ title: "replace", scene: testScene() });
    const nextScene: ScenePayload = {
      elements: [{ id: "manual", type: "rectangle" }],
      appState: { theme: "dark" },
      files: {},
    };

    const replaced = tools.replace_drawing({ id: result.id, title: "replaced", scene: nextScene });

    expect(store.listDrawings()).toHaveLength(1);
    expect(replaced.revision).toBe(2);
    expect(store.getDrawing(result.id)?.title).toBe("replaced");
    expect(store.getDrawing(result.id)?.revision).toBe(2);
    expect(store.getDrawing(result.id)?.scene).toEqual(nextScene);
  });

  test("replace_drawing keeps the revision when the scene is already stored", () => {
    const { store, tools } = createTempTools();
    const scene = testScene();
    const result = tools.create_drawing({ title: "replace noop", scene });

    const replaced = tools.replace_drawing({ id: result.id, scene });

    expect(replaced.revision).toBe(1);
    expect(store.getDrawing(result.id)?.revision).toBe(1);
    expect(store.getDrawing(result.id)?.scene).toEqual(scene);
  });

  test("patch_drawing replaces an element property and removes an element", () => {
    const { store, tools } = createTempTools();
    const result = tools.create_drawing({ title: "patch", scene: testScene() });

    const patched = tools.patch_drawing({
      id: result.id,
      patch: [
        { op: "replace", path: "/elements/0/x", value: 42 },
        { op: "remove", path: "/elements/1" },
      ],
    });

    expect(patched.revision).toBe(2);
    expect(store.getDrawing(result.id)?.revision).toBe(2);
    expect(store.getDrawing(result.id)?.scene.elements).toEqual([{ id: "one", type: "rectangle", x: 42, y: 20 }]);
  });

  test("missing drawing IDs return tool errors", () => {
    const { tools } = createTempTools();

    expect(() => tools.get_drawing({ id: "missing" })).toThrow("Drawing not found: missing");
    expect(() =>
      tools.replace_drawing({
        id: "missing",
        scene: testScene(),
      }),
    ).toThrow("Drawing not found: missing");
  });
});
