import { NavLink } from 'react-router-dom';

const icons = {
  home: (
    <path d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  ),
  bills: (
    <path d="M7 3h10a1 1 0 0 1 1 1v16l-2.5-1.5L13 20l-2.5-1.5L8 20l-2.5-1.5L3 20V6a1 1 0 0 1 1-1h3zM8 8h8M8 12h8M8 16h5" />
  ),
  products: (
    <path d="M21 8 12 3 3 8m18 0-9 5m9-5v9l-9 5m0-9L3 8m9 5v9M3 8v9l9 5" />
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
    </>
  ),
};

// The active state is shown two ways at once (a filled background behind
// the icon, plus the color/weight change) rather than color alone, so it
// still reads correctly for anyone who can't distinguish the color shift.
function NavIcon({ name, active }) {
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        active ? 'bg-blue-100' : ''
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-5 w-5 ${active ? 'text-blue-700' : 'text-neutral-500'}`}
      >
        {icons[name]}
      </svg>
    </span>
  );
}

function NavTab({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
    >
      {({ isActive }) => (
        <>
          <NavIcon name={icon} active={isActive} />
          <span className={`text-[11px] leading-tight ${isActive ? 'font-semibold text-blue-700' : 'font-medium text-neutral-500'}`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed left-1/2 z-20 flex h-16 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-stretch rounded-full border border-neutral-200 bg-white shadow-lg shadow-neutral-900/10"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <NavTab to="/" end label="Home" icon="home" />
      <NavTab to="/bills" label="Bills" icon="bills" />

      <NavLink
        to="/new-bill"
        aria-label="New Bill"
        className="relative flex flex-1 flex-col items-center justify-end pb-2 text-[11px] font-semibold text-blue-700"
      >
        <span className="absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-700/30 ring-[3px] ring-neutral-50">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="h-6 w-6"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span>New Bill</span>
      </NavLink>

      <NavTab to="/products" label="Products" icon="products" />
      <NavTab to="/more" label="Account" icon="account" />
    </nav>
  );
}
