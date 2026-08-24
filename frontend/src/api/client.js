export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  return data;
}

/** Like apiFetch, but for binary (e.g. PDF) responses — resolves to a Blob. */
export async function apiFetchBlob(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  return res.blob();
}
