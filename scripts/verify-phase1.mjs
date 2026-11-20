import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const cliPath = path.join(rootDir, 'dist', 'headless', 'cli.js');
const proofDir = path.join(rootDir, 'docs', 'proof', 'phase-1');

mkdirSync(proofDir, { recursive: true });
const tempErrDir = mkdtempSync(path.join(tmpdir(), 'ddl-proof-err-'));

function runHeadless(args) {
  const res = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  return res;
}

const checks = [];

// 1. Run default Night 1 twice for determinism proof
const detOut1 = path.join(proofDir, 'default-night1-run1.jsonl');
const detOut2 = path.join(proofDir, 'default-night1-run2.jsonl');
const detArgs = ['--seed', '42', '--night', '1', '--ticks', '300', '--snapshot-every', '30'];
const r1 = runHeadless([...detArgs, '--out', detOut1]);
const r2 = runHeadless([...detArgs, '--out', detOut2]);
const hash1 = createHash('sha256').update(readFileSync(detOut1)).digest('hex');
const hash2 = createHash('sha256').update(readFileSync(detOut2)).digest('hex');

checks.push({
  name: 'Determinism (2x seed=42, ticks=300)',
  cmd: `node dist/headless/cli.js ${detArgs.join(' ')} --out <file>`,
  exitCode: `${r1.status} / ${r2.status}`,
  passed: r1.status === 0 && r2.status === 0 && hash1 === hash2,
  detail: `SHA-256 run1=${hash1.slice(0, 16)}... == run2=${hash2.slice(0, 16)}...`,
});

// 2. Run key scenarios and save outputs
const scenarioRuns = [
  {
    label: 'Pickup & Carry Capacity',
    scenario: '01-pickup-capacity.scenario.json',
    inputs: '01-pickup-capacity.inputs.json',
    ticks: '40',
    out: '01-pickup-capacity.jsonl',
  },
  {
    label: 'Deposit & Win (all_lit)',
    scenario: '02-deposit-win.scenario.json',
    inputs: '02-deposit-win.inputs.json',
    ticks: '100',
    out: '02-deposit-win.jsonl',
  },
  {
    label: 'Pulse Stun & Cooldown',
    scenario: '03-pulse-stun-cooldown.scenario.json',
    inputs: '03-pulse-stun-cooldown.inputs.json',
    ticks: '200',
    out: '03-pulse-stun-cooldown.jsonl',
  },
  {
    label: 'Lit Lantern Safe Radius',
    scenario: '04-safe-radius.scenario.json',
    inputs: null,
    ticks: '240',
    out: '04-safe-radius.jsonl',
  },
  {
    label: 'Shade Hit, Drop & Loss (no_flames)',
    scenario: '05-hit-drop-loss.scenario.json',
    inputs: null,
    ticks: '180',
    out: '05-hit-drop-loss.jsonl',
  },
  {
    label: 'Timer Dawn Loss (dawn)',
    scenario: '06-dawn-loss.scenario.json',
    inputs: null,
    ticks: '200',
    out: '06-dawn-loss.jsonl',
  },
];

for (const item of scenarioRuns) {
  const outPath = path.join(proofDir, item.out);
  const args = [
    '--seed', '7',
    '--night', '1',
    '--scenario', path.join('tests', 'scenarios', item.scenario),
    ...(item.inputs ? ['--inputs', path.join('tests', 'scenarios', item.inputs)] : []),
    '--ticks', item.ticks,
    '--snapshot-every', '20',
    '--out', path.join('docs', 'proof', 'phase-1', item.out),
  ];
  const res = runHeadless(args);
  const lines = res.status === 0 ? readFileSync(outPath, 'utf8').trim().split('\n') : [];
  const endLine = lines.length > 0 ? lines[lines.length - 1] : '';
  checks.push({
    name: item.label,
    cmd: `node dist/headless/cli.js ${args.join(' ')}`,
    exitCode: String(res.status),
    passed: res.status === 0 && endLine.includes('"type":"end"'),
    detail: endLine,
  });
}

// 3. Invalid inputs -> exit code 2
const badInputPath = path.join(tempErrDir, 'bad-inputs.json');
writeFileSync(
  badInputPath,
  JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }),
  'utf8'
);
const badRes = runHeadless([
  '--seed', '1',
  '--night', '1',
  '--inputs', badInputPath,
  '--ticks', '10',
  '--out', path.join(tempErrDir, 'unused.jsonl'),
]);
checks.push({
  name: 'Malformed Inputs Exit Code 2',
  cmd: 'node dist/headless/cli.js --seed 1 --night 1 --inputs <non-increasing-ticks> --ticks 10 --out <out>',
  exitCode: String(badRes.status),
  passed: badRes.status === 2 && badRes.stderr.trim().length > 0,
  detail: badRes.stderr.trim(),
});

rmSync(tempErrDir, { recursive: true, force: true });

// 4. Write SUMMARY.md
const allPassed = checks.every((c) => c.passed);
const rows = checks
  .map(
    (c) =>
      `| ${c.name} | \`${c.exitCode}\` | ${c.passed ? 'PASS' : 'FAIL'} | \`${c.detail}\` |`
  )
  .join('\n');

const summary = `# Phase 1 Verification Proof Summary

- **Platform:** \`${process.platform} (${process.arch})\`
- **Node:** \`${process.version}\`
- **Overall Result:** **${allPassed ? 'ALL PASS' : 'FAILED'}**

## Headless Contract & Determinism Results

| Check | Exit Code | Status | Observed Output |
|---|---:|---|---|
${rows}

## Proof Files Generated
- \`docs/proof/phase-1/default-night1-run1.jsonl\` (SHA-256: \`${hash1}\`)
- \`docs/proof/phase-1/default-night1-run2.jsonl\` (SHA-256: \`${hash2}\`)
- \`docs/proof/phase-1/01-pickup-capacity.jsonl\`
- \`docs/proof/phase-1/02-deposit-win.jsonl\`
- \`docs/proof/phase-1/03-pulse-stun-cooldown.jsonl\`
- \`docs/proof/phase-1/04-safe-radius.jsonl\`
- \`docs/proof/phase-1/05-hit-drop-loss.jsonl\`
- \`docs/proof/phase-1/06-dawn-loss.jsonl\`
`;

writeFileSync(path.join(proofDir, 'SUMMARY.md'), summary, 'utf8');
console.log(summary);

if (!allPassed) {
  process.exit(1);
}
