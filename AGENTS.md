# AGENTS.md — Đảo Đèn Lồng (Phase 4 · Contract v1.3)

## Commands
- Install: `npm ci` (or `npm install`)
- Build (UI + Headless + Run/Bench/Soak CLIs): `npm run build`
- Run 3D game: `node dist/cli/run.js` (or `npm run preview`)
- Export leaderboard: `node dist/cli/run.js --export-leaderboard out.json`
- Run headless CLI: `node dist/headless/cli.js --seed <int> --night <1|2|3> --ticks <int> --out <file.jsonl>`
- Run benchmark (1280×720): `node dist/cli/bench.js --seed 42 --duration 30 --out bench.json`
- Run 10-night soak test: `node dist/cli/soak.js --seed 7 --nights 10 --out soak.json`
- Full verification & proof: `npm run verify`

## Hard Rules
1. **Pure simulation boundary:** `src/sim/` MUST NEVER import `three`, browser DOM globals (`window`, `document`), or call `Math.random()`. Use `Mulberry32` PRNG only.
2. **Single source of truth:** All tuning values MUST be imported from `game.contract.json` via `src/sim/config.ts`; standardized Night 1/2/3 map layouts live in `src/sim/maps.ts`.
3. **Creative isolation:** Creative additions (Bé Lạc, Origami Lantern Bird, Large/Small Shades, colored mote buffs) MUST ONLY run when `options.creative === true` (normal browser play). Headless CLI, benchmark scene, and soak test MUST pass `creative: false`.
4. **Cross-platform:** Keep all filenames lowercase. Use `node:path` and `\n` line endings so Linux/macOS/Windows behave identically.
5. **Contract v1.3 invariants:**
   - Benchmark: `1280×720`, Night 1, 200 wander shades + 100 motes (seed 42), `L1–L3` lit at `fuel=100`, no spawns/damage/pickup/decay/game-over, camera radius `30m` at `Y=15m` circling counter-clockwise from `(30,15,0)` every `15s`, 3s warmup + `--duration` measurement.
   - Soak: 10 consecutive nights (1→2→3 cycle), seed `7+i`, `crashes = 0`, `mem_end_mb <= 1.2 * mem_start_mb`.
   - Leaderboard: top 10 on local disk, `[A-Za-z0-9_]{3,12}`, sorted `score` desc then earlier `achieved_at`.
   - Accessibility: remappable keys with conflict detection + reset, visual captions + shade-spawn edge arrow, reduced motion toggle, `>= 18px` base UI font + `×1.25` large text toggle.
6. **Definition of Done:** Full `npm run verify` green, `bench.json` & `soak.json` committed, `CHANGELOG.md`, `CREDITS.md`, `LICENSE`, `docs/notes/retro.md`, and `docs/proof/phase-4/SUMMARY.md` complete.
