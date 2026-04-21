<script lang="ts">
  /**
   * 3×3 Rubik's Cube — cubie-based isometric SVG renderer.
   *
   * Architecture: 26 cubie objects carry their own sticker colors.
   * During rotation, colors travel with geometry — no per-frame state
   * lookup. Cubies are rebuilt from state whenever state changes.
   *
   * Projection (academic isometric):
   *   px = (x - y) / √2
   *   py = (x + y - 2z) / √6
   *
   * Y-flipped: F face at y=N (visible), B face at y=0.
   */

  import { getSticker, COLOR_HEX, type CubeState, type Color, type Move } from './cube';

  type V3 = [number, number, number];
  type V2 = [number, number];
  type FaceDir = 'U' | 'D' | 'F' | 'B' | 'L' | 'R';

  type Props = {
    cubeState: CubeState;
    size?: number;
    move?: Move | null;
    rotationProgress?: number;
  };

  const { cubeState, size = 60, move = null, rotationProgress = 0 }: Props = $props();

  const N = 3;
  const G = 0.04;
  const SQRT2 = Math.SQRT2;
  const SQRT6 = Math.sqrt(6);

  // ── Cubie type ────────────────────────────────────────────────────

  type Cubie = {
    gx: number; gy: number; gz: number;
    stickers: { dir: FaceDir; color: Color }[];
  };

  // ── Build cubies from state ───────────────────────────────────────

  function buildCubies(st: CubeState): Cubie[] {
    const cubies: Cubie[] = [];
    for (let gx = 0; gx < N; gx++) {
      for (let gy = 0; gy < N; gy++) {
        for (let gz = 0; gz < N; gz++) {
          if (gx === 1 && gy === 1 && gz === 1) continue;
          const stickers: { dir: FaceDir; color: Color }[] = [];
          if (gz === N - 1) stickers.push({ dir: 'U', color: getSticker(st, 'U', gy, gx) });
          if (gz === 0)     stickers.push({ dir: 'D', color: getSticker(st, 'D', N - 1 - gy, gx) });
          if (gy === N - 1) stickers.push({ dir: 'F', color: getSticker(st, 'F', N - 1 - gz, gx) });
          if (gy === 0)     stickers.push({ dir: 'B', color: getSticker(st, 'B', N - 1 - gz, N - 1 - gx) });
          if (gx === N - 1) stickers.push({ dir: 'R', color: getSticker(st, 'R', N - 1 - gz, N - 1 - gy) });
          if (gx === 0)     stickers.push({ dir: 'L', color: getSticker(st, 'L', N - 1 - gz, gy) });
          cubies.push({ gx, gy, gz, stickers });
        }
      }
    }
    return cubies;
  }

  // Rebuild cubies whenever state changes
  const cubies = $derived(buildCubies(cubeState));

  // ── Sticker quad geometry from grid position ──────────────────────

  function stickerQuad(gx: number, gy: number, gz: number, dir: FaceDir): V3[] {
    const g = G;
    switch (dir) {
      case 'U': return [
        [gx + g, gy + g, N], [gx + 1 - g, gy + g, N],
        [gx + 1 - g, gy + 1 - g, N], [gx + g, gy + 1 - g, N],
      ];
      case 'D': return [
        [gx + g, gy + 1 - g, 0], [gx + 1 - g, gy + 1 - g, 0],
        [gx + 1 - g, gy + g, 0], [gx + g, gy + g, 0],
      ];
      case 'F': return [
        [gx + g, N, gz + g], [gx + g, N, gz + 1 - g],
        [gx + 1 - g, N, gz + 1 - g], [gx + 1 - g, N, gz + g],
      ];
      case 'B': return [
        [gx + 1 - g, 0, gz + g], [gx + 1 - g, 0, gz + 1 - g],
        [gx + g, 0, gz + 1 - g], [gx + g, 0, gz + g],
      ];
      case 'R': return [
        [N, gy + 1 - g, gz + g], [N, gy + 1 - g, gz + 1 - g],
        [N, gy + g, gz + 1 - g], [N, gy + g, gz + g],
      ];
      case 'L': return [
        [0, gy + g, gz + g], [0, gy + g, gz + 1 - g],
        [0, gy + 1 - g, gz + 1 - g], [0, gy + 1 - g, gz + g],
      ];
    }
  }

  // ── Layer detection by grid position ──────────────────────────────

  function onLayer(cubie: Cubie, face: string): boolean {
    switch (face) {
      case 'U': return cubie.gz === N - 1;
      case 'D': return cubie.gz === 0;
      case 'R': return cubie.gx === N - 1;
      case 'L': return cubie.gx === 0;
      case 'F': return cubie.gy === N - 1;
      case 'B': return cubie.gy === 0;
      default: return false;
    }
  }

  // ── Rotation ──────────────────────────────────────────────────────

  function rotatePoint(p: V3, axis: 'x' | 'y' | 'z', angle: number): V3 {
    const center = N / 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    switch (axis) {
      case 'z': {
        const dx = p[0] - center, dy = p[1] - center;
        return [dx * c - dy * s + center, dx * s + dy * c + center, p[2]];
      }
      case 'x': {
        const dy = p[1] - center, dz = p[2] - center;
        return [p[0], dy * c - dz * s + center, dy * s + dz * c + center];
      }
      case 'y': {
        const dx = p[0] - center, dz = p[2] - center;
        return [dx * c + dz * s + center, p[1], -dx * s + dz * c + center];
      }
    }
  }

  function getRotation(face: string): { axis: 'x' | 'y' | 'z'; sign: number } {
    switch (face) {
      case 'U': return { axis: 'z', sign: -1 };
      case 'D': return { axis: 'z', sign: 1 };
      case 'R': return { axis: 'x', sign: 1 };
      case 'L': return { axis: 'x', sign: -1 };
      case 'F': return { axis: 'y', sign: 1 };
      case 'B': return { axis: 'y', sign: -1 };
      default: return { axis: 'z', sign: 1 };
    }
  }

  // ── Projection ────────────────────────────────────────────────────

  function project(p: V3): V2 {
    return [(p[0] - p[1]) / SQRT2, (p[0] + p[1] - 2 * p[2]) / SQRT6];
  }

  function cross2D(a: V2, b: V2, c: V2): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  // ── Render pipeline ───────────────────────────────────────────────

  type RenderedPoly = { points: string; fill: string; depth: number };

  const rendered = $derived.by((): RenderedPoly[] => {
    const baseFace = move ? move.replace(/[2']/g, '') : '';
    const isCCW = move ? move.includes("'") : false;
    const isDouble = move ? move.includes('2') : false;

    const rot = baseFace ? getRotation(baseFace) : null;
    const targetAngle = rot ? (Math.PI / 2) * rot.sign * (isDouble ? 2 : 1) * (isCCW ? -1 : 1) : 0;
    const angle = targetAngle * rotationProgress;

    const scale = size;
    const R = N + 0.5;
    const offsetX = R / SQRT2 * scale + 16;
    const offsetY = 2 * R / SQRT6 * scale + 16;

    const polys: RenderedPoly[] = [];

    for (const cubie of cubies) {
      const rotating = rot && baseFace && onLayer(cubie, baseFace);

      for (const sticker of cubie.stickers) {
        let corners = stickerQuad(cubie.gx, cubie.gy, cubie.gz, sticker.dir);

        if (rotating) {
          corners = corners.map(p => rotatePoint(p, rot.axis, angle));
        }

        const proj = corners.map(p => project(p));
        const screen = proj.map(p => [p[0] * scale + offsetX, p[1] * scale + offsetY] as V2);

        const w = cross2D(screen[0]!, screen[1]!, screen[2]!);
        if (w <= 0) continue;

        const depth = proj.reduce((s, p) => s + p[1], 0) / 4;

        polys.push({
          points: screen.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
          fill: COLOR_HEX[sticker.color],
          depth,
        });
      }
    }

    polys.sort((a, b) => b.depth - a.depth);
    return polys;
  });

  const VB_W = $derived(2 * (N + 0.5) / SQRT2 * size + 32);
  const VB_H = $derived(4 * (N + 0.5) / SQRT6 * size + 32);
</script>

<svg viewBox="0 0 {VB_W} {VB_H}" width={VB_W} height={VB_H} class="rubiks-cube">
  {#each rendered as poly, i (i)}
    <polygon points={poly.points} fill={poly.fill} stroke="var(--ink)" stroke-width="1.5" />
  {/each}
</svg>

<style>
  .rubiks-cube {
    display: block;
  }
</style>
