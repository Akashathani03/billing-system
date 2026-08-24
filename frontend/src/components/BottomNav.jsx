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
  more: (
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} strokeLinecap="round" />
  ),
};

function NavIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      {icons[name]}
    </svg>
  );
}

const tabClass = ({ isActive }) =>
  `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium ${
    isActive ? 'text-blue-700' : 'text-neutral-500'
  }`;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <NavLink to="/" end className={tabClass}>
        <NavIcon name="home" />
        Home
      </NavLink>

      <NavLink to="/bills" className={tabClass}>
        <NavIcon name="bills" />
        Bills
      </NavLink>

      <NavLink
        to="/new-bill"
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-blue-700"
      >
        <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-700/30">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-7 w-7">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        New Bill
      </NavLink>

      <NavLink to="/products" className={tabClass}>
        <NavIcon name="products" />
        Products
      </NavLink>

      <NavLink to="/more" className={tabClass}>
        <NavIcon name="more" />
        More
      </NavLink>
    </nav>
  );
}
