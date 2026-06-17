import { subDays, subWeeks, subMonths, startOfDay, endOfDay, format } from 'date-fns';

export type ReportPreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'lastWeek'
  | 'lastMonth'
  | 'custom';

export interface ReportDateRange {
  startDate: string;
  endDate: string;
}

const GMT5_OFFSET_MS = -5 * 60 * 60 * 1000;

const toGMT5Date = (date: Date): Date => {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + GMT5_OFFSET_MS);
};

export const getTodayRangeInGMT5 = (): { start: Date; end: Date } => {
  const nowGMT5 = toGMT5Date(new Date());
  return {
    start: startOfDay(nowGMT5),
    end: endOfDay(nowGMT5),
  };
};

export const getReportDateParams = (
  preset: ReportPreset,
  customRange?: { from?: Date; to?: Date },
): ReportDateRange => {
  const now = toGMT5Date(new Date());

  if (preset === 'custom' && customRange) {
    const from = customRange.from ?? now;
    const to = customRange.to ?? customRange.from ?? now;
    return {
      startDate: format(startOfDay(from), "yyyy-MM-dd'T'HH:mm:ss"),
      endDate: format(endOfDay(to), "yyyy-MM-dd'T'HH:mm:ss"),
    };
  }

  switch (preset) {
    case 'today':
      return {
        startDate: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return {
        startDate: format(startOfDay(yesterday), "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(endOfDay(yesterday), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    }
    case 'last7': {
      const from = subDays(now, 6);
      return {
        startDate: format(startOfDay(from), "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    }
    case 'last30': {
      const from = subDays(now, 29);
      return {
        startDate: format(startOfDay(from), "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    }
    case 'lastWeek': {
      const from = subWeeks(now, 1);
      return {
        startDate: format(startOfDay(from), "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    }
    case 'lastMonth': {
      const from = subMonths(now, 1);
      return {
        startDate: format(startOfDay(from), "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
    }
    default:
      return {
        startDate: format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(endOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"),
      };
  }
};

export const REPORT_PRESET_OPTIONS: { value: ReportPreset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'last7', label: 'Ultimos 7 dias' },
  { value: 'last30', label: 'Ultimos 30 dias' },
  { value: 'lastWeek', label: 'Ultima semana' },
  { value: 'lastMonth', label: 'Ultimo mes' },
  { value: 'custom', label: 'Personalizado' },
];

export const getReportPresetLabel = (preset: ReportPreset): string => {
  return REPORT_PRESET_OPTIONS.find((o) => o.value === preset)?.label ?? preset;
};
