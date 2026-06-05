// particles.js — the glowing light particles the creature absorbs to grow.
// Core mechanic: drift, collide, absorb (recycle), sparkle. Uses a fixed,
// pre-allocated pool so the particle count never grows and the steady state
// allocates nothing — no garbage-collection stutters.

import { clamp, hexToRgba } from './utils.js';

// Ocean palette — cohesive cool "underwater" tones (cyan, teal, soft blue,
// deep-sea violet). In Milestone 5 this moves into the Ocean biome definition.
const PALETTE = ['#5de4f5', '#34d399', '#60a5fa', '#a78bfa'];
const SPECIAL_COLOR = '#ff8fab';   // rare warm coral pip — a treat amid the cool
const SPECIAL_CHANCE = 0.08;       // ~8% of motes are special
const MAX_PARTICLES = 80;
const EDGE_MARGIN = 40;   // keep spawns away from the very edges
const PLAYER_SIZE_CAP = 80;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/** A single drifting light mote. Recycled in place on absorption. */
class Particle {
  constructor(width, height) {
    this.reset(width, height);
  }

  /** (Re)initialise this particle at a fresh random position + look. */
  reset(width, height) {
    this.x = rand(EDGE_MARGIN, width - EDGE_MARGIN);
    this.y = rand(EDGE_MARGIN, height - EDGE_MARGIN);
    this.driftX = rand(-0.3, 0.3);      // px per ~16.67ms frame
    this.driftY = rand(-0.3, 0.3);
    this.pulseOffset = rand(0, Math.PI * 2);

    // Rare warm "special" mote: brighter and a little bigger so it stands out
    // against the cool palette. Worth more growth when absorbed.
    this.special = Math.random() < SPECIAL_CHANCE;
    if (this.special) {
      this.color = SPECIAL_COLOR;
      this.size = rand(8, 14);
      this.opacity = rand(0.85, 1.0);
    } else {
      this.color = PALETTE[(Math.random() * PALETTE.length) | 0];
      this.size = rand(3, 12);
      this.opacity = rand(0.4, 1.0);
    }
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
    this.decay = 1 / 500;   // fully fades over ~0.5s (ms)
  }
}

export class ParticleSystem {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.particles = [];
    this.sparkles = [];

    // Pre-fill the pool once. Never exceeds MAX_PARTICLES.
    const { w, h } = this._bounds();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push(new Particle(w, h));
    }
  }

  /** Current logical canvas size (CSS pixels), tracked live on resize. */
  _bounds() {
    return {
      w: this.canvas.clientWidth || window.innerWidth,
      h: this.canvas.clientHeight || window.innerHeight,
    };
  }

  update(deltaTime, player) {
    const dtf = deltaTime / 16.6667;   // frame-rate normalisation factor
    const { w, h } = this._bounds();

    for (const p of this.particles) {
      // Drift, wrapping softly around the screen so motes never pile at edges.
      p.x += p.driftX * dtf;
      p.y += p.driftY * dtf;
      if (p.x < -EDGE_MARGIN) p.x = w + EDGE_MARGIN;
      else if (p.x > w + EDGE_MARGIN) p.x = -EDGE_MARGIN;
      if (p.y < -EDGE_MARGIN) p.y = h + EDGE_MARGIN;
      else if (p.y > h + EDGE_MARGIN) p.y = -EDGE_MARGIN;

      // Collision via squared distance (no sqrt).
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const reach = player.size + p.size;
      if (dx * dx + dy * dy < reach * reach) {
        this._absorb(p, player, w, h);
      }
    }

    // Advance sparkles; drop the dead ones.
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.x += s.vx * dtf;
      s.y += s.vy * dtf;
      s.life -= s.decay * deltaTime;
      if (s.life <= 0) this.sparkles.splice(i, 1);
    }
  }

  /** Absorb a particle: grow the player, throw sparkles, recycle the mote. */
  _absorb(p, player, w, h) {
    const growth = p.special ? 1.2 : 0.5;   // special coral motes are worth more
    const sparks = p.special ? 8 : 4;
    player.size = clamp(player.size + growth, 0, PLAYER_SIZE_CAP);
    for (let i = 0; i < sparks; i++) {
      this.sparkles.push(new Sparkle(p.x, p.y, p.color));
    }
    p.reset(w, h);   // recycle in place — no allocation, count stays at 80
  }

  draw(ctx) {
    const now = Date.now();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Drifting motes — soft glowing orbs with a gentle individual pulse.
    for (const p of this.particles) {
      const pulse = 0.85 + 0.15 * Math.sin(now * 0.004 + p.pulseOffset);
      const r = p.size * pulse;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.special ? 22 : 14;   // special motes bloom brighter
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, hexToRgba('#ffffff', p.opacity));
      g.addColorStop(0.4, hexToRgba(p.color, p.opacity));
      g.addColorStop(1, hexToRgba(p.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sparkle bursts — tiny bright flecks fading over half a second.
    ctx.shadowBlur = 0;
    for (const s of this.sparkles) {
      const r = s.size * s.life;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, Math.max(0.5, r * 2));
      g.addColorStop(0, hexToRgba('#ffffff', s.life));
      g.addColorStop(0.5, hexToRgba(s.color, s.life * 0.8));
      g.addColorStop(1, hexToRgba(s.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.5, r * 2), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
