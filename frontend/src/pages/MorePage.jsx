import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
    <div className="px-4 pt-6">
      <h1 className="text-xl font-semibold text-neutral-900">More</h1>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-500">Logged in as</p>
        <p className="font-medium text-neutral-900">{user?.name}</p>
        <p className="text-sm text-neutral-500">{user?.username} · {user?.role}</p>
      </div>

      <div className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        <Link to="/customers" className="block px-4 py-3 text-neutral-900 active:bg-neutral-50">
          Customers
        </Link>
        <div className="px-4 py-3 text-neutral-400">Drafts — coming soon</div>
      </div>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="mt-6 w-full rounded-md border border-red-200 bg-red-50 py-3 text-base font-semibold text-red-700 disabled:opacity-60"
      >
        {loggingOut ? 'Logging out…' : 'Logout'}
      </button>
    </div>
  );
}
