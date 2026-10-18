import { expect, it } from 'vitest';
import { STORAGE_KEY, THEME_KEY, EXPORT_KEY, BACKUP_KEY, MAX_IMPORT_BYTES } from './persistence-contract';

it('keeps persisted names and the byte cap compatible', () => {
  expect([STORAGE_KEY, THEME_KEY, EXPORT_KEY, BACKUP_KEY, MAX_IMPORT_BYTES]).toEqual([
    'achievement-calendars', 'achievement-calendars-theme', 'achievement-calendars-last-export', 'achievement-calendars-backup', 50 * 1024 * 1024,
  ]);
});
