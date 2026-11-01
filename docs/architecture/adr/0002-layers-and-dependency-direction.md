# ADR-0002: Layers, ports, and dependency direction

- **Status:** Proposed
- **Date:** 2026-10-31
- **Related:** [03 §2](../03-target-architecture.md#2-layers-and-dependency-rules), [03 §7](../03-target-architecture.md#7-interfaces-and-contracts), [03 §14](../03-target-architecture.md#14-rejected-abstractions), TEST-1, TEST-2, TEST-6

## Context

Today's grading code mixes concerns:

- `dockerCompile()` decides which files are C++, computes host paths, builds Docker flags, spawns processes and manages temp-dir lifetime.
- `dockerJudge()` couples output comparison to Docker execution.
- The grading rules (scoring, test pairing, failure handling) lived in a React component.

Coupling to Electron (`app`, `dialog`) appears in persistence and intake. None of this can be unit-tested without mocking `child_process` or Electron.

The redesign brief proposes Clean Architecture with ports and adapters. The brief also warns against needless abstraction, and the team is small.

## Decision

1. **Four layers**, with dependencies pointing inward only:
   - **Interface** (`src/main/ipc`) → **Application** (`grading/application`) → **Domain** (`grading/domain`).
   - **Infrastructure** (`grading/infrastructure`) implements application ports and may use domain types.
   - A single composition function, `createGradingEngine`, is the only place that knows both the use cases and the adapters.
2. **Exactly six ports**, each justified by a real external system plus a need for a test fake:

   | Port                | External system                              | Why it is a port                                                   |
   | ------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
   | `CppCompiler`       | Docker (`g++` container)                     | Slow and non-deterministic; faked in use-case tests                |
   | `ProgramRunner`     | Docker (test container)                      | Same; separate from compile because the contract and limits differ |
   | `SandboxHost`       | Docker daemon (availability, image, orphans) | Preflight and recovery must be testable without Docker             |
   | `ArtifactStore`     | Filesystem                                   | Workspaces and snapshots; future object storage                    |
   | `GradingRepository` | SQLite / Drizzle                             | Future Postgres; in-memory fake for the headless milestone         |
   | `AssignmentReader`  | SQLite (assignment CRUD owned elsewhere)     | The engine reads assignments but never owns them                   |

3. **Pure functions, not ports**, for judging, verdict classification, scoring and state transitions.
4. **Progress is a callback parameter**, not a port.
5. Import rules are enforced with ESLint `no-restricted-imports` overrides per folder.

## Alternatives considered

| Alternative                                                                                                                              | Why rejected                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Full Clean Architecture** (entities as classes, interactor and presenter per use case, request/response models, one gateway per table) | Doubles the file count for no requirement BatchGrade has. Presenters are unnecessary because IPC already maps DTOs.                                               |
| **No ports** (use cases call the Docker, fs and Drizzle modules directly; tests mock modules)                                            | This is the status quo pattern. Tests become `vi.mock` of `child_process`, which is brittle (arg-array assertions) and gives no seam for a future server adapter. |
| **A single `Sandbox` port** combining compile, run and host                                                                              | Merges compile and execute responsibilities that the brief requires to stay separate, and gives one adapter three reasons to change.                              |
| **Judge and Scorer as ports**                                                                                                            | They have no I/O. A port would only add indirection.                                                                                                              |

## Consequences and trade-offs

- ✅ Grading rules become unit-testable as pure functions (TEST-1). Orchestration is testable with fakes (TEST-2). Docker is needed only in the integration suite.
- ✅ Each external system has exactly one adapter file to change.
- ⚠️ There are more files than today: about 25 under `grading/`. Mitigated by keeping one file per concept and no barrel-file sprawl.
- ⚠️ Port signatures are async even where SQLite is synchronous. This is a small overhead, accepted for NFR-6.
- ⚠️ Lint rules must be maintained when folders move.
