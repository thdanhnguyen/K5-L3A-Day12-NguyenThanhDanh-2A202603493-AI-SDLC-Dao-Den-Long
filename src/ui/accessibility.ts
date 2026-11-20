export type ActionKey =
  | 'moveForward'
  | 'moveBackward'
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'dash'
  | 'interact'
  | 'pulse'
  | 'pause';

export type KeyBindings = Record<ActionKey, string>;

export const ACTION_LABELS: Record<ActionKey, string> = {
  moveForward: 'Đi thẳng',
  moveBackward: 'Đi lùi',
  moveLeft: 'Sang trái',
  moveRight: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Nạp / Châm dầu',
  pulse: 'Tỏa sáng',
  pause: 'Tạm dừng',
};

export const DEFAULT_KEYBINDS: KeyBindings = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyQ',
  pause: 'Escape',
};

export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  return code;
}

export function findKeybindConflicts(binds: KeyBindings): string[] {
  const seen = new Map<string, ActionKey[]>();
  for (const action of Object.keys(DEFAULT_KEYBINDS) as ActionKey[]) {
    const code = binds[action];
    const list = seen.get(code) ?? [];
    list.push(action);
    seen.set(code, list);
  }
  const conflicts: string[] = [];
  for (const [code, actions] of seen.entries()) {
    if (actions.length > 1) {
      conflicts.push(
        `${formatKeyCode(code)} trùng giữa: ${actions.map((a) => ACTION_LABELS[a]).join(', ')}`
      );
    }
  }
  return conflicts;
}

export interface ClientLeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

const LOCAL_LB_KEY = 'dao_den_long_leaderboard_v1';

function sortCap(entries: ClientLeaderboardEntry[]): ClientLeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime();
    })
    .slice(0, 10);
}

export function formatLocalIso(): string {
  const d = new Date();
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${hh}:${mm}`
  );
}

export async function loadLeaderboard(): Promise<ClientLeaderboardEntry[]> {
  try {
    const resp = await fetch('/api/leaderboard');
    if (resp.ok) {
      const data = (await resp.json()) as { entries?: ClientLeaderboardEntry[] };
      if (Array.isArray(data.entries)) {
        localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(data.entries));
        return sortCap(data.entries);
      }
    }
  } catch {
    // Fallback to localStorage when served statically without /api/leaderboard
  }

  try {
    const raw = localStorage.getItem(LOCAL_LB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClientLeaderboardEntry[];
    return Array.isArray(parsed) ? sortCap(parsed) : [];
  } catch {
    return [];
  }
}

export async function saveLeaderboardEntry(
  entry: ClientLeaderboardEntry
): Promise<ClientLeaderboardEntry[]> {
  try {
    const resp = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { entries?: ClientLeaderboardEntry[] };
      if (Array.isArray(data.entries)) {
        localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(data.entries));
        return sortCap(data.entries);
      }
    }
  } catch {
    // Fallback to localStorage
  }

  const current = await loadLeaderboard();
  const next = sortCap([...current, entry]);
  localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(next));
  return next;
}
