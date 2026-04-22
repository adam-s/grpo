# 3D on a 2D canvas — how we do it

Living reference for the pseudo-3D rendering used in
[post/src/lib/components/viz/ModelDiagram.svelte](../../post/src/lib/components/viz/ModelDiagram.svelte).
Captures the math, the conventions we picked, the algorithms in use, and
links to the literature for everything else.

## Contents

1. [**Why pseudo-3D, not WebGL**](01-why-pseudo-3d.md) — what we tried,
   what failed, why a tiny 3D pipeline won.
2. [**Projection math**](02-projection-math.md) — similar triangles, the
   `d/z` formula, deriving our `projectXY()`.
3. [**Coordinates & rotations**](03-coordinates-and-rotations.md) — world,
   camera, screen; yaw / pitch / roll; sign conventions; how to specify
   a rotation to me unambiguously.
4. [**Painter's algorithm vs. z-buffer**](04-visibility-algorithms.md) —
   why we use back-to-front sort and when it breaks down.
5. [**Hit-testing under perspective**](05-hit-testing.md) — inverse
   bilinear interpolation on a projected quad, with the math worked out.
6. [**Plane thickness via cuboids**](06-plane-thickness.md) — turning a
   flat matrix into a solid card, including the painter's-algorithm
   trick we use to skip backface culling.
7. [**Advanced techniques**](07-advanced-techniques.md) — survey of
   what we *don't* yet do: lighting, fog, drop shadows, perspective-
   correct texturing, scanline rasterizers, Mode 7, and more. Each
   entry: what it buys, what it costs, when to bother.
8. [**Implementation map**](08-implementation-map.md) — exactly where in
   the codebase each concept lives, so you can read the code alongside
   the explanation.
9. [**Sources**](sources.md) — every external reference: GitHub repos,
   tutorials, papers, blog posts.

## TL;DR for someone touching the code

- Single function, `projectXY(x, y, z) → [screenX, screenY]`, does all
  the projection. Everything else (cells, edges, labels, hit-test,
  cuboid sides) just calls it.
- Cells are filled as 4-corner trapezoidal quads (not affine-transformed
  rects), so perspective foreshortening is real, not faked.
- Matrices are stacked at the same `(x, y)` and separated only by `z`,
  rendered back-to-front. Yaw rotates the stack into a visible line.
- Tunable knobs at the top of [ModelDiagram.svelte](../../post/src/lib/components/viz/ModelDiagram.svelte):
  `CAM_DIST`, `ROT_X`, `ROT_Y`, `STACK_SPACING`, `THICKNESS`. Change
  these to retune the look without touching the math.
