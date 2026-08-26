import { useState } from 'react';
import { manualBillPhotoImageUrl } from '../api/manualBillPhotos';

export function ImageViewer({ photo, onClose, onDelete, deleting }) {
  const [error, setError] = useState('');
  const [zoomed, setZoomed] = useState(false);

  if (!photo) return null;

  async function handleDelete() {
    if (!window.confirm('Delete this bill photo? This cannot be undone.')) return;
    setError('');
    try {
      await onDelete(photo._id);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black">
      <div className="flex items-center justify-between px-2 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
        <button
          onClick={onClose}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white active:bg-white/10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete photo"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white active:bg-white/10 disabled:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
          </svg>
        </button>
      </div>

      {error && <p className="mx-4 mb-2 rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>}

      <div
        className="flex-1 overflow-auto"
        onDoubleClick={() => setZoomed((z) => !z)}
      >
        <div className="flex min-h-full items-center justify-center px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <img
            src={manualBillPhotoImageUrl(photo._id)}
            alt="Manual bill"
            className={
              zoomed
                ? 'h-auto w-[200vw] max-w-none cursor-zoom-out'
                : 'max-h-full max-w-full cursor-zoom-in object-contain'
            }
          />
        </div>
      </div>

      <p className="pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-center text-xs text-white/50">
        Double-tap to {zoomed ? 'zoom out' : 'zoom in'}
      </p>
    </div>
  );
}
