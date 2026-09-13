---
name: smileu
description: Run a Smileu Code Skill phase in this project (align, graph, swarm, craft, polish, secure, humanize, motion, all, update, doctor). Use when the user types /smileu with or without a phase, or asks to run a Smileu check, scan or report.
argument-hint: "[align | graph | swarm <task> | craft | polish | secure | humanize | motion [preset] | all | update | doctor]"
---

# /smileu

Requested phase: $ARGUMENTS

If the line above is empty or still shows a placeholder, take the phase from the user's message, for example `/smileu secure`. If the message names no phase, show the table under "Phases" and ask which one to run.

## Running the Smileu CLI

Run every command from the project root.

1. Run `smileu --version`. If it prints a version, use `smileu <command>`.
2. Otherwise use `npx --yes smileu-code-skill <command>`. It needs Node.js 18 or later, and network access the first time.

Commands write their reports to `.smileu/reports/` and task plans to `.smileu/tasks/`. After a command finishes, open the report it names and work from the report, not from the one-line terminal summary. Never copy secret values from a report into chat, code or commit messages.

## Phases

| Phase | CLI command | Result |
|---|---|---|
| `align` | none (done in chat) | Clarified requirements, updated `PRODUCT.md` and `CONTEXT.md` |
| `graph` | `graph` | `.smileu/graph/` with files and their imports |
| `swarm <task>` | `swarm "<task>"` | A five-role checklist in `.smileu/tasks/`, then the work itself |
| `craft` | `craft` | Design findings fixed in the UI code |
| `polish` | `craft` | A final pass on spacing, type, contrast and motion |
| `secure` (or `audit`) | `audit` | Security findings fixed |
| `humanize` | `humanize` | Stock AI phrasing removed from Markdown |
| `motion [preset]` | `motion [preset]` | Easing values applied to animations |
| `all` (or `pipeline`) | `run-all` | Every check run, then each report worked through in order |
| `update` | `update` | Installed skills refreshed |
| `doctor` | `doctor` | A list of available and missing tools |

## align

1. Read `PRODUCT.md`, `CONTEXT.md` and `DESIGN.md` if they exist.
2. Ask two or three short, specific questions about whatever is still unclear: users, business rules, edge cases, failure behaviour. Wait for the answers.
3. Update `PRODUCT.md` (audience, purpose, constraints) and `CONTEXT.md` (domain terms and rules that must never be broken). Keep what the user already wrote.

Do not run the `grill` CLI command from here. It asks its questions on standard input, which an agent session cannot answer.

## graph

1. Run the `graph` command.
2. Read `.smileu/graph/GRAPH_REPORT.md`. If `.smileu/graph/graphify-out/` exists, the native Graphify engine produced it; read its report too.
3. Summarise the files with the most imports and point out which ones the current task would touch. Suggest splitting a file before adding more responsibilities to it.

## swarm

1. The task is the text after `swarm`. If there is none, ask for it.
2. Run `swarm "<task>"` and open the newest `.smileu/tasks/task-*.md`.
3. Work through the checklist in order. Where the editor supports subagents, hand each section to the matching persona: `architect`, `engineer`, `craft`, `guardian`, `editor`. Otherwise follow each section yourself.
4. Tick items off in the task file as they are done.

## craft and polish

1. Run `craft` and read `.smileu/reports/DESIGN_AUDIT.md`.
2. Fix each finding in the file it names. Follow the `frontend-taste` and `motion-physics` skills.
3. For `polish`, also review spacing rhythm, type scale, contrast and interaction feedback in the files changed for the current task, following the `design-craft-impeccable` skill.
4. Run `craft` again and repeat until it reports no findings.

## secure

1. Run `audit`. Exit code 1 means at least one critical or high finding.
2. Read `.smileu/reports/SECURITY_AUDIT.md`.
3. For each finding: move hardcoded secrets into environment variables and tell the user to rotate them; replace `eval()` and `new Function()`; pass command arguments as arrays instead of building shell strings; upgrade vulnerable dependencies reported by npm audit. Follow the `cybersecurity-hardening` skill.
4. Run `audit` again until it exits 0. Report anything that cannot be fixed in code, such as a leaked credential that must be rotated.

## humanize

1. Run `humanize` and read `.smileu/reports/HUMANIZER_AUDIT.md`.
2. Rewrite each listed line so it states the point plainly, following the `humanizer-writing` skill. Do not change facts, code blocks or links.
3. Run `humanize` again until it reports no matches.

## motion

Run `motion` with the preset the user named (`enter`, `exit`, `hover` or `modal`), or without one to print all of them. Apply the CSS, Tailwind or Framer Motion values to the components in question.

## all

1. Run `run-all`.
2. Work through the results in this order: `align`, `graph`, `craft`, `secure`, `humanize`, using the steps above.
3. Finish with a short summary of what was fixed and what still needs a decision from the user.

## update and doctor

Run the command and report its output. If `update` says skills were found in an old location, suggest `update --remove-old-layout`.
