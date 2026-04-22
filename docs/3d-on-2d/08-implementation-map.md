# 08 — Implementation map

Exactly where in the codebase each concept lives. Read alongside the
explanation pages.

Primary file:
[post/src/lib/components/viz/ModelDiagram.svelte](../../post/src/lib/components/viz/ModelDiagram.svelte).

Supporting files:
- [post/src/lib/viz/modelDiagramLayout.ts](../../post/src/lib/viz/modelDiagramLayout.ts) — archBoxes, viewW, viewH.
- [post/src/lib/viz/weightsSeries.ts](../../post/src/lib/viz/weightsSeries.ts) — weight loader, delta interpolator.
- [post/src/lib/stores/grpo.ts](../../post/src/lib/stores/grpo.ts) — playback step store.

## Concept → code index

| Concept | File / symbol | Lines |
|---|---|---|
| **Tunable constants** (camera, rotations, spacing, thickness) | [ModelDiagram.svelte:34-48](../../post/src/lib/components/viz/ModelDiagram.svelte#L34-L48) | `CAM_DIST`, `ROT_Y`, `ROT_X`, `BOX_YAW`, `STACK_SPACING`, `THICKNESS` |
| **Trig precompute** | [ModelDiagram.svelte:50-53](../../post/src/lib/components/viz/ModelDiagram.svelte#L50-L53) | `COS_Y`, `SIN_Y`, `COS_X`, `SIN_X`, `CX`, `CY` |
| **Projection** (yaw then pitch then perspective) | [ModelDiagram.svelte:56-65](../../post/src/lib/components/viz/ModelDiagram.svelte#L56-L65) | `projectXY(x, y, z)` |
| **Per-box local yaw** | [ModelDiagram.svelte:72-83](../../post/src/lib/components/viz/ModelDiagram.svelte#L72-L83) | `projectWithYaw(wx, wy, z, pivotX, yaw)` |
| **RdBu colormap LUT** | [ModelDiagram.svelte:9-25](../../post/src/lib/components/viz/ModelDiagram.svelte#L9-L25) | `RDBU_LUT`, `RDBU_CSS` |
| **Delta → LUT index** (gamma-corrected) | [ModelDiagram.svelte:250-255](../../post/src/lib/components/viz/ModelDiagram.svelte#L250-L255) | `deltaLutIndex(dv, absMax)` |
| **Stack layout** — all boxes share (x, y), separated by `stackZ` | [ModelDiagram.svelte:162-207](../../post/src/lib/components/viz/ModelDiagram.svelte#L162-L207) | `renderBoxes` `$derived` |
| **Projected box geometry** (corners, label, data-card anchor) | [ModelDiagram.svelte:227-247](../../post/src/lib/components/viz/ModelDiagram.svelte#L227-L247) | `boxProjections` `$derived` |
| **Vertex grid projection** (`dispRows+1` × `dispCols+1`) | [ModelDiagram.svelte:266-283](../../post/src/lib/components/viz/ModelDiagram.svelte#L266-L283) | `projectGrid(rb, z)` |
| **Cell fill** — per-cell trapezoidal quad | [ModelDiagram.svelte:285-313](../../post/src/lib/components/viz/ModelDiagram.svelte#L285-L313) | `fillCells(ctx, rb, w, verts)` |
| **Plane outline** | [ModelDiagram.svelte:316-342](../../post/src/lib/components/viz/ModelDiagram.svelte#L316-L342) | `strokePlaneOutline(...)` |
| **Head dividers** (4-head structure on wq/wk/wv, wo) | [ModelDiagram.svelte:345-378](../../post/src/lib/components/viz/ModelDiagram.svelte#L345-L378) | `paintHeadDividers(ctx, rb)` |
| **Cuboid sides** (top, bottom, left, right faces) | [ModelDiagram.svelte:386-422](../../post/src/lib/components/viz/ModelDiagram.svelte#L386-L422) | `paintCuboidSides(ctx, rb)` |
| **Painter's algorithm sort & paint** | [ModelDiagram.svelte:424-445](../../post/src/lib/components/viz/ModelDiagram.svelte#L424-L445) | `paint()` |
| **Canvas DPR sizing** | [ModelDiagram.svelte:447-461](../../post/src/lib/components/viz/ModelDiagram.svelte#L447-L461) | `sizeCanvas()` |
| **Inverse bilinear** (hit-test math) | [ModelDiagram.svelte:473-509](../../post/src/lib/components/viz/ModelDiagram.svelte#L473-L509) | `invBilinear(TL, TR, BR, BL, qx, qy)` |
| **Pointer → (r, c)** | [ModelDiagram.svelte:511-549](../../post/src/lib/components/viz/ModelDiagram.svelte#L511-L549) | `updateHoverFromEvent(e)` |
| **Repaint on data change** | [ModelDiagram.svelte:556-562](../../post/src/lib/components/viz/ModelDiagram.svelte#L556-L562) | `$effect(...)` |
| **Repaint on resize** | [ModelDiagram.svelte:568-572](../../post/src/lib/components/viz/ModelDiagram.svelte#L568-L572) | `ResizeObserver` in `onMount` |

## Data flow per paint

```
featuredStep (store)
       │
       ▼
renderBoxes  ←── archBoxes (static layout)
  (9 entries, each with stackZ)
       │
       ├──► boxProjections (projected corners, labels, anchors)
       │           │
       │           └──► SVG overlay: labels, data-card anchors
       │
       └──► paint() — for each rb, back-to-front:
             │
             ├── paintCuboidSides(ctx, rb)        ← 4 side quads
             ├── projectGrid(rb, rb.stackZ)       ← vertex grid
             ├── fillCells(ctx, rb, w, verts)     ← ~4900 cell fills
             ├── strokePlaneOutline(ctx, ...)     ← 1 stroke per plane
             └── paintHeadDividers(ctx, rb)       ← 3 hairlines per attn/wo matrix
```

## Data flow per `pointermove`

```
pointermove event
       │
       ▼
updateHoverFromEvent(e)
       │
       ├── map client → viewBox coords
       │
       └── for each rb in renderBoxes:
             │
             ├── invBilinear(frontCorners, vx, vy)
             │       │
             │       └── if hit → compute (r, c), update hoveredCell, return
             │
             └── no hit anywhere → hoveredCell = null
```

## What lives in SVG vs. canvas

The `stage` is a canvas + SVG overlay stacked at the same position.

**Canvas** (drawn in paint()):
- Cell grid (per-matrix 4-corner trapezoidal fills)
- Cuboid side faces
- Plane outlines
- Head dividers

**SVG** (declarative, bound to `boxProjections`):
- Labels ("Q", "K", ...) at projected bottom-center of each matrix
- Invisible `data-card="embed"` / `data-card="norm"` anchors used by
  `PipelineArrows` for `getBoundingClientRect()`
- Loading placeholder rects (visible only before weights load)

The SVG overlay takes pointer events (delegated to the root `<svg>`);
the canvas has `pointer-events: none` in CSS. One pointer handler on
the SVG does the hit-test for all 9 matrices.

## Supporting modules

### `archBoxes` — [modelDiagramLayout.ts](../../post/src/lib/viz/modelDiagramLayout.ts)

Static array of 9 boxes with:
- `id` — 'embed', 'wq', 'wk', 'wv', 'wo', 'gate', 'up', 'down', 'norm'
- `label` / `sub` — display name
- `x, y, w, h` — world-space layout rect (overridden by stack layout)
- `color` — hex color for sides + labels
- `vertical` — whether it's a column vector rather than a matrix

`renderBoxes` overrides the `x, y` to the viewBox center for stack
mode, but preserves `w, h, color` etc.

### `weightsSeries.ts` — [weightsSeries.ts](../../post/src/lib/viz/weightsSeries.ts)

Loads pre-computed weight snapshots + per-step deltas.
`getInterpolatedDeltaAt(key, step)` returns:
```ts
{ shape, values: Float32Array, delta: Float32Array, absMax: number }
```

`fetchWeights(boxId, blockIdx, step)` wraps this and maps box ids to
parameter keys (e.g. `wq` → `blocks.0.attn.q.weight`).

## Performance characteristics

At 44,148 cells across 9 matrices:
- **Projections per paint**: `9 × (dispRows + 1) × (dispCols + 1)` ≈
  50k, plus 72 cuboid corner projections.
- **Fills per paint**: ~44k cells + 36 side faces + 9 plane outlines +
  ~20 head dividers ≈ 44,065.
- **Typical paint time**: ~5 ms on a 2023 M2.
- **Paint cadence**: once per `featuredStep` change (~900 ms), plus on
  resize. Not a hot path.

Bottleneck is `ctx.fill()` itself, not the projection math. See [07 —
Advanced techniques](07-advanced-techniques.md) for where to look if
this stops being enough.
