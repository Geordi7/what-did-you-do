/**
 * The score chart rendering case of `specs/05-02-browser-tier.md` "Scope", asserting the bar
 * geometry `specs/04-01-score-chart.md` "Bars" states: each net bar is filled and grows from the
 * zero line on its own side, and every mark stays inside the chart area. Whether the fill reads as
 * green or red stays a manual judgement; this asserts only that there is one.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, seedState } from './harness';

const SEED_VERSION = 5;

/** Sub-pixel rounding allowance on box edges. */
const EPSILON = 1;

function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Today nets +3 out of +4 and -1, yesterday nets +2, and the day before nets -4: the largest
 * absolute value in the range, so that day's bar is full scale.
 */
function chartState(chartRange: '28d' | '26w') {
  return {
    version: SEED_VERSION,
    theme: 'light',
    chartRange,
    calendars: [
      {
        id: 'sc-wins',
        name: 'Wins',
        color: '#40c463',
        days: { [dayKey(0)]: 4, [dayKey(-1)]: 2 },
        activityValue: 1,
        updatedAt: '2025-05-10T00:00:00.000Z',
      },
      {
        id: 'sc-slips',
        name: 'Slips',
        color: '#d73a49',
        days: { [dayKey(0)]: 1, [dayKey(-2)]: 4 },
        activityValue: -1,
        updatedAt: '2025-05-10T00:00:00.000Z',
      },
    ],
  };
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

/** Every net bar is filled, anchored on the zero line on its own side, and inside the chart. */
async function expectBarGeometry(page: Page) {
  const wrap = await box(page.locator('.score-bar-wrap'));
  const zero = wrap.y + wrap.height / 2;

  const bars = page.locator('.score-netbar');
  const count = await bars.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const bar = bars.nth(i);
    const b = await box(bar);
    expect(b.height).toBeGreaterThan(0);

    const fill = await bar.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(fill).not.toBe('rgba(0, 0, 0, 0)');

    const up = await bar.evaluate(el => el.classList.contains('score-netbar-up'));
    if (up) {
      expect(Math.abs(b.y + b.height - zero)).toBeLessThanOrEqual(EPSILON);
    } else {
      expect(Math.abs(b.y - zero)).toBeLessThanOrEqual(EPSILON);
    }
  }

  const marks = page.locator('.score-netbar, .score-dot');
  for (let i = 0; i < (await marks.count()); i++) {
    const b = await box(marks.nth(i));
    expect(b.y).toBeGreaterThanOrEqual(wrap.y - EPSILON);
    expect(b.y + b.height).toBeLessThanOrEqual(wrap.y + wrap.height + EPSILON);
  }
}

test('28-day net bars are filled, anchored on the zero line, and inside the chart', async ({ page }) => {
  await seedState(page, chartState('28d'));
  await open(page);

  const columns = page.locator('.score-bar-col');
  await expect(columns).toHaveCount(28);
  await expect(columns.nth(27).locator('.score-netbar-up')).toHaveCount(1);
  await expect(columns.nth(26).locator('.score-netbar-up')).toHaveCount(1);
  await expect(columns.nth(25).locator('.score-netbar-down')).toHaveCount(1);

  await expectBarGeometry(page);

  // The full-scale bar reaches the chart's bottom edge.
  const wrap = await box(page.locator('.score-bar-wrap'));
  const full = await box(columns.nth(25).locator('.score-netbar-down'));
  expect(Math.abs(full.y + full.height - (wrap.y + wrap.height))).toBeLessThanOrEqual(EPSILON);
});

test('26-week net bars are filled, anchored on the zero line, and inside the chart', async ({ page }) => {
  await seedState(page, chartState('26w'));
  await open(page);

  await expect(page.locator('.score-bar-col')).toHaveCount(26);
  await expectBarGeometry(page);
});
