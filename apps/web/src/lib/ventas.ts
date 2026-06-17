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

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;

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

export const syncTicketCounterFromSale = (_saleNumber?: string, _createdAt?: string): boolean => {
  return false;
};

export const generateSaleNumber = (): string => {
  const now = new Date();
  const dateKey = formatDateKey(now);
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
  const month = MONTH_SHORT[now.getMonth()];
  const day = pad2(now.getDate());
  return `${month}-${day}-${pad4(seq)}`;
};
