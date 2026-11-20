# AGENTS.md — Đảo Đèn Lồng

## Commands
- Install: `npm ci` (or `npm install`)
- Build (UI + Headless CLI): `npm run build`
- Run 3D game: `npm run preview`
- Run headless CLI: `node dist/headless/cli.js --seed <int> --night 1 --ticks <int> --out <file.jsonl>`
- Full verification & proof: `npm run verify`

## Hard Rules
1. **Pure simulation boundary:** `src/sim/` MUST NEVER import `three`, browser DOM globals (`window`, `document`), or call `Math.random()`. Use `Mulberry32` PRNG only.
2. **Single source of truth:** All tuning values MUST be imported from `game.contract.json` via `src/sim/config.ts`. Never hardcode duplicate gameplay constants.
3. **Creative isolation:** Creative additions (Bé Lạc wandering girl, Origami Lantern Bird, Large/Small Shades, colored mote buffs) MUST ONLY run when `options.creative === true` (browser UI). Headless CLI MUST always pass `creative: false` so Test Contract v1.0 output is untouched.
4. **Cross-platform:** Keep all filenames lowercase. Use `node:path` for filesystem paths and `\n` line endings for JSONL output so Linux/macOS/Windows behave identically.
5. **Test Contract v1.0 invariants:**
   - Fixed `1/60s` tick; `tick === sim_tick` in Phase 1.
   - Snapshot `tick: 0` before any step; step `k` (`0..N-1`) consumes input tick `k` and produces state/events at `tick = k + 1`.
   - Distances measured on XZ plane (`<= r`). Coordinates and `time_left_s` rounded to 3 decimals (no `-0`).
   - Invalid scenario/inputs JSON or non-strictly-increasing `tick` -> `stderr` + exit code `2`.
6. **Definition of Done:** Never finish with failing tests. Always run `npm run verify` after final edits and verify real generated proof in `docs/proof/phase-1/`.
