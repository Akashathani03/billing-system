export function ComingSoonPage({ title }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-2 text-sm text-neutral-500">Coming soon — built in a later phase.</p>
    </div>
  );
}
