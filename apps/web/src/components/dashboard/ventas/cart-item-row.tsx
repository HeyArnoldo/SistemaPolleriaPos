import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div className="flex items-center gap-2 py-2 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.product.name}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)} c/u</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Input
          className="h-6 w-10 text-center text-sm p-0"
          value={item.quantity}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val)) onUpdateQuantity(item.product.id, val);
          }}
        />
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="text-sm font-medium w-20 text-right">{formatCurrency(subtotal)}</div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-destructive hover:text-destructive"
        onClick={() => onRemove(item.product.id)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
