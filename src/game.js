// game.js — the conductor.
// Owns the requestAnimationFrame loop and (later) orchestrates every system
// (world, particles, player, ui) in the correct draw order each frame.

import { clamp, lerp } from './utils.js';
import { Player } from './player.js';
import { ParticleSystem } from './particles.js';
import { Camera } from './camera.js';
import { createOceanLevel } from './level.js';
import { World } from './world.js';

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Logical size in CSS pixels (what all game systems work in). Set FIRST —
    // the camera and particle field below depend on it. Falls back to the
    // window size because clientWidth/Height can be 0 before layout. The canvas
    // backing buffer may be larger on high-DPI screens; main.js keeps these in
    // sync via resize().
    this.width = canvas.clientWidth || window.innerWidth;
    this.height = canvas.clientHeight || window.innerHeight;

    // The player creature (a physics body).
    this.player = new Player(canvas, ctx);

    // The atmosphere backdrop.
    this.world = new World();

    // The level geometry; place the creature at its spawn point.
    this.level = createOceanLevel();
    this.player.x = this.level.spawn.x;
    this.player.y = this.level.spawn.y;
    this.player.aimX = this.player.x;
    this.player.aimY = this.player.y;

    // Steering input in WORLD coordinates, written by main.js each event.
    this.input = { thrusting: false, aimX: this.player.x, aimY: this.player.y };

    // Follow-camera, snapped to frame the creature at startup (no opening jolt).
    this.camera = new Camera();
    this.camera.snapTo(this.player.x, this.player.y, this.width, this.height);

    // The field of light motes, spawned across the initial view.
    this.particles = new ParticleSystem(canvas, this._view());

    this.running = false;
    this.lastTime = 0;     // timestamp of the previous frame (ms)
    this.frameCount = 0;   // total frames since start, for periodic logging
    this.fps = 0;          // smoothed, honest frame rate for the on-screen counter
    this._loop = this._loop.bind(this); // stable reference for rAF
  }

  /** Update the logical screen size (CSS pixels). Called by main.js on resize. */
  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  /** Current world-space view rectangle (camera position + screen size). */
  _view() {
    return { x: this.camera.x, y: this.camera.y, w: this.width, h: this.height };
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

    // Raw interval drives the honest FPS readout; the clamped one drives motion
    // (so a backgrounded tab returning to focus can't produce a huge jump).
    const raw = now - this.lastTime;
    const deltaTime = clamp(raw, 0, 50);
    this.lastTime = now;
    this.frameCount++;
    if (raw > 0) {
      const inst = 1000 / raw;
      this.fps = this.fps ? lerp(this.fps, inst, 0.1) : inst;
    }

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
    this.player.update(deltaTime, this.input);
    const impact = this.level.collide(this.player);
    if (impact > 6) this.camera.triggerShake(Math.min(9, impact * 0.6));
    this.camera.updateShake(deltaTime);
    this.camera.follow(this.player.x, this.player.y, this.width, this.height, deltaTime);
    this.particles.update(deltaTime, this.player, this._view());
    // ui updates arrive in later milestones.
  }

  /** Render: atmosphere backdrop → world (via camera) → vignette → HUD. */
  draw() {
    const { ctx } = this;
    this.world.drawBackground(ctx, this.camera, this.width, this.height);

    ctx.save();
    this.camera.apply(ctx);
    this.particles.draw(ctx);          // ambient motes (behind the rock)
    this.level.draw(ctx, this._view()); // coral geometry
    this.player.draw(ctx);             // creature on top
    ctx.restore();

    this.world.drawOverlay(ctx, this.width, this.height);
    this._drawFps(ctx);   // HUD stays screen-fixed
  }

  /** Tiny, unobtrusive FPS readout, top-left. */
  _drawFps(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '12px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.round(this.fps)} fps`, 10, 10);
    ctx.restore();
  }
}
