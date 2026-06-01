import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDrawingStore, type DrawingStore } from "./db";
import { createServer } from "./http-server";

const cleanup: string[] = [];
const stores: DrawingStore[] = [];

afterEach(() => {
  while (stores.length > 0) {
    stores.pop()?.close();
  }

  while (cleanup.length > 0) {
    const dir = cleanup.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createServerFixture() {
  const dir = mkdtempSync(join(tmpdir(), "excali-server-"));
  cleanup.push(dir);

  const store = createDrawingStore(join(dir, "test.sqlite"));
  stores.push(store);

  return {
    store,
    server: createServer({ drawingStore: store }),
  };
}

describe("createServer", () => {
  test("redirects / to the latest drawing", () => {
    const { server, store } = createServerFixture();

    const response = server.routes["/"]?.(new Request("http://local/")) as Response;
    const created = store.listDrawings();

    expect(created).toHaveLength(1);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`http://local/d/${created[0]?.id}`);
  });

  test("keeps Bun responsible for API routes", async () => {
    const { server } = createServerFixture();
    const response = await server.routes["/api/health"]?.GET?.();

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ ok: true });
  });

  test("does not expose a Bun static route for drawings in production", () => {
    const { server } = createServerFixture();

    expect(Object.hasOwn(server.routes, "/d/:id")).toBe(false);
    expect(Object.hasOwn(server.routes, "/p/:slug")).toBe(false);
  });

  test("serves public drawing data through the public api", async () => {
    const { server, store } = createServerFixture();
    const drawing = store.createDrawing("Published");
    store.publishDrawing(drawing.id, { slug: "published-note" });

    const response = await server.routes["/api/public/drawings/:slug"]?.GET?.(
      Object.assign(new Request("http://local/api/public/drawings/published-note"), {
        params: { slug: "published-note" },
      }),
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      title: "Published",
      elements: [],
      appState: { theme: "dark" },
      files: {},
    });
  });

  test("returns 404 for unknown or unpublished public slugs", async () => {
    const { server } = createServerFixture();

    const response = await server.routes["/api/public/drawings/:slug"]?.GET?.(
      Object.assign(new Request("http://local/api/public/drawings/missing"), { params: { slug: "missing" } }),
    );

    expect(response?.status).toBe(404);
  });

  test("returns JSON 404 for unmatched requests", async () => {
    const { server } = createServerFixture();
    const response = await server.fetch(new Request("http://local/index-abc123.js"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "Not found" });
  });
});
