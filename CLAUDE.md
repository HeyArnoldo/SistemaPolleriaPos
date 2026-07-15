# Guía del proyecto — SistemaPolleriaPos

Sistema POS para la cadena de pollerías "Pollería Carbón". Monorepo pnpm migrado
desde dos repos separados (frontend + backend NestJS).

> **Para una sesión nueva (humano o agente): leé esta carpeta `docs/` ANTES de
> tocar código.** Acá está cómo funciona cada cosa, las convenciones y las
> trampas conocidas. Te ahorra escarbar el código y evita romper convenciones.

## Mapa de la documentación

| Doc                                          | Qué contiene                                               |
| -------------------------------------------- | ---------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, estructura del monorepo, flujo de datos, deploy     |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md)   | Convenciones de código (backend, frontend, contratos, git) |
| [docs/DOMAINS.md](docs/DOMAINS.md)           | Cómo funciona cada dominio de punta a punta                |
| [docs/GOTCHAS.md](docs/GOTCHAS.md)           | Trampas recurrentes y lecciones aprendidas                 |

## Reglas de oro (resumen — el detalle está en docs/)

1. **Nunca pushear directo a `main`.** Rama → PR → CI en verde → merge (squash).
   Verificá la secuencia del CI localmente antes de pushear.
2. **TypeORM `synchronize: false` siempre.** Cambios de esquema solo por migración.
3. **Contratos Zod compartidos** entre API y web (`packages/contracts`). La misma
   validación en los dos lados.
4. **Los decimales de TypeORM llegan como string.** Todo campo monetario que
   cruza API↔front debe coercionarse a número (ver GOTCHAS).
5. **Zona horaria: America/Lima (UTC-5).** Las agrupaciones por día se anclan a
   Lima, no a UTC (ver GOTCHAS).
6. **Toda mutación de venta/gasto debe invalidar las queries financieras**
   (`invalidateFinancialQueries`) para que dashboard/caja/BI se actualicen.
7. **Verificá siempre el trabajo de los sub-agentes contra el código real** antes
   de confiar en su reporte (`git status`, leer el archivo).

## Memoria entre sesiones (Engram)

El estado del trabajo (decisiones, gotchas, qué se hizo) vive en Engram. Una
sesión nueva debe llamar `mem_search("onboarding")` → topic_key
`onboarding/index`, que apunta a estos docs y a los topic_keys `recovery/*` y
`workflow/*`. Los docs del repo son la fuente durable de "cómo funciona";
Engram es el registro de "por qué" y del estado de avance.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

### Onboarding (new dev / new machine)

The graph itself (`graphify-out/`) is gitignored — it is regenerated locally from source, not committed.

1. Install graphify: `uv tool install graphifyy` (requires `uv` or `pipx`, Python 3.10+).
2. Build the local graph: `graphify update .` (AST-only, no LLM, no API key needed).
3. Enable the agent hooks locally: `graphify claude install` (`.claude/` is gitignored in this repo, so the PreToolUse reminder is not shared and must be installed per machine).

The committed git hooks in `.husky/` keep the graph fresh on commit/checkout.
