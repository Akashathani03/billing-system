const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekdayName(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  // Local Date constructor (not ISO-string parsing) so the weekday is
  // correct regardless of the browser's timezone offset relative to UTC.
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { weekday: 'long' });
}

/**
 * The backend returns a rolling 7-day window in chronological order (e.g.
 * Wed..Tue), which is correct data but not the display order wanted here.
 * Any 7 consecutive calendar days contain each weekday exactly once, so
 * this is a pure re-sort into a fixed Monday-Sunday order — no day is
 * dropped, duplicated, or recalculated, just displayed in a different order.
 */
function sortMondayToSunday(data) {
  return [...data].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(getWeekdayName(a.date)) - WEEKDAY_ORDER.indexOf(getWeekdayName(b.date)),
  );
}

export function SalesTrendChart({ data }) {
  const orderedData = sortMondayToSunday(data);
  const max = Math.max(...orderedData.map((d) => d.total), 1);

  return (
    <div className="space-y-1.5">
      {orderedData.map((day) => {
        const widthPct = (day.total / max) * 100;
        return (
          <div
            key={day.date}
            className="relative flex items-center justify-between overflow-hidden rounded-md bg-neutral-100 px-3 py-2 text-sm"
          >
            <div
              className="absolute inset-y-0 left-0 bg-blue-100"
              style={{ width: `${widthPct}%` }}
              aria-hidden="true"
            />
            <span className="relative font-medium text-neutral-700">{getWeekdayName(day.date)}</span>
            <span className="relative font-semibold text-neutral-900">₹{day.total.toFixed(0)}</span>
          </div>
        );
      })}
    </div>
  );
}
