/**
 * Groups invoices into "Today" / "Yesterday" / calendar-date buckets using
 * the browser's LOCAL timezone — unlike the backend's date-range filtering
 * (which is deliberately UTC-anchored for query correctness), a shop
 * owner's "Today" should match their own clock, not UTC.
 */
export function groupByDate(invoices, dateField = 'finalizedAt') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = [];
  const groupsByLabel = new Map();

  invoices.forEach((invoice) => {
    const day = new Date(invoice[dateField]);
    day.setHours(0, 0, 0, 0);

    let label;
    if (day.getTime() === today.getTime()) {
      label = 'Today';
    } else if (day.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    let group = groupsByLabel.get(label);
    if (!group) {
      group = { label, invoices: [] };
      groupsByLabel.set(label, group);
      groups.push(group);
    }
    group.invoices.push(invoice);
  });

  return groups;
}
