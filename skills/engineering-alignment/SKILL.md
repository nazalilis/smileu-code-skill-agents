---
name: engineering-alignment
description: "Grilling sessions, ubiquitous domain language (CONTEXT.md), architecture decision records (ADR), and pre-coding alignment from Matt Pocock's skills framework."
---

# Engineering Alignment Skill

Inspired by `mattpocock/skills`.

Real engineering fails most often from miscommunication rather than typing mistakes. This skill provides tools to align with developers, establish a shared vocabulary, and document critical decisions before jumping into code.

## 1. The Grilling Session (`/grill-me` & `/grill-with-docs`)

Before touching the codebase on any ambiguous or multi-step task:
1. **Never Assume:** Stop and question vague instructions.
2. **Targeted Questions:** Ask 2-4 concrete, structured questions regarding:
   - Data constraints and nullable values.
   - User interaction and error scenarios.
   - External dependencies and performance thresholds.
3. **Draft-Then-Confirm:** Present the proposed API or flow in minimal pseudo-code and ask: *"Does this match your vision?"*

## 2. Ubiquitous Domain Language (`CONTEXT.md`)

When working on a project, maintain a project-level `CONTEXT.md` to avoid explaining the same concepts repeatedly.

### Structure of `CONTEXT.md`:
```markdown
# Domain Context & Dictionary

## Core Terms
- **[Domain Term 1]**: Concise definition in 1-2 sentences. What it IS and what it is NOT.
- **[Domain Term 2]**: Concise definition.

## Invariant Rules
- Rule 1: e.g. A user cannot complete checkout without a verified email.
- Rule 2: e.g. Timestamps must always be UTC ISO-8601.

## Historical Decisions
- Why we chose X over Y.
```

**Rule:** Always prefer domain terms over generic conversational terms (e.g. use "Materialization Cascade" rather than "When a sub-lesson gets created in the folder tree").

## 3. Architecture Decision Records (`ADRs`)

For any choice that is difficult to reverse:
- Create `docs/adr/XXXX-title.md`
- Sections:
  1. **Context**: What problem are we solving?
  2. **Decision**: What choice are we making?
  3. **Consequences**: What are the positive, negative, and neutral tradeoffs?

## 4. Triage & Ticket Management
- Every issue should be classified with intent: `bug`, `feature`, `chore`, `debt`.
- Root cause must be identified before applying patches.
