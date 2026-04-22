<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { loadWeightsSeries, getInterpolatedDeltaAt } from '../../viz/weightsSeries';
  import { featuredStep } from '../../stores/grpo';
  import { archBoxes, columns, arrowPairs, viewW, viewH, type LaidOutBox } from '../../viz/modelDiagramLayout';

  // ── RdBu lookup table ─────────────────────────────────────────────────
  const RDBU_LUT = (() => {
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const c = d3.rgb(d3.interpolateRdBu(i / 255));
      lut[i * 3] = c.r | 0;
      lut[i * 3 + 1] = c.g | 0;
      lut[i * 3 + 2] = c.b | 0;
    }
    return lut;
  })();
  const RDBU_CSS = (() => {
    const arr = new Array<string>(256);
    for (let i = 0; i < 256; i++) {
      arr[i] = `rgb(${RDBU_LUT[i * 3]},${RDBU_LUT[i * 3 + 1]},${RDBU_LUT[i * 3 + 2]})`;
    }
    return arr;
  })();

  const GAMMA = 0.5;

  // ── Scene (pseudo-3D projection) ──────────────────────────────────────
  // Each point has a 3D world coordinate (x, y, z) in viewBox units.
  // The scene rotates about its center on Y (yaw) then X (pitch), then
  // projects to screen via similar triangles: scale = CAM_DIST / (CAM_DIST + z).
  const CAM_DIST = 1400;  // viewBox units; lower = stronger perspective
  // CNN-style stack: every matrix shares the same (x, y), separated only by
  // z. Default global yaw ~75° lets us view the deck from the side, so the
  // stack reads as a row of layered planes rather than one matrix hiding
  // the rest. Both rotations are reactive: shift+drag in the viewport
  // mutates them so the user can orbit the camera.
  // Flat-row defaults: zero rotation. Cards face the camera head-on.
  // User can still orbit via shift+drag if they want to introduce 3D.
  const ROT_Y_DEFAULT = 0;
  const ROT_X_DEFAULT = 0;
  const BOX_YAW  = 0;     // per-box rotation disabled — uniform scene
  // Rotation pivot (yaw axis = vertical line at PIVOT_X; pitch axis =
  // horizontal line at PIVOT_Y). At (0, 0), both axes hinge on the top-
  // left corner of the viewBox. Declared early so layout constants below
  // can derive auto-center pan defaults from them.
  const PIVOT_X = 0;
  const PIVOT_Y = 0;

  // Architectural columnar layout — mirrors the DAG declared in
  // modelDiagramLayout.ts. 6 columns: [embed], [Q,K,V], [W_O], [Gate,Up],
  // [Down], [Norm]. Cards within a column stack vertically (parallel
  // attention heads / parallel FFN paths). Connector lines between columns
  // follow the `arrowPairs` directed edges, so the rendering reflects the
  // code's data-flow truth, not just a flat row.
  const COLUMN_BASE_X    = 100;   // world-x of column 0's left edge
  const COLUMN_GAP       = 100;   // horizontal gap between adjacent columns
  const COLUMN_INNER_GAP = 50;    // vertical gap between cards in a column
  const ANCHOR_Y         = 320;   // vertical center for column stacks
  const SLOT_BASE_Z = 0;          // flat — every card at z=0
  const SLOT_Z_STEP = 0;

  type ColLayout = { x: number; cardCenterY: Map<string, number> };
  const COLUMN_LAYOUTS: ColLayout[] = (() => {
    const byId = new Map(archBoxes.map((b) => [b.id, b]));
    const out: ColLayout[] = [];
    let cursor = COLUMN_BASE_X;
    for (const colIds of columns) {
      const colCards = colIds.map((id) => byId.get(id)!);
      const colMaxW = Math.max(...colCards.map((c) => c.w));
      const totalH =
        colCards.reduce((s, c) => s + c.h, 0) +
        (colCards.length - 1) * COLUMN_INNER_GAP;

      const startY = ANCHOR_Y - totalH / 2;
      let yCursor = startY;
      const cardCenterY = new Map<string, number>();
      for (const card of colCards) {
        cardCenterY.set(card.id, yCursor + card.h / 2);
        yCursor += card.h + COLUMN_INNER_GAP;
      }

      out.push({ x: cursor + colMaxW / 2, cardCenterY });
      cursor += colMaxW + COLUMN_GAP;
    }
    return out;
  })();

  // World bounding box of all cards — drives the auto-fit zoom AND the
  // auto-center pan defaults so the diagram lands in the middle of the
  // viewport regardless of which cards happen to dominate the layout.
  const WORLD_BBOX = (() => {
    const byId = new Map(archBoxes.map((b) => [b.id, b]));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let colIdx = 0;
    for (const colIds of columns) {
      const colLayout = COLUMN_LAYOUTS[colIdx++];
      for (const id of colIds) {
        const c = byId.get(id)!;
        const cx = colLayout.x;
        const cy = colLayout.cardCenterY.get(id)!;
        minX = Math.min(minX, cx - c.w / 2);
        maxX = Math.max(maxX, cx + c.w / 2);
        minY = Math.min(minY, cy - c.h / 2);
        maxY = Math.max(maxY, cy + c.h / 2);
      }
    }
    return { minX, maxX, minY, maxY };
  })();
  const WORLD_W = WORLD_BBOX.maxX - WORLD_BBOX.minX;
  const WORLD_H = WORLD_BBOX.maxY - WORLD_BBOX.minY;
  const WORLD_CX = (WORLD_BBOX.minX + WORLD_BBOX.maxX) / 2;
  const WORLD_CY = (WORLD_BBOX.minY + WORLD_BBOX.maxY) / 2;
  // Fit BOTH dimensions with a small margin, then pan so the world centroid
  // maps to the viewport centroid (assuming no rotation, no perspective).
  // 0.97 leaves only a 3% margin inside the stage so the diagram sits
  // close to the surrounding prose rhythm.
  const DEFAULT_ZOOM = 0.97 * Math.min(viewW / WORLD_W, viewH / WORLD_H);
  const DEFAULT_PAN_X = viewW / 2 - PIVOT_X - WORLD_CX * DEFAULT_ZOOM;
  const DEFAULT_PAN_Y = viewH / 2 - PIVOT_Y - WORLD_CY * DEFAULT_ZOOM;

  // Distance fog — back cards fade toward the cream background as a cheap
  // depth cue. Applied once per card via ctx.globalAlpha in paint().
  const FOG_FAR      = SLOT_BASE_Z;
  const FOG_STRENGTH = 0.35;

  // Reactive yaw/pitch — shift+drag mutates these so the user can orbit.
  let ROT_Y = $state(ROT_Y_DEFAULT);
  let ROT_X = $state(ROT_X_DEFAULT);
  const COS_Y = $derived(Math.cos(ROT_Y));
  const SIN_Y = $derived(Math.sin(ROT_Y));
  const COS_X = $derived(Math.cos(ROT_X));
  const SIN_X = $derived(Math.sin(ROT_X));

  /**
   * Project (x, y, z) in world coords to (screenX, screenY) in viewBox coords.
   * Rotation pivot is (PIVOT_X, PIVOT_Y, 0). The vertical line x=PIVOT_X
   * is the yaw axis; the horizontal line y=PIVOT_Y is the pitch axis.
   * With both at 0 the entire stack hinges on the viewport's top-left.
   * Final pass applies user `zoom` (about pivot) and `panX`/`panY`.
   */
  function projectXY(x: number, y: number, z: number): [number, number] {
    const px = x - PIVOT_X;
    const py = y - PIVOT_Y;
    const x1 = px * COS_Y - z  * SIN_Y;
    const z1 = px * SIN_Y + z  * COS_Y;
    const y2 = py * COS_X - z1 * SIN_X;
    const z2 = py * SIN_X + z1 * COS_X;
    // Perspective division — toggleable via the `perspective` flag. When
    // false, scale=1 so cards render at uniform size regardless of depth
    // (orthographic projection). Useful when wide cards span large z
    // deltas and the per-card warping becomes the visual story.
    const scale = perspective ? CAM_DIST / (CAM_DIST + z2) : 1;
    return [
      PIVOT_X + x1 * scale * zoom + panX,
      PIVOT_Y + y2 * scale * zoom + panY,
    ];
  }

  /**
   * Project (wx, wy, z) with a local yaw applied about a vertical axis at
   * x = pivotX (the box's own center line). Used so each per-block box
   * gets its own 3D rotation without affecting the rest of the scene.
   */
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

  /** Yaw applied to a given box. Global boxes (embed / norm) stay flat. */
  function yawFor(box: LaidOutBox): number {
    return isGlobalBox(box.id) ? 0 : BOX_YAW;
  }

  // ── Multi-head structure ──────────────────────────────────────────────
  const N_HEADS = 4;
  const HEAD_SPLIT_ROWS = new Set(['wq', 'wk', 'wv']);
  const HEAD_SPLIT_COLS = new Set(['wo']);

  // ── State ─────────────────────────────────────────────────────────────
  let weightsLoaded = $state(false);
  let hoveredCell: { label: string; blockIdx: 0 | 1 | null; r: number; c: number; v: number; dv: number } | null = $state(null);
  let mouseX = $state(0);
  let mouseY = $state(0);
  let winW = $state(typeof window !== 'undefined' ? window.innerWidth : 9999);
  let svgEl: SVGSVGElement | undefined = $state();
  let canvasEl: HTMLCanvasElement | undefined = $state();
  let stageEl: HTMLDivElement | undefined = $state();
  // Cached SVG client rect — recomputed on resize and scroll so we never
  // call getBoundingClientRect() inside the hot pointermove path.
  let svgRect: DOMRect | null = null;

  // ── Camera controls (zoom + pan, viewBox-space) ──────────────────────
  // Applied after perspective division in projectXY. Zoom is centered on
  // (CX, CY); pan is a free 2D translation in viewBox units.
  let panX = $state(DEFAULT_PAN_X);
  let panY = $state(DEFAULT_PAN_Y);
  let zoom = $state(DEFAULT_ZOOM);
  // When false, projectXY skips the perspective division (scale = 1):
  // all cards render at the same on-screen size regardless of depth.
  // Removes per-card warping caused by wide cards spanning large z deltas.
  // Default off for the flat-row baseline; toggle the `O`/`P` button.
  let perspective = $state(false);
  let isDragging = $state(false);
  let dragMode: 'pan' | 'orbit' = 'pan';
  let dragStart:
    | { x: number; y: number; panX: number; panY: number; rotX: number; rotY: number }
    | null = null;

  // Master switch for camera gestures. When false, drag/wheel/orbit are
  // no-ops and the cam-controls UI is hidden. Hover-based cell tooltip
  // remains active because it's not a camera gesture.
  const INTERACTIVE = false;

  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 4;
  const ZOOM_STEP_BTN = 1.25;
  const ZOOM_STEP_WHEEL = 1.1;
  // Drag-pixel → radian sensitivity for orbit. ~0.005 rad/px means a
  // ~600px drag spans full 180° of yaw — comfortable for trackpad+mouse.
  const ORBIT_SENSITIVITY = 0.005;
  // Clamp pitch so the user can't flip the scene upside down (gimbal-style).
  const PITCH_MIN = -1.2;
  const PITCH_MAX = 1.2;

  const TOOLTIP_W = 280;
  let tooltipStyle = $derived(
    mouseX + TOOLTIP_W + 16 > winW
      ? `right:${winW - mouseX + 8}px; top:${mouseY - 8}px;`
      : `left:${mouseX + 12}px; top:${mouseY - 8}px;`
  );

  // ── Weight lookup ─────────────────────────────────────────────────────
  type BoxWeights = {
    rows: number; cols: number;
    values: Float64Array | number[]; delta: Float64Array | number[];
    absMax: number;
  };
  type RenderBox = {
    /** Box with position normalized to a uniform display rect at scene center. */
    box: LaidOutBox;
    /** Unmodified original box — source of intrinsic dims and id. */
    origBox: LaidOutBox;
    /** Depth slice in the stack — deeper = further from camera. */
    stackZ: number;
    /** null for global boxes (embed, norm); 0 or 1 for transformer blocks. */
    blockIdx: 0 | 1 | null;
    /** Weights for THIS card (one block's worth, or the global tensor). */
    w: BoxWeights | null;
    /** Color scale shared across paired cards so block 0 and block 1 line up. */
    sharedAbsMax: number;
    isGlobal: boolean;
    isFlat: boolean;
    dispCols: number;
    dispRows: number;
    cellW: number;
    cellH: number;
  };

  function isGlobalBox(boxId: string): boolean {
    return boxId === 'embed' || boxId === 'norm';
  }

  function weightKey(boxId: string, blockIdx: number): string {
    const p = `blocks.${blockIdx}`;
    const map: Record<string, string> = {
      embed: 'embed.weight',
      wq: `${p}.attn.q.weight`, wk: `${p}.attn.k.weight`,
      wv: `${p}.attn.v.weight`, wo: `${p}.attn.o.weight`,
      gate: `${p}.ffn.gate.weight`, up: `${p}.ffn.up.weight`, down: `${p}.ffn.down.weight`,
      norm: 'final_norm.weight',
    };
    return map[boxId] ?? '';
  }

  function fetchWeights(key: string, step: number): BoxWeights | null {
    if (!weightsLoaded) return null;
    const snap = getInterpolatedDeltaAt(key, step);
    if (!snap) return null;
    const [rows, cols] = snap.shape.length === 2
      ? [snap.shape[0], snap.shape[1]]
      : [1, snap.shape[0]];
    return { rows, cols, values: snap.values, delta: snap.delta, absMax: snap.absMax };
  }

  const renderBoxes = $derived.by<RenderBox[]>(() => {
    const step = $featuredStep;
    void weightsLoaded;
    const out: RenderBox[] = [];
    const byId = new Map(archBoxes.map((b) => [b.id, b]));

    let colIdx = 0;
    for (const colIds of columns) {
      const colLayout = COLUMN_LAYOUTS[colIdx];
      for (const cardId of colIds) {
        const origBox = byId.get(cardId);
        if (!origBox) { colIdx++; continue; }
        const global = isGlobalBox(origBox.id);

        const w = fetchWeights(weightKey(origBox.id, 0), step);
        const sharedAbsMax = Math.max(1e-9, w?.absMax ?? 0);

        const slotX = PIVOT_X + colLayout.x;
        const slotY = PIVOT_Y + colLayout.cardCenterY.get(cardId)!;
        const slotZ = SLOT_BASE_Z - colIdx * SLOT_Z_STEP;

        const box: LaidOutBox = {
          ...origBox,
          x: slotX - origBox.w / 2,
          y: slotY - origBox.h / 2,
          w: origBox.w,
          h: origBox.h,
        };

        if (!w) {
          out.push({
            box, origBox, stackZ: slotZ, blockIdx: null,
            w: null, sharedAbsMax,
            isGlobal: global, isFlat: false,
            dispCols: 0, dispRows: 0, cellW: 0, cellH: 0,
          });
          continue;
        }
        const isFlat = w.rows === 1;
        const isVert = origBox.vertical;
        const dispCols = isVert ? 1 : (isFlat ? 16 : w.cols);
        const dispRows = isVert ? w.cols : (isFlat ? Math.ceil(w.cols / 16) : w.rows);
        out.push({
          box, origBox, stackZ: slotZ, blockIdx: null,
          w, sharedAbsMax,
          isGlobal: global, isFlat,
          dispCols, dispRows,
          cellW: box.w / dispCols,
          cellH: box.h / dispRows,
        });
      }
      colIdx++;
    }
    return out;
  });

  /**
   * Per-box projected geometry, recomputed whenever renderBoxes changes.
   * Keyed by box id. Stores:
   *   - `frontCorners` — projected corners [TL, TR, BR, BL] in screen
   *     viewBox coords, used by the inverse-bilinear hit-test.
   *   - `labelXY` — projected center of the label origin (box bottom-center
   *     in world space at z=0) so the SVG labels sit under the projected
   *     front face even when the scene tilts.
   *   - `dataCardXY` — the projected position used by PipelineArrows' query
   *     for `[data-card="embed"]` / `[data-card="norm"]`. Projected at the
   *     box center at z=0.
   */
  type BoxProj = {
    frontCorners: [[number, number], [number, number], [number, number], [number, number]];
    labelXY: [number, number];
    dataCardXY: [number, number];
  };

  /** Key for boxProjections — paired blocks need distinct entries. */
  function projKey(id: string, blockIdx: 0 | 1 | null): string {
    return `${id}-${blockIdx ?? 'g'}`;
  }

  const boxProjections = $derived.by<Record<string, BoxProj>>(() => {
    const out: Record<string, BoxProj> = {};
    for (const rb of renderBoxes) {
      const box = rb.box;
      const x0 = box.x, y0 = box.y, x1 = box.x + box.w, y1 = box.y + box.h;
      const pivot = box.x + box.w / 2;
      const yaw = yawFor(box);
      const z = rb.stackZ;
      out[projKey(box.id, rb.blockIdx)] = {
        frontCorners: [
          projectWithYaw(x0, y0, z, pivot, yaw),
          projectWithYaw(x1, y0, z, pivot, yaw),
          projectWithYaw(x1, y1, z, pivot, yaw),
          projectWithYaw(x0, y1, z, pivot, yaw),
        ],
        labelXY: projectWithYaw(pivot, y1, z, pivot, yaw),
        dataCardXY: projectWithYaw(pivot, box.y + box.h / 2, z, pivot, yaw),
      };
    }
    return out;
  });

  // ── Paint helpers ─────────────────────────────────────────────────────
  function deltaLutIndex(dv: number, absMax: number): number {
    const t = Math.max(-1, Math.min(1, dv / absMax));
    const signedMag = Math.sign(t) * Math.pow(Math.abs(t), GAMMA);
    const v = 0.5 - 0.5 * signedMag;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  }

  /**
   * Project the (dispRows+1)x(dispCols+1) vertex grid for one plane at depth
   * `z`. Returns a flat Float32Array of [x0,y0,x1,y1,...] in row-major order
   * so cell (r,c) reads its 4 corners at indices:
   *   TL = 2 * ((r    ) * (dispCols+1) + c    )
   *   TR = 2 * ((r    ) * (dispCols+1) + c + 1)
   *   BR = 2 * ((r + 1) * (dispCols+1) + c + 1)
   *   BL = 2 * ((r + 1) * (dispCols+1) + c    )
   */
  function projectGrid(rb: RenderBox, z: number): Float32Array {
    const { box, dispRows, dispCols, cellW, cellH } = rb;
    const stride = dispCols + 1;
    const verts = new Float32Array((dispRows + 1) * stride * 2);
    const pivot = box.x + box.w / 2;
    const yaw = yawFor(box);
    for (let r = 0; r <= dispRows; r++) {
      const wy = box.y + r * cellH;
      for (let c = 0; c <= stride - 1; c++) {
        const wx = box.x + c * cellW;
        const [sx, sy] = projectWithYaw(wx, wy, z, pivot, yaw);
        const i = 2 * (r * stride + c);
        verts[i] = sx;
        verts[i + 1] = sy;
      }
    }
    return verts;
  }

  function fillCells(
    ctx: CanvasRenderingContext2D,
    rb: RenderBox,
    w: BoxWeights,
    verts: Float32Array,
  ): void {
    const { isFlat, dispRows, dispCols, sharedAbsMax } = rb;
    const stride = dispCols + 1;
    for (let r = 0; r < dispRows; r++) {
      const rowTop = r * stride;
      const rowBot = (r + 1) * stride;
      for (let c = 0; c < dispCols; c++) {
        const idx = isFlat ? r * dispCols + c : r * w.cols + c;
        if (idx >= w.values.length) continue;
        const tl = 2 * (rowTop + c);
        const tr = 2 * (rowTop + c + 1);
        const br = 2 * (rowBot + c + 1);
        const bl = 2 * (rowBot + c);
        ctx.fillStyle = RDBU_CSS[deltaLutIndex(w.delta[idx], sharedAbsMax)];
        ctx.beginPath();
        ctx.moveTo(verts[tl], verts[tl + 1]);
        ctx.lineTo(verts[tr], verts[tr + 1]);
        ctx.lineTo(verts[br], verts[br + 1]);
        ctx.lineTo(verts[bl], verts[bl + 1]);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /** Back-layer outline (projected box quad stroked in box color). */
  function strokePlaneOutline(
    ctx: CanvasRenderingContext2D,
    box: LaidOutBox,
    z: number,
    color: string,
    alpha: number,
    width: number,
  ): void {
    const x0 = box.x, y0 = box.y, x1 = box.x + box.w, y1 = box.y + box.h;
    const pivot = box.x + box.w / 2;
    const yaw = yawFor(box);
    const [ax, ay] = projectWithYaw(x0, y0, z, pivot, yaw);
    const [bx, by] = projectWithYaw(x1, y0, z, pivot, yaw);
    const [cx, cy] = projectWithYaw(x1, y1, z, pivot, yaw);
    const [dx, dy] = projectWithYaw(x0, y1, z, pivot, yaw);
    // Compose with current globalAlpha so caller-set fog is preserved.
    const prevAlpha = ctx.globalAlpha;
    ctx.strokeStyle = color;
    ctx.globalAlpha = prevAlpha * alpha;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.lineTo(dx, dy);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = prevAlpha;
  }

  /** Per-head dividers on the front face, projected at the box's stackZ. */
  function paintHeadDividers(ctx: CanvasRenderingContext2D, rb: RenderBox): void {
    if (rb.isGlobal || !rb.w) return;
    const { box } = rb;
    const splitRows = HEAD_SPLIT_ROWS.has(box.id);
    const splitCols = HEAD_SPLIT_COLS.has(box.id);
    if (!splitRows && !splitCols) return;
    const pivot = box.x + box.w / 2;
    const yaw = yawFor(box);
    const z = rb.stackZ;
    ctx.strokeStyle = 'rgba(25,25,25,0.6)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    if (splitRows) {
      const rowsPerHead = rb.dispRows / N_HEADS;
      for (let h = 1; h < N_HEADS; h++) {
        const y = box.y + h * rowsPerHead * rb.cellH;
        const [ax, ay] = projectWithYaw(box.x, y, z, pivot, yaw);
        const [bx, by] = projectWithYaw(box.x + box.w, y, z, pivot, yaw);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
    }
    if (splitCols) {
      const colsPerHead = rb.dispCols / N_HEADS;
      for (let h = 1; h < N_HEADS; h++) {
        const x = box.x + h * colsPerHead * rb.cellW;
        const [ax, ay] = projectWithYaw(x, box.y, z, pivot, yaw);
        const [bx, by] = projectWithYaw(x, box.y + box.h, z, pivot, yaw);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
    }
    ctx.stroke();
  }

  function fogAlphaForZ(z: number): number {
    const t = Math.min(1, Math.max(0, z / FOG_FAR));
    return 1 - t * FOG_STRENGTH;
  }

/** Map from origBox.id → RenderBox, rebuilt only when renderBoxes changes. */
  const cardById = $derived.by(() => {
    const m = new Map<string, RenderBox>();
    for (const rb of renderBoxes) m.set(rb.origBox.id, rb);
    return m;
  });

/**
   * Draw the architectural connector lines (arrowPairs from
   * modelDiagramLayout.ts) — one Bezier per directed edge, from the
   * source card's right-edge-center to the target's left-edge-center.
   * Reflects the actual data-flow DAG declared in code.
   */
  function paintConnectors(ctx: CanvasRenderingContext2D): void {

    ctx.save();
    ctx.strokeStyle = 'rgba(120,120,120,0.45)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (const [fromId, toId] of arrowPairs) {
      const from = cardById.get(fromId);
      const to = cardById.get(toId);
      if (!from || !to) continue;
      const fx = from.box.x + from.box.w;
      const fy = from.box.y + from.box.h / 2;
      const tx = to.box.x;
      const ty = to.box.y + to.box.h / 2;
      const [sx, sy] = projectXY(fx, fy, from.stackZ);
      const [ex, ey] = projectXY(tx, ty, to.stackZ);
      const midX = (sx + ex) / 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(midX, sy, midX, ey, ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paint(): void {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    const margin = 400;
    ctx.clearRect(-margin, -margin, viewW + 2 * margin, viewH + 2 * margin);

    // Connectors first so the cards paint on top of the wire ends.
    paintConnectors(ctx);

    // Back-to-front so nearer cards overdraw farther ones (painter's
    // algorithm). Largest stackZ paints first.
    const order = [...renderBoxes].sort((a, b) => b.stackZ - a.stackZ);
    for (const rb of order) {
      if (!rb.w) continue;
      // Fog: fade the card toward the cream background by depth. Applies
      // to cells, outline, and head dividers via one globalAlpha state.
      ctx.globalAlpha = fogAlphaForZ(rb.stackZ);
      const vf = projectGrid(rb, rb.stackZ);
      fillCells(ctx, rb, rb.w, vf);
      strokePlaneOutline(ctx, rb.box, rb.stackZ, rb.box.color, 0.85, 1.0);
      paintHeadDividers(ctx, rb);
      ctx.globalAlpha = 1;
    }
  }

  function sizeCanvas(): void {
    if (!canvasEl || !stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.round(rect.width * dpr);
    canvasEl.height = Math.round(rect.height * dpr);
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(
      (dpr * rect.width) / viewW, 0,
      0, (dpr * rect.height) / viewH,
      0, 0,
    );
  }

  // ── Hit-test (inverse bilinear interpolation on projected box quad) ────
  /**
   * Given 4 screen corners (TL, TR, BR, BL) and a point Q, solve for
   * (u, v) in [0,1]² such that bilinear interp over the corners equals Q.
   * Returns null if the point is outside the quad.
   *
   * Math: let A = TL, B = TR - TL, C = BL - TL, D = A - B - C + BR.
   * Then Q = A + u*B + v*C + u*v*D. Separating X and Y gives two scalar
   * equations in (u, v). Eliminating u yields a quadratic in v.
   */
  function invBilinear(
    TL: [number, number], TR: [number, number], BR: [number, number], BL: [number, number],
    qx: number, qy: number,
  ): [number, number] | null {
    const Ex = TR[0] - TL[0], Ey = TR[1] - TL[1];                        // B
    const Fx = BL[0] - TL[0], Fy = BL[1] - TL[1];                        // C
    const Gx = TL[0] - TR[0] - BL[0] + BR[0], Gy = TL[1] - TR[1] - BL[1] + BR[1]; // D
    const Hx = qx - TL[0], Hy = qy - TL[1];

    const k2 = Gx * Fy - Gy * Fx;
    const k1 = Ex * Fy - Ey * Fx + Hx * Gy - Hy * Gx;
    const k0 = Hx * Ey - Hy * Ex;

    let v: number;
    if (Math.abs(k2) < 1e-9) {
      if (Math.abs(k1) < 1e-9) return null;
      v = -k0 / k1;
    } else {
      const disc = k1 * k1 - 4 * k2 * k0;
      if (disc < 0) return null;
      const sq = Math.sqrt(disc);
      const v0 = (-k1 - sq) / (2 * k2);
      const v1 = (-k1 + sq) / (2 * k2);
      // Pick the root that falls inside [0,1].
      v = (v0 >= -1e-6 && v0 <= 1 + 1e-6) ? v0 : v1;
    }
    if (v < -1e-6 || v > 1 + 1e-6) return null;

    const denomX = Ex + Gx * v;
    const denomY = Ey + Gy * v;
    // Use whichever denominator has more magnitude for numerical stability.
    const u = Math.abs(denomX) > Math.abs(denomY)
      ? (Hx - Fx * v) / denomX
      : (Hy - Fy * v) / denomY;
    if (u < -1e-6 || u > 1 + 1e-6) return null;
    return [Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v))];
  }

  function updateHoverFromEvent(e: PointerEvent): void {
    if (!svgEl) return;
    const rect = svgRect ?? svgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Map client → viewBox (the same linear mapping used by SVG itself).
    const scaleX = viewW / rect.width;
    const scaleY = viewH / rect.height;
    const vx = (e.clientX - rect.left) * scaleX;
    const vy = (e.clientY - rect.top) * scaleY;

    // Iterate front-to-back so the closer card wins overlapping hits.
    const order = [...renderBoxes].sort((a, b) => a.stackZ - b.stackZ);
    for (const rb of order) {
      const w = rb.w;
      if (!w) continue;
      const proj = boxProjections[projKey(rb.box.id, rb.blockIdx)];
      if (!proj) continue;
      const [TL, TR, BR, BL] = proj.frontCorners;
      const uv = invBilinear(TL, TR, BR, BL, vx, vy);
      if (!uv) continue;
      const [u, v] = uv;
      const c = Math.min(rb.dispCols - 1, Math.max(0, Math.floor(u * rb.dispCols)));
      const r = Math.min(rb.dispRows - 1, Math.max(0, Math.floor(v * rb.dispRows)));
      const idx = rb.isFlat ? r * rb.dispCols + c : r * w.cols + c;
      if (idx < 0 || idx >= w.values.length) {
        hoveredCell = null;
        return;
      }
      hoveredCell = {
        label: rb.box.label,
        blockIdx: rb.blockIdx,
        r: rb.isFlat ? 0 : r,
        c: rb.isFlat ? idx : c,
        v: w.values[idx],
        dv: w.delta[idx],
      };
      mouseX = e.clientX;
      mouseY = e.clientY;
      return;
    }
    hoveredCell = null;
  }

  function onPointerLeave(): void {
    if (isDragging) return;
    hoveredCell = null;
  }

  // ── Camera control handlers ───────────────────────────────────────────
  function clientToViewBox(clientX: number, clientY: number): [number, number] | null {
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return [
      (clientX - rect.left) * (viewW / rect.width),
      (clientY - rect.top) * (viewH / rect.height),
    ];
  }

  /** Adjust zoom so the world point under (anchorVx, anchorVy) stays put. */
  function adjustZoom(factor: number, anchorVx: number, anchorVy: number): void {
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor));
    if (newZoom === zoom) return;
    const k = newZoom / zoom;
    // Compensation derived from the projection formula:
    //   final = PIVOT + raw * zoom + pan
    panX = anchorVx - PIVOT_X - (anchorVx - PIVOT_X - panX) * k;
    panY = anchorVy - PIVOT_Y - (anchorVy - PIVOT_Y - panY) * k;
    zoom = newZoom;
  }

  function onWheel(e: WheelEvent): void {
    if (!INTERACTIVE) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1 / ZOOM_STEP_WHEEL : ZOOM_STEP_WHEEL;
    const v = clientToViewBox(e.clientX, e.clientY);
    if (!v) return;
    adjustZoom(factor, v[0], v[1]);
  }

  function onPointerDown(e: PointerEvent): void {
    if (!INTERACTIVE) return;
    if (e.button !== 0 || !svgEl) return;
    isDragging = true;
    dragMode = e.shiftKey ? 'orbit' : 'pan';
    hoveredCell = null;
    dragStart = {
      x: e.clientX, y: e.clientY,
      panX, panY,
      rotX: ROT_X, rotY: ROT_Y,
    };
    svgEl.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (isDragging && dragStart && svgEl) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (dragMode === 'orbit') {
        // Horizontal drag → yaw, vertical drag → pitch.
        ROT_Y = dragStart.rotY + dx * ORBIT_SENSITIVITY;
        ROT_X = Math.min(
          PITCH_MAX,
          Math.max(PITCH_MIN, dragStart.rotX + dy * ORBIT_SENSITIVITY),
        );
      } else {
        const rect = svgEl.getBoundingClientRect();
        if (rect.width === 0) return;
        panX = dragStart.panX + dx * (viewW / rect.width);
        panY = dragStart.panY + dy * (viewH / rect.height);
      }
      return;
    }
    updateHoverFromEvent(e);
  }

  function onPointerUp(e: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;
    dragStart = null;
    if (svgEl?.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
  }

  function resetView(): void {
    panX = DEFAULT_PAN_X;
    panY = DEFAULT_PAN_Y;
    zoom = DEFAULT_ZOOM;
    ROT_X = ROT_X_DEFAULT;
    ROT_Y = ROT_Y_DEFAULT;
    perspective = false;
  }
  function zoomInBtn(): void { adjustZoom(ZOOM_STEP_BTN, viewW / 2, viewH / 2); }
  function zoomOutBtn(): void { adjustZoom(1 / ZOOM_STEP_BTN, viewW / 2, viewH / 2); }
  function togglePerspective(): void { perspective = !perspective; }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  $effect(() => {
    void renderBoxes;
    if (canvasEl && stageEl) {
      sizeCanvas();
      paint();
    }
  });

  onMount(() => {
    const base = import.meta.env.BASE_URL;
    loadWeightsSeries(base).then(() => { weightsLoaded = true; });

    let ro: ResizeObserver | null = null;
    if (stageEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { sizeCanvas(); paint(); });
      ro.observe(stageEl);
    }

    const refreshSvgRect = () => { svgRect = svgEl ? svgEl.getBoundingClientRect() : null; };
    refreshSvgRect();
    const onResize = () => { winW = window.innerWidth; refreshSvgRect(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', refreshSvgRect, { passive: true });

    // Dev-only: expose camera state and projected card corners on window
    // so a console dump can be pasted into a coding-agent conversation
    // when the user reports a visual bug. See docs/3d-on-2d/.
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as unknown as { __modelDiagramDump?: () => unknown }).__modelDiagramDump = () => {
        const dump = {
          camera: { CAM_DIST, ROT_X, ROT_Y, BOX_YAW, COLUMN_BASE_X, COLUMN_GAP, COLUMN_INNER_GAP, ANCHOR_Y, SLOT_BASE_Z, SLOT_Z_STEP, PIVOT_X, PIVOT_Y, FOG_FAR, FOG_STRENGTH, perspective, panX, panY, zoom, DEFAULT_ZOOM, DEFAULT_PAN_X, DEFAULT_PAN_Y, WORLD_BBOX, WORLD_W, WORLD_H, columns: COLUMN_LAYOUTS.map((c) => ({ x: c.x, cards: Object.fromEntries(c.cardCenterY) })) },
          viewBox: { viewW, viewH },
          cards: renderBoxes.map((rb) => ({
            id: rb.box.id,
            blockIdx: rb.blockIdx,
            stackZ: rb.stackZ,
            displayWH: [rb.box.w, rb.box.h],
            corners: boxProjections[projKey(rb.box.id, rb.blockIdx)]?.frontCorners,
            labelXY: boxProjections[projKey(rb.box.id, rb.blockIdx)]?.labelXY,
          })),
        };
        // eslint-disable-next-line no-console
        console.log('ModelDiagram dump:', dump);
        return dump;
      };
    }

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', refreshSvgRect);
    };
  });
</script>

<div class="model-diagram">
  <div class="stage" bind:this={stageEl} style="aspect-ratio: {viewW} / {viewH};">
    <canvas bind:this={canvasEl} class="weight-canvas"></canvas>
    <svg
      bind:this={svgEl}
      viewBox="0 0 {viewW} {viewH}"
      preserveAspectRatio="xMidYMid meet"
      class="diagram-svg"
      class:dragging={isDragging}
      role="img"
      aria-label="Transformer weight matrices with interactive per-cell inspection. Drag to pan, shift+drag to orbit, scroll to zoom."
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onpointerleave={onPointerLeave}
      onwheel={onWheel}
    >
      {#each renderBoxes as rb (projKey(rb.box.id, rb.blockIdx))}
        {#if rb.isGlobal}
          {@const box = rb.box}
          {@const proj = boxProjections[projKey(box.id, rb.blockIdx)]}
          <g transform="translate({proj?.dataCardXY[0] ?? box.x + box.w / 2},{proj?.dataCardXY[1] ?? box.y + box.h / 2})"
            data-card={box.id}>
            <!-- Invisible anchor rect so PipelineArrows' getBoundingClientRect()
                 on this <g> returns a non-empty bbox at the projected center. -->
            <rect x="-1" y="-1" width="2" height="2" fill="none" stroke="none" />
          </g>
        {/if}
      {/each}

      <!-- Labels, positioned at the projected bottom-center of each card.
           Paired blocks share a label — only the closer (block 0) entry
           draws to avoid duplicate captions stacked on top of each other. -->
      {#each renderBoxes as rb (`label-${projKey(rb.box.id, rb.blockIdx)}`)}
        {@const box = rb.box}
        {@const proj = boxProjections[projKey(box.id, rb.blockIdx)]}
        {#if proj && (rb.blockIdx === null || rb.blockIdx === 0)}
          <g transform="translate({proj.labelXY[0]},{proj.labelXY[1]})">
            <text x="0" y="20" text-anchor="middle" class="box-label" fill={box.color}>{box.label}</text>
            <text x="0" y="34" text-anchor="middle" class="box-sub" fill="var(--ink-subtle)">{box.sub}</text>
          </g>
        {/if}
      {/each}

      <!-- Loading placeholder: rendered in SVG so boxes without weights still
           look like something. Drawn as a flat unrotated rect at box coords —
           only visible before weights load, so the mismatch with the 3D
           scene is brief. One placeholder per group (skip block 1 duplicates). -->
      {#each renderBoxes as rb (`placeholder-${projKey(rb.box.id, rb.blockIdx)}`)}
        {#if !rb.w && (rb.blockIdx === null || rb.blockIdx === 0)}
          {@const box = rb.box}
          <g transform="translate({box.x},{box.y})">
            <rect x="0" y="0" width={box.w} height={box.h} rx="4"
              fill="#f5f5f5" stroke={box.color} stroke-width="1.2" opacity="0.5" />
            <text x={box.w / 2} y={box.h / 2 + 4} text-anchor="middle"
              style="font-family: var(--font-serif); font-size: 12px; font-style: italic; fill: {box.color}">…</text>
          </g>
        {/if}
      {/each}
    </svg>
    {#if INTERACTIVE}
      <div class="cam-controls" aria-label="Camera controls">
        <button type="button" onclick={zoomInBtn} title="Zoom in" aria-label="Zoom in">+</button>
        <button type="button" onclick={zoomOutBtn} title="Zoom out" aria-label="Zoom out">−</button>
        <button
          type="button"
          onclick={togglePerspective}
          class:active={!perspective}
          title={perspective ? 'Switch to orthographic (no perspective)' : 'Switch to perspective'}
          aria-label="Toggle perspective"
          aria-pressed={!perspective}
        >{perspective ? 'P' : 'O'}</button>
        <button type="button" onclick={resetView} title="Reset view" aria-label="Reset view">⟲</button>
      </div>
    {/if}
  </div>

  {#if hoveredCell}
    <div class="tooltip" style={tooltipStyle}>
      <span class="tt-key">{hoveredCell.label}{hoveredCell.blockIdx !== null ? `·b${hoveredCell.blockIdx}` : ''}[{hoveredCell.r},{hoveredCell.c}]</span>
      <span class="tt-eq">=</span>
      <span class="tt-val">{hoveredCell.v.toFixed(4)}</span>
      <span class="tt-sep">·</span>
      <span class="tt-delta" class:pos={hoveredCell.dv >= 0} class:neg={hoveredCell.dv < 0}>
        Δ {hoveredCell.dv >= 0 ? '+' : ''}{hoveredCell.dv.toFixed(4)}
      </span>
    </div>
  {/if}
</div>

<style>
  .model-diagram {
    width: 90vw;
    margin-top: var(--space-md);
    margin-bottom: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    position: relative;
  }

  .stage {
    position: relative;
    width: 100%;
  }

  .weight-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
  }

  .diagram-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    cursor: default;
  }

  .cam-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 10;
  }
  .cam-controls button {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border-strong);
    background: var(--bg);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1;
    color: var(--ink-muted);
    box-shadow: var(--shadow-hairline);
  }
  .cam-controls button:hover {
    background: var(--bg-subtle, #f0ede4);
    color: var(--ink);
  }
  .cam-controls button.active {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }

  .tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 200;
    display: flex;
    align-items: baseline;
    gap: 5px;
    padding: 4px 8px;
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-hairline);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    white-space: nowrap;
  }
  .tt-key { color: var(--ink-muted); }
  .tt-eq  { color: var(--ink-faded); }
  .tt-val { color: var(--ink); font-weight: 500; }
  .tt-sep { color: var(--ink-faded); }
  .tt-delta { font-weight: 500; }
  .tt-delta.pos { color: #b03030; }
  .tt-delta.neg { color: #2a5fa8; }

  :global(.box-label) {
    font-family: var(--font-serif);
    font-size: 13px;
    font-weight: 700;
    font-style: italic;
  }

  :global(.box-sub) {
    font-family: var(--font-mono);
    font-size: 9px;
  }
</style>
