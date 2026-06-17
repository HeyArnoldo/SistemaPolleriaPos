import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useGetProducts, useGetCategories } from '@/hooks/use-products';
import { useGetPaymentMethods } from '@/hooks/use-payment-methods';
import { useCreateSale } from '@/hooks/use-sales';
import { usePaymentState } from '@/hooks/use-payment-state';
import { useConnectivity } from '@/hooks/use-connectivity';
import { ProductGrid } from '@/components/dashboard/ventas/product-grid';
import { CartItemRow } from '@/components/dashboard/ventas/cart-item-row';
import { PaymentForm } from '@/components/dashboard/ventas/payment-form';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDateTime } from '@/lib/formatting';
import type { Sale } from '@/types/models';
import { generateSaleNumber } from '@/lib/ventas';
import { parseMoney } from '@/lib/ventas';
import { getErrorMessage } from '@/lib/errors';
import { enqueueSale } from '@/lib/queue-manager';

function buildTicketHtml(sale: Sale): string {
  const items = sale.items
    .map(
      (i) =>
        `<tr><td>${i.product?.name ?? 'Producto'}</td><td>${i.quantity}</td><td>${formatCurrency(Number(i.unitPrice) * i.quantity)}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: monospace; font-size: 12px; width: 80mm; margin: 0 auto; }
  h2 { text-align: center; margin: 4px 0; font-size: 14px; }
  p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; padding: 2px 0; }
  th:last-child, td:last-child { text-align: right; }
  .total { font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head><body>
<h2>Pollería Carbón</h2>
<p>Ticket: ${sale.saleNumber ?? ''}</p>
<p>Fecha: ${formatDateTime(sale.createdAt)}</p>
<table>
  <thead><tr><th>Producto</th><th>Cant</th><th>Total</th></tr></thead>
  <tbody>${items}</tbody>
</table>
<p class="total">TOTAL: ${formatCurrency(sale.totalAmount)}</p>
</body></html>`;
}

export default function VentasPage() {
  const { items, addItem, removeItem, updateQuantity, clearCart, total } = useCart();
  const { data: products = [], isLoading: loadingProducts } = useGetProducts();
  const { data: categories = [] } = useGetCategories();
  const { data: paymentMethods = [] } = useGetPaymentMethods();
  const { mutate: createSale, isPending: isSubmitting } = useCreateSale();
  const { isOnline } = useConnectivity();

  const [notesInput, setNotesInput] = useState('');

  const {
    payments,
    addPaymentLine,
    removePaymentLine,
    updatePayment,
    setPaymentMethodForLine,
    resetPayments,
    totalPaid,
    change,
    isValid,
  } = usePaymentState({ total, paymentMethods });

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    if (!isValid) {
      toast.error('Completa los datos de pago correctamente');
      return;
    }

    const salePayload = {
      saleNumber: generateSaleNumber(),
      items: items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: i.product.price,
      })),
      payments: payments.map((p) => ({
        paymentMethodId: p.paymentMethodId,
        amount: parseMoney(p.amount),
        ...(p.transferTime ? { transferTime: p.transferTime } : {}),
      })),
      ...(notesInput.trim() ? { notes: notesInput.trim() } : {}),
    };

    if (!isOnline) {
      await enqueueSale(salePayload.saleNumber, salePayload);
      toast.success('Venta guardada sin conexión — se enviará al reconectarse');
      clearCart();
      resetPayments();
      setNotesInput('');
      return;
    }

    createSale(salePayload, {
      onSuccess: (sale) => {
        toast.success('Venta registrada correctamente');
        if (window.electronAPI) {
          void window.electronAPI.printTicket(buildTicketHtml(sale));
        }
        clearCart();
        resetPayments();
        setNotesInput('');
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Error al registrar la venta'));
      },
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4 overflow-hidden">
      {/* Left: Product grid */}
      <div className="flex-1 overflow-hidden">
        {loadingProducts ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ProductGrid products={products} categories={categories} onAddProduct={addItem} />
        )}
      </div>

      {/* Right: Cart + Payment */}
      <div className="w-80 xl:w-96 flex flex-col gap-3 overflow-hidden">
        <Card className="flex flex-col overflow-hidden flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Carrito
              {items.length > 0 && (
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {items.reduce((s, i) => s + i.quantity, 0)} items
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col p-3 pt-0">
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                Sin productos en el carrito
              </p>
            ) : (
              <ScrollArea className="flex-1">
                <div className="pr-2">
                  {items.map((item) => (
                    <CartItemRow
                      key={item.product.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {items.length > 0 && (
              <>
                <Separator className="my-2" />
                <div className="flex justify-between text-sm font-bold mb-3">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                <PaymentForm
                  payments={payments}
                  paymentMethods={paymentMethods}
                  total={total}
                  totalPaid={totalPaid}
                  change={change}
                  onAddLine={addPaymentLine}
                  onRemoveLine={removePaymentLine}
                  onUpdateAmount={(i, v) => updatePayment(i, { amount: v })}
                  onUpdateMethod={setPaymentMethodForLine}
                  onUpdateTransferTime={(i, v) => updatePayment(i, { transferTime: v })}
                />

                <Textarea
                  placeholder="Notas (opcional)"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="resize-none text-sm mt-2"
                  rows={2}
                />

                <div className="mt-3 space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !isValid || items.length === 0}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      'Registrar venta'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => {
                      clearCart();
                      resetPayments();
                      setNotesInput('');
                    }}
                    disabled={isSubmitting}
                  >
                    Limpiar carrito
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
