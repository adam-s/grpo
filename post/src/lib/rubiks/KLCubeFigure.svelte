<script lang="ts">
  /**
   * KLCubeFigure — teaches KL divergence as the *directional* mismatch
   * between two overlapping move distributions.
   *
   * Two Gaussians over 13 move bins: reference π_ref (blue cubes, front,
   * broader and shorter) and drifted active policy π_θ (red cubes, back,
   * narrower and taller). Three layered cues make the divergence legible:
   *
   *   1. Directional shading — warm (amber) where π_θ exceeds π_ref,
   *      cool (blue) where π_ref exceeds π_θ. Asymmetry is the story.
   *   2. Δμ drift arrow — dimension-line annotation between peak centers,
   *      visualising how far the mean has wandered.
   *   3. Per-move KL-contribution strip — vertical ticks below the axis,
   *      height ∝ |θ·log(θ/ref)|, red where θ>ref, blue where ref>θ.
   *      The "fingerprint" of the scalar KL.
   */
  import { COLOR_HEX, type Color } from './cube';

  // ── Distribution parameters ──────────────────────────────────────────
  const N_BINS = 13;

  const REF_MU = 5.2;
  const REF_SIG = 1.9;
  const REF_MAX_H = 4;

  const THETA_MU = 7.5;
  const THETA_SIG = 1.4;
  const THETA_MAX_H = 7;

  // Unnormalised Gaussian kernel. `pmf()` renormalises over the 13 discrete
  // bins, so the KL strip below is the KL between two truncated-and-renormalised
  // discrete distributions — an illustrative fingerprint, not the scalar per-
  // token KL the loss actually computes.
  function gauss(x: number, mu: number, sigma: number): number {
    return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
  }

  function heights(mu: number, sigma: number, maxH: number): number[] {
    const raw = Array.from({ length: N_BINS }, (_, i) => gauss(i, mu, sigma));
    const mx = Math.max(...raw);
    return raw.map((v) => Math.round((v / mx) * maxH));
  }

  function pmf(mu: number, sigma: number): number[] {
    const raw = Array.from({ length: N_BINS }, (_, i) => gauss(i, mu, sigma));
    const s = raw.reduce((a, b) => a + b, 0);
    return raw.map((v) => v / s);
  }

  const refH = heights(REF_MU, REF_SIG, REF_MAX_H);
  const thetaH = heights(THETA_MU, THETA_SIG, THETA_MAX_H);

  // Per-bin KL contribution θ·log(θ/ref). Positive ⇒ θ overweights; negative ⇒ underweights.
  const thetaPmf = pmf(THETA_MU, THETA_SIG);
  const refPmf = pmf(REF_MU, REF_SIG);
  const klPerBin = thetaPmf.map((p, i) => {
    const q = refPmf[i];
    if (p < 1e-9 || q < 1e-9) return 0;
    return p * Math.log(p / q);
  });
  const klMaxMag = Math.max(...klPerBin.map((v) => Math.abs(v))) || 1;

  // ── Geometry ─────────────────────────────────────────────────────────
  const CUBE = 22;
  const CELL = CUBE / 3;
  const BIN_GAP = 5;
  const STACK_GAP = 2;
  const PAD_X = 26;
  const PAD_TOP = 48;
  const PAD_BOT = 48;

  const binW = CUBE + BIN_GAP;
  const innerW = N_BINS * binW - BIN_GAP;
  const maxStackPx = THETA_MAX_H * CUBE + (THETA_MAX_H - 1) * STACK_GAP;
  const axisY = PAD_TOP + maxStackPx;
  const VB_W = innerW + PAD_X * 2;
  const VB_H = axisY + PAD_BOT;

  const stackPx = (n: number) => n * CUBE + Math.max(0, n - 1) * STACK_GAP;

  // Dense sampling of both Gaussians for smooth curves + sliver shading.
  const SAMPLES = 180;
  type CurveSample = { x: number; refY: number; thetaY: number };
  function sampleCurves(): CurveSample[] {
    const xStart = PAD_X;
    const xEnd = innerW + PAD_X;
    const peakRef = stackPx(REF_MAX_H);
    const peakTheta = stackPx(THETA_MAX_H);
    const pts: CurveSample[] = [];
    for (let k = 0; k <= SAMPLES; k++) {
      const x = xStart + (k / SAMPLES) * (xEnd - xStart);
      const binIdx = (x - PAD_X - CUBE / 2) / binW;
      const refY = axisY - peakRef * gauss(binIdx, REF_MU, REF_SIG);
      const thetaY = axisY - peakTheta * gauss(binIdx, THETA_MU, THETA_SIG);
      pts.push({ x, refY, thetaY });
    }
    return pts;
  }
  const samples = sampleCurves();

  function curvePath(key: 'refY' | 'thetaY'): string {
    let d = '';
    for (let k = 0; k < samples.length; k++) {
      const p = samples[k];
      d += (k === 0 ? 'M' : 'L') + `${p.x.toFixed(1)},${p[key].toFixed(1)} `;
    }
    return d;
  }

  // Directional shading. SVG y is inverted: θ "above" ref ⇔ thetaY < refY.
  // Build slivers between consecutive samples so each region is tinted
  // according to which curve is higher at that slice.
  function buildDirectionalShading(): { warm: string; cool: string } {
    let warm = '';
    let cool = '';
    for (let k = 0; k < samples.length - 1; k++) {
      const a = samples[k];
      const b = samples[k + 1];
      const ax = a.x.toFixed(2);
      const bx = b.x.toFixed(2);
      if (a.thetaY <= a.refY && b.thetaY <= b.refY) {
        warm += `M${ax},${a.thetaY.toFixed(2)} L${bx},${b.thetaY.toFixed(2)} L${bx},${b.refY.toFixed(2)} L${ax},${a.refY.toFixed(2)} Z `;
      } else if (a.thetaY > a.refY && b.thetaY > b.refY) {
        cool += `M${ax},${a.refY.toFixed(2)} L${bx},${b.refY.toFixed(2)} L${bx},${b.thetaY.toFixed(2)} L${ax},${a.thetaY.toFixed(2)} Z `;
      }
    }
    return { warm, cool };
  }
  const { warm: warmShade, cool: coolShade } = buildDirectionalShading();

  const thetaCurve = curvePath('thetaY');
  const refCurve = curvePath('refY');

  // Solid-face sticker patterns.
  const BLUE_PATTERN: Color[] = ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B'];
  const RED_PATTERN:  Color[] = ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R'];

  // Peak x positions.
  const thetaPeakBin = thetaH.indexOf(Math.max(...thetaH));
  const refPeakBin = refH.indexOf(Math.max(...refH));
  const thetaPeakX = PAD_X + thetaPeakBin * binW + CUBE / 2;
  const refPeakX = PAD_X + refPeakBin * binW + CUBE / 2;

  // Δμ drift-arrow geometry (dimension-line style: arrowheads out, text in break).
  const ARROW_Y = 26;
  const ARROW_MID_X = (refPeakX + thetaPeakX) / 2;
  const ARROW_INSET = 2;
  const ARROW_TEXT_HALF = 9;
  const ARROW_HEAD_LEN = 4;
  const ARROW_HEAD_HALF = 2.5;
  const leftTip = refPeakX + ARROW_INSET;
  const rightTip = thetaPeakX - ARROW_INSET;

  // KL contribution strip below axis.
  const STRIP_TOP = axisY + 5;
  const STRIP_H = 20;
  const TICK_W = CUBE * 0.58;
</script>

<figure class="kl-fig">
  <svg viewBox="0 0 {VB_W} {VB_H}" class="kl-svg" role="img"
       aria-label="KL divergence between reference and active policy distributions">

    <!-- directional shading: cool (ref > θ) behind warm (θ > ref) -->
    <path d={coolShade} fill={COLOR_HEX.B} fill-opacity="0.14" stroke="none" />
    <path d={warmShade} fill="#e6b94a" fill-opacity="0.55" stroke="none" />

    <!-- back: π_θ cube stacks (red, taller) -->
    {#each thetaH as h, i}
      {#each { length: h } as _, s}
        {@const y = axisY - (s + 1) * CUBE - s * STACK_GAP}
        <g transform="translate({PAD_X + i * binW}, {y})">
          {#each RED_PATTERN as col, k}
            <rect
              x={(k % 3) * CELL + 0.6} y={Math.floor(k / 3) * CELL + 0.6}
              width={CELL - 1.2} height={CELL - 1.2}
              fill={COLOR_HEX[col]} rx="0.8"
            />
          {/each}
          <rect x="0.3" y="0.3" width={CUBE - 0.6} height={CUBE - 0.6}
                fill="none" stroke="#1a1a1a" stroke-width="0.8" rx="2" opacity="0.85" />
        </g>
      {/each}
    {/each}

    <!-- front: π_ref cube stacks (blue, shorter) -->
    {#each refH as h, i}
      {#each { length: h } as _, s}
        {@const y = axisY - (s + 1) * CUBE - s * STACK_GAP}
        <g transform="translate({PAD_X + i * binW}, {y})">
          {#each BLUE_PATTERN as col, k}
            <rect
              x={(k % 3) * CELL + 0.6} y={Math.floor(k / 3) * CELL + 0.6}
              width={CELL - 1.2} height={CELL - 1.2}
              fill={COLOR_HEX[col]} rx="0.8"
            />
          {/each}
          <rect x="0.3" y="0.3" width={CUBE - 0.6} height={CUBE - 0.6}
                fill="none" stroke="#1a1a1a" stroke-width="0.8" rx="2" opacity="0.85" />
        </g>
      {/each}
    {/each}

    <!-- smooth Gaussian curves -->
    <path d={thetaCurve} fill="none" stroke={COLOR_HEX.R}
          stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    <path d={refCurve} fill="none" stroke={COLOR_HEX.B}
          stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />

    <!-- Δμ drift annotation: dimension-line arrow between peak centers -->
    <line x1={leftTip} y1={ARROW_Y} x2={ARROW_MID_X - ARROW_TEXT_HALF} y2={ARROW_Y}
          stroke="var(--ink-subtle)" stroke-width="1" />
    <line x1={ARROW_MID_X + ARROW_TEXT_HALF} y1={ARROW_Y} x2={rightTip} y2={ARROW_Y}
          stroke="var(--ink-subtle)" stroke-width="1" />
    <polygon
      points="{leftTip},{ARROW_Y} {leftTip + ARROW_HEAD_LEN},{ARROW_Y - ARROW_HEAD_HALF} {leftTip + ARROW_HEAD_LEN},{ARROW_Y + ARROW_HEAD_HALF}"
      fill="var(--ink-subtle)" />
    <polygon
      points="{rightTip},{ARROW_Y} {rightTip - ARROW_HEAD_LEN},{ARROW_Y - ARROW_HEAD_HALF} {rightTip - ARROW_HEAD_LEN},{ARROW_Y + ARROW_HEAD_HALF}"
      fill="var(--ink-subtle)" />
    <text x={ARROW_MID_X} y={ARROW_Y + 3}
          text-anchor="middle"
          font-family="var(--font-serif)" font-style="italic" font-size="11"
          font-weight="600" fill="var(--ink)">Δμ</text>

    <!-- per-bell labels -->
    <text x={thetaPeakX} y={axisY - stackPx(THETA_MAX_H) - 6}
          text-anchor="middle"
          font-family="var(--font-mono)" font-size="9" font-weight="500"
          fill={COLOR_HEX.R}>π_θ · active</text>
    <text x={refPeakX} y={axisY - stackPx(REF_MAX_H) - 6}
          text-anchor="middle"
          font-family="var(--font-mono)" font-size="9" font-weight="500"
          fill={COLOR_HEX.B}>π_ref · reference</text>

    <!-- axis -->
    <line x1={PAD_X - 6} y1={axisY} x2={innerW + PAD_X + 6} y2={axisY}
          stroke="var(--ink-faded)" stroke-width="1.2" />

    <!-- per-move KL contribution strip (the "fingerprint" of the scalar KL) -->
    {#each klPerBin as kl, i}
      {@const mag = Math.abs(kl) / klMaxMag}
      {@const barH = Math.max(1, mag * STRIP_H)}
      {@const cx = PAD_X + i * binW + CUBE / 2}
      <rect
        x={cx - TICK_W / 2}
        y={STRIP_TOP}
        width={TICK_W}
        height={barH}
        fill={kl >= 0 ? COLOR_HEX.R : COLOR_HEX.B}
        opacity="0.78"
        rx="0.8"
      />
    {/each}

    <!-- strip labels -->
    <text x={PAD_X - 6} y={STRIP_TOP + STRIP_H + 10}
          font-family="var(--font-mono)" font-size="8" fill="var(--ink-subtle)">
      per-move KL contribution
    </text>
    <text x={innerW + PAD_X + 6} y={STRIP_TOP + STRIP_H + 10}
          text-anchor="end"
          font-family="var(--font-mono)" font-size="8" fill="var(--ink-subtle)">
      moves →
    </text>
  </svg>
</figure>

<style>
  .kl-fig {
    margin: var(--space-xl) auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 720px;
    width: 100%;
  }

  .kl-svg {
    width: 100%;
    height: auto;
    display: block;
  }
</style>
