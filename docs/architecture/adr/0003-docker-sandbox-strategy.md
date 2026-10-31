# ADR-0003: Docker compilation and execution strategy

- **Status:** Proposed
- **Date:** 2026-10-31
- **Related:** [04 §2](../04-grading-workflow.md#2-lifecycle), [06 §4](../06-security.md#4-security-controls), W3–W6, W9–W11, PERF-1, PERF-3

## Context

Docker is the only supported compilation and execution infrastructure (NFR-2); the local `g++` path was removed in #137. Today:

- `dockerCompile()` and `dockerExecute()` use `docker run --rm` through the CLI.
- They mount host directories the user chose (W3).
- They write program output to host bind mounts (W5).
- They cannot see OOM kills, because `--rm` deletes the container first (W11).
- They pull the image inside the compile timer (W10).
- They leak temp directories until the process exits (W9).

Questions to settle:

1. How to talk to Docker.
2. How many containers to use.
3. How to manage container lifecycle.
4. How to handle the image.

## Decision

1. **Use the `docker` CLI through `child_process.spawn` with argument arrays**, in a single internal module (`dockerCli`). This keeps the working cross-platform approach and adds no dependency.
2. **Compile once per submission** in one container, and **run one fresh container per test case**, using the same image for both (avoids libstdc++ ABI mismatches).
3. **Explicit lifecycle** instead of `--rm`: `docker create` (labelled) → `docker start -a [-i]` → `docker inspect` → `docker rm -f` in `finally`. `docker kill` runs on timeout or abort.
4. **Mount only per-run workspace copies.** Sources are read-only. The build directory is read-write for compile and read-only for tests. Test scratch space is `tmpfs`, not a host mount.
5. **Prepare the image before any timer starts** (`docker image inspect`, then `docker pull` if missing). **Pin the image by digest** once open decision D6 is resolved. Until then, record the resolved digest per run (`grading_runs.image_digest`).
6. All hardening flags are generated in one place, `sandboxPolicy` ([06 §4.1](../06-security.md#41-container-flags)).

## Alternatives considered

| Alternative                                                                                        | Why rejected / deferred                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`dockerode`** (Docker Engine API over the socket)                                                | Structured responses and streaming, but it adds a dependency and must locate the socket or named pipe per platform (Docker Desktop contexts, rootless). The CLI resolves contexts for us. Revisit if CLI parsing becomes fragile.                                                                  |
| **One container per submission running all tests** (an in-container harness loops over the inputs) | Faster: one container start instead of N. But per-test limits and verdicts need a trusted harness _inside_ the untrusted container, and state can leak between tests (files in `/work`, `/tmp`). Kept as a **performance fallback** if PERF-1 shows per-test start-up dominates on Docker Desktop. |
| **Long-lived warm container + `docker exec` per test**                                             | Same leakage problem; also needs pids/memory accounting per exec.                                                                                                                                                                                                                                  |
| **Keep `docker run --rm`**                                                                         | Cannot read `OOMKilled`; cleanup relies on the daemon; no way to sweep orphans by label after a crash.                                                                                                                                                                                             |
| **Separate slim runtime image** (for example `debian:bookworm-slim`) for tests                     | Smaller attack surface, but binaries built by `gcc:14` may need a newer `libstdc++` than the runtime image provides. Possible later with `-static-libstdc++`. Not worth the risk now.                                                                                                              |
| **Local `g++`**                                                                                    | Removed deliberately in #137; contradicts NFR-2.                                                                                                                                                                                                                                                   |

## Consequences and trade-offs

- ✅ Precise verdicts (OOM vs crash vs timeout); deterministic cleanup; orphan recovery by label.
- ✅ No host directories chosen by users or the renderer are ever mounted.
- ⚠️ **Container start-up overhead per test case** (likely hundreds of milliseconds on Docker Desktop; unmeasured). A suite of 20 tests may spend more time in start-up than in the program. Measured in P4 (PERF-1). Mitigation: bounded concurrency across submissions ([ADR-0005](0005-orchestration-and-concurrency.md)), with the harness alternative above kept in reserve.
- ⚠️ Four CLI calls per container instead of one. Each is a process spawn. This is acceptable relative to container start-up.
- ⚠️ The first-run image pull (about 1.4 GB for `gcc:14`) is now visible as a separate "preparing" step. The UI must show it.
- ⚠️ Existing tests that assert exact `docker run` argument arrays must be rewritten (P3a/P3b).
