import { useNavigate } from 'react-router-dom';

export function PageHeader({ title }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(-1)}
        aria-label="Go back"
        className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-700 active:bg-neutral-100"
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
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
    </div>
  );
}
