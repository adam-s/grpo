# 01 — Why pseudo-3D, not WebGL

## The problem

The transformer weight visualization in section 1 of the post needs to
show **9 weight matrices** (44,148 cells total) as a stack of layered
planes that the reader can perceive as 3D objects, with each cell still
identifiable and hoverable.

## What we tried first, and why it failed

| Attempt | What it did | Why it didn't work |
|---|---|---|
| **CSS `transform: perspective() rotateX() rotateY()`** on the stage | Tilted the entire DOM/canvas via the GPU | One rigid affine transform on the whole element. Cells didn't actually change size with depth — the whole thing was one warped image. Pointer hit-test became inaccurate at any non-trivial angle. |
| **`ctx.translate()` skew offset** for block 1 behind block 0 | Two layers separated by a 2D pixel offset | Parallelogram, not trapezoid. Nothing reads as 3D — it's just two flat copies, one shifted. |
| **`ctx.rotate()` per box** with different angles | Each matrix tilted independently | Local affine rotation = parallelogram. Same problem: parallel lines stay parallel, no perspective foreshortening. |
| **Threlte / Three.js** | Real WebGL 3D, correct in every respect | +200 KB to the bundle, full scene-graph/material/camera lifecycle to manage, GPU contexts to think about — overkill for a single static viz that paints once every 900 ms. |

## Why pseudo-3D won

Pseudo-3D = manually projecting 3D world coordinates to 2D screen
coordinates with perspective division (`scale = d / z`), then drawing
in the canvas 2D context.

The pattern dates to 1980s arcade games: Out Run, Pole Position, every
SNES Mode 7 racer. Jake Gordon's
[javascript-racer](https://github.com/jakesgordon/javascript-racer)
walkthrough is the canonical modern explainer.

Concretely:
- **Real perspective** — cells on the far side of a plane are genuinely
  smaller than cells on the near side. Trapezoids, not parallelograms.
  Vanishing points work.
- **No new dependency** — pure math + canvas 2D, the APIs every browser
  has supported for 15+ years.
- **No GPU lifecycle** — the canvas is a rectangle of pixels, not a
  WebGL context with shaders, buffers, attributes, uniforms.
- **Works with the existing paint cadence** — we paint once per
  playback tick (~900 ms) plus on resize. Per-frame perf is irrelevant;
  per-paint cost is dominated by `ctx.fill()` calls, not by the
  projection math.
- **Reuses the existing color/data pipeline** — the `RDBU_LUT` colormap
  and the `weightsSeries` data flow stayed untouched. We only changed
  *how* cells get drawn, not *what* gets drawn.

## When pseudo-3D stops being enough

These are the points at which the WebGL/Three.js argument starts winning:

- **Per-frame animation** — if the viz needs to rotate at 60 fps, the
  CPU cost of projecting tens of thousands of vertices per frame and
  filling thousands of paths becomes the bottleneck. Our once-per-tick
  cadence avoids this entirely.
- **Per-pixel effects** — lighting that varies across a face, true
  textures, normal maps, post-processing. Canvas 2D can do these but
  needs a software rasterizer with `ImageData`; at that point WebGL
  is faster *and* simpler.
- **Many intersecting objects** — painter's algorithm fails on
  self-intersecting / mutually-overlapping geometry. We have flat
  parallel planes; this never happens.
- **Reader-controlled camera** — drag-to-orbit, zoom, etc. Doable in
  pure canvas (we already projected the math), but at that point the
  ergonomic case for `OrbitControls` from `@threlte/extras` becomes
  strong.

For the GRPO post, none of those apply. Pseudo-3D it is.

## Further reading

- [Lou's Pseudo-3D Page](https://web.archive.org/web/20071227003923/http://www.gorenfeld.net/lou/pseudo/) — the original (1990s) deep-dive on the technique
- [Jake Gordon — How to build a racing game (straight roads)](https://codeincomplete.com/articles/javascript-racer-v1-straight/) — the modern walkthrough we followed
- [Mamboleoo — How to render 3D in 2D canvas](https://www.mamboleoo.be/articles/how-to-render-3d-in-2d-canvas) — particles + globe
