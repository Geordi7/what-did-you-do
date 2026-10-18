import { test, expect } from '@playwright/test';
import { importFile, open, seedState } from './harness';

test('oversized files are refused without invoking the reader', async ({ page }) => {
  await seedState(page, { version: 5, calendars: [] });
  await open(page);
  await page.evaluate(() => {
    const size = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')?.get;
    Object.defineProperty(File.prototype, 'size', { get() { return this.name === 'oversized.json' ? 51 * 1024 * 1024 : size?.call(this); } });
    const read = FileReader.prototype.readAsText;
    document.documentElement.dataset.readerCalls = '0';
    FileReader.prototype.readAsText = function(file, encoding) {
      document.documentElement.dataset.readerCalls = '1';
      read.call(this, file, encoding);
    };
  });
  await importFile(page, 'oversized.json', '{"version":5,"calendars":[]}');
  await expect(page.locator('.import-status')).toContainText('too large');
  await expect(page.locator('html')).toHaveAttribute('data-reader-calls', '0');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a slow older reader cannot replace the latest selection', async ({ page }) => {
  await seedState(page, { version: 5, calendars: [] });
  await open(page);
  await page.clock.install();
  await page.evaluate(() => {
    const Original = FileReader;
    window.FileReader = class extends Original {
      readAsText(file: File) {
        const cal = { id: file.name, name: file.name, color: '#40c463', days: {}, activityValue: 1, updatedAt: '2026-10-18T00:00:00.000Z' };
        setTimeout(() => {
          Object.defineProperty(this, 'result', { value: JSON.stringify({ version: 5, calendars: [cal] }) });
          this.dispatchEvent(new ProgressEvent('load'));
        }, file.name === 'old.json' ? 200 : 10);
      }
    };
  });
  await importFile(page, 'old.json', '{}');
  await importFile(page, 'new.json', '{}');
  await page.clock.runFor(250);
  await expect(page.locator('.import-modal-name')).toHaveText('new.json');
});
