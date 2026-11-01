# BatchGrade Backend Architecture

This directory is the technical blueprint for rebuilding BatchGrade's C++ grading backend. It covers how the backend works today, the target architecture, the grading workflow, the data model, the security model, and a step-by-step migration plan. Every proposal is traced to evidence in the repository or marked as a proposal or assumption.

> **Status:** Proposed (2026-10-31). No production code has been changed. These documents describe the target and the plan for reaching it.

## Architecture at a glance

- **What exists today.** The Electron main process has working Docker primitives (`dockerCompile`, `dockerExecute`, `dockerJudge`) and SQLite CRUD. Nothing in the backend runs the grading workflow from start to finish. That logic lived in a renderer component, which was removed in PR #136. In addition: users can choose host paths that get mounted into containers, output is unbounded, temp files leak, and three data models overlap. See [01](01-current-state.md).
- **Where it is going.** The grading engine becomes a **modular monolith** inside the main process, at `src/main/grading/`, with four layers:
  - a pure **domain** for judging, verdicts, scoring, and the run state machine
  - an **application** layer for the use cases: create submission, grade submission, batch, cancel, results, recovery
  - **infrastructure** adapters for Docker, the filesystem, and Drizzle/SQLite
  - an **interface** layer for Electron IPC

  Six ports separate the engine from the outside world. The engine never imports Electron, so it can run headless and could later run behind an HTTP API. See [03](03-target-architecture.md).

- **How grading works.** Each submission is snapshotted once and compiled once in a hardened, network-less, non-root container. The binary then runs in one fresh container per test case, under limits on time, memory, process count, output size, and disk. Each test gets a precise verdict. Every attempt is recorded as an immutable `GradingRun`. A batch runs with bounded concurrency and can be cancelled and recovered. Infrastructure failures are never recorded as student grades. See [04](04-grading-workflow.md) and [06](06-security.md).
- **How to get there.** Small, independently reviewable phases. The first milestone is a **headless C++ grading workflow** that runs under plain Node (P1–P4). See [07](07-migration-plan.md).

## Document map

| Document                                              | Question it answers                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [01 — Current state](01-current-state.md)             | What exists, what was removed, and what is wrong with it?                                           |
| [02 — Requirements](02-requirements.md)               | What must the backend do? Each requirement is marked confirmed, proposed, or assumption.            |
| [03 — Target architecture](03-target-architecture.md) | Layers, components, ports, error handling, DI, directory layout, C4 diagrams, desktop vs SaaS       |
| [04 — Grading workflow](04-grading-workflow.md)       | The 12-step lifecycle, state machines, verdicts, failures, cancellation, concurrency, recovery      |
| [05 — Data model](05-data-model.md)                   | Entities, invariants, ER diagrams, SQLite vs artifact storage, consolidating the overlapping tables |
| [06 — Security](06-security.md)                       | Threat model, trust boundaries, exact container flags, residual risks, verification checklist       |
| [07 — Migration plan](07-migration-plan.md)           | Phases P1–P8 with acceptance criteria, Milestone 1, suggested PR sequence                           |

### Architecture Decision Records

| ADR                                                      | Decision                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [ADR-0001](adr/0001-modular-monolith.md)                 | Modular monolith rather than microservices                                                               |
| [ADR-0002](adr/0002-layers-and-dependency-direction.md)  | Four layers, six ports, dependencies point inward                                                        |
| [ADR-0003](adr/0003-docker-sandbox-strategy.md)          | Docker CLI; compile once, one container per test; explicit lifecycle; image prepared before timers       |
| [ADR-0004](adr/0004-persistence-and-artifact-storage.md) | SQLite for metadata and excerpts, filesystem for blobs, append-only history, expand → migrate → contract |
| [ADR-0005](adr/0005-orchestration-and-concurrency.md)    | In-process promise pool, AbortController cancellation, fail-and-regrade recovery                         |
| [ADR-0006](adr/0006-engine-independent-of-electron.md)   | Engine in `src/main/grading/`, no Electron imports (lint-enforced), values injected                      |

**Suggested reading order:** this page, then 01, 03, 04. Read 02, 05, 06 as references and 07 when planning work.

## Glossary

These terms are used with exactly these meanings throughout the documents, the diagrams, and the proposed code.

| Term                       | Meaning                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Assignment**             | Exercise defined by an instructor. Stored in `instructor_assignments`. Owns test cases and an optional partial `GradingPolicy`.                                                                        |
| **TestCase**               | One stdin / expected-output pair, with `order`, `points`, and an optional `timeoutMs`. Stored in `assignment_test_cases`.                                                                              |
| **TestSuite**              | The ordered, frozen list of test cases a run is graded against. Comes from an assignment or is **ad hoc**. Identified by sha256.                                                                       |
| **GradingPolicy**          | Compare mode, compiler flags, compile/test `ResourceLimits`, and scoring rule. Frozen into each run.                                                                                                   |
| **ResourceLimits**         | Wall time, memory, CPUs, pids, output capture bytes, file size, tmpfs size.                                                                                                                            |
| **Submission**             | Immutable snapshot of one student's source files (table `submission_snapshots`). Identified by a UUID and a manifest sha256.                                                                           |
| **studentRef**             | Opaque student identifier: a `users.uuid` or an imported folder name. Not a foreign key.                                                                                                               |
| **GradingRun**             | One attempt to grade one Submission against one TestSuite under one GradingPolicy. Has a `RunStatus` and, once completed, a `RunOutcome`.                                                              |
| **RunStatus**              | `queued`, `preparing`, `compiling`, `testing`, `completed`, `failed`, `cancelled`                                                                                                                      |
| **RunOutcome**             | `graded` or `compile_error`. Only set when status is `completed`.                                                                                                                                      |
| **GradingBatch**           | A group of runs started together against one TestSuite. Status: `running`, `completed`, `cancelled`, `interrupted`.                                                                                    |
| **CompilationResult**      | `succeeded`, `failed`, or `timed_out`, plus exit code, captured stdout/stderr, and duration.                                                                                                           |
| **ExecutionResult**        | Raw outcome of one program execution: exit code, `timedOut`, `oomKilled`, `outputLimitExceeded`, captured streams, duration.                                                                           |
| **TestResult**             | The verdict and evidence for one test case in one run.                                                                                                                                                 |
| **Verdict**                | `passed`, `wrong_answer`, `runtime_error`, `time_limit_exceeded`, `memory_limit_exceeded`, `output_limit_exceeded`, `skipped`                                                                          |
| **Workspace**              | Per-run temporary directory (`tmp/batchgrade/runs/<runId>/{src,build}`). Mounted into containers, deleted when the run ends.                                                                           |
| **Artifact store**         | Durable directory (`userData/artifacts`) for snapshots, frozen suites, and output that is too large for SQLite.                                                                                        |
| **Sandbox**                | A Docker container created by the engine under `sandboxPolicy`, with labels `batchgrade.managed=true` and `batchgrade.run=<runId>`.                                                                    |
| **Port**                   | An interface in `application/ports.ts` that the application uses to reach an external system: `CppCompiler`, `ProgramRunner`, `SandboxHost`, `ArtifactStore`, `GradingRepository`, `AssignmentReader`. |
| **Adapter**                | An implementation of a port in `infrastructure/`.                                                                                                                                                      |
| **Infrastructure failure** | A failure not caused by the student, such as Docker unavailable, I/O, or persistence. It yields `status: failed` and **no grade**.                                                                     |

Labels used in the documents: **W*n*** = weaknesses ([01 §6](01-current-state.md#6-architectural-weaknesses-and-technical-debt)), **FR/NFR/PERF/REL/SEC/TEST/XP/EX** = requirements ([02](02-requirements.md)), **T*n*** = threats ([06 §5](06-security.md#5-threat-catalogue)), **I*n*** = invariants ([05 §4](05-data-model.md#4-invariants)), **P*n*** = phases ([07](07-migration-plan.md)), **D*n*** = open decisions (below).

## Open decisions

These decisions are deliberately left unresolved. Each has a proposed default so implementation is not blocked.

| ID  | Decision                                                                                       | Proposed default                                                         | Resolve by                  | Referenced in                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Default batch concurrency                                                                      | 2, clamped to `availableParallelism() - 1`                               | P4 measurements (PERF-1)    | [04 §7](04-grading-workflow.md#7-batch-scheduling-and-bounded-concurrency), [ADR-0005](adr/0005-orchestration-and-concurrency.md) |
| D2  | Default compiler flags and C++ standard                                                        | `[]` (today: gcc 14 default, GNU C++17)                                  | Before P7                   | [03 §7.1](03-target-architecture.md#71-core-domain-types)                                                                         |
| D3  | Assignment with zero test cases                                                                | Reject with `NO_TEST_CASES` (today: score 0)                             | P4                          | FR-18                                                                                                                             |
| D4  | Which run is the official grade; instructor overrides                                          | Latest `completed` run; no overrides                                     | P7                          | [05 §7](05-data-model.md#7-grades-and-feedback)                                                                                   |
| D5  | Retention of artifacts, run history, and legacy tables                                         | Keep everything; legacy export before P8                                 | Before P8                   | [05 §9](05-data-model.md#9-migration-strategy), [ADR-0004](adr/0004-persistence-and-artifact-storage.md)                          |
| D6  | Image digest pinning and offline distribution                                                  | Record the resolved digest per run; pin a multi-arch index digest in P3b | P3b                         | [06 §5](06-security.md#5-threat-catalogue) T16, [ADR-0003](adr/0003-docker-sandbox-strategy.md)                                   |
| D7  | Non-root user mapping on Windows                                                               | `65534:65534`; per-run named volume if bind mounts are not writable      | P3b                         | [06 §4.3](06-security.md#43-non-root-execution)                                                                                   |
| D8  | Whether Supabase/server sync returns                                                           | Out of scope; `@supabase/supabase-js` stays until decided                | Product decision            | EX-5                                                                                                                              |
| D9  | Per-test points / weighted scoring                                                             | Column added (`points` default 1); scoring stays `percent_passed`        | P5b                         | [05 §3](05-data-model.md#3-target-model)                                                                                          |
| D10 | Rename `instructor_assignments`                                                                | Not renamed; may follow P8                                               | After P8                    | [ADR-0004](adr/0004-persistence-and-artifact-storage.md)                                                                          |
| D11 | Output comparison modes beyond `normalized` (exact, per-line trailing whitespace, token-based) | Only `normalized` (identical to today)                                   | When instructors request it | [04 §5](04-grading-workflow.md#5-verdict-classification)                                                                          |

## Assumptions to validate

- A batch is at most a few hundred submissions with tens of test cases each (PERF-6).
- Only Linux containers are used; Windows containers are not supported (XP-5).
- Docker's `OOMKilled` flag is reliable with `--init` on the cgroup versions in use. This is verified in P3a.
- The renderer will be rebuilt against the new `grading:*` IPC contract. UI design is out of scope (EX-4).

## Diagram conventions

Diagrams use Mermaid, embedded in the documents. C4-style diagrams are drawn with `flowchart`, using `[Person]`, `[Container: …]`, and `[External system]` annotations, because Mermaid's `C4Context` syntax is experimental and renders inconsistently on GitHub. Sequence diagrams, state diagrams (`stateDiagram-v2`), and ER diagrams (`erDiagram`) use the names from the glossary.
