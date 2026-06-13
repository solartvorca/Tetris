'use strict';

function loop(ts) {
  draw();
  if (screen !== 'game') return;
  if (flashSet.size > 0) { animId = requestAnimationFrame(loop); return; }

  if (ts - lastDrop > dropInterval) {
    lastDrop = ts;
    const moved = {...piece, row:piece.row+1};
    if (valid(moved)) { piece = moved; }
    else { lockPiece(); return; }
  }
  animId = requestAnimationFrame(loop);
}

window.addEventListener('resize', () => { resize(); draw(); });
resize();
hi = +localStorage.getItem('nt5_hi') || 0;
draw();
