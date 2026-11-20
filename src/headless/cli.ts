import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Simulation } from '../sim/engine';
import { InputTimeline, validateAndParseInputs } from '../sim/input';
import { validateAndParseScenario } from '../sim/scenario';
import { FormatError, type InputFrame, type ScenarioData } from '../sim/types';

interface CliArgs {
  seed: number;
  night: 1 | 2 | 3;
  scenarioPath?: string;
  inputsPath?: string;
  ticks: number;
  outPath: string;
  snapshotEvery: number;
}

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

function parseIntArg(raw: string | undefined, flag: string, minValue: number): number {
  if (raw === undefined) {
    throw new UsageError(`Missing value for ${flag}`);
  }
  const num = Number(raw);
  if (!Number.isInteger(num) || num < minValue) {
    throw new UsageError(`${flag} must be an integer >= ${minValue}, got "${raw}"`);
  }
  return num;
}

function parseArgs(argv: string[]): CliArgs {
  let seed: number | undefined;
  let nightRaw: number | undefined;
  let scenarioPath: string | undefined;
  let inputsPath: string | undefined;
  let ticks: number | undefined;
  let outPath: string | undefined;
  let snapshotEvery = 10;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--seed':
        seed = parseIntArg(argv[++i], '--seed', -2147483648);
        break;
      case '--night':
        nightRaw = parseIntArg(argv[++i], '--night', 1);
        break;
      case '--scenario':
        scenarioPath = argv[++i];
        if (!scenarioPath) throw new UsageError('Missing value for --scenario');
        break;
      case '--inputs':
        inputsPath = argv[++i];
        if (!inputsPath) throw new UsageError('Missing value for --inputs');
        break;
      case '--ticks':
        ticks = parseIntArg(argv[++i], '--ticks', 0);
        break;
      case '--out':
        outPath = argv[++i];
        if (!outPath) throw new UsageError('Missing value for --out');
        break;
      case '--snapshot-every':
        snapshotEvery = parseIntArg(argv[++i], '--snapshot-every', 1);
        break;
      default:
        throw new UsageError(`Unknown argument: ${arg}`);
    }
  }

  if (seed === undefined) throw new UsageError('Missing required flag --seed');
  if (nightRaw === undefined) throw new UsageError('Missing required flag --night');
  if (nightRaw !== 1 && nightRaw !== 2 && nightRaw !== 3) {
    throw new UsageError(`Night ${nightRaw} is not supported (expected --night 1 | 2 | 3)`);
  }
  if (ticks === undefined) throw new UsageError('Missing required flag --ticks');
  if (!outPath) throw new UsageError('Missing required flag --out');

  return {
    seed,
    night: nightRaw,
    scenarioPath,
    inputsPath,
    ticks,
    outPath,
    snapshotEvery,
  };
}

function run(): void {
  const args = parseArgs(process.argv.slice(2));

  let scenario: ScenarioData = {};
  if (args.scenarioPath) {
    let rawScenario: string;
    try {
      rawScenario = readFileSync(path.resolve(args.scenarioPath), 'utf8');
    } catch (err) {
      throw new UsageError(`Cannot read scenario file "${args.scenarioPath}": ${(err as Error).message}`);
    }
    scenario = validateAndParseScenario(rawScenario, args.night);
  }

  let frames: InputFrame[] = [];
  if (args.inputsPath) {
    let rawInputs: string;
    try {
      rawInputs = readFileSync(path.resolve(args.inputsPath), 'utf8');
    } catch (err) {
      throw new UsageError(`Cannot read inputs file "${args.inputsPath}": ${(err as Error).message}`);
    }
    frames = validateAndParseInputs(rawInputs);
  }

  const sim = new Simulation(args.seed, args.night, scenario, { creative: false });
  const timeline = new InputTimeline(frames);

  const lines: string[] = [];
  lines.push(JSON.stringify(sim.getSnapshot()));
  lines.push(
    JSON.stringify({
      type: 'event',
      tick: 0,
      name: 'night_start',
      data: { night: args.night },
    })
  );

  for (let k = 0; k < args.ticks; k++) {
    const stepInput = timeline.sampleForTick(k);
    const events = sim.step(stepInput);
    for (const ev of events) {
      lines.push(JSON.stringify(ev));
    }
    if ((k + 1) % args.snapshotEvery === 0) {
      lines.push(JSON.stringify(sim.getSnapshot()));
    }
    if (sim.state === 'won' || sim.state === 'lost') {
      break;
    }
  }

  lines.push(JSON.stringify(sim.getEndRecord()));

  const resolvedOut = path.resolve(args.outPath);
  mkdirSync(path.dirname(resolvedOut), { recursive: true });
  writeFileSync(resolvedOut, lines.join('\n') + '\n', 'utf8');
}

try {
  run();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  if (err instanceof FormatError) {
    process.exit(2);
  }
  process.exit(1);
}
