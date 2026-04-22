// Shared geometry for the Transformer-architecture diagram in section 1.
// Both the full interactive ModelDiagram (44k weight cells) and the
// mobile ModelDiagramPlaceholder (9 silhouettes) read from here so the
// two viewports stay pixel-identical in the outer layout.

const S = 4;                  // base cell size in viewBox units
const S_NORM = 10;            // Norm strip uses larger cells to stay legible
const GAP_X = 60;
const GAP_Y = 52;
const TOP_PAD = 24;
const SIDE_PAD = 24;
const LABEL_H = 40;

export type BoxDef = {
  id: string;
  label: string;
  sub: string;
  color: string;
  rows: number;
  cols: number;
  vertical?: boolean;
  cell?: number;
};

export const boxDefs: Record<string, BoxDef> = {
  embed: { id: 'embed', label: 'Embed', sub: '48×64',  color: '#7c5bbf', rows: 48,  cols: 64  },
  wq:    { id: 'wq',    label: 'W_Q',   sub: '64×64',  color: '#5b7cc5', rows: 64,  cols: 64  },
  wk:    { id: 'wk',    label: 'W_K',   sub: '64×64',  color: '#c75a5a', rows: 64,  cols: 64  },
  wv:    { id: 'wv',    label: 'W_V',   sub: '64×64',  color: '#5aad6a', rows: 64,  cols: 64  },
  wo:    { id: 'wo',    label: 'W_O',   sub: '64×64',  color: '#8b6cc5', rows: 64,  cols: 64  },
  gate:  { id: 'gate',  label: 'Gate',  sub: '128×64', color: '#d6a029', rows: 128, cols: 64  },
  up:    { id: 'up',    label: 'Up',    sub: '128×64', color: '#d6a029', rows: 128, cols: 64  },
  down:  { id: 'down',  label: 'Down',  sub: '64×128', color: '#d6a029', rows: 64,  cols: 128 },
  norm:  { id: 'norm',  label: 'Norm',  sub: '1×64',   color: '#888',    rows: 64,  cols: 1, vertical: true, cell: S_NORM },
};

export const columns: string[][] = [
  ['embed'],
  ['wq', 'wk', 'wv'],
  ['wo'],
  ['gate', 'up'],
  ['down'],
  ['norm'],
];

export type LaidOutBox = {
  id: string;
  label: string;
  sub: string;
  color: string;
  vertical: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Arrow = { x1: number; y1: number; x2: number; y2: number };

function computeLayout(): { boxes: LaidOutBox[]; viewW: number; viewH: number } {
  const cellOf = (d: BoxDef) => d.cell ?? S;
  const boxW = (d: BoxDef) => d.cols * cellOf(d);
  const boxH = (d: BoxDef) => d.rows * cellOf(d);
  const colMaxW = (col: string[]) => Math.max(...col.map((id) => boxW(boxDefs[id])));
  const colH = (col: string[]) =>
    col.reduce((sum, id) => sum + boxH(boxDefs[id]), 0) + (col.length - 1) * GAP_Y;

  const contentH = Math.max(...columns.map(colH));
  const viewH = TOP_PAD + contentH + LABEL_H + TOP_PAD;

  let xCursor = SIDE_PAD;
  const boxes: LaidOutBox[] = [];
  for (const col of columns) {
    const cw = colMaxW(col);
    const ch = colH(col);
    let y = TOP_PAD + (contentH - ch) / 2;
    for (const id of col) {
      const d = boxDefs[id];
      const bw = boxW(d);
      const bh = boxH(d);
      boxes.push({
        id,
        label: d.label,
        sub: d.sub,
        color: d.color,
        vertical: d.vertical ?? false,
        x: xCursor + (cw - bw) / 2,
        y,
        w: bw,
        h: bh,
      });
      y += bh + GAP_Y;
    }
    xCursor += cw + GAP_X;
  }
  const viewW = xCursor - GAP_X + SIDE_PAD;
  return { boxes, viewW, viewH };
}

const laid = computeLayout();

export const archBoxes: LaidOutBox[] = laid.boxes;
export const viewW: number = laid.viewW;
export const viewH: number = laid.viewH;

const byId: Record<string, LaidOutBox> = Object.fromEntries(archBoxes.map((b) => [b.id, b]));

export const arrowPairs: [string, string][] = [
  ['embed', 'wq'], ['embed', 'wk'], ['embed', 'wv'],
  ['wq', 'wo'], ['wk', 'wo'], ['wv', 'wo'],
  ['wo', 'gate'], ['wo', 'up'],
  ['gate', 'down'], ['up', 'down'],
  ['down', 'norm'],
];

export const archArrows: Arrow[] = arrowPairs.map(([from, to]) => {
  const f = byId[from];
  const t = byId[to];
  return { x1: f.x + f.w, y1: f.y + f.h / 2, x2: t.x, y2: t.y + t.h / 2 };
});
