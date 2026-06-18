// Copies the built web app into the Electron output so it ships inside the
// desktop package and loads locally (fat client → works offline). Run AFTER
// `vite build` (which empties dist-electron) and AFTER the web is built.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webDist = join(here, '..', '..', 'web', 'dist');
const target = join(here, '..', 'dist-electron', 'web');

if (!existsSync(webDist)) {
  console.error(
    '[copy-web] apps/web/dist not found — build the web first (pnpm --filter @app/web build).',
  );
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(webDist, target, { recursive: true });
console.log('[copy-web] copied apps/web/dist → apps/desktop/dist-electron/web');
