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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, PowerOff, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useDeactivateProduct, useReactivateProduct } from '@/hooks/use-products';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { formatCurrency } from '@/lib/formatting';
import { getErrorMessage } from '@/lib/errors';
import type { Product, ProductCategory } from '@/types/models';

interface ProductosTableProps {
  products: Product[];
  categories: ProductCategory[];
  onEdit: (product: Product) => void;
  canWrite: boolean;
}

export function ProductosTable({ products, categories, onEdit, canWrite }: ProductosTableProps) {
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateProduct();
  const { mutate: reactivate, isPending: isReactivating } = useReactivateProduct();

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

  const filtered = products.filter((p) => {
    const matchName = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || String(p.category?.id) === categoryFilter;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.isActive) ||
      (statusFilter === 'inactive' && !p.isActive);
    return matchName && matchCat && matchStatus;
  });

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-48 text-sm"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="h-8 w-32 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">
          {products.length === 0
            ? 'No hay productos registrados'
            : 'No se encontraron productos con ese filtro'}
        </p>
      ) : (
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
              {filtered.map((product) => (
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
                        {!product.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-600"
                            onClick={() =>
                              reactivate(product.id, {
                                onSuccess: () => toast.success('Producto reactivado'),
                                onError: (err) =>
                                  toast.error(getErrorMessage(err, 'Error al reactivar')),
                              })
                            }
                            disabled={isReactivating}
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
        </div>
      )}

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
