import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Pencil, Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetAllPaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
} from '@/hooks/use-payment-methods';
import { getErrorMessage } from '@/lib/errors';
import type { PaymentMethod } from '@/types/models';

interface PaymentMethodFormState {
  name: string;
  commissionPercentage: string;
  requiresTransferTime: boolean;
}

const DEFAULT_FORM: PaymentMethodFormState = {
  name: '',
  commissionPercentage: '0',
  requiresTransferTime: false,
};

export function PaymentMethodsCard() {
  const { data: methods = [], isLoading } = useGetAllPaymentMethods();
  const { mutate: createMethod, isPending: isCreating } = useCreatePaymentMethod();
  const { mutate: updateMethod, isPending: isUpdating } = useUpdatePaymentMethod();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PaymentMethodFormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PaymentMethodFormState>(DEFAULT_FORM);

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createMethod(
      {
        name: form.name.trim(),
        commissionPercentage: parseFloat(form.commissionPercentage) || 0,
        requiresTransferTime: form.requiresTransferTime,
      },
      {
        onSuccess: () => {
          toast.success('Metodo de pago creado');
          setForm(DEFAULT_FORM);
          setShowForm(false);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al crear el metodo de pago'));
        },
      },
    );
  };

  const handleStartEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setEditForm({
      name: method.name,
      commissionPercentage: String(method.commissionPercentage),
      requiresTransferTime: method.requiresTransferTime,
    });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateMethod(
      {
        id: editingId,
        payload: {
          name: editForm.name.trim(),
          commissionPercentage: parseFloat(editForm.commissionPercentage) || 0,
          requiresTransferTime: editForm.requiresTransferTime,
        },
      },
      {
        onSuccess: () => {
          toast.success('Metodo de pago actualizado');
          setEditingId(null);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al actualizar el metodo de pago'));
        },
      },
    );
  };

  const handleToggleActive = (method: PaymentMethod) => {
    updateMethod(
      { id: method.id, payload: { isActive: !method.isActive } },
      {
        onSuccess: () => {
          toast.success(method.isActive ? 'Metodo desactivado' : 'Metodo activado');
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al actualizar el metodo de pago'));
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Metodos de pago</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowForm(true);
              setForm(DEFAULT_FORM);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Agregar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-md p-3 space-y-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                placeholder="Efectivo, Yape, etc."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Comision (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.commissionPercentage}
                onChange={(e) => setForm((f) => ({ ...f, commissionPercentage: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="requires-transfer"
                checked={form.requiresTransferTime}
                onCheckedChange={(v) => setForm((f) => ({ ...f, requiresTransferTime: !!v }))}
              />
              <Label htmlFor="requires-transfer">Requiere hora de transferencia</Label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!form.name.trim() || isCreating}>
                {isCreating ? 'Creando...' : 'Crear'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : methods.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin metodos de pago</p>
        ) : (
          <ul className="space-y-2">
            {methods.map((method) => (
              <li key={method.id} className="border rounded-md p-3">
                {editingId === method.id ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Nombre</Label>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Comision (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={editForm.commissionPercentage}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            commissionPercentage: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-transfer-${method.id}`}
                        checked={editForm.requiresTransferTime}
                        onCheckedChange={(v) =>
                          setEditForm((f) => ({ ...f, requiresTransferTime: !!v }))
                        }
                      />
                      <Label htmlFor={`edit-transfer-${method.id}`}>
                        Requiere hora de transferencia
                      </Label>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating}>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{method.name}</span>
                        <Badge variant={method.isActive ? 'default' : 'secondary'}>
                          {method.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Comision: {method.commissionPercentage}%
                        {method.requiresTransferTime && ' · Requiere hora'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleStartEdit(method)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleToggleActive(method)}
                        disabled={isUpdating}
                      >
                        {method.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
