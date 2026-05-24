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
    expect(created.scene.appState.theme).toBe("dark");
    expect(store.listDrawings()).toHaveLength(1);

    const updated = store.updateDrawing(created.id, {
      title: "Flow",
      scene: {
        elements: [{ id: "one" }],
        appState: { gridSize: 20 },
        files: {},
      },
    });

    expect(updated?.title).toBe("Flow");
    expect(updated?.scene.elements).toHaveLength(1);

    const removed = store.deleteDrawing(created.id);
    expect(removed.deleted).toBe(true);
    expect(store.listDrawings()).toHaveLength(1);
    expect(removed.next?.id).not.toBe(created.id);
  });
});
