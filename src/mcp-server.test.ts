import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDrawingStore, type DrawingStore } from "./db";
import { createMcpToolHandlers, resolvePublicBaseUrl } from "./mcp-server";
import { type ScenePayload } from "./shared";

const cleanup: Array<{ dir: string; store: DrawingStore }> = [];

afterEach(() => {
  while (cleanup.length > 0) {
    const item = cleanup.pop();
    if (item) {
      item.store.close();
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
