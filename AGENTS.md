THIS AGENTS.MD IS HOW ANY AI SHOULD BEHAVE AND DO DEVELOPMENTS

## Communication Standard — ASD-STE100

All AI-generated text (chat, reports, code comments, documentation, explanations) must obey ASD-STE100 Simplified Technical English rules:

- **Approved words only.** Use the STE100 approved-word list. Do not use synonyms — one word has one meaning (e.g., use "start" not "commence", "show" not "display" unless "display" is the approved verb).
- **IT and computer jargon is permitted.** Technical terms not in the STE100 word list (e.g., "database", "endpoint", "middleware", "trait", "Blade", "PHPUnit", "refactor", "deployment") are allowed and treated as approved nouns/verbs within their domain.
- **Maximum 20 words per sentence.** Break long sentences into two or more.
- **One topic per sentence.** Do not combine unrelated ideas.
- **Active voice only.** Do not use passive voice (e.g., write "the function returns a value" not "a value is returned by the function").
- **Imperative mood for instructions and procedures.** (e.g., "Write the test" not "You should write the test".)
- **Present tense for facts and descriptions.** Do not use past tense for procedures.
- **Articles before nouns.** Use "the", "a", or "an" before nouns where applicable.
- **No -ing verb forms for instructions.** (e.g., "Remove the file" not "Removing the file".)
- **Short words over long words.** If two words mean the same thing, use the shorter one.
- **No hidden verbs.** (e.g., write "decide" not "make a decision", "test" not "perform a test".)
- **No redundant pairs.** (e.g., not "each and every", not "first and foremost".)

## Code Review Preferences

- **Be brutal and thorough.** Double-check code changes, especially when modifying existing patterns. Look for hidden complexity before making changes, not after. When in doubt, ask and confirm.
- **Review all connected files first.** Before planning any change, read every file that touches or depends on the code you are about to modify. Trace function calls, trait usage, blade includes, service injections, and shared state. Do not plan a change until you have read and understood the full chain of affected files.
- **Double-check all connected files after planning.** Once you have a plan, re-read the connected files to confirm the plan does not break existing calculations, return structures, side effects, or assumptions made by callers. If a connected file relies on a behavior you are about to change, flag it before proceeding.

## Test Policy

- **Golden rule:** When making tests, maintain 1:1 logic with the code being tested. The test must verify the exact behavior of the code, not an approximation.
- **Test-driven development for new modules.** When building a new module, write the tests first. The tests define the expected behavior. Then write the code to make the tests pass. The cycle is: write test, present to user for review, get approval, write code, run test, fix until passing.
- Use PHPUnit. Follow the existing test structure in `tests/Unit/` and `tests/Feature/`.
- After writing tests, present them to the user for review before running them. Do not run tests until the user approves the test code.
- Do not edit existing tests unless the user explicitly says so.
- Do not run the test suite unless the user explicitly says so.

## Git Commit Policy

- **Use conventional prefixes.** Start each commit subject with one of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`. Follow with a colon, a space, and the subject (e.g., `feat: add listDirectory tool`).
- **One logical change per commit.** Do not bundle features, refactors, and UI polish into one commit. Split them so each commit can revert on its own.
- **Write a clear subject.** Keep the subject under 60 characters. Use the imperative mood (e.g., "Add the tool" not "Added the tool"). Do not use vague subjects like "fck", "did sumthing", "checkpoint", or "lezgo".
- **Add a body for non-trivial commits.** Explain why the change is made, not just what changed. List the files or areas touched.
- **Keep messages professional.** Do not use profanity or slang in commit subjects or bodies.
- **Apply ASD-STE100 to commit messages.** The communication standard above applies to all commit text.
- **Add the Co-Authored-By trailer.** When Devin assists, append the trailer:
  ```
  Generated with [Devin](https://devin.ai)

  Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
  ```
- **Do not push or commit secrets.** Never stage `config/api_key.json` or any file with real keys.

## Explanation and Reporting

- **Always use a behavior table.** When explaining or reporting on code, logic, calculations, or comparisons, present the information in a table format with columns for the behavior, condition, and result. Do not use long paragraphs where a table communicates the same information more clearly.
- **Always include a technical explanation and a layman explanation.** Every report or explanation must have both. The technical explanation describes the code, logic, and data flow. The layman explanation describes what it means in plain language without jargon.
- **Always end with a one-sentence explanation.** At the end of both the technical section and the layman section, add exactly one sentence that summarizes the point. This sentence must stand alone and make sense without reading the rest of the section.


