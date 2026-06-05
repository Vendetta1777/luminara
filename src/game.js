// game.js — the conductor.
// Owns the requestAnimationFrame loop and (later) orchestrates every system
// (world, particles, player, ui) in the correct draw order each frame.

import { clamp } from './utils.js';
import { Player } from './player.js';

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // The player creature. Input (main.js) steers it via player.targetX/Y.
    this.player = new Player(canvas, ctx);

    // Logical size in CSS pixels (what all game systems work in). The canvas
    // backing buffer may be larger on high-DPI screens; main.js keeps these
    // in sync via resize().
    this.width = canvas.clientWidth;
    this.height = canvas.clientHeight;

    this.running = false;
    this.lastTime = 0;     // timestamp of the previous frame (ms)
    this.frameCount = 0;   // total frames since start, for periodic logging
    this._loop = this._loop.bind(this); // stable reference for rAF
  }

  /** Update the logical screen size (CSS pixels). Called by main.js on resize. */
  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  /** Begin the loop. */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    requestAnimationFrame(this._loop);
  }

  /** Halt the loop. */
  stop() {
    this.running = false;
  }

  /**
   * The heartbeat. Called by requestAnimationFrame with a high-precision
   * timestamp. Computes delta time, advances the game, draws it, and
   * requests the next frame.
   * @param {number} now
   */
  _loop(now) {
    if (!this.running) return;

    // Milliseconds since the previous frame. Capped so a backgrounded tab
    // returning to focus can't produce a huge jump (refined in Milestone 9).
    const deltaTime = clamp(now - this.lastTime, 0, 50);
    this.lastTime = now;
    this.frameCount++;

    this.update(deltaTime);
    this.draw();

    if (this.frameCount % 60 === 0) {
      console.log(`Luminara running — frame ${this.frameCount}`);
    }

    requestAnimationFrame(this._loop);
  }

  /**
   * Advance all game systems. `deltaTime` (ms) scales motion so the game runs
   * at the same real speed regardless of frame rate.
   * Systems get wired in over the coming milestones.
   */
  update(deltaTime) {
    this.player.update(deltaTime);
    // world / particles / ui updates arrive in later milestones.
  }

  /** Render one frame: clear to the deep ocean, then draw the player on top. */
  draw() {
    const { ctx } = this;
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, this.width, this.height);

    this.player.draw(ctx);
  }
}
