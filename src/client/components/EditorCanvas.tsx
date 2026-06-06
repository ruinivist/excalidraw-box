import { memo, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import "../../../node_modules/@excalidraw/excalidraw/dist/prod/index.css";
import { type ScenePayload } from "../../core/shared";
import {
  getCodeBlockSelectionState,
  type CodeBlockSelectionState,
} from "../codeblock";

type EditorCanvasProps = {
  activeId: string | null;
  scene: ScenePayload | null;
  loading: boolean;
  error: string | null;
  editorReloadNonce: number;
  onSceneChange: (scene: ScenePayload) => void;
  onSelectionStateChange: (selection: CodeBlockSelectionState) => void;
  onEditorActivity: () => void;
  onExcalidrawAPI: (api: ExcalidrawImperativeAPI) => void;
  renderEmbeddable?: ExcalidrawProps["renderEmbeddable"];
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
  onSelectionStateChange,
  onEditorActivity,
  onExcalidrawAPI,
  renderEmbeddable,
}: EditorCanvasProps) {
  const handleChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      onEditorActivity();
      onSceneChange(sceneFromEditor(elements, appState, files));
      onSelectionStateChange(getCodeBlockSelectionState(elements, appState));
    },
    [onEditorActivity, onSceneChange, onSelectionStateChange],
  );

  if (loading || !scene) {
    return <div className="editor-loading">{error ?? "Loading..."}</div>;
  }

  return (
    <div className="editor-frame">
      <Excalidraw
        key={`${activeId}:${editorReloadNonce}`}
        initialData={sceneToInitialData(scene)}
        excalidrawAPI={onExcalidrawAPI}
        renderEmbeddable={renderEmbeddable}
        onChange={handleChange}
      />
    </div>
  );
});
