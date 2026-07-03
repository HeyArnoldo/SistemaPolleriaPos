import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download, Loader2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
import { useExportCashReport } from '@/hooks/use-sales';
import {
  REPORT_PRESET_OPTIONS,
  getReportDateParams,
  type ReportPreset,
} from '@/lib/report-presets';
import { formatRangeLabel } from '@/lib/report-range';

export function CashReportCard() {
  const [preset, setPreset] = useState<ReportPreset>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { mutate: exportReport, isPending } = useExportCashReport();

  const handleExport = () => {
    const params = getReportDateParams(preset, {
      from: customRange?.from,
      to: customRange?.to,
    });

    exportReport(params, {
      onSuccess: ({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Reporte exportado correctamente');
      },
      onError: () => {
        toast.error('Error al exportar el reporte');
      },
    });
  };

  return (
    <Card className="border-slate-200/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Reporte de caja</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={preset} onValueChange={(v) => setPreset(v as ReportPreset)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_PRESET_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {preset === 'custom' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                aria-label={
                  customRange?.from
                    ? `Rango seleccionado: ${formatRangeLabel(customRange)}. Cambiar rango`
                    : 'Seleccionar rango de fechas'
                }
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customRange?.from ? (
                  formatRangeLabel(customRange)
                ) : (
                  <span className="text-muted-foreground">Seleccionar rango</span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-auto max-w-fit p-6">
              <DialogHeader>
                <DialogTitle>Seleccionar rango de fechas</DialogTitle>
              </DialogHeader>
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={customRange}
                onSelect={(range) => {
                  setCustomRange(range);
                  if (range?.from && range.to) setDialogOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        <Button
          className="w-full"
          onClick={handleExport}
          disabled={isPending || (preset === 'custom' && (!customRange?.from || !customRange?.to))}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
