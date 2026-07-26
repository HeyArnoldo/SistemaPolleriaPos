export { formatCurrency, parseAmount, formatTime } from '@/lib/formatting';

const pad2 = (n: number) => String(n).padStart(2, '0');
const pad4 = (n: number) => String(n).padStart(4, '0');
const MONTH_SHORT = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];
const TICKET_COUNTER_KEY = 'pos.ticketCounter';

export const parseMoney = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  return isNaN(num) ? 0 : num;
};

export const getCurrentTimeValue = (): string => {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
};

type TicketCounterState = { date: string; seq: number };

/** Returns the current date string (YYYY-MM-DD) in America/Lima timezone. */
const limaDateString = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

const parseTicketCounter = (raw: string | null): TicketCounterState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { date?: string; seq?: number };
    if (typeof parsed.date !== 'string' || typeof parsed.seq !== 'number') return null;
    return { date: parsed.date, seq: parsed.seq };
  } catch {
    return null;
  }
};

const writeTicketCounter = (state: TicketCounterState) => {
  try {
    localStorage.setItem(TICKET_COUNTER_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
};

const SALE_NUMBER_REGEX = new RegExp(`^(${MONTH_SHORT.join('|')})-(\\d{2})-(\\d{4})$`);

/** Today's date key ('YYYYMMDD') in America/Lima — same shape generateSaleNumber stores. */
const limaDateKeyString = (): string => limaDateString().replace(/-/g, '');

/** Date key ('YYYYMMDD') for an arbitrary Date, evaluated in America/Lima. */
const limaDateKeyFromDate = (date: Date): string =>
  date.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).replace(/-/g, '');

const parseSaleNumberParts = (
  saleNumber: string,
): { monthIndex: number; day: number; seq: number } | null => {
  const match = saleNumber.trim().toUpperCase().match(SALE_NUMBER_REGEX);
  if (!match) return null;
  const monthIndex = MONTH_SHORT.indexOf(match[1]);
  if (monthIndex < 0) return null;
  const day = Number(match[2]);
  const seq = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(seq)) return null;
  return { monthIndex, day, seq };
};

/** Sequence number embedded in a sale number (e.g. 'JUL-24-0120' -> 120), or null. */
export const parseSaleNumberSeq = (saleNumber: string): number | null => {
  const parts = parseSaleNumberParts(saleNumber);
  return parts ? parts.seq : null;
};

/** Best-effort date key for a sale number when no createdAt is available. */
const getDateKeyFromSaleNumber = (saleNumber: string): string | null => {
  const parts = parseSaleNumberParts(saleNumber);
  if (!parts) return null;
  const todayKey = limaDateKeyString();
  const year = Number(todayKey.slice(0, 4));
  const mmdd = `${pad2(parts.monthIndex + 1)}${pad2(parts.day)}`;
  const dateKey = `${year}${mmdd}`;
  // A month-day ahead of today must belong to the previous year.
  return dateKey > todayKey ? `${year - 1}${mmdd}` : dateKey;
};

/** Advances the local counter only if the given (date, seq) is ahead of what is stored. */
export const syncTicketCounter = (next: TicketCounterState): boolean => {
  try {
    const current = parseTicketCounter(localStorage.getItem(TICKET_COUNTER_KEY));
    if (
      !current ||
      next.date > current.date ||
      (next.date === current.date && next.seq > current.seq)
    ) {
      writeTicketCounter(next);
      return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
};

/**
 * Aligns the local ticket counter to the server's last sale so the NEXT generated
 * number stays ahead of what the server already has. This is what lets the local
 * correlativo self-heal after a localStorage wipe / fresh desktop install, keeping
 * the offline-first counter from re-issuing numbers that already exist on the server.
 */
export const syncTicketCounterFromSale = (saleNumber?: string, createdAt?: string): boolean => {
  if (!saleNumber) return false;
  const seq = parseSaleNumberSeq(saleNumber);
  if (seq === null) return false;

  let dateKey: string | null = null;
  if (createdAt) {
    const date = new Date(createdAt);
    if (Number.isFinite(date.getTime())) dateKey = limaDateKeyFromDate(date);
  }
  if (!dateKey) dateKey = getDateKeyFromSaleNumber(saleNumber);
  if (!dateKey) return false;

  return syncTicketCounter({ date: dateKey, seq });
};

export const generateSaleNumber = (): string => {
  const limaDate = limaDateString(); // 'YYYY-MM-DD' in America/Lima
  const [yearStr, monthStr, dayStr] = limaDate.split('-');
  const dateKey = `${yearStr}${monthStr}${dayStr}`;
  let seq = 1;
  try {
    const stored = parseTicketCounter(localStorage.getItem(TICKET_COUNTER_KEY));
    if (stored?.date === dateKey) {
      seq = (stored.seq ?? 0) + 1;
    }
    writeTicketCounter({ date: dateKey, seq });
  } catch {
    // ignore
  }
  const monthIndex = parseInt(monthStr, 10) - 1;
  const month = MONTH_SHORT[monthIndex];
  const day = dayStr;
  return `${month}-${day}-${pad4(seq)}`;
};

/**
 * Idempotency-key keeper for a single cart/sale build session.
 *
 * `get()` returns the SAME sale number on every call until `reset()` is invoked
 * (called when the cart is cleared after a successful sale). This is what makes
 * the POS resilient to rapid double-clicks under high customer traffic: two
 * quick submits of the same cart reuse one sale number, so the server's unique
 * `sale_number` guard rejects the second one instead of creating a duplicate
 * sale.
 *
 * The generator is injectable so the caching behavior can be unit-tested
 * without touching `localStorage`.
 */
export interface SaleNumberKeeper {
  get: () => string;
  reset: () => void;
}

export const createSaleNumberKeeper = (
  generate: () => string = generateSaleNumber,
): SaleNumberKeeper => {
  let current: string | null = null;
  return {
    get: () => {
      if (current === null) {
        current = generate();
      }
      return current;
    },
    reset: () => {
      current = null;
    },
  };
};
