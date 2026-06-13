'use strict';

function inBtn(k, mx, my) {
  const b = BTN[k];
  return b && mx>=b.x && mx<=b.x+b.w && my>=b.y && my<=b.y+b.h;
}

function tapGame(mx, my) {
  if (flashSet.size > 0) return;
  if (inBtn('ТАБЛ.',mx,my))  { prevScreen='game'; screen='help'; draw(); return; }
  if (inBtn('ПАУЗА',mx,my)) { screen='pause'; draw(); return; }
  if (inBtn('МЕНЮ',mx,my))  { screen='menu'; draw(); return; }
  if (mx < GX + COLS*CELL/2) { const m={...piece,col:piece.col-1}; if(valid(m)) piece=m; }
  else piece = rotate(piece);
}

function handleTap(mx, my) {
  switch(screen) {
    case 'menu':
      if (inBtn('СТАРТ',mx,my))    { startGame(); return; }
      if (inBtn('ТАБ_МЕНЮ',mx,my)) { prevScreen='menu'; screen='help'; draw(); return; }
      if (inBtn('ГЛАВНАЯ',mx,my))  { window.location.href='index.html'; return; }
      break;
    case 'game':     tapGame(mx, my); break;
    case 'help':
      if (inBtn('НАЗАД',mx,my)) {
        screen = prevScreen;
        if (screen==='game') animId = requestAnimationFrame(loop);
        else draw();
      }
      break;
    case 'gameover':
      if (inBtn('ЕЩЁРАЗ',mx,my))  { startGame(); return; }
      if (inBtn('МЕНЮ_ГО',mx,my)) { screen='menu'; draw(); return; }
      break;
    case 'pause':
      screen = 'game'; animId = requestAnimationFrame(loop); break;
  }
}

document.addEventListener('keydown', e => {
  if (screen === 'help') {
    if (e.key==='Escape'||e.key==='h'||e.key==='H') {
      screen = prevScreen;
      if (screen==='game') animId = requestAnimationFrame(loop); else draw();
    }
    return;
  }
  if (screen === 'menu')    { if(e.key==='Enter'||e.key===' ') startGame(); return; }
  if (screen === 'gameover'){ if(e.key==='Enter'||e.key==='r'||e.key==='R') startGame(); return; }
  if (screen === 'pause') {
    if (e.key==='p'||e.key==='P'||e.key==='Escape') { screen='game'; animId=requestAnimationFrame(loop); }
    return;
  }
  if (screen !== 'game' || flashSet.size > 0) return;

  switch(e.key) {
    case 'ArrowLeft':  { const m={...piece,col:piece.col-1}; if(valid(m)) piece=m; e.preventDefault(); break; }
    case 'ArrowRight': { const m={...piece,col:piece.col+1}; if(valid(m)) piece=m; e.preventDefault(); break; }
    case 'ArrowDown':  {
      const m={...piece,row:piece.row+1};
      if(valid(m)) { piece=m; lastDrop=performance.now(); } else lockPiece();
      e.preventDefault(); break;
    }
    case 'ArrowUp': case 'z': case 'Z': piece=rotate(piece); e.preventDefault(); break;
    case ' ': hardDrop(); e.preventDefault(); break;
    case 'p': case 'P': screen='pause'; draw(); break;
    case 'Escape': screen='menu'; draw(); break;
  }
});

let t0 = null;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  t0 = {x:e.touches[0].clientX, y:e.touches[0].clientY};
}, {passive:false});
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (!t0) return;
  const dx = e.changedTouches[0].clientX - t0.x;
  const dy = e.changedTouches[0].clientY - t0.y;
  const adx=Math.abs(dx), ady=Math.abs(dy);

  if (adx<14 && ady<14) {
    handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  } else if (screen==='game' && flashSet.size===0) {
    if (adx > ady) {
      const steps = Math.max(1, Math.round(adx / CELL));
      const dir = dx > 0 ? 1 : -1;
      let p = {...piece};
      for (let i=0; i<steps; i++) { const m={...p,col:p.col+dir}; if(valid(m)) p=m; else break; }
      piece = p;
    } else if (dy > 50) {
      hardDrop();
    } else if (dy < -30) {
      piece = rotate(piece);
    }
  }
  t0 = null;
}, {passive:false});

canvas.addEventListener('click', e => { handleTap(e.clientX, e.clientY); });
