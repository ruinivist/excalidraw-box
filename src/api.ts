import { type DrawingStore } from "./db";
import { type DrawingMeta } from "./shared";
import { HttpError, normalizeTitle, parseJsonBody, parseSceneText } from "./scene";

type RouteRequest = Request & {
  params?: Record<string, string>;
};

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ ok: false, error: error.message }, { status: error.status });
  }

  if (error instanceof Error && error.name === "AbortError") {
    return json({ ok: false, error: "Request aborted" }, { status: 499 });
  }

  console.error(error);
  return json({ ok: false, error: "Internal server error" }, { status: 500 });
}

function toMeta(drawing: DrawingMeta): DrawingMeta {
  return {
    id: drawing.id,
    title: drawing.title,
    createdAt: drawing.createdAt,
    updatedAt: drawing.updatedAt,
    revision: drawing.revision,
  };
}

function parseExpectedRevision(raw: Record<string, unknown>): number | undefined {
  if (!Object.hasOwn(raw, "expectedRevision")) {
    return undefined;
  }

  const value = raw.expectedRevision;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(400, "expectedRevision must be a non-negative integer");
  }

  return value;
}

export function createApi(store: DrawingStore) {
  return {
    health() {
      return json({ ok: true });
    },

    listDrawings() {
      return json(store.listDrawings());
    },

    createDrawing() {
      const drawing = store.createDrawing();
      return json(
        {
          ...toMeta(drawing),
          ...drawing.scene,
        },
        { status: 201 },
      );
    },

    getDrawing(request: RouteRequest) {
      try {
        const id = request.params?.id;
        const drawing = id ? store.getDrawing(id) : null;

        if (!drawing) {
          return json({ ok: false, error: "Drawing not found" }, { status: 404 });
        }

        return json({
          ...toMeta(drawing),
          ...drawing.scene,
        });
      } catch (error) {
        return errorResponse(error);
      }
    },

    async updateDrawing(request: RouteRequest) {
      try {
        const id = request.params?.id;
        if (!id) {
          throw new HttpError(400, "Missing drawing id");
        }

        const text = await request.text();
        const raw = parseJsonBody<Record<string, unknown>>(text);
        const hasTitle = Object.hasOwn(raw, "title");
        const hasScene =
          Object.hasOwn(raw, "elements") ||
          Object.hasOwn(raw, "appState") ||
          Object.hasOwn(raw, "files");
        const expectedRevision = parseExpectedRevision(raw);

        if (!hasTitle && !hasScene) {
          throw new HttpError(400, "Nothing to update");
        }

        const scene = hasScene ? parseSceneText(text) : undefined;
        const result = store.updateDrawing(id, {
          scene,
          title: hasTitle ? normalizeTitle(raw.title) : undefined,
          expectedRevision,
        });

        if (!result.ok && result.reason === "not_found") {
          return json({ ok: false, error: "Drawing not found" }, { status: 404 });
        }

        if (!result.ok && result.reason === "conflict") {
          return json(
            {
              ok: false,
              error: "Drawing changed externally",
              drawing: toMeta(result.drawing),
            },
            { status: 409 },
          );
        }

        const updated = result.drawing;
        return json({
          ok: true,
          drawing: toMeta(updated),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },

    deleteDrawing(request: RouteRequest) {
      const id = request.params?.id;
      if (!id) {
        return json({ ok: false, error: "Missing drawing id" }, { status: 400 });
      }

      const { deleted, next } = store.deleteDrawing(id);
      if (!deleted) {
        return json({ ok: false, error: "Drawing not found" }, { status: 404 });
      }

      return json({ ok: true, nextId: next?.id ?? null });
    },
  };
}
