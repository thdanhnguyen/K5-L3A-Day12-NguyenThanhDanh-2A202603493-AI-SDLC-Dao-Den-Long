import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

await mkdir(path.join(rootDir, 'dist', 'headless'), { recursive: true });
await mkdir(path.join(rootDir, 'dist', 'cli'), { recursive: true });

await Promise.all([
  build({
    entryPoints: [path.join(rootDir, 'src', 'headless', 'cli.ts')],
    outfile: path.join(rootDir, 'dist', 'headless', 'cli.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: false,
    logLevel: 'info',
  }),
  build({
    entryPoints: [path.join(rootDir, 'src', 'cli', 'run.ts')],
    outfile: path.join(rootDir, 'dist', 'cli', 'run.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: false,
    logLevel: 'info',
  }),
  build({
    entryPoints: [path.join(rootDir, 'src', 'cli', 'bench.ts')],
    outfile: path.join(rootDir, 'dist', 'cli', 'bench.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: false,
    logLevel: 'info',
  }),
  build({
    entryPoints: [path.join(rootDir, 'src', 'cli', 'soak.ts')],
    outfile: path.join(rootDir, 'dist', 'cli', 'soak.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: false,
    logLevel: 'info',
  }),
]);
