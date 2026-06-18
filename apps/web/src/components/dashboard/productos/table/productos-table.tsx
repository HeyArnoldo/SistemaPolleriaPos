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
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Pencil, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { useDeactivateProduct, useReactivateProduct } from '@/hooks/use-products';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { formatCurrency } from '@/lib/formatting';
import { getErrorMessage } from '@/lib/errors';
import type { Product, ProductCategory } from '@/types/models';

interface ProductosTableProps {
  products: Product[];
  categories: ProductCategory[];
  searchValue: string;
  onEdit: (product: Product) => void;
  canWrite: boolean;
  isLoading: boolean;
}

export function ProductosTable({
  products,
  categories,
  searchValue,
  onEdit,
  canWrite,
  isLoading,
}: ProductosTableProps) {
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<number | null>(null);
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
    const matchName = p.name.toLowerCase().includes(searchValue.toLowerCase());
    const matchCat = categoryFilter === 'all' || String(p.category?.id) === categoryFilter;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.isActive) ||
      (statusFilter === 'inactive' && !p.isActive);
    return matchName && matchCat && matchStatus;
  });

  return (
    <>
      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-44 bg-white text-sm">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorias</SelectItem>
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
          <SelectTrigger className="h-9 w-36 bg-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-white">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando productos...</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {products.length === 0
                ? 'No hay productos registrados'
                : 'No se encontraron productos con ese filtro'}
            </p>
          ) : (
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
          )}
        </CardContent>
        {!isLoading && filtered.length > 0 && (
          <CardFooter className="border-t px-6 py-3">
            <p className="text-sm text-muted-foreground">
              {filtered.length} producto{filtered.length !== 1 ? 's' : ''} encontrado
              {filtered.length !== 1 ? 's' : ''}
            </p>
          </CardFooter>
        )}
      </Card>

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
