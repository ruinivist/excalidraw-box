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
          }),
        }),
        { params: { id: created.id } },
      ),
    );

    expect(response.status).toBe(200);
    cleanup();
  });
});
