# 06 — Plane thickness via cuboids

> **Status: removed from current build.** We tried this — the cuboid
> sides at our 75° yaw rendered as wide colored bands that competed
> with the cell data for attention. After pairing block 0 and block 1
> (which already adds visible "stacked layer" depth), the thickness
> wasn't pulling its weight. Replaced with distance fog + drop shadows
> for the depth cue. Derivation kept below for when we revisit (e.g.
> if we ever want a single isolated card to read as solid).

A flat plane at depth `z = stackZ` reads on screen as a thin sheet of
paper. Adding **thickness** — turning each plane into a shallow cuboid
between `z = stackZ` (front face) and `z = stackZ + THICKNESS` (back
face) — changes the visual feel from "stack of paper" to "deck of
cards."

## The 8 vertices of a cuboid

Any axis-aligned cuboid is defined by 8 corners. With box at world
coords `(x ∈ [x0, x1], y ∈ [y0, y1])` and depth slice `[zF, zB]`:

```
TLf, TRf, BRf, BLf  ← front face at z = zF (closer)
TLb, TRb, BRb, BLb  ← back  face at z = zB (further)
```

In code ([ModelDiagram.svelte:386-401](../../post/src/lib/components/viz/ModelDiagram.svelte#L386-L401)):
```ts
const TLf = projectWithYaw(x0, y0, zF, pivot, yaw);
const TRf = projectWithYaw(x1, y0, zF, pivot, yaw);
const BRf = projectWithYaw(x1, y1, zF, pivot, yaw);
const BLf = projectWithYaw(x0, y1, zF, pivot, yaw);
const TLb = projectWithYaw(x0, y0, zB, pivot, yaw);
const TRb = projectWithYaw(x1, y0, zB, pivot, yaw);
const BRb = projectWithYaw(x1, y1, zB, pivot, yaw);
const BLb = projectWithYaw(x0, y1, zB, pivot, yaw);
```

8 projections per cuboid. With 9 matrices that's 72 extra projections per
paint — negligible.

## The 6 faces

A cuboid has 6 faces. We could draw all 6 and let painter's algorithm
sort them, but we can do better.

| Face   | Vertices        | Normal direction    | Visible from camera at our angle? |
|--------|-----------------|---------------------|-----------------------------------|
| Front  | TLf TRf BRf BLf | −z (toward camera)  | Yes — and it's the cell grid      |
| Back   | TLb TRb BRb BLb | +z (away)           | No — always hidden behind front    |
| Top    | TLf TRf TRb TLb | −y                  | Yes — pitch is positive, tops show |
| Bottom | BLf BRf BRb BLb | +y                  | Tilt-dependent (we just draw it)   |
| Left   | TLf BLf BLb TLb | −x                  | Yaw-dependent                      |
| Right  | TRf BRf BRb TRb | +x                  | Yaw-dependent                      |

So in principle we should draw 5 faces (skip back), then run **backface
culling** to skip the 1–2 sides whose normals point away from the
camera at the current rotation.

## The painter's-algorithm shortcut

We **draw all 4 sides every paint** ([ModelDiagram.svelte:417-420](../../post/src/lib/components/viz/ModelDiagram.svelte#L417-L420)):
```ts
fillQuad(TLf, TRf, TRb, TLb); // top
fillQuad(BLf, BRf, BRb, BLb); // bottom
fillQuad(TLf, BLf, BLb, TLb); // left
fillQuad(TRf, BRf, BRb, TRb); // right
```

Then we draw the front face (the cells) on top.

Why no backface culling? Because **the front face is always closer to
the camera than every side face**. So when we draw the front face after
the sides, the front face covers any portion of a back-facing side that
sticks out from behind the cuboid. The back-facing sides are still
*drawn*, but they're covered before the user sees them.

The trick costs us 2 extra `fill()` calls per cuboid (~4 µs). Saves us
the trouble of computing per-face normals and doing the dot-product test.

When the trick **breaks**:
- If we ever showed the matrix from below (negative pitch), the *bottom*
  face would be back-facing, but the *top* face would still cover it
  via the same logic — wait, no, the top face also wouldn't be drawn at
  the right depth. Hmm.
- Actually: at extreme angles where the back-facing sides extend
  *outside* the projected front face's footprint, they'd peek out as
  visible artifacts. Our pitch is small (~5°) and yaw is moderate
  (~75°), so the projected sides stay entirely within the projected
  front face's silhouette. Safe.

If we ever crank pitch above ~30°, this trick fails and we have to add
real backface culling.

## How to backface-cull when the time comes

The standard test: project the 4 corners of a face to screen, compute
the **signed area** of the resulting quad. If positive, the face is
front-facing; if negative, back-facing.

```ts
function signedArea(a, b, c, d) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
       + (c[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (c[1] - a[1]);
}
// Skip face if signedArea(corners) < 0 (assuming CCW winding for front-facing)
```

This is 8 ops per face — cheaper than the `fill()` we'd skip. Worth it
once we need it.

## Choosing `THICKNESS`

`THICKNESS = 14` viewBox units. Empirically:
- `0`: paper-thin sheets, the original look. No depth at all.
- `5`: barely visible thickness; reads as "thick paper."
- `15`: solid card. Side faces are visible bands of color.
- `40`: cinder block. Looks chunky and clumsy.

The constant is small relative to `STACK_SPACING = 90`, so cards stay
visually separated rather than blurring into a continuous mass.

## Side fill style

Sides are filled at `globalAlpha = 0.55` with the box's main color
([ModelDiagram.svelte:403-404](../../post/src/lib/components/viz/ModelDiagram.svelte#L403-L404)):
```ts
ctx.fillStyle = box.color;
ctx.globalAlpha = 0.55;
```

Half-alpha so the side shading is *softer* than the front face — front
face says "here's the data," sides say "and there's a card behind it."
Full alpha on sides made them compete with the cell colors for attention.

## Why we render the side as a quad, not a parallelogram

Each side face has 4 corners that, when projected, generally form a
**trapezoid** under perspective — not a parallelogram. If we tried to
fake it with `ctx.transform()` and a rectangle fill, we'd get a
parallelogram that looks subtly wrong.

Drawing each side as a 4-point `beginPath()` quad ensures each corner
gets its true perspective-divided position. The shape is correct by
construction.

## Future: per-side shading

Right now all sides use the same color/alpha. A natural upgrade: shade
each side based on its angle to a virtual light source (Lambertian).
Sides facing toward the light brighten; sides facing away darken. This
would sell the 3D feel further without adding any geometry.

Cost: per-side compute the surface normal in screen space (cross product
of two edge vectors), dot with light direction, multiply alpha by the
result. ~10 ops per side per cuboid. Cheap.

Tradeoff: we'd lose the strict by-color visual encoding (every box has
a deterministic color regardless of camera angle). For a viz where color
*means* something (which model layer this is), that may not be worth it.

## Further reading

- [kitsunegames — Software 3D rendering in JavaScript: wireframe](https://kitsunegames.com/post/development/2016/07/11/canvas3d-3d-rendering-in-javascript/) — start with cubes, builds up
- [Backface culling — O'Reilly Foundation HTML5 Animation](https://www.oreilly.com/library/view/foundation-html5-animation/9781430236658/Chapter17.html) — the signed-area trick
- [3D From Scratch — alexandrugris](https://alexandrugris.github.io/graphics/3d/2020/04/15/3d-from-scratch.html) — full pipeline with cubes
