---
name: verify-phase
description: Build, run unit & contract tests, verify headless determinism, and save fresh Phase 1 proof artifacts.
---

# Verify Phase Skill

Run this procedure before completing any phase or tagging a release:

1. Build both the Vite web app and the standalone Node headless CLI:
   ```bash
   npm run build
   ```
   Confirm `dist/index.html` and `dist/headless/cli.js` exist.

2. Run the full Vitest suite (unit tests + Test Contract v1.0 subprocess scenarios + exit-code-2 checks + determinism check):
   ```bash
   npm test
   ```
   All tests must pass with zero skipped or relaxed assertions.

3. Generate fresh Phase 1 verification proof matching the current working tree:
   ```bash
   node scripts/verify-phase1.mjs
   ```
   Inspect `docs/proof/phase-1/SUMMARY.md` to confirm:
   - All scenario outputs end cleanly (`exit 0`).
   - Two consecutive runs with `--seed 42 --night 1 --ticks 300` produce identical SHA-256 hashes.
   - Malformed input/scenario tests exit with code `2`.

4. For UI changes, verify the rendered 3D game in a real browser (`npm run preview`), play through Night 1 controls, and check for zero console errors.
