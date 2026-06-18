import { subDays, subWeeks, subMonths, format } from 'date-fns';

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

// Lima calendar date (YYYY-MM-DD) for a given instant. The API expands these
// date-only bounds to the full GMT-5 day, so the report covers the whole Lima
// day instead of being cut off ~5h early (a datetime without offset was being
// read as UTC server-side).
const toLimaYmd = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);

// "Today" in Lima anchored at noon-Lima, safe for subDays/subWeeks/subMonths math.
const limaTodayNoon = (): Date => new Date(`${toLimaYmd(new Date())}T12:00:00-05:00`);

export const getReportDateParams = (
  preset: ReportPreset,
  customRange?: { from?: Date; to?: Date },
): ReportDateRange => {
  if (preset === 'custom' && customRange) {
    const from = customRange.from ?? customRange.to ?? new Date();
    const to = customRange.to ?? customRange.from ?? from;
    // from/to come from the calendar picker (local-midnight of the chosen day):
    // take their calendar date as-is.
    return { startDate: format(from, 'yyyy-MM-dd'), endDate: format(to, 'yyyy-MM-dd') };
  }

  const now = limaTodayNoon();

  switch (preset) {
    case 'yesterday': {
      const y = subDays(now, 1);
      return { startDate: toLimaYmd(y), endDate: toLimaYmd(y) };
    }
    case 'last7':
      return { startDate: toLimaYmd(subDays(now, 6)), endDate: toLimaYmd(now) };
    case 'last30':
      return { startDate: toLimaYmd(subDays(now, 29)), endDate: toLimaYmd(now) };
    case 'lastWeek':
      return { startDate: toLimaYmd(subWeeks(now, 1)), endDate: toLimaYmd(now) };
    case 'lastMonth':
      return { startDate: toLimaYmd(subMonths(now, 1)), endDate: toLimaYmd(now) };
    case 'today':
    default:
      return { startDate: toLimaYmd(now), endDate: toLimaYmd(now) };
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
