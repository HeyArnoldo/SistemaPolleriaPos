import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Gift, PlusCircle, Search, Tags } from 'lucide-react';
import { useGetProducts, useGetCategories } from '@/hooks/use-products';
import { useGetRewards } from '@/hooks/use-rewards';
import { useMe } from '@/hooks/use-auth';
import { canAccessAction } from '@/lib/permissions';
import { ProductosTable } from '@/components/dashboard/productos/table/productos-table';
import { RewardsTable } from '@/components/dashboard/productos/table/rewards-table';
import { ProductFormDialog } from '@/components/dashboard/productos/dialog/product-form-dialog';
import { CategoriasDialog } from '@/components/dashboard/productos/dialog/categorias-dialog';
import { RewardFormDialog } from '@/components/dashboard/productos/dialog/reward-form-dialog';
import type { Product } from '@/types/models';
import type { Reward } from '@app/carbopuntos-contracts';

export default function ProductosPage() {
  const { data: user } = useMe();
  const { data: products = [], isLoading, isError } = useGetProducts();
  const { data: categories = [] } = useGetCategories();
  const { data: rewards = [], isLoading: loadingRewards } = useGetRewards();
  const canWriteProducts = canAccessAction(user?.role, 'products:write');
  const canWriteCategories = canAccessAction(user?.role, 'categories:write');

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoriasOpen, setCategoriasOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  const handleNewReward = () => {
    setEditingReward(null);
    setRewardDialogOpen(true);
  };

  const handleEditReward = (reward: Reward) => {
    setEditingReward(reward);
    setRewardDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="rewards">
            <Gift className="w-3.5 h-3.5 mr-1.5" />
            Premios CarboPuntos
          </TabsTrigger>
        </TabsList>

        {/* ── Products tab ── */}
        <TabsContent value="products" className="space-y-6 mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full rounded-lg bg-white pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {canWriteCategories && (
                <Button
                  variant="outline"
                  onClick={() => setCategoriasOpen(true)}
                  className="shrink-0"
                >
                  <Tags className="mr-2 h-4 w-4" />
                  Categorias
                </Button>
              )}
              {canWriteProducts && (
                <Button onClick={handleNewProduct} className="shrink-0">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nuevo Producto
                </Button>
              )}
            </div>
          </div>

          {isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Error al cargar los productos. Intenta nuevamente.
              </AlertDescription>
            </Alert>
          )}

          <ProductosTable
            products={products}
            categories={categories}
            searchValue={searchValue}
            onEdit={handleEditProduct}
            canWrite={canWriteProducts}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* ── Rewards tab ── */}
        <TabsContent value="rewards" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Catálogo de premios</h2>
              <p className="text-sm text-muted-foreground">
                Los premios activos son visibles para el cajero en caja.
              </p>
            </div>
            {canWriteProducts && (
              <Button onClick={handleNewReward}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuevo Premio
              </Button>
            )}
          </div>

          <RewardsTable
            rewards={rewards}
            isLoading={loadingRewards}
            onEdit={handleEditReward}
            canWrite={canWriteProducts}
          />
        </TabsContent>
      </Tabs>

      {/* Product dialogs */}
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={(v) => {
          setProductDialogOpen(v);
          if (!v) setEditingProduct(null);
        }}
        product={editingProduct}
      />

      <CategoriasDialog open={categoriasOpen} onOpenChange={setCategoriasOpen} />

      {/* Reward dialog */}
      <RewardFormDialog
        open={rewardDialogOpen}
        onOpenChange={(v) => {
          setRewardDialogOpen(v);
          if (!v) setEditingReward(null);
        }}
        reward={editingReward}
      />
    </div>
  );
}
