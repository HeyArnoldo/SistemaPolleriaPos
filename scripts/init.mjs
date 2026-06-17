#!/usr/bin/env node
/**
 * Inicializa un proyecto nuevo a partir del template.
 *
 *   node scripts/init.mjs <nombre-proyecto> [--clean] [--keep]
 *
 *   <nombre-proyecto>  kebab-case (ej: mi-proyecto). Reemplaza el nombre del
 *                      template en package.json, docker-compose, .env, etc.
 *   --clean            elimina el CRUD demo de notas (api + web + contracts +
 *                      migración) dejando solo auth y la estructura base.
 *   --keep             no autoborrar este script al terminar.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
let name = args.find((a) => !a.startsWith('--'));

if (!name) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  name = (await rl.question('Nombre del proyecto (kebab-case): ')).trim();
  rl.close();
}

if (!/^[a-z][a-z0-9-]*$/.test(name ?? '')) {
  console.error('✖ Nombre inválido. Usa kebab-case: letras minúsculas, números y guiones.');
  process.exit(1);
}

const snake = name.replaceAll('-', '_');
const TOKEN = 'template-fullstack';
const TOKEN_SNAKE = 'template_fullstack';

function patchFile(rel, transform) {
  const path = resolve(root, rel);
  if (!existsSync(path)) return false;
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) {
    writeFileSync(path, after);
    console.log(`  ✓ ${rel}`);
    return true;
  }
  return false;
}

const renameToken = (s) => s.replaceAll(TOKEN, name).replaceAll(TOKEN_SNAKE, snake);

console.log(`\nRenombrando proyecto a "${name}"...`);
for (const rel of [
  'package.json',
  'docker-compose.yml',
  'docker-compose.prod.yml',
  '.env.example',
  '.env',
  'README.md',
  'apps/api/src/config/typeorm.config.ts',
  'apps/web/index.html',
  'apps/web/src/layouts/app-layout.tsx',
]) {
  patchFile(rel, renameToken);
}

if (flags.has('--clean')) {
  console.log('\nEliminando el CRUD demo de notas...');

  for (const rel of [
    'apps/api/src/notes',
    'apps/web/src/pages/notes.tsx',
    'apps/web/src/hooks/use-notes.ts',
    'apps/web/src/services/notes.api.ts',
    'packages/contracts/src/notes.ts',
  ]) {
    const path = resolve(root, rel);
    if (existsSync(path)) {
      rmSync(path, { recursive: true });
      console.log(`  ✓ eliminado ${rel}`);
    }
  }

  patchFile('packages/contracts/src/index.ts', (s) =>
    s.replace(/export \* from '\.\/notes';\n?/, ''),
  );

  patchFile('apps/api/src/app.module.ts', (s) =>
    s
      .replace(/import { NotesModule } from '\.\/notes\/notes\.module';\n?/, '')
      .replace(/\s*NotesModule,/, ''),
  );

  // Quita los statements de la tabla notes de la migración inicial.
  patchFile('apps/api/src/database/migrations/1781111943053-InitSchema.ts', (s) =>
    s.replace(/\s*await queryRunner\.query\([^;]*?notes[^;]*?\);/gs, ''),
  );

  // Home mínimo en lugar de la página de notas.
  writeFileSync(
    resolve(root, 'apps/web/src/pages/home.tsx'),
    `export default function HomePage() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-2xl font-semibold">¡Listo!</h1>
      <p className="text-muted-foreground">Empieza a construir tu app.</p>
    </div>
  );
}
`,
  );
  console.log('  ✓ creado apps/web/src/pages/home.tsx');

  patchFile('apps/web/src/router.tsx', (s) =>
    s
      .replace(
        "const NotesPage = lazy(() => import('@/pages/notes'));",
        "const HomePage = lazy(() => import('@/pages/home'));",
      )
      .replace('<NotesPage />', '<HomePage />'),
  );
}

if (!flags.has('--keep')) {
  patchFile('package.json', (s) => s.replace(/\s*"init": "node scripts\/init\.mjs",/, ''));
  rmSync(resolve(root, 'scripts/init.mjs'));
  console.log('\n  ✓ scripts/init.mjs autoeliminado');
}

console.log(`
Listo. Próximos pasos:
  1. cp .env.example .env   (y ajusta JWT_SECRET, ADMIN_*)
  2. pnpm install
  3. pnpm db:up && pnpm migration:run && pnpm seed
  4. pnpm dev
`);
