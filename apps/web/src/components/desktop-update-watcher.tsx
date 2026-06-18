import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Listens for the Electron auto-updater "downloaded" event and prompts the user
 * to restart. Renders nothing; no-op in the web build (no electronAPI).
 */
export function DesktopUpdateWatcher() {
  useEffect(() => {
    return window.electronAPI?.onUpdateDownloaded?.((info) => {
      toast.success('Actualización lista', {
        description: `La versión ${info?.version ?? 'nueva'} se descargó. Reiniciá para aplicarla.`,
        duration: Infinity,
        action: {
          label: 'Reiniciar',
          onClick: () => void window.electronAPI?.restartToUpdate?.(),
        },
      });
    });
  }, []);

  return null;
}
