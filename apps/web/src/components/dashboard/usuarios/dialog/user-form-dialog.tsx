import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { UserRole } from '@app/contracts';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useCreateUser, useUpdateUser } from '@/hooks/use-users';
import { getErrorMessage } from '@/lib/errors';
import type { User } from '@/types/models';

interface UserFormValues {
  username: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEdit = !!user;
  const { mutate: createUser, isPending: isCreating } = useCreateUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>();

  const role = watch('role');

  useEffect(() => {
    if (open) {
      if (user) {
        reset({
          username: user.username,
          password: '',
          role: user.role,
          firstName: user.profile?.firstName ?? '',
          lastName: user.profile?.lastName ?? '',
        });
      } else {
        reset({
          username: '',
          password: '',
          role: UserRole.Cashier,
          firstName: '',
          lastName: '',
        });
      }
    }
  }, [open, user, reset]);

  const onSubmit = (values: UserFormValues) => {
    if (isEdit && user) {
      updateUser(
        {
          id: user.id,
          payload: {
            username: values.username.trim(),
            role: values.role,
            ...(values.password ? { password: values.password } : {}),
            profile: {
              firstName: values.firstName.trim(),
              lastName: values.lastName.trim(),
            },
          },
        },
        {
          onSuccess: () => {
            toast.success('Usuario actualizado');
            onOpenChange(false);
          },
          onError: (err) => {
            toast.error(getErrorMessage(err, 'Error al actualizar el usuario'));
          },
        },
      );
    } else {
      createUser(
        {
          username: values.username.trim(),
          password: values.password,
          role: values.role,
          profile: {
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
          },
        },
        {
          onSuccess: () => {
            toast.success('Usuario creado');
            onOpenChange(false);
          },
          onError: (err) => {
            toast.error(getErrorMessage(err, 'Error al crear el usuario'));
          },
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                {...register('firstName', { required: 'Requerido' })}
                placeholder="Juan"
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                {...register('lastName', { required: 'Requerido' })}
                placeholder="Perez"
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              {...register('username', { required: 'El usuario es requerido' })}
              placeholder="jperez"
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">
              Contrasena{' '}
              {isEdit && (
                <span className="text-muted-foreground">(dejar en blanco para mantener)</span>
              )}
            </Label>
            <Input
              id="password"
              type="password"
              {...register('password', {
                ...(!isEdit ? { required: 'La contrasena es requerida' } : {}),
              })}
              placeholder={isEdit ? '••••••••' : 'Contrasena'}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Rol</Label>
            <Select
              value={role}
              onValueChange={(v) => setValue('role', v as UserRole, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.Admin}>Administrador</SelectItem>
                <SelectItem value={UserRole.Cashier}>Cajero</SelectItem>
              </SelectContent>
            </Select>
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
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
