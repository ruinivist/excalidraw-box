import { describe, expect, test } from "bun:test";
import {
  HttpError,
  MAX_SCENE_BYTES,
  emptyScene,
  normalizeScene,
  parseJsonBody,
} from "./scene";

describe("scene helpers", () => {
  test("creates empty scenes with dark theme by default", () => {
    const scene = emptyScene();

    expect(scene.appState.theme).toBe("dark");
  });

  test("normalizes volatile app state fields", () => {
    const scene = normalizeScene({
      elements: [],
      appState: {
        selectedElementIds: { one: true },
        viewModeEnabled: false,
      },
      files: {},
    });

    expect(scene.appState.selectedElementIds).toBeUndefined();
    expect(scene.appState.viewModeEnabled).toBe(false);
  });

  test("rejects oversized payloads", () => {
    const text = "x".repeat(MAX_SCENE_BYTES + 1);

    expect(() => parseJsonBody(text)).toThrow(HttpError);
    expect(() => parseJsonBody(text)).toThrow("Payload too large");
  });
});
