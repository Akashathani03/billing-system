import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function App() {
  const [health, setHealth] = useState({ state: 'loading' });

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setHealth({ state: 'ok', data }))
      .catch((err) => setHealth({ state: 'error', message: err.message }));
  }, []);

  return (
    <div className="min-h-svh bg-neutral-50 flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">Mahaveer Billing</h1>
      <p className="mt-1 text-sm text-neutral-500">Phase 0 baseline — no business features yet</p>

      <div className="mt-6 w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-4 text-left text-sm">
        {health.state === 'loading' && (
          <p className="text-neutral-500">Checking backend…</p>
        )}
        {health.state === 'ok' && (
          <>
            <p className="font-medium text-green-700">Backend: {health.data.status}</p>
            <p className="mt-1 text-neutral-500">db: {health.data.db}</p>
            <p className="mt-1 text-neutral-400">{health.data.time}</p>
          </>
        )}
        {health.state === 'error' && (
          <p className="font-medium text-red-700">
            Backend unreachable — {health.message}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
