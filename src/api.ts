import { type DrawingStore } from "./db";
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

  console.error(error);
  return json({ ok: false, error: "Internal server error" }, { status: 500 });
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
          id: drawing.id,
          title: drawing.title,
          createdAt: drawing.createdAt,
          updatedAt: drawing.updatedAt,
          ...drawing.scene,
        },
        { status: 201 },
      );
    },

    getDrawing(request: RouteRequest) {
      const id = request.params?.id;
      const drawing = id ? store.getDrawing(id) : null;

      if (!drawing) {
        return json({ ok: false, error: "Drawing not found" }, { status: 404 });
      }

      return json({
        id: drawing.id,
        title: drawing.title,
        createdAt: drawing.createdAt,
        updatedAt: drawing.updatedAt,
        ...drawing.scene,
      });
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

        if (!hasTitle && !hasScene) {
          throw new HttpError(400, "Nothing to update");
        }

        const scene = hasScene ? parseSceneText(text) : undefined;
        const updated = store.updateDrawing(id, {
          scene,
          title: hasTitle ? normalizeTitle(raw.title) : undefined,
        });

        if (!updated) {
          return json({ ok: false, error: "Drawing not found" }, { status: 404 });
        }

        return json({
          ok: true,
          drawing: {
            id: updated.id,
            title: updated.title,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
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
