---
name: verify-phase
description: Build, run unit & contract v1.2 tests, verify 3-night determinism & fuel/drain/dawn rules, and save Phase 3 proof artifacts.
---

# Verify Phase Skill (Contract v1.2)

1. Build both the Vite web app and the standalone Node headless CLI:
   ```bash
   npm run build
   ```
2. Run the full Vitest suite (unit tests + Phase 1–2 regression + Phase 3 fuel/drain/dawn/capacity scenarios):
   ```bash
   npm test
   ```
3. Generate fresh Phase 3 verification proof:
   ```bash
   node scripts/verify-phase3.mjs
   ```
   Confirm `docs/proof/phase-3/SUMMARY.md` reports **ALL PASS** across Night 1/2/3 determinism, full-night benchmark (`<= 30s`), Phase 3 feature scenarios, and exit-code-2 checks.
