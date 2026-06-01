import { memo } from "react";
import "../../../node_modules/@excalidraw/excalidraw/dist/prod/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { type ScenePayload } from "../../core/shared";

type EditorCanvasProps = {
  activeId: string | null;
  scene: ScenePayload | null;
  loading: boolean;
  error: string | null;
  editorReloadNonce: number;
  onSceneChange: (scene: ScenePayload) => void;
  onEditorActivity: () => void;
};

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

// ⚡ Bolt: Wrapped in React.memo to prevent expensive Excalidraw re-renders
// when parent state (like the sidebar open state or drawing title input) changes.
export const EditorCanvas = memo(function EditorCanvas({
  activeId,
  scene,
  loading,
  error,
  editorReloadNonce,
  onSceneChange,
  onEditorActivity,
}: EditorCanvasProps) {
  if (loading || !scene) {
    return <div className="editor-loading">{error ?? "Loading..."}</div>;
  }

  return (
    <div className="editor-frame">
      <Excalidraw
        key={`${activeId}:${editorReloadNonce}`}
        initialData={sceneToInitialData(scene)}
        onChange={(elements, appState, files) => {
          onEditorActivity();
          onSceneChange(sceneFromEditor(elements, appState, files));
        }}
      />
    </div>
  );
});
