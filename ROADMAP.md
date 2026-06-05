# Luminara — Platformer Roadmap (v2)

**The game:** one thread of bioluminescent life **adapting to survive each world** — a
momentum-based swim/glide platformer. You **Pulse-Jet** through each biome, collect light,
and metamorphose at every border into a new form built for the next medium.

**Decided direction:** forgiving/dreamy difficulty · the Ocean **descends into the abyss** ·
a **light-gate** at each biome's end opens the next world.

---

## ✅ Done
- **M1** Project scaffolding
- **M2** Canvas + game loop
- **M3** Player creature (organic glow membrane)
- **M4** Particle field (cool ocean palette)

## Phase 1 — The Movement Feel
- **M5** Movement physics (momentum, water drag, buoyant sink) + follow-camera
- **M6** Pulse-Jet propulsion (charge & release; membrane contracts)

## Phase 2 — The World to Move Through
- **M7** Level geometry & collision (coral ledges, rock walls — data-defined)
- **M8** Ocean atmosphere as parallax scrolling backdrop

## Phase 3 — The Toolkit
- **M9** Bioluminescent Bloom — glow meter, Burst-Dash, Flare (reveal dark zones)
- **M10** Tendril Tether — grapple + swing + slingshot

## Phase 4 — Goal & Payoff
- **M11** Hazards, anemone checkpoints, the light-gate goal
- **M12** Adaptive evolution + the Forest (metamorphosis: new form + physics + ability)

## Phase 5 — Finish
- **M13** HUD & UI · **M14** Generative audio · **M15** Polish & performance
- **M16** Mobile & touch · **M17** GitHub Pages deploy

## 🌌 Beyond — new worlds (each ≈ add biome + form data + a level)
Desert (Embercoil) · Space (Starjelly) · Caves · Volcano · Sky …

---

### Environment-adaptive forms
| World | Form | Medium → movement | Signature ability |
|---|---|---|---|
| Ocean | Glowfin | dense water: heavy drag, buoyant sink | Pulse-Jet + tendril tether |
| Forest | Wispwing | air: low drag, real gravity | glide + branch swing-grapple |
| Desert | Embercoil | thin air: strong gravity | sand-burrow dash + big leaps |
| Space | Starjelly | vacuum: zero drag/gravity | Newtonian thrust + debris tether |

**Architecture:** two data tables — *Biome* defines physics (gravity, drag, buoyancy, palette,
atmosphere, hazards); *Form* (tied to a biome) defines body/glow + the movement ability it
unlocks. A world transition = morph creature + swap physics + swap ability + reskin world.
