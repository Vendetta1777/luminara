// particles.js — the glowing light motes the creature drifts through.
// Now WORLD-space: motes wrap around the moving camera view (a toroidal field)
// so they always fill the screen and stream past as you descend. Uses a fixed,
// pre-allocated pool and pre-rendered glow sprites — no per-frame allocation or
// shadowBlur.

import { createGlowSprite } from './utils.js';

// Ocean palette — cohesive cool "underwater" tones (cyan, teal, soft blue,
// deep-sea violet). Each future biome will get its own palette.
const PALETTE = ['#5de4f5', '#34d399', '#60a5fa', '#a78bfa'];
const MAX_PARTICLES = 80;
const WRAP_MARGIN = 80;        // how far past the view edge before wrapping
const LIGHT_PER_MOTE = 8;      // glow-meter fill per absorbed mote

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/** A single drifting light mote in world space. Recycled in place. */
class Particle {
  constructor(view) {
    this.reset(view);
  }

  /** (Re)initialise at a random spot within the given view + a fresh look. */
  reset(view) {
    this.x = view.x + Math.random() * view.w;
    this.y = view.y + Math.random() * view.h;
    this.driftX = rand(-0.3, 0.3);      // px per ~16.67ms frame
    this.driftY = rand(-0.3, 0.3);
    this.pulseOffset = rand(0, Math.PI * 2);
    this.color = PALETTE[(Math.random() * PALETTE.length) | 0];
    this.size = rand(3, 12);
    this.opacity = rand(0.4, 1.0);
  }
}

/** A brief sparkle thrown off when a particle is absorbed. */
class Sparkle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const a = Math.random() * Math.PI * 2;
    const sp = rand(0.6, 2.2);
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.size = rand(1.5, 3);
    this.color = color;
    this.life = 1;          // 1 -> 0
    this.decay = 1 / 500;   // fades over ~0.5s (ms)
  }
}

export class ParticleSystem {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{x:number,y:number,w:number,h:number}} view  initial world view
   */
  constructor(canvas, view) {
    this.canvas = canvas;
    this.particles = [];
    this.sparkles = [];

    // Pre-render one glow sprite per colour once (stamped each frame).
    this.sprites = {};
    for (const col of PALETTE) {
      this.sprites[col] = createGlowSprite(col, 64);
    }

    // Pre-fill the pool once. Never exceeds MAX_PARTICLES.
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push(new Particle(view));
    }
  }

  update(deltaTime, player, view) {
    const dtf = deltaTime / 16.6667;
    const left = view.x - WRAP_MARGIN;
    const top = view.y - WRAP_MARGIN;
    const spanW = view.w + WRAP_MARGIN * 2;
    const spanH = view.h + WRAP_MARGIN * 2;

    for (const p of this.particles) {
      p.x += p.driftX * dtf;
      p.y += p.driftY * dtf;

      // Toroidal wrap around the moving view so the field always fills it and
      // streams past as the camera descends.
      if (p.x < left) p.x += spanW;
      else if (p.x > left + spanW) p.x -= spanW;
      if (p.y < top) p.y += spanH;
      else if (p.y > top + spanH) p.y -= spanH;

      // Collision via squared distance (no sqrt).
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const reach = player.size + p.size;
      if (dx * dx + dy * dy < reach * reach) {
        this._absorb(p, player, view);
      }
    }

    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.x += s.vx * dtf;
      s.y += s.vy * dtf;
      s.life -= s.decay * deltaTime;
      if (s.life <= 0) this.sparkles.splice(i, 1);
    }
  }

  /** Absorb a particle: feed the glow meter, throw sparkles, recycle the mote. */
  _absorb(p, player, view) {
    player.gainLight(LIGHT_PER_MOTE);
    for (let i = 0; i < 4; i++) {
      this.sparkles.push(new Sparkle(p.x, p.y, p.color));
    }
    p.reset(view);   // recycle in place — no allocation, count stays at 80
  }

  draw(ctx) {
    const now = Date.now();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const p of this.particles) {
      const pulse = 0.85 + 0.15 * Math.sin(now * 0.004 + p.pulseOffset);
      const glowR = p.size * pulse * 2.6;
      ctx.globalAlpha = p.opacity;
      ctx.drawImage(this.sprites[p.color], p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
    }

    for (const s of this.sparkles) {
      const sprite = this.sprites[s.color] || this.sprites[PALETTE[0]];
      const glowR = s.size * 2.2 * (0.4 + 0.6 * s.life);
      ctx.globalAlpha = s.life;
      ctx.drawImage(sprite, s.x - glowR, s.y - glowR, glowR * 2, glowR * 2);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
