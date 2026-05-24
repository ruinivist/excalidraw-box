import "../node_modules/@excalidraw/excalidraw/dist/prod/index.css";
import {
  Excalidraw,
  exportToBlob,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_TITLE, type DrawingMeta, type ScenePayload } from "./shared";

type DrawingResponse = DrawingMeta & ScenePayload;

const EXCALIDRAW_THEME_TOKEN_MAP = [
  ["--island-bg-color", "--app-island-bg"],
  ["--sidebar-bg-color", "--app-sidebar-bg"],
  ["--sidebar-border-color", "--app-sidebar-border"],
  ["--sidebar-shadow", "--app-sidebar-shadow"],
  ["--color-surface-lowest", "--app-surface-lowest"],
  ["--color-surface-low", "--app-surface-low"],
  ["--color-surface-primary-container", "--app-selected-bg"],
  ["--color-on-surface", "--app-text-color"],
  ["--color-on-primary-container", "--app-selected-text-color"],
  ["--color-disabled", "--app-disabled-color"],
  ["--input-bg-color", "--app-input-bg"],
  ["--input-border-color", "--app-input-border"],
  ["--input-label-color", "--app-input-color"],
  ["--default-border-color", "--app-button-border"],
  ["--button-hover-bg", "--app-button-hover-bg"],
  ["--button-active-bg", "--app-button-active-bg"],
  ["--button-active-border", "--app-button-active-border"],
  ["--overlay-bg-color", "--app-overlay-bg"],
] as const;

function pathToId(pathname = window.location.pathname): string | null {
  const match = pathname.match(/^\/d\/([^/]+)$/);
  return match?.[1] ?? null;
}

function sortDrawings(drawings: DrawingMeta[]): DrawingMeta[] {
  return [...drawings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function replaceMeta(drawings: DrawingMeta[], drawing: DrawingMeta): DrawingMeta[] {
  const filtered = drawings.filter((item) => item.id !== drawing.id);
  return sortDrawings([drawing, ...filtered]);
}

function sceneToInitialData(scene: ScenePayload): ExcalidrawInitialDataState {
  return scene as ExcalidrawInitialDataState;
}

function sceneFromEditor(
  elements: readonly unknown[],
  appState: AppState,
  files: BinaryFiles,
): ScenePayload {
  return {
    elements: [...elements],
    appState: appState as unknown as Record<string, unknown>,
    files: files as unknown as Record<string, unknown>,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function filenameBase(title: string): string {
  const safeTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;

  return `${safeTitle || "drawing"}-${stamp}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }

  return body;
}

function DrawerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.75 9h1.5M5.75 12h1.5M5.75 15h1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function App() {
  const [drawings, setDrawings] = useState<DrawingMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(pathToId());
  const [activeTitle, setActiveTitle] = useState(DEFAULT_TITLE);
  const [scene, setScene] = useState<ScenePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentIdRef = useRef<string | null>(activeId);
  const currentTitleRef = useRef(activeTitle);
  const latestSceneRef = useRef<ScenePayload | null>(null);
  const ignoreChangeRef = useRef(false);
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const loadVersionRef = useRef(0);
  const themeSyncFrameRef = useRef<number | null>(null);

  const activeDrawing = useMemo(
    () => drawings.find((drawing) => drawing.id === activeId) ?? null,
    [activeId, drawings],
  );

  const refreshList = useCallback(async () => {
    const list = await requestJson<DrawingMeta[]>("/api/drawings", { method: "GET" });
    setDrawings(sortDrawings(list));
    return list;
  }, []);

  const saveScene = useCallback(async () => {
    const drawingId = currentIdRef.current;
    const nextScene = latestSceneRef.current;
    if (!drawingId || !nextScene) {
      return;
    }
    setError(null);

    const promise = requestJson<{ ok: true; drawing: DrawingMeta }>(`/api/drawings/${drawingId}`, {
      method: "PUT",
      body: JSON.stringify(nextScene),
    })
      .then((body) => {
        setDrawings((current) => replaceMeta(current, body.drawing));
      })
      .catch((saveError: unknown) => {
        setError(saveError instanceof Error ? saveError.message : "Save failed");
        throw saveError;
      })
      .finally(() => {
        inFlightSaveRef.current = null;
      });

    inFlightSaveRef.current = promise;
    await promise;
  }, []);

  const flushPendingSave = useCallback(async () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      await saveScene();
      return;
    }

    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }
  }, [saveScene]);

  const scheduleSave = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      void saveScene();
    }, 1500);
  }, [saveScene]);

  const loadDrawing = useCallback(
    async (drawingId: string) => {
      const version = ++loadVersionRef.current;
      setLoading(true);
      setError(null);

      try {
        const [list, drawing] = await Promise.all([
          requestJson<DrawingMeta[]>("/api/drawings", { method: "GET" }),
          requestJson<DrawingResponse>(`/api/drawings/${drawingId}`, { method: "GET" }),
        ]);

        if (version !== loadVersionRef.current) {
          return;
        }

        const nextScene = {
          elements: drawing.elements,
          appState: drawing.appState,
          files: drawing.files,
        };

        ignoreChangeRef.current = true;
        currentIdRef.current = drawing.id;
        currentTitleRef.current = drawing.title;
        latestSceneRef.current = nextScene;

        setDrawings(sortDrawings(list));
        setActiveId(drawing.id);
        setActiveTitle(drawing.title);
        setScene(nextScene);
      } catch (loadError) {
        const list = await refreshList();
        if (list.length === 0) {
          const created = await requestJson<DrawingResponse>("/api/drawings", { method: "POST" });
          window.history.replaceState(null, "", `/d/${created.id}`);
          await loadDrawing(created.id);
          return;
        }

        const fallback = list[0];
        if (fallback && fallback.id !== drawingId) {
          window.history.replaceState(null, "", `/d/${fallback.id}`);
          await loadDrawing(fallback.id);
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load drawing");
      } finally {
        if (version === loadVersionRef.current) {
          setLoading(false);
        }
      }
    },
    [refreshList],
  );

  const navigateToDrawing = useCallback(
    async (drawingId: string, options?: { replace?: boolean; flush?: boolean }) => {
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
    const created = await requestJson<DrawingResponse>("/api/drawings", { method: "POST" });
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

      const response = await requestJson<{ ok: true; nextId: string | null }>(`/api/drawings/${drawingId}`, {
        method: "DELETE",
      });

      if (drawingId === currentIdRef.current && response.nextId) {
        await navigateToDrawing(response.nextId, { replace: true, flush: false });
      } else {
        await refreshList();
      }
    },
    [flushPendingSave, navigateToDrawing, refreshList],
  );

  const handleTitleSubmit = useCallback(async () => {
    const drawingId = currentIdRef.current;
    if (!drawingId) {
      return;
    }

    try {
      const body = await requestJson<{ ok: true; drawing: DrawingMeta }>(`/api/drawings/${drawingId}`, {
        method: "PUT",
        body: JSON.stringify({ title: currentTitleRef.current }),
      });

      currentTitleRef.current = body.drawing.title;
      setActiveTitle(body.drawing.title);
      setDrawings((current) => replaceMeta(current, body.drawing));
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Rename failed");
    }
  }, []);

  const exportPng = useCallback(async () => {
    const latest = latestSceneRef.current;
    if (!latest) {
      return;
    }

    const blob = await exportToBlob({
      elements: latest.elements as never[],
      appState: {
        ...(latest.appState as unknown as AppState),
        exportBackground: true,
      },
      files: latest.files as BinaryFiles,
      mimeType: "image/png",
      getDimensions: (width: number, height: number) => ({
        width,
        height,
        scale: 2,
      }),
    });

    downloadBlob(blob, `${filenameBase(currentTitleRef.current)}.png`);
  }, []);

  const exportExcalidraw = useCallback(() => {
    const latest = latestSceneRef.current;
    if (!latest) {
      return;
    }

    const json = serializeAsJSON(
      latest.elements as never[],
      latest.appState as Partial<AppState>,
      latest.files as BinaryFiles,
      "local",
    );

    downloadBlob(
      new Blob([json], { type: "application/json" }),
      `${filenameBase(currentTitleRef.current)}.excalidraw`,
    );
  }, []);

  const syncThemeTokens = useCallback(() => {
    const appShell = appShellRef.current;
    const excalidrawRoot = appShell?.querySelector<HTMLElement>(".excalidraw");
    if (!appShell || !excalidrawRoot) {
      return;
    }

    const computedStyles = window.getComputedStyle(excalidrawRoot);
    for (const [sourceToken, targetToken] of EXCALIDRAW_THEME_TOKEN_MAP) {
      const value = computedStyles.getPropertyValue(sourceToken).trim();
      if (value) {
        appShell.style.setProperty(targetToken, value);
      }
    }
  }, []);

  const scheduleThemeTokenSync = useCallback(() => {
    if (themeSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(themeSyncFrameRef.current);
    }

    themeSyncFrameRef.current = window.requestAnimationFrame(() => {
      themeSyncFrameRef.current = null;
      syncThemeTokens();
    });
  }, [syncThemeTokens]);

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
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      if (themeSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(themeSyncFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!scene || loading) {
      return;
    }

    scheduleThemeTokenSync();
  }, [activeId, loading, scene, scheduleThemeTokenSync]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSidebarOpen]);

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleSelectDrawing = useCallback(
    async (drawingId: string) => {
      setIsSidebarOpen(false);
      await navigateToDrawing(drawingId);
    },
    [navigateToDrawing],
  );

  const handleCreateDrawing = useCallback(async () => {
    setIsSidebarOpen(false);
    await createDrawing();
  }, [createDrawing]);

  return (
    <div className="app-shell" ref={appShellRef}>
      <main className="editor-shell">
        <div className="app-actions">
          <button
            type="button"
            className="secondary-button app-actions-toggle"
            onClick={openSidebar}
            aria-label="Open drawings"
          >
            <DrawerIcon />
            <span className="sr-only">Open drawings</span>
          </button>
        </div>

        {loading || !scene ? (
          <div className="editor-loading">{error ?? "Loading..."}</div>
        ) : (
          <div className="editor-frame">
            <Excalidraw
              key={activeDrawing?.id ?? activeId}
              initialData={sceneToInitialData(scene)}
              onChange={(elements, appState, files) => {
                const nextScene = sceneFromEditor(elements, appState, files);
                latestSceneRef.current = nextScene;
                scheduleThemeTokenSync();

                if (ignoreChangeRef.current) {
                  ignoreChangeRef.current = false;
                  return;
                }

                scheduleSave();
              }}
            />
          </div>
        )}
      </main>
      <div
        className={isSidebarOpen ? "sidebar-backdrop sidebar-backdrop-open" : "sidebar-backdrop"}
        onClick={closeSidebar}
        aria-hidden={!isSidebarOpen}
      />
      <aside className={isSidebarOpen ? "sidebar sidebar-open" : "sidebar"} aria-hidden={!isSidebarOpen}>
        <div className="sidebar-header">
          <h1>excali</h1>
          <div className="sidebar-actions">
            <button type="button" className="primary-button" onClick={() => void handleCreateDrawing()}>
              New
            </button>
            <button type="button" className="icon-button" onClick={closeSidebar} aria-label="Close drawings">
              ×
            </button>
          </div>
        </div>
        <div className="sidebar-toolbar">
          <button type="button" className="secondary-button" onClick={() => void exportPng()} disabled={!scene}>
            Export PNG
          </button>
          <button type="button" className="secondary-button" onClick={exportExcalidraw} disabled={!scene}>
            Export .excalidraw
          </button>
        </div>
        <div className="drawing-list">
          {drawings.map((drawing) => (
            <div
              key={drawing.id}
              className={drawing.id === activeId ? "drawing-item drawing-item-active" : "drawing-item"}
            >
              {drawing.id === activeId ? (
                <div className="drawing-link">
                  <input
                    className="title-input"
                    value={activeTitle}
                    onChange={(event) => {
                      currentTitleRef.current = event.target.value;
                      setActiveTitle(event.target.value);
                    }}
                    onBlur={() => void handleTitleSubmit()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="drawing-link"
                  onClick={() => void handleSelectDrawing(drawing.id)}
                >
                  <span className="drawing-title">{drawing.title}</span>
                </button>
              )}
              <button
                type="button"
                className="icon-button"
                onClick={() => void deleteDrawing(drawing.id)}
                aria-label={`Delete ${drawing.title}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
