export function formatCurrency(amount: number | string | undefined | null): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(isNaN(num) ? 0 : num);
}

export function parseAmount(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  return isNaN(num) ? 0 : num;
}

export function formatTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Lima',
  }).format(new Date(dateStr));
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Lima',
  }).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Lima',
  }).format(new Date(dateStr));
}
