import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveGlobalOfflinePin, hasOfflinePin, clearOfflinePin } from '@/lib/offline-pin';

export function OfflinePinCard() {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [pinExists, setPinExists] = useState(false);

  useEffect(() => {
    void hasOfflinePin().then(setPinExists);
  }, []);

  function validatePin(): string | null {
    if (!/^\d+$/.test(pin)) return 'El PIN solo puede contener dígitos.';
    if (pin.length < 4 || pin.length > 6) return 'El PIN debe tener entre 4 y 6 dígitos.';
    if (pin !== confirmPin) return 'Los PINs no coinciden.';
    return null;
  }

  async function handleSave() {
    const error = validatePin();
    if (error) {
      toast.error(error);
      return;
    }
    setIsSaving(true);
    try {
      await saveGlobalOfflinePin(pin);
      toast.success('PIN sin conexión configurado');
      setPinExists(true);
      setPin('');
      setConfirmPin('');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClear() {
    setIsClearing(true);
    try {
      await clearOfflinePin();
      toast.success('PIN sin conexión eliminado');
      setPinExists(false);
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <Card className="border-slate-200/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <WifiOff className="h-4 w-4 text-amber-500" />
          Acceso sin conexión (PIN)
        </CardTitle>
        <p className="text-sm text-slate-500">
          Configura un PIN de 4 dígitos para que el cajero pueda vender sin internet. Entra con rol
          de cajero.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {pinExists && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs font-medium text-amber-700">PIN sin conexión configurado</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="offline-pin" className="text-sm font-medium text-slate-700">
              PIN
            </Label>
            <Input
              id="offline-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="4-6 dígitos"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="border-slate-300 bg-white focus-visible:ring-slate-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offline-pin-confirm" className="text-sm font-medium text-slate-700">
              Confirmar PIN
            </Label>
            <Input
              id="offline-pin-confirm"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Repetir PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="border-slate-300 bg-white focus-visible:ring-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || pin.length < 4}
            className="bg-slate-900 text-white hover:bg-slate-700"
          >
            {isSaving ? 'Guardando...' : pinExists ? 'Actualizar PIN' : 'Guardar PIN'}
          </Button>
          {pinExists && (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={isClearing}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {isClearing ? 'Quitando...' : 'Quitar PIN'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
