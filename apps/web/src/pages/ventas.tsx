import { useRef, useState } from 'react';
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
import { useGetRewards } from '@/hooks/use-rewards';
import { ProductGrid } from '@/components/dashboard/ventas/product-grid';
import { CartItemRow } from '@/components/dashboard/ventas/cart-item-row';
import { PaymentForm } from '@/components/dashboard/ventas/payment-form';
import { CategoryFilters } from '@/components/dashboard/ventas/category-filters';
import { OfflineBanner } from '@/components/dashboard/ventas/offline-banner';
import { TicketPreviewDialog } from '@/components/dashboard/ventas/ticket-preview-dialog';
import { CustomerPanel } from '@/components/dashboard/ventas/customer-panel';
import { RewardsModal } from '@/components/dashboard/ventas/rewards-modal';
import { ConfirmRedemptionModal } from '@/components/dashboard/ventas/confirm-redemption-modal';
import { getErrorMessage } from '@/lib/errors';
import { enqueueSale } from '@/lib/queue-manager';
import { buildTicketHtml } from '@/lib/ticket';
import { getPrintSettings } from '@/lib/print-settings';
import { printTicket } from '@/lib/printing';
import { calcPointsToEarn, calcRedemptionCost, buildRedemptionsPayload } from '@/hooks/use-points';
import type { Sale, CreateSaleDTO } from '@/types/models';
import type { Customer, Reward } from '@app/carbopuntos-contracts';

export default function VentasPage() {
  const { items, addItem, removeItem, updateQuantity, clearCart, getSaleNumber, total } = useCart();
  const { data: products = [], isLoading: loadingProducts } = useGetProducts();
  const { data: categories = [] } = useGetCategories();
  const { data: paymentMethods = [] } = useGetPaymentMethods();
  const { mutate: createSale, isPending: isSubmitting } = useCreateSale();
  // Synchronous re-entry guard: blocks a second submit fired before React has a
  // chance to re-render the disabled button (rapid double-click under traffic).
  const submitInFlightRef = useRef(false);
  const { isOnline } = useConnectivity();
  const { data: rewards = [] } = useGetRewards(true);

  const [notesInput, setNotesInput] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // CarboPuntos state
  const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null);
  const [customerBalance, setCustomerBalance] = useState(0);
  const [pendingRewards, setPendingRewards] = useState<Reward[]>([]);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [confirmRedemptionOpen, setConfirmRedemptionOpen] = useState(false);

  const {
    paymentMode,
    singleMethodId,
    singleCashReceived,
    singleTransferTime,
    mixedYapeAmount,
    mixedCashAmount,
    mixedTransferTime,
    isMixedEnabled,
    singleGrossAmount,
    singleNetAmount,
    singleCommissionAmount,
    mixedYapeGrossAmount,
    mixedYapeNetAmountValue,
    mixedYapeCommissionAmount,
    mixedCashAmountValue,
    mixedTotalGross,
    paymentSummary,
    canSubmit,
    setPaymentMode,
    setSingleMethodId,
    setSingleCashReceived,
    setSingleTransferTime,
    setMixedYapeAmount,
    setMixedCashAmount,
    setMixedTransferTime,
    resetPayment,
    buildPaymentsPayload,
  } = usePaymentState({ total, paymentMethods });

  const filteredProducts = products.filter((p) => {
    if (!p.isActive) return false;
    if (selectedCategory !== null && p.category?.id !== selectedCategory) return false;
    return true;
  });

  // Solo-canje mode: no cart items but has pending rewards and a linked customer
  const isOnlyRedemption = items.length === 0 && pendingRewards.length > 0 && !!linkedCustomer;

  const canRegister = items.length > 0 || isOnlyRedemption;
  const isSubmitDisabled =
    !canRegister || isSubmitting || (items.length > 0 && (!canSubmit || total <= 0));

  const pointsToEarn = calcPointsToEarn(items);
  const redemptionCost = calcRedemptionCost(pendingRewards);

  const resetCarbopuntos = () => {
    setLinkedCustomer(null);
    setCustomerBalance(0);
    setPendingRewards([]);
  };

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

  const doRegisterSale = () => {
    // Ignore re-entry while a submit is already in flight (rapid double-click).
    if (submitInFlightRef.current) return;

    const payments = isOnlyRedemption ? [] : (buildPaymentsPayload() ?? undefined);

    if (!isOnlyRedemption && !payments) {
      // buildPaymentsPayload already shows a specific toast
      return;
    }

    const redemptions =
      pendingRewards.length > 0 ? buildRedemptionsPayload(pendingRewards) : undefined;

    // Typed against the Zod contract (CreateSaleDTO) so any shape drift versus
    // server validation is a COMPILE ERROR (customerDni camelCase, redemption
    // shape, etc.).
    // getSaleNumber() returns a STABLE number for this cart: if this sale is
    // submitted twice (double-click / retry), both attempts carry the same
    // sale_number and the server rejects the duplicate instead of creating one.
    const salePayload: CreateSaleDTO = {
      saleNumber: getSaleNumber(),
      items: items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: i.product.price,
      })),
      payments: payments ?? [],
      ...(notesInput.trim() ? { notes: notesInput.trim() } : {}),
      ...(linkedCustomer ? { customerDni: linkedCustomer.dni } : {}),
      ...(redemptions ? { redemptions } : {}),
    };

    submitInFlightRef.current = true;

    if (!isOnline) {
      void enqueueSale(salePayload.saleNumber ?? '', salePayload)
        .then(() => {
          toast.success('Venta guardada sin conexión — se enviará al reconectarse');
          clearCart();
          resetPayment();
          setNotesInput('');
          resetCarbopuntos();
        })
        .finally(() => {
          submitInFlightRef.current = false;
        });
      return;
    }

    createSale(salePayload, {
      onSuccess: (sale) => {
        const isRedeem = isOnlyRedemption;
        if (isRedeem) {
          toast.success(`Canje registrado — −${redemptionCost} pts`);
        } else {
          toast.success(
            `Venta registrada${pointsToEarn > 0 && linkedCustomer ? ` · +${pointsToEarn} pts` : ''}`,
          );
        }
        // The API does not echo the customer name; the web already knows it from
        // the linked customer, so inject it into the ticket's carbopuntos block.
        const saleForTicket: Sale =
          linkedCustomer && sale.carbopuntos
            ? {
                ...sale,
                carbopuntos: { ...sale.carbopuntos, customerName: linkedCustomer.fullName },
              }
            : sale;
        handlePrintSale(saleForTicket);
        clearCart();
        resetPayment();
        setNotesInput('');
        resetCarbopuntos();
      },
      onError: (err) => {
        // A duplicate sale_number (409) means this exact sale was already
        // registered by a first, faster request — treat it as an avoided
        // duplicate, not an error.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 409) {
          // The sale is already registered (a prior, faster request won). Treat
          // it as terminal — clear the cart and reset state (which also resets
          // the stable sale number) so the terminal is not stuck in a 409 loop.
          toast.info('Esta venta ya estaba registrada — se evitó un duplicado.');
          clearCart();
          resetPayment();
          setNotesInput('');
          resetCarbopuntos();
          return;
        }
        toast.error(getErrorMessage(err, 'Error al registrar la venta'));
      },
      onSettled: () => {
        submitInFlightRef.current = false;
      },
    });
  };

  const handleSubmit = async () => {
    if (!canRegister) {
      toast.error('Agrega al menos un producto o un canje');
      return;
    }

    if (pendingRewards.length > 0 && linkedCustomer) {
      // Show confirmation modal before processing redemptions
      setConfirmRedemptionOpen(true);
      return;
    }

    doRegisterSale();
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

        {/* Right column: sticky cart + carbopuntos */}
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
            {items.length === 0 && !isOnlyRedemption ? (
              <div className="py-6 text-center text-muted-foreground">Carrito vacio</div>
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
            {/* CarboPuntos customer panel */}
            <CustomerPanel
              isOnline={isOnline}
              items={items}
              linkedCustomer={linkedCustomer}
              currentBalance={customerBalance}
              pendingRewards={pendingRewards}
              onCustomerLinked={(customer, balance) => {
                setLinkedCustomer(customer);
                setCustomerBalance(balance);
              }}
              onCustomerRemoved={() => {
                resetCarbopuntos();
              }}
              onOpenRewards={() => setRewardsOpen(true)}
              onRemoveReward={(idx) =>
                setPendingRewards((prev) => prev.filter((_, i) => i !== idx))
              }
            />

            {/* Payment form — hidden in solo-canje mode */}
            {!isOnlyRedemption && (
              <PaymentForm
                paymentMethods={paymentMethods}
                paymentMode={paymentMode}
                onPaymentModeChange={setPaymentMode}
                isMixedEnabled={isMixedEnabled}
                singleMethodId={singleMethodId}
                onSingleMethodChange={setSingleMethodId}
                singleCashReceived={singleCashReceived}
                onSingleCashReceivedChange={setSingleCashReceived}
                singleTransferTime={singleTransferTime}
                onSingleTransferTimeChange={setSingleTransferTime}
                mixedYapeAmount={mixedYapeAmount}
                onMixedYapeAmountChange={setMixedYapeAmount}
                mixedCashAmount={mixedCashAmount}
                onMixedCashAmountChange={setMixedCashAmount}
                mixedTransferTime={mixedTransferTime}
                onMixedTransferTimeChange={setMixedTransferTime}
                paymentSummary={paymentSummary}
                total={total}
                singleGrossAmount={singleGrossAmount}
                singleNetAmount={singleNetAmount}
                singleCommissionAmount={singleCommissionAmount}
                mixedYapeGrossAmount={mixedYapeGrossAmount}
                mixedYapeNetAmountValue={mixedYapeNetAmountValue}
                mixedYapeCommissionAmount={mixedYapeCommissionAmount}
                mixedCashAmountValue={mixedCashAmountValue}
                mixedTotalGross={mixedTotalGross}
                onRequestSubmit={() => void handleSubmit()}
              />
            )}

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
                resetPayment();
                setNotesInput('');
                resetCarbopuntos();
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
              ) : isOnlyRedemption ? (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Registrar canje
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

      {/* Dialogs */}
      <TicketPreviewDialog
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        saleNumber={previewSale?.saleNumber}
        previewHtml={previewHtml}
        onPrint={handleConfirmPrint}
      />

      <RewardsModal
        open={rewardsOpen}
        onOpenChange={setRewardsOpen}
        rewards={rewards}
        currentBalance={customerBalance}
        pendingRewards={pendingRewards}
        onSelectReward={(r) => setPendingRewards((prev) => [...prev, r])}
      />

      {linkedCustomer && (
        <ConfirmRedemptionModal
          open={confirmRedemptionOpen}
          onOpenChange={setConfirmRedemptionOpen}
          customer={linkedCustomer}
          currentBalance={customerBalance}
          pendingRewards={pendingRewards}
          onConfirm={doRegisterSale}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
