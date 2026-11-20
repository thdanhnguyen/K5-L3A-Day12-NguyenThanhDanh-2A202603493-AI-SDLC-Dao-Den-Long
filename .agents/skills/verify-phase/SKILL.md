---
name: verify-phase
description: Build, run unit & contract v1.3 tests, verify 3-night determinism, 10-night soak, leaderboard export, and save Phase 4 proof artifacts.
---

# Verify Phase Skill (Contract v1.3)

1. Build the Vite web app and standalone Node CLIs (`dist/headless/cli.js`, `dist/cli/run.js`, `dist/cli/bench.js`, `dist/cli/soak.js`):
   ```bash
   npm run build
   ```
2. Run the full Vitest suite (unit tests + Phase 1–3 regression + Phase 4 soak/leaderboard tests):
   ```bash
   npm test
   ```
3. Generate fresh Phase 4 verification proof:
   ```bash
   node scripts/verify-phase4.mjs
   ```
   Confirm `docs/proof/phase-4/SUMMARY.md` reports **ALL PASS** across Night 1/2/3 determinism, 10-night soak (`crashes === 0`, `mem_end_mb <= 1.2 * mem_start_mb`), `--export-leaderboard`, and exit-code-2 checks.
