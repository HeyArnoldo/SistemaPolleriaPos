import { useState } from 'react';
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
import { Pencil, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { useDeactivateProduct } from '@/hooks/use-products';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { formatCurrency } from '@/lib/formatting';
import { getErrorMessage } from '@/lib/errors';
import type { Product } from '@/types/models';

interface ProductosTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  canWrite: boolean;
}

export function ProductosTable({ products, onEdit, canWrite }: ProductosTableProps) {
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<number | null>(null);
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateProduct();

  const handleDeactivate = () => {
    if (!confirmDeactivateId) return;
    deactivate(confirmDeactivateId, {
      onSuccess: () => {
        toast.success('Producto desactivado');
        setConfirmDeactivateId(null);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Error al desactivar el producto'));
      },
    });
  };

  if (products.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">No hay productos registrados</p>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Estado</TableHead>
              {canWrite && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {product.category?.name ?? '-'}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                <TableCell>
                  <Badge variant={product.isActive ? 'default' : 'secondary'}>
                    {product.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                {canWrite && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(product)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {product.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeactivateId(product.id)}
                        >
                          <PowerOff className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DeleteConfirmDialog
        open={!!confirmDeactivateId}
        onOpenChange={(v) => !v && setConfirmDeactivateId(null)}
        title="Desactivar producto"
        description="El producto sera desactivado y no aparecera en el punto de venta. Podras reactivarlo mas tarde."
        confirmLabel="Desactivar"
        onConfirm={handleDeactivate}
        isLoading={isDeactivating}
      />
    </>
  );
}
