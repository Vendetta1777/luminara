// level.js — solid geometry the creature collides with.
// Collision uses axis-aligned rectangles (reliable + cheap), but each is drawn
// as organic dark coral rock with a glowing bioluminescent rim, so it reads as
// an ocean shelf rather than a block. Levels are pure data (spawn + solids) so
// every biome can supply its own layout.

import { clamp, hexToRgba } from './utils.js';

const TAU = Math.PI * 2;

/** Build a solid rectangle, precomputing its edges. */
function rect(x, y, w, h, ledge = false) {
  return { x, y, w, h, left: x, top: y, right: x + w, bottom: y + h, ledge };
}

/** World-space y of the wavy top edge at column x (deterministic per solid). */
function topWave(s, x) {
  return s.top + Math.sin(x * 0.05 + s.left * 0.013) * 5;
}

export class Level {
  /**
   * @param {{x:number,y:number}} spawn  where the creature starts
   * @param {Array} solids  collidable rectangles
   */
  constructor(spawn, solids, anchors = []) {
    this.spawn = spawn;
    this.solids = solids;
    this.anchors = anchors;    // grapple points {x, y, phase}
    this.restitution = 0.35;   // bounciness on impact (0 = dead stop, 1 = full)
    this.tetherRange = 340;    // how far the tendril can reach

    this.hazards = [];         // {x, y, r, phase} — knock you back + drain light
    this.checkpoints = [];     // {x, y, r, active, phase} — respawn anemones
    this.currents = [];        // {x, y, w, h, fx, fy} — flow zones that push you
    this.gate = null;          // {x, y, r, charge, required, open}
    this.respawn = { ...spawn };
  }

  /**
   * Per-frame interactions (hazards, checkpoints, gate). Returns events for the
   * game to react to (shake, transition). Forgiving: hazards never kill.
   */
  interact(player, deltaTime) {
    const dtf = deltaTime / 16.6667;
    let hazardHit = false;
    let gateOpened = false;

    // Currents push the creature while it's inside a flow zone.
    for (const c of this.currents) {
      if (player.x > c.x && player.x < c.x + c.w &&
          player.y > c.y && player.y < c.y + c.h) {
        player.vx += c.fx * dtf;
        player.vy += c.fy * dtf;
      }
    }

    // Hazards — damage + knock the creature away, unless invulnerable
    // (a dash's i-frames punch straight through). damage() handles i-frames.
    for (const hz of this.hazards) {
      const dx = player.x - hz.x, dy = player.y - hz.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < player.size + hz.r && player.damage(18)) {
        player.vx = (dx / d) * 13;
        player.vy = (dy / d) * 13;
        hazardHit = true;
      }
    }

    // Checkpoints — light up the anemone on touch; it becomes the respawn.
    for (const cp of this.checkpoints) {
      if (!cp.active && Math.hypot(player.x - cp.x, player.y - cp.y) < player.size + cp.r) {
        cp.active = true;
        this.respawn = { x: cp.x, y: cp.y - 40 };
      }
    }

    // Light-gate — pour your light into it when close; opens when charged.
    const gate = this.gate;
    if (gate && !gate.open) {
      const d = Math.hypot(player.x - gate.x, player.y - gate.y);
      if (d < gate.r + 70) {
        const give = Math.min(player.light, 1.4 * dtf, gate.required - gate.charge);
        if (give > 0) { player.light -= give; gate.charge += give; }
        if (gate.charge >= gate.required) { gate.open = true; gateOpened = true; }
      }
    }

    return { hazardHit, gateOpened };
  }

  /**
   * Resolve the creature against every solid: push it out of overlaps and strip
   * the velocity going INTO each surface so it slides instead of sticking.
   */
  collide(player) {
    const r = player.size;
    let maxImpact = 0;
    for (const s of this.solids) {
      // Closest point on the rectangle to the creature's centre.
      const cx = clamp(player.x, s.left, s.right);
      const cy = clamp(player.y, s.top, s.bottom);
      let dx = player.x - cx;
      let dy = player.y - cy;
      let d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;   // no overlap

      let dist, nx, ny;
      if (d2 > 0.0001) {
        dist = Math.sqrt(d2);
        nx = dx / dist;
        ny = dy / dist;
      } else {
        // Centre is inside the rect — push out along the shallowest axis.
        const toLeft = player.x - s.left;
        const toRight = s.right - player.x;
        const toTop = player.y - s.top;
        const toBottom = s.bottom - player.y;
        const minX = Math.min(toLeft, toRight);
        const minY = Math.min(toTop, toBottom);
        if (minX < minY) { nx = toLeft < toRight ? -1 : 1; ny = 0; dist = -minX; }
        else { nx = 0; ny = toTop < toBottom ? -1 : 1; dist = -minY; }
      }

      // Push out so the creature just rests against the surface.
      player.x += nx * (r - dist);
      player.y += ny * (r - dist);

      // Remove velocity into the surface, then bounce back by `restitution`.
      const vn = player.vx * nx + player.vy * ny;
      if (vn < 0) {
        if (-vn > maxImpact) maxImpact = -vn;
        player.vx -= (1 + this.restitution) * vn * nx;
        player.vy -= (1 + this.restitution) * vn * ny;
      }
    }
    return maxImpact;   // largest into-surface speed this frame (drives shake)
  }

  /** Draw every solid + anchor that intersects the view. */
  draw(ctx, view, player) {
    const now = Date.now();
    const vr = view.x + view.w;
    const vb = view.y + view.h;
    for (const c of this.currents) {
      if (c.x + c.w < view.x || c.x > vr || c.y + c.h < view.y || c.y > vb) continue;
      this._drawCurrent(ctx, c, now);
    }
    for (const s of this.solids) {
      if (s.right < view.x || s.left > vr || s.bottom < view.y || s.top > vb) continue;
      this._drawSolid(ctx, s, now);
    }
    for (const a of this.anchors) {
      if (a.x < view.x - 40 || a.x > vr + 40 || a.y < view.y - 40 || a.y > vb + 40) continue;
      this._drawAnchor(ctx, a, now, player);
    }
    const near = (x, y, pad) => x > view.x - pad && x < vr + pad && y > view.y - pad && y < vb + pad;
    for (const hz of this.hazards) {
      if (near(hz.x, hz.y, hz.r + 20)) this._drawHazard(ctx, hz, now);
    }
    for (const cp of this.checkpoints) {
      if (near(cp.x, cp.y, cp.r + 40)) this._drawCheckpoint(ctx, cp, now);
    }
    if (this.gate && near(this.gate.x, this.gate.y, this.gate.r + 40)) {
      this._drawGate(ctx, this.gate, now);
    }
  }

  /** A flow zone — faint streaks drifting in the current's direction. */
  _drawCurrent(ctx, c, now) {
    const dir = Math.atan2(c.fy, c.fx);
    const cos = Math.cos(dir), sin = Math.sin(dir);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexToRgba('#7fdcff', 1);
    ctx.lineWidth = 1.4;
    const N = 16;
    for (let i = 0; i < N; i++) {
      const seed = (i * 0.61803398) % 1;
      const across = seed;
      let along = ((now * 0.0009) + seed) % 1;
      let px, py;
      if (Math.abs(cos) >= Math.abs(sin)) {
        if (cos < 0) along = 1 - along;
        px = c.x + along * c.w;
        py = c.y + across * c.h;
      } else {
        if (sin < 0) along = 1 - along;
        px = c.x + across * c.w;
        py = c.y + along * c.h;
      }
      const phase = ((now * 0.0009) + seed) % 1;
      ctx.globalAlpha = (1 - Math.abs(phase - 0.5) * 2) * 0.18;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + cos * 16, py + sin * 16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** A spiky urchin hazard in a danger hue so it reads as "don't touch". */
  _drawHazard(ctx, hz, now) {
    ctx.save();
    ctx.fillStyle = '#1c0b12';        // dark body
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.r * 0.45, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexToRgba('#ff5d73', 0.7);
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff5d73';
    ctx.shadowBlur = 8;
    const spikes = 12;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * TAU + now * 0.0006;
      const inner = hz.r * 0.4;
      const outer = hz.r * (1 + 0.12 * Math.sin(now * 0.005 + i));
      ctx.beginPath();
      ctx.moveTo(hz.x + Math.cos(a) * inner, hz.y + Math.sin(a) * inner);
      ctx.lineTo(hz.x + Math.cos(a) * outer, hz.y + Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A sea anemone checkpoint — dim until reached, bright green once active. */
  _drawCheckpoint(ctx, cp, now) {
    const col = cp.active ? '#6ee7b7' : '#3a6a7a';
    const bright = cp.active ? 1 : 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, cp.r * 1.8);
    g.addColorStop(0, hexToRgba('#ffffff', 0.5 * bright));
    g.addColorStop(0.4, hexToRgba(col, 0.45 * bright));
    g.addColorStop(1, hexToRgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, cp.r * 1.8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(col, 0.6 * bright);
    ctx.lineWidth = 2;
    const fronds = 6;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * TAU;
      const sway = Math.sin(now * 0.003 + i + cp.phase) * 6;
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y);
      ctx.quadraticCurveTo(
        cp.x + Math.cos(a) * cp.r, cp.y - cp.r * 0.5,
        cp.x + Math.cos(a) * cp.r * 0.4 + sway, cp.y - cp.r * 1.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The light-gate — a dim ring that fills with a charge arc, then opens. */
  _drawGate(ctx, gate, now) {
    const frac = clamp(gate.charge / gate.required, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (gate.open) { ctx.shadowColor = '#5de4f5'; ctx.shadowBlur = 22; }

    ctx.strokeStyle = hexToRgba('#5de4f5', gate.open ? 0.9 : 0.3);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(gate.x, gate.y, gate.r, 0, TAU);
    ctx.stroke();

    if (!gate.open && frac > 0) {
      ctx.strokeStyle = hexToRgba('#aef0ff', 0.9);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(gate.x, gate.y, gate.r, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
      ctx.stroke();
    }

    const a = gate.open ? 0.5 : 0.12 + 0.25 * frac;
    const g = ctx.createRadialGradient(gate.x, gate.y, 0, gate.x, gate.y, gate.r);
    g.addColorStop(0, hexToRgba('#ffffff', a));
    g.addColorStop(0.5, hexToRgba('#5de4f5', a * 0.6));
    g.addColorStop(1, hexToRgba('#5de4f5', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gate.x, gate.y, gate.r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** A glowing grapple knob; brighter when reachable, brightest when grabbed. */
  _drawAnchor(ctx, a, now, player) {
    const pulse = 0.6 + 0.4 * Math.sin(now * 0.004 + a.phase);
    const inRange = player &&
      Math.hypot(a.x - player.x, a.y - player.y) <= this.tetherRange;
    const tethered = player && player.tetherAnchor === a;
    const glowA = tethered ? 1 : inRange ? 0.8 : 0.4;
    const gr = 6 * (tethered ? 2.4 : inRange ? 1.9 : 1.4) * (0.9 + 0.2 * pulse);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, gr);
    g.addColorStop(0, hexToRgba('#ffffff', 0.9 * glowA));
    g.addColorStop(0.4, hexToRgba('#5de4f5', 0.6 * glowA));
    g.addColorStop(1, hexToRgba('#5de4f5', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(a.x, a.y, gr, 0, TAU);
    ctx.fill();

    // A crisp ring marks it as a grabbable structure (motes have no rings).
    ctx.strokeStyle = hexToRgba('#aef0ff', tethered ? 0.95 : inRange ? 0.75 : 0.4);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 9, 0, TAU);
    ctx.stroke();

    // In range: an extra pulsing outer ring as a "you can grab this" cue.
    if (inRange && !tethered) {
      ctx.strokeStyle = hexToRgba('#5de4f5', 0.5 * pulse);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 15 + pulse * 3, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawSolid(ctx, s, now) {
    const seg = 20;

    // Rock body — wavy top edge, straight sides/bottom, dark vertical gradient.
    ctx.beginPath();
    ctx.moveTo(s.left, s.bottom);
    ctx.lineTo(s.left, topWave(s, s.left));
    for (let x = s.left + seg; x < s.right; x += seg) ctx.lineTo(x, topWave(s, x));
    ctx.lineTo(s.right, topWave(s, s.right));
    ctx.lineTo(s.right, s.bottom);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, s.top, 0, s.top + 200);
    grad.addColorStop(0, '#10202f');
    grad.addColorStop(1, '#070f1a');
    ctx.fillStyle = grad;
    ctx.fill();

    // Glowing top rim — bright bioluminescent algae on ledges, faint on walls.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 2;
    ctx.strokeStyle = hexToRgba(s.ledge ? '#5de4f5' : '#1c3a4a', s.ledge ? 0.5 : 0.3);
    if (s.ledge) { ctx.shadowColor = '#5de4f5'; ctx.shadowBlur = 10; }
    ctx.beginPath();
    ctx.moveTo(s.left, topWave(s, s.left));
    for (let x = s.left + seg; x < s.right; x += seg) ctx.lineTo(x, topWave(s, x));
    ctx.lineTo(s.right, topWave(s, s.right));
    ctx.stroke();
    ctx.restore();

    // Coral polyps — a few glowing dots along a ledge's surface.
    if (s.ledge) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const count = 3;
      for (let i = 1; i <= count; i++) {
        const px = s.left + (s.right - s.left) * (i / (count + 1));
        const py = topWave(s, px) - 2;
        const tw = 0.5 + 0.5 * Math.sin(now * 0.003 + i + s.left * 0.01);
        const pr = (3 + 1.5 * tw) * 2;
        const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
        g.addColorStop(0, hexToRgba('#ffffff', 0.7 * tw));
        g.addColorStop(0.4, hexToRgba('#5de4f5', 0.5 * tw));
        g.addColorStop(1, hexToRgba('#5de4f5', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

/**
 * The Ocean level — OPEN water, not a corridor. Boundary walls are far out
 * (mostly off-screen) so it feels vast; you weave around floating coral
 * islands, ceiling stalactites, and floor pillars, dodging urchins and
 * currents on the way down to the light-gate.
 */
export function createOceanLevel() {
  const spawn = { x: 0, y: 0 };
  const solids = [
    // Far boundary — keeps you in the area without feeling boxed in.
    rect(-760, -360, 1520, 60),   // ceiling
    rect(-760, -360, 60, 3620),   // left wall (far off-screen)
    rect(700, -360, 60, 3620),    // right wall (far off-screen)
    rect(-760, 3000, 1520, 260),  // abyss floor

    // Ceiling stalactites + floor pillars — obstacles in the open.
    rect(-280, -300, 46, 360),
    rect(260, -300, 46, 300),
    rect(-40, -300, 46, 240),
    rect(-260, 2660, 46, 340),
    rect(240, 2660, 46, 340),

    // Floating coral islands — weave around these.
    rect(-540, 360, 240, 48, true),
    rect(220, 520, 280, 48, true),
    rect(-160, 760, 220, 44, true),
    rect(-640, 1000, 200, 44, true),
    rect(380, 1080, 260, 48, true),
    rect(-280, 1300, 240, 46, true),
    rect(120, 1540, 220, 46, true),
    rect(-520, 1700, 200, 44, true),
    rect(440, 1820, 220, 46, true),
    rect(-180, 2040, 260, 48, true),
    rect(260, 2280, 240, 46, true),
    rect(-480, 2380, 200, 44, true),
    rect(-60, 2560, 240, 46, true),
    rect(320, 2720, 200, 44, true),
  ];
  // No anchors in the Ocean — the Tendril Tether is the Forest's signature
  // ability. The engine support (Level anchors, player tether) stays dormant.
  const level = new Level(spawn, solids);

  level.hazards = [
    { x: -400, y: 560 }, { x: 80, y: 700 }, { x: 500, y: 860 },
    { x: -380, y: 1180 }, { x: 260, y: 1400 }, { x: -140, y: 1640 },
    { x: 400, y: 2000 }, { x: -320, y: 2180 }, { x: 60, y: 2440 },
    { x: 440, y: 2560 },
  ].map((h) => ({ ...h, r: 27, phase: Math.random() * TAU }));

  level.currents = [
    { x: -260, y: 980, w: 520, h: 200, fx: 0.08, fy: 0 },    // pushes right
    { x: -100, y: 1880, w: 640, h: 220, fx: -0.09, fy: 0 },  // pushes left
    { x: -360, y: 2300, w: 560, h: 200, fx: 0, fy: 0.08 },   // pushes down
  ];

  level.checkpoints = [
    { x: 0, y: 200 }, { x: -280, y: 1280 }, { x: -60, y: 2520 },
  ].map((c) => ({ ...c, r: 16, active: false, phase: Math.random() * TAU }));

  level.gate = { x: 0, y: 2890, r: 72, charge: 0, required: 80, open: false };
  level.respawn = { ...spawn };
  return level;
}
