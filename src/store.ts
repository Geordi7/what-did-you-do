import { createSignal, createEffect } from 'solid-js';
import type { Calendar, AppState, ThemeMode } from './types';
import { randomColor } from './utils';

const STORAGE_KEY = 'achievement-calendars';
const STORAGE_VERSION = 2;
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
      deleted: c.deleted,
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

export const store = {
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