/**
 * Clientes page — admin view for CarboPuntos customer management.
 * Pixel-perfect clone of the CustomersView prototype (lines 1316–1493).
 *
 * List view: searchable table with DNI / CLIENTE / TELÉFONO / PUNTOS columns.
 * Detail view: identity card, balance card, actions (adjust), movement history
 *              with per-row void action.
 *
 * Exceptions from the prototype (by spec):
 *  D21 — No expiry block ("Próximo vencimiento") — points don't expire.
 *  D22 — No "Eliminar historial" button; voiding is per-row (RotateCcw).
 */
import { useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  RotateCcw,
  ArrowLeft,
  AlertCircle,
  Loader2,
  History,
  Star,
  User,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useListCustomers,
  useSearchCustomers,
  useGetCustomer,
  useGetCustomerHistory,
  useAdjustPoints,
  useVoidMovement,
} from '@/hooks/use-customers';
import { getErrorMessage } from '@/lib/errors';
import type { Customer, PointsMovement } from '@app/carbopuntos-contracts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function movementLabel(type: PointsMovement['type']): string {
  const labels: Record<PointsMovement['type'], string> = {
    accrual: 'Acumulación',
    redeem: 'Canje',
    adjustment: 'Ajuste',
    reversal: 'Reversión',
  };
  return labels[type] ?? type;
}

// ─── AdjustModal ──────────────────────────────────────────────────────────────

interface AdjustModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  currentBalance: number;
  onConfirm: (delta: number, reason: string) => void;
  isPending: boolean;
}

function AdjustModal({
  open,
  onOpenChange,
  customer,
  currentBalance,
  onConfirm,
  isPending,
}: AdjustModalProps) {
  const [mode, setMode] = useState<'add' | 'sub'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const amountInt = parseInt(amount, 10) || 0;
  const delta = mode === 'add' ? amountInt : -amountInt;
  const final = currentBalance + delta;
  const valid = amountInt > 0 && reason.trim().length >= 5 && final >= 0;

  const handleClose = () => {
    setAmount('');
    setReason('');
    setMode('add');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar puntos</DialogTitle>
          <p className="text-xs text-slate-500">
            {customer.fullName} · saldo actual {currentBalance} pts
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('add')}
            className={`py-2.5 text-sm font-bold rounded-md border transition-colors ${
              mode === 'add'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            Sumar
          </button>
          <button
            onClick={() => setMode('sub')}
            className={`py-2.5 text-sm font-bold rounded-md border transition-colors ${
              mode === 'sub'
                ? 'bg-red-600 text-white border-red-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Minus className="w-3.5 h-3.5 inline mr-1" />
            Restar
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-600">Cantidad de puntos</label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              type="text"
              inputMode="numeric"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600">
              Motivo del ajuste <span className="text-red-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: cliente reclamó puntos no acreditados en ticket #182"
              rows={3}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-slate-900 resize-none"
            />
          </div>

          {amount && (
            <div
              className={`text-xs px-3 py-2 rounded-md ${
                final < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-700'
              }`}
            >
              Saldo final: <strong>{final} pts</strong>
              {final < 0 && <span className="block mt-1">No se permiten saldos negativos</span>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            className="bg-slate-900 hover:bg-slate-800 text-white"
            onClick={() => onConfirm(delta, reason)}
            disabled={!valid || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Guardando…
              </>
            ) : (
              'Confirmar ajuste'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── VoidConfirmModal ─────────────────────────────────────────────────────────

interface VoidConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movement: PointsMovement | null;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

function VoidConfirmModal({
  open,
  onOpenChange,
  movement,
  onConfirm,
  isPending,
}: VoidConfirmModalProps) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 5;

  const handleClose = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular movimiento</DialogTitle>
          <p className="text-xs text-slate-500">
            Esta acción es de soft-delete. El saldo se recalcula.
          </p>
        </DialogHeader>

        {movement && (
          <div className="rounded-lg bg-slate-50 border p-3 text-sm">
            <div className="font-semibold">{movementLabel(movement.type)}</div>
            <div className="text-slate-600 mt-0.5">
              {movement.points > 0 ? '+' : ''}
              {movement.points} pts · {formatDate(movement.createdAt)}
            </div>
            {movement.detail && (
              <div className="text-xs text-slate-500 mt-1">{movement.detail}</div>
            )}
          </div>
        )}

        <div>
          <label className="text-[11px] font-semibold text-slate-600">
            Motivo de la anulación <span className="text-red-600">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: movimiento registrado por error"
            rows={3}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-slate-900 resize-none"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={!valid || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Anulando…
              </>
            ) : (
              'Anular movimiento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CustomerDetail ───────────────────────────────────────────────────────────

interface CustomerDetailProps {
  dni: string;
  onBack: () => void;
}

function CustomerDetail({ dni, onBack }: CustomerDetailProps) {
  const { data: customerData, isLoading: loadingCustomer } = useGetCustomer(dni);
  // Unwrap the CustomerWithBalance response.
  const customer = customerData?.customer ?? null;
  // Use the hub's canonical balance (from PointsBalance), not derived from history.
  const currentBalance = customerData?.balance ?? 0;

  const { data: history = [], isLoading: loadingHistory } = useGetCustomerHistory(dni);

  const { mutate: adjustPoints, isPending: isAdjusting } = useAdjustPoints();
  const { mutate: voidMovement, isPending: isVoiding } = useVoidMovement();

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<PointsMovement | null>(null);

  if (loadingCustomer) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center gap-2 py-8 text-slate-500">
        <AlertCircle className="h-4 w-4" />
        No se encontró el cliente.
      </div>
    );
  }

  const handleAdjust = (delta: number, reason: string) => {
    adjustPoints(
      { dni, payload: { points: delta, reason } },
      {
        onSuccess: () => {
          toast.success('Puntos ajustados correctamente');
          setAdjustOpen(false);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al ajustar puntos'));
        },
      },
    );
  };

  const handleVoid = (reason: string) => {
    if (!selectedMovement) return;
    voidMovement(
      { movementId: selectedMovement.id, reason },
      {
        onSuccess: () => {
          toast.success('Movimiento anulado');
          setVoidOpen(false);
          setSelectedMovement(null);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Error al anular movimiento'));
        },
      },
    );
  };

  return (
    <div className="p-0 sm:p-2 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={onBack}
        aria-label="Volver a clientes"
        className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a clientes
      </button>

      {/* Identity */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
          <User className="w-7 h-7 text-red-600" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] tracking-wider font-bold text-slate-500">CLIENTE</div>
          <div className="text-2xl font-black text-slate-900 leading-tight">
            {customer.fullName}
          </div>
          <div className="text-sm text-slate-500 mt-0.5 font-mono">
            DNI {customer.dni}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </div>
        </div>
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-semibold tracking-wider">SALDO ACTUAL</span>
        </div>
        <div className="text-4xl font-black">
          {currentBalance}
          <span className="text-base font-medium text-slate-300 ml-1">pts</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setAdjustOpen(true)}
          className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 rounded-md hover:bg-slate-50 flex items-center justify-center gap-2"
        >
          <Edit3 className="w-3.5 h-3.5" /> Ajustar puntos
        </button>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900">Historial de movimientos</div>
          <div className="text-[11px] text-slate-500">
            {history.length} {history.length === 1 ? 'movimiento' : 'movimientos'}
          </div>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <div className="text-sm">Sin movimientos aún</div>
          </div>
        ) : (
          <div>
            {history.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0 ${
                  m.isVoided ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900 truncate">
                    {movementLabel(m.type)}
                    {m.detail ? ` · ${m.detail}` : ''}
                    {m.isVoided ? <span className="text-slate-400 ml-1">(anulado)</span> : null}
                  </div>
                  <div className="text-[11px] text-slate-500">{formatDate(m.createdAt)}</div>
                </div>
                <div
                  className={`text-base font-black flex-shrink-0 ${
                    m.points > 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {m.points > 0 ? '+' : ''}
                  {m.points}
                </div>
                {!m.isVoided && (
                  <button
                    onClick={() => {
                      setSelectedMovement(m);
                      setVoidOpen(true);
                    }}
                    title="Anular movimiento"
                    aria-label="Anular movimiento"
                    className="ml-1 p-1 rounded hover:bg-red-50 text-destructive"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AdjustModal
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        customer={customer}
        currentBalance={currentBalance}
        onConfirm={handleAdjust}
        isPending={isAdjusting}
      />

      <VoidConfirmModal
        open={voidOpen}
        onOpenChange={setVoidOpen}
        movement={selectedMovement}
        onConfirm={handleVoid}
        isPending={isVoiding}
      />
    </div>
  );
}

// ─── CustomerTable ────────────────────────────────────────────────────────────

interface CustomerTableProps {
  rows: (Customer & { balance: number })[];
  onSelect: (dni: string) => void;
}

function CustomerTable({ rows, onSelect }: CustomerTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="text-left text-[11px] font-bold tracking-wider text-slate-500 border-b border-slate-100">
            <th className="px-5 py-3">DNI</th>
            <th className="py-3">CLIENTE</th>
            <th className="py-3">TELÉFONO</th>
            <th className="px-5 py-3 text-right">PUNTOS</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-12 text-slate-400 text-sm">
                Sin resultados
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr
                key={c.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                onClick={() => onSelect(c.dni)}
              >
                <td className="px-5 py-3 font-mono text-sm text-slate-600">{c.dni}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="font-semibold text-sm text-slate-900">{c.fullName}</div>
                  </div>
                </td>
                <td className="py-3 text-sm text-slate-600">{c.phone ?? '—'}</td>
                <td className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-1 font-black text-red-600">
                    <Star className="w-3 h-3 fill-red-600" /> {c.balance}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── ClientesPage ─────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDni, setSelectedDni] = useState<string | null>(null);

  // Default list — loaded on mount, no text filter required.
  const { data: listData, isLoading: listLoading } = useListCustomers();

  // Server-side search — active only when the user types something.
  const isSearching = searchQuery.length >= 1;
  const { data: searchResults = [], isLoading: searchLoading } = useSearchCustomers(
    searchQuery,
    isSearching,
  );

  // Unified rows: both list and search return (Customer & { balance: number })[].
  const rows: (Customer & { balance: number })[] = isSearching
    ? searchResults
    : (listData?.items ?? []);
  const isLoading = isSearching ? searchLoading : listLoading;

  const total = listData?.total ?? 0;

  if (selectedDni) {
    return (
      <div className="space-y-4">
        <CustomerDetail dni={selectedDni} onBack={() => setSelectedDni(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Clientes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {total} {total === 1 ? 'cliente registrado' : 'clientes registrados'} en CarboPuntos
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por DNI, nombre o teléfono"
          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-slate-900"
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 && !isSearching ? (
        <div className="flex items-center gap-2 py-8 text-slate-500">
          <AlertCircle className="h-4 w-4" />
          No hay clientes registrados aún.
        </div>
      ) : (
        // CustomerTable handles its own empty-search state row internally.
        <CustomerTable rows={rows} onSelect={setSelectedDni} />
      )}
    </div>
  );
}
