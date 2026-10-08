/**
 * The score chart rendering case of `specs/05-02-browser-tier.md` "Scope", asserting the bar
 * geometry `specs/04-01-score-chart.md` "Bars" states: each net bar is filled, at most 12px wide,
 * centred in its column and grows from the zero line on its own side; each component marker is a
 * diamond centred on its value; and every mark stays inside the chart area. Whether the fill reads
 * as green or red, and whether a marker reads as a diamond, stay manual judgements.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, seedState } from './harness';

const SEED_VERSION = 5;

/** Sub-pixel rounding allowance on box edges. */
const EPSILON = 1;

const MAX_BAR_WIDTH = 12;

/** A marker smaller than this is a tick, not a diamond. */
const MIN_MARKER_SIZE = 6;

/** How far short of the chart's edge a full-scale value may stop, to leave room for its marker. */
const MARKER_INSET = 5;

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
    expect(b.width).toBeLessThanOrEqual(MAX_BAR_WIDTH + EPSILON);

    const column = await box(bar.locator('xpath=ancestor::*[contains(@class, "score-bar-col")]'));
    expect(Math.abs(b.x + b.width / 2 - (column.x + column.width / 2))).toBeLessThanOrEqual(EPSILON);

    const fill = await bar.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(fill).not.toBe('rgba(0, 0, 0, 0)');

    const up = await bar.evaluate(el => el.classList.contains('score-netbar-up'));
    if (up) {
      expect(Math.abs(b.y + b.height - zero)).toBeLessThanOrEqual(EPSILON);
    } else {
      expect(Math.abs(b.y - zero)).toBeLessThanOrEqual(EPSILON);
    }
  }

  const markers = page.locator('.score-dot');
  for (let i = 0; i < (await markers.count()); i++) {
    const b = await box(markers.nth(i));
    expect(b.height).toBeGreaterThanOrEqual(MIN_MARKER_SIZE);
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

  // The full-scale bar reaches the chart's bottom edge, short only of room for its marker.
  const wrap = await box(page.locator('.score-bar-wrap'));
  const full = await box(columns.nth(25).locator('.score-netbar-down'));
  const fullEnd = full.y + full.height;
  expect(wrap.y + wrap.height - fullEnd).toBeLessThanOrEqual(MARKER_INSET);

  // A marker is centred on its value: where a component equals the net, on the bar's end.
  const negMarker = await box(columns.nth(25).locator('.score-dot-neg'));
  expect(Math.abs(negMarker.y + negMarker.height / 2 - fullEnd)).toBeLessThanOrEqual(EPSILON);
  const up = await box(columns.nth(26).locator('.score-netbar-up'));
  const posMarker = await box(columns.nth(26).locator('.score-dot-pos'));
  expect(Math.abs(posMarker.y + posMarker.height / 2 - up.y)).toBeLessThanOrEqual(EPSILON);
});

test('26-week net bars are filled, anchored on the zero line, and inside the chart', async ({ page }) => {
  await seedState(page, chartState('26w'));
  await open(page);

  await expect(page.locator('.score-bar-col')).toHaveCount(26);
  await expectBarGeometry(page);
});
