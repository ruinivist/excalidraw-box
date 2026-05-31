import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
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

  test("fails to open databases missing the revision column", () => {
    const dir = mkdtempSync(join(tmpdir(), "excali-"));
    cleanup.push(dir);
    const databasePath = join(dir, "test.sqlite");
    const db = new Database(databasePath, { create: true, strict: true });
    db.exec(`
      CREATE TABLE drawings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO drawings (id, title, data)
      VALUES ('legacy', 'Legacy', '{"elements":[],"appState":{},"files":{}}');
    `);
    db.close(false);

    expect(() => createDrawingStore(databasePath)).toThrow(/revision/i);
  });

  test("throws when reading drawings with invalid stored scene payloads", () => {
    const dir = mkdtempSync(join(tmpdir(), "excali-"));
    cleanup.push(dir);
    const databasePath = join(dir, "test.sqlite");
    const db = new Database(databasePath, { create: true, strict: true });
    db.exec(`
      CREATE TABLE drawings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revision INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO drawings (id, title, data, revision)
      VALUES ('broken', 'Broken', '{"appState":{},"files":{}}', 0);
    `);
    db.close(false);

    const store = createDrawingStore(databasePath);
    expect(() => store.getDrawing("broken")).toThrow(/Invalid stored scene/);
    store.close();
  });
});
