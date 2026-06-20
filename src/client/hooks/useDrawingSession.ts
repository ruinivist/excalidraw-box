import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_TITLE,
  type DrawingMeta,
  type DrawingPublication,
  type ScenePayload,
} from "../../core/shared";

type DrawingResponse = DrawingMeta & ScenePayload;
type PublicationResponse = DrawingPublication;
type ApiErrorBody = { ok: false; error?: string; drawing?: DrawingMeta };
type UpdateResponse = { ok: true; drawing: DrawingMeta };

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error ?? `Request failed: ${status}`);
  }
}

function pathToId(pathname = window.location.pathname): string | null {
  const match = pathname.match(/^\/d\/([^/]+)$/);
  return match?.[1] ?? null;
}

function sortDrawings(drawings: DrawingMeta[]): DrawingMeta[] {
  return [...drawings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function replaceMeta(
  drawings: DrawingMeta[],
  drawing: DrawingMeta,
): DrawingMeta[] {
  const filtered = drawings.filter((item) => item.id !== drawing.id);
  return sortDrawings([drawing, ...filtered]);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const body = (await response.json()) as T & ApiErrorBody;
  if (!response.ok) {
    throw new RequestError(response.status, body);
  }

  return body;
}

function fetchDrawingList() {
  return requestJson<DrawingMeta[]>("/api/drawings", { method: "GET" });
}

function isConflictError(
  error: unknown,
): error is RequestError & { body: ApiErrorBody & { drawing: DrawingMeta } } {
  return (
    error instanceof RequestError &&
    error.status === 409 &&
    error.body.drawing !== undefined
  );
}

function sceneFromDrawing(drawing: DrawingResponse): ScenePayload {
  return {
    elements: drawing.elements,
    appState: drawing.appState,
    files: drawing.files,
  };
}

export function useDrawingSession() {
  const [drawings, setDrawings] = useState<DrawingMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(pathToId());
  const [activeTitle, setActiveTitleState] = useState(DEFAULT_TITLE);
  const [scene, setScene] = useState<ScenePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editorReloadNonce, setEditorReloadNonce] = useState(0);
  const [publication, setPublication] = useState<DrawingPublication>({
    enabled: false,
  });
  const [publicationSlug, setPublicationSlugState] = useState("");
  const [publicationBusy, setPublicationBusy] = useState(false);

  const currentIdRef = useRef<string | null>(activeId);
  const currentTitleRef = useRef(activeTitle);
  const latestSceneRef = useRef<ScenePayload | null>(null);
  const publicationEnabledRef = useRef(false);
  const ignoreChangeRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const loadVersionRef = useRef(0);
  const loadedRevisionRef = useRef<number | null>(null);

  const clearPendingSaveTimeout = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string | null, timeoutMs?: number) => {
      if (toastTimeoutRef.current !== null) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }

      setToastMessage(message);
      if (message !== null && timeoutMs !== undefined) {
        toastTimeoutRef.current = window.setTimeout(
          () => setToastMessage(null),
          timeoutMs,
        );
      }
    },
    [],
  );

  const refreshList = useCallback(async () => {
    const list = await fetchDrawingList();
    setDrawings(sortDrawings(list));
    return list;
  }, []);

  const applyPublication = useCallback(
    (nextPublication: DrawingPublication) => {
      publicationEnabledRef.current = nextPublication.enabled;
      setPublication(nextPublication);

      if (nextPublication.enabled) {
        setPublicationSlugState(nextPublication.slug);
        return;
      }

      setPublicationSlugState("");
    },
    [],
  );

  const loadDrawing = useCallback(
    async (drawingId: string) => {
      const version = ++loadVersionRef.current;
      setLoading(true);
      setError(null);

      try {
        const [list, drawing, nextPublication] = await Promise.all([
          requestJson<DrawingMeta[]>("/api/drawings", { method: "GET" }),
          requestJson<DrawingResponse>(`/api/drawings/${drawingId}`, {
            method: "GET",
          }),
          requestJson<PublicationResponse>(
            `/api/drawings/${drawingId}/publication`,
            { method: "GET" },
          ),
        ]);

        if (version !== loadVersionRef.current) {
          return;
        }

        const nextScene = sceneFromDrawing(drawing);

        ignoreChangeRef.current = true;
        currentIdRef.current = drawing.id;
        currentTitleRef.current = drawing.title;
        latestSceneRef.current = nextScene;
        loadedRevisionRef.current = drawing.revision;

        setDrawings(replaceMeta(list, drawing));
        setActiveId(drawing.id);
        setActiveTitleState(drawing.title);
        setScene(nextScene);
        applyPublication(nextPublication);
        setEditorReloadNonce((current) => current + 1);
      } catch (loadError) {
        if (version !== loadVersionRef.current) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load drawing",
        );
      } finally {
        if (version === loadVersionRef.current) {
          setLoading(false);
        }
      }
    },
    [applyPublication],
  );

  const saveScene = useCallback(
    async (isManual = false) => {
      const drawingId = currentIdRef.current;
      const nextScene = latestSceneRef.current;
      const expectedRevision = loadedRevisionRef.current;
      if (!drawingId || !nextScene) {
        return;
      }
      setError(null);

      if (isManual) {
        showToast("Saving...");
      }

      const promise = requestJson<UpdateResponse>(
        `/api/drawings/${drawingId}`,
        {
          method: "PUT",
          body: JSON.stringify({ ...nextScene, expectedRevision }),
        },
      )
        .then((body) => {
          setDrawings((current) => replaceMeta(current, body.drawing));
          if (currentIdRef.current === drawingId) {
            loadedRevisionRef.current = body.drawing.revision;
          }
          if (isManual) {
            showToast("Saved", 2000);
          } else {
            showToast(null);
          }
        })
        .catch((saveError: unknown) => {
          if (isConflictError(saveError)) {
            clearPendingSaveTimeout();
            setError(null);
            setDrawings((current) =>
              replaceMeta(current, saveError.body.drawing),
            );
            if (isManual) {
              showToast("Reloading latest...");
            }
            return loadDrawing(drawingId);
          }

          setError(
            saveError instanceof Error ? saveError.message : "Save failed",
          );
          if (isManual) {
            showToast("Save failed", 2000);
          } else {
            showToast("Autosave failed");
          }
          throw saveError;
        })
        .finally(() => {
          inFlightSaveRef.current = null;
        });

      inFlightSaveRef.current = promise;
      await promise;
    },
    [clearPendingSaveTimeout, loadDrawing, showToast],
  );

  const flushPendingSave = useCallback(async () => {
    if (saveTimeoutRef.current !== null) {
      clearPendingSaveTimeout();
      await saveScene();
      return;
    }

    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }
  }, [clearPendingSaveTimeout, saveScene]);

  const triggerManualSave = useCallback(async () => {
    if (saveTimeoutRef.current !== null) {
      clearPendingSaveTimeout();
    }
    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }
    await saveScene(true);
  }, [clearPendingSaveTimeout, saveScene]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      void saveScene();
    }, 30000);
  }, [saveScene]);

  const navigateToDrawing = useCallback(
    async (
      drawingId: string,
      options?: { replace?: boolean; flush?: boolean },
    ) => {
      const replace = options?.replace ?? false;
      const flush = options?.flush ?? true;

      if (drawingId === currentIdRef.current && latestSceneRef.current) {
        if (replace) {
          window.history.replaceState(null, "", `/d/${drawingId}`);
        }
        return;
      }

      if (flush) {
        await flushPendingSave();
      }

      if (replace) {
        window.history.replaceState(null, "", `/d/${drawingId}`);
      } else {
        window.history.pushState(null, "", `/d/${drawingId}`);
      }

      await loadDrawing(drawingId);
    },
    [flushPendingSave, loadDrawing],
  );

  const createDrawing = useCallback(async () => {
    await flushPendingSave();
    const created = await requestJson<DrawingResponse>("/api/drawings", {
      method: "POST",
    });
    await navigateToDrawing(created.id, { flush: false });
  }, [flushPendingSave, navigateToDrawing]);

  const deleteDrawing = useCallback(
    async (drawingId: string) => {
      if (!window.confirm("Delete this drawing?")) {
        return;
      }

      if (drawingId === currentIdRef.current) {
        await flushPendingSave();
      }

      const response = await requestJson<{ ok: true; nextId: string | null }>(
        `/api/drawings/${drawingId}`,
        {
          method: "DELETE",
        },
      );

      if (drawingId === currentIdRef.current && response.nextId) {
        await navigateToDrawing(response.nextId, {
          replace: true,
          flush: false,
        });
      } else {
        await refreshList();
      }
    },
    [flushPendingSave, navigateToDrawing, refreshList],
  );

  const setActiveTitle = useCallback((title: string) => {
    currentTitleRef.current = title;
    setActiveTitleState(title);
  }, []);

  const submitTitle = useCallback(async () => {
    const drawingId = currentIdRef.current;
    if (!drawingId) {
      return;
    }

    try {
      const body = await requestJson<UpdateResponse>(
        `/api/drawings/${drawingId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: currentTitleRef.current,
            expectedRevision: loadedRevisionRef.current,
          }),
        },
      );

      currentTitleRef.current = body.drawing.title;
      loadedRevisionRef.current = body.drawing.revision;
      setActiveTitleState(body.drawing.title);
      setDrawings((current) => replaceMeta(current, body.drawing));
    } catch (renameError) {
      if (isConflictError(renameError)) {
        clearPendingSaveTimeout();
        setDrawings((current) =>
          replaceMeta(current, renameError.body.drawing),
        );
        await loadDrawing(drawingId);
        return;
      }

      setError(
        renameError instanceof Error ? renameError.message : "Rename failed",
      );
    }
  }, [clearPendingSaveTimeout, loadDrawing]);

  const handleSceneChange = useCallback(
    (nextScene: ScenePayload) => {
      latestSceneRef.current = nextScene;

      if (ignoreChangeRef.current) {
        ignoreChangeRef.current = false;
        return;
      }

      scheduleSave();
    },
    [scheduleSave],
  );

  const selectDrawing = useCallback(
    async (drawingId: string) => {
      await navigateToDrawing(drawingId);
    },
    [navigateToDrawing],
  );

  const setPublicationSlug = useCallback((slug: string) => {
    setPublicationSlugState(slug);
  }, []);

  const publishPublication = useCallback(async () => {
    const drawingId = currentIdRef.current;
    if (!drawingId) {
      return;
    }

    setPublicationBusy(true);
    setError(null);
    showToast("Publishing...");

    try {
      await flushPendingSave();

      const currentDrawingId = currentIdRef.current;
      if (!currentDrawingId) {
        return;
      }

      const body = await requestJson<PublicationResponse>(
        `/api/drawings/${currentDrawingId}/publication`,
        {
          method: "PUT",
          body: JSON.stringify({
            enabled: true,
            slug: publicationSlug,
          }),
        },
      );

      applyPublication(body);
      showToast("Published", 2000);
    } catch (publishError) {
      setError(
        publishError instanceof Error ? publishError.message : "Publish failed",
      );
      showToast("Publish failed", 2000);
    } finally {
      setPublicationBusy(false);
    }
  }, [applyPublication, flushPendingSave, publicationSlug, showToast]);

  const disablePublication = useCallback(async () => {
    const drawingId = currentIdRef.current;
    if (!drawingId) {
      return;
    }

    setPublicationBusy(true);
    setError(null);
    showToast("Disabling...");

    try {
      const body = await requestJson<PublicationResponse>(
        `/api/drawings/${drawingId}/publication`,
        {
          method: "PUT",
          body: JSON.stringify({ enabled: false }),
        },
      );

      applyPublication(body);
      showToast("Publication disabled", 2000);
    } catch (disableError) {
      setError(
        disableError instanceof Error ? disableError.message : "Disable failed",
      );
      showToast("Disable failed", 2000);
    } finally {
      setPublicationBusy(false);
    }
  }, [applyPublication, showToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        void triggerManualSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [triggerManualSave]);

  useEffect(() => {
    const currentPathId = pathToId();
    if (currentPathId) {
      void loadDrawing(currentPathId);
    } else {
      window.location.replace("/");
    }

    const onPopState = () => {
      const nextId = pathToId();
      if (nextId) {
        void navigateToDrawing(nextId, { replace: true, flush: true });
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [loadDrawing, navigateToDrawing]);

  useEffect(() => {
    const checkForExternalChanges = async () => {
      try {
        const list = await refreshList();
        const drawingId = currentIdRef.current;
        const loadedRevision = loadedRevisionRef.current;
        const serverDrawing = drawingId
          ? list.find((drawing) => drawing.id === drawingId)
          : null;

        if (
          serverDrawing &&
          loadedRevision !== null &&
          serverDrawing.revision > loadedRevision
        ) {
          clearPendingSaveTimeout();
          await loadDrawing(serverDrawing.id);
        }
      } catch {
        // Focus checks only discover external edits; direct save/load requests report failures.
      }
    };

    const handleFocus = () => {
      void checkForExternalChanges();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForExternalChanges();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearPendingSaveTimeout, loadDrawing, refreshList]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (toastTimeoutRef.current !== null) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  return {
    drawings,
    activeId,
    activeTitle,
    scene,
    loading,
    error,
    toastMessage,
    editorReloadNonce,
    publication,
    publicationSlug,
    publicationBusy,
    setActiveTitle,
    submitTitle,
    handleSceneChange,
    selectDrawing,
    createDrawing,
    deleteDrawing,
    setPublicationSlug,
    publishPublication,
    disablePublication,
  };
}
