
<div align="center">

# BatchGrade V2

A local-first desktop application for programming assignments.

[![Status](https://img.shields.io/badge/Status-Early_Development-D97706?style=flat-square)](#status)
[![Platforms](https://img.shields.io/badge/Target-Windows_%7C_macOS_%7C_Linux-334155?style=flat-square)](#status)

<br>

![Tauri](https://img.shields.io/badge/Tauri-24C8DB?style=flat-square&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-111827?style=flat-square&logo=rust&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat-square&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

<br>

[About](#about) · [Planned Features](#planned-features) · [Development](#development) · [Status](#status)

</div>

---

## About

BatchGrade V2 is a desktop application designed for educators to grade programming assignments and students to test their programs. It uses predefined test cases with specified inputs and expected outputs to evaluate program correctness.

The project focuses on local execution, consistent results, and a straightforward grading process without relying on a hosted service.

It is a modernization of the [original BatchGrade](https://github.com/BatchGradeTeam/BatchGrade).

## Planned Features

- **Educators:** Import submissions, run tests, review results, and record grades.
- **Students:** Run their programs against tests and inspect the results.
- **Local execution:** Use consistent environments for compiling and running code.
- **Cross-platform:** Target Windows, macOS, and Linux.

## Development

Install the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/), [Node.js](https://nodejs.org/), and [pnpm](https://pnpm.io/installation/).

```bash
pnpm install
pnpm tauri dev
```
