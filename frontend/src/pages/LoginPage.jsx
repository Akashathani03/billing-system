import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-neutral-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-neutral-900">Mahaveer Electrical Shop</h1>
          <p className="mt-1 text-sm text-neutral-500">Billing System</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
        >
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="block text-sm font-medium text-neutral-700" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            className="mt-1 mb-4 w-full rounded-md border border-neutral-300 px-3 py-3 text-base focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label className="block text-sm font-medium text-neutral-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 mb-6 w-full rounded-md border border-neutral-300 px-3 py-3 text-base focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-700 py-3 text-base font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Logging in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
