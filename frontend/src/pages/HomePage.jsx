import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDashboardSummaryQuery } from '../hooks/useDashboard';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { BillListCard } from '../components/BillListCard';
import { SalesTrendChart } from '../components/SalesTrendChart';

const METHOD_LABELS = { cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit' };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useDashboardSummaryQuery();

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{greeting()} 👋</h1>
          <p className="mt-1 text-sm text-neutral-500">{user?.name}</p>
        </div>
        <Link
          to="/more"
          aria-label="Account"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 active:bg-neutral-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
          </svg>
        </Link>
      </div>

      {isLoading && <DashboardSkeleton />}

      {isError && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-center text-sm text-red-700">
          <p>Unable to load dashboard.</p>
          <button onClick={() => refetch()} className="mt-2 font-medium underline">
            Try Again
          </button>
        </div>
      )}

      {data && (
        <div className="mt-4 space-y-5">
          {data.today.bills === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
              <p className="font-medium text-neutral-700">No sales yet today.</p>
              <p className="mt-1 text-sm text-neutral-500">Create your first bill to see today's sales here.</p>
            </div>
          ) : (
            <>
              <section className="rounded-lg border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-500">Sales</p>
                <p className="text-3xl font-bold text-neutral-900">₹{data.today.sales.toFixed(2)}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {data.today.bills} bill{data.today.bills === 1 ? '' : 's'}
                </p>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                  <p className="text-sm text-neutral-500">Paid</p>
                  <p className="text-xl font-bold text-green-700">₹{data.today.paid.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                  <p className="text-sm text-neutral-500">Pending</p>
                  <p className="text-xl font-bold text-amber-700">₹{data.today.pending.toFixed(2)}</p>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-neutral-700">Payment Breakdown</h2>
                <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white px-4">
                  {Object.entries(data.paymentBreakdown).map(([method, total]) => (
                    <div key={method} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-neutral-600">{METHOD_LABELS[method]}</span>
                      <span className="font-semibold text-neutral-900">₹{total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <section>
            <h2 className="text-sm font-semibold text-neutral-700">Recent Bills</h2>
            <div className="mt-2 space-y-2">
              {data.recentBills.length === 0 && (
                <p className="py-4 text-center text-sm text-neutral-500">No bills yet.</p>
              )}
              {data.recentBills.map((invoice) => (
                <BillListCard key={invoice._id} invoice={invoice} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-neutral-700">Sales Trend — Last 7 Days</h2>
            <div className="mt-2">
              <SalesTrendChart data={data.salesTrend} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
