# Phase 1 Verification Proof Summary

- **Platform:** `win32 (x64)`
- **Node:** `v24.14.1`
- **Overall Result:** **ALL PASS**

## Headless Contract & Determinism Results

| Check | Exit Code | Status | Observed Output |
|---|---:|---|---|
| Determinism (2x seed=42, ticks=300) | `0 / 0` | PASS | `SHA-256 run1=427052167f44f7fc... == run2=427052167f44f7fc...` |
| Pickup & Carry Capacity | `0` | PASS | `{"type":"end","ticks":40,"state":"playing","score":10}` |
| Deposit & Win (all_lit) | `0` | PASS | `{"type":"end","ticks":1,"state":"won","score":448}` |
| Pulse Stun & Cooldown | `0` | PASS | `{"type":"end","ticks":200,"state":"playing","score":25}` |
| Lit Lantern Safe Radius | `0` | PASS | `{"type":"end","ticks":240,"state":"playing","score":0}` |
| Shade Hit, Drop & Loss (no_flames) | `0` | PASS | `{"type":"end","ticks":91,"state":"lost","score":0}` |
| Timer Dawn Loss (dawn) | `0` | PASS | `{"type":"end","ticks":120,"state":"lost","score":0}` |
| Malformed Inputs Exit Code 2 | `2` | PASS | `inputs.frames[1].tick (5) must be strictly increasing (> 5)` |

## Proof Files Generated
- `docs/proof/phase-1/default-night1-run1.jsonl` (SHA-256: `427052167f44f7fc755a004ea7e813ad9784d669e194810de2d55bc1090c8591`)
- `docs/proof/phase-1/default-night1-run2.jsonl` (SHA-256: `427052167f44f7fc755a004ea7e813ad9784d669e194810de2d55bc1090c8591`)
- `docs/proof/phase-1/01-pickup-capacity.jsonl`
- `docs/proof/phase-1/02-deposit-win.jsonl`
- `docs/proof/phase-1/03-pulse-stun-cooldown.jsonl`
- `docs/proof/phase-1/04-safe-radius.jsonl`
- `docs/proof/phase-1/05-hit-drop-loss.jsonl`
- `docs/proof/phase-1/06-dawn-loss.jsonl`
