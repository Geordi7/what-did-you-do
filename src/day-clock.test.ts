import { afterEach, expect, it, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { createDayClock } from './day-clock';

afterEach(() => vi.useRealTimers());

it('advances over two midnights and cancels the latest timer on disposal', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 13, 23, 59, 59));
  let dispose = () => {};
  const now = createRoot(stop => { dispose = stop; return createDayClock(); });
  vi.advanceTimersByTime(2000);
  expect(now().getDate()).toBe(14);
  vi.advanceTimersByTime(24 * 60 * 60 * 1000);
  expect(now().getDate()).toBe(15);
  dispose();
  expect(vi.getTimerCount()).toBe(0);
  const stopped = now();
  vi.advanceTimersByTime(24 * 60 * 60 * 1000);
  expect(now()).toBe(stopped);
});

it('can be disposed after its first tick without leaving a recursive timer', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 13, 23, 59, 59));
  let dispose = () => {};
  createRoot(stop => { dispose = stop; createDayClock(); });
  vi.advanceTimersByTime(2000);
  expect(vi.getTimerCount()).toBe(1);
  dispose();
  expect(vi.getTimerCount()).toBe(0);
});
