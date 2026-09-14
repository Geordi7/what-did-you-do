import { createSignal, createEffect } from 'solid-js';
import type { Calendar, AppState } from './types';
import { randomColor } from './utils';

const STORAGE_KEY = 'achievement-calendars';

const STORAGE_VERSION = 1;

function migrate(state: AppState & { version?: number }): AppState {
  let calendars = state.calendars;
  // v0 → v1: add color
  if (!state.version || state.version < 1) {
    calendars = calendars.map(c => ({
      id: c.id,
      name: c.name,
      color: (c as any).color || randomColor(),
      days: c.days,
      deleted: c.deleted,
    }));
  }
  return { version: STORAGE_VERSION, calendars };
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
  get activeCalendars() { return state().calendars.filter(c => !c.deleted); },
  get deletedCalendars() { return state().calendars.filter(c => c.deleted); },

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
      calendars: s.calendars.map(c =>
        c.id === id ? { ...c, deleted: true } : c
      ),
    }));
  },

  recoverCalendar(id: string) {
    setState(s => ({
      calendars: s.calendars.map(c =>
        c.id === id ? { ...c, deleted: false } : c
      ),
    }));
  },

  purgeDeleted() {
    setState(s => ({
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