---
name: debug-failure
description: Find the root cause of a bug, a failing test, or a crash before you change code. Reproduce, trace, hypothesize, verify, then fix.
when_to_use: The user reports a bug, an error message, a failing test, or behavior that does not match what they expect.
---

# Debug a failure

Goal: one fix at the root cause, with proof that it works.

## Steps

1. Call `updatePlan` with: reproduce, trace, hypothesize, fix, verify.
2. Reproduce. Run the failing command or test with `runCommand`. Copy the exact error text and stack trace. If you cannot reproduce, say so and ask for the steps.
3. Trace. `fileGrep` the error text or the function in the stack trace. Read the frames from the top of the trace down to project code. Read the code around the failing line and the values it depends on.
4. Hypothesize. Write one sentence: "X fails because Y." Name the line.
5. Verify the hypothesis against the code before you edit. Read the callers and check that the bad value can arrive there. If the code disagrees, form a new hypothesis. Do not patch symptoms.
6. Fix. Propose the smallest `updateFile` that removes the cause. Add a test that fails without the fix when the project has a test suite.
7. Verify. After approval, run the failing command again. Then run the full test command. Report both results as they are.
8. Mark plan steps `done` as they pass. Mark `verified` after the full suite is green.

## Rules

- One hypothesis at a time. Do not try three fixes in one turn.
- A failed attempt is data. State what it ruled out before you try the next one.
- Never silence an error to make a test pass.
- If the fix touches shared code, follow the safe-refactor skill for the callers.
