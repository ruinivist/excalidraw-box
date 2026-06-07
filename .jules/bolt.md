## 2024-06-07 - Memoize callbacks passed to Excalidraw

**Learning:** Due to the exceptionally high rendering cost of the `@excalidraw/excalidraw` canvas, always ensure all callbacks passed to it (e.g., `onExcalidrawAPI`) are strictly memoized using `useCallback`. Passing inline functions as props breaks prop stability for `React.memo` and causes severe UI input lag caused by full canvas re-renders when parent states change.
**Action:** When working with `<Excalidraw>` or its wrapper components like `<EditorCanvas>`, always extract inline callback functions (like `onExcalidrawAPI={(api) => { ... }}`) into `useCallback` hooks before passing them down.
