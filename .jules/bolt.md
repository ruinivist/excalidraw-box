## 2024-06-02 - Eliminate Layout Thrashing in Theme Sync

**Learning:** Interleaving `window.getComputedStyle().getPropertyValue()` and `element.style.setProperty()` inside a loop causes layout thrashing (forced synchronous layout) multiple times per animation frame during drawing.
**Action:** When synchronizing many DOM styles based on computed styles, always collect the computed values in a first pass, and only then apply `setProperty` updates in a separate second pass, preferably also skipping updates where the value hasn't actually changed.
