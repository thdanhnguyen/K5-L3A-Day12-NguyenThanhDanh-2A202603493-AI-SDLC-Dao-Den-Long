# Phase 2 Verification Proof Summary (Contract v1.1)

- **Platform:** `win32 (x64)`
- **Node:** `v24.14.1`
- **Overall Result:** **ALL PASS**

## Headless Contract v1.1, Benchmark & Determinism Results

| Check | Exit Code | Status | Observed Output |
|---|---:|---|---|
| Night 1 Determinism (2x seed=42, 600t) | `0/0` | PASS | `SHA-256=a149a3e51076c5a8...` |
| Night 2 Determinism (2x seed=42, 600t) | `0/0` | PASS | `SHA-256=ebe673b960052a70...` |
| Night 3 Determinism (2x seed=42, 600t) | `0/0` | PASS | `SHA-256=a8cf381df26699cd...` |
| Night 3 Full 21,600-Tick Headless Benchmark (<= 30s) | `0` | PASS | `479 ms | {"type":"end","ticks":13266,"state":"lost","score":0}` |
| P1-01 Pickup & Carry Cap (10) | `0` | PASS | `{"type":"end","ticks":40,"state":"playing","score":0}` |
| P1-02 Deposit & Win (all_lit) | `0` | PASS | `{"type":"end","ticks":1,"state":"won","score":548}` |
| P1-03 Pulse Stun (120t) & Cooldown (180t) | `0` | PASS | `{"type":"end","ticks":150,"state":"playing","score":5}` |
| P1-04 Safe Radius (6m) | `0` | PASS | `{"type":"end","ticks":240,"state":"playing","score":0}` |
| P1-05 Hit, Dropped Motes & Loss | `0` | PASS | `{"type":"end","ticks":91,"state":"lost","score":0}` |
| P1-06 Dawn Loss | `0` | PASS | `{"type":"end","ticks":120,"state":"lost","score":0}` |
| Malformed Inputs Exit Code 2 | `2` | PASS | `inputs.frames[1].tick (5) must be strictly increasing (> 5)` |
