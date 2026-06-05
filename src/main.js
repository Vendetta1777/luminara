// main.js — bootstrap.
// The ONLY file that touches the DOM directly: sizes the canvas, gets the 2D
// context, builds the Game, and starts the loop. Kept intentionally thin.

import { Game } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/**
 * Size the canvas's backing buffer to fill the screen. We use the device pixel
 * ratio so rendering stays crisp on high-DPI (Retina) displays: the buffer is
 * larger than the CSS size, and we scale the context to compensate so all game
 * code can keep working in plain CSS pixels.
 */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (game) game.resize(window.innerWidth, window.innerHeight);
}

const game = new Game(canvas, ctx);
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

game.start();

console.log('Luminara — game loop started.');
