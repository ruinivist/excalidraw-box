## 2024-06-25 - Excalidraw Memoization

**Learning:** The `@excalidraw/excalidraw` package's `Excalidraw` component is exceptionally expensive to re-render. Even though `EditorCanvas` was wrapped in `React.memo`, passing an inline arrow function to `onExcalidrawAPI` in the parent `App` broke memoization, causing severe input lag when typing in completely independent UI elements like the codeblock editor sidebar due to the entire canvas re-rendering.
**Action:** When passing callbacks to heavy third-party components like Excalidraw, always wrap them in `useCallback` hook to preserve their prop stability and maintain `React.memo` benefits, preventing disastrous performance regressions on typing/input.
