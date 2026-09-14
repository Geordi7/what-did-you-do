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

export function cellColor(baseHex: string, intensity: number, isLight = false): string {
  if (intensity <= 0) return isLight ? '#ebedf0' : '#1d2226';
  const bg: [number, number, number] = isLight ? [235, 237, 240] : [29, 34, 38];
  const [r, g, b] = parseHex(baseHex);
  const t = intensity;
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