function Block({ className }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-200 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="mt-4 space-y-4" aria-label="Loading today's sales…">
      <Block className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Block className="h-20" />
        <Block className="h-20" />
      </div>
      <Block className="h-32 w-full" />
      <Block className="h-40 w-full" />
    </div>
  );
}
