function formatWeekday(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  // Local Date constructor (not ISO-string parsing) so the weekday is
  // correct regardless of the browser's timezone offset relative to UTC.
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { weekday: 'short' });
}

export function SalesTrendChart({ data }) {
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-1.5">
      {data.map((day) => {
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
            <span className="relative font-medium text-neutral-700">{formatWeekday(day.date)}</span>
            <span className="relative font-semibold text-neutral-900">₹{day.total.toFixed(0)}</span>
          </div>
        );
      })}
    </div>
  );
}
