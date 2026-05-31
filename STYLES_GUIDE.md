# Styles Guide

Use this guide when generating or modifying Excalidraw scenes.

## Author intent (must follow)

- Excalidraw is for free-flow visual thinking: nodes, arrows, curves, boundaries, and hanging labels.
- Treat this as a diagramming task, not a document-writing task.
- Prefer visual relationships over long prose.
- If content starts becoming paragraph-heavy, split it into smaller nodes and explicit connectors.
- Prioritize flow clarity over text density.

## Core intent

- Always set `scene.appState.theme` to `"dark"`.
- Always use light-style element colors.
- Optimize for clarity, technical precision, and fast visual parsing.
- Tailor structure to the problem. Do not default to generic flowcharts.
- Prefer diagrams that look like working engineering notes, not slides.

## Theme

- Use a light canvas and light containers by default.
- Keep contrast high enough for comfortable reading.
- Use vibrant accent colors with strong readability on light surfaces.
- Keep color mapping stable: the same logical component/flow must keep the same color across node, connector, and connector label.
- For subtypes within a flow, use close shades of the same family instead of unrelated hues.

### Default palette

- Canvas / background: `#f8fafc`
- Surface: `#ffffff`
- Muted surface: `#f1f5f9`
- Text: `#212529`
- Muted text: `#343a40`
- Green: `#099268`
- Pink: `#c2255c`
- Red: `#ff5d73`
- Purple: `#6741d9`
- Blue: `#1971c2`
- Teal: `#0c8599`
- Border / connector: `#868e96`

### Extended accent set

- Mint: `#12b886`
- Cyan: `#1098ad`
- Indigo: `#364fc7`
- Violet: `#5f3dc4`
- Magenta: `#a61e4d`
- Rose: `#e64980`
- Slate dark: `#212529`
- Slate mid: `#495057`
- Slate light: `#868e96`

## Layout

- Keep the layout spacious.
- Use consistent alignment and clear grouping.
- Maintain obvious reading order (usually left-to-right or top-to-bottom).
- Separate major groups with generous whitespace.
- Avoid dense clusters and unclear crossings.

### Spacing defaults

- Between major groups: `160-240px`
- Between related nodes: `72-120px`
- Container padding: `48-72px`
- Keep connector crossings rare. Re-route instead of stacking lines through central content.

### Connector label placement

- Do not place connector labels directly on top of arrow/line strokes.
- Offset connector labels from the path by at least `16-24px` on the normal axis.
- Prefer labels slightly to the side of the connector midpoint, not centered on the stroke.
- If lines still reduce readability, move the label further away.
- Connector labels must remain clearly associated with their connector.
- Connector endpoints should stop with a visible gap before node/container borders: `8-16px`.
- Prefer slight natural curves for connectors (gentle 3-point bends) instead of rigid perfectly straight arrows.
- Keep curvature subtle; avoid dramatic arcs unless the route needs explicit detouring.
- Use straight connectors only when they are materially clearer than curved ones.

### Container nesting

- Default to one container level.
- Maximum nesting depth is two.
- Use second-level nesting only when needed.
- Avoid box-within-box-within-box structures unless explicitly required.

## Text fit and sizing

Use explicit sizing so text fits without clipping or cramped boxes.

### Typography defaults

- Body/node text: `20px` Excalidraw monospace (`fontFamily: 3`)
- Section labels: `24px`
- Auxiliary notes: `20px` minimum
- Line height multiplier: `1.25`

### Text length and wrapping

- Target max line length: `22-28` characters.
- If label text exceeds `28` characters, insert line breaks at phrase boundaries.
- Keep most labels to `1-2` lines.
- Hard cap: `3` lines for standard nodes, `4` lines for large containers.

### Box size contract

- Horizontal text padding: `32px` per side (`64px` total)
- Vertical text padding: `24px` per side (`48px` total)
- Minimum node size: `260x120`
- Recommended width bands:
- Short labels (`<=18` chars): `260-320px`
- Medium labels (`19-40` chars): `340-460px`
- Long labels (wrapped): `480-680px`

### Overflow guardrails

- Text must remain fully inside its box at `zoom: 1`.
- Keep at least `28px` interior clearance from text to borders after render.
- If text would overflow: increase width first, then height, then split content into multiple nodes.
- No label overlap is allowed.
- Bias toward extra whitespace over dense packing.

## Structural guidance

Pick the structure that matches the content.

- Flows/lifecycles: sequence or pipeline layouts
- Layered systems: stacked layers with strict boundaries
- Ownership/containment: nested containers
- Stateful behavior: state-machine style
- Dependencies: directional graphs grouped by subsystem
- Comparisons/migrations: side-by-side layouts

Do not force every task into boxes with arrows when a better structure exists.

## Logical coherence

- Every element must have a reason to exist.
- Group by real system boundaries, not visual symmetry alone.
- Make relationships explicit: data flow, control flow, ownership, lifecycle, dependency.
- Minimize ambiguous arrows.
- If a connection has specific meaning, label it briefly.
- Prefer fewer, clearer elements over exhaustive clutter.

## Language

- Use terse, technical labels.
- Use short phrases, not full sentences.
- Assume the reader is a senior engineer.
- Prefer concrete nouns/verbs.
- Use concrete system terms: API, worker, queue, WAL, cache, AST, token, retry loop, reconciliation pass.

### Avoid

- Business speak
- Marketing language
- Vague labels like `Platform`, `Service Layer`, `System`, `Magic`
- Ambiguous shorthand like `edge`, `core`, `backend`, `worker` without qualifiers
- Filler phrases like `leverages`, `enables`, `streamlines`, `orchestrates`

### Naming specificity

- Prefer concrete component names over abstract layer names.
- Label the actual technology/runtime boundary when known.
- Example: use `caddy router` or `reverse proxy (caddy :80)` instead of `edge`.
- Example: use `bun http api (:3000)` instead of `backend`.

## Visual style

- Use subtle emphasis, not decoration.
- Reserve accent colors for meaning, not aesthetics alone.
- Keep color mapping stable for each logical subsystem/flow.
- Use container fills and border weight to show hierarchy.
- Keep shapes simple and consistent unless variation materially helps.

## Creativity rule

Be creative in structure, not flashy in styling.

- Adapt composition to the specific problem.
- Use framing, grouping, and flow intentionally.
- Make the diagram feel specific to the task.

## Dark mode persistence

- Treat dark mode as a persisted app-state requirement only.
- At create/update time, `scene.appState.theme` must be `"dark"`.
- Do not rely on UI defaults or post-hoc toggles.
- Theme and element colors are separate controls:
- `theme: "dark"` is required.
- Keep element colors in a light-style palette.
- Do not manually invert colors.
- Do not use dark canvas/surface colors for theme compliance.

## Hard constraints

- Always set `scene.appState.theme` to `"dark"`.
- Always use light-mode element colors.
- No manual color inversion.
- Default to one container level; max two unless explicitly needed.
- No tight text boxes.
- No cluttered layouts.
- No overlapping labels.
- No label text with connector strokes running through glyphs.
- No connector endpoint flush against a box border; keep a visible gap.
- No inconsistent color mapping for the same logical subsystem/flow.
- No decorative noise.
- No business/management tone.
- No generic one-size-fits-all flowchart when a better structure is appropriate.
