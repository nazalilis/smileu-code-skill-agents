---
name: smileu-code-skill
description: "Engineering, design, security and writing guidelines for this project, organised in six phases: align, map, orchestrate, craft, secure and humanize. Use when planning or building a feature, reviewing UI, hardening code, or writing docs and commit messages."
---

# Smileu Code Skill

These guidelines combine principles from eight open-source projects:

1. **Engineering rigor** (Matt Pocock): grilling sessions, a domain dictionary (`CONTEXT.md`) and Architecture Decision Records.
2. **Codebase mapping** (Graphify): dependency structure and oversized "god" modules.
3. **Frontend taste** (Taste Skill): typography, visual restraint and hierarchy instead of generic AI templates.
4. **Design craft** (Impeccable): product truth (`PRODUCT.md`) and design system notes (`DESIGN.md`).
5. **UI motion** (Emil Kowalski): easing curves, spring dynamics and micro-interaction timing.
6. **Agent orchestration** (Ruflo): role-based task decomposition and the SPARC workflow.
7. **Plain writing** (Humanizer): no chatbot filler or stock phrasing.
8. **Security hardening** (Anthropic Cybersecurity Skills): OWASP Top 10 defenses and secret hygiene.

---

## The six phases

When building, refactoring or designing a feature, work through these phases in order:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ALIGN & CLARIFY  │ Question intent, document domain & product│
├─────────────────────┼───────────────────────────────────────────┤
│ 2. ARCHITECT & MAP  │ Read the graph, find god nodes, write ADR │
├─────────────────────┼───────────────────────────────────────────┤
│ 3. ORCHESTRATE      │ Split into tasks and roles                │
├─────────────────────┼───────────────────────────────────────────┤
│ 4. CRAFT & POLISH   │ Restrained UI, deliberate motion          │
├─────────────────────┼───────────────────────────────────────────┤
│ 5. HARDEN & SECURE  │ OWASP defenses, input validation, secrets │
├─────────────────────┼───────────────────────────────────────────┤
│ 6. HUMANIZE         │ Plain, direct prose                       │
└─────────────────────────────────────────────────────────────────┘
```

Each phase can be run on its own with `/smileu <phase>`, which the `smileu` skill provides.

---

### Phase 1: Align and clarify (`/smileu align`)
*Source: `mattpocock/skills` and `pbakaus/impeccable`*

Before writing code:
1. **Do not guess ambiguous requirements.** Ask 2 or 3 focused questions about business rules, edge cases and user expectations.
2. **Product truth (`PRODUCT.md`):** keep a short record of the audience, purpose, constraints and voice.
3. **Domain dictionary (`CONTEXT.md`):** use the agreed domain terms exactly. One precise term beats a paragraph of generic words.

---

### Phase 2: Architect and map (`/smileu graph`)
*Source: `Graphify-Labs/graphify` and `mattpocock/skills`*

1. **Understand the structure:** inspect file relationships, imports and component trees before modifying them.
2. **Watch for god nodes:** identify oversized, tightly coupled modules and avoid adding more responsibilities to them.
3. **Record non-obvious choices (ADR):** when a trade-off is hard to reverse (state management, schema changes, library choices), write an Architecture Decision Record in `docs/adr/`.

---

### Phase 3: Orchestrate and decompose (`/smileu swarm <task>`)
*Source: `ruvnet/ruflo`*

1. **Split the work into roles:**
   - **Architect:** system boundaries, interfaces, contracts.
   - **Implementer:** logic, components, APIs.
   - **Tester and reviewer:** edge cases, coverage, performance.
   - **Security reviewer:** vulnerability checks, input sanitisation.
2. **Verify each step** before building the next one on top of it.

---

### Phase 4: Craft, taste and motion (`/smileu craft`, `/smileu polish`)
*Source: `Leonxlnx/taste-skill`, `pbakaus/impeccable` and `emilkowalski/skills`*

1. **Typography and hierarchy:**
   - Do not default to Inter everywhere unless it was requested. Choose font pairings with deliberate line height and letter spacing.
   - Keep heading levels clear, and do not put a rounded icon square above every title.
2. **Colour and surface:**
   - Avoid pure `#000000` and `#ffffff` for dark and light themes. Tint neutrals with 1 to 2% of the brand hue.
   - Do not put grey text on coloured backgrounds; it fails contrast.
   - Avoid cards nested inside cards. Use spacing, borders or dividers instead.
3. **Motion:**
   - Use `ease-out` for elements entering the view.
   - Use `ease-in` for elements leaving the view.
   - Avoid bouncy or elastic easing for everyday UI. Keep micro-interactions between `150ms` and `250ms`.

---

### Phase 5: Harden and secure (`/smileu secure`)
*Source: `mukul975/Anthropic-Cybersecurity-Skills`*

1. **OWASP Top 10 by default:**
   - Validate all external input with a schema validator such as Zod or Valibot.
   - Prevent SQL injection, XSS, SSRF and prototype pollution.
2. **Secrets and credentials:**
   - Never hardcode tokens, API keys or private endpoints in client code.
   - Keep secrets in environment variables.
3. **Error handling:**
   - Fail safely. Never send stack traces, database schemas or raw error objects to the client.

---

### Phase 6: Humanize prose and docs (`/smileu humanize`)
*Source: `blader/humanizer`*

When writing explanations, commit messages, pull request descriptions and documentation:
1. **Avoid stock AI phrasing:**
   - NO "delve", "testament", "pivotal moment", "landscape", "showcasing", "in today's fast-paced world".
   - NO "Not X, but Y" staging.
   - NO forced lists of three ("speed, scalability, and security").
   - NO dramatic one-line closers.
2. **Say it plainly:** state the fact directly. If something is unknown, say so.

---

## Commands

| In the editor | In a terminal | Result |
|---|---|---|
| `/smileu align` | `npx smileu-code-skill grill` | Clarify requirements; update `PRODUCT.md` and `CONTEXT.md` |
| `/smileu graph` | `npx smileu-code-skill graph` | Map files and imports into `.smileu/graph/` |
| `/smileu swarm <task>` | `npx smileu-code-skill swarm "<task>"` | Split a task across the five core roles |
| `/smileu craft` | `npx smileu-code-skill craft` | Find and fix design anti-patterns |
| `/smileu polish` | `npx smileu-code-skill craft` | Final pass on spacing, type, contrast and motion |
| `/smileu secure` | `npx smileu-code-skill audit` | Find and fix security problems |
| `/smileu humanize` | `npx smileu-code-skill humanize` | Remove stock AI phrasing from Markdown |
| `/smileu all` | `npx smileu-code-skill run-all` | Run every phase in order |

After `npm install -g smileu-code-skill`, `smileu <command>` works in place of `npx smileu-code-skill <command>`.
