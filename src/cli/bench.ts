import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveDistDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(here, '..'),
    path.resolve(here, '..', '..'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }
  throw new Error('Could not find built dist/index.html. Run `npm run build` first.');
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function parseArgs(argv: string[]): { seed: number; duration: number; out: string } {
  let seed: number | null = null;
  let duration: number | null = null;
  let out: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--seed') {
      const val = argv[++i];
      if (val === undefined || !/^-?\d+$/.test(val)) {
        throw new Error('Invalid or missing --seed');
      }
      seed = Number(val);
    } else if (arg === '--duration') {
      const val = argv[++i];
      if (val === undefined || !/^\d+(\.\d+)?$/.test(val) || Number(val) <= 0) {
        throw new Error('Invalid or missing --duration');
      }
      duration = Number(val);
    } else if (arg === '--out') {
      const val = argv[++i];
      if (!val) throw new Error('Invalid or missing --out');
      out = val;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (seed === null || duration === null || out === null) {
    throw new Error('Usage: bench --seed <int> --duration <sec> --out <file.json>');
  }

  return { seed, duration, out };
}

function findBrowserExecutable(): string | null {
  const envCandidates = [
    process.env.CHROME_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  ].filter((v): v is string => Boolean(v));
  for (const p of envCandidates) {
    if (fs.existsSync(p)) return p;
  }

  if (process.platform === 'win32') {
    const winCandidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of winCandidates) {
      if (fs.existsSync(p)) return p;
    }
  } else if (process.platform === 'darwin') {
    const macCandidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const p of macCandidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const linuxBins = ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
    for (const bin of linuxBins) {
      try {
        const resolved = execSync(`which ${bin}`, { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim();
        if (resolved && fs.existsSync(resolved)) return resolved;
      } catch {
        // ignore missing binary
      }
    }
  }
  return null;
}

function getOsLabel(): string {
  const platform =
    process.platform === 'win32'
      ? 'Windows'
      : process.platform === 'darwin'
        ? 'macOS'
        : 'Linux';
  return `${platform} ${os.release()} (${os.arch()})`;
}

interface BenchClientPayload {
  avg_fps: number;
  p1_low_fps: number;
  frame_ms_p95: number;
  frames: number;
  peak_mem_mb: number | null;
  renderer: string;
}

async function main(): Promise<void> {
  let args: { seed: number; duration: number; out: string };
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    console.error(
      'No Chromium/Chrome/Edge executable found. Set CHROME_BIN to your browser path.'
    );
    process.exit(1);
  }

  let distDir: string;
  try {
    distDir = resolveDistDir();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  let launchStartMs = Date.now();
  let loadMs = 0;
  let resolvedPayload = null as BenchClientPayload | null;
  let resolveDone!: () => void;
  const donePromise = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/api/bench-started' && req.method === 'POST') {
      loadMs = Math.max(1, Math.round(Date.now() - launchStartMs));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }

    if (urlPath === '/api/bench-result' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          resolvedPayload = JSON.parse(body) as BenchClientPayload;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          resolveDone();
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end('{"error":"bad json"}');
        }
      });
      return;
    }

    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const safePath = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(distDir, safePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 4173;
  const targetUrl = `http://127.0.0.1:${port}/?bench=1&seed=${args.seed}&duration=${args.duration}`;

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
  launchStartMs = Date.now();

  const child = spawn(
    browserBin,
    [
      `--app=${targetUrl}`,
      `--user-data-dir=${profileDir}`,
      '--window-size=1280,720',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
    ],
    {
      stdio: 'ignore',
      detached: false,
    }
  );

  const timeoutMs = (args.duration + 3 + 30) * 1000;
  const timer = setTimeout(() => {
    console.error(`Benchmark timed out after ${timeoutMs / 1000}s`);
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
    server.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
    process.exit(1);
  }, timeoutMs);

  await donePromise;
  clearTimeout(timer);

  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
  await new Promise((r) => setTimeout(r, 250));
  server.close();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // ignore locked temp cleanup on Windows
  }

  if (!resolvedPayload) {
    console.error('Benchmark did not receive measurement payload');
    process.exit(1);
  }

  const outJson = {
    contract_version: '1.3',
    avg_fps: resolvedPayload.avg_fps,
    p1_low_fps: resolvedPayload.p1_low_fps,
    frame_ms_p95: resolvedPayload.frame_ms_p95,
    frames: resolvedPayload.frames,
    load_ms: loadMs || 1,
    peak_mem_mb: resolvedPayload.peak_mem_mb,
    vsync_off: true,
    renderer: resolvedPayload.renderer,
    os: getOsLabel(),
  };

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(outJson, null, 2)}\n`, 'utf8');
  console.log(
    `Benchmark complete: avg_fps=${outJson.avg_fps}, p1_low_fps=${outJson.p1_low_fps}, frame_ms_p95=${outJson.frame_ms_p95}, frames=${outJson.frames}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
