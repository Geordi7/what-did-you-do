export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(d);
  result.setDate(d.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Weeks each calendar grid shows up to and including the current week (`specs/04-05-calendar-grid.md`). */
export const GRID_HISTORY_WEEKS = 22;
/** Weeks each calendar grid shows after the current week. */
export const GRID_FUTURE_WEEKS = 4;

/** The shared calendar grid window around `now`: history weeks, then future weeks. */
export function calendarGrid(now: Date): Date[][] {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7 * GRID_FUTURE_WEEKS);
  return buildGrid(end, GRID_HISTORY_WEEKS + GRID_FUTURE_WEEKS);
}

export function buildGrid(endDate: Date, numWeeks: number): Date[][] {
  const mon = startOfWeek(endDate);
  mon.setDate(mon.getDate() - (numWeeks - 1) * 7);

  const weeks: Date[][] = [];
  const cursor = new Date(mon);
  for (let w = 0; w < numWeeks; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Positive-bias curve, see specs/04-05-calendar-grid.md "Heatmap intensity curve".
export const INTENSITY_EXPONENT = 0.5;

export function cellColor(baseHex: string, intensity: number, isLight = false): string {
  if (intensity <= 0) return isLight ? '#d8dde3' : '#2d333b';
  const bg: [number, number, number] = isLight ? [216, 221, 227] : [45, 51, 59];
  const [r, g, b] = parseHex(baseHex);
  const t = intensity ** INTENSITY_EXPONENT;
  return rgbToHex(
    bg[0] + (r - bg[0]) * t,
    bg[1] + (g - bg[1]) * t,
    bg[2] + (b - bg[2]) * t,
  );
}

export function totalActivities(days: Record<string, number>): number {
  return Object.values(days).reduce((a, b) => a + b, 0);
}

export function hexToRgb(hex: string): string {
  return parseHex(hex).join(', ');
}

export function randomColor(): string {
  const hue = Math.random() * 360;
  const sat = 0.65 + Math.random() * 0.25;
  const light = 0.45 + Math.random() * 0.15;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = light - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; b = 0; }
  else if (hue < 120) { r = x; g = c; b = 0; }
  else if (hue < 180) { r = 0; g = c; b = x; }
  else if (hue < 240) { r = 0; g = x; b = c; }
  else if (hue < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

// `crypto.randomUUID` is undefined on plain HTTP to a non-localhost origin in every browser,
// so this degrades twice rather than throwing. See specs/03-data-model.md (Calendar.id).
export function newId(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      // fall through to the byte-based paths
    }
  }
  const bytes = new Uint8Array(16);
  let filled = false;
  if (c && typeof c.getRandomValues === 'function') {
    try {
      c.getRandomValues(bytes);
      filled = true;
    } catch {
      filled = false;
    }
  }
  if (!filled) {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** Local wall-clock time to the second; dashes, since colons are not filename-safe everywhere. */
export function exportFilename(d: Date): string {
  const time = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join('-');
  return `calendars_${dateKey(d)}_${time}.json`;
}

export function downloadFile(filename: string, contents: string, mime = 'application/json'): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Returns the disposer; every caller must invoke it (onCleanup), see specs/02-01-coding-standard.md.
export function onClickOutside(el: HTMLElement, handler: () => void): () => void {
  const listener = (e: MouseEvent) => {
    const target = e.target;
    if (target instanceof Node && el.contains(target)) return;
    handler();
  };
  // Attach on the next tick. A listener added to a node propagation has not yet reached
  // still receives the in-flight event, so registering while a click is being dispatched
  // would fire `handler` for the very click that opened the thing being watched.
  const pending = setTimeout(() => document.addEventListener('click', listener), 0);
  return () => {
    clearTimeout(pending);
    document.removeEventListener('click', listener);
  };
}
