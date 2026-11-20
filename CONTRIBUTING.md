# Contributing

## Guidelines

- Keep changes focused and reviewable.
- Follow existing code conventions and architectural boundaries.
- Avoid unnecessary dependencies and abstractions.
- Preserve existing behavior unless changes are intentional.
- Add or update tests for changes in behavior.
- Treat student submissions as untrusted code.
- Do not commit secrets, credentials, or personal information.

## Commit Messages

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/) with a mandatory scope.

**Format:**

```text
<type>(<scope>): <description>
```

**Allowed types:**

| Type       | Purpose                                   |
| ---------- | ----------------------------------------- |
| `feat`     | New functionality                         |
| `fix`      | Bug fixes                                 |
| `refactor` | Internal changes without behavior changes |
| `test`     | Tests                                     |
| `docs`     | Documentation                             |
| `chore`    | Maintenance and dependencies              |
| `ci`       | Continuous integration                    |
| `build`    | Build system                              |
| `perf`     | Performance improvements                  |

**Rules:**

- Use lowercase type, scope, and description.
- Use imperative descriptions.
- Keep subject lines within 72 characters.
- Do not end descriptions with punctuation.
- Reuse existing scopes when applicable.

**Examples:**

```text
feat(grading): add test case evaluation
fix(executor): handle process timeouts
test(grading): add output comparison tests
docs(readme): update project overview
chore(deps): update dependencies
```

## Issues

Before opening an issue, search existing issues to check whether someone has already reported the same problem or request. Use the matching GitHub issue template and keep each issue focused on one problem or request.

For a bug report:

- Describe what happened and how to reproduce it.
- State what you expected to happen and what happened instead.
- Include your environment details and any useful logs or screenshots.
- Focus on the problem. Do not suggest implementation fixes.

For a feature request, describe the problem, the change you would like, and any helpful context.

Remove secrets, credentials, and personal information from issues, logs, and screenshots. Report security problems privately. Do not open a public issue for them.

## Pull Requests

Before opening a pull request, check that it is focused and ready for review. If it addresses an issue, link that issue with a closing keyword, such as `Closes #123`.

In the pull request description:

- Summarize the changes and their purpose.
- List the tests and manual checks you ran. If you did not run tests, say why.
- Note any known limitations or risks.
- Complete the verification checklist in the pull request template.

Keep unrelated changes in separate pull requests.

## AI-Assisted Contributions

AI-generated code is permitted. Contributors are responsible for understanding, reviewing, and verifying all submitted changes.

Passing tests alone does not establish correctness.

## Security

Report security vulnerabilities privately rather than through public issues. Do not include sensitive data in bug reports or logs.
