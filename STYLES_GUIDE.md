# Styles Guide

Use this guide when generating or modifying Excalidraw scenes.

## Core intent

- Always use dark mode.
- Optimize for clarity, technical precision, and fast visual parsing.
- Tailor the diagram structure to the task itself. Do not default to generic flowcharts.
- Prefer diagrams that feel like working engineering notes, not slides or business documentation.

## Theme

- Use a dark canvas and dark containers by default.
- Keep contrast high enough for comfortable reading.
- Use a restrained palette. Do not introduce many colors unless the task truly needs them.

### Default palette

- Canvas / background: `#0b0f14`
- Primary surface: `#111827`
- Secondary surface: `#1f2937`
- Primary text: `#e5e7eb`
- Secondary text: `#9ca3af`
- Primary accent: `#38bdf8`
- Secondary accent: `#22c55e`
- Warning / risk: `#f59e0b`
- Error / destructive path: `#ef4444`
- Border / connector default: `#475569`

## Layout

- Always keep the layout spacious.
- Use consistent alignment and clear grouping.
- Maintain obvious reading order: usually left-to-right or top-to-bottom.
- Separate major groups with generous whitespace.
- Avoid dense clusters, overlapping arrows, or labels squeezed into shapes.

### Spacing defaults

- Between major groups: `120-180px`
- Between related nodes: `48-72px`
- Container padding: `24-32px`
- Keep connector crossings rare. Re-route instead of stacking lines through the middle of the diagram.

## Structural guidance

Pick a structure that matches the content.

- For flows and request lifecycles: use a sequence or pipeline layout.
- For layered systems: use stacked layers with strict boundaries.
- For ownership and containment: use nested containers.
- For stateful behavior: use a state-machine style layout.
- For dependencies: use directional dependency graphs with grouping by subsystem.
- For comparisons or migrations: use side-by-side before/after layouts.

Do not force every task into boxes with arrows.
If the task is better represented as layers, phases, states, interfaces, call paths, or boundaries, use that structure instead.

## Logical coherence

- Every element should have a reason to exist.
- Group by actual system boundaries, not by visual symmetry alone.
- Make relationships explicit: data flow, control flow, ownership, lifecycle, or dependency.
- Minimize ambiguous arrows.
- If a connection has a specific meaning, label it briefly.
- Prefer fewer, clearer elements over exhaustive coverage.

## Language

- Use terse, technical labels.
- Assume the reader is a senior engineer maintaining personal notes.
- Prefer precise nouns and verbs.
- Use concrete system terms: API, worker, queue, WAL, cache, AST, token, retry loop, reconciliation pass.
- Keep text brief. Most labels should be one line.

### Avoid

- Business speak
- Marketing language
- Vague labels like `Platform`, `Service Layer`, `System`, `Magic`
- Filler phrases like `leverages`, `enables`, `streamlines`, `orchestrates`

## Visual style

- Use subtle emphasis, not decoration.
- Reserve accent colors for meaning, not aesthetics alone.
- Use container fills and border weight to show hierarchy.
- Keep shapes simple and consistent unless the task benefits from a different visual treatment.
- Prefer readable structure over visual novelty, but avoid generic boilerplate layouts.

## Creativity rule

Be creative in structure, not flashy in styling.

- Adapt the composition to the problem.
- Use framing, grouping, and flow intentionally.
- Make the diagram feel specific to the task at hand.
- Avoid producing the same generic flowchart structure for unrelated problems.

## Hard constraints

- Always dark mode.
- No bright or white backgrounds.
- No cluttered layouts.
- No overlapping labels.
- No decorative noise.
- No business or management tone.
- No generic one-size-fits-all flowchart if the task calls for a better structure.
