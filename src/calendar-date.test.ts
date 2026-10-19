import { expect, it } from 'vitest';
import { parseCurrentCalendar } from './schemas';

for (const day of ['2000-02-29', '2024-02-29', '2028-02-29', '2400-02-29']) {
  it(`accepts real leap day ${day} and negative fractional weights`, () => {
    const calendar = { kind: 'scoring', id: 'leap', name: 'Leap', color: '#40c463', days: { [day]: 2 }, activityValue: -0.5, updatedAt: '2026-10-18T00:00:00.000Z' };
    expect(parseCurrentCalendar(calendar)).toEqual(calendar);
  });
}
