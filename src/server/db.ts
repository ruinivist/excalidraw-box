import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_TITLE, type DrawingMeta, type DrawingPublication, type DrawingRecord, type ScenePayload } from "../core/shared";
import { emptyScene, normalizeScene, normalizeTitle } from "../core/scene";

type DrawingRow = {
  id: string;
  title: string;
  data: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

type DrawingMetaRow = Omit<DrawingRow, "data">;

type DrawingPublicationRow = {
  publicEnabled: number;
  publicSlug: string | null;
};

type PublicDrawingRow = {
  title: string;
  data: string;
};

export type DrawingUpdateResult =
  | { ok: true; drawing: DrawingRecord }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; drawing: DrawingRecord };

export type DrawingPublicationUpdateResult =
  | { ok: true; publication: DrawingPublication }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "slug_conflict" };

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
    revision: row.revision,
  };
}

function readPublication(row: DrawingPublicationRow | null | undefined): DrawingPublication | null {
  if (!row) {
    return null;
  }

  if (row.publicEnabled !== 1 || !row.publicSlug) {
    return { enabled: false };
  }

  return {
    enabled: true,
    slug: row.publicSlug,
  };
}

function readPublicDrawing(row: PublicDrawingRow | null | undefined) {
  if (!row) {
    return null;
  }

  let scene: ScenePayload;
  try {
    scene = normalizeScene(JSON.parse(row.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scene parsing error";
    throw new Error(`Invalid stored public scene: ${message}`);
  }

  return {
    title: row.title,
    ...scene,
  };
}

function readRow(row: DrawingRow | null | undefined): DrawingRecord | null {
  if (!row) {
    return null;
  }

  let scene: ScenePayload;
  try {
    scene = normalizeScene(JSON.parse(row.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scene parsing error";
    throw new Error(`Invalid stored scene for drawing ${row.id}: ${message}`);
  }

  return {
    ...readMeta(row)!,
    scene,
  };
}

function ensurePublicationColumns(db: Database) {
  const columns = db
    .query("PRAGMA table_info(drawings)")
    .all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));

  if (!names.has("public_enabled")) {
    db.exec("ALTER TABLE drawings ADD COLUMN public_enabled INTEGER NOT NULL DEFAULT 0");
  }

  if (!names.has("public_slug")) {
    db.exec("ALTER TABLE drawings ADD COLUMN public_slug TEXT");
  }
}

function isSlugConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed: drawings.public_slug");
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
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revision INTEGER NOT NULL DEFAULT 0,
      public_enabled INTEGER NOT NULL DEFAULT 0,
      public_slug TEXT
    );

    CREATE INDEX IF NOT EXISTS drawings_updated_at_idx
    ON drawings(updated_at DESC, created_at DESC);
  `);

  ensurePublicationColumns(db);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS drawings_public_slug_active_idx
    ON drawings(public_slug)
    WHERE public_enabled = 1 AND public_slug IS NOT NULL;
  `);

  const listQuery = db.query(`
    SELECT
      id,
      title,
      created_at AS createdAt,
      updated_at AS updatedAt,
      revision
    FROM drawings
    ORDER BY updated_at DESC, created_at DESC
  `);

  const getQuery = db.query(`
    SELECT
      id,
      title,
      data,
      created_at AS createdAt,
      updated_at AS updatedAt,
      revision
    FROM drawings
    WHERE id = ?1
  `);

  const createQuery = db.query(`
    INSERT INTO drawings (id, title, data)
    VALUES (?1, ?2, ?3)
  `);

  const updateSceneQuery = db.query(`
    UPDATE drawings
    SET data = ?2, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ?1
  `);

  const updateTitleQuery = db.query(`
    UPDATE drawings
    SET title = ?2, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ?1
  `);

  const updateBothQuery = db.query(`
    UPDATE drawings
    SET title = ?2, data = ?3, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ?1
  `);

  const updateSceneExpectedQuery = db.query(`
    UPDATE drawings
    SET data = ?2, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ?1 AND revision = ?3
  `);

  const updateTitleExpectedQuery = db.query(`
    UPDATE drawings
    SET title = ?2, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ?1 AND revision = ?3
  `);

  const updateBothExpectedQuery = db.query(`
    UPDATE drawings
    SET title = ?2, data = ?3, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ?1 AND revision = ?4
  `);

  const deleteQuery = db.query(`
    DELETE FROM drawings
    WHERE id = ?1
  `);

  const getPublicationQuery = db.query(`
    SELECT
      public_enabled AS publicEnabled,
      public_slug AS publicSlug
    FROM drawings
    WHERE id = ?1
  `);

  const publishQuery = db.query(`
    UPDATE drawings
    SET
      public_enabled = 1,
      public_slug = ?2
    WHERE id = ?1
  `);

  const disablePublicationQuery = db.query(`
    UPDATE drawings
    SET
      public_enabled = 0,
      public_slug = NULL
    WHERE id = ?1
  `);

  const getPublicDrawingQuery = db.query(`
    SELECT
      title,
      data
    FROM drawings
    WHERE public_enabled = 1 AND public_slug = ?1
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

  function updateDrawing(
    id: string,
    update: { scene?: ScenePayload; title?: string; expectedRevision?: number },
  ): DrawingUpdateResult {
    const hasScene = update.scene !== undefined;
    const hasTitle = update.title !== undefined;
    const existingRow = getQuery.get(id) as DrawingRow | null | undefined;

    if (!existingRow) {
      return { ok: false, reason: "not_found" };
    }

    const existing = readRow(existingRow)!;
    if (!hasScene && !hasTitle) {
      return { ok: true, drawing: existing };
    }

    const nextTitle = hasTitle ? normalizeTitle(update.title) : existingRow.title;
    const nextScene = hasScene ? JSON.stringify(update.scene) : existingRow.data;
    const titleChanged = nextTitle !== existingRow.title;
    const sceneChanged = nextScene !== existingRow.data;

    if (!titleChanged && !sceneChanged) {
      return { ok: true, drawing: existing };
    }

    if (update.expectedRevision !== undefined && update.expectedRevision !== existingRow.revision) {
      return { ok: false, reason: "conflict", drawing: existing };
    }

    let changes: number;
    if (sceneChanged && titleChanged) {
      changes =
        update.expectedRevision === undefined
          ? Number(updateBothQuery.run(id, nextTitle, nextScene).changes)
          : Number(updateBothExpectedQuery.run(id, nextTitle, nextScene, update.expectedRevision).changes);
    } else if (sceneChanged) {
      changes =
        update.expectedRevision === undefined
          ? Number(updateSceneQuery.run(id, nextScene).changes)
          : Number(updateSceneExpectedQuery.run(id, nextScene, update.expectedRevision).changes);
    } else {
      changes =
        update.expectedRevision === undefined
          ? Number(updateTitleQuery.run(id, nextTitle).changes)
          : Number(updateTitleExpectedQuery.run(id, nextTitle, update.expectedRevision).changes);
    }

    const drawing = getDrawing(id);
    if (changes > 0 && drawing) {
      return { ok: true, drawing };
    }

    if (!drawing) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: false, reason: "conflict", drawing };
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

  function getDrawingPublication(id: string): DrawingPublication | null {
    return readPublication(getPublicationQuery.get(id) as DrawingPublicationRow | null | undefined);
  }

  function publishDrawing(id: string, publication: { slug: string }): DrawingPublicationUpdateResult {
    try {
      const changes = Number(publishQuery.run(id, publication.slug).changes);
      if (changes === 0) {
        return { ok: false, reason: "not_found" };
      }
    } catch (error) {
      if (isSlugConflictError(error)) {
        return { ok: false, reason: "slug_conflict" };
      }

      throw error;
    }

    return {
      ok: true,
      publication: getDrawingPublication(id)!,
    };
  }

  function disableDrawingPublication(id: string): DrawingPublicationUpdateResult {
    const changes = Number(disablePublicationQuery.run(id).changes);
    if (changes === 0) {
      return { ok: false, reason: "not_found" };
    }

    return {
      ok: true,
      publication: { enabled: false },
    };
  }

  function getPublicDrawing(slug: string) {
    return readPublicDrawing(getPublicDrawingQuery.get(slug) as PublicDrawingRow | null | undefined);
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
    getDrawingPublication,
    publishDrawing,
    disableDrawingPublication,
    getPublicDrawing,
  };
}

let defaultStore: DrawingStore | null = null;

export function getDefaultDrawingStore(): DrawingStore {
  defaultStore ??= createDrawingStore();
  return defaultStore;
}
