// game.js — the conductor.
// Owns the requestAnimationFrame loop and (later) orchestrates every system
// (world, particles, player, ui) in the correct draw order each frame.

import { clamp, lerp, hexToRgba } from './utils.js';
import { Player } from './player.js';
import { ParticleSystem } from './particles.js';
import { Camera } from './camera.js';
import { createOceanLevel } from './level.js';
import { World } from './world.js';
import { ProjectileSystem } from './projectiles.js';

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
    this.input = { thrusting: false, firing: false, aimX: this.player.x, aimY: this.player.y };

    // Water-torpedo projectiles.
    this.projectiles = new ProjectileSystem();

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

  /** Grapple the in-range anchor nearest the cursor. Ignored if already tethered. */
  tetherPress() {
    if (this.player.tetherAnchor) return;
    const range = this.level.tetherRange;
    let best = null, bestD = Infinity;
    for (const a of this.level.anchors) {
      if (Math.hypot(a.x - this.player.x, a.y - this.player.y) > range) continue;
      const ad = Math.hypot(a.x - this.input.aimX, a.y - this.input.aimY);
      if (ad < bestD) { bestD = ad; best = a; }
    }
    if (best) this.player.attachTether(best);
  }

  tetherRelease() {
    this.player.releaseTether();
  }

  /** Fire a water torpedo toward the cursor (gated by the weapon cooldown). */
  fire() {
    const p = this.player;
    if (p.fireCooldown > 0 || p.dead) return;
    const dx = this.input.aimX - p.x, dy = this.input.aimY - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    this.projectiles.spawn(p.x + ux * p.size, p.y + uy * p.size, ux * p.torpedoSpeed, uy * p.torpedoSpeed, {
      range: p.torpedoRange, damage: p.torpedoDamage, radius: 7, team: 'player',
    });
    p.fireCooldown = p.fireRate;
    p.vx -= ux * 1.2;   // gentle recoil
    p.vy -= uy * 1.2;
  }

  /** Respawn the creature at the last activated checkpoint. */
  respawn() {
    const r = this.level.respawn;
    this.player.respawnAt(r.x, r.y);
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
    if (this.input.firing) this.fire();
    this.player.update(deltaTime, this.input);
    this.projectiles.update(deltaTime, this.level);
    const impact = this.level.collide(this.player);
    if (impact > 6) this.camera.triggerShake(Math.min(9, impact * 0.6));

    const ev = this.level.interact(this.player, deltaTime);
    if (ev.hazardHit) this.camera.triggerShake(7);
    if (ev.gateOpened) console.log('Light-gate opened — the path to the next world awaits.');

    if (this.player.dead) {
      this.respawn();                 // back to the last checkpoint, restored
      this.camera.triggerShake(10);
    }

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
    this.level.draw(ctx, this._view(), this.player); // coral geometry + anchors
    this.player.draw(ctx);             // creature on top
    this.projectiles.draw(ctx);        // torpedoes over everything in-world
    ctx.restore();

    // Abyss darkness + flashlight (Flare widens the lit radius).
    const lightRadius = 220 + this.player.flareTime * 720;
    this.world.drawDarkness(ctx, this.camera, this.player.x, this.player.y,
      this.width, this.height, lightRadius);

    this.world.drawOverlay(ctx, this.width, this.height);

    // Red flash when the creature takes damage.
    if (this.player.hurtFlash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 40, 60, ${0.35 * this.player.hurtFlash})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    this._drawFps(ctx);          // HUD stays screen-fixed
    this._drawHpBar(ctx);
    this._drawLightMeter(ctx);
  }

  /** Temporary HP bar (full HUD arrives in Milestone 19). */
  _drawHpBar(ctx) {
    const p = this.player;
    const x = 12, y = this.height - 52, w = 160, h = 7;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x, y, w, h);
    const frac = Math.max(0, p.hp / p.maxHp);
    const col = frac > 0.5 ? '#67e58a' : frac > 0.25 ? '#f5c451' : '#ff5d73';
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w * frac, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '11px monospace';
    ctx.textBaseline = 'bottom';
    ctx.fillText('hp', x, y - 3);
    ctx.restore();
  }

  /** Temporary glow-meter readout (the full HUD arrives in Milestone 13). */
  _drawLightMeter(ctx) {
    const p = this.player;
    const x = 12, y = this.height - 22, w = 160, h = 6;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x, y, w, h);
    const ready = p.light >= p.dashCost;
    ctx.fillStyle = hexToRgba('#5de4f5', ready ? 0.85 : 0.4);
    ctx.fillRect(x, y, w * (p.light / p.maxLight), h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '11px monospace';
    ctx.textBaseline = 'bottom';
    ctx.fillText('light', x, y - 3);
    ctx.restore();
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
