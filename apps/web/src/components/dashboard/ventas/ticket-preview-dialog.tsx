import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TicketPreviewDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  saleNumber?: string;
  previewHtml: string;
  onPrint: () => void;
};

export function TicketPreviewDialog({
  isOpen,
  onOpenChange,
  saleNumber,
  previewHtml,
  onPrint,
}: TicketPreviewDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Previsualización de ticket</DialogTitle>
          <DialogDescription>Revisa el ticket antes de imprimir.</DialogDescription>
        </DialogHeader>
        {saleNumber && (
          <div className="rounded-md border bg-slate-50 p-3">
            <div className="text-xs uppercase text-muted-foreground">Código de venta</div>
            <div className="text-3xl font-bold tracking-widest text-slate-900">#{saleNumber}</div>
          </div>
        )}
        <div className="rounded-md border bg-white p-2">
          <iframe
            title="Previsualización de ticket"
            className="h-96 w-full rounded-md bg-white"
            srcDoc={previewHtml}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onPrint}>Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
