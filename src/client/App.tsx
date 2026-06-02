import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { DrawingSidebar, DrawingsToggle } from "./components/DrawingSidebar";
import {
  CodeBlockSidebar,
  InsertCodeBlockButton,
} from "./components/CodeBlockSidebar";
import { renderCodeBlockEmbeddable } from "./components/CodeBlockEmbeddable";
import { EditorCanvas } from "./components/EditorCanvas";
import { PublicViewer } from "./components/PublicViewer";
import {
  createCodeBlockElement,
  DEFAULT_CODE_BLOCK_HEIGHT,
  DEFAULT_CODE_BLOCK_WIDTH,
  EMPTY_CODE_BLOCK_SELECTION_STATE,
  updateCodeBlockElements,
  type CodeBlockDraftState,
  type CodeBlockLanguage,
  type CodeBlockSelectionState,
} from "./codeblock";
import { usePublicDrawing } from "./hooks/usePublicDrawing";
import { useDrawingSession } from "./hooks/useDrawingSession";
import { useThemeTokenSync } from "./hooks/useThemeTokenSync";

type AppRoute = { type: "private" } | { type: "public"; slug: string };

function routeFromPath(pathname = window.location.pathname): AppRoute {
  if (!pathname.startsWith("/p/")) {
    return { type: "private" };
  }

  const slug = pathname.slice(3);
  if (slug.length === 0 || slug.includes("/")) {
    return { type: "private" };
  }

  return { type: "public", slug: decodeURIComponent(slug) };
}

function PrivateApp() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [codeBlockSelection, setCodeBlockSelection] =
    useState<CodeBlockSelectionState>(EMPTY_CODE_BLOCK_SELECTION_STATE);
  const [codeBlockDraft, setCodeBlockDraft] =
    useState<CodeBlockDraftState | null>(null);
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const codeBlockDraftRef = useRef<CodeBlockDraftState | null>(null);
  const scheduleThemeTokenSync = useThemeTokenSync(appShellRef);
  const {
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
  } = useDrawingSession();

  const flushCodeBlockDraft = useEffectEvent(() => {
    const api = excalidrawApiRef.current;
    const draft = codeBlockDraftRef.current;
    if (!api || !draft) {
      return;
    }

    const currentElements = api.getSceneElementsIncludingDeleted();
    const nextElements = updateCodeBlockElements(
      currentElements,
      draft.elementId,
      {
        code: draft.code,
        language: draft.language,
        showBackground: draft.showBackground,
      },
    );

    if (nextElements === currentElements) {
      return;
    }

    api.updateScene({
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  });

  useEffect(() => {
    codeBlockDraftRef.current = codeBlockDraft;
  }, [codeBlockDraft]);

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

  useEffect(() => {
    return () => {
      flushCodeBlockDraft();
    };
  }, []);

  useEffect(() => {
    const selectedCodeBlock = codeBlockSelection.selectedCodeBlock;
    setCodeBlockDraft((current) => {
      const nextDraft = selectedCodeBlock
        ? {
            elementId: selectedCodeBlock.id,
            code: selectedCodeBlock.customData.code,
            language: selectedCodeBlock.customData.language,
            showBackground: selectedCodeBlock.customData.showBackground,
          }
        : null;

      if (
        current?.elementId === nextDraft?.elementId &&
        current?.code === nextDraft?.code &&
        current?.language === nextDraft?.language &&
        current?.showBackground === nextDraft?.showBackground
      ) {
        return current;
      }

      return nextDraft;
    });

    return () => {
      flushCodeBlockDraft();
    };
  }, [codeBlockSelection.selectedCodeBlockId]);

  useEffect(() => {
    if (!codeBlockDraft) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      flushCodeBlockDraft();
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [codeBlockDraft]);

  useEffect(() => {
    if (loading) {
      setCodeBlockSelection(EMPTY_CODE_BLOCK_SELECTION_STATE);
      setCodeBlockDraft(null);
    }
  }, [loading]);

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleSelectDrawing = useCallback(
    (drawingId: string) => {
      setIsSidebarOpen(false);
      void selectDrawing(drawingId);
    },
    [selectDrawing],
  );

  const handleCreateDrawing = useCallback(() => {
    setIsSidebarOpen(false);
    void createDrawing();
  }, [createDrawing]);

  const handleInsertCodeBlock = useCallback(() => {
    const api = excalidrawApiRef.current;
    if (!api) {
      return;
    }

    const appState = api.getAppState();
    const viewportWidth =
      typeof appState.width === "number" ? appState.width : window.innerWidth;
    const viewportHeight =
      typeof appState.height === "number"
        ? appState.height
        : window.innerHeight;
    const zoom = appState.zoom.value;
    const x =
      -appState.scrollX +
      viewportWidth / (2 * zoom) -
      DEFAULT_CODE_BLOCK_WIDTH / 2;
    const y =
      -appState.scrollY +
      viewportHeight / (2 * zoom) -
      DEFAULT_CODE_BLOCK_HEIGHT / 2;
    const codeBlock = createCodeBlockElement({ x, y });

    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), codeBlock],
      appState: {
        selectedElementIds: {
          [codeBlock.id]: true,
        },
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, []);

  const handleCodeBlockSelectionChange = useCallback(
    (selection: CodeBlockSelectionState) => {
      setCodeBlockSelection((current) => {
        if (
          current.isPanelOpen === selection.isPanelOpen &&
          current.selectedCodeBlockId === selection.selectedCodeBlockId &&
          current.selectedCodeBlock?.customData.code ===
            selection.selectedCodeBlock?.customData.code &&
          current.selectedCodeBlock?.customData.language ===
            selection.selectedCodeBlock?.customData.language &&
          current.selectedCodeBlock?.customData.showBackground ===
            selection.selectedCodeBlock?.customData.showBackground
        ) {
          return current;
        }

        return selection;
      });
    },
    [],
  );

  const handleCodeBlockCodeChange = useCallback((code: string) => {
    setCodeBlockDraft((current) =>
      current
        ? {
            ...current,
            code,
          }
        : current,
    );
  }, []);

  const handleCodeBlockLanguageChange = useCallback(
    (language: CodeBlockLanguage) => {
      setCodeBlockDraft((current) =>
        current
          ? {
              ...current,
              language,
            }
          : current,
      );
    },
    [],
  );

  const handleCodeBlockShowBackgroundChange = useCallback(
    (showBackground: boolean) => {
      setCodeBlockDraft((current) =>
        current
          ? {
              ...current,
              showBackground,
            }
          : current,
      );
    },
    [],
  );

  return (
    <div className="app-shell" ref={appShellRef}>
      {toastMessage && (
        <div className="toast-overlay" aria-live="polite">
          {toastMessage}
        </div>
      )}
      <InsertCodeBlockButton
        onClick={handleInsertCodeBlock}
        disabled={loading || scene === null}
      />
      <main className="editor-shell">
        <div className="app-actions">
          <DrawingsToggle onClick={openSidebar} />
        </div>

        <EditorCanvas
          activeId={activeId}
          scene={scene}
          loading={loading}
          error={error}
          editorReloadNonce={editorReloadNonce}
          onSceneChange={handleSceneChange}
          onSelectionStateChange={handleCodeBlockSelectionChange}
          onEditorActivity={scheduleThemeTokenSync}
          onExcalidrawAPI={(api) => {
            excalidrawApiRef.current = api;
          }}
          renderEmbeddable={renderCodeBlockEmbeddable}
        />
        <CodeBlockSidebar
          open={codeBlockSelection.isPanelOpen}
          draft={codeBlockDraft}
          onCodeChange={handleCodeBlockCodeChange}
          onLanguageChange={handleCodeBlockLanguageChange}
          onShowBackgroundChange={handleCodeBlockShowBackgroundChange}
          onCommit={flushCodeBlockDraft}
        />
      </main>
      <DrawingSidebar
        open={isSidebarOpen}
        drawings={drawings}
        activeId={activeId}
        activeTitle={activeTitle}
        publication={publication}
        publicationSlug={publicationSlug}
        publicationBusy={publicationBusy}
        onClose={closeSidebar}
        onCreate={handleCreateDrawing}
        onSelect={handleSelectDrawing}
        onDelete={(drawingId) => void deleteDrawing(drawingId)}
        onTitleChange={setActiveTitle}
        onTitleSubmit={() => void submitTitle()}
        onPublicationSlugChange={setPublicationSlug}
        onPublish={() => void publishPublication()}
        onDisablePublication={() => void disablePublication()}
      />
    </div>
  );
}

function PublicApp({ slug }: { slug: string }) {
  const { drawing, loading, error } = usePublicDrawing(slug);

  return (
    <PublicViewer
      drawing={drawing}
      loading={loading}
      error={error}
      renderEmbeddable={renderCodeBlockEmbeddable}
    />
  );
}

export function App() {
  const route = routeFromPath();

  if (route.type === "public") {
    return <PublicApp slug={route.slug} />;
  }

  return <PrivateApp />;
}
