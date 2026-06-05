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
  // Cap at 2: beyond that the extra pixels cost a lot of fill rate for almost
  // no visible gain on these soft glows.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (game) game.resize(window.innerWidth, window.innerHeight);
}

const game = new Game(canvas, ctx);
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Unified input: one handler for mouse, touch, and pen via Pointer Events.
// We convert the pointer to WORLD coordinates (screen + camera offset) so the
// creature aims at the right spot as the world scrolls.
//
// Pulse-Jet: press & hold to charge (the creature contracts), release to fire a
// burst toward the cursor. `thrusting` means "charging" to the player.
function aimAt(e) {
  const rect = canvas.getBoundingClientRect();
  game.input.aimX = (e.clientX - rect.left) + game.camera.x;
  game.input.aimY = (e.clientY - rect.top) + game.camera.y;
}
window.addEventListener('pointermove', aimAt);
window.addEventListener('pointerdown', (e) => {
  aimAt(e);
  if (e.button === 2) {
    game.player.burstDash(game.input.aimX, game.input.aimY);  // right-click = dash
  } else {
    game.input.thrusting = true;                              // left = charge
  }
});
window.addEventListener('pointerup', (e) => { if (e.button !== 2) game.input.thrusting = false; });
window.addEventListener('pointercancel', () => { game.input.thrusting = false; });
window.addEventListener('contextmenu', (e) => e.preventDefault()); // free up right-click

// Keyboard: Space = Burst-Dash toward the cursor, F = Flare.
// (Tether/Shift is deferred to the Forest biome.)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    game.player.burstDash(game.input.aimX, game.input.aimY);
  } else if (e.key === 'f' || e.key === 'F') {
    game.player.flare();
  } else if (e.key === 'r' || e.key === 'R') {
    game.respawn();   // back to the last checkpoint
  }
});

game.start();

console.log('Luminara — game loop started.');
