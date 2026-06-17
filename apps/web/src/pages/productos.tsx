import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FolderOpen } from 'lucide-react';
import { useGetProducts } from '@/hooks/use-products';
import { useMe } from '@/hooks/use-auth';
import { canAccessAction } from '@/lib/permissions';
import { ProductosTable } from '@/components/dashboard/productos/table/productos-table';
import { ProductFormDialog } from '@/components/dashboard/productos/dialog/product-form-dialog';
import { CategoriasDialog } from '@/components/dashboard/productos/dialog/categorias-dialog';
import type { Product } from '@/types/models';

export default function ProductosPage() {
  const { data: user } = useMe();
  const { data: products = [], isLoading } = useGetProducts();
  const canWrite = canAccessAction(user?.role, 'products:write');

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoriasOpen, setCategoriasOpen] = useState(false);

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Productos</h1>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCategoriasOpen(true)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Categorias
            </Button>
            <Button onClick={handleNewProduct}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo producto
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <ProductosTable products={products} onEdit={handleEditProduct} canWrite={canWrite} />
      )}

      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={(v) => {
          setProductDialogOpen(v);
          if (!v) setEditingProduct(null);
        }}
        product={editingProduct}
      />

      <CategoriasDialog open={categoriasOpen} onOpenChange={setCategoriasOpen} />
    </div>
  );
}
