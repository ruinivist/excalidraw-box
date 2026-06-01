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

  test("does not increment revisions for equivalent normalized scenes", async () => {
    const { api, cleanup } = withApi();
    const created = await api.createDrawing().json();

    await api.updateDrawing(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({
            elements: [{ id: "shape" }],
            appState: { gridSize: 20 },
            files: {},
            expectedRevision: 0,
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    const response = await api.updateDrawing(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({
            elements: [{ id: "shape" }],
            appState: { gridSize: 20, selectedElementIds: { shape: true } },
            files: {},
            expectedRevision: 0,
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

  test("returns disabled and enabled publication shapes", async () => {
    const { api, cleanup } = withApi();
    const created = await api.createDrawing().json();

    const disabled = await api.getDrawingPublication(
      Object.assign(new Request(`http://local/api/drawings/${created.id}/publication`), { params: { id: created.id } }),
    );
    expect(disabled.status).toBe(200);
    expect(await disabled.json()).toEqual({ enabled: false });

    const publish = await api.updateDrawingPublication(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}/publication`, {
          method: "PUT",
          body: JSON.stringify({
            enabled: true,
            slug: "Flow Chart",
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    expect(publish.status).toBe(200);
    expect(await publish.json()).toEqual({
      enabled: true,
      slug: "flow-chart",
    });

    const enabled = await api.getDrawingPublication(
      Object.assign(new Request(`http://local/api/drawings/${created.id}/publication`), { params: { id: created.id } }),
    );
    expect(await enabled.json()).toEqual({
      enabled: true,
      slug: "flow-chart",
    });
    cleanup();
  });

  test("publishes, renames, and disables publications", async () => {
    const { api, cleanup } = withApi();
    const created = await api.createDrawing().json();

    await api.updateDrawingPublication(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}/publication`, {
          method: "PUT",
          body: JSON.stringify({
            enabled: true,
            slug: "first",
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    const renamed = await api.updateDrawingPublication(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}/publication`, {
          method: "PUT",
          body: JSON.stringify({
            enabled: true,
            slug: "second",
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toEqual({
      enabled: true,
      slug: "second",
    });

    const disable = await api.updateDrawingPublication(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}/publication`, {
          method: "PUT",
          body: JSON.stringify({ enabled: false }),
        }),
        { params: { id: created.id } },
      ),
    );

    expect(disable.status).toBe(200);
    expect(await disable.json()).toEqual({ enabled: false });
    cleanup();
  });

  test("returns 400 for invalid publication slugs", async () => {
    const { api, cleanup } = withApi();
    const created = await api.createDrawing().json();

    const response = await api.updateDrawingPublication(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}/publication`, {
          method: "PUT",
          body: JSON.stringify({
            enabled: true,
            slug: "API",
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "slug is reserved",
    });
    cleanup();
  });

  test("returns 409 for publication slug collisions", async () => {
    const { api, cleanup } = withApi();
    const first = await api.createDrawing().json();
    const second = await api.createDrawing().json();

    await api.updateDrawingPublication(
      Object.assign(
        new Request(`http://local/api/drawings/${first.id}/publication`, {
          method: "PUT",
          body: JSON.stringify({
            enabled: true,
            slug: "shared",
          }),
        }),
        { params: { id: first.id } },
      ),
    );

    const response = await api.updateDrawingPublication(
      Object.assign(
        new Request(`http://local/api/drawings/${second.id}/publication`, {
          method: "PUT",
          body: JSON.stringify({
            enabled: true,
            slug: "shared",
          }),
        }),
        { params: { id: second.id } },
      ),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: "Published slug already exists",
    });
    cleanup();
  });

  test("returns public scene data for enabled slugs and 404 otherwise", async () => {
    const { api, cleanup } = withApi();
    const created = await api.createDrawing().json();

    await api.updateDrawing(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({
            title: "Public Flow",
            elements: [{ id: "shape" }],
            appState: { theme: "dark" },
            files: {},
            expectedRevision: 0,
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    await api.updateDrawingPublication(
      Object.assign(
        new Request(`http://local/api/drawings/${created.id}/publication`, {
          method: "PUT",
          body: JSON.stringify({
            enabled: true,
            slug: "public-flow",
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    const enabled = await api.getPublicDrawing(
      Object.assign(new Request("http://local/api/public/drawings/public-flow"), { params: { slug: "public-flow" } }),
    );

    expect(enabled.status).toBe(200);
    expect(await enabled.json()).toEqual({
      title: "Public Flow",
      elements: [{ id: "shape" }],
      appState: { theme: "dark" },
      files: {},
    });

    const missing = await api.getPublicDrawing(
      Object.assign(new Request("http://local/api/public/drawings/missing"), { params: { slug: "missing" } }),
    );
    expect(missing.status).toBe(404);
    cleanup();
  });
});
