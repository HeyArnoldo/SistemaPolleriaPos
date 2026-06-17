import { Smartphone } from 'lucide-react';

interface OfflineBannerProps {
  isOnline: boolean;
}

export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  if (isOnline) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3 text-amber-900">
        <Smartphone className="mt-0.5 h-5 w-5 text-amber-600" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            Modo sin conexion. Las ventas se guardaran localmente.
          </p>
          <p className="text-xs text-amber-800">
            Se sincronizaran automaticamente al reconectarse.
          </p>
        </div>
      </div>
    </div>
  );
}
