# 02 — Projection math

The whole pipeline reduces to one formula. Everything else is bookkeeping.

## Similar triangles

A point at world depth `z` from the camera, with horizontal offset `x`
from the camera's optical axis, projects to screen-x:

```
screenX = x · (d / z)
```

where `d` is the distance from the camera to the projection plane (the
"screen"). Same for y:

```
screenY = y · (d / z)
```

That's the whole thing. The `d / z` factor is the **scale**: it's 1
when an object is at the projection plane, smaller when farther, larger
when closer. Cells in the back of a stack get smaller because their
`z` is bigger and `d / z` shrinks.

```
                                     world point at (x, y, z)
                                  ●
                                ⟋
                              ⟋
                            ⟋
                          ⟋
                        ⟋
                      ⟋
       camera ●------●------screen plane (at distance d from camera)
                     ↑
                screen point at (x · d/z, y · d/z)
```

## Choosing `d`

We don't pick `d` directly — we let the user think in terms of "how
much perspective distortion do I want?" via a single constant
`CAM_DIST` that plays the role of both the camera-to-scene distance
*and* the projection-plane distance.

In our `projectXY`:

```ts
const scale = CAM_DIST / (CAM_DIST + z);
```

- Large `CAM_DIST`: camera is far away, depth differences are a small
  fraction of the total distance, scale stays close to 1, perspective
  is subtle. Looks like an isometric projection.
- Small `CAM_DIST`: camera is close, depth differences dominate, scale
  varies a lot, perspective is dramatic. Looks like a fisheye lens.

We use `CAM_DIST = 1400` for our 75°-yawed stack. Tunable.

## Adding rotation

Before projecting, we rotate the world point about the scene origin so
the user can view the scene from an angle. We do **yaw** (rotation
about the vertical Y axis) and **pitch** (rotation about the horizontal
X axis); no roll (rotation about the depth Z axis).

For yaw:
```
x' = x · cos(yaw) − z · sin(yaw)
z' = x · sin(yaw) + z · cos(yaw)
y' = y
```

For pitch (applied after yaw):
```
y'' = y' · cos(pitch) − z' · sin(pitch)
z'' = y' · sin(pitch) + z' · cos(pitch)
x'' = x'
```

Then project:
```
scale = CAM_DIST / (CAM_DIST + z'')
screenX = sceneCenterX + x'' · scale
screenY = sceneCenterY + y'' · scale
```

Order matters — `yaw then pitch` and `pitch then yaw` give different
results. We picked yaw-then-pitch because that's how the SNES Mode 7
demos are usually written and it's the more intuitive ordering for our
"look at the scene from above-right" view.

## The actual function

[ModelDiagram.svelte:51-61](../../post/src/lib/components/viz/ModelDiagram.svelte) — `projectXY`:

```ts
function projectXY(x: number, y: number, z: number): [number, number] {
  const px = x - CX;
  const py = y - CY;
  const x1 = px * COS_Y - z  * SIN_Y;
  const z1 = px * SIN_Y + z  * COS_Y;
  const y2 = py * COS_X - z1 * SIN_X;
  const z2 = py * SIN_X + z1 * COS_X;
  const scale = CAM_DIST / (CAM_DIST + z2);
  return [CX + x1 * scale, CY + y2 * scale];
}
```

`CX, CY, COS_X, SIN_X, COS_Y, SIN_Y` are precomputed module-level
constants so the hot path is purely arithmetic. ~10 floating-point ops
per projected point.

## A second variant: per-axis local yaw

[ModelDiagram.svelte:64-78](../../post/src/lib/components/viz/ModelDiagram.svelte) — `projectWithYaw`:

```ts
function projectWithYaw(
  wx: number, wy: number, z: number,
  pivotX: number, yaw: number,
): [number, number] {
  if (yaw === 0) return projectXY(wx, wy, z);
  const cosL = Math.cos(yaw);
  const sinL = Math.sin(yaw);
  const lx = wx - pivotX;
  const rx = pivotX + lx * cosL - z * sinL;
  const rz = lx * sinL + z * cosL;
  return projectXY(rx, wy, rz);
}
```

Applies a **local yaw** about a per-box vertical axis (`pivotX`) before
calling the global projection. Used when each box should have its own
independent rotation (we experimented with this; in the current build
`BOX_YAW = 0` so the local yaw is a no-op).

## Performance note

For our viz at full size (44k cells), naively projecting all 4 corners
of every cell every paint = 176k projections. At ~10 ops each = ~2 Mflops
per paint. Fine.

But we precompute a vertex grid per matrix once per paint —
`(dispRows + 1) × (dispCols + 1)` projections, ~1/4 the work, because
adjacent cells share their corners. See `projectGrid` in
[ModelDiagram.svelte](../../post/src/lib/components/viz/ModelDiagram.svelte).

## Further reading

- [Scratchapixel — Computing the pixel coordinates of a 3D point](https://www.scratchapixel.com/lessons/3d-basic-rendering/computing-pixel-coordinates-of-3d-point/mathematics-computing-2d-coordinates-of-3d-points.html) — derivation from first principles
- [WebGL2 fundamentals — 3D perspective](https://webgl2fundamentals.org/webgl/lessons/webgl-3d-perspective.html) — same math in matrix form
- [Tonc — Mode 7 Part 1](https://www.coranac.com/tonc/text/mode7.htm) — the SNES technique with full math
