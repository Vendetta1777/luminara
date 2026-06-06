// projectiles.js — water-torpedo projectiles (and later, enemy shots).
// A simple managed list: each bolt travels in a straight line, dies on hitting
// rock (splash) or after its range, and damages whatever it's allowed to hit.
// Enemies become targets in Milestone 14 via `update(dt, level, enemies)`.

import { createGlowSprite, hexToRgba } from './utils.js';

const TAU = Math.PI * 2;

class Projectile {
  constructor(x, y, vx, vy, opts) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.speed = Math.hypot(vx, vy);
    this.range = opts.range;
    this.dist = 0;
    this.damage = opts.damage;
    this.radius = opts.radius || 7;
    this.team = opts.team || 'player';   // 'player' | 'enemy'
    this.dead = false;
  }
}

export class ProjectileSystem {
  constructor() {
    this.list = [];
    this.splashes = [];
    this.sprite = createGlowSprite('#8af0ff', 48);
  }

  spawn(x, y, vx, vy, opts) {
    this.list.push(new Projectile(x, y, vx, vy, opts));
  }

  /**
   * Advance bolts; kill on range or rock. `enemies` (optional) are damaged by
   * player bolts. Returns nothing — damage is applied directly.
   */
  update(deltaTime, level, enemies) {
    const dtf = deltaTime / 16.6667;
    for (const p of this.list) {
      p.x += p.vx * dtf;
      p.y += p.vy * dtf;
      p.dist += p.speed * dtf;
      if (p.dist > p.range) { p.dead = true; continue; }
      if (level.pointInSolid(p.x, p.y)) { p.dead = true; this._splash(p); continue; }

      if (enemies && p.team === 'player') {
        for (const e of enemies) {
          if (e.dead) continue;
          const dx = p.x - e.x, dy = p.y - e.y;
          if (dx * dx + dy * dy < (e.radius + p.radius) * (e.radius + p.radius)) {
            e.hit(p.damage);
            p.dead = true;
            this._splash(p);
            break;
          }
        }
      }
    }
    if (this.list.some((p) => p.dead)) this.list = this.list.filter((p) => !p.dead);

    for (const s of this.splashes) s.life -= deltaTime * 0.004;
    if (this.splashes.some((s) => s.life <= 0)) {
      this.splashes = this.splashes.filter((s) => s.life > 0);
    }
  }

  _splash(p) {
    this.splashes.push({ x: p.x, y: p.y, life: 1 });
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      const len = p.radius * 4.2, wid = p.radius * 2;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.sprite, -len * 0.6, -wid / 2, len, wid);
      ctx.restore();
    }
    for (const s of this.splashes) {
      const r = (1 - s.life) * 22 + 4;
      ctx.globalAlpha = s.life * 0.5;
      ctx.strokeStyle = hexToRgba('#8af0ff', 1);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
