import {
  getBusinessDayRangeUTC,
  getRecentBusinessDayRanges,
  formatBusinessDateKey,
  getRecentBusinessMonthRanges,
  formatBusinessMonthKey,
  getBusinessYearMonthRanges,
  getCurrentBusinessYear,
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

describe('formatBusinessMonthKey', () => {
  test('1ms before the IST month rollover is still the earlier month', () => {
    expect(formatBusinessMonthKey(new Date('2026-07-31T18:29:59.999Z'))).toBe('2026-07');
  });

  test('exactly at the IST month rollover is the next month', () => {
    expect(formatBusinessMonthKey(new Date('2026-07-31T18:30:00.000Z'))).toBe('2026-08');
  });
});

describe('getRecentBusinessMonthRanges', () => {
  test('returns consecutive, non-overlapping ranges ending with the current month, oldest first', () => {
    const ranges = getRecentBusinessMonthRanges(12, new Date('2026-08-24T10:00:00.000Z'));
    expect(ranges).toHaveLength(12);

    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i - 1].end.getTime()).toBe(ranges[i].start.getTime());
    }

    const lastMonth = ranges[ranges.length - 1];
    expect(lastMonth.start.toISOString()).toBe('2026-07-31T18:30:00.000Z');
    expect(lastMonth.end.toISOString()).toBe('2026-08-31T18:30:00.000Z');
  });

  test('correctly rolls over a year boundary', () => {
    const ranges = getRecentBusinessMonthRanges(3, new Date('2026-01-15T10:00:00.000Z'));
    const keys = ranges.map((r) => formatBusinessMonthKey(r.start));
    expect(keys).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('getBusinessYearMonthRanges', () => {
  test('returns exactly 12 consecutive months, January through December, for the given calendar year', () => {
    const ranges = getBusinessYearMonthRanges(2026);
    expect(ranges).toHaveLength(12);
    expect(ranges.map((r) => r.monthNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i - 1].end.getTime()).toBe(ranges[i].start.getTime());
    }

    expect(ranges[0].start.toISOString()).toBe('2025-12-31T18:30:00.000Z'); // Jan 1 2026 IST
    expect(ranges[11].end.toISOString()).toBe('2026-12-31T18:30:00.000Z'); // Jan 1 2027 IST
  });

  test('is independent of any reference date — always the fixed calendar year requested', () => {
    const ranges2025 = getBusinessYearMonthRanges(2025);
    expect(formatBusinessMonthKey(ranges2025[0].start)).toBe('2025-01');
    expect(formatBusinessMonthKey(ranges2025[11].start)).toBe('2025-12');
  });
});

describe('getCurrentBusinessYear', () => {
  test('matches the IST calendar year for a given UTC instant', () => {
    expect(getCurrentBusinessYear(new Date('2026-01-15T10:00:00.000Z'))).toBe(2026);
    // 1ms before IST New Year's rollover is still the previous year.
    expect(getCurrentBusinessYear(new Date('2025-12-31T18:29:59.999Z'))).toBe(2025);
    expect(getCurrentBusinessYear(new Date('2025-12-31T18:30:00.000Z'))).toBe(2026);
  });
});
