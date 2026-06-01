import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingSidebar, DrawingsToggle } from "./components/DrawingSidebar";
import { EditorCanvas } from "./components/EditorCanvas";
import { PublicViewer } from "./components/PublicViewer";
import { usePublicDrawing } from "./hooks/usePublicDrawing";
import { useDrawingSession } from "./hooks/useDrawingSession";
import { useThemeTokenSync } from "./hooks/useThemeTokenSync";

type AppRoute =
  | { type: "private" }
  | { type: "public"; slug: string };

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
  const appShellRef = useRef<HTMLDivElement | null>(null);
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

  return (
    <div className="app-shell" ref={appShellRef}>
      {toastMessage && (
        <div className="toast-overlay" aria-live="polite">
          {toastMessage}
        </div>
      )}
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
          onEditorActivity={scheduleThemeTokenSync}
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

  return <PublicViewer drawing={drawing} loading={loading} error={error} />;
}

export function App() {
  const route = routeFromPath();

  if (route.type === "public") {
    return <PublicApp slug={route.slug} />;
  }

  return <PrivateApp />;
}
