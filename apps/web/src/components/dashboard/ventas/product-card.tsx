import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/formatting';
import type { Product } from '@/types/models';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onAdd(product)}
    >
      <CardContent className="p-3">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-24 object-cover rounded mb-2"
          />
        )}
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{product.name}</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {product.category?.name}
            </Badge>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold">{formatCurrency(product.price)}</p>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 mt-1"
              onClick={(e) => {
                e.stopPropagation();
                onAdd(product);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
