/**
 * RewardFormDialog — create or edit a CarboPuntos reward catalog entry.
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useCreateReward, useUpdateReward } from '@/hooks/use-rewards';
import { getErrorMessage } from '@/lib/errors';
import type { Reward } from '@app/carbopuntos-contracts';

interface RewardFormValues {
  name: string;
  costPoints: string;
  isActive: boolean;
}

interface RewardFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward?: Reward | null;
}

export function RewardFormDialog({ open, onOpenChange, reward }: RewardFormDialogProps) {
  const isEdit = !!reward;
  const { mutate: createReward, isPending: isCreating } = useCreateReward();
  const { mutate: updateReward, isPending: isUpdating } = useUpdateReward();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RewardFormValues>();

  useEffect(() => {
    if (open) {
      if (reward) {
        reset({
          name: reward.name,
          costPoints: String(reward.costPoints),
          isActive: reward.isActive,
        });
      } else {
        reset({ name: '', costPoints: '', isActive: true });
      }
    }
  }, [open, reward, reset]);

  const onSubmit = (values: RewardFormValues) => {
    const payload = {
      name: values.name.trim(),
      costPoints: parseInt(values.costPoints, 10),
      isActive: values.isActive,
    };

    if (isEdit && reward) {
      updateReward(
        { id: reward.id, payload },
        {
          onSuccess: () => {
            toast.success('Premio actualizado');
            onOpenChange(false);
          },
          onError: (err) => {
            toast.error(getErrorMessage(err, 'Error al actualizar el premio'));
          },
        },
      );
    } else {
      createReward(payload, {
        onSuccess: () => {
          toast.success('Premio creado');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al crear el premio'));
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar premio' : 'Nuevo premio'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="reward-name">Nombre</Label>
            <Input
              id="reward-name"
              {...register('name', { required: 'El nombre es requerido' })}
              placeholder="Gaseosa 1 LT"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="reward-cost">Costo en puntos</Label>
            <Input
              id="reward-cost"
              type="number"
              min="1"
              step="1"
              {...register('costPoints', {
                required: 'El costo en puntos es requerido',
                min: { value: 1, message: 'Debe ser al menos 1 punto' },
              })}
              placeholder="100"
            />
            {errors.costPoints && (
              <p className="text-xs text-destructive">{errors.costPoints.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="reward-active"
              type="checkbox"
              {...register('isActive')}
              className="accent-emerald-600 w-4 h-4"
            />
            <Label htmlFor="reward-active" className="font-normal cursor-pointer">
              Premio activo (visible en caja)
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear premio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
