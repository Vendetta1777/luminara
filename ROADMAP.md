# Luminara — Platformer Roadmap (v2)

**The game:** one thread of bioluminescent life **adapting to survive each world** — a
momentum-based swim/glide platformer. You **Pulse-Jet** through each biome, collect light,
and metamorphose at every border into a new form built for the next medium.

**Decided direction:** forgiving/dreamy difficulty · the Ocean **descends into the abyss** ·
a **light-gate** at each biome's end opens the next world.

---

**Now an OPEN-WORLD ACTION platformer.** Three resources: **HP** (health), **Light**
(fuels dash/flare/weapon), **Shells** (currency). Controls (Scheme B): Left = Pulse-Jet
move · Right = Burst-Dash · Space = fire water torpedo · F = Flare · E = Talk.

## ✅ Done — Movement & World (M1–M11)
Scaffold · loop · creature · particles · movement physics + camera · Pulse-Jet slingshot ·
level collision · ocean atmosphere · Bloom (dash/flare/darkness) · tether (deferred to Forest) ·
hazards/checkpoints/light-gate. Ocean redesigned to OPEN water (islands, currents, no corridor).

## Phase: Combat & Open World
- **M12** HP & damage — health, take damage, death → checkpoint respawn, HP bar
- **M13** Water Torpedo — fire projectiles toward the cursor (Space)
- **M14** Enemies — patrol/chase, damage you, have HP, die to torpedoes, drop shells
- **M15** Shells — currency: world pickups + enemy drops + counter
- **M16** NPCs & dialogue — approach + talk (E); lore NPC + guide NPC
- **M17** Upgrade shop — spend shells (launch/dash distance, ability costs, max HP)
- **M18** Boss gate + Boss fight — unlock after talking to most NPCs & killing most enemies
- **M19** Full HUD — HP, light, shells, objective marker

## Then — New Worlds (metamorphosis)
- Forest (Wispwing — glide + tether swing) · Desert (Embercoil) · Space (Starjelly) · …
- Each new zone reuses combat + NPCs + shells; adds its own form, physics, signature ability.

## Later — Finish
Generative audio · polish & performance · mobile & touch · GitHub Pages deploy.

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
