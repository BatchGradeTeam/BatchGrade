# ADR-0005: Grading orchestration and concurrency

- **Status:** Proposed
- **Date:** 2026-10-31
- **Related:** [04 §6.5](../04-grading-workflow.md#65-cancellation), [04 §7](../04-grading-workflow.md#7-batch-scheduling-and-bounded-concurrency), [04 §9](../04-grading-workflow.md#9-retry-and-recovery-semantics), PERF-2, REL-1–REL-6, FR-14

## Context

The historical batch flow ran in the renderer, one student at a time. It had no cancellation and no progress model beyond UI state, and it recorded infrastructure failures as score 0. Each test case costs a container start-up ([ADR-0003](0003-docker-sandbox-strategy.md)), so a strictly sequential batch on Docker Desktop may be slow. Unbounded parallelism would exhaust the Docker VM's memory: each container may use 256 MB.

## Decision

1. **Orchestration lives in the application layer.** `gradeSubmission` owns one run end to end. `startBatch` owns scheduling.
2. **Bounded concurrency with an in-process promise pool** (`runWithConcurrency`, about 20 lines, no dependency).
   - The unit of concurrency is the `GradingRun`; test cases inside a run are sequential.
   - The limit is clamped to `max(1, os.availableParallelism() - 1)`.
   - The default is open decision D1, with 2 proposed until PERF-1 data exists.
3. **Cancellation through `AbortController`.** A `runRegistry` maps run and batch IDs to controllers, and batch controllers are linked to their runs' controllers. Every port method accepts an `AbortSignal`.
4. **Failure isolation.** A run's failure never stops the batch, except for two circuit breakers: `DOCKER_UNAVAILABLE` and `PERSISTENCE_FAILED`.
5. **Retry policy.** Only `CONTAINER_START_FAILED` is retried automatically, once. A regrade is always a new run.
6. **Recovery.** On startup, runs that are not terminal become `failed/INTERRUPTED`, `running` batches become `interrupted`, and labelled containers and workspaces are swept. An Electron single-instance lock makes the sweep safe.
7. **`startBatch` returns `{ batchId, done }`**, so IPC replies immediately and headless callers can await completion.

## Alternatives considered

| Alternative                                                               | Why rejected                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strictly sequential (historical behaviour)**                            | Simplest, but likely too slow with per-test containers on Docker Desktop. Remains available as `concurrency: 1`.                                                                                                                                                                  |
| **`p-limit` / `p-queue` dependency**                                      | Correct and small, but the needed behaviour (limit, abort, FIFO) fits in about 20 lines of tested code (NFR-5).                                                                                                                                                                   |
| **Persistent job queue** (SQLite-backed jobs table, or BullMQ with Redis) | Survives restarts and supports distributed workers, but Redis is not acceptable on desktop. A jobs table plus a worker loop is the natural **SaaS** evolution (`startBatch` becomes "enqueue"), not needed now. Recovery marks interrupted work as failed instead of resuming it. |
| **Worker threads**                                                        | Grading work is in containers, not Node CPU. Threads add serialisation and complexity for no gain.                                                                                                                                                                                |
| **Parallel test cases within a submission**                               | Multiplies container concurrency by the suite size, harms per-run determinism, and makes cancellation and progress harder. Across-submission parallelism gives the same throughput more simply.                                                                                   |

## Consequences and trade-offs

- ✅ Predictable resource use: at most `concurrency` sandbox containers at once, and each is limited.
- ✅ Cancellation is prompt: one `docker kill` round-trip per active container.
- ✅ Crash recovery is simple and safe (fail, then regrade) and never resumes into an inconsistent state.
- ⚠️ Interrupted batches must be regraded manually ("retry failed runs"). Automatic resume is deliberately not offered.
- ⚠️ The right default concurrency depends on the host and Docker Desktop VM settings. It needs measurement and may need a user setting.
- ⚠️ In-memory scheduling state is lost when the app quits. The persisted run rows are the source of truth.
