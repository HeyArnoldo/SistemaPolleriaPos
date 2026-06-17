import { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { verifyOfflinePin } from '@/lib/offline-pin';
import type { StoredOfflineSession } from '@/lib/db';
import { cn } from '@/lib/utils';

interface OfflinePinScreenProps {
  session: StoredOfflineSession;
  onSuccess: (session: StoredOfflineSession) => void;
}

export function OfflinePinScreen({ session, onSuccess }: OfflinePinScreenProps) {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  async function handleSubmit(currentPin: string) {
    if (currentPin.length < 4) return;
    setIsVerifying(true);
    try {
      const ok = await verifyOfflinePin(currentPin, session.pinHash);
      if (ok) {
        onSuccess(session);
      } else {
        setShakeKey((k) => k + 1);
        setPin('');
        toast.error('PIN incorrecto');
      }
    } finally {
      setIsVerifying(false);
    }
  }

  function handleDigit(digit: string) {
    if (isVerifying) return;
    const next = pin + digit;
    if (next.length > 6) return;
    setPin(next);
    if (next.length === 6) {
      handleSubmit(next);
    }
  }

  function handleBackspace() {
    if (isVerifying) return;
    setPin((p) => p.slice(0, -1));
  }

  function handleConfirm() {
    if (pin.length >= 4) handleSubmit(pin);
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 bg-background">
      <div className="flex flex-col items-center gap-2">
        <WifiOff className="h-8 w-8 text-amber-500" />
        <h1 className="text-xl font-semibold">Modo sin conexión</h1>
        <p className="text-sm text-muted-foreground">Hola, {session.displayName}</p>
      </div>

      <div key={shakeKey} className={cn('flex gap-3', shakeKey > 0 && 'animate-shake')}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-3 w-3 rounded-full border-2',
              i < pin.length ? 'bg-foreground border-foreground' : 'border-muted-foreground',
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {keys.map((k) => (
          <Button
            key={k}
            variant="outline"
            size="lg"
            className="h-14 text-lg font-medium"
            onClick={() => handleDigit(k)}
            disabled={isVerifying}
          >
            {k}
          </Button>
        ))}
        <Button
          variant="outline"
          size="lg"
          className="h-14 text-lg"
          onClick={handleBackspace}
          disabled={isVerifying}
        >
          ⌫
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 text-lg font-medium"
          onClick={() => handleDigit('0')}
          disabled={isVerifying}
        >
          0
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 text-lg"
          onClick={handleConfirm}
          disabled={isVerifying || pin.length < 4}
        >
          {isVerifying ? '...' : '✓'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Sin conexión — las ventas se guardarán localmente
      </p>
    </div>
  );
}
