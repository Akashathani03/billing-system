export function UpdateBanner({ visible, onRefresh }) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-neutral-900 px-4 py-3 text-sm text-white"
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
    >
      <span>New version available</span>
      <button
        onClick={onRefresh}
        className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900"
      >
        Refresh
      </button>
    </div>
  );
}
