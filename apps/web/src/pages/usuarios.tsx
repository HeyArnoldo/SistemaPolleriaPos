import { useMemo, useState } from 'react';
import { Search, PlusCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetUsers } from '@/hooks/use-users';
import { useMe } from '@/hooks/use-auth';
import { canAccessAction } from '@/lib/permissions';
import { UsuariosTable } from '@/components/dashboard/usuarios/usuarios-table';
import { UserFormDialog } from '@/components/dashboard/usuarios/dialog/user-form-dialog';
import type { User } from '@/types/models';

export default function UsuariosPage() {
  const { data: user } = useMe();
  const { data: users = [], isLoading, isError } = useGetUsers();
  const canWrite = canAccessAction(user?.role, 'users:write');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchValue, setSearchValue] = useState('');

  const handleEdit = (u: User) => {
    setEditingUser(u);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const filteredUsers = useMemo(() => {
    const search = searchValue.trim().toLowerCase();
    if (!search) return users;
    return users.filter((u) => {
      const username = u.username?.toLowerCase() ?? '';
      const fullName = `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.toLowerCase();
      const role = u.role?.toLowerCase?.() ?? '';
      return username.includes(search) || fullName.includes(search) || role.includes(search);
    });
  }, [users, searchValue]);

  return (
    <div className="p-6 space-y-6">
      {/* Header: search left, button right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar usuario..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full rounded-lg bg-white pl-9"
          />
        </div>
        {canWrite && (
          <Button onClick={handleNew} className="shrink-0">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo usuario
          </Button>
        )}
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error al cargar los usuarios. Intenta nuevamente.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <UsuariosTable
          users={filteredUsers}
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
