import { expect, it } from 'vitest';
import { createAppStore, store as productionStore } from './store';

productionStore.dispose();

it('creates independent stores with injected storage and clock', () => {
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({ getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } });
  const first = createAppStore({ storage: () => storage(a), now: () => new Date('2026-10-18T12:34:56.000Z'), events: null });
  const second = createAppStore({ storage: () => storage(b), events: null });
  try {
    first.addCalendar('First');
    expect(second.calendars).toEqual([]);
    expect(first.calendars[0].updatedAt).toBe('2026-10-18T12:34:56.000Z');
    expect(a.get('achievement-calendars')).toContain('First');
    expect(b.get('achievement-calendars')).not.toContain('First');
  } finally { first.dispose(); second.dispose(); }
});

it('removes its storage listener and disables persistence on disposal', () => {
  const target = new EventTarget();
  let listeners = 0;
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  target.addEventListener = (...args) => { listeners++; add(...args); };
  target.removeEventListener = (...args) => { listeners--; remove(...args); };
  let writes = 0;
  const store = createAppStore({ storage: () => ({ getItem: () => null, setItem: () => { writes++; } }), events: target });
  expect(listeners).toBe(1);
  store.dispose();
  store.dispose();
  expect(listeners).toBe(0);
  const before = writes;
  store.addCalendar('After disposal');
  expect(writes).toBe(before);
});
