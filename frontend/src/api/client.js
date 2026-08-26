export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const CONNECTIVITY_ERROR_MESSAGE = 'Unable to connect. Please check your internet connection and try again.';

/**
 * navigator.onLine only reflects whether the device THINKS it has a network
 * interface up — it says nothing about whether our backend is actually
 * reachable (DNS failure, server down, timeout, offline, etc. all surface
 * the same way: fetch() itself rejects rather than resolving with a
 * response). That rejection is caught here and turned into one consistent,
 * user-facing message — every caller's catch block already only shows
 * success after an awaited promise resolves, so a thrown error here can
 * never be mistaken for a successful mutation.
 */
async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error(CONNECTIVITY_ERROR_MESSAGE);
  }
}

export async function apiFetch(path, options = {}) {
  // FormData bodies (file uploads) must NOT get a manual Content-Type — the
  // browser needs to set its own multipart boundary.
  const isFormData = options.body instanceof FormData;

  const res = await safeFetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: isFormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
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
  const res = await safeFetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  return res.blob();
}
