import {
  getBusinessDayRangeUTC,
  getRecentBusinessDayRanges,
  formatBusinessDateKey,
} from '../utils/businessDate.js';

describe('getBusinessDayRangeUTC (Asia/Kolkata, UTC+5:30)', () => {
  test('a reference time mid-afternoon IST resolves to that IST calendar day', () => {
    // 2026-08-24T10:00:00Z = 2026-08-24T15:30 IST — same IST day.
    const { start, end } = getBusinessDayRangeUTC(new Date('2026-08-24T10:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-08-23T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-08-24T18:30:00.000Z');
  });

  test('N/O: 1ms before the IST midnight rollover is still the earlier day', () => {
    const { start, end } = getBusinessDayRangeUTC(new Date('2026-08-24T18:29:59.999Z'));
    expect(start.toISOString()).toBe('2026-08-23T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-08-24T18:30:00.000Z');
  });

  test('N/O: exactly at the IST midnight rollover is the next day', () => {
    const { start, end } = getBusinessDayRangeUTC(new Date('2026-08-24T18:30:00.000Z'));
    expect(start.toISOString()).toBe('2026-08-24T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-08-25T18:30:00.000Z');
  });

  test('the range is exactly 24 hours', () => {
    const { start, end } = getBusinessDayRangeUTC(new Date());
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe('getRecentBusinessDayRanges', () => {
  test('returns 7 consecutive, non-overlapping ranges ending with today, oldest first', () => {
    const ranges = getRecentBusinessDayRanges(7, new Date('2026-08-24T10:00:00.000Z'));
    expect(ranges).toHaveLength(7);

    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i - 1].end.getTime()).toBe(ranges[i].start.getTime());
    }

    const today = getBusinessDayRangeUTC(new Date('2026-08-24T10:00:00.000Z'));
    expect(ranges[ranges.length - 1].start.getTime()).toBe(today.start.getTime());
    expect(ranges[ranges.length - 1].end.getTime()).toBe(today.end.getTime());
  });
});

describe('formatBusinessDateKey', () => {
  test('matches the IST calendar date for a given UTC instant', () => {
    expect(formatBusinessDateKey(new Date('2026-08-24T18:29:59.999Z'))).toBe('2026-08-24');
    expect(formatBusinessDateKey(new Date('2026-08-24T18:30:00.000Z'))).toBe('2026-08-25');
  });
});
