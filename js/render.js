'use strict';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, DPR, CELL, GX, GY;

let cellPad, cellInner, cellR, cellFont, cellSmallFont;
let bgCanvas = null;
let _ghostPiece = null, _ghostRef = null;

// Pre-rendered tile canvases: tiles[code][si] and tilesF[code][si] (flash)
// Rebuilt on every resize. drawBoard blits these instead of redrawing paths.
const tiles  = {};
const tilesF = {};

// ---- helpers ----
function ca(hex, a) {
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a.toFixed(3)})`;
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
    const R = Array.isArray(r) ? r[0]||0 : (r||0);
    this.moveTo(x+R,y); this.lineTo(x+w-R,y); this.arcTo(x+w,y,x+w,y+R,R);
    this.lineTo(x+w,y+h-R); this.arcTo(x+w,y+h,x+w-R,y+h,R);
    this.lineTo(x+R,y+h); this.arcTo(x,y+h,x,y+h-R,R);
    this.lineTo(x,y+R); this.arcTo(x,y,x+R,y,R); this.closePath();
  };
}

// ---- offscreen board background ----
function buildBgCanvas() {
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = canvas.width;
  bgCanvas.height = canvas.height;
  const bctx = bgCanvas.getContext('2d');
  bctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  bctx.fillStyle = '#0d1525';
  bctx.fillRect(GX, GY, COLS*CELL, ROWS*CELL);

  bctx.strokeStyle = 'rgba(255,255,255,0.05)';
  bctx.lineWidth = 0.5;
  for (let r = 0; r <= ROWS; r++) {
    bctx.beginPath(); bctx.moveTo(GX, GY+r*CELL); bctx.lineTo(GX+COLS*CELL, GY+r*CELL); bctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    bctx.beginPath(); bctx.moveTo(GX+c*CELL, GY); bctx.lineTo(GX+c*CELL, GY+ROWS*CELL); bctx.stroke();
  }
  bctx.strokeStyle = 'rgba(80,130,255,0.3)';
  bctx.lineWidth = 1.5;
  bctx.strokeRect(GX, GY, COLS*CELL, ROWS*CELL);
}

// ---- tile cache ----
// Each tile is CELL×CELL at DPR resolution so drawImage stays pixel-perfect.
// Contains: outer square frame + colored shape. Text is drawn separately (batched).
function makeTile(color, si, flash) {
  const tsz = Math.ceil(CELL * DPR);
  const tc  = document.createElement('canvas');
  tc.width  = tsz;
  tc.height = tsz;
  const tctx = tc.getContext('2d');
  tctx.scale(DPR, DPR);

  const sz    = CELL;
  const pad   = sz >= 32 ? 3 : sz >= 20 ? 2 : 1;
  const inner = sz - pad * 2;
  const r     = inner * 0.45;

  // Outer square frame — the visual "wrapper" around each shape
  tctx.beginPath();
  tctx.roundRect(0.5, 0.5, sz - 1, sz - 1, 4);
  tctx.fillStyle   = flash ? 'rgba(255,255,220,0.07)' : ca(color, 0.07);
  tctx.fill();
  tctx.strokeStyle = flash ? 'rgba(255,255,0,0.55)'  : ca(color, 0.26);
  tctx.lineWidth   = flash ? 1.5 : 1;
  tctx.stroke();

  // Inner shape
  tctx.save();
  tctx.translate(sz / 2, sz / 2);
  tctx.beginPath();
  if      (si === 0) { tctx.arc(0, 0, r, 0, Math.PI*2); }
  else if (si === 1) { tctx.roundRect(-r, -r, r*2, r*2, r*0.24); }
  else if (si === 2) { tctx.moveTo(0,-r); tctx.lineTo(r*.88,r*.62); tctx.lineTo(-r*.88,r*.62); tctx.closePath(); }
  else               { tctx.moveTo(0,-r); tctx.lineTo(r*.7,0); tctx.lineTo(0,r); tctx.lineTo(-r*.7,0); tctx.closePath(); }
  tctx.fillStyle   = flash ? '#ffffff' : color + 'cc';
  tctx.fill();
  tctx.strokeStyle = flash ? '#ffff00' : 'rgba(255,255,255,0.35)';
  tctx.lineWidth   = flash ? 2.5 : 1;
  tctx.stroke();
  tctx.restore();

  return tc;
}

function buildTileCache() {
  for (let code = 1; code <= 9; code++) {
    tiles[code]  = [];
    tilesF[code] = [];
    const color  = CLR[code];
    for (let si = 0; si < 4; si++) {
      tiles[code][si]  = makeTile(color, si, false);
      tilesF[code][si] = makeTile(color, si, true);
    }
  }
}

// ---- resize ----
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width  = W * DPR; canvas.height = H * DPR;
  canvas.style.width  = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  CELL = Math.max(26, Math.min(46, Math.floor(Math.min(
    (W - 6) / COLS,
    (H - TOP_H - BOT_H - 4) / ROWS
  ))));
  GX = Math.floor((W - COLS*CELL) / 2);
  GY = TOP_H + 2;

  cellPad       = CELL >= 32 ? 3 : CELL >= 20 ? 2 : 1;
  cellInner     = CELL - cellPad * 2;
  cellR         = cellInner * 0.45;
  cellFont      = `bold ${Math.max(10, cellInner * 0.46)}px monospace`;
  cellSmallFont = `bold ${Math.max(7,  cellInner * 0.23)}px monospace`;

  _ghostRef = null;
  buildBgCanvas();
  buildTileCache();
}

// ---- ghost cache ----
function getCachedGhost() {
  if (piece !== _ghostRef) {
    _ghostPiece = ghost(piece);
    _ghostRef   = piece;
  }
  return _ghostPiece;
}

// ---- drawCell: used only for HUD preview + help screen (non-CELL sizes) ----
function drawCell(x, y, sz, cell, flash) {
  const { letter, code, si, color } = cell;
  const pad   = sz >= 32 ? 3 : sz >= 20 ? 2 : 1;
  const inner = sz - pad * 2;
  const r     = inner * 0.45;

  ctx.save();
  ctx.translate(x + sz/2, y + sz/2);

  // Outer square frame
  ctx.beginPath(); ctx.roundRect(-sz/2+0.5, -sz/2+0.5, sz-1, sz-1, 4);
  ctx.fillStyle   = flash ? 'rgba(255,255,220,0.07)' : ca(color, 0.07);
  ctx.fill();
  ctx.strokeStyle = flash ? 'rgba(255,255,0,0.55)' : ca(color, 0.26);
  ctx.lineWidth   = flash ? 1.5 : 1;
  ctx.stroke();

  // Shape
  ctx.beginPath();
  if      (si === 0) { ctx.arc(0, 0, r, 0, Math.PI*2); }
  else if (si === 1) { ctx.roundRect(-r, -r, r*2, r*2, r*0.24); }
  else if (si === 2) { ctx.moveTo(0,-r); ctx.lineTo(r*.88,r*.62); ctx.lineTo(-r*.88,r*.62); ctx.closePath(); }
  else               { ctx.moveTo(0,-r); ctx.lineTo(r*.7,0); ctx.lineTo(0,r); ctx.lineTo(-r*.7,0); ctx.closePath(); }
  ctx.fillStyle   = flash ? '#ffffff' : color + 'cc';
  ctx.fill();
  ctx.strokeStyle = flash ? '#ffff00' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth   = flash ? 2.5 : 1;
  ctx.stroke();

  ctx.font = `bold ${Math.max(10, inner * 0.46)}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(letter, 1, 1);
  ctx.fillStyle = flash ? '#000' : '#fff'; ctx.fillText(letter, 0, 0);

  if (sz >= 24) {
    ctx.font = `bold ${Math.max(7, inner * 0.23)}px monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(String(code), inner*0.3+0.5, inner*0.3+0.5);
    ctx.fillStyle = flash ? '#000' : 'rgba(255,255,255,0.9)'; ctx.fillText(String(code), inner*0.3, inner*0.3);
  }

  ctx.restore();
}

function rrect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

// ---- drawBoard: optimised hot path ----
// Pass 1: tile blits (GPU-friendly, no path ops per cell)
// Pass 2: text rendered in batched font passes (font set once per pass)
function drawBoard() {
  ctx.drawImage(bgCanvas, 0, 0, W, H);

  const now  = performance.now();
  const fl   = flashSet.size > 0 && Math.sin(now / 80) > 0;
  const half = CELL / 2;
  const doff = cellInner * 0.3;

  // Ghost piece
  if (piece && flashSet.size === 0) {
    const g = getCachedGhost();
    ctx.globalAlpha = 0.18;
    abs(g).forEach(({ r, c, code, si }) => {
      if (r >= 0) ctx.drawImage(tiles[code][si], GX + c*CELL, GY + r*CELL, CELL, CELL);
    });
    ctx.globalAlpha = 1;
  }

  // Board cells: tile blit
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      const tile = (fl && flashSet.has(r*COLS+c)) ? tilesF[cell.code][cell.si] : tiles[cell.code][cell.si];
      ctx.drawImage(tile, GX + c*CELL, GY + r*CELL, CELL, CELL);
    }
  }

  // Active piece: tile blit
  if (piece && flashSet.size === 0) {
    abs(piece).forEach(({ r, c, code, si }) => {
      if (r >= 0) ctx.drawImage(tiles[code][si], GX + c*CELL, GY + r*CELL, CELL, CELL);
    });
  }

  // Text passes — font set ONCE per pass instead of per cell
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  if (flashSet.size === 0) {
    // ── fast path: no flash, two-sweep per font ──────────────

    // Board letters – shadow
    ctx.font = cellFont; ctx.fillStyle = 'rgba(0,0,0,0.8)';
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c]) ctx.fillText(grid[r][c].letter, GX+c*CELL+half+1, GY+r*CELL+half+1);
    // Board letters – main
    ctx.fillStyle = '#fff';
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c]) ctx.fillText(grid[r][c].letter, GX+c*CELL+half, GY+r*CELL+half);

    if (CELL >= 24) {
      // Board code digits – shadow
      ctx.font = cellSmallFont; ctx.fillStyle = 'rgba(0,0,0,0.7)';
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (grid[r][c]) ctx.fillText(String(grid[r][c].code),
            GX+c*CELL+half+doff+0.5, GY+r*CELL+half+doff+0.5);
      // Board code digits – main
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (grid[r][c]) ctx.fillText(String(grid[r][c].code),
            GX+c*CELL+half+doff, GY+r*CELL+half+doff);
    }

    // Active piece text
    if (piece) {
      const pcells = abs(piece).filter(a => a.r >= 0);

      ctx.font = cellFont; ctx.fillStyle = 'rgba(0,0,0,0.8)';
      pcells.forEach(({ r, c, letter }) => ctx.fillText(letter, GX+c*CELL+half+1, GY+r*CELL+half+1));
      ctx.fillStyle = '#fff';
      pcells.forEach(({ r, c, letter }) => ctx.fillText(letter, GX+c*CELL+half, GY+r*CELL+half));

      if (CELL >= 24) {
        ctx.font = cellSmallFont; ctx.fillStyle = 'rgba(0,0,0,0.7)';
        pcells.forEach(({ r, c, code }) => ctx.fillText(String(code), GX+c*CELL+half+doff+0.5, GY+r*CELL+half+doff+0.5));
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        pcells.forEach(({ r, c, code }) => ctx.fillText(String(code), GX+c*CELL+half+doff, GY+r*CELL+half+doff));
      }
    }

  } else {
    // ── flash path: per-cell color check ────────────────────
    ctx.font = cellFont;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c]; if (!cell) continue;
        const isF  = fl && flashSet.has(r*COLS+c);
        const cx = GX+c*CELL+half, cy = GY+r*CELL+half;
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(cell.letter, cx+1, cy+1);
        ctx.fillStyle = isF ? '#000' : '#fff'; ctx.fillText(cell.letter, cx, cy);
      }
    }
    if (CELL >= 24) {
      ctx.font = cellSmallFont;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = grid[r][c]; if (!cell) continue;
          const isF  = fl && flashSet.has(r*COLS+c);
          const cx = GX+c*CELL+half+doff, cy = GY+r*CELL+half+doff;
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(String(cell.code), cx+0.5, cy+0.5);
          ctx.fillStyle = isF ? '#000' : 'rgba(255,255,255,0.9)'; ctx.fillText(String(cell.code), cx, cy);
        }
      }
    }
  }
}

// ---- HUD ----
function drawHUD() {
  ctx.fillStyle = '#060c18';
  ctx.fillRect(0, 0, W, GY - 2);

  const ty = GY / 2;
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#667'; ctx.textAlign = 'left';
  ctx.fillText('СЧЁТ', GX, ty - 8);
  ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#ffd700';
  ctx.fillText(score, GX, ty + 8);

  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#667'; ctx.textAlign = 'center';
  ctx.fillText('УРОВЕНЬ', W/2, ty - 8);
  ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#88eeff';
  ctx.fillText(level, W/2, ty + 8);

  if (nextPiece) {
    const ns    = Math.max(12, Math.floor(CELL * 0.5));
    const minDr = Math.min(...nextPiece.cells.map(c => c.dr));
    const minDc = Math.min(...nextPiece.cells.map(c => c.dc));
    const nW    = (Math.max(...nextPiece.cells.map(c => c.dc)) - minDc + 1) * ns;
    const nH    = (Math.max(...nextPiece.cells.map(c => c.dr)) - minDr + 1) * ns;
    const px    = GX + COLS*CELL - nW - 2;
    const py    = (GY - 2 - nH) / 2;
    ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#667'; ctx.textAlign = 'right';
    ctx.fillText('СЛЕД.', GX + COLS*CELL, 10);
    nextPiece.cells.forEach(cell => {
      drawCell(px + (cell.dc - minDc)*ns, py + (cell.dr - minDr)*ns, ns,
        { letter:cell.letter, code:cell.code, si:cell.si, color:cell.color }, false);
    });
  }

  const by = GY + ROWS * CELL + 2;
  ctx.fillStyle = '#060c18';
  ctx.fillRect(0, by, W, H - by);

  const bw = 70, bh = 36, gap = 8;
  const tot = 3*bw + 2*gap;
  const bx0 = (W - tot) / 2;
  const bby = by + (H - by - bh) / 2;

  ['ТАБЛ.', 'ПАУЗА', 'МЕНЮ'].forEach((lbl, i) => {
    const bx = bx0 + i*(bw+gap);
    BTN[lbl] = { x:bx, y:bby, w:bw, h:bh };
    ctx.lineWidth = 1;
    rrect(bx, bby, bw, bh, 7, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)');
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lbl, bx+bw/2, bby+bh/2);
  });

  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#445';
  ctx.fillText('РЕК ' + hi, GX + COLS*CELL, by + (H-by)/2);
}

// ---- screens ----
function drawMenu() {
  ctx.fillStyle = '#060c18';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = W/2;

  ctx.font = `bold ${Math.min(34, W*0.087)}px Segoe UI`;
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 24;
  ctx.fillText('НЕЙРО', cx, H*0.2);
  ctx.fillText('ТЕТРИС 5.0', cx, H*0.28);
  ctx.shadowBlur = 0;

  ctx.font = `${Math.min(13, W*0.033)}px Segoe UI`;
  ctx.fillStyle = '#556677';
  ctx.fillText('Каждый квадрат — буква с кодом, цветом и формой', cx, H*0.37);
  ctx.fillStyle = '#445566';
  ctx.fillText('5+ клеток одного цвета рядом → автоочистка', cx, H*0.43);
  ctx.fillText('Фигура одного цвета = одна кодовая группа', cx, H*0.49);

  const bw = 160, bh = 50, bx = cx-bw/2, bby = H*0.58;
  BTN['СТАРТ'] = { x:bx, y:bby, w:bw, h:bh };
  ctx.lineWidth = 2;
  rrect(bx, bby, bw, bh, 12, 'rgba(255,215,0,0.15)', '#ffd700');
  ctx.font = `bold ${Math.min(22, W*0.056)}px Segoe UI`;
  ctx.fillStyle = '#ffd700';
  ctx.fillText('ИГРАТЬ', cx, bby+bh/2);

  const tbw = 130, tbh = 38, tbx = cx-tbw/2, tby = bby+bh+14;
  BTN['ТАБ_МЕНЮ'] = { x:tbx, y:tby, w:tbw, h:tbh };
  ctx.lineWidth = 1.5;
  rrect(tbx, tby, tbw, tbh, 9, 'rgba(100,160,255,0.1)', 'rgba(100,160,255,0.45)');
  ctx.font = `${Math.min(14, W*0.036)}px Segoe UI`;
  ctx.fillStyle = '#88aaff';
  ctx.fillText('ТАБЛИЦА КОДОВ', cx, tby+tbh/2);

  const gbw = 120, gbh = 30, gbx = cx-gbw/2, gby = tby+tbh+10;
  BTN['ГЛАВНАЯ'] = { x:gbx, y:gby, w:gbw, h:gbh };
  ctx.lineWidth = 1;
  rrect(gbx, gby, gbw, gbh, 7, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.12)');
  ctx.font = '12px Segoe UI'; ctx.fillStyle = '#445';
  ctx.fillText('← НА ГЛАВНУЮ', cx, gby+gbh/2);
}

function drawHelp() {
  ctx.fillStyle = '#060c18';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  ctx.font = `bold ${Math.min(17, W*0.043)}px Segoe UI`;
  ctx.fillStyle = '#ffd700';
  ctx.fillText('ТАБЛИЦА КОДОВ БУКВ', W/2, 22);

  const margin = 6;
  const colW   = Math.floor((W - margin*2) / 9);
  const startY = 42;
  const cellH  = Math.floor((H - startY - 52) / 4);
  const cellSz = Math.min(colW - 4, cellH - 4);

  for (let code = 1; code <= 9; code++) {
    const letters = GROUPS[code];
    const cx = margin + (code-1)*colW + colW/2;

    ctx.font = `bold ${Math.min(13, colW*0.38)}px monospace`;
    ctx.fillStyle = CLR[code];
    ctx.shadowColor = CLR[code]; ctx.shadowBlur = 8;
    ctx.fillText(String(code), cx, startY - 10);
    ctx.shadowBlur = 0;

    letters.forEach((letter, i) => {
      const si = i % 4;
      const y  = startY + i * (cellH + 2);
      const lx = margin + (code-1)*colW + (colW - cellSz)/2;
      drawCell(lx, y, cellSz, { letter, code, si, color:CLR[code] }, false);
    });
  }

  const bbw = 110, bbh = 32, bbx = W/2-bbw/2, bby = H - 40;
  BTN['НАЗАД'] = { x:bbx, y:bby, w:bbw, h:bbh };
  ctx.lineWidth = 1.5;
  rrect(bbx, bby, bbw, bbh, 8, 'rgba(100,160,255,0.13)', 'rgba(100,160,255,0.5)');
  ctx.font = 'bold 14px Segoe UI'; ctx.fillStyle = '#88aaff';
  ctx.fillText('← НАЗАД', W/2, bby+bbh/2);
}

function drawGameOver() {
  drawBoard(); drawHUD();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = W/2, cy = H/2;

  ctx.font = `bold ${Math.min(26,W*0.066)}px Segoe UI`;
  ctx.fillStyle = '#ff5f5f'; ctx.shadowColor = '#ff5f5f'; ctx.shadowBlur = 18;
  ctx.fillText('ИГРА ОКОНЧЕНА', cx, cy - 58);
  ctx.shadowBlur = 0;

  ctx.font = `${Math.min(20,W*0.051)}px Segoe UI`;
  ctx.fillStyle = '#ffd700';
  ctx.fillText('Счёт: ' + score, cx, cy - 18);
  ctx.font = `${Math.min(14,W*0.036)}px Segoe UI`;
  ctx.fillStyle = '#aaa';
  ctx.fillText('Рекорд: ' + hi, cx, cy + 14);

  const bw = 140, bh = 46, bx = cx-bw/2, bby = cy+40;
  BTN['ЕЩЁРАЗ'] = { x:bx, y:bby, w:bw, h:bh };
  ctx.lineWidth = 2;
  rrect(bx, bby, bw, bh, 10, 'rgba(255,215,0,0.18)', '#ffd700');
  ctx.font = `bold ${Math.min(18,W*0.046)}px Segoe UI`; ctx.fillStyle = '#ffd700';
  ctx.fillText('ЕЩЁ РАЗ', cx, bby+bh/2);

  const mw = 130, mh = 34, mx = cx-mw/2, my = bby+bh+12;
  BTN['МЕНЮ_ГО'] = { x:mx, y:my, w:mw, h:mh };
  ctx.lineWidth = 1;
  rrect(mx, my, mw, mh, 8, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.18)');
  ctx.font = '14px Segoe UI'; ctx.fillStyle = '#888';
  ctx.fillText('В МЕНЮ', cx, my+mh/2);
}

function drawPause() {
  drawBoard(); drawHUD();
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.min(30,W*0.077)}px Segoe UI`;
  ctx.fillStyle = '#88eeff'; ctx.shadowColor = '#88eeff'; ctx.shadowBlur = 18;
  ctx.fillText('ПАУЗА', W/2, H/2 - 16);
  ctx.shadowBlur = 0;
  ctx.font = `${Math.min(13,W*0.033)}px Segoe UI`;
  ctx.fillStyle = '#778899';
  ctx.fillText('Нажмите P или кнопку для продолжения', W/2, H/2+18);
}

function draw() {
  ctx.fillStyle = '#060c18';
  ctx.fillRect(0, 0, W, H);
  switch (screen) {
    case 'menu':     drawMenu();             break;
    case 'game':     drawBoard(); drawHUD(); break;
    case 'help':     drawHelp();             break;
    case 'gameover': drawGameOver();         break;
    case 'pause':    drawPause();            break;
  }
}
