import { useState, useCallback, useRef } from 'react';
import type { Product } from '@/types/models';
import { createSaleNumberKeeper, type SaleNumberKeeper } from '@/lib/ventas';

export interface CartItem {
  product: Product;
  quantity: number;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  // Idempotency key for the sale currently being built. Stable across repeated
  // submits of the same cart (rapid double-click safe); reset only when the cart
  // is cleared after a successful sale, so the next sale gets a fresh number.
  // Lazily created once and retained for the hook's lifetime.
  const saleNumberKeeper = useRef<SaleNumberKeeper | null>(null);
  if (saleNumberKeeper.current === null) {
    saleNumberKeeper.current = createSaleNumberKeeper();
  }

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
    } else {
      setItems((prev) => prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i)));
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    saleNumberKeeper.current?.reset();
  }, []);

  /** Stable sale number for the current cart (same value until the cart is cleared). */
  const getSaleNumber = useCallback(() => {
    if (saleNumberKeeper.current === null) {
      saleNumberKeeper.current = createSaleNumberKeeper();
    }
    return saleNumberKeeper.current.get();
  }, []);

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getSaleNumber,
    total,
    itemCount,
  };
}
