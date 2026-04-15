# 2026-S-GROUP3-BatchGrade

> A desktop grading application built with Electron, React, and TypeScript.

![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)

---

BatchGrade is a locally hosted automated grading platform designed to streamline the evaluation of source code in academia. The system enables educators to batch test submissions, manage grades through an integrated database, and provide structured feedback, while students can receive immediate results to improve their work. Built with a web-based frontend, backend services, and database support, BatchGrade prioritizes affordability and institutional flexibility by allowing deployment on existing infrastructure or local machines. By reducing grading time and improving feedback quality, the project aims to increase instructional efficiency and student confidence without reliance on costly third-party software as a service (SaaS) solutions.


## Table of Contents

- [Recommended IDE Setup](#recommended-ide-setup)
- [Project Setup](#project-setup)
- [Scripts & Commands](#scripts--commands)
- [Testing (Vitest)](#testing-vitest)
- [Database + IPC Wiring Guide](#database--ipc-wiring-guide)
- [Tech Stack Documentation](#tech-stack-documentation)

---

## Recommended IDE Setup

![VSCode](https://img.shields.io/badge/VSCode-0078D4?style=for-the-badge&logo=visual-studio-code&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B3263?style=for-the-badge&logo=eslint&logoColor=white)
![Prettier](https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)

[VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Vitest](https://marketplace.visualstudio.com/items?itemName=vitest.explorer)

> **Recommended:** Install the [Vitest VSCode extension](https://marketplace.visualstudio.com/items?itemName=vitest.explorer) for an integrated test explorer, inline test results, and one-click test runs directly inside the editor.

If you do install the VSCode extension, add the following lines to your settings.json

```json
  "vitest.nodeExecutable": "node_modules/.bin/electron",
  "vitest.nodeEnv": {
    "ELECTRON_RUN_AS_NODE": "1"
  }
```

---

## Project Setup

### Requirements

- Required Node.js: >= 22
- Tested with Node.js: 22.22.0

If you encounter native build issues (for example with `better-sqlite3` or other native modules), switch to a Node.js version compatible with the Electron binary in `devDependencies` or rebuild native modules after switching versions.

### Install

If needed, install Node.js for your appropriate Operating System from here: <https://nodejs.org/en/download>

```bash
npm install
```

### Environment Variables

For development, a `.env` file must be created in the project root directory.

The required environment variables are available in the Discord server (see pinned messages).

```bash
# .env
VARIABLE_NAME=value
```

The `.env` file is included in `.gitignore` and must not be committed. **Never commit sensitive credentials or secrets to the repository.**


### Development

Starts the app in development mode with hot-reloading.

```bash
npm run dev
```

Simply close the electron window or use `ctrl + c` or `cmd + c` to end the dev app. 

### Build

Compiles and packages the app for your target platform. It will be built to the `/dist` folder. There will be an unpacked folder for the OS you built to, you can run the application using the executable there. You must be using the OS you build to for it to work properly. Windows can build to Windows, Linux to Linux, Mac to Mac.

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

---



### Where build files and executables are placed

- `dist/` - Top-level folder where `electron-builder` writes packaged artifacts.
- `dist/<platform>-unpacked/` - Platform-specific unpacked build folder (examples below):
- `dist/linux-unpacked/` - contains unpacked Linux app files and the executable for Linux.
- `dist/win-unpacked/` - contains unpacked Windows app files and the `.exe`.
- `dist/mac` or `dist/mac-unpacked/` - contains the macOS `.app` bundle.
- Packaged installers and distributables (for example `.AppImage`, `.deb`, `.dmg`, `.exe`) are placed in `dist/` after a packaging build.

Examples:

- After `npm run build:linux` you will commonly see an unpacked app at `dist/linux-unpacked/`, and one or more packaged artifacts (for example `BatchGrade-1.0.0.AppImage`) in `dist/`.
- The executable inside the unpacked folder is named after the application (package name: `batchgrade`).

Use `npm run clean` to remove `dist/`, `out/`, and `node_modules/`.

---

## Scripts & Commands

### Core

```bash
npm run dev          # Run Electron + Vite in development mode
npm run build        # Typecheck + build
npm run build:unpack # Build unpacked app
npm run build:win    # Build Windows package
npm run build:mac    # Build macOS package
npm run build:linux  # Build Linux package
npm run lint         # Lint all files
npm run format       # Prettier format
npm run clean        # Remove dist/, out/, node_modules/
```

### Vitest

```bash
npm run test       # Run tests once with coverage
npm run test:watch # Run tests in watch mode
npm run test:ui    # Open Vitest UI
```

### Drizzle / Database

```bash
npm run studio                               # Open Drizzle Studio
npx drizzle-kit generate --config=drizzle.config.ts
npx drizzle-kit migrate --config=drizzle.config.ts
```

## Testing (Vitest)

### Test files and setup

- Put tests in `tests/**/*.test.ts` (configured in `vitest.config.ts`).
- Shared setup runs from `tests/setup.ts`.
- `tests/setup.ts` mocks `src/main/database/index` with an in-memory SQLite database and runs migrations.
- `tests/globalSetup.ts` includes teardown logic for Electron test hangs.

### Add a new test

1. Create a file like `tests/<feature>.test.ts`.
2. Import the unit you want to test.
3. Use `describe`, `it`, and `expect` from Vitest.
4. If needed, clear table data in `beforeEach` so tests stay isolated.
5. Run:

```bash
npm run test
```

### Coverage output

- Terminal totals are shown in the `All files` row (Statements, Branches, Functions, Lines).
- HTML report is written to `coverage/index.html`.
- JSON summary is written to `coverage/coverage-summary.json`.

## Database + IPC Wiring Guide

This is the path for all data operations:

`schema -> query -> main ipcMain.handle -> preload api -> renderer window.api`

### 1) Add or update a schema

1. Create/update table definitions in `src/main/database/schema/<entity>.ts`.
2. Export inferred types from that schema file (`InferSelectModel`, `InferInsertModel`, etc.).
3. Re-export from `src/main/database/schema/index.ts` so imports stay consistent.
4. Generate/apply migrations:

```bash
npx drizzle-kit generate --config=drizzle.config.ts
npx drizzle-kit migrate --config=drizzle.config.ts
```

### 2) Add query functions

1. Add functions in `src/main/database/queries/<entity>.ts`.
2. Always call `getDb()` from `src/main/database/index.ts`.
3. Return shared-safe data types when crossing process boundaries.
4. Re-export from `src/main/database/queries/index.ts`.

### 3) Wire queries to main process IPC

In `src/main/index.ts`, add handlers:

```ts
ipcMain.handle('entity:getAll', () => getAllEntities())
ipcMain.handle('entity:create', (_e, data: NewEntity) => createEntity(data))
ipcMain.handle('entity:update', (_e, data: UpdateEntity) => updateEntity(data))
ipcMain.handle('entity:delete', (_e, id: string) => deleteEntity(id))
```

### 4) Expose IPC in preload

1. In `src/preload/types.ts`, define the API contract.
2. In `src/preload/index.ts`, map methods with `ipcRenderer.invoke(...)`.
3. In `src/preload/index.d.ts`, add types on `window.api`.

### 5) Use in renderer

1. In React components, call `window.api.<entity>.<method>()`.
2. Keep renderer types in sync through `src/shared/types.ts`.
3. Handle async errors in UI (`try/catch`) and refresh local state after mutations.

## Tech Stack Documentation

This document lists the project's primary technologies with links to their official documentation.

- Electron-Vite: <https://electron-vite.org/>
- Electron: <https://www.electronjs.org/>
- Vite: <https://vitejs.dev/>
- React: <https://reactjs.org/>
- TypeScript: <https://www.typescriptlang.org/>
- Tailwind CSS: <https://tailwindcss.com/>
- Drizzle (ORM): <https://orm.drizzle.team/>
- SQLite: <https://www.sqlite.org/>
- Vitest: <https://vitest.dev/>
- ESLint: <https://eslint.org/>
- Prettier: <https://prettier.io/>
