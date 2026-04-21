/**
 * Rubik's Cube state model + move operations.
 *
 * State: flat array of 54 color chars.
 *   U:0-8  D:9-17  F:18-26  B:27-35  L:36-44  R:45-53
 *
 * Each face indexed when looking at it directly:
 *   [0][1][2]
 *   [3][4][5]
 *   [6][7][8]
 */

export type Color = 'W' | 'Y' | 'G' | 'B' | 'O' | 'R';

export const COLOR_HEX: Record<Color, string> = {
  W: '#FFFFFF',
  Y: '#FFED00',
  G: '#009E60',
  B: '#0051BA',
  O: '#FF5800',
  R: '#C41E3A',
};

export type CubeState = Color[];

export function solved(): CubeState {
  return [
    ...'WWWWWWWWW'.split(''),  // U 0-8
    ...'YYYYYYYYY'.split(''),  // D 9-17
    ...'GGGGGGGGG'.split(''),  // F 18-26
    ...'BBBBBBBBB'.split(''),  // B 27-35
    ...'OOOOOOOOO'.split(''),  // L 36-44
    ...'RRRRRRRRR'.split(''),  // R 45-53
  ] as CubeState;
}

// Face rotation CW: [0,1,2,3,4,5,6,7,8] → [6,3,0,7,4,1,8,5,2]
function rotateFaceCW(state: CubeState, offset: number): void {
  const o = offset;
  const t0 = state[o]!, t1 = state[o+1]!, t2 = state[o+2]!;
  const t3 = state[o+3]!, t4 = state[o+4]!, t5 = state[o+5]!;
  const t6 = state[o+6]!, t7 = state[o+7]!, t8 = state[o+8]!;
  state[o]   = t6; state[o+1] = t3; state[o+2] = t0;
  state[o+3] = t7; state[o+4] = t4; state[o+5] = t1;
  state[o+6] = t8; state[o+7] = t5; state[o+8] = t2;
}

function cycle4(state: CubeState, a: number[], b: number[], c: number[], d: number[]): void {
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!, bi = b[i]!, ci = c[i]!, di = d[i]!;
    const tmp = state[di]!;
    state[di] = state[ci]!;
    state[ci] = state[bi]!;
    state[bi] = state[ai]!;
    state[ai] = tmp;
  }
}

// Face offsets
const U = 0, D = 9, F = 18, B = 27, L = 36, R = 45;

export type Move = 'U' | "U'" | 'U2' | 'D' | "D'" | 'D2' |
  'R' | "R'" | 'R2' | 'L' | "L'" | 'L2' |
  'F' | "F'" | 'F2' | 'B' | "B'" | 'B2';

function applySingleCW(state: CubeState, face: Move): void {
  switch (face) {
    case 'U':
      rotateFaceCW(state, U);
      // F[0,1,2] → R[0,1,2] → B[0,1,2] → L[0,1,2]
      cycle4(state, [F,F+1,F+2], [R,R+1,R+2], [B,B+1,B+2], [L,L+1,L+2]);
      break;
    case 'D':
      rotateFaceCW(state, D);
      // F[6,7,8] → L[6,7,8] → B[6,7,8] → R[6,7,8]
      cycle4(state, [F+6,F+7,F+8], [L+6,L+7,L+8], [B+6,B+7,B+8], [R+6,R+7,R+8]);
      break;
    case 'R':
      rotateFaceCW(state, R);
      // F[2,5,8] → U[2,5,8] → B[6,3,0] → D[2,5,8]
      cycle4(state, [F+2,F+5,F+8], [U+2,U+5,U+8], [B+6,B+3,B], [D+2,D+5,D+8]);
      break;
    case 'L':
      rotateFaceCW(state, L);
      // F[0,3,6] → D[0,3,6] → B[8,5,2] → U[0,3,6]
      cycle4(state, [F,F+3,F+6], [D,D+3,D+6], [B+8,B+5,B+2], [U,U+3,U+6]);
      break;
    case 'F':
      rotateFaceCW(state, F);
      // U[6,7,8] → R[0,3,6] → D[2,1,0] → L[8,5,2]
      cycle4(state, [U+6,U+7,U+8], [R,R+3,R+6], [D+2,D+1,D], [L+8,L+5,L+2]);
      break;
    case 'B':
      rotateFaceCW(state, B);
      // U[2,1,0] → L[0,3,6] → D[6,7,8] → R[8,5,2]
      cycle4(state, [U+2,U+1,U], [L,L+3,L+6], [D+6,D+7,D+8], [R+8,R+5,R+2]);
      break;
  }
}

export function applyMove(state: CubeState, move: Move): CubeState {
  const next = [...state] as CubeState;
  const base = move.replace(/[2']/g, '') as Move;
  if (move.endsWith('2')) {
    applySingleCW(next, base);
    applySingleCW(next, base);
  } else if (move.endsWith("'")) {
    applySingleCW(next, base);
    applySingleCW(next, base);
    applySingleCW(next, base);
  } else {
    applySingleCW(next, base);
  }
  return next;
}

export function applyMoves(state: CubeState, moves: Move[]): CubeState {
  let s = state;
  for (const m of moves) s = applyMove(s, m);
  return s;
}

export function parseMoves(str: string): Move[] {
  return str.trim().split(/\s+/) as Move[];
}

/** Get sticker color for a face at [row][col]. */
export function getSticker(state: CubeState, face: 'U' | 'D' | 'F' | 'B' | 'L' | 'R', row: number, col: number): Color {
  const offsets = { U: 0, D: 9, F: 18, B: 27, L: 36, R: 45 };
  return state[offsets[face] + row * 3 + col] as Color;
}
