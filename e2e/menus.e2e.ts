/**
 * The header menu and calendar menu triggers, per `specs/04-design.md` "Layout" and "Controls"
 * and the menu rules of `specs/06-accessibility.md` "Menus": the header holds one ☰ button whose
 * menu carries New calendar, Import, Export all and the three themes, with the same keyboard
 * behaviour as the calendar menu; each calendar's menu opens from a ⋮ trigger.
 */
import { expect, test, type Page } from '@playwright/test';
import { open, seedState } from './harness';

const calendar = { id: 'a', name: 'Walk', color: '#40c463', activityValue: 1, updatedAt: '2026-10-18T00:00:00.000Z', days: {} };

const menuButton = (page: Page) => page.locator('header').getByRole('button', { name: 'Menu' });

test('the header holds one menu button, whose menu carries every header action', async ({ page }) => {
  await seedState(page, { version: 5, theme: 'light', calendars: [calendar] });
  await open(page);

  await expect(page.locator('header button')).toHaveCount(1);
  const trigger = menuButton(page);
  await expect(trigger).toHaveText('☰');
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('menu');
  const items = menu.locator('[role="menuitem"], [role="menuitemradio"]');
  const names = ['New calendar', 'Import calendars', 'Export all calendars', 'Light', 'Dark', 'System'];
  await expect(items).toHaveCount(names.length);
  for (const [i, name] of names.entries()) await expect(items.nth(i)).toHaveAccessibleName(name);
  for (const name of ['Light', 'Dark', 'System']) {
    await expect(menu.getByRole('menuitemradio', { name, exact: true })).toHaveAttribute('aria-checked', String(name === 'Light'));
  }
});

test('the header menu follows the menu keyboard rules', async ({ page }) => {
  await seedState(page, { version: 5, calendars: [calendar] });
  await open(page);

  const trigger = menuButton(page);
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'New calendar' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Import calendars' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitemradio', { name: 'System' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'New calendar' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('menuitemradio', { name: 'System' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menu.getByRole('menuitem', { name: 'New calendar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(menu).toBeVisible();
  await page.locator('.score-chart-title').click();
  await expect(menu).toHaveCount(0);
});

test('New calendar opens the create bar and a theme item applies its theme', async ({ page }) => {
  await seedState(page, { version: 5, theme: 'light', calendars: [calendar] });
  await open(page);

  await menuButton(page).click();
  await page.getByRole('menuitem', { name: 'New calendar' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('.new-cal-bar input')).toBeFocused();

  await menuButton(page).click();
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await menuButton(page).click();
  await expect(page.getByRole('menuitemradio', { name: 'Dark', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('a calendar menu opens from a kebab trigger', async ({ page }) => {
  await seedState(page, { version: 5, calendars: [calendar] });
  await open(page);

  await expect(page.getByRole('button', { name: 'Calendar actions' })).toHaveText('⋮');
});
