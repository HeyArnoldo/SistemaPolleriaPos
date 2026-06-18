/**
 * CustomerPanel — shown in the cashier (ventas) view.
 * Handles DNI lookup, affiliation, linking, and reward selection setup.
 *
 * Flows covered:
 *   F2 — New customer affiliation (POST /api/carbopuntos/customers)
 *   F3 — Link existing customer (GET /api/carbopuntos/customers/:dni)
 *   F4/F5/F6 — Show balance, points to earn, projected balance
 *   C1/C3 — Disable when offline or hub down
 */
import { useState, useEffect } from 'react';
import { Fingerprint, Gift, RefreshCw, Sparkles, UserPlus, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useGetCustomer, useAffiliateCustomer } from '@/hooks/use-customers';
import { calcPointsToEarn, calcProjectedBalance, calcRedemptionCost } from '@/hooks/use-points';
import type { CartItem } from '@/hooks/use-cart';
import type { Customer, Reward } from '@app/carbopuntos-contracts';

interface CustomerPanelProps {
  isOnline: boolean;
  items: CartItem[];
  linkedCustomer: Customer | null;
  currentBalance: number;
  pendingRewards: Reward[];
  onCustomerLinked: (customer: Customer, balance: number) => void;
  onCustomerRemoved: () => void;
  onOpenRewards: () => void;
  onRemoveReward: (index: number) => void;
}

export function CustomerPanel({
  isOnline,
  items,
  linkedCustomer,
  currentBalance,
  pendingRewards,
  onCustomerLinked,
  onCustomerRemoved,
  onOpenRewards,
  onRemoveReward,
}: CustomerPanelProps) {
  const [dni, setDni] = useState('');
  const [wantsToCreate, setWantsToCreate] = useState(false);
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);

  // Reset creation form when DNI changes
  useEffect(() => {
    if (linkedCustomer) return;
    setWantsToCreate(false);
    setPhone('');
    setConsent(false);
  }, [dni, linkedCustomer]);

  const {
    data: foundCustomer,
    isLoading: isSearching,
    isError: notFound,
  } = useGetCustomer(dni, isOnline && dni.length === 8 && !linkedCustomer);

  const { mutate: affiliateCustomer, isPending: isAffiliating } = useAffiliateCustomer();

  const pointsToEarn = calcPointsToEarn(items);
  const redemptionCost = calcRedemptionCost(pendingRewards);
  const projectedBalance = calcProjectedBalance(currentBalance, pointsToEarn, redemptionCost);

  const handleLink = () => {
    if (!foundCustomer?.customer) return;
    // Pass the real balance from the hub response so the panel shows the correct saldo.
    onCustomerLinked(foundCustomer.customer, foundCustomer.balance);
    setDni('');
  };

  const handleAffiliate = () => {
    if (!isOnline) return;
    const now = new Date().toISOString();
    affiliateCustomer(
      {
        dni,
        phone: phone.trim() || undefined,
        consentAt: now,
      },
      {
        onSuccess: (newCustomer) => {
          onCustomerLinked(newCustomer, 0);
          setDni('');
          setWantsToCreate(false);
          setPhone('');
          setConsent(false);
        },
      },
    );
  };

  // ─── Linked customer panel ──────────────────────────────────────────────────
  if (linkedCustomer) {
    const hasEnoughBalance = currentBalance >= redemptionCost;
    const canRedeemMore = isOnline;

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-3">
        {/* Customer header */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="font-bold text-sm text-slate-900 truncate leading-tight">
              {linkedCustomer.fullName}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">DNI {linkedCustomer.dni}</div>
          </div>
          <button
            onClick={() => {
              onCustomerRemoved();
              setDni('');
            }}
            className="text-slate-400 hover:text-slate-700 flex-shrink-0 ml-2"
            aria-label="Desvincular cliente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance card */}
        <div className="bg-slate-900 rounded-lg px-4 py-3 mb-3 text-white">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-semibold text-slate-300">Saldo actual</span>
            <div>
              <span className="text-2xl font-black">{currentBalance}</span>
              <span className="text-sm text-slate-300 ml-1">pts</span>
            </div>
          </div>
          {pointsToEarn > 0 && (
            <div className="flex items-center justify-between text-xs border-t border-slate-700 mt-2 pt-2">
              <span className="text-emerald-400">+ {pointsToEarn} pts por esta compra</span>
            </div>
          )}
          {redemptionCost > 0 && (
            <div className="flex items-center justify-between text-xs border-t border-slate-700 mt-1 pt-1">
              <span className="text-amber-400">− {redemptionCost} pts por canjes</span>
            </div>
          )}
          {(pointsToEarn > 0 || redemptionCost > 0) && (
            <div className="flex items-center justify-between text-xs border-t border-slate-600 mt-2 pt-2 font-bold">
              <span className="text-slate-200">Saldo proyectado</span>
              <span className={projectedBalance >= 0 ? 'text-white' : 'text-red-400'}>
                {projectedBalance} pts
              </span>
            </div>
          )}
        </div>

        {/* Pending redemptions list */}
        {pendingRewards.length > 0 && (
          <div className="mb-2 space-y-1">
            {pendingRewards.map((r, idx) => (
              <div
                key={idx}
                className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-center gap-2"
              >
                <Gift className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                <div className="flex-1 text-xs font-semibold text-amber-900 truncate">{r.name}</div>
                <div className="text-[11px] font-bold text-red-600">−{r.costPoints}</div>
                <button
                  onClick={() => onRemoveReward(idx)}
                  className="text-amber-700 hover:text-amber-900 flex-shrink-0"
                  aria-label={`Quitar ${r.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Canjear button */}
        {isOnline ? (
          <Button
            variant="default"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={onOpenRewards}
            disabled={!canRedeemMore || (!hasEnoughBalance && pendingRewards.length === 0)}
          >
            <Gift className="w-4 h-4 mr-2" />
            {pendingRewards.length > 0 ? 'Agregar otro premio' : 'Canjear premio'}
          </Button>
        ) : (
          <div className="text-xs text-slate-500 flex items-center gap-2 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Canje deshabilitado sin conexión
          </div>
        )}
      </div>
    );
  }

  // ─── No customer linked ─────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-red-600" />
        <div className="text-[10px] font-bold tracking-wider text-slate-700">CARBOPUNTOS</div>
        {!isOnline && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 ml-auto">
            Sin conexión
          </Badge>
        )}
      </div>

      {!isOnline ? (
        <div className="text-xs text-slate-500 py-2">
          La vinculación de clientes requiere conexión al servidor.
        </div>
      ) : (
        <>
          {/* DNI input */}
          <div className="relative">
            <Fingerprint className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="DNI del cliente · 8 dígitos"
              inputMode="numeric"
              className="pl-9 font-mono tracking-wider"
              aria-label="DNI del cliente"
            />
          </div>

          {dni.length > 0 && dni.length < 8 && (
            <p className="mt-1 text-[11px] text-slate-400">Faltan {8 - dni.length} dígitos</p>
          )}

          {/* Searching indicator */}
          {isSearching && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Buscando cliente…
            </div>
          )}

          {/* Customer found → link */}
          {!isSearching && foundCustomer?.customer && (
            <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <div className="font-bold text-sm text-slate-900">
                {foundCustomer.customer.fullName}
              </div>
              <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                Cliente registrado · {foundCustomer.balance} pts
              </div>
              <Button
                className="w-full mt-3 bg-slate-900 hover:bg-slate-800 text-white"
                onClick={handleLink}
              >
                Vincular
              </Button>
            </div>
          )}

          {/* Not found → offer to create */}
          {!isSearching && notFound && dni.length === 8 && !wantsToCreate && (
            <Button
              className="w-full mt-3 bg-slate-900 hover:bg-slate-800 text-white"
              onClick={() => setWantsToCreate(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Crear perfil
            </Button>
          )}

          {/* Creation form — API lookup is done by the backend */}
          {wantsToCreate && (
            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-3">
              <p className="text-xs text-slate-600">
                La API consultará el padrón SUNAT para el DNI <strong>{dni}</strong>.
              </p>

              <div>
                <label className="text-[11px] font-semibold text-slate-600" htmlFor="phone-input">
                  Celular (opcional)
                </label>
                <Input
                  id="phone-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="987654321"
                  inputMode="numeric"
                  className="mt-1"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-emerald-600 flex-shrink-0 w-4 h-4"
                />
                <span className="text-[12px] font-semibold text-slate-700">
                  El cliente autoriza el uso de sus datos
                </span>
              </label>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setWantsToCreate(false);
                    setPhone('');
                    setConsent(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
                  onClick={handleAffiliate}
                  disabled={!consent || isAffiliating}
                >
                  {isAffiliating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Afiliando…
                    </>
                  ) : (
                    'Afiliar'
                  )}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
