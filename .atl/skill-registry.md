# Skill Registry — SistemaPolleriaPos

Generated: 2026-06-18
Project: sistemapos-backend-nest
Artifact store: hybrid (engram + openspec)

## Skills Index

### User-Level Skills (`~/.claude/skills/`)

| Skill                  | Trigger / Description                                                  | Scope | SKILL.md Path                                    |
| ---------------------- | ---------------------------------------------------------------------- | ----- | ------------------------------------------------ |
| `branch-pr`            | Creating, opening, or preparing PRs for review                         | user  | `~/.claude/skills/branch-pr/SKILL.md`            |
| `chained-pr`           | PRs over 400 lines, stacked PRs, review slices                         | user  | `~/.claude/skills/chained-pr/SKILL.md`           |
| `cognitive-doc-design` | Writing guides, READMEs, RFCs, onboarding, architecture docs           | user  | `~/.claude/skills/cognitive-doc-design/SKILL.md` |
| `comment-writer`       | PR feedback, issue replies, reviews, Slack messages, GitHub comments   | user  | `~/.claude/skills/comment-writer/SKILL.md`       |
| `go-testing`           | Go tests, go test coverage, Bubbletea teatest, golden files            | user  | `~/.claude/skills/go-testing/SKILL.md`           |
| `issue-creation`       | Creating GitHub issues, bug reports, feature requests                  | user  | `~/.claude/skills/issue-creation/SKILL.md`       |
| `judgment-day`         | Judgment day, dual review, adversarial review                          | user  | `~/.claude/skills/judgment-day/SKILL.md`         |
| `skill-creator`        | New skills, agent instructions, documenting AI usage patterns          | user  | `~/.claude/skills/skill-creator/SKILL.md`        |
| `skill-improver`       | Improve skills, audit skills, refactor skills, skill quality           | user  | `~/.claude/skills/skill-improver/SKILL.md`       |
| `work-unit-commits`    | Implementation, commit splitting, chained PRs, keeping tests with code | user  | `~/.claude/skills/work-unit-commits/SKILL.md`    |

### SDD Phase Skills (`~/.claude/skills/`) — Executor-only

| Skill         | Trigger / Description                                                   | Scope | SKILL.md Path                           |
| ------------- | ----------------------------------------------------------------------- | ----- | --------------------------------------- |
| `sdd-apply`   | Implement SDD tasks from specs and design                               | user  | `~/.claude/skills/sdd-apply/SKILL.md`   |
| `sdd-archive` | Archive a completed SDD change by syncing delta specs                   | user  | `~/.claude/skills/sdd-archive/SKILL.md` |
| `sdd-design`  | Create the SDD technical design and architecture approach               | user  | `~/.claude/skills/sdd-design/SKILL.md`  |
| `sdd-explore` | Explore SDD ideas before committing to a change                         | user  | `~/.claude/skills/sdd-explore/SKILL.md` |
| `sdd-init`    | Initialize SDD context, testing capabilities, registry, and persistence | user  | `~/.claude/skills/sdd-init/SKILL.md`    |
| `sdd-onboard` | Walk users through the SDD workflow on the real codebase                | user  | `~/.claude/skills/sdd-onboard/SKILL.md` |
| `sdd-propose` | Create an SDD change proposal with intent, scope, and approach          | user  | `~/.claude/skills/sdd-propose/SKILL.md` |
| `sdd-spec`    | Write SDD delta specs with requirements and scenarios                   | user  | `~/.claude/skills/sdd-spec/SKILL.md`    |
| `sdd-tasks`   | Break an SDD change into implementation tasks                           | user  | `~/.claude/skills/sdd-tasks/SKILL.md`   |
| `sdd-verify`  | Execute tests and prove implementation matches specs, design, and tasks | user  | `~/.claude/skills/sdd-verify/SKILL.md`  |

### Project Convention Files

| File                                                                          | Purpose                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `/home/ubuntu/claude/SistemaPolleriaPos/CLAUDE.md`                            | Entry point — maps docs, golden rules, Engram memory protocol |
| `/home/ubuntu/claude/SistemaPolleriaPos/docs/ARCHITECTURE.md`                 | Stack, monorepo structure, data flow, deploy                  |
| `/home/ubuntu/claude/SistemaPolleriaPos/docs/CONVENTIONS.md`                  | Code conventions (backend, frontend, contracts, git)          |
| `/home/ubuntu/claude/SistemaPolleriaPos/docs/DOMAINS.md`                      | Domain-by-domain behavior and routes                          |
| `/home/ubuntu/claude/SistemaPolleriaPos/docs/GOTCHAS.md`                      | Recurring traps and lessons                                   |
| `/home/ubuntu/claude/SistemaPolleriaPos/docs/CARBOPUNTOS-ANALISIS.md`         | CARBOPUNTOS architecture analysis                             |
| `/home/ubuntu/claude/SistemaPolleriaPos/docs/CARBOPUNTOS-DECISIONES.md`       | CARBOPUNTOS decisions (all resolved)                          |
| `/home/ubuntu/claude/SistemaPolleriaPos/docs/CARBOPUNTOS-PUNTOS-Y-PREMIOS.md` | Points tables, rewards catalog, DNI API contract              |
| `/home/ubuntu/claude/SistemaPolleriaPos/docs/CARBOPUNTOS-CASOS-Y-FLUJOS.md`   | Operational flows and edge cases                              |
| `/home/ubuntu/claude/SistemaPolleriaPos/docs/CARBOPUNTOS-PLAN.md`             | Implementation plan (F0–F6)                                   |

## Task-to-Skill Matching Guide

| Task                             | Primary Skills         | Secondary Skills             |
| -------------------------------- | ---------------------- | ---------------------------- |
| Implement feature (NestJS/React) | `work-unit-commits`    | `branch-pr`, `chained-pr`    |
| Create PR                        | `branch-pr`            | `chained-pr` (if >400 lines) |
| Split large change               | `chained-pr`           | `work-unit-commits`          |
| Write/review documentation       | `cognitive-doc-design` | —                            |
| Leave PR/issue comments          | `comment-writer`       | —                            |
| Create GitHub issue              | `issue-creation`       | —                            |
| Adversarial code review          | `judgment-day`         | —                            |
| Create new skill                 | `skill-creator`        | —                            |
| Improve existing skill           | `skill-improver`       | —                            |
| Update skill registry            | `skill-registry`       | —                            |
| Go code and tests                | `go-testing`           | —                            |

## Notes

- No project-level skills found (no `.atl/skills/`, `.claude/skills/`, etc. in project root).
- SDD phase skills are executor-only; the orchestrator dispatches them via the Agent mechanism.
- `chained-pr` is a required match for any SDD change where `sdd-tasks` forecasts >400 changed lines.
- Pass exact `SKILL.md` paths (not summaries) when injecting into sub-agent prompts.
