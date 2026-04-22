# 07 — Advanced techniques we don't (yet) use

A survey of techniques beyond our current pipeline, ranked by relevance
to this specific viz. For each: what it buys, what it costs, whether
it's worth adopting.

This mirrors the Tier-1/2/3 structure from the research plan.

---

## Tier 1 — meaningful upgrades for our use case

### 1. Plane thickness via cuboid rendering

**Tried, then removed** — see [06 — Plane thickness](06-plane-thickness.md).
Cuboid sides at our 75° yaw competed with the cell data. Pairing
block 0 + block 1 (per matrix type) already supplies the "stacked
layers" depth signal, and the side bands became redundant noise.

### 2. Camera matrix abstraction (lookAt + projection)

Replace the hand-rolled `projectXY` with a proper view + projection
matrix pipeline:

```
worldPoint  ──Model──→  ──View (lookAt)──→  ──Projection (perspective)──→  screen
```

Same math we're doing, factored into 4×4 matrices.

**What it buys**:
- Camera position becomes a 3-vector you can animate.
- Drag-to-orbit is ~5 lines once the matrix layer exists (build a new
  view matrix from mouse delta).
- Adding new geometry (arrows, labels, ghosts) doesn't require
  rewriting projection code; everything calls one `project(worldPoint)`.

**What it costs**: ~50 LOC of matrix math, or a tiny dep like
`gl-matrix` (~10 KB). Refactor with zero visual change if done right.

**When to pursue**: before adding any of the following — orbit controls,
camera animation, or a second viz that needs the same projection math.
Refactoring once is cheap; four sites drifting out of sync is expensive.

**References**:
- [hughsk/from-3d-to-2d](https://github.com/hughsk/from-3d-to-2d) — minimal, ~20 LOC
- [WebGL2 fundamentals — 2D matrices](https://webgl2fundamentals.org/webgl/lessons/webgl-2d-matrices.html) — best didactic walk-through
- [stuartwakefield/canvas3dgfx](http://stuartwakefield.github.io/canvas3dgfx/) — a full canvas-2D 3D engine with lookAt/projection

### 3. Distance-based fog / atmospheric attenuation

**Shipped.** Implemented as a single `ctx.globalAlpha = fogAlphaForZ(rb.stackZ)`
state per card in `paint()`, with the cream background showing through
faded back cards. `strokePlaneOutline` was tweaked to *compose* the
caller's globalAlpha (multiplying its own alpha into `prev`) so the fog
applies uniformly to fills, outlines, and head dividers. Constants:
`FOG_FAR = 8 * STACK_SPACING`, `FOG_STRENGTH = 0.35`.

### 4. Drop shadow under each plane

**Shipped.** Implemented as `paintShadow(ctx, rb)` — a blurred
elliptical fill (`ctx.filter = 'blur(6px)'`, `rgba(40,30,20,0.18)`) at
each card's projected bottom-center, scaled by `CAM_DIST / (CAM_DIST + z)`
so back cards get smaller, dimmer shadows automatically. Drawn before
the card so the card's own area covers it.

### 5. Backface culling for plane sides

Once planes have thickness (done), skip rendering faces whose normals
point away from the camera. Standard winding-order test in screen space.

**What it buys**: cleaner edge cases at extreme camera angles.

**What it costs**: ~15 lines in `paintCuboidSides`.

**When to pursue**: only if we ever show the stack from below, flip it,
or animate camera angles that cross the face-visible/hidden threshold.
At our fixed ~75° yaw / ~5° pitch the painter's-algorithm trick
already works (see [06](06-plane-thickness.md)). Not urgent.

---

## Tier 2 — clever but probably overkill for our data

### 6. Perspective-correct color interpolation across cells

Canvas 2D's `ctx.fill()` on a quad does **affine** interpolation of
any attributes (color, texture coords) — but under perspective,
attributes should interpolate in screen space divided by `w` (the
perspective-divided scalar).

**Why we don't care**: our cells are flat-filled — one color per cell,
no interpolation. No perspective error is possible.

**When this matters**: if we ever add a continuous heatmap (one big
texture spanning the entire matrix instead of per-cell fills), or
render an image texture on a plane at a sharp angle. The affine-map
seams would become visible.

**How to fix when needed**: **subdivision** — split each quad into 4
sub-quads when the perspective error exceeds a threshold, recursively.
Affine-map within each sub-quad. This is how the original PlayStation
hardware faked perspective textures.

**References**:
- [tulrich — perspective-correct texturing on HTML5 canvas](https://tulrich.com/geekstuff/canvas/perspective.html) — subdivision demo
- [andrew-lim/texturedemo](https://github.com/andrew-lim/texturedemo) — affine vs perspective, live comparison
- [Reed Beta — quadrilateral interpolation](https://www.reedbeta.com/blog/quadrilateral-interpolation-part-1/)
- [Scratchapixel — perspective-correct interpolation](https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/perspective-correct-interpolation-vertex-attributes.html)

### 7. Per-pixel z-buffer with software rasterizer

A `Float32Array(W * H)` depth buffer, custom scanline fill that writes
pixels through it. See [04 — Visibility algorithms](04-visibility-algorithms.md).

**Why we don't care**: painter's algorithm is correct for our
non-intersecting parallel planes. z-buffer only helps with intersecting
geometry, and we have none.

**When this matters**: if we ever draw a flow arrow piercing through a
plane, or a "ghost" matrix overlapping its predecessor. Self-
intersection kills painter's algorithm.

**How to fix when needed**: at that scale, WebGL is faster *and*
simpler — move to Three.js / Threlte / raw WebGL.

### 8. Mode-7 / floor projection

Render a horizontal grid plane under the stack (the SNES Mode 7 trick:
a 2D texture warped per-scanline to create a perspective floor).

**What it buys**: a floor / horizon anchoring the floating matrices.

**What it costs**: ~100 lines of scanline math + a texture. Heavy for
what it is.

**Verdict**: probably distracts from the data. Skip unless we're doing
something very arcade-game-ambitious.

**References**:
- [Cubified/mode7](https://github.com/Cubified/mode7) — pure JS
- [HugoSmits86/js-mode7](https://github.com/HugoSmits86/js-mode7) — software-rendered demo
- [Tonc — Mode 7 explained](https://www.coranac.com/tonc/text/mode7.htm) — the full math

### 9. Lighting (Lambertian / Gouraud / Phong)

Per-vertex or per-pixel shading based on a virtual light direction and
surface normals.

**Why we don't care**: our planes all face the camera along one axis.
Flat shading gives every pixel on the same plane the same light value
— i.e., no visible effect.

**When this matters**: if we add geometry that turns (a card flipping
animation, an "explode the stack" where each matrix rotates to a
different orientation). Then each plane would catch light differently
and shading would show its rotation.

**References**:
- [Computer Graphics from Scratch — shading](https://gabrielgambetta.com/computer-graphics-from-scratch/13-shading.html)
- [Baeldung — flat vs Gouraud vs Phong](https://www.baeldung.com/cs/shading-flat-vs-gouraud-vs-phong)

---

## Tier 3 — interesting but unrelated to our needs

- **Voxel rendering** — for true 3D scalar fields (activation atlases).
  Not applicable to 2D matrix grids.
- **Raycasting / Doom-style pseudo-3D** — wall-based; assumes vertical
  walls on a 2D floor plan. Doesn't match flat-plane stacks.
- **Particle systems** (à la Mamboleoo's globe) — beautiful but unrelated.
- **Bump / normal mapping** — fakes surface texture detail; our planes
  are flat, no surface to bump.
- **Post-processing: bloom, DOF, vignette** — possible with
  `ctx.filter`, but they're expensive per-frame and our paint cadence
  is 900 ms, not 16.67 ms. Save them for a per-frame viz.

---

## Recommended path forward

Tier 1 #3 (fog) and #4 (drop shadow) are now shipped. #1 (cuboid
thickness) was tried and rolled back. Remaining candidates from Tier 1:

1. **Camera matrix abstraction** (Tier 1 #2). Refactor only, no visual
   change, but unlocks every interactive camera move.
2. **Backface culling** (Tier 1 #5). Only relevant if we re-add cuboid
   thickness *and* add camera motion that crosses face-visible thresholds.

Tiers 2 and 3 are for if the viz expands scope. Our current scene is
tuned well for what it shows.
