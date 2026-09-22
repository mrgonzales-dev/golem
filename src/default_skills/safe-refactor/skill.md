---
name: safe-refactor
description: Change code structure without a change in behavior. Read every caller first, edit in small steps, verify after each step.
when_to_use: The user asks to rename, move, extract, split, or clean up code that other code depends on.
---

# Safe refactor

Goal: the same behavior, a better shape, no surprise for callers.

## Steps

1. Call `updatePlan`: list the symbols to change and the files that use them.
2. `fileGrep` each symbol name. Read every file that appears. Note each call site and what it expects: arguments, return shape, side effects, thrown errors.
3. Read the tests that cover the code. If none exist, say so before you start. Offer to add one first.
4. Make one small edit per `updateFile` call. Keep each proposal to one idea: rename, then move, then extract. Do not bundle.
5. After each approved batch, run the test or lint command with `runCommand`. Stop at the first failure and fix it before the next edit.
6. Mark each plan step `done` after its verification passes. Mark it `verified` after you re-read the final code once more.
7. Report what changed, what you verified, and what you did not run.

## Rules

- Do not change public names or return shapes unless the task asks for it.
- Do not delete a comment you did not write.
- Do not rewrite a file with `writeFile` when `updateFile` can express the change.
- If a caller depends on a behavior you must change, flag it to the user before you proceed.
