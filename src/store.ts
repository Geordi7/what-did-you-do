import { createSignal, createEffect } from 'solid-js';
import type { Calendar, AppState, ThemeMode } from './types';
import { randomColor } from './utils';

const STORAGE_KEY = 'achievement-calendars';
const EXPORT_KEY = 'achievement-calendars-last-export';
const STORAGE_VERSION = 3;
const THEME_KEY = 'achievement-calendars-theme';

function migrate(state: AppState & { version?: number }): AppState {
  let calendars = state.calendars;
  let theme = state.theme ?? 'system';

  if (!state.version || state.version < 1) {
    calendars = calendars.map(c => ({
      id: c.id,
      name: c.name,
      color: (c as any).color || randomColor(),
      days: c.days,
      activityValue: (c as any).activityValue ?? 1.0,
      deleted: c.deleted,
    }));
  }

  if (state.version && state.version < 3) {
    calendars = calendars.map(c => ({
      ...c,
      activityValue: (c as any).activityValue ?? 1.0,
    }));
  }

  return { version: STORAGE_VERSION, theme, calendars };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw) as AppState);
  } catch {}
  return { version: STORAGE_VERSION, theme: 'system', calendars: [] };
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {}
  return loadState().theme ?? 'system';
}

function saveTheme(theme: ThemeMode) {
  localStorage.setItem(THEME_KEY, theme);
}

const initial = loadState();
if (!initial.theme) initial.theme = 'system';

const [state, setState] = createSignal<AppState>(initial);
const [theme, setThemeSignal] = createSignal<ThemeMode>(loadTheme());

createEffect(() => {
  saveState(state());
});

createEffect(() => {
  saveTheme(theme());
});

const [highlightedKey, setHighlightedKey] = createSignal<string | null>(null);

export const store = {
  get highlightedKey() { return highlightedKey(); },
  setHighlightedKey(key: string | null) { setHighlightedKey(key); },
  get state() { return state(); },
  get theme() { return theme(); },
  get calendars() { return state().calendars; },
  get activeCalendars() { return state().calendars.filter(c => !c.deleted); },
  get deletedCalendars() { return state().calendars.filter(c => c.deleted); },

  setTheme(mode: ThemeMode) {
    setThemeSignal(mode);
  },

  addCalendar(name: string) {
    const cal: Calendar = {
      id: crypto.randomUUID(),
      name,
      color: randomColor(),
      days: {},
      activityValue: 1.0,
    };
    setState(s => ({ ...s, calendars: [...s.calendars, cal] }));
  },

  deleteCalendar(id: string) {
    setState(s => ({
      ...s,
      calendars: s.calendars.map(c => c.id === id ? { ...c, deleted: true } : c),
    }));
  },

  recoverCalendar(id: string) {
    setState(s => ({
      ...s,
      calendars: s.calendars.map(c => c.id === id ? { ...c, deleted: false } : c),
    }));
  },

  purgeDeleted() {
    setState(s => ({
      ...s,
      calendars: s.calendars.filter(c => !c.deleted),
    }));
  },

  permanentlyDeleteCalendar(id: string) {
    setState(s => ({
      ...s,
      calendars: s.calendars.filter(c => c.id !== id),
    }));
  },

  exportCalendar(id: string): string {
    const cal = state().calendars.find(c => c.id === id);
    if (!cal) return '';
    return btoa(JSON.stringify(cal));
  },

  setLastExport() {
    localStorage.setItem(EXPORT_KEY, Date.now().toString());
  },

  getLastExport(): number | null {
    const raw = localStorage.getItem(EXPORT_KEY);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    return isNaN(ts) ? null : ts;
  },

  exportAllCalendars(): string {
    const data = state().calendars;
    return btoa(JSON.stringify(data));
  },

  importCalendars(base64: string): number {
    try {
      const raw = atob(base64);
      const parsed = JSON.parse(raw);
      let cals: Calendar[];
      if (Array.isArray(parsed)) {
        cals = parsed;
      } else if (parsed && typeof parsed === 'object' && parsed.id && parsed.name) {
        cals = [parsed];
      } else {
        return 0;
      }
      let imported = 0;
      setState(s => {
        const existingIds = new Set(s.calendars.map(c => c.id));
        const newCals: Calendar[] = [];
        for (const cal of cals) {
          if (!cal.id || !cal.name) continue;
          if (existingIds.has(cal.id)) {
            // Clone with new ID if collision
            newCals.push({ ...cal, id: crypto.randomUUID() });
          } else {
            newCals.push({ ...cal, deleted: false });
          }
          existingIds.add(newCals[newCals.length - 1].id);
          imported++;
        }
        return { ...s, calendars: [...s.calendars, ...newCals] };
      });
      return imported;
    } catch {
      return -1;
    }
  },

  moveCalendar(id: string, direction: -1 | 1) {
    setState(s => {
      const activeIds = s.calendars.filter(c => !c.deleted).map(c => c.id);
      const activeIdx = activeIds.indexOf(id);
      if (activeIdx < 0) return s;
      const newActiveIdx = activeIdx + direction;
      if (newActiveIdx < 0 || newActiveIdx >= activeIds.length) return s;
      const targetId = activeIds[newActiveIdx];
      const allIds = s.calendars.map(c => c.id);
      const idxA = allIds.indexOf(id);
      const idxB = allIds.indexOf(targetId);
      const cals = [...s.calendars];
      [cals[idxA], cals[idxB]] = [cals[idxB], cals[idxA]];
      return { ...s, calendars: cals };
    });
  },

  setColor(id: string, color: string) {
    setState(s => ({
      ...s,
      calendars: s.calendars.map(c => c.id === id ? { ...c, color } : c),
    }));
  },

  setActivityValue(id: string, value: number) {
    setState(s => ({
      ...s,
      calendars: s.calendars.map(c => c.id === id ? { ...c, activityValue: value } : c),
    }));
  },

  setCalendarName(id: string, name: string) {
    setState(s => ({
      ...s,
      calendars: s.calendars.map(c => c.id === id ? { ...c, name } : c),
    }));
  },

  incrementDay(calId: string, dateKey: string) {
    setState(s => ({
      ...s,
      calendars: s.calendars.map(c => {
        if (c.id !== calId) return c;
        const days = { ...c.days };
        days[dateKey] = (days[dateKey] ?? 0) + 1;
        return { ...c, days };
      }),
    }));
  },

  zeroDay(calId: string, dateKey: string) {
    setState(s => ({
      ...s,
      calendars: s.calendars.map(c => {
        if (c.id !== calId) return c;
        const days = { ...c.days };
        delete days[dateKey];
        return { ...c, days };
      }),
    }));
  },
};