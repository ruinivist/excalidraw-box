export type ScenePayload = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

export type DrawingMeta = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type DrawingRecord = DrawingMeta & {
  scene: ScenePayload;
};

export const DEFAULT_TITLE = "Untitled";
