import { DEFAULT_TITLE, type ScenePayload } from "./shared";

export const MAX_SCENE_BYTES = 25 * 1024 * 1024;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const VOLATILE_APP_STATE_KEYS = new Set([
  "collaborators",
  "selectedElementIds",
  "selectedGroupIds",
  "editingElement",
  "editingLinearElement",
  "openMenu",
  "openSidebar",
  "contextMenu",
  "toast",
]);

export function emptyScene(): ScenePayload {
  return {
    elements: [],
    appState: { theme: "dark" },
    files: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeTitle(input: unknown): string {
  if (typeof input !== "string") {
    return DEFAULT_TITLE;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_TITLE;
}

export function normalizeScene(input: unknown): ScenePayload {
  if (!isRecord(input)) {
    throw new HttpError(400, "Body must be an object");
  }

  if (!Array.isArray(input.elements)) {
    throw new HttpError(400, "elements must be an array");
  }

  if (!isRecord(input.appState)) {
    throw new HttpError(400, "appState must be an object");
  }

  if (!isRecord(input.files)) {
    throw new HttpError(400, "files must be an object");
  }

  const appState = Object.fromEntries(
    Object.entries(input.appState).filter(
      ([key]) => !VOLATILE_APP_STATE_KEYS.has(key),
    ),
  );

  return {
    elements: input.elements,
    appState,
    files: input.files,
  };
}

export function parseJsonBody<T = unknown>(text: string): T {
  if (new TextEncoder().encode(text).byteLength > MAX_SCENE_BYTES) {
    throw new HttpError(413, "Payload too large");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

export function parseSceneText(text: string): ScenePayload {
  return normalizeScene(parseJsonBody(text));
}
