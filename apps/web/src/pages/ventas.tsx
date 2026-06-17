import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShoppingCart } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/hooks/use-cart';
import { useGetProducts, useGetCategories } from '@/hooks/use-products';
import { useGetPaymentMethods } from '@/hooks/use-payment-methods';
import { useCreateSale } from '@/hooks/use-sales';
import { usePaymentState } from '@/hooks/use-payment-state';
import { useConnectivity } from '@/hooks/use-connectivity';
import { ProductGrid } from '@/components/dashboard/ventas/product-grid';
import { CartItemRow } from '@/components/dashboard/ventas/cart-item-row';
import { PaymentForm } from '@/components/dashboard/ventas/payment-form';
import { CategoryFilters } from '@/components/dashboard/ventas/category-filters';
import { OfflineBanner } from '@/components/dashboard/ventas/offline-banner';
import { TicketPreviewDialog } from '@/components/dashboard/ventas/ticket-preview-dialog';
import { generateSaleNumber, parseMoney } from '@/lib/ventas';
import { getErrorMessage } from '@/lib/errors';
import { enqueueSale } from '@/lib/queue-manager';
import { buildTicketHtml } from '@/lib/ticket';
import { getPrintSettings } from '@/lib/print-settings';
import { printTicket } from '@/lib/printing';
import type { Sale } from '@/types/models';

export default function VentasPage() {
  const { items, addItem, removeItem, updateQuantity, clearCart, total } = useCart();
  const { data: products = [], isLoading: loadingProducts } = useGetProducts();
  const { data: categories = [] } = useGetCategories();
  const { data: paymentMethods = [] } = useGetPaymentMethods();
  const { mutate: createSale, isPending: isSubmitting } = useCreateSale();
  const { isOnline } = useConnectivity();

  const [notesInput, setNotesInput] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

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

  const filteredProducts = products.filter((p) => {
    if (!p.isActive) return false;
    if (selectedCategory !== null && p.category?.id !== selectedCategory) return false;
    return true;
  });

  const isSubmitDisabled = items.length === 0 || total <= 0 || isSubmitting || !isValid;

  const handlePrintSale = (sale: Sale) => {
    const settings = getPrintSettings();
    const html = buildTicketHtml(sale, settings);

    if (settings.previewBeforePrint) {
      setPreviewHtml(html);
      setPreviewSale(sale);
      setPreviewOpen(true);
    } else {
      void printTicket(html, settings).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        toast.error(`Error al imprimir: ${message}`);
      });
    }
  };

  const handleConfirmPrint = () => {
    if (!previewSale) return;
    setPreviewOpen(false);
    const settings = getPrintSettings();
    const html = buildTicketHtml(previewSale, settings);
    void printTicket(html, settings).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al imprimir: ${message}`);
    });
  };

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
        handlePrintSale(sale);
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
    <div className="space-y-4">
      <OfflineBanner isOnline={isOnline} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)]">
        {/* Left column: category filters + product grid */}
        <div className="space-y-4">
          <CategoryFilters
            categories={categories}
            selectedCategory={selectedCategory}
            onSelect={(id) => setSelectedCategory(selectedCategory === id ? null : id)}
          />
          <ProductGrid
            products={filteredProducts}
            isLoading={loadingProducts}
            onAddToCart={addItem}
          />
        </div>

        {/* Right column: sticky cart */}
        <Card className="overflow-hidden lg:sticky lg:top-4 self-start">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Carrito de Compras</CardTitle>
              <p className="text-sm text-muted-foreground">
                {items.reduce((s, i) => s + i.quantity, 0)} articulos
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">Carrito vacio</div>
            ) : (
              <div className="px-4">
                <div className="divide-y">
                  {items.map((item) => (
                    <CartItemRow
                      key={item.product.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>

          <CardContent className="space-y-4">
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
              className="resize-none text-sm"
              rows={2}
            />
          </CardContent>

          <CardFooter className="gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => {
                clearCart();
                resetPayments();
                setNotesInput('');
              }}
            >
              Vaciar
            </Button>
            <Button
              className="flex-1"
              onClick={() => void handleSubmit()}
              disabled={isSubmitDisabled}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Registrar venta
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <TicketPreviewDialog
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        saleNumber={previewSale?.saleNumber}
        previewHtml={previewHtml}
        onPrint={handleConfirmPrint}
      />
    </div>
  );
}
