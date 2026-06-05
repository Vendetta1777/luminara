// player.js — the player's creature, now a physics body.
// A bioluminescent organism: softly morphing membrane, glowing rim, drifting
// nucleus, twinkling photophores. Moves with momentum through the water —
// buoyant sink + drag — steered (temporarily) by hold-to-thrust. Milestone 6
// replaces that with charge-and-release Pulse-Jet.

import { hexToRgba } from './utils.js';

export class Player {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // World-space position. The camera frames the view around this.
    this.x = (canvas.clientWidth || window.innerWidth) / 2;
    this.y = (canvas.clientHeight || window.innerHeight) / 2;

    // --- Physics body ---
    this.vx = 0;
    this.vy = 0;
    this.sinkAccel = 0.016;    // gentle downward buoyant pull (px / frame²)
    this.drag = 0.93;          // water resistance per ~16.67ms frame (0..1)
    this.maxSpeed = 16;        // top-speed clamp (raised so a full dash carries)

    // --- Pulse-Jet (slingshot): charge while held, fling AWAY from the aim ---
    this.charging = false;
    this.charge = 0;           // 0..1 build-up while held
    this.chargeRate = 1 / 45;  // ~0.75s to reach a full charge
    this.minImpulse = 3.5;     // a quick tap still nudges you
    this.maxImpulse = 16.0;    // a full charge launches hard and far
    this.releaseAnim = 0;      // 1 -> 0 dash animation right after firing
    this.shockX = 0;           // shockwave origin (set at fire)
    this.shockY = 0;
    this.aimX = this.x;        // world-space aim (the pull point), updated while charging
    this.aimY = this.y;

    // --- Bioluminescent Bloom: absorbed light powers abilities ---
    this.light = 0;
    this.maxLight = 100;
    this.dashCost = 35;
    this.flareCost = 30;
    this.dashSpeed = 24;       // dash exceeds normal top speed (a hard lunge)
    this.invuln = 0;           // i-frame timer (ms) during a dash
    this.flareTime = 0;        // 1 -> 0 flare animation

    this.size = 20;
    this.color = '#5de4f5';
    this.glowColor = '#5de4f5';
    this.accentColor = '#d7fbff';
    this.pulseSpeed = 1.0;

    this.maxTrail = 22;
    this.trailPoints = [];

    // Membrane harmonics — each ripple's strength waxes/wanes on its own slow
    // timer so the silhouette keeps morphing through different forms.
    this.membrane = [
      { freq: 3, amp: 0.085, speed: 0.0011, phase: Math.random() * Math.PI * 2, modSpeed: 0.00033, modPhase: Math.random() * Math.PI * 2 },
      { freq: 5, amp: 0.055, speed: 0.0016, phase: Math.random() * Math.PI * 2, modSpeed: 0.00047, modPhase: Math.random() * Math.PI * 2 },
      { freq: 2, amp: 0.045, speed: 0.0008, phase: Math.random() * Math.PI * 2, modSpeed: 0.00026, modPhase: Math.random() * Math.PI * 2 },
      { freq: 4, amp: 0.035, speed: 0.0013, phase: Math.random() * Math.PI * 2, modSpeed: 0.00039, modPhase: Math.random() * Math.PI * 2 },
    ];

    // Photophores — tiny internal light cells suspended inside the body.
    this.photophores = [];
    for (let i = 0; i < 6; i++) {
      this.photophores.push({
        angle: Math.random() * Math.PI * 2,
        dist: 0.2 + Math.random() * 0.5,
        size: 0.06 + Math.random() * 0.08,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Advance the physics body. `input` = { thrusting, aimX, aimY } in WORLD
   * coordinates (main.js converts the cursor via the camera).
   */
  update(deltaTime, input) {
    const dtf = deltaTime / 16.6667;

    // Pulse-Jet: build charge while held, fire a burst on release.
    if (input && input.thrusting) {
      this.charging = true;
      this.charge = Math.min(1, this.charge + this.chargeRate * dtf);
      this.aimX = input.aimX;   // aim can be adjusted mid-charge
      this.aimY = input.aimY;
    } else if (this.charging) {
      this._fire();
      this.charging = false;
    }

    // Buoyant sink — the world's gentle "gravity".
    this.vy += this.sinkAccel * dtf;

    // Water drag (frame-rate independent), then clamp speed. During a dash the
    // cap is raised so the lunge genuinely exceeds normal top speed.
    const drag = Math.pow(this.drag, dtf);
    this.vx *= drag;
    this.vy *= drag;
    const cap = this.invuln > 0 ? this.dashSpeed : this.maxSpeed;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > cap) {
      this.vx = (this.vx / sp) * cap;
      this.vy = (this.vy / sp) * cap;
    }

    // Integrate position, then record the world-space trail.
    this.x += this.vx * dtf;
    this.y += this.vy * dtf;
    this.trailPoints.push({ x: this.x, y: this.y });
    if (this.trailPoints.length > this.maxTrail) this.trailPoints.shift();

    // Decay the post-release "pop", dash i-frames, and flare animation.
    if (this.releaseAnim > 0) {
      this.releaseAnim = Math.max(0, this.releaseAnim - dtf * 0.09);
    }
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - deltaTime);
    if (this.flareTime > 0) this.flareTime = Math.max(0, this.flareTime - deltaTime * 0.0014);
  }

  /** Add absorbed light to the meter (capped). */
  gainLight(amount) {
    this.light = Math.min(this.maxLight, this.light + amount);
  }

  /** Spend light for a fast lunge toward (tx,ty) with brief invulnerability. */
  burstDash(tx, ty) {
    if (this.light < this.dashCost) return false;
    this.light -= this.dashCost;
    const dx = tx - this.x, dy = ty - this.y;
    const len = Math.hypot(dx, dy) || 1;
    this.vx = (dx / len) * this.dashSpeed;
    this.vy = (dy / len) * this.dashSpeed;
    this.invuln = 380;
    this.releaseAnim = 1;
    this.shockX = this.x;
    this.shockY = this.y;
    return true;
  }

  /** Spend light to flare — a burst that reveals dark surroundings. */
  flare() {
    if (this.light < this.flareCost) return false;
    this.light -= this.flareCost;
    this.flareTime = 1;
    return true;
  }

  /**
   * Slingshot release: fling AWAY from the aim (you pull the band toward the
   * cursor, so you launch the opposite way), scaled by the current charge.
   */
  _fire() {
    const dx = this.x - this.aimX;   // away from the pull point
    const dy = this.y - this.aimY;
    const len = Math.hypot(dx, dy) || 1;
    const power = this.minImpulse + this.charge * (this.maxImpulse - this.minImpulse);
    this.vx += (dx / len) * power;
    this.vy += (dy / len) * power;
    this.releaseAnim = 1;
    this.shockX = this.x;            // shockwave bursts from where we launched
    this.shockY = this.y;
    this.charge = 0;
  }

  /** Trace the organic (non-circular) membrane outline as a closed path. */
  _traceBody(ctx, cx, cy, radius, now) {
    const SEG = 48;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      let rMul = 1;
      for (const m of this.membrane) {
        const amp = m.amp * (0.55 + 0.45 * Math.sin(now * m.modSpeed + m.modPhase));
        rMul += amp * Math.sin(a * m.freq + now * m.speed + m.phase);
      }
      const r = radius * rMul;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  draw(ctx) {
    const now = Date.now();
    const pulse = Math.sin(now * 0.003 * this.pulseSpeed) * 3;
    // Charging contracts the body (a jellyfish tensing); release pops it back.
    const squish = 1 - 0.30 * this.charge;
    const pop = 1 + 0.5 * this.releaseAnim;
    const radius = Math.max(2, (this.size + pulse) * squish * pop);
    // Gathered light brightens the glow as charge builds.
    const chargeGlow = 1 + 0.6 * this.charge;
    const dashGlow = this.invuln > 0 ? 1.4 : 1;   // brighter mid-dash
    const flicker = (0.82 + 0.18 * (0.6 * Math.sin(now * 0.0021) +
                                    0.4 * Math.sin(now * 0.0039 + 1.3))) * chargeGlow * dashGlow;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Trail — older points smaller and fainter, tapering to the head.
    const n = this.trailPoints.length;
    for (let i = 0; i < n; i++) {
      const p = this.trailPoints[i];
      const ratio = (i + 1) / n;
      const r = radius * (0.2 + 0.65 * ratio);
      const alpha = 0.09 * ratio;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, hexToRgba(this.glowColor, alpha));
      g.addColorStop(1, hexToRgba(this.glowColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Ambient halo — wide soft glow, gently flickering.
    const haloR = radius * 4.2;
    const halo = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, haloR);
    halo.addColorStop(0, hexToRgba(this.glowColor, 0.30 * flicker));
    halo.addColorStop(0.4, hexToRgba(this.glowColor, 0.10 * flicker));
    halo.addColorStop(1, hexToRgba(this.glowColor, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.x, this.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    // --- Body group: squash & stretch along velocity (dash streak) plus a
    //     charge tension jitter. Wraps the membrane, rim, nucleus, photophores.
    const speed = Math.hypot(this.vx, this.vy);
    const stretch = Math.min(1, speed / this.maxSpeed);
    const jAmp = this.charging ? this.charge * 2 : 0;
    const jx = (Math.sin(now * 0.07) + Math.sin(now * 0.11)) * 0.5 * jAmp;
    const jy = (Math.cos(now * 0.06) + Math.sin(now * 0.13)) * 0.5 * jAmp;

    ctx.save();
    ctx.translate(this.x + jx, this.y + jy);
    if (stretch > 0.05) {
      const ang = Math.atan2(this.vy, this.vx);
      ctx.rotate(ang);
      ctx.scale(1 + 0.5 * stretch, 1 - 0.28 * stretch);
      ctx.rotate(-ang);
    }
    ctx.translate(-this.x, -this.y);

    // 3. Membrane body — organic blob with a rich multi-stop gradient.
    ctx.beginPath();
    this._traceBody(ctx, this.x, this.y, radius * 1.04, now);
    const body = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, radius * 1.15);
    body.addColorStop(0.0, hexToRgba('#ffffff', 0.95));
    body.addColorStop(0.22, hexToRgba(this.accentColor, 0.85));
    body.addColorStop(0.5, hexToRgba(this.color, 0.7));
    body.addColorStop(0.82, hexToRgba(this.color, 0.32));
    body.addColorStop(1.0, hexToRgba(this.color, 0.0));
    ctx.fillStyle = body;
    ctx.fill();

    // 4. Glowing rim — bright blurred membrane edge.
    ctx.save();
    ctx.beginPath();
    this._traceBody(ctx, this.x, this.y, radius, now);
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = hexToRgba(this.accentColor, 0.6 * flicker);
    ctx.stroke();
    ctx.restore();

    // 5. Inner nucleus — soft secondary glow drifting off-centre.
    const nx = this.x + Math.sin(now * 0.0006) * radius * 0.18;
    const ny = this.y + Math.cos(now * 0.0008) * radius * 0.15;
    const nucR = radius * 0.55;
    const nucleus = ctx.createRadialGradient(nx, ny, 0, nx, ny, nucR);
    nucleus.addColorStop(0, hexToRgba('#ffffff', 0.55 * flicker));
    nucleus.addColorStop(0.5, hexToRgba(this.accentColor, 0.22 * flicker));
    nucleus.addColorStop(1, hexToRgba(this.accentColor, 0));
    ctx.fillStyle = nucleus;
    ctx.beginPath();
    ctx.arc(nx, ny, nucR, 0, Math.PI * 2);
    ctx.fill();

    // 6. Photophores — tiny internal light cells that twinkle and slowly rotate.
    const spin = now * 0.0003;
    for (const ph of this.photophores) {
      const a = ph.angle + spin;
      const px = this.x + Math.cos(a) * ph.dist * radius;
      const py = this.y + Math.sin(a) * ph.dist * radius;
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.004 + ph.phase));
      const pr = Math.max(0.8, ph.size * radius);
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, hexToRgba('#ffffff', 0.9 * twinkle));
      g.addColorStop(0.6, hexToRgba(this.accentColor, 0.4 * twinkle));
      g.addColorStop(1, hexToRgba(this.accentColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();   // end body group (squash/stretch + jitter)

    const TAU = Math.PI * 2;

    // 7. Charge energy — light spiralling inward as you gather power.
    if (this.charging) {
      const sparks = 8;
      for (let k = 0; k < sparks; k++) {
        const t = ((now * 0.0016) + k / sparks) % 1;      // 0 (far) -> 1 (arrived)
        const ang = (k / sparks) * TAU + now * 0.002 + t * 1.4;
        const dist = (1 - t) * (radius * 3.4) + radius * 0.6;
        const sx = this.x + Math.cos(ang) * dist;
        const sy = this.y + Math.sin(ang) * dist;
        const a = this.charge * (1 - t) * 0.7;
        const sr = 2.2 * (0.4 + 0.6 * (1 - t));
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        g.addColorStop(0, hexToRgba('#ffffff', a));
        g.addColorStop(1, hexToRgba(this.accentColor, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
      }
    }

    // 8. Slingshot band — the bright "pull" toward the cursor and a faint hint
    //    on the opposite side showing where you'll launch.
    if (this.charging) {
      const dx = this.aimX - this.x;
      const dy = this.aimY - this.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len, ny = dy / len;

      // Pull band toward the cursor (stretches + brightens with charge).
      const reach = radius * 1.4 + this.charge * 50;
      const pullX = this.x + nx * reach;
      const pullY = this.y + ny * reach;
      ctx.strokeStyle = hexToRgba(this.accentColor, 0.18 + 0.26 * this.charge);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x + nx * radius, this.y + ny * radius);
      ctx.lineTo(pullX, pullY);
      ctx.stroke();
      const tipR = 3 + this.charge * 5;
      const tip = ctx.createRadialGradient(pullX, pullY, 0, pullX, pullY, tipR);
      tip.addColorStop(0, hexToRgba('#ffffff', 0.7 * (0.4 + 0.6 * this.charge)));
      tip.addColorStop(1, hexToRgba(this.glowColor, 0));
      ctx.fillStyle = tip;
      ctx.beginPath();
      ctx.arc(pullX, pullY, tipR, 0, TAU);
      ctx.fill();

      // Faint launch hint, opposite side.
      const hint = radius * 1.2 + this.charge * 24;
      ctx.strokeStyle = hexToRgba(this.glowColor, 0.10 + 0.16 * this.charge);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x - nx * radius, this.y - ny * radius);
      ctx.lineTo(this.x - nx * hint, this.y - ny * hint);
      ctx.stroke();
    }

    // 9. Dash shockwave — a ring bursting from the launch point.
    if (this.releaseAnim > 0) {
      const prog = 1 - this.releaseAnim;
      const ringR = radius + prog * 72;
      ctx.strokeStyle = hexToRgba(this.glowColor, 0.45 * this.releaseAnim);
      ctx.lineWidth = 1.5 + 3.5 * this.releaseAnim;
      ctx.beginPath();
      ctx.arc(this.shockX, this.shockY, ringR, 0, TAU);
      ctx.stroke();
    }

    // 10. Flare — a big bright ring of light bursting outward, plus a flash.
    if (this.flareTime > 0) {
      const prog = 1 - this.flareTime;
      const ringR = radius + prog * 280;
      ctx.strokeStyle = hexToRgba(this.accentColor, 0.5 * this.flareTime);
      ctx.lineWidth = 2 + 6 * this.flareTime;
      ctx.beginPath();
      ctx.arc(this.x, this.y, ringR, 0, TAU);
      ctx.stroke();
      const fg = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, ringR);
      fg.addColorStop(0, hexToRgba('#ffffff', 0.10 * this.flareTime));
      fg.addColorStop(1, hexToRgba(this.glowColor, 0));
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(this.x, this.y, ringR, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }
}
