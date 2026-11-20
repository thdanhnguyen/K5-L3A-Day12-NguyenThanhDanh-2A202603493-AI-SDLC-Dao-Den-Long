# AGENTS.md — Đảo Đèn Lồng (Phase 3 · Contract v1.2)

## Commands
- Install: `npm ci` (or `npm install`)
- Build (UI + Headless CLI): `npm run build`
- Run 3D game: `npm run preview`
- Run headless CLI: `node dist/headless/cli.js --seed <int> --night <1|2|3> --ticks <int> --out <file.jsonl>`
- Full verification & proof: `npm run verify`

## Hard Rules
1. **Pure simulation boundary:** `src/sim/` MUST NEVER import `three`, browser DOM globals (`window`, `document`), or call `Math.random()`. Use `Mulberry32` PRNG only.
2. **Single source of truth:** All tuning values MUST be imported from `game.contract.json` via `src/sim/config.ts`; standardized Night 1/2/3 map layouts live in `src/sim/maps.ts`.
3. **Creative isolation:** Creative additions (Bé Lạc wandering girl, Origami Lantern Bird, Large/Small Shades, colored mote buffs) MUST ONLY run when `options.creative === true` (browser UI). Headless CLI MUST always pass `creative: false`.
4. **Cross-platform:** Keep all filenames lowercase. Use `node:path` and `\n` line endings so Linux/macOS/Windows behave identically.
5. **Test Contract v1.2 invariants:**
   - Fixed `1/60s` tick using integer `1/60` units for lantern fuel (`fuelUnits` max `6000`) and integer tick counters for all timers/cooldowns/TTLs (zero IEEE-754 drift).
   - Follow the exact 12-step tick order (with fuel decay + drain in step 2, auto-extinguish `fuel <= 0` right after step 2).
   - Shade states MUST be strictly `spawning | wander | chase | recoil | stunned | drain`.
   - Win only at dawn (`dawn_survived`) with `lit >= ceil(0.6 * total)`; `flames <= 0` always loses `no_flames` first, even on the dawn tick.
   - Invalid scenario/inputs JSON or non-strictly-increasing `tick` -> `stderr` + exit code `2`.
6. **Definition of Done:** Full `npm run verify` green (including Phase 1–2 non-replaced regression, Phase 3 fuel/drain/dawn/capacity scenarios, determinism across 3 nights) with fresh proof in `docs/proof/phase-3/`.
