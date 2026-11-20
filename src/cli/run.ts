import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
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

export function getLeaderboardPath(): string {
  if (process.env.DAO_DEN_LONG_LEADERBOARD_PATH) {
    return path.resolve(process.env.DAO_DEN_LONG_LEADERBOARD_PATH);
  }
  return path.join(os.homedir(), '.dao-den-long', 'leaderboard.json');
}

export function formatIsoWithTimezone(date: Date = new Date()): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${hh}:${mm}`
  );
}

export function sortAndCapLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime();
    })
    .slice(0, 10);
}

export function readLeaderboard(filePath: string = getLeaderboardPath()): LeaderboardEntry[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { entries?: unknown };
    if (!Array.isArray(parsed.entries)) return [];
    const valid = parsed.entries.filter((e): e is LeaderboardEntry => {
      if (!e || typeof e !== 'object') return false;
      const item = e as Record<string, unknown>;
      return (
        typeof item.name === 'string' &&
        /^[A-Za-z0-9_]{3,12}$/.test(item.name) &&
        typeof item.score === 'number' &&
        Number.isFinite(item.score) &&
        typeof item.nights_won === 'number' &&
        Number.isInteger(item.nights_won) &&
        item.nights_won >= 0 &&
        item.nights_won <= 3 &&
        typeof item.achieved_at === 'string' &&
        !Number.isNaN(Date.parse(item.achieved_at)) &&
        typeof item.seed === 'number' &&
        Number.isFinite(item.seed)
      );
    });
    return sortAndCapLeaderboard(valid);
  } catch {
    return [];
  }
}

export function writeLeaderboard(
  entries: LeaderboardEntry[],
  filePath: string = getLeaderboardPath()
): LeaderboardEntry[] {
  const sorted = sortAndCapLeaderboard(entries);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({ entries: sorted }, null, 2)}\n`, 'utf8');
  return sorted;
}

export function resolveDistDir(): string {
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

function main(): void {
  const argv = process.argv.slice(2);
  let exportPath: string | null = null;
  let port = 4173;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--export-leaderboard') {
      const val = argv[++i];
      if (!val) {
        console.error('Missing path for --export-leaderboard');
        process.exit(2);
      }
      exportPath = val;
    } else if (arg === '--port') {
      const val = argv[++i];
      if (!val || !/^\d+$/.test(val)) {
        console.error('Invalid --port');
        process.exit(2);
      }
      port = Number(val);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  if (exportPath !== null) {
    const entries = readLeaderboard();
    const resolved = path.resolve(exportPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify({ entries }, null, 2)}\n`, 'utf8');
    process.exit(0);
  }

  let distDir: string;
  try {
    distDir = resolveDistDir();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (urlPath === '/api/leaderboard') {
      if (req.method === 'GET') {
        const entries = readLeaderboard();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ entries }));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 65536) {
            req.destroy();
          }
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body) as Partial<LeaderboardEntry>;
            const name = typeof payload.name === 'string' ? payload.name.trim() : '';
            if (!/^[A-Za-z0-9_]{3,12}$/.test(name)) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ error: 'Name must match [A-Za-z0-9_]{3,12}' }));
              return;
            }
            const score = Math.max(0, Math.round(Number(payload.score ?? 0)));
            const nightsWon = Math.min(3, Math.max(0, Math.trunc(Number(payload.nights_won ?? 0))));
            const seed = Math.trunc(Number(payload.seed ?? 0));
            const achievedAt =
              typeof payload.achieved_at === 'string' && !Number.isNaN(Date.parse(payload.achieved_at))
                ? payload.achieved_at
                : formatIsoWithTimezone(new Date());
            const existing = readLeaderboard();
            const updated = writeLeaderboard([
              ...existing,
              { name, score, nights_won: nightsWon, achieved_at: achievedAt, seed },
            ]);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ entries: updated }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
          }
        });
        return;
      }
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

  server.listen(port, '127.0.0.1', () => {
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : port;
    console.log(`Đảo Đèn Lồng running at http://127.0.0.1:${actualPort}/`);
  });
}

main();
