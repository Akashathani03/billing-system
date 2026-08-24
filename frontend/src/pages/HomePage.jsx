import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../hooks/useAuth';

export function HomePage() {
  const { user } = useAuth();
  const [health, setHealth] = useState({ state: 'loading' });

  useEffect(() => {
    apiFetch('/health')
      .then((data) => setHealth({ state: 'ok', data }))
      .catch((err) => setHealth({ state: 'error', message: err.message }));
  }, []);

  return (
    <div className="px-4 pt-6 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">Mahaveer Billing</h1>
      <p className="mt-1 text-sm text-neutral-500">Welcome, {user?.name}</p>

      <div className="mt-6 w-full rounded-lg border border-neutral-200 bg-white p-4 text-left text-sm">
        {health.state === 'loading' && <p className="text-neutral-500">Checking backend…</p>}
        {health.state === 'ok' && (
          <>
            <p className="font-medium text-green-700">Backend: {health.data.status}</p>
            <p className="mt-1 text-neutral-500">db: {health.data.db}</p>
            <p className="mt-1 text-neutral-400">{health.data.time}</p>
          </>
        )}
        {health.state === 'error' && (
          <p className="font-medium text-red-700">Backend unreachable — {health.message}</p>
        )}
      </div>
    </div>
  );
}
