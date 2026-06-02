import { useCallback, useEffect, useRef, type RefObject } from "react";

const EXCALIDRAW_THEME_TOKEN_MAP = [
  ["--island-bg-color", "--app-island-bg"],
  ["--sidebar-bg-color", "--app-sidebar-bg"],
  ["--sidebar-border-color", "--app-sidebar-border"],
  ["--sidebar-shadow", "--app-sidebar-shadow"],
  ["--color-surface-lowest", "--app-surface-lowest"],
  ["--color-surface-low", "--app-surface-low"],
  ["--color-surface-primary-container", "--app-selected-bg"],
  ["--color-on-surface", "--app-text-color"],
  ["--color-on-primary-container", "--app-selected-text-color"],
  ["--color-disabled", "--app-disabled-color"],
  ["--input-bg-color", "--app-input-bg"],
  ["--input-border-color", "--app-input-border"],
  ["--input-label-color", "--app-input-color"],
  ["--default-border-color", "--app-button-border"],
  ["--button-hover-bg", "--app-button-hover-bg"],
  ["--button-active-bg", "--app-button-active-bg"],
  ["--button-active-border", "--app-button-active-border"],
  ["--overlay-bg-color", "--app-overlay-bg"],
] as const;

export function useThemeTokenSync(
  appShellRef: RefObject<HTMLDivElement | null>,
) {
  const themeSyncFrameRef = useRef<number | null>(null);

  const syncThemeTokens = useCallback(() => {
    const appShell = appShellRef.current;
    const excalidrawRoot = appShell?.querySelector<HTMLElement>(".excalidraw");
    if (!appShell || !excalidrawRoot) {
      return;
    }

    // ⚡ Bolt: Read all tokens first to avoid layout thrashing
    const computedStyles = window.getComputedStyle(excalidrawRoot);
    const updates: Array<[string, string]> = [];

    for (const [sourceToken, targetToken] of EXCALIDRAW_THEME_TOKEN_MAP) {
      const value = computedStyles.getPropertyValue(sourceToken).trim();
      if (value) {
        updates.push([targetToken, value]);
      }
    }

    // ⚡ Bolt: Write in a separate pass, skipping unchanged values
    for (const [targetToken, value] of updates) {
      if (appShell.style.getPropertyValue(targetToken) !== value) {
        appShell.style.setProperty(targetToken, value);
      }
    }
  }, [appShellRef]);

  const scheduleThemeTokenSync = useCallback(() => {
    if (themeSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(themeSyncFrameRef.current);
    }

    themeSyncFrameRef.current = window.requestAnimationFrame(() => {
      themeSyncFrameRef.current = null;
      syncThemeTokens();
    });
  }, [syncThemeTokens]);

  useEffect(() => {
    return () => {
      if (themeSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(themeSyncFrameRef.current);
      }
    };
  }, []);

  return scheduleThemeTokenSync;
}
