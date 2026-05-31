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
    expect(store.getDrawing(created.id)?.scene.elements).toEqual([{ id: "first" }]);
  });

});
