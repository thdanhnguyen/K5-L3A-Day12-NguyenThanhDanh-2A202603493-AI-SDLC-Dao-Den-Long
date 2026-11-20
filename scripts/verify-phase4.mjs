import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const proofDir = path.join(root, 'docs', 'proof', 'phase-4');
fs.mkdirSync(proofDir, { recursive: true });

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-verify4-'));
const cliPath = path.join(root, 'dist', 'headless', 'cli.js');
const soakPath = path.join(root, 'dist', 'cli', 'soak.js');
const runPath = path.join(root, 'dist', 'cli', 'run.js');

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const checks = [];

// 1. 3-night determinism
for (const [night, ticks] of [
  [1, 14400],
  [2, 18000],
  [3, 21600],
]) {
  const outA = path.join(tmpDir, `n${night}a.jsonl`);
  const outB = path.join(tmpDir, `n${night}b.jsonl`);
  const t0 = Date.now();
  execFileSync(process.execPath, [
    cliPath,
    '--seed',
    String(40 + night),
    '--night',
    String(night),
    '--ticks',
    String(ticks),
    '--snapshot-every',
    '120',
    '--out',
    outA,
  ]);
  const elapsedMs = Date.now() - t0;
  execFileSync(process.execPath, [
    cliPath,
    '--seed',
    String(40 + night),
    '--night',
    String(night),
    '--ticks',
    String(ticks),
    '--snapshot-every',
    '120',
    '--out',
    outB,
  ]);
  const pass = sha256(outA) === sha256(outB);
  checks.push({ name: `Night ${night} Determinism (${ticks} ticks, ${elapsedMs}ms)`, pass });
}

// 2. 10-night soak check
const soakOut = path.join(tmpDir, 'soak.json');
execFileSync(process.execPath, [soakPath, '--seed', '7', '--nights', '10', '--out', soakOut]);
const soakData = JSON.parse(fs.readFileSync(soakOut, 'utf8'));
const soakPass =
  soakData.nights === 10 &&
  soakData.crashes === 0 &&
  soakData.mem_end_mb <= soakData.mem_start_mb * 1.2;
checks.push({
  name: `10-Night Soak (crashes=${soakData.crashes}, mem=${soakData.mem_start_mb}->${soakData.mem_end_mb} MB)`,
  pass: soakPass,
});

// 3. --export-leaderboard check
const lbExport = path.join(tmpDir, 'lb.json');
execFileSync(process.execPath, [runPath, '--export-leaderboard', lbExport]);
const lbData = JSON.parse(fs.readFileSync(lbExport, 'utf8'));
checks.push({
  name: 'Leaderboard Export CLI (`--export-leaderboard`)',
  pass: Array.isArray(lbData.entries),
});

// 4. Exit code 2 check (soak, bench, run)
const badSoak = spawnSync(process.execPath, [soakPath, '--bad-flag'], { encoding: 'utf8' });
const badRun = spawnSync(process.execPath, [runPath, '--bad-flag'], { encoding: 'utf8' });
checks.push({
  name: 'Invalid CLI flags exit code 2 (soak & run)',
  pass: badSoak.status === 2 && badRun.status === 2,
});

fs.rmSync(tmpDir, { recursive: true, force: true });

const allPass = checks.every((c) => c.pass);
const lines = [
  '# Phase 4 Verification Proof (Contract v1.3)',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Status: **${allPass ? 'ALL PASS' : 'FAIL'}**`,
  '',
  '## Checks',
  ...checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.name}: **${c.pass ? 'PASS' : 'FAIL'}**`),
  '',
];

fs.writeFileSync(path.join(proofDir, 'SUMMARY.md'), `${lines.join('\n')}\n`, 'utf8');
console.log(lines.join('\n'));
if (!allPass) {
  process.exit(1);
}
