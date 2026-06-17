import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ProductCard } from './product-card';
import type { Product } from '@/types/models';

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  onAddToCart: (product: Product) => void;
}

export function ProductGrid({ products, isLoading, onAddToCart }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-white p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Cargando productos...</span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          No hay productos disponibles
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAdd={onAddToCart} />
      ))}
    </div>
  );
}
