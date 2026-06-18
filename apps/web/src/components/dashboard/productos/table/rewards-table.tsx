/**
 * RewardsTable — CRUD list of CarboPuntos rewards (admin, Productos page tab).
 */
import { useState } from 'react';
import { Gift, Pencil, PowerOff, Power, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { useUpdateReward } from '@/hooks/use-rewards';
import { getErrorMessage } from '@/lib/errors';
import type { Reward } from '@app/carbopuntos-contracts';

interface RewardsTableProps {
  rewards: Reward[];
  isLoading: boolean;
  onEdit: (reward: Reward) => void;
  canWrite: boolean;
}

export function RewardsTable({ rewards, isLoading, onEdit, canWrite }: RewardsTableProps) {
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);
  const { mutate: updateReward, isPending: isUpdating } = useUpdateReward();

  const rewardToToggle = rewards.find((r) => r.id === confirmToggleId);

  const handleToggle = () => {
    if (!rewardToToggle) return;
    updateReward(
      {
        id: rewardToToggle.id,
        payload: { isActive: !rewardToToggle.isActive },
      },
      {
        onSuccess: () => {
          toast.success(rewardToToggle.isActive ? 'Premio desactivado' : 'Premio reactivado');
          setConfirmToggleId(null);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al actualizar el premio'));
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Cargando premios...</span>
      </div>
    );
  }

  if (rewards.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>No hay premios configurados.</p>
      </div>
    );
  }

  return (
    <>
      <Card className="bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Premio</TableHead>
                <TableHead className="text-right">Costo (pts)</TableHead>
                <TableHead>Estado</TableHead>
                {canWrite && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Gift className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    {r.name}
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.costPoints}</TableCell>
                  <TableCell>
                    <Badge variant={r.isActive ? 'default' : 'secondary'}>
                      {r.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {r.isActive ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setConfirmToggleId(r.id)}
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-600"
                            onClick={() => setConfirmToggleId(r.id)}
                            disabled={isUpdating}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="border-t px-6 py-3">
          <p className="text-sm text-muted-foreground">
            {rewards.length} premio{rewards.length !== 1 ? 's' : ''} configurado
            {rewards.length !== 1 ? 's' : ''}
          </p>
        </CardFooter>
      </Card>

      <DeleteConfirmDialog
        open={!!confirmToggleId}
        onOpenChange={(v) => !v && setConfirmToggleId(null)}
        title={rewardToToggle?.isActive ? 'Desactivar premio' : 'Reactivar premio'}
        description={
          rewardToToggle?.isActive
            ? 'El premio no será visible en caja. Podés reactivarlo después.'
            : 'El premio volverá a ser visible en caja.'
        }
        confirmLabel={rewardToToggle?.isActive ? 'Desactivar' : 'Reactivar'}
        onConfirm={handleToggle}
        isLoading={isUpdating}
      />
    </>
  );
}
