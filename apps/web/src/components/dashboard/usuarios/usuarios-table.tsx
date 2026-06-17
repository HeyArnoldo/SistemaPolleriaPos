import { useState } from 'react';
import { UserRole } from '@app/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useDeactivateUser } from '@/hooks/use-users';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { getErrorMessage } from '@/lib/errors';
import type { User } from '@/types/models';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Admin]: 'Administrador',
  [UserRole.Cashier]: 'Cajero',
};

interface UsuariosTableProps {
  users: User[];
  currentUserId?: number;
  onEdit: (user: User) => void;
  canWrite: boolean;
}

export function UsuariosTable({ users, currentUserId, onEdit, canWrite }: UsuariosTableProps) {
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<number | null>(null);
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateUser();

  const handleDeactivate = () => {
    if (!confirmDeactivateId) return;
    deactivate(confirmDeactivateId, {
      onSuccess: () => {
        toast.success('Usuario desactivado');
        setConfirmDeactivateId(null);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Error al desactivar el usuario'));
      },
    });
  };

  if (users.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">No hay usuarios registrados</p>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              {canWrite && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isCurrent = u.id === currentUserId;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.profile ? `${u.profile.firstName} ${u.profile.lastName}` : u.username}
                    {isCurrent && <span className="ml-1 text-xs text-muted-foreground">(tu)</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {u.username}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === UserRole.Admin ? 'default' : 'secondary'}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'default' : 'outline'}>
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit(u)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {u.isActive && !isCurrent && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDeactivateId(u.id)}
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DeleteConfirmDialog
        open={!!confirmDeactivateId}
        onOpenChange={(v) => !v && setConfirmDeactivateId(null)}
        title="Desactivar usuario"
        description="El usuario sera desactivado y no podra iniciar sesion. Podras reactivarlo mas tarde."
        confirmLabel="Desactivar"
        onConfirm={handleDeactivate}
        isLoading={isDeactivating}
      />
    </>
  );
}
