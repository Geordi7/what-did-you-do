import { test, expect } from '@playwright/test';
import { STORAGE_KEY } from '../src/persistence-contract';

test('production CSP permits mounting and persisting a calendar mutation', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    document.addEventListener('securitypolicyviolation', event => {
      const root = document.documentElement;
      const violations: string[] = JSON.parse(root.dataset.cspViolations ?? '[]');
      root.dataset.cspViolations = JSON.stringify([...violations, event.violatedDirective]);
    });
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const result = await page.evaluate(key => {
    const store = window.__store;
    if (store) {
      store.addCalendar('Production smoke');
      store.incrementDay(store.calendars[0].id, '2026-10-18');
    }
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    return {
      title: document.querySelector('h1')?.textContent ?? null,
      policy: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? null,
      persisted: saved.calendars?.[0]?.days?.['2026-10-18'] === 1,
      violations: JSON.parse(document.documentElement.dataset.cspViolations ?? '[]'),
    };
  }, STORAGE_KEY);
  expect(result).toEqual({
    title: '😱 What did you do!?',
    policy: "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
    persisted: true,
    violations: [],
  });
});
