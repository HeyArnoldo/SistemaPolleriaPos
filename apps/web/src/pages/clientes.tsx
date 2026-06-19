/**
 * Clientes page — admin view for CarboPuntos customer management.
 * Shows a searchable list, customer detail with history,
 * adjust points (admin), and void movement per row (admin).
 */
import { useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  RotateCcw,
  ChevronLeft,
  AlertCircle,
  Loader2,
  History,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

function movementBadgeVariant(
  type: PointsMovement['type'],
  isVoided: boolean,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (isVoided) return 'secondary';
  if (type === 'accrual') return 'default';
  if (type === 'redeem') return 'destructive';
  return 'outline';
}

// ─── AdjustModal ─────────────────────────────────────────────────────────────

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
  // Unwrap the CustomerWithBalance response — we need the nested Customer object.
  const customer = customerData?.customer ?? null;
  const { data: history = [], isLoading: loadingHistory } = useGetCustomerHistory(dni);

  const { mutate: adjustPoints, isPending: isAdjusting } = useAdjustPoints();
  const { mutate: voidMovement, isPending: isVoiding } = useVoidMovement();

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<PointsMovement | null>(null);

  // Derive current balance from history (latest balanceAfter of non-voided movements)
  const activeMovements = history.filter((m) => !m.isVoided);
  const currentBalance =
    activeMovements.length > 0
      ? activeMovements.reduce((latest, m) =>
          new Date(m.createdAt) > new Date(latest.createdAt) ? m : latest,
        ).balanceAfter
      : 0;

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
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ChevronLeft className="h-4 w-4 mr-1" />
        Volver
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{customer.fullName}</h2>
          <p className="text-sm text-muted-foreground">
            DNI {customer.dni}
            {customer.phone && ` · ${customer.phone}`}
          </p>
        </div>
        <Button
          onClick={() => setAdjustOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          Ajustar puntos
        </Button>
      </div>

      {/* Balance card */}
      <Card className="bg-slate-900 text-white">
        <CardContent className="pt-6">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black">{currentBalance}</span>
            <span className="text-slate-300 text-lg">pts</span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Saldo global (todas las sedes)</p>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Historial completo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin movimientos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Puntos</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((m) => (
                  <TableRow key={m.id} className={m.isVoided ? 'opacity-50' : ''}>
                    <TableCell>
                      <Badge variant={movementBadgeVariant(m.type, m.isVoided)}>
                        {movementLabel(m.type)}
                        {m.isVoided && ' (anulado)'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`font-mono font-bold ${
                        m.points > 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {m.points > 0 ? '+' : ''}
                      {m.points}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{m.sede}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {m.detail ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(m.createdAt)}
                    </TableCell>
                    <TableCell>
                      {!m.isVoided && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedMovement(m);
                            setVoidOpen(true);
                          }}
                          title="Anular movimiento"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
  customers: Customer[];
  onSelect: (dni: string) => void;
}

function CustomerTable({ customers, onSelect }: CustomerTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Registrado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c: Customer) => (
              <TableRow
                key={c.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => onSelect(c.dni)}
              >
                <TableCell className="font-medium">{c.fullName}</TableCell>
                <TableCell className="font-mono text-sm">{c.dni}</TableCell>
                <TableCell className="text-slate-500">{c.phone ?? '—'}</TableCell>
                <TableCell className="text-xs text-slate-500">
                  {new Date(c.createdAt).toLocaleDateString('es-PE')}
                </TableCell>
                <TableCell>
                  <Badge variant={c.isActive ? 'default' : 'secondary'}>
                    {c.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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

  // Show list or search results based on whether the user has typed anything.
  const customers: Customer[] = isSearching ? searchResults : (listData?.items ?? []);
  const isLoading = isSearching ? searchLoading : listLoading;

  if (selectedDni) {
    return (
      <div className="space-y-6">
        <CustomerDetail dni={selectedDni} onBack={() => setSelectedDni(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-red-600" />
            Clientes CarboPuntos
          </h1>
          <p className="text-sm text-muted-foreground">
            Historial cross-sede · ajuste de puntos · anular movimiento
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrar por DNI, nombre o teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : customers.length === 0 ? (
        isSearching ? (
          <div className="flex items-center gap-2 py-8 text-slate-500">
            <AlertCircle className="h-4 w-4" />
            No se encontraron clientes para &quot;{searchQuery}&quot;.
          </div>
        ) : (
          <div className="flex items-center gap-2 py-8 text-slate-500">
            <AlertCircle className="h-4 w-4" />
            No hay clientes registrados aún.
          </div>
        )
      ) : (
        <CustomerTable customers={customers} onSelect={setSelectedDni} />
      )}
    </div>
  );
}
