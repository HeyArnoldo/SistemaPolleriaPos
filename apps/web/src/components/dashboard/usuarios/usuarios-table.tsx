import { useState } from 'react';
import { UserRole } from '@app/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDeactivateUser } from '@/hooks/use-users';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { getErrorMessage } from '@/lib/errors';
import type { User } from '@/types/models';

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const RoleBadge = ({ role }: { role: User['role'] }) => {
  const isAdmin = role === UserRole.Admin;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        isAdmin ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
      }`}
    >
      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
      {isAdmin ? 'Admin' : 'Cajero'}
    </span>
  );
};

const ActiveBadge = ({ active }: { active: boolean }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
      active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
    }`}
  >
    <span className={`mr-1 h-2 w-2 rounded-full ${active ? 'bg-green-500' : 'bg-slate-400'}`} />
    {active ? 'Activo' : 'Inactivo'}
  </span>
);

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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Usuarios registrados</CardTitle>
            <p className="text-sm text-muted-foreground">{users.length} en total</p>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No hay usuarios registrados
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creado</TableHead>
                    {canWrite && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isCurrent = u.id === currentUserId;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium font-mono text-sm">
                          {u.username}
                          {isCurrent && (
                            <span className="ml-1 text-xs text-muted-foreground">(tu)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.profile
                            ? `${u.profile.firstName} ${u.profile.lastName}`
                            : 'Sin perfil'}
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={u.role} />
                        </TableCell>
                        <TableCell>
                          <ActiveBadge active={u.isActive} />
                        </TableCell>
                        <TableCell>{formatDate(u.createdAt)}</TableCell>
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
                                  <Trash2 className="h-3.5 w-3.5" />
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
          )}
        </CardContent>
      </Card>

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
