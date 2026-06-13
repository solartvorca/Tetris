'use strict';

// ---- Shared mutable state ----
let grid, score, hi, level, linesCleared;
let piece, nextPiece;
let screen = 'menu';
let prevScreen = 'menu';
let flashSet = new Set(); // integer keys: r*COLS + c
let lastDrop, dropInterval;
let animId = 0;
const BTN = {};

// ---- Grid ----
function mkGrid() {
  return Array.from({length:ROWS}, () => Array(COLS).fill(null));
}

// ---- Piece helpers ----
function rndLetter(code) {
  const a = GROUPS[code];
  return a[Math.floor(Math.random() * a.length)];
}

function makePiece() {
  const shape = TETROS[Math.floor(Math.random() * TETROS.length)];
  const code = Math.ceil(Math.random() * 9);
  const cells = shape.map(([dr, dc]) => {
    const l = rndLetter(code);
    return { dr, dc, letter:l, ...INFO[l] };
  });
  return { cells, row:1, col:Math.floor(COLS/2) };
}

function abs(p) {
  return p.cells.map(c => ({
    r: p.row + c.dr,
    c: p.col + c.dc,
    letter:c.letter, code:c.code, si:c.si, color:c.color
  }));
}

function valid(p) {
  return abs(p).every(({r,c}) =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS && !grid[r][c]
  );
}

function rotate(p) {
  const rot = { ...p, cells: p.cells.map(({dr,dc,...rest}) => ({dr:dc, dc:-dr, ...rest})) };
  if (valid(rot)) return rot;
  for (const d of [1,-1,2,-2]) {
    const k = {...rot, col:rot.col+d};
    if (valid(k)) return k;
  }
  return p;
}

function ghost(p) {
  let q = p;
  while (valid({...q, row:q.row+1})) q = {...q, row:q.row+1};
  return q;
}

function hardDrop() {
  piece = ghost(piece);
  lockPiece();
}

// ---- Game logic ----
function startGame() {
  grid = mkGrid();
  score = 0; level = 1; linesCleared = 0;
  hi = +localStorage.getItem('nt5_hi') || 0;
  flashSet = new Set();
  piece = makePiece(); nextPiece = makePiece();
  lastDrop = performance.now();
  dropInterval = 750;
  screen = 'game';
  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function lockPiece() {
  abs(piece).forEach(({r,c,letter,code,si,color}) => {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS)
      grid[r][c] = {letter,code,si,color};
  });
  processClears(0);
  animId = requestAnimationFrame(loop);
}

function processClears(cascade) {
  const fullRows = [];
  for (let r = 0; r < ROWS; r++)
    if (grid[r].every(c => c !== null)) fullRows.push(r);

  const groups = findColorGroups(5);
  const toClear = new Set();
  fullRows.forEach(r => { for (let c = 0; c < COLS; c++) toClear.add(r*COLS+c); });
  groups.forEach(g => g.forEach(({r,c}) => toClear.add(r*COLS+c)));

  if (toClear.size === 0) { spawnNext(); return; }

  const mult = cascade > 0 ? cascade + 1 : 1;
  const BASE = [0,100,300,500,800];
  score += (BASE[Math.min(fullRows.length,4)] + groups.length*200) * level * mult;
  linesCleared += fullRows.length;
  level = Math.floor(linesCleared / 8) + 1;
  dropInterval = Math.max(120, 750 - (level-1)*70);
  if (score > hi) { hi = score; localStorage.setItem('nt5_hi', hi); }

  flashSet = toClear;

  setTimeout(() => {
    toClear.forEach(key => {
      const r = Math.floor(key / COLS), c = key % COLS;
      if (grid[r]) grid[r][c] = null;
    });
    flashSet = new Set();
    applyGravity();
    processClears(cascade + 1);
  }, 380);
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) if (grid[r][c]) col.push(grid[r][c]);
    for (let r = 0; r < ROWS; r++)
      grid[r][c] = r < ROWS - col.length ? null : col[r - (ROWS - col.length)];
  }
}

function spawnNext() {
  piece = nextPiece;
  nextPiece = makePiece();
  lastDrop = performance.now();
  if (!valid(piece)) {
    if (score > hi) { hi = score; localStorage.setItem('nt5_hi', hi); }
    screen = 'gameover';
  }
}

function findColorGroups(minSize) {
  const vis = Array.from({length:ROWS}, () => Array(COLS).fill(false));
  const result = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] && !vis[r][c]) {
        const code = grid[r][c].code;
        const group = [];
        const stk = [{r,c}];
        while (stk.length) {
          const {r:cr,c:cc} = stk.pop();
          if (cr<0||cr>=ROWS||cc<0||cc>=COLS||vis[cr][cc]||!grid[cr][cc]||grid[cr][cc].code!==code) continue;
          vis[cr][cc] = true;
          group.push({r:cr,c:cc});
          stk.push({r:cr-1,c:cc},{r:cr+1,c:cc},{r:cr,c:cc-1},{r:cr,c:cc+1});
        }
        if (group.length >= minSize) result.push(group);
      }
    }
  }
  return result;
}
