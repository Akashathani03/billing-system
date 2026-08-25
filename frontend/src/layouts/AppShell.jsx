import { Outlet } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { FloatingCalculator } from '../components/FloatingCalculator';

export function AppShell() {
  return (
    <div className="min-h-svh bg-neutral-50 pb-20">
      <Outlet />
      <BottomNav />
      <FloatingCalculator />
    </div>
  );
}
