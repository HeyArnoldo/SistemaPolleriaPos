import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatting';
import type { CartItem } from '@/hooks/use-cart';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (productId: number, qty: number) => void;
  onRemove: (productId: number) => void;
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const subtotal = item.product.price * item.quantity;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1">
        <p className="font-semibold">{item.product.name}</p>
        <p className="text-sm text-muted-foreground">{formatCurrency(item.product.price)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center">{item.quantity}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <span className="w-20 text-right font-semibold">{formatCurrency(subtotal)}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={() => onRemove(item.product.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
