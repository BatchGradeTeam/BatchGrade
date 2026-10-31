# ADR-0001: Modular monolith rather than microservices

- **Status:** Proposed
- **Date:** 2026-10-31
- **Related:** [03 §1](../03-target-architecture.md#1-architectural-style-and-justification), [03 §10](../03-target-architecture.md#10-deployment-views-desktop-now-saas-later), NFR-6, EX-2

## Context

BatchGrade is a desktop Electron application. One instructor runs it on their own machine, with one SQLite file and the local Docker daemon. The README also mentions a hosted ("server-based") mode, and the project wants to keep that future open. Today the backend is a flat set of functions in the Electron main process. The grading workflow was lost when the renderer was replaced ([01 §1](../01-current-state.md#1-summary)).

The forces at play:

- There is one deployment unit (an installer per OS) and no operations team.
- Grading is CPU-bound in Docker containers, not in Node. Node only orchestrates.
- The expected scale is a few hundred submissions per batch (PERF-6).
- A future SaaS might want to run grading workers separately from an API.

## Decision

Build the grading engine as a **module inside the existing main process** (`src/main/grading/`), with strict internal boundaries:

- layers with enforced import rules ([ADR-0002](0002-layers-and-dependency-direction.md))
- ports at the external boundaries
- no `electron` imports ([ADR-0006](0006-engine-independent-of-electron.md))

There are no separate processes, services, or network protocols between components.

## Alternatives considered

| Alternative                                                                      | Why rejected                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Microservices** (submission, compile, grade, gradebook services)               | The desktop install would have to ship and supervise several processes and handle network failures between them, with no scaling benefit on one machine. It contradicts EX-2.                                              |
| **Separate grading process** (Electron `utilityProcess` or a child Node process) | It isolates main-process crashes, but the engine already does no heavy work in Node. Containers do. It adds an IPC protocol and lifecycle management. Revisit if PERF-1 shows the orchestration blocking the main process. |
| **Leave the flat structure and re-add orchestration in the renderer**            | This repeats the failure that lost the grading rules in #136, keeps privileged decisions in the UI (W1), and cannot run headless.                                                                                          |

## Consequences and trade-offs

- ✅ One build, one install, one debugger session. Refactoring across modules is cheap.
- ✅ The module boundary is the SaaS seam: a future worker imports the same engine and supplies different adapters ([03 §10](../03-target-architecture.md#10-deployment-views-desktop-now-saas-later)).
- ⚠️ A bug that blocks the event loop in the engine freezes the main process, and with it the UI. Mitigation: all I/O is async. Synchronous `better-sqlite3` calls are short and bounded.
- ⚠️ Boundaries are enforced by lint rules and review, not by the runtime. Erosion is possible if the lint rules are disabled.
