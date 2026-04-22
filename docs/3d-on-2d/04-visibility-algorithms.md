# 04 — Painter's algorithm vs. z-buffer

The visibility problem: when two surfaces project to the same screen
pixel, which one wins?

## Painter's algorithm (what we use)

Sort surfaces back-to-front, draw in that order. The painter doesn't
worry about what's behind the mountain — they paint the mountain, then
paint the cabin in front of it, then paint the bird in front of the
cabin. Each new stroke covers what came before.

In code ([ModelDiagram.svelte:435](../../post/src/lib/components/viz/ModelDiagram.svelte#L435)):
```ts
const order = [...renderBoxes].sort((a, b) => b.stackZ - a.stackZ);
for (const rb of order) {
  paintCuboidSides(ctx, rb);
  fillCells(ctx, rb, rb.wFront, projectGrid(rb, rb.stackZ));
  // ...
}
```

Largest `stackZ` (furthest from camera) paints first; smallest
(closest) paints last and wins every overlap.

### Why it works for us

Our scene satisfies the strong precondition for painter's algorithm: the
9 weight matrices are **flat parallel planes** in z, separated by
`STACK_SPACING = 90`. They never intersect. There's a total z-ordering
of every surface; sorting once gives correct occlusion everywhere.

Per cuboid, the same property holds at sub-object granularity: the back
face is always behind the side faces, which are always behind the front
face. So we draw `paintCuboidSides` before `fillCells`, and the front
cells correctly cover the parts of the sides that should be hidden. (The
back face is never drawn at all — it would be hidden by the cuboid's own
front and sides.)

### Where painter's algorithm fails

Three classic failure modes, none of which we hit:

1. **Cyclic overlap.** Three triangles where A overlaps B, B overlaps
   C, C overlaps A. No total ordering exists.
2. **Mutual intersection.** Two quads slicing through each other. No
   single z value can rank one before the other.
3. **Self-overlap on concave shapes.** A folded surface where one part
   covers another in a way that depends on the camera angle.

If we ever add a "data flow arrow piercing through a plane" or
"transformer block exploding outward with intersecting parts," painter's
algorithm starts producing visible glitches and we need a real depth
buffer.

## Z-buffer (what we don't use)

Allocate `Float32Array(width × height)` of depth values, one per pixel.
For each pixel a polygon would fill, compare its depth to the buffered
depth; only write if closer.

```
zbuf = new Float32Array(W * H).fill(Infinity);
for each polygon:
  for each pixel (x, y) inside it:
    z = interpolated depth at (x, y);
    if (z < zbuf[y * W + x]) {
      framebuffer[y * W + x] = polygon.color;
      zbuf[y * W + x] = z;
    }
```

Pros: handles every visibility case correctly, including all three
failure modes above. Order-independent — you can draw polygons in any
order and the buffer sorts it out.

Cons:
- Need a software rasterizer that walks every pixel of every polygon
  yourself. Canvas 2D's `fill()` doesn't expose per-pixel depth, so
  you'd have to write directly into `ImageData`.
- ~10–100× slower than `ctx.fill()` per polygon for typical sizes.
- At that point WebGL / WebGPU is faster *and* simpler — the GPU does
  the z-buffer in hardware.

## Why we picked painter's

For our scene:
- 9 planes in strict z-order → sortable in O(n log n) once per paint.
- ~44k cells filled with native canvas `fill()` → JIT-compiled, fast.
- Total paint time is dominated by `fill()` calls, not sorting or
  projection.
- No intersecting geometry → painter's gives the right answer pixel-for-
  pixel.

If perf becomes an issue (currently ~5 ms per paint at 44k cells, fine
for our 900 ms cadence), the next step is to **batch fills by color** —
collect all cells of the same RdBu LUT index into one path with
`moveTo/lineTo` for every quad, then a single `fill()`. Same algorithm,
fewer state changes.

## Sorting subtlety: per-object vs per-polygon

We sort by **per-object** centroid z (`rb.stackZ`). This works because
each object is a thin cuboid that doesn't overlap itself in confusing
ways and doesn't intersect other cuboids.

A finer-grained painter's algorithm would sort each individual face of
each cuboid by its own centroid z — needed when a single object spans a
large depth range, or when faces of different objects might interleave.
We don't need that here.

## Further reading

- [Painter's algorithm — Wikipedia](https://en.wikipedia.org/wiki/Painter%27s_algorithm) — failure cases with diagrams
- [Scanline rendering — Wikipedia](https://en.wikipedia.org/wiki/Scanline_rendering) — alternative rasterization strategy
- [Scratchapixel — visibility & depth buffer](https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/visibility-problem-depth-buffer-depth-interpolation.html) — math for both approaches
