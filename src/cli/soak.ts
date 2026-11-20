import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';
import { Simulation } from '../sim/engine';
import { Mulberry32 } from '../sim/prng';
import type { StepInput } from '../sim/types';

function forceGc(): void {
  try {
    if (typeof global.gc === 'function') {
      global.gc();
      return;
    }
    v8.setFlagsFromString('--expose_gc');
    const gcFn = vm.runInNewContext('gc') as (() => void) | undefined;
    if (typeof gcFn === 'function') gcFn();
  } catch {
    // ignore if GC cannot be forced
  }
}

function parseArgs(argv: string[]): { seed: number; nights: number; out: string } {
  let seed: number | null = null;
  let nights: number | null = null;
  let out: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--seed') {
      const val = argv[++i];
      if (val === undefined || !/^-?\d+$/.test(val)) {
        throw new Error('Invalid or missing --seed');
      }
      seed = Number(val);
    } else if (arg === '--nights') {
      const val = argv[++i];
      if (val === undefined || !/^\d+$/.test(val) || Number(val) < 1) {
        throw new Error('Invalid or missing --nights');
      }
      nights = Number(val);
    } else if (arg === '--out') {
      const val = argv[++i];
      if (!val) throw new Error('Invalid or missing --out');
      out = val;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (seed === null || nights === null || out === null) {
    throw new Error('Usage: soak --seed <int> --nights <int> --out <file.json>');
  }

  return { seed, nights, out };
}

function getMemMb(): number {
  return Math.round((process.memoryUsage().heapUsed / (1024 * 1024)) * 100) / 100;
}

function main(): void {
  let args: { seed: number; nights: number; out: string };
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }

  const startMs = Date.now();
  let crashes = 0;
  const results: Array<'won' | 'lost' | 'crash'> = [];
  let memStartMb = 0;
  let memEndMb = 0;

  let sim: Simulation | null = null;

  for (let i = 0; i < args.nights; i++) {
    const night = ((i % 3) + 1) as 1 | 2 | 3;
    const nightSeed = (args.seed + i) | 0;
    const inputRng = new Mulberry32((nightSeed ^ 0x517cc1b7) >>> 0);

    try {
      sim = new Simulation(nightSeed, night, {}, { creative: false });

      let moveX = 0;
      let moveZ = 0;
      const maxSafetyTicks = 60 * 400; // > max night duration
      let t = 0;
      while (sim.state === 'playing' && t < maxSafetyTicks) {
        if (t % 30 === 0) {
          const angle = inputRng.range(0, Math.PI * 2);
          moveX = Math.cos(angle);
          moveZ = Math.sin(angle);
        }
        const input: StepInput = {
          move: [moveX, moveZ],
          camYawDeg: 0,
          jumpPressed: inputRng.next() < 0.05,
          dashPressed: inputRng.next() < 0.03,
          pulsePressed: inputRng.next() < 0.02,
          interactPressed: inputRng.next() < 0.1,
          pausePressed: false,
        };
        sim.step(input);
        t++;
      }

      if (sim.state === 'won' || sim.state === 'lost') {
        results.push(sim.state);
      } else {
        crashes++;
        results.push('crash');
      }
    } catch (err) {
      crashes++;
      results.push('crash');
      console.error(`Soak night ${i + 1} (night=${night}, seed=${nightSeed}) crashed:`, err);
    } finally {
      sim = null;
      if (i === 0) {
        forceGc();
        memStartMb = getMemMb();
      }
    }
  }

  forceGc();
  memEndMb = getMemMb();

  const durationS = Math.round(((Date.now() - startMs) / 1000) * 100) / 100;
  const payload = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  if (crashes > 0 || memEndMb > memStartMb * 1.2) {
    console.error(
      `Soak failed: crashes=${crashes}, mem_start_mb=${memStartMb}, mem_end_mb=${memEndMb}`
    );
    process.exit(1);
  }
}

main();
