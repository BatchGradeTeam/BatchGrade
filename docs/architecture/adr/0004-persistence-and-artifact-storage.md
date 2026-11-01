# ADR-0004: Persistence and artifact storage

- **Status:** Proposed
- **Date:** 2026-10-31
- **Related:** [05](../05-data-model.md), NFR-3, REL-5, REL-7, FR-16, W20–W25

## Context

SQLite with Drizzle is the desktop persistence layer and stays (NFR-3). The current schema has overlapping models:

- two assignment tables (W20)
- two submission representations (W21)
- a gradebook writer that fabricates rows and a reader that loses data (W22)
- a broken foreign key (W23)
- inconsistent migration metadata (W24)
- no grading history (W25)

Grading produces two very different kinds of data:

- small, queryable facts: status, scores, verdicts
- large or binary-ish blobs: source trees, compiler logs, program output

## Decision

1. **SQLite holds metadata and excerpts.** New tables: `submission_snapshots`, `submission_files`, `grading_batches`, `grading_runs`, `compilation_results`, `test_results`. `instructor_assignments` and `assignment_test_cases` are kept and extended ([05 §3](../05-data-model.md#3-target-model)).
2. **The filesystem artifact store holds blobs**: source snapshots, frozen test suites (content-addressed), and full output beyond the excerpt. Paths in SQLite are relative to an injected artifact root. Compiled binaries are **not** stored.
3. **History is append-only.** Every grading attempt is a new `grading_runs` row with a frozen policy, suite hash and image reference. The gradebook "grade" is a derived read model (latest completed run, pending open decision D4).
4. **Consolidation follows expand → migrate → contract** ([05 §9](../05-data-model.md#9-migration-strategy)), preceded by a repair of the migration metadata (P5a). Legacy rows are not converted, because they lack the data needed to convert them honestly.
5. **Repositories receive the Drizzle instance as a parameter** instead of calling the module singleton `getDb()`. This allows a headless `openDatabase(path, migrationsFolder)`.

## Alternatives considered

| Alternative                                                                                                         | Why rejected                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Everything in SQLite** (source files and outputs as BLOB/TEXT, like today's `submissions.file_content` in base64) | Bloats the database, makes copying into workspaces awkward, and base64 adds about 33 %. Keeping blobs on the filesystem matches how they are consumed (copied, mounted, streamed). |
| **Everything on the filesystem** (JSON manifests only, like `submitCppSubmission`)                                  | No queries, no transactions, no gradebook joins.                                                                                                                                   |
| **Mutable "current grade" table updated in place**                                                                  | Loses history and reproducibility (FR-16, REL-7).                                                                                                                                  |
| **Convert legacy `grades` into synthetic runs**                                                                     | Would invent per-test data and student IDs that do not exist.                                                                                                                      |
| **Rename `instructor_assignments` → `assignments` during consolidation**                                            | The name `assignments` is held by the legacy table until P8. A rename touches every assignment query. Deferred (D10).                                                              |

## Consequences and trade-offs

- ✅ The gradebook reports correct passed/total counts and real student references.
- ✅ Any run can be explained and re-executed from recorded hashes and policy.
- ⚠️ Two stores must stay consistent. Rules: write files first and the row second; on a row failure, delete the files. A startup sweep may find orphan artifact directories, which are harmless and removable.
- ⚠️ Disk use grows with history. The retention policy is open decision D5.
- ⚠️ The gradebook read path temporarily merges legacy rows and new runs (P5b–P8).
