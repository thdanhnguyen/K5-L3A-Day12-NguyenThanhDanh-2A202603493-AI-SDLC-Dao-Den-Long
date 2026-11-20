---
name: verify-phase
description: Build, run unit & contract v1.1 tests, benchmark 21,600 headless ticks, verify determinism across 3 nights, and save proof artifacts.
---

# Verify Phase Skill (Contract v1.1)

Run this procedure before completing any phase or tagging a release:

1. Build both the Vite web app and the standalone Node headless CLI:
   ```bash
   npm run build
   ```
   Confirm `dist/index.html` and `dist/headless/cli.js` exist.

2. Run the full Vitest suite (unit tests + Phase 1 regression + Phase 2 Contract v1.1 scenarios + exit-code-2 checks + 3-night determinism):
   ```bash
   npm test
   ```
   All tests must pass with zero skipped or relaxed assertions.

3. Generate fresh Phase 2 verification proof matching the current working tree:
   ```bash
   node scripts/verify-phase2.mjs
   ```
   Inspect `docs/proof/phase-2/SUMMARY.md` to confirm:
   - Night 1, 2, and 3 scenario outputs pass (`exit 0`).
   - Two consecutive runs across `--night 1`, `--night 2`, and `--night 3` produce identical SHA-256 hashes.
   - Full 21,600-tick Night 3 headless simulation completes well under the `<= 30s` budget.
   - Malformed input/scenario tests exit with code `2`.

4. Verify 3D WebGL UI at `1280x720` (`npm run preview`) across Main Menu, Night Intro, HUD, Pause, Settings persistence, and `>= 30 FPS` average.
