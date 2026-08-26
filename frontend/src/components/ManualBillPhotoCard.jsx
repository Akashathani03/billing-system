import { manualBillPhotoImageUrl } from '../api/manualBillPhotos';

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ManualBillPhotoCard({ photo, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="block w-full overflow-hidden rounded-lg border-2 border-black bg-white text-left"
    >
      <img
        src={manualBillPhotoImageUrl(photo._id)}
        alt={`Manual bill photo from ${formatDate(photo.createdAt)}`}
        className="h-40 w-full object-cover"
      />
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900">{formatDate(photo.createdAt)}</p>
      </div>
    </button>
  );
}
