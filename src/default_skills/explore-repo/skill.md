---
name: explore-repo
description: Map an unfamiliar codebase before you change it. Find entry points, modules, and the flow that matters for the task.
when_to_use: The task touches code you have not read yet, or the user asks how something works.
---

# Explore a repo

Goal: know enough to act. Do not read the whole repo.

## Steps

1. Read the project map in the system prompt. Note the toolchain and the rules file.
2. Call `updatePlan` with the steps below. Mark the first one `in_progress`.
3. Find the entry point for the task. Use `fileGrep` on the feature name, route, command, or error text. Add a `glob` to cut noise.
4. Read the file that owns the entry point. Note what it imports and what calls it.
5. Follow the chain one hop at a time. Read callers and callees that the task will touch. Stop when a hop does not affect the task.
6. Write the flow as a short list: trigger, handler, decisions, side effects, output.
7. Name the risks: shared state, implicit behavior, missing tests.
8. Mark the plan step `done`. Report the flow and the risks, then start the change.

## Rules

- Batch independent `readFile` calls in one response.
- Prefer `fileGrep` over `listDirectory` to find code by meaning.
- If a search returns nothing, try one different term, then move on.
- Cite code as `path:line`.
