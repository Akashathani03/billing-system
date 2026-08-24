import { Outlet } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';

export function AppShell() {
  return (
    <div className="min-h-svh bg-neutral-50 pb-20">
      <Outlet />
      <BottomNav />
    </div>
  );
}
