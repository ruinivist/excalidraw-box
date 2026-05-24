import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_TITLE, type DrawingMeta, type DrawingRecord, type ScenePayload } from "./shared";
import { coerceStoredScene, emptyScene, normalizeTitle } from "./scene";

type DrawingRow = {
  id: string;
  title: string;
  data: string;
  createdAt: string;
  updatedAt: string;
};

type DrawingMetaRow = Omit<DrawingRow, "data">;

export type DrawingStore = ReturnType<typeof createDrawingStore>;

function createId(): string {
  return randomUUID().replaceAll("-", "").slice(0, 12);
}

function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  try {
    mkdirSync("/data", { recursive: true });
    return "/data/excalidraw.sqlite";
  } catch {
    return `${process.cwd()}/data/excalidraw.sqlite`;
  }
}

function readMeta(row: DrawingMetaRow | null | undefined): DrawingMeta | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function readRow(row: DrawingRow | null | undefined): DrawingRecord | null {
  if (!row) {
    return null;
  }

  return {
    ...readMeta(row)!,
    scene: coerceStoredScene(JSON.parse(row.data)),
  };
}

export function createDrawingStore(databasePath = resolveDatabasePath()) {
  mkdirSync(dirname(databasePath), { recursive: true });

  const db = new Database(databasePath, { create: true, strict: true });
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS drawings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS drawings_updated_at_idx
    ON drawings(updated_at DESC, created_at DESC);
  `);

  const listQuery = db.query(`
    SELECT
      id,
      title,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM drawings
    ORDER BY updated_at DESC, created_at DESC
  `);

  const getQuery = db.query(`
    SELECT
      id,
      title,
      data,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM drawings
    WHERE id = ?1
  `);

  const createQuery = db.query(`
    INSERT INTO drawings (id, title, data)
    VALUES (?1, ?2, ?3)
  `);

  const updateSceneQuery = db.query(`
    UPDATE drawings
    SET data = ?2, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?1
  `);

  const updateTitleQuery = db.query(`
    UPDATE drawings
    SET title = ?2, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?1
  `);

  const updateBothQuery = db.query(`
    UPDATE drawings
    SET title = ?2, data = ?3, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?1
  `);

  const deleteQuery = db.query(`
    DELETE FROM drawings
    WHERE id = ?1
  `);

  function listDrawings(): DrawingMeta[] {
    return (listQuery.all() as DrawingMetaRow[]).map((row) => readMeta(row)!);
  }

  function getDrawing(id: string): DrawingRecord | null {
    return readRow(getQuery.get(id) as DrawingRow | null | undefined);
  }

  function createDrawing(title = DEFAULT_TITLE): DrawingRecord {
    const id = createId();
    createQuery.run(id, normalizeTitle(title), JSON.stringify(emptyScene()));
    return getDrawing(id)!;
  }

  function getLatestDrawing(): DrawingMeta | null {
    return listDrawings()[0] ?? null;
  }

  function ensureInitialDrawing(): DrawingMeta {
    return getLatestDrawing() ?? createDrawing();
  }

  function updateDrawing(id: string, update: { scene?: ScenePayload; title?: string }): DrawingRecord | null {
    const existing = getDrawing(id);
    if (!existing) {
      return null;
    }

    const hasScene = update.scene !== undefined;
    const hasTitle = update.title !== undefined;

    if (!hasScene && !hasTitle) {
      return existing;
    }

    if (hasScene && hasTitle) {
      updateBothQuery.run(id, normalizeTitle(update.title), JSON.stringify(update.scene));
    } else if (hasScene) {
      updateSceneQuery.run(id, JSON.stringify(update.scene));
    } else {
      updateTitleQuery.run(id, normalizeTitle(update.title));
    }

    return getDrawing(id);
  }

  function deleteDrawing(id: string): { deleted: boolean; next: DrawingMeta | null } {
    const changes = Number(deleteQuery.run(id).changes);
    if (changes === 0) {
      return { deleted: false, next: null };
    }

    return {
      deleted: true,
      next: ensureInitialDrawing(),
    };
  }

  function close() {
    db.close(false);
  }

  return {
    databasePath,
    close,
    listDrawings,
    getDrawing,
    createDrawing,
    getLatestDrawing,
    ensureInitialDrawing,
    updateDrawing,
    deleteDrawing,
  };
}

let defaultStore: DrawingStore | null = null;

export function getDefaultDrawingStore(): DrawingStore {
  defaultStore ??= createDrawingStore();
  return defaultStore;
}
