/**
 * RewardsModal — lets the cashier pick rewards to redeem for the current customer.
 * Supports accumulating multiple redemptions before confirming.
 */
import { Gift } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Reward } from '@app/carbopuntos-contracts';

interface RewardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rewards: Reward[];
  currentBalance: number;
  pendingRewards: Reward[];
  onSelectReward: (reward: Reward) => void;
}

export function RewardsModal({
  open,
  onOpenChange,
  rewards,
  currentBalance,
  pendingRewards,
  onSelectReward,
}: RewardsModalProps) {
  const pendingCost = pendingRewards.reduce((s, r) => s + r.costPoints, 0);
  const available = currentBalance - pendingCost;

  const activeRewards = rewards.filter((r) => r.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Canjear premio</DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Disponible: <strong className="text-red-600">{available} pts</strong>
          </p>
        </DialogHeader>

        <div className="space-y-2 max-h-96 overflow-y-auto py-1">
          {activeRewards.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No hay premios configurados.</p>
          )}
          {activeRewards.map((r) => {
            const canSelect = available >= r.costPoints;
            return (
              <button
                key={r.id}
                disabled={!canSelect}
                onClick={() => {
                  onSelectReward(r);
                  onOpenChange(false);
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  canSelect
                    ? 'border-slate-200 hover:border-red-400 hover:bg-red-50 cursor-pointer'
                    : 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        canSelect ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      <Gift className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`font-semibold text-sm ${canSelect ? 'text-slate-900' : 'text-slate-400'}`}
                      >
                        {r.name}
                      </div>
                      {!canSelect && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Faltan {r.costPoints - available} pts
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`text-lg font-black flex-shrink-0 ${canSelect ? 'text-red-600' : 'text-slate-400'}`}
                  >
                    {r.costPoints}
                    <span className="text-xs font-medium ml-0.5 opacity-60">pts</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {pendingRewards.length > 0 && (
          <div className="border-t pt-3">
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-2 text-sm font-bold bg-slate-900 text-white rounded-md hover:bg-slate-800"
            >
              Listo · {pendingRewards.length} {pendingRewards.length === 1 ? 'canje' : 'canjes'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
