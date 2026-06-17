import { useMe } from '@/hooks/use-auth';
import { canAccessRoute } from '@/lib/permissions';
import { PaymentMethodsCard } from '@/components/dashboard/configuracion/payment-methods-card';
import { ResetFinancialCard } from '@/components/dashboard/configuracion/reset-financial-card';
import { CashReportCard } from '@/components/dashboard/caja/cash-report-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

export default function ConfiguracionPage() {
  const { data: user } = useMe();
  const hasAccess = canAccessRoute(user?.role, 'configuracion');

  if (!hasAccess) {
    return (
      <div className="p-4">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>No tienes permiso para acceder a esta seccion.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Configuracion</h1>

      <PaymentMethodsCard />

      <CashReportCard />

      <ResetFinancialCard />
    </div>
  );
}
