import { useState } from 'react';
import { toast } from 'sonner';
import { saveOfflinePin } from '@/lib/offline-pin';
import type { User } from '@/types/models';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SetPinDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: User;
}

export function SetPinDialog({ open, onOpenChange, user }: SetPinDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function handleClose() {
    setPin('');
    setConfirmPin('');
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error('El PIN debe tener entre 4 y 6 dígitos numéricos');
      return;
    }
    if (pin !== confirmPin) {
      toast.error('Los PINs no coinciden');
      return;
    }
    setIsSaving(true);
    try {
      await saveOfflinePin(
        { id: user.id, role: user.role, username: user.username, profile: user.profile },
        pin,
      );
      toast.success('PIN configurado correctamente');
      handleClose();
    } catch {
      toast.error('Error al guardar el PIN');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar PIN sin conexión</DialogTitle>
          <DialogDescription>
            Este PIN te permitirá registrar ventas y egresos cuando no haya internet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">PIN (4-6 dígitos)</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pin">Confirmar PIN</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || pin.length < 4}>
              {isSaving ? 'Guardando...' : 'Guardar PIN'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
