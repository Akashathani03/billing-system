import { useEffect, useRef, useState } from 'react';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/**
 * Client-side type/size checks mirror the backend's — they're a fast UX
 * short-circuit, not the source of truth; the backend re-validates
 * everything regardless.
 */
export function AddBillPhotoForm({ onSave, saving, onCancel }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;

    setError('');

    if (!ALLOWED_TYPES.has(selected.type)) {
      setError('Please choose a JPEG, PNG, WEBP, or HEIC photo.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError('That photo is too large — please choose one under 10MB.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function handleSave() {
    setError('');
    try {
      await onSave(file);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {!previewUrl && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 py-10 text-neutral-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8"
          >
            <path d="M4 7h3l2-2h6l2 2h3v12H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="text-sm font-medium">Take photo or choose from device</span>
        </button>
      )}

      {previewUrl && (
        <>
          <img
            src={previewUrl}
            alt="Selected bill preview"
            className="max-h-80 w-full rounded-lg bg-neutral-100 object-contain"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 w-full rounded-md border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700"
          >
            Replace Photo
          </button>
        </>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!file || saving}
          className="rounded-md bg-blue-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
