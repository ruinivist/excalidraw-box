import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDrawingStore } from "./db";

const cleanup: string[] = [];

afterEach(() => {
  while (cleanup.length > 0) {
    const dir = cleanup.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createTempStore() {
  const dir = mkdtempSync(join(tmpdir(), "excali-"));
  cleanup.push(dir);
  return createDrawingStore(join(dir, "test.sqlite"));
}

describe("drawing store", () => {
  test("creates, updates, lists, and deletes drawings", () => {
    const store = createTempStore();
    const created = store.createDrawing();

    expect(created.title).toBe("Untitled");
    expect(created.revision).toBe(0);
    expect(created.scene.appState.theme).toBe("dark");
    expect(store.listDrawings()).toHaveLength(1);
    expect(store.listDrawings()[0]?.revision).toBe(0);

    const updated = store.updateDrawing(created.id, {
      title: "Flow",
      scene: {
        elements: [{ id: "one" }],
        appState: { gridSize: 20 },
        files: {},
      },
    });

    expect(updated.ok).toBe(true);
    expect(updated.ok ? updated.drawing.title : null).toBe("Flow");
    expect(updated.ok ? updated.drawing.revision : null).toBe(1);
    expect(updated.ok ? updated.drawing.scene.elements : []).toHaveLength(1);

    const removed = store.deleteDrawing(created.id);
    expect(removed.deleted).toBe(true);
    expect(store.listDrawings()).toHaveLength(1);
    expect(removed.next?.id).not.toBe(created.id);
  });

  test("rejects stale expected revisions without overwriting the scene", () => {
    const store = createTempStore();
    const created = store.createDrawing();

    const first = store.updateDrawing(created.id, {
      expectedRevision: 0,
      scene: {
        elements: [{ id: "first" }],
        appState: {},
        files: {},
      },
    });

    expect(first.ok).toBe(true);

    const stale = store.updateDrawing(created.id, {
      expectedRevision: 0,
      scene: {
        elements: [{ id: "stale" }],
        appState: {},
        files: {},
      },
    });

    expect(stale.ok).toBe(false);
    expect(stale.ok ? null : stale.reason).toBe("conflict");
    expect(store.getDrawing(created.id)?.revision).toBe(1);
    expect(store.getDrawing(created.id)?.scene.elements).toEqual([
      { id: "first" },
    ]);
  });

  test("keeps the revision unchanged when the scene is already stored", () => {
    const store = createTempStore();
    const created = store.createDrawing();
    const scene = {
      elements: [{ id: "same" }],
      appState: {},
      files: {},
    };

    const first = store.updateDrawing(created.id, { scene });
    expect(first.ok ? first.drawing.revision : null).toBe(1);

    const repeated = store.updateDrawing(created.id, { scene });
    expect(repeated.ok).toBe(true);
    expect(repeated.ok ? repeated.drawing.revision : null).toBe(1);
    expect(store.getDrawing(created.id)?.revision).toBe(1);
  });

  test("accepts stale expected revisions when the scene is already stored", () => {
    const store = createTempStore();
    const created = store.createDrawing();
    const scene = {
      elements: [{ id: "same" }],
      appState: {},
      files: {},
    };

    const first = store.updateDrawing(created.id, {
      expectedRevision: 0,
      scene,
    });
    expect(first.ok ? first.drawing.revision : null).toBe(1);

    const repeated = store.updateDrawing(created.id, {
      expectedRevision: 0,
      scene,
    });
    expect(repeated.ok).toBe(true);
    expect(repeated.ok ? repeated.drawing.revision : null).toBe(1);
    expect(store.getDrawing(created.id)?.scene.elements).toEqual([
      { id: "same" },
    ]);
  });

  test("increments the revision when the title changes but the scene does not", () => {
    const store = createTempStore();
    const created = store.createDrawing();
    const scene = {
      elements: [{ id: "same" }],
      appState: {},
      files: {},
    };

    const first = store.updateDrawing(created.id, {
      expectedRevision: 0,
      scene,
    });
    expect(first.ok ? first.drawing.revision : null).toBe(1);

    const renamed = store.updateDrawing(created.id, {
      expectedRevision: 1,
      title: "Renamed",
      scene,
    });
    expect(renamed.ok).toBe(true);
    expect(renamed.ok ? renamed.drawing.title : null).toBe("Renamed");
    expect(renamed.ok ? renamed.drawing.revision : null).toBe(2);
  });

  test("persists publication fields and exposes public drawings by slug", () => {
    const store = createTempStore();
    const created = store.createDrawing("Flow");
    store.updateDrawing(created.id, {
      scene: {
        elements: [{ id: "one" }],
        appState: { theme: "dark" },
        files: {},
      },
    });

    const published = store.publishDrawing(created.id, { slug: "flow" });

    expect(published.ok).toBe(true);
    expect(store.getDrawingPublication(created.id)).toEqual({
      enabled: true,
      slug: "flow",
    });
    expect(store.getPublicDrawing("flow")).toEqual({
      title: "Flow",
      elements: [{ id: "one" }],
      appState: { theme: "dark" },
      files: {},
    });
  });

  test("enforces unique active publication slugs", () => {
    const store = createTempStore();
    const first = store.createDrawing("First");
    const second = store.createDrawing("Second");

    expect(
      store.publishDrawing(first.id, {
        slug: "shared",
      }),
    ).toEqual({
      ok: true,
      publication: {
        enabled: true,
        slug: "shared",
      },
    });

    expect(
      store.publishDrawing(second.id, {
        slug: "shared",
      }),
    ).toEqual({
      ok: false,
      reason: "slug_conflict",
    });

    expect(store.disableDrawingPublication(first.id)).toEqual({
      ok: true,
      publication: { enabled: false },
    });

    expect(
      store.publishDrawing(second.id, {
        slug: "shared",
      }),
    ).toEqual({
      ok: true,
      publication: {
        enabled: true,
        slug: "shared",
      },
    });
  });

  test("clears public fields on disable", () => {
    const store = createTempStore();
    const created = store.createDrawing();

    expect(
      store.publishDrawing(created.id, {
        slug: "note",
      }),
    ).toEqual({
      ok: true,
      publication: {
        enabled: true,
        slug: "note",
      },
    });

    expect(store.disableDrawingPublication(created.id)).toEqual({
      ok: true,
      publication: { enabled: false },
    });
    expect(store.getDrawingPublication(created.id)).toEqual({ enabled: false });
    expect(store.getPublicDrawing("note")).toBeNull();
  });
});
