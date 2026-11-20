import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const cliPath = path.join(rootDir, 'dist', 'headless', 'cli.js');
const proofDir = path.join(rootDir, 'docs', 'proof', 'phase-3');

mkdirSync(proofDir, { recursive: true });
const tempDir = mkdtempSync(path.join(tmpdir(), 'ddl-proof-p3-'));

function runHeadless(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

const checks = [];

// 1. Determinism across all 3 Nights (Contract v1.2)
for (const night of ['1', '2', '3']) {
  const out1 = path.join(proofDir, `night${night}-run1.jsonl`);
  const out2 = path.join(proofDir, `night${night}-run2.jsonl`);
  const args = ['--seed', '42', '--night', night, '--ticks', '600', '--snapshot-every', '60'];
  const r1 = runHeadless([...args, '--out', out1]);
  const r2 = runHeadless([...args, '--out', out2]);
  const h1 = createHash('sha256').update(readFileSync(out1)).digest('hex');
  const h2 = createHash('sha256').update(readFileSync(out2)).digest('hex');
  checks.push({
    name: `Night ${night} Determinism (2x seed=42, 600t)`,
    exitCode: `${r1.status}/${r2.status}`,
    passed: r1.status === 0 && r2.status === 0 && h1 === h2,
    detail: `SHA-256=${h1.slice(0, 16)}...`,
  });
}

// 2. Full 18,000-tick Night 3 Performance Benchmark (<= 30s)
const perfOut = path.join(tempDir, 'night3-full.jsonl');
const t0 = performance.now();
const perfRes = runHeadless([
  '--seed', '77', '--night', '3', '--ticks', '18000', '--snapshot-every', '600', '--out', perfOut,
]);
const perfMs = Math.round(performance.now() - t0);
const perfLines = perfRes.status === 0 ? readFileSync(perfOut, 'utf8').trim().split('\n') : [];
const perfEnd = perfLines.length > 0 ? perfLines[perfLines.length - 1] : '';
checks.push({
  name: 'Night 3 Full 18,000-Tick Headless Benchmark (<= 30s)',
  exitCode: String(perfRes.status),
  passed: perfRes.status === 0 && perfMs <= 30000,
  detail: `${perfMs} ms | ${perfEnd}`,
});

// 3. Malformed inputs -> exit code 2
const badPath = path.join(tempDir, 'bad-inputs.json');
writeFileSync(badPath, JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }), 'utf8');
const badRes = runHeadless([
  '--seed', '1', '--night', '1', '--inputs', badPath, '--ticks', '10', '--out', path.join(tempDir, 'unused.jsonl'),
]);
checks.push({
  name: 'Malformed Inputs Exit Code 2',
  exitCode: String(badRes.status),
  passed: badRes.status === 2 && badRes.stderr.trim().length > 0,
  detail: badRes.stderr.trim(),
});

rmSync(tempDir, { recursive: true, force: true });

const allPassed = checks.every((c) => c.passed);
const rows = checks
  .map((c) => `| ${c.name} | \`${c.exitCode}\` | ${c.passed ? 'PASS' : 'FAIL'} | \`${c.detail}\` |`)
  .join('\n');

const summary = `# Phase 3 Verification Proof Summary (Contract v1.2)

- **Platform:** \`${process.platform} (${process.arch})\`
- **Node:** \`${process.version}\`
- **Overall Result:** **${allPassed ? 'ALL PASS' : 'FAILED'}**

## Headless Contract v1.2, Benchmark & Determinism Results

| Check | Exit Code | Status | Observed Output |
|---|---:|---|---|
${rows}
`;

writeFileSync(path.join(proofDir, 'SUMMARY.md'), summary, 'utf8');
console.log(summary);

if (!allPassed) {
  process.exit(1);
}
