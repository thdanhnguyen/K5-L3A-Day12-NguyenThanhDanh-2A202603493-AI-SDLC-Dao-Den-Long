# AGENTS.md — Đảo Đèn Lồng (Phase 2 · Contract v1.1)

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
5. **Test Contract v1.1 invariants:**
   - Fixed `1/60s` tick using exact integer tick counters for timers/cooldowns/TTLs (zero IEEE-754 drift).
   - Follow the exact 12-step tick order (Input/Pause -> Timers -> Player Move/Fall -> Pickups -> Lanterns -> Safe Zones -> Pulse -> Move Shades/Drifters -> Collisions -> Spawns -> Win/Loss -> Snapshot).
   - Shade states MUST be strictly `spawning | wander | chase | recoil | stunned`.
   - When `paused`, `tick` advances while `sim_tick`, timers, spawns, and TTLs freeze (`state: "paused"`).
   - Invalid scenario/inputs JSON or non-strictly-increasing `tick` -> `stderr` + exit code `2`.
6. **Definition of Done:** Full `npm run verify` green (including Phase 1 standardized regression, all Phase 2 feature scenarios, 21,600-tick headless run ≤ 30s, ≥ 30 FPS at 1280×720) with fresh proof in `docs/proof/phase-2/`.
