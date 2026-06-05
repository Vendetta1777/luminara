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
    for (const s of this.solids) {
      if (s.right < view.x || s.left > vr || s.bottom < view.y || s.top > vb) continue;
      this._drawSolid(ctx, s, now);
    }
    for (const a of this.anchors) {
      if (a.x < view.x - 40 || a.x > vr + 40 || a.y < view.y - 40 || a.y > vb + 40) continue;
      this._drawAnchor(ctx, a, now, player);
    }
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

/** The Ocean level — a descending shaft with staggered coral ledges. */
export function createOceanLevel() {
  const spawn = { x: 0, y: 0 };
  const solids = [
    rect(-460, -320, 920, 60),    // ceiling
    rect(-460, -320, 60, 3500),   // left wall
    rect(400, -320, 60, 3500),    // right wall
    rect(-220, 420, 200, 36, true),
    rect(120, 720, 220, 36, true),
    rect(-340, 1020, 190, 36, true),
    rect(-60, 1320, 200, 36, true),
    rect(180, 1640, 200, 36, true),
    rect(-300, 1960, 190, 36, true),
    rect(60, 2280, 200, 36, true),
    rect(-220, 2600, 200, 36, true),
    rect(-460, 2980, 920, 220),   // abyss floor
  ];
  const anchors = [
    { x: 0, y: 250 }, { x: -250, y: 600 }, { x: 240, y: 900 },
    { x: -120, y: 1180 }, { x: 200, y: 1480 }, { x: -240, y: 1800 },
    { x: 120, y: 2120 }, { x: -160, y: 2440 }, { x: 80, y: 2760 },
  ].map((a) => ({ ...a, phase: Math.random() * TAU }));
  return new Level(spawn, solids, anchors);
}
