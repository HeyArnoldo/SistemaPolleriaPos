/**
 * CarbopuntosInfoCard — muestra cómo se ganan puntos y qué premios hay,
 * más un QR que apunta a la página informativa del programa de fidelización.
 *
 * Datos tomados de docs/CARBOPUNTOS-PUNTOS-Y-PREMIOS.md (sección 1 y 2).
 * Cuando exista una URL oficial, cambia CARBOPUNTOS_QR_VALUE por esa URL.
 */
import { QRCodeSVG } from 'qrcode.react';

/**
 * Valor del QR. Cuando tengas la página oficial del programa, reemplaza esta
 * constante por la URL real (por ejemplo https://carbon.pe/puntos).
 */
export const CARBOPUNTOS_QR_VALUE = 'https://carbon.pe/puntos';

// ─── Datos del programa ────────────────────────────────────────────────────────

export interface PointRule {
  product: string;
  points: number;
}

export interface RewardRule {
  name: string;
  costPoints: number;
}

/** Reglas de acumulación (fuente: CARBOPUNTOS-PUNTOS-Y-PREMIOS.md §1). */
export const POINTS_RULES: PointRule[] = [
  { product: '1/8 pollo', points: 5 },
  { product: '1/4 pollo', points: 10 },
  { product: '1/2 pollo', points: 15 },
  { product: 'Pollo entero', points: 20 },
];

/** Catálogo de premios (fuente: CARBOPUNTOS-PUNTOS-Y-PREMIOS.md §2). */
export const REWARDS_CATALOG: RewardRule[] = [
  { name: 'Gaseosa 1 LT', costPoints: 100 },
  { name: 'Jarra de limonada', costPoints: 140 },
  { name: 'Jarra de chicha', costPoints: 170 },
  { name: '1/8 pollo gratis', costPoints: 200 },
  { name: 'Pollo entero gratis', costPoints: 400 },
];

// ─── Componente ────────────────────────────────────────────────────────────────

/**
 * Tarjeta informativa del programa CarboPuntos.
 * Se integra en la vista de detalle de cliente (clientes.tsx) justo antes del
 * historial de movimientos.
 */
export function CarbopuntosInfoCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="text-sm font-bold text-slate-900">CarboPuntos — Cómo funciona</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          Acumula puntos al comprar y canjéalos por premios
        </div>
      </div>

      <div className="p-5 flex flex-col sm:flex-row gap-5">
        {/* Columna izquierda: reglas */}
        <div className="flex-1 space-y-4">
          {/* Cómo ganar */}
          <section aria-labelledby="cp-earn-heading">
            <h3
              id="cp-earn-heading"
              className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-2"
            >
              Puntos al comprar
            </h3>
            <ul className="space-y-1">
              {POINTS_RULES.map((rule) => (
                <li
                  key={rule.product}
                  className="flex justify-between text-sm text-slate-700"
                >
                  <span>{rule.product}</span>
                  <span className="font-semibold text-emerald-600">+{rule.points} pts</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-400 mt-1">
              Bebidas y combos sin pollo: 0 pts
            </p>
          </section>

          {/* Premios */}
          <section aria-labelledby="cp-rewards-heading">
            <h3
              id="cp-rewards-heading"
              className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-2"
            >
              Premios disponibles
            </h3>
            <ul className="space-y-1">
              {REWARDS_CATALOG.map((reward) => (
                <li
                  key={reward.name}
                  className="flex justify-between text-sm text-slate-700"
                >
                  <span>{reward.name}</span>
                  <span className="font-semibold text-red-600">{reward.costPoints} pts</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Columna derecha: QR */}
        <div className="flex flex-col items-center justify-start gap-2 flex-shrink-0">
          {/*
           * Cuando exista la página oficial del programa, actualizá
           * CARBOPUNTOS_QR_VALUE con la URL real (ver constante al inicio del archivo).
           */}
          <QRCodeSVG
            value={CARBOPUNTOS_QR_VALUE}
            size={96}
            bgColor="#ffffff"
            fgColor="#1e293b"
            aria-label="QR CarboPuntos"
          />
          <span className="text-[10px] text-slate-400 text-center leading-tight max-w-[100px]">
            Escanea para más información
          </span>
        </div>
      </div>
    </div>
  );
}
