import { memo } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import "../../../node_modules/@excalidraw/excalidraw/dist/prod/index.css";
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
    // Excalidraw passes immutable arrays, avoid copying it on every onChange event
    elements: elements as unknown[],
    appState: appState as unknown as Record<string, unknown>,
    files: files as unknown as Record<string, unknown>,
  };
}

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
