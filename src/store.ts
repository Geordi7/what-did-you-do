import { createSignal, createEffect } from 'solid-js';
import type { Calendar, AppState } from './types';
import { randomColor } from './utils';

const STORAGE_KEY = 'achievement-calendars';

function migrate(state: AppState): AppState {
  const calendars = state.calendars.map(c => {
    if (!('color' in c)) {
      return { ...c, color: randomColor() };
    }
    return c;
  });
  return { calendars };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw) as AppState);
  } catch { /* ignore */ }
  return { calendars: [] };
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const initial = loadState();

const [state, setState] = createSignal<AppState>(initial);

createEffect(() => {
  saveState(state());
});

export const store = {
  get state() { return state(); },
  get calendars() { return state().calendars; },

  addCalendar(name: string) {
    const cal: Calendar = {
      id: crypto.randomUUID(),
      name,
      color: randomColor(),
      days: {},
    };
    setState(s => ({
      calendars: [...s.calendars, cal],
    }));
  },

  deleteCalendar(id: string) {
    setState(s => ({
      calendars: s.calendars.filter(c => c.id !== id),
    }));
  },

  moveCalendar(id: string, direction: -1 | 1) {
    setState(s => {
      const idx = s.calendars.findIndex(c => c.id === id);
      if (idx < 0) return s;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= s.calendars.length) return s;
      const cals = [...s.calendars];
      [cals[idx], cals[newIdx]] = [cals[newIdx], cals[idx]];
      return { calendars: cals };
    });
  },

  setColor(id: string, color: string) {
    setState(s => ({
      calendars: s.calendars.map(c =>
        c.id === id ? { ...c, color } : c
      ),
    }));
  },

  setCalendarName(id: string, name: string) {
    setState(s => ({
      calendars: s.calendars.map(c =>
        c.id === id ? { ...c, name } : c
      ),
    }));
  },

  incrementDay(calId: string, dateKey: string) {
    setState(s => ({
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
      calendars: s.calendars.map(c => {
        if (c.id !== calId) return c;
        const days = { ...c.days };
        delete days[dateKey];
        return { ...c, days };
      }),
    }));
  },
};