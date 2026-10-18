/**
 * The score chart rendering case of `specs/05-02-browser-tier.md` "Scope", asserting the mark
 * geometry `specs/04-01-score-chart.md` "Marks" states: each total bar is filled, at most 8px wide,
 * 2px left of its column's centre and grows from the zero line on its own side; each net diamond
 * sits 2px right of its column's centre, is centred on its value and is classed gold, up or down
 * by its net; every mark stays inside the chart area; and a column's tooltip sits wholly below the
 * chart card, centred on the column, shifting inward to stay within the card's width. Whether the fills read as green, red or gold, and whether a
 * marker reads as a diamond, stay manual judgements.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, seedState } from './harness';

const SEED_VERSION = 5;

/** Sub-pixel rounding allowance on box edges. */
const EPSILON = 1;

const MAX_BAR_WIDTH = 8;

/** Bars sit this far left of their column's centre, and diamonds this far right. */
const MARK_OFFSET = 2;

async function columnCentre(mark: Locator): Promise<number> {
  const column = await box(mark.locator('xpath=ancestor::*[contains(@class, "score-bar-col")]'));
  return column.x + column.width / 2;
}

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
 * Today nets +3 out of +4 and -1, so its diamond is up; yesterday nets +2 with no negatives, so its
 * diamond is gold; the day before nets -4, down. +4 and -4 are the largest absolute values in the
 * range, so today's positive bar and the day before's negative bar are full scale.
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

/** Every total bar is filled, anchored on the zero line on its own side, and inside the chart. */
async function expectBarGeometry(page: Page) {
  const wrap = await box(page.locator('.score-bar-wrap'));
  const zero = wrap.y + wrap.height / 2;

  const bars = page.locator('.score-total');
  const count = await bars.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const bar = bars.nth(i);
    const b = await box(bar);
    expect(b.height).toBeGreaterThan(0);
    expect(b.width).toBeLessThanOrEqual(MAX_BAR_WIDTH + EPSILON);

    expect(Math.abs(b.x + b.width / 2 - (await columnCentre(bar) - MARK_OFFSET))).toBeLessThanOrEqual(EPSILON);

    const fill = await bar.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(fill).not.toBe('rgba(0, 0, 0, 0)');

    const up = await bar.evaluate(el => el.classList.contains('score-total-pos'));
    if (up) {
      expect(Math.abs(b.y + b.height - zero)).toBeLessThanOrEqual(EPSILON);
    } else {
      expect(Math.abs(b.y - zero)).toBeLessThanOrEqual(EPSILON);
    }
  }

  const markers = page.locator('.score-net');
  for (let i = 0; i < (await markers.count()); i++) {
    const marker = markers.nth(i);
    const b = await box(marker);
    expect(b.height).toBeGreaterThanOrEqual(MIN_MARKER_SIZE);
    expect(Math.abs(b.x + b.width / 2 - (await columnCentre(marker) + MARK_OFFSET))).toBeLessThanOrEqual(EPSILON);
  }

  const marks = page.locator('.score-total, .score-net');
  for (let i = 0; i < (await marks.count()); i++) {
    const b = await box(marks.nth(i));
    expect(b.y).toBeGreaterThanOrEqual(wrap.y - EPSILON);
    expect(b.y + b.height).toBeLessThanOrEqual(wrap.y + wrap.height + EPSILON);
  }
}

test('28-day total bars and net diamonds are placed on their values inside the chart', async ({ page }) => {
  await seedState(page, chartState('28d'));
  await open(page);

  const columns = page.locator('.score-bar-col');
  await expect(columns).toHaveCount(28);
  await expect(columns.nth(27).locator('.score-total-pos')).toHaveCount(1);
  await expect(columns.nth(27).locator('.score-total-neg')).toHaveCount(1);
  await expect(columns.nth(26).locator('.score-total-pos')).toHaveCount(1);
  await expect(columns.nth(26).locator('.score-total-neg')).toHaveCount(0);
  await expect(columns.nth(25).locator('.score-total-neg')).toHaveCount(1);
  await expect(columns.nth(25).locator('.score-total-pos')).toHaveCount(0);

  // One diamond per non-zero net, classed by its net.
  await expect(columns.nth(27).locator('.score-net.score-net-up')).toHaveCount(1);
  await expect(columns.nth(26).locator('.score-net.score-net-gold')).toHaveCount(1);
  await expect(columns.nth(25).locator('.score-net.score-net-down')).toHaveCount(1);
  await expect(columns.nth(24).locator('.score-net')).toHaveCount(0);

  await expectBarGeometry(page);

  // The full-scale bars reach the chart's edges, short only of room for a diamond.
  const wrap = await box(page.locator('.score-bar-wrap'));
  const fullNeg = await box(columns.nth(25).locator('.score-total-neg'));
  const fullNegEnd = fullNeg.y + fullNeg.height;
  expect(wrap.y + wrap.height - fullNegEnd).toBeLessThanOrEqual(MARKER_INSET);
  const fullPos = await box(columns.nth(27).locator('.score-total-pos'));
  expect(fullPos.y - wrap.y).toBeLessThanOrEqual(MARKER_INSET);

  // A diamond is centred on its net: where the net equals a total, on that bar's end.
  const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
  const down = await box(columns.nth(25).locator('.score-net'));
  expect(Math.abs(centre(down) - fullNegEnd)).toBeLessThanOrEqual(EPSILON);
  const goldBar = await box(columns.nth(26).locator('.score-total-pos'));
  const gold = await box(columns.nth(26).locator('.score-net'));
  expect(Math.abs(centre(gold) - goldBar.y)).toBeLessThanOrEqual(EPSILON);

  // Today's net of +3 sits three quarters of the way up its +4 bar.
  const zero = wrap.y + wrap.height / 2;
  const upNet = await box(columns.nth(27).locator('.score-net'));
  expect(Math.abs(centre(upNet) - (zero - (zero - fullPos.y) * 0.75))).toBeLessThanOrEqual(EPSILON);
});

test('26-week total bars and net diamonds stay inside the chart', async ({ page }) => {
  await seedState(page, chartState('26w'));
  await open(page);

  await expect(page.locator('.score-bar-col')).toHaveCount(26);
  await expectBarGeometry(page);
});

test('a hovered column shows its tooltip below the chart card, centred on the column', async ({ page }) => {
  await seedState(page, chartState('28d'));
  await open(page);

  const card = await box(page.locator('.score-chart'));
  for (const i of [10, 17]) {
    const hit = page.locator('.score-bar-col').nth(i).locator('.score-bar-hit');
    await hit.hover();
    const tip = await box(page.locator('.score-tooltip'));
    expect(tip.y).toBeGreaterThanOrEqual(card.y + card.height);
    const column = await box(hit);
    expect(Math.abs(tip.x + tip.width / 2 - (column.x + column.width / 2))).toBeLessThanOrEqual(EPSILON);
  }
});

test('on a narrow viewport an edge column\'s tooltip stays within the chart card', async ({ page }) => {
  const width = 375;
  await page.setViewportSize({ width, height: 700 });
  await seedState(page, chartState('28d'));
  await open(page);

  const card = await box(page.locator('.score-chart'));
  for (const i of [0, 27]) {
    await page.locator('.score-bar-col').nth(i).locator('.score-bar-hit').hover();
    const tip = await box(page.locator('.score-tooltip'));
    expect(tip.x).toBeGreaterThanOrEqual(card.x - EPSILON);
    expect(tip.x + tip.width).toBeLessThanOrEqual(card.x + card.width + EPSILON);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
