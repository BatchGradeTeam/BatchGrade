# ADR-0006: Separate the grading engine from Electron

- **Status:** Proposed
- **Date:** 2026-10-31
- **Related:** [03 §9](../03-target-architecture.md#9-proposed-directory-structure), [03 §12](../03-target-architecture.md#12-dependency-injection-approach), NFR-4, TEST-6, [07 Milestone 1](../07-migration-plan.md#milestone-1--headless-c-grading)

## Context

Electron is imported by modules that hold business logic:

- `submitCppSubmission.ts` uses `app.getPath('userData')`.
- `database/index.ts` uses `app.isPackaged` and `process.resourcesPath`.
- `utils/file.ts` mixes `dialog` calls with pure path helpers.

Tests work around this with a Vitest alias that replaces `electron` with a stub (`tests/__mocks__/electron.ts`). That alias also means **tests cannot detect** a new `electron` import in engine code. The engine must run headless (NFR-4), so that it can be tested and possibly reused in a server (NFR-6).

## Decision

1. The engine lives in **`src/main/grading/`** and must not import `electron`, directly or through another module.
2. This is enforced by an **ESLint `no-restricted-imports` override** on `src/main/grading/**` that bans `electron`, `@electron-toolkit/*`, and the Electron-coupled modules `src/main/database/index` and `src/main/utils/file`. Lint already runs in CI on all three operating systems.
3. Everything that comes from Electron is **injected** by the interface layer:
   - the artifact root and database path (`app.getPath('userData')`)
   - the migrations folder (`process.resourcesPath` when packaged)
   - the progress sink (`webContents.send`)
   - single-instance coordination
4. **Proof of headlessness for Milestone 1:** an integration test constructs the engine with real Docker adapters, the filesystem artifact store and the in-memory repository, and grades a C++ fixture. It runs under `npm run test:ci`, which uses plain Node, not the Electron binary.

## Alternatives considered

| Alternative                                                                  | Why rejected / deferred                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top-level `src/core/` or a workspace package** (`packages/grading-engine`) | Clearer physical separation, but needs changes to `tsconfig.node.json` `include`, the electron-vite main build and the Vitest coverage `include` (`./src/main/**`), or a monorepo tool. Worth doing **when** a second runtime (server) actually exists. Moving a folder later is mechanical because the import rules already hold. |
| **Rely on code review**                                                      | The Vitest `electron` alias hides violations from tests. Review alone will not catch them reliably.                                                                                                                                                                                                                                |
| **Abstract Electron behind an `AppEnvironment` port**                        | The engine needs a few configuration values, not Electron behaviour. Plain injected values are simpler.                                                                                                                                                                                                                            |
| **A CLI binary for headless grading in Milestone 1**                         | Running TypeScript directly needs a new dev dependency (`tsx`) or a separate build target, and `better-sqlite3` is rebuilt for Electron's ABI. The integration test proves headlessness without either. A CLI is optional later.                                                                                                   |

## Consequences and trade-offs

- ✅ The engine is testable without Electron stubs. A server or CLI can reuse it unchanged.
- ✅ `src/main/index.ts` shrinks to bootstrap and wiring.
- ⚠️ The engine still lives physically under `src/main`, so its folder name suggests otherwise. This is documented here and in [03 §9](../03-target-architecture.md#9-proposed-directory-structure).
- ⚠️ Persistence under plain Node needs `better-sqlite3` built for Node's ABI. The headless milestone avoids that by using the in-memory repository. `test:ci` already rebuilds `better-sqlite3` for Node.
