import ControlDiarioCarnesView from '@/components/dashboard/ControlDiarioCarnesView';

export const metadata = {
  title: 'Dashboard Control Diario - La Finca Choclos y Asados',
  description: 'Control diario de movimientos de carne a cocina vs ventas de platos y rentabilidad operativa',
};

export default function DashboardPage() {
  return (
    <div className="w-full max-w-7xl mx-auto py-2">
      <ControlDiarioCarnesView />
    </div>
  );
}
