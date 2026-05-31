import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingSidebar, DrawingsToggle } from "./components/DrawingSidebar";
import { EditorCanvas } from "./components/EditorCanvas";
import { useDrawingSession } from "./hooks/useDrawingSession";
import { useThemeTokenSync } from "./hooks/useThemeTokenSync";

export function App() {
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
    setActiveTitle,
    submitTitle,
    handleSceneChange,
    selectDrawing,
    createDrawing,
    deleteDrawing,
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
        onClose={closeSidebar}
        onCreate={handleCreateDrawing}
        onSelect={handleSelectDrawing}
        onDelete={(drawingId) => void deleteDrawing(drawingId)}
        onTitleChange={setActiveTitle}
        onTitleSubmit={() => void submitTitle()}
      />
    </div>
  );
}
