import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatting';
import type { Product } from '@/types/models';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <Card
      className="min-h-32 cursor-pointer py-3 transition hover:shadow-md"
      onClick={() => onAdd(product)}
    >
      <CardContent className="flex flex-col items-center gap-2 p-3 py-0 text-center">
        {product.category?.name && (
          <span className="text-sm text-muted-foreground">{product.category.name}</span>
        )}
        <span className="line-clamp-2 text-lg font-semibold leading-tight">{product.name}</span>
        <span className="text-xl font-bold text-slate-900">{formatCurrency(product.price)}</span>
      </CardContent>
    </Card>
  );
}
