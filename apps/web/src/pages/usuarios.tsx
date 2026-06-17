import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import { useGetUsers } from '@/hooks/use-users';
import { useMe } from '@/hooks/use-auth';
import { canAccessAction } from '@/lib/permissions';
import { UsuariosTable } from '@/components/dashboard/usuarios/usuarios-table';
import { UserFormDialog } from '@/components/dashboard/usuarios/dialog/user-form-dialog';
import type { User } from '@/types/models';

export default function UsuariosPage() {
  const { data: user } = useMe();
  const { data: users = [], isLoading } = useGetUsers();
  const canWrite = canAccessAction(user?.role, 'users:write');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleEdit = (u: User) => {
    setEditingUser(u);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        {canWrite && (
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo usuario
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <UsuariosTable
          users={users}
          currentUserId={user?.id}
          onEdit={handleEdit}
          canWrite={canWrite}
        />
      )}

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditingUser(null);
        }}
        user={editingUser}
      />
    </div>
  );
}
