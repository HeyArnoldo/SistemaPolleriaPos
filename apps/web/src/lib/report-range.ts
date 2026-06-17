import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

export type { DateRange };

export interface ReportRangeParams {
  startDate: string;
  endDate: string;
}

export const dateRangeToParams = (range: DateRange | undefined): ReportRangeParams | null => {
  if (!range?.from) return null;
  const from = range.from;
  const to = range.to ?? range.from;
  return {
    startDate: format(startOfDay(from), "yyyy-MM-dd'T'HH:mm:ss"),
    endDate: format(endOfDay(to), "yyyy-MM-dd'T'HH:mm:ss"),
  };
};

export const formatRangeLabel = (range: DateRange | undefined): string => {
  if (!range?.from) return 'Seleccionar rango';
  const from = format(range.from, 'dd/MM/yyyy');
  if (!range.to || range.to.getTime() === range.from.getTime()) return from;
  const to = format(range.to, 'dd/MM/yyyy');
  return `${from} - ${to}`;
};
