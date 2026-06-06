## 2023-10-27 - Excalidraw Component Re-render Performance Penalty

**Learning:** Due to the exceptionally high rendering cost of the `@excalidraw/excalidraw` canvas, inline functions passed as props (like `onChange` and `onExcalidrawAPI`) cause severe performance degradation by defeating `React.memo` and triggering full canvas re-renders when parent state changes.
**Action:** Always strictly memoize all callbacks passed to the Excalidraw component using `useCallback` to preserve prop stability and prevent unnecessary, expensive re-renders.
