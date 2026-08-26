import { Outlet } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { FloatingCalculator } from '../components/FloatingCalculator';
import { UpdateBanner } from '../components/UpdateBanner';
import { usePwaUpdate } from '../hooks/usePwaUpdate';

export function AppShell() {
  const { needRefresh, applyUpdate } = usePwaUpdate();

  return (
    <div className="min-h-svh bg-neutral-50 pb-24">
      <UpdateBanner visible={needRefresh} onRefresh={applyUpdate} />
      <Outlet />
      <BottomNav />
      <FloatingCalculator />
    </div>
  );
}
