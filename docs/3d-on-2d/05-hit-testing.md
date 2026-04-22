# 05 — Hit-testing under perspective

When the user moves the cursor over a perspective-projected matrix, we
need to figure out *which cell `(r, c)` it's over*. The matrix is no
longer a rectangle on screen — it's a **trapezoid** (or general convex
quad). Standard "is `(x, y)` inside the rect?" arithmetic doesn't work.

## The problem stated formally

Given:
- 4 screen-space corners `TL, TR, BR, BL` of a projected matrix
  (counterclockwise from top-left, in our convention).
- A pointer position `Q = (qx, qy)` in the same space.
- The matrix has `dispRows × dispCols` cells.

Find `(r, c)` such that the cell is the one under the cursor — or
return "no hit" if Q is outside the quad entirely.

Equivalently, find `(u, v) ∈ [0,1]²` — the cell's normalized parameter
inside the quad — and convert to integer indices via
`r = floor(v * dispRows)`, `c = floor(u * dispCols)`.

## The bilinear forward map

For a quad, the forward mapping from `(u, v) ∈ [0,1]²` to screen is
**bilinear**:

```
P(u, v) = (1-u)(1-v) · TL
        +   u  (1-v) · TR
        +   u    v   · BR
        + (1-u)  v   · BL
```

Expand and group:

```
P(u, v) = TL + u·(TR - TL) + v·(BL - TL) + u·v·(TL - TR + BR - BL)
```

Define `B = TR - TL`, `C = BL - TL`, `D = TL - TR - BL + BR`. Then:

```
Q - TL = u·B + v·C + u·v·D     ──  (★)
```

This is **two scalar equations** (one per coordinate) in **two unknowns**
(u, v). But the `u·v·D` term makes it nonlinear.

## Inverting the bilinear map

Equation (★) component-wise, with `H = Q - TL`:

```
Hx = u·Bx + v·Cx + u·v·Dx     (1)
Hy = u·By + v·Cy + u·v·Dy     (2)
```

**Strategy**: eliminate u, get a quadratic in v.

Solve (1) for u (treating v as known):
```
u·(Bx + v·Dx) = Hx - v·Cx
u = (Hx - v·Cx) / (Bx + v·Dx)
```

Substitute into (2):
```
Hy = ((Hx - v·Cx) / (Bx + v·Dx)) · (By + v·Dy)
```

Multiply through by `(Bx + v·Dx)`:
```
Hy · (Bx + v·Dx) = (Hx - v·Cx) · (By + v·Dy)
```

Expand both sides and collect like powers of v:

```
Hy·Bx + v·Hy·Dx = Hx·By + Hx·v·Dy - v·Cx·By - v²·Cx·Dy
```

Move everything to one side and group by v power:

```
0 = (-Cx·Dy) v²
  + (Hx·Dy - Cx·By + Hy·Dx̅ ... wait, let me redo carefully)
```

Let me redo this more carefully. Starting from:
```
Hy·(Bx + v·Dx) = (Hx - v·Cx)·(By + v·Dy)
```

LHS: `Hy·Bx + Hy·Dx·v`

RHS: `Hx·By + Hx·Dy·v − Cx·By·v − Cx·Dy·v²`

So `0 = RHS − LHS`:
```
0 = Hx·By + Hx·Dy·v − Cx·By·v − Cx·Dy·v² − Hy·Bx − Hy·Dx·v
```

Group by power of v:
```
0 = (−Cx·Dy) v²
  + (Hx·Dy − Cx·By − Hy·Dx) v
  + (Hx·By − Hy·Bx)
```

This is `k₂ v² + k₁ v + k₀ = 0` with:
```
k₂ = −Cx·Dy
k₁ = Hx·Dy − Cx·By − Hy·Dx
k₀ = Hx·By − Hy·Bx
```

The code form is equivalent; here are the coefficients [as actually
computed](../../post/src/lib/components/viz/ModelDiagram.svelte#L482):

```ts
const k2 = Gx * Fy - Gy * Fx;                                    // ≡ Dx·Cy − Dy·Cx
const k1 = Ex * Fy - Ey * Fx + Hx * Gy - Hy * Gx;                // mixed
const k0 = Hx * Ey - Hy * Ex;                                    // ≡ Hx·By − Hy·Bx
```

(Variable name map: `E = B = TR − TL`, `F = C = BL − TL`, `G = D = TL − TR − BL + BR`. Same math, derivation rotated by sign convention.)

## Solving the quadratic

```
v = (−k₁ ± √(k₁² − 4·k₂·k₀)) / (2·k₂)
```

Two roots in general. We pick the one in `[0, 1]` (with a small
tolerance for numerical slop). If both are in range — geometrically
that means the point projects to two valid (u, v) coords, which can
happen for a non-convex quad — we take the first one. Our quads from
projected rectangles are always convex.

### Edge cases

- **`|k₂| ≈ 0`**: the quad degenerates to a parallelogram (no
  perspective foreshortening, e.g. when the matrix is parallel to the
  view plane). The equation linearizes:
  ```
  v = −k₀ / k₁
  ```
  We special-case this with a `1e-9` threshold.

- **Discriminant `< 0`**: no real solution — the point is geometrically
  outside the quad. Return null.

- **`v` outside `[0, 1]`**: outside the quad. Return null.

## Recovering u

Once `v` is known, recover `u`:
```
u = (Hx − Cx·v) / (Bx + Dx·v)        from (1)
```
or equivalently:
```
u = (Hy − Cy·v) / (By + Dy·v)        from (2)
```

We use whichever denominator has larger magnitude — picks the more
numerically stable formula. Otherwise dividing by a near-zero denominator
produces garbage.

```ts
const u = Math.abs(denomX) > Math.abs(denomY)
  ? (Hx - Fx * v) / denomX
  : (Hy - Fy * v) / denomY;
```

If `u` is out of `[0, 1]` (with tolerance), the point is outside the
quad — return null.

## Going from (u, v) to (r, c)

```ts
const c = clamp(0, dispCols - 1, floor(u * dispCols));
const r = clamp(0, dispRows - 1, floor(v * dispRows));
```

The clamp catches the rare case where a tolerance-band pointer at u=1.0
floor()s to `dispCols` itself. Same for v.

## Performance

We loop over all 9 matrices on every `pointermove`. For each: ~20 ops
to compute coefficients, sqrt + 1 division to solve quadratic, ~10 ops
to recover u, comparison checks. ~50 ops per matrix × 9 matrices = ~450
ops per move event. Trivial.

We could short-circuit by AABB-testing against each matrix's projected
bounding box first, skipping the inverse-bilinear solve if the cursor
isn't in the AABB. Haven't bothered — the math is already faster than
pointer event dispatch.

## Why not project the cursor backward?

Alternative approach: take screen `(qx, qy)` and "unproject" it back to
world space using the inverse of the projection matrix, then check
which matrix it lands in.

For a single perspective projection that works, but you need to pick a
target z (the cursor on screen corresponds to a *ray* in world space,
not a point). You'd have to intersect that ray with each matrix's plane,
giving 9 intersection tests anyway. Inverse bilinear directly answers
"which cell" without round-tripping through 3D.

## Further reading

- [Reed Beta — Inverse bilinear interpolation](https://www.reedbeta.com/blog/quadrilateral-interpolation-part-1/) — clearest derivation and visualization
- [Iquilezles — Inverse bilinear](https://iquilezles.org/articles/ibilinear/) — alternate formulation, GPU shader code
- [Scratchapixel — Barycentric coordinates](https://www.scratchapixel.com/lessons/3d-basic-rendering/ray-tracing-rendering-a-triangle/barycentric-coordinates.html) — analogous problem for triangles, which are easier (linear, not bilinear)
