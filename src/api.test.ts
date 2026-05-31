import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApi } from "./api";
import { createDrawingStore } from "./db";

function withApi() {
  const dir = mkdtempSync(join(tmpdir(), "excali-api-"));
  const store = createDrawingStore(join(dir, "test.sqlite"));
  const api = createApi(store);

  return {
    api,
    cleanup() {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("api", () => {
  test("creates a drawing with dark theme by default", async () => {
    const { api, cleanup } = withApi();

    const created = await api.createDrawing().json();

    expect(created.appState.theme).toBe("dark");
    expect(created.revision).toBe(0);
    cleanup();
  });

  test("returns 400 for invalid JSON", async () => {
    const { api, cleanup } = withApi();
    const drawing = await api.createDrawing().json();

    const response = await api.updateDrawing(
      Object.assign(
        new Request(`http://local/api/drawings/${drawing.id}`, {
          method: "PUT",
          body: "{",
        }),
        { params: { id: drawing.id } },
      ),
    );

    expect(response.status).toBe(400);
    cleanup();
  });

  test("returns 404 for missing drawing", () => {
    const { api, cleanup } = withApi();

    const response = api.getDrawing(
      Object.assign(new Request("http://local/api/drawings/missing"), { params: { id: "missing" } }),
    );

    expect(response.status).toBe(404);
    cleanup();
  });

  test("updates a drawing scene", async () => {
    const { api, cleanup } = withApi();
    const created = await api.createDrawing().json();

    const response = await api.updateDrawing(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({
            elements: [{ id: "shape" }],
            appState: {},
            files: {},
            expectedRevision: created.revision,
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.drawing.revision).toBe(1);
    cleanup();
  });

  test("updates scene and title with a matching expected revision", async () => {
    const { api, cleanup } = withApi();
    const created = await api.createDrawing().json();

    const response = await api.updateDrawing(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({
            title: "Synced",
            elements: [{ id: "shape" }],
            appState: {},
            files: {},
            expectedRevision: 0,
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.drawing.title).toBe("Synced");
    expect(body.drawing.revision).toBe(1);
    cleanup();
  });

  test("returns 409 for stale expected revisions without overwriting", async () => {
    const { api, cleanup } = withApi();
    const created = await api.createDrawing().json();

    await api.updateDrawing(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({
            elements: [{ id: "server" }],
            appState: {},
            files: {},
            expectedRevision: 0,
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    const conflict = await api.updateDrawing(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({
            elements: [{ id: "stale" }],
            appState: {},
            files: {},
            expectedRevision: 0,
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    expect(conflict.status).toBe(409);
    const body = await conflict.json();
    expect(body).toEqual({
      ok: false,
      error: "Drawing changed externally",
      drawing: {
        id: created.id,
        title: created.title,
        createdAt: body.drawing.createdAt,
        updatedAt: body.drawing.updatedAt,
        revision: 1,
      },
    });

    const stored = await api.getDrawing(
      Object.assign(new Request(`http://local/api/drawings/${created.id}`), { params: { id: created.id } }),
    ).json();
    expect(stored.elements).toEqual([{ id: "server" }]);
    cleanup();
  });
});
