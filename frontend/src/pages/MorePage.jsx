import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/PageHeader';

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-neutral-400">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function SectionLabel({ children }) {
  return <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{children}</h2>;
}

function ActionRow({ to, icon, title, description }) {
  return (
    <Link to={to} className="flex min-h-11 items-center gap-3 px-4 py-3 active:bg-neutral-50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-neutral-900">{title}</span>
        {description && <span className="block text-xs text-neutral-500">{description}</span>}
      </span>
      <ChevronIcon />
    </Link>
  );
}

export function MorePage() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-6">
      <PageHeader title="Account" />

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-700">
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-neutral-900">{user?.name}</span>
          <span className="block truncate text-sm text-neutral-500">@{user?.username}</span>
        </span>
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {user?.role === 'owner' ? 'Owner' : 'Staff'}
        </span>
      </div>

      <div className="mt-6">
        <SectionLabel>Account</SectionLabel>
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          <ActionRow
            to="/ai-assistant"
            title="Clerk"
            description="Ask questions about your billing data"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
                <circle cx="12" cy="12" r="3.2" />
              </svg>
            }
          />
          <ActionRow
            to="/customers"
            title="Customers"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M9 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.7-5 6-5s6 2 6 5" />
                <path d="M15 7a2.5 2.5 0 1 1 0 5M17 20c0-2.2-1.2-4-3-4.7" />
              </svg>
            }
          />
          <ActionRow
            to="/more/drafts"
            title="Draft Bills"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                <path d="M14 3v4h4" />
                <path d="M9 13h6M9 17h4" />
              </svg>
            }
          />
          <ActionRow
            to="/more/monthly-sales"
            title="Monthly Sales"
            description="View your monthly sales history"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M5 21V10M12 21V6M19 21v-7" />
              </svg>
            }
          />
        </div>
      </div>

      <div className="mt-6">
        <SectionLabel>Session</SectionLabel>
        <div className="rounded-xl border border-neutral-200 bg-white">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-50 disabled:opacity-60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" />
                <path d="M10 17l5-5-5-5M14.5 12H3" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-red-700">{loggingOut ? 'Signing out…' : 'Sign out'}</span>
              <span className="block text-xs text-neutral-500">Sign out of this account</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
