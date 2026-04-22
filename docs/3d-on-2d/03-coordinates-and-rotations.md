# 03 — Coordinates and rotations

This page nails down our conventions so you can describe a rotation to me
unambiguously and I can change the right constant.

## The three coordinate spaces

We move points through three spaces. Each has its own axes and units.

### World space (viewBox units)

The space the data lives in. Axes:

- **+x** → right
- **+y** → down (we inherit SVG's y-down convention; it carries through canvas)
- **+z** → away from camera (a point at z=100 sits 100 units behind a point at z=0)

Origin is the top-left of the SVG viewBox. Units are viewBox units —
arbitrary, ~1024×768 in practice, scaled to the device by SVG's
`preserveAspectRatio`.

The "scene center" `(CX, CY) = (viewW / 2, viewH / 2)` is the pivot
around which we rotate. It's *not* the origin — keep this distinction
straight when reading the projection code.

### Camera / view space

After rotation about the scene center, the world is rephrased into the
camera's frame: same units, but +x/+y/+z now mean right/down/forward
**from the camera's point of view**.

We don't store this space in code — the rotation happens inline inside
`projectXY`. But it's the conceptual midpoint between world and screen.

### Screen space (also viewBox units)

After perspective division (`scale = CAM_DIST / (CAM_DIST + z)`),
camera-space (x, y) becomes screen (x, y) — still in viewBox units, so
the canvas 2D context can draw them directly using its
`setTransform(...)` to map viewBox → device pixels.

Origin again top-left. We add `CX, CY` back so the rotation pivot is the
viewBox center, not its corner.

## Rotation primitives

We use **yaw** and **pitch** only. No roll. (Adding roll would tilt the
horizon; we never want that for a top-down inspection viz.)

### Yaw — rotation about the vertical Y axis

> "Turn your head left or right."

Positive yaw in our convention rotates the world clockwise when viewed
from above (looking down −y). Equivalently: a positive-yaw rotation
sends the world's +x axis toward +z (away from the camera).

```
       y (up out of page)
       ●
       │
   +x ─┼─→        yaw rotates the x→z plane
       │
       z (away)
```

In code (`projectXY`, lines 59–60):
```ts
const x1 = px * COS_Y - z * SIN_Y;
const z1 = px * SIN_Y + z * COS_Y;
```

Constants: `ROT_Y` is in **radians**. We use `-1.309` rad ≈ −75°
because the negative direction swings the stack's left edge backward
and lets the deck fan out toward the right (the direction of forward
data flow in the architecture diagram).

### Pitch — rotation about the horizontal X axis

> "Tilt your head down or up."

Positive pitch tips the top of the world toward the camera. Equivalently:
positive-pitch rotation sends the world's +y axis toward −z.

In code (`projectXY`, lines 61–62):
```ts
const y2 = py * COS_X - z1 * SIN_X;
const z2 = py * SIN_X + z1 * COS_X;
```

Constants: `ROT_X = 0.08` rad ≈ 4.6°. Just enough to peek at the tops
of the cuboid stack so the viewer reads "thick cards seen from
above-and-to-the-side" instead of "trapezoids."

### Roll — rotation about the depth Z axis

> "Tilt your head sideways toward your shoulder."

Not used. If you ever need it: it's a 2D rotation in the screen plane
applied last, after pitch:
```
x''' = x'' * cos(roll) - y'' * sin(roll)
y''' = x'' * sin(roll) + y'' * cos(roll)
```

## The order matters

We do **yaw, then pitch**. Different orders give different scenes —
they don't commute. (Try it: yaw 90° then pitch 90° lands you somewhere
different than pitch 90° then yaw 90°.)

Yaw-then-pitch matches the SNES Mode 7 convention and feels right for
"look at the scene from above-right." If you ever need to swap, change
the lines in `projectXY` — the pitch block consumes `(py, z1)` and
needs to consume `(py, z)` instead, and the yaw block needs to consume
the pitched coords. Easier to redo from scratch than to patch.

## Per-box yaw (the second variant)

`projectWithYaw(wx, wy, z, pivotX, yaw)` adds an *extra* yaw before the
global rotation, pivoting about a per-box vertical line at `x = pivotX`
instead of the scene center. This lets each weight matrix have its own
swivel axis.

In the current build `BOX_YAW = 0`, so this collapses to plain
`projectXY` — but the machinery is in place for an "explode the stack"
animation where each card rotates open about its own center.

## How to specify a rotation to me unambiguously

Bad: "rotate it more."
Bad: "tilt it the other way."
Bad: "make it look like the picture."

Good: "increase yaw — left side should swing further back."
Good: "more pitch, so the tops of the cards become more visible."
Good: "set ROT_Y to −1.0 (about −57°)."

If you give me a degrees value I'll convert; if you give me a direction
I'll change the right constant. Mention which axis (yaw/pitch) and which
sign (more positive / more negative).

## Knobs at the top of `ModelDiagram.svelte`

| Constant         | Units    | What it does                              |
|------------------|----------|-------------------------------------------|
| `CAM_DIST`       | viewBox  | Camera distance. Larger = less perspective. |
| `ROT_Y`          | radians  | Global yaw. Negative swings left side back. |
| `ROT_X`          | radians  | Global pitch. Positive tips tops forward.   |
| `BOX_YAW`        | radians  | Extra per-box yaw about the box's own axis. |
| `STACK_SPACING`  | viewBox  | Distance in z between consecutive matrices. |
| `THICKNESS`      | viewBox  | Front-face-to-back-face depth of each card. |

Change these; don't touch the projection math.
