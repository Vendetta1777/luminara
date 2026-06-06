// enemies.js — hostile creatures and the system that runs them.
// Pass 1: Darter (fast chaser that lunges) and Gatekeeper (tanky territorial
// blocker). Ranged + dark-ambusher types arrive in the next pass. Each enemy
// has HP (hit() by torpedoes), deals contact damage, and dies.

import { hexToRgba } from './utils.js';

const TAU = Math.PI * 2;

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 16;
    this.hp = 30;
    this.maxHp = 30;
    this.contactDmg = 14;
    this.knockback = 10;
    this.color = '#ff7a59';
    this.dead = false;
    this.hitFlash = 0;
  }

  /** Take torpedo damage. */
  hit(amount) {
    this.hp -= amount;
    this.hitFlash = 1;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  /** Contact damage to the player, with mutual knockback. */
  _contact(player) {
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < player.size + this.radius && player.damage(this.contactDmg)) {
      const nx = dx / d, ny = dy / d;
      player.vx += nx * this.knockback;
      player.vy += ny * this.knockback;
      this.vx -= nx * 4;
      this.vy -= ny * 4;
    }
  }

  _decay(dt) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 0.004);
  }

  /** Damage flash makes the body white briefly. */
  _bodyColor() {
    return this.hitFlash > 0 ? '#ffffff' : this.color;
  }

  /** Small HP arc shown once damaged. */
  _drawHpArc(ctx, r) {
    if (this.hp >= this.maxHp) return;
    const frac = this.hp / this.maxHp;
    ctx.strokeStyle = hexToRgba('#ff5d73', 0.8);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r + 8, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
    ctx.stroke();
  }
}

/** Darter — fast, low-HP fish that chases and periodically lunges at you. */
class Darter extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.radius = 14;
    this.hp = this.maxHp = 30;
    this.contactDmg = 14;
    this.color = '#ff8a4c';
    this.dartTimer = Math.random() * 2000;
    this.dartTime = 0;
    this.canChase = true;          // counts toward the aggro cap
    this.detectRange = 520;        // only engages within this range
    this.aggro = false;            // set by EnemySystem (capped # of chasers)
    this.wanderPhase = Math.random() * TAU;
  }

  update(dt, player) {
    const dtf = dt / 16.6667;
    let maxsp;

    if (this.aggro) {
      const dx = player.x - this.x, dy = player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      this.dartTimer -= dt;
      if (this.dartTimer <= 0 && d < 480) {
        this.dartTime = 320;
        this.dartTimer = 1500 + Math.random() * 900;
      }
      let accel;
      if (this.dartTime > 0) { this.dartTime -= dt; accel = 1.4; maxsp = 12; }
      else { accel = 0.42; maxsp = 5.5; }
      this.vx += nx * accel * dtf;
      this.vy += ny * accel * dtf;
    } else {
      // Not chasing — drift idly until it gets an aggro slot.
      this.dartTime = 0;
      this.wanderPhase += dt * 0.0012;
      this.vx += Math.cos(this.wanderPhase) * 0.05 * dtf;
      this.vy += Math.sin(this.wanderPhase * 0.8) * 0.05 * dtf;
      maxsp = 1.8;
    }

    const drag = Math.pow(this.aggro ? 0.92 : 0.96, dtf);
    this.vx *= drag; this.vy *= drag;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > maxsp) { this.vx = (this.vx / sp) * maxsp; this.vy = (this.vy / sp) * maxsp; }
    this.x += this.vx * dtf;
    this.y += this.vy * dtf;

    this._contact(player);
    this._decay(dt);
  }

  draw(ctx) {
    const ang = Math.atan2(this.vy, this.vx);
    const r = this.radius;
    const c = this._bodyColor();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.4);
    g.addColorStop(0, hexToRgba(c, 0.6));
    g.addColorStop(1, hexToRgba(this.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 2.4, 0, TAU);
    ctx.fill();

    ctx.translate(this.x, this.y);
    ctx.rotate(ang);
    ctx.fillStyle = hexToRgba(c, 0.92);
    ctx.beginPath();
    ctx.moveTo(r * 1.7, 0);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.9, -r * 1.3, 0);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.9, r * 1.7, 0);
    ctx.fill();
    ctx.beginPath();           // tail fin
    ctx.moveTo(-r * 1.1, 0);
    ctx.lineTo(-r * 2, r * 0.7);
    ctx.lineTo(-r * 2, -r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Gatekeeper — tanky, territorial; guards its spot and hits hard up close. */
class Gatekeeper extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.homeX = x;
    this.homeY = y;
    this.radius = 30;
    this.hp = this.maxHp = 140;
    this.contactDmg = 22;
    this.knockback = 16;
    this.color = '#ff5d73';
  }

  update(dt, player) {
    const dtf = dt / 16.6667;
    const d = Math.hypot(player.x - this.x, player.y - this.y) || 1;
    const chasing = d < 280;
    const tx = chasing ? player.x : this.homeX;
    const ty = chasing ? player.y : this.homeY;
    const ddx = tx - this.x, ddy = ty - this.y, dd = Math.hypot(ddx, ddy) || 1;
    const accel = chasing ? 0.34 : 0.14;
    this.vx += (ddx / dd) * accel * dtf;
    this.vy += (ddy / dd) * accel * dtf;
    const drag = Math.pow(0.9, dtf);
    this.vx *= drag; this.vy *= drag;
    const maxsp = chasing ? 3.2 : 1.8;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > maxsp) { this.vx = (this.vx / sp) * maxsp; this.vy = (this.vy / sp) * maxsp; }
    this.x += this.vx * dtf;
    this.y += this.vy * dtf;

    this._contact(player);
    this._decay(dt);
  }

  draw(ctx) {
    const r = this.radius;
    const c = this._bodyColor();
    ctx.save();
    ctx.fillStyle = '#1a0a10';        // dark armored body
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, TAU);
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexToRgba(c, 0.6);
    ctx.lineWidth = 3;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (const s of [-1, 1]) {        // glowing eyes
      const ex = this.x + s * r * 0.42, ey = this.y - r * 0.2;
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 0.32);
      g.addColorStop(0, hexToRgba('#ffffff', 0.95));
      g.addColorStop(0.5, hexToRgba(c, 0.8));
      g.addColorStop(1, hexToRgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.32, 0, TAU);
      ctx.fill();
    }
    this._drawHpArc(ctx, r);
    ctx.restore();
  }
}

function createEnemy(x, y, type) {
  switch (type) {
    case 'gatekeeper': return new Gatekeeper(x, y);
    case 'darter':
    default: return new Darter(x, y);
  }
}

export class EnemySystem {
  constructor(spawns = []) {
    this.list = spawns.map((s) => createEnemy(s.x, s.y, s.type));
    this.total = this.list.length;
    this.kills = 0;
  }

  update(dt, player, level) {
    // Cap how many chasers can aggro at once — only the nearest few engage,
    // so you can never be swarmed by the whole school.
    const MAX_AGGRO = 2;
    const chasers = this.list.filter((e) => !e.dead && e.canChase);
    chasers.sort((a, b) =>
      ((a.x - player.x) ** 2 + (a.y - player.y) ** 2) -
      ((b.x - player.x) ** 2 + (b.y - player.y) ** 2));
    let slots = MAX_AGGRO;
    for (const e of chasers) {
      const inRange = Math.hypot(e.x - player.x, e.y - player.y) < e.detectRange;
      e.aggro = inRange && slots > 0;
      if (e.aggro) slots--;
    }

    for (const e of this.list) if (!e.dead) e.update(dt, player, level);
    const dead = this.list.filter((e) => e.dead);
    if (dead.length) {
      this.kills += dead.length;
      this.list = this.list.filter((e) => !e.dead);
    }
  }

  draw(ctx, view) {
    const pad = 70;
    for (const e of this.list) {
      if (e.x < view.x - pad || e.x > view.x + view.w + pad ||
          e.y < view.y - pad || e.y > view.y + view.h + pad) continue;
      e.draw(ctx);
    }
  }
}
