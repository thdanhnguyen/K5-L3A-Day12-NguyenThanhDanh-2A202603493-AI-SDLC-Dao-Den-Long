# Phase 3 Verification Proof Summary (Contract v1.2)

- **Platform:** `win32 (x64)`
- **Node:** `v24.14.1`
- **Overall Result:** **ALL PASS**

## Headless Contract v1.2, Benchmark & Determinism Results

| Check | Exit Code | Status | Observed Output |
|---|---:|---|---|
| Night 1 Determinism (2x seed=42, 600t) | `0/0` | PASS | `SHA-256=202e958bea3e2b8c...` |
| Night 2 Determinism (2x seed=42, 600t) | `0/0` | PASS | `SHA-256=ec3c38d2364aea8d...` |
| Night 3 Determinism (2x seed=42, 600t) | `0/0` | PASS | `SHA-256=79bc37d8fe4ea7cf...` |
| Night 3 Full 18,000-Tick Headless Benchmark (<= 30s) | `0` | PASS | `329 ms | {"type":"end","ticks":14896,"state":"lost","score":0}` |
| Malformed Inputs Exit Code 2 | `2` | PASS | `inputs.frames[1].tick (5) must be strictly increasing (> 5)` |
