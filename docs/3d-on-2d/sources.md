# Sources

Every external reference used while building the pseudo-3D pipeline and
writing these docs. Grouped by topic.

## Pseudo-3D foundations (the technique family)

- [Lou's Pseudo-3D Page](https://web.archive.org/web/20071227003923/http://www.gorenfeld.net/lou/pseudo/) — 1990s deep-dive, still the canonical overview of pseudo-3D techniques (ground/wall/billboard).
- [Jake Gordon — How to build a racing game (straight roads)](https://codeincomplete.com/articles/javascript-racer-v1-straight/) — the modern walkthrough we followed; `scale = d / z` falls out of the first section.
- [jakesgordon/javascript-racer](https://github.com/jakesgordon/javascript-racer) — reference implementation of Out Run-style pseudo-3D.
- [Mamboleoo — How to render 3D in 2D canvas](https://www.mamboleoo.be/articles/how-to-render-3d-in-2d-canvas) — particles, globe, cube; modern take that matches canvas 2D idioms.

## Perspective projection math

- [Scratchapixel — Computing the pixel coordinates of a 3D point](https://www.scratchapixel.com/lessons/3d-basic-rendering/computing-pixel-coordinates-of-3d-point/mathematics-computing-2d-coordinates-of-3d-points.html) — derivation from first principles.
- [WebGL2 fundamentals — 3D perspective](https://webgl2fundamentals.org/webgl/lessons/webgl-3d-perspective.html) — same math, matrix form.
- [WebGL2 fundamentals — 2D matrices](https://webgl2fundamentals.org/webgl/lessons/webgl-2d-matrices.html) — the best didactic walkthrough of homogeneous coordinates.
- [Tonc — Mode 7 Part 1](https://www.coranac.com/tonc/text/mode7.htm) — SNES Mode 7 with full math; the per-scanline view of perspective.

## Camera matrix / 3D engines in canvas

- [hughsk/from-3d-to-2d](https://github.com/hughsk/from-3d-to-2d) — minimal, reusable projection helper, ~20 LOC.
- [stuartwakefield/canvas3dgfx](http://stuartwakefield.github.io/canvas3dgfx/) — full canvas-2D 3D engine with lookAt/projection.
- [darkeclipz/3d-canvas](https://github.com/darkeclipz/3d-canvas) — minimal canvas 3D engine.
- [kitsunegames — Software 3D rendering in JavaScript (Part 1: Wireframe)](https://kitsunegames.com/post/development/2016/07/11/canvas3d-3d-rendering-in-javascript/) — builds from cubes up.
- [kitsunegames — Part 2: Triangles](https://kitsunegames.com/post/development/2016/07/28/software-3d-rendering-in-javascript-pt2/) — adds rasterization and fills.
- [3D From Scratch — alexandrugris](https://alexandrugris.github.io/graphics/3d/2020/04/15/3d-from-scratch.html) — end-to-end pipeline from scratch.

## Hit-testing / inverse bilinear interpolation

- [Reed Beta — Quadrilateral interpolation Part 1](https://www.reedbeta.com/blog/quadrilateral-interpolation-part-1/) — clearest derivation, with figures.
- [Iquilezles — Inverse bilinear](https://iquilezles.org/articles/ibilinear/) — alternate formulation, GPU shader code.
- [Scratchapixel — Barycentric coordinates](https://www.scratchapixel.com/lessons/3d-basic-rendering/ray-tracing-rendering-a-triangle/barycentric-coordinates.html) — triangles, simpler analogue.

## Visibility: painter's algorithm and z-buffer

- [Painter's algorithm — Wikipedia](https://en.wikipedia.org/wiki/Painter%27s_algorithm) — failure cases with diagrams.
- [Scanline rendering — Wikipedia](https://en.wikipedia.org/wiki/Scanline_rendering) — alternative rasterization strategy.
- [Scratchapixel — Visibility & depth buffer](https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/visibility-problem-depth-buffer-depth-interpolation.html) — math for both.
- [Scratchapixel — Perspective-correct interpolation](https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/perspective-correct-interpolation-vertex-attributes.html) — why affine interpolation breaks under perspective.

## Perspective-correct texturing

- [tulrich — Perspective-correct texturing on HTML5 canvas](https://tulrich.com/geekstuff/canvas/perspective.html) — the canonical subdivision trick.
- [andrew-lim/texturedemo](https://github.com/andrew-lim/texturedemo) — affine vs perspective comparison, live demo.
- [Haggarman/Software-3D-Perspective-Correct-Textured-Triangles](https://github.com/Haggarman/Software-3D-Perspective-Correct-Textured-Triangles) — BASIC (!) reference implementation.
- [wanadev/perspective.js](https://github.com/wanadev/perspective.js) — image-to-perspective utility.

## Lighting and shading

- [Computer Graphics from Scratch — Shading chapter](https://gabrielgambetta.com/computer-graphics-from-scratch/13-shading.html) — flat / Gouraud / Phong, derived.
- [Baeldung — Flat vs Gouraud vs Phong](https://www.baeldung.com/cs/shading-flat-vs-gouraud-vs-phong) — comparison, when each matters.
- [Backface Culling and 3D Lighting — O'Reilly](https://www.oreilly.com/library/view/foundation-html5-animation/9781430236658/Chapter17.html) — signed-area trick, light direction.

## Mode 7 and specialized techniques

- [Cubified/mode7](https://github.com/Cubified/mode7) — pure JS Mode 7 perspective transform.
- [HugoSmits86/js-mode7](https://github.com/HugoSmits86/js-mode7) — software-rendered Mode 7 demo.

## Related visualization work (context, not source)

- [neuralviz3d](https://github.com/) — neural network 3D visualization (inspiration for the stacked-plane look).
- [Distill — various interactive explainers](https://distill.pub/) — the UX bar for this kind of viz.
