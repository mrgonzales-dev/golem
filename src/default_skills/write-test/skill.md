---
name: write-test
description: Add a test that matches the project's framework and structure, and keeps 1:1 logic with the code under test.
when_to_use: The user asks for tests, or a change needs a failing test before the fix.
---

# Write a test

Goal: one test file that runs with the project's own command and checks the exact behavior of the code.

## Steps

1. Find the test command in the project map toolchain. If none, `fileGrep` for `test` in the manifest or Makefile.
2. Find one existing test near the code. Use `fileSearch` for `*.test.*`, `*_test.*`, or `tests/`. Read it. Copy its imports, naming, and setup style.
3. Read the code under test in full. List its inputs, outputs, branches, and error paths.
4. Write one test per branch. Use the real values the code expects. Do not test an approximation.
5. Propose the file with `writeFile`. Put it beside the existing tests.
6. Do not run the tests yet. Tell the user the test file is ready for review. Ask for approval before you run anything.
7. After approval, run the project's test command with `runCommand`. Pass `timeoutSeconds` if the suite is large.
8. Report pass/fail counts as they are. Do not edit existing tests unless the user says so.

## Rules

- Follow the project's rules file. Some projects forbid a test run without approval.
- A test that always passes is a bug. Check that the test fails when the code is wrong.
- No mocks for the unit under test. Mock only external I/O.
