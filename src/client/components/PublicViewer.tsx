import { memo } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import "../../../node_modules/@excalidraw/excalidraw/dist/prod/index.css";
import { type PublicDrawing } from "../../core/shared";

type PublicViewerProps = {
  drawing: PublicDrawing | null;
  loading: boolean;
  error: string | null;
  renderEmbeddable?: ExcalidrawProps["renderEmbeddable"];
};

function drawingToInitialData(
  drawing: PublicDrawing,
): ExcalidrawInitialDataState {
  return drawing as ExcalidrawInitialDataState;
}

const viewerUiOptions = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: false,
    export: false,
    loadScene: false,
    saveAsImage: false,
    saveToActiveFile: false,
    toggleTheme: false,
  },
  tools: {
    image: false,
  },
} as const;

export const PublicViewer = memo(function PublicViewer({
  drawing,
  loading,
  error,
  renderEmbeddable,
}: PublicViewerProps) {
  if (loading || !drawing) {
    return <div className="editor-loading">{error ?? "Loading..."}</div>;
  }

  return (
    <div className="public-viewer-shell">
      <Excalidraw
        initialData={drawingToInitialData(drawing)}
        viewModeEnabled={true}
        zenModeEnabled={true}
        UIOptions={viewerUiOptions}
        renderEmbeddable={renderEmbeddable}
      />
    </div>
  );
});
