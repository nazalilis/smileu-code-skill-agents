# ADR 0001: Unified Vibe Coding Harness Architecture

## Status
**Accepted** (2026-09-11)

## Context
Developers building software with modern agentic AI tools (Cursor, Claude Code, Antigravity, Windsurf) face significant fragmentation:
1. **Engineering Alignment:** Without strict upfront alignment (grilling sessions, ubiquitous domain dictionary, ADRs), agents jump immediately to premature, brittle implementations.
2. **Architecture Blindness:** Agents lack global topological awareness, frequently modifying God Nodes without understanding dependency graphs.
3. **Design Slop:** Default generative UI patterns produce generic, repetitive aesthetics (purple gradient borders, nested cards, unnatural animations).
4. **Security Vulnerabilities:** Speed-focused vibe coding often introduces secret leaks, unvalidated input boundaries, and OWASP Top 10 vulnerabilities.
5. **Synthetic Prose:** Automated commits and documentation are filled with robotic phrases, synthetic filler words, and formulaic triads.

Individually managing separate tools for each problem creates excessive configuration overhead.

## Decision
We establish **Smileu Code Skill** (`smileu-code-skill`), a consolidated meta-skill and cross-platform CLI runnable directly via `npx`.

The architecture synthesizes 8 foundational engines:
- **Matt Pocock Skills:** Pre-coding alignment, grilling interviews, ubiquitous domain dictionary (`CONTEXT.md`), and Architecture Decision Records (`ADR`).
- **Graphify:** Codebase AST knowledge graph generation, God Node identification, and GraphRAG querying.
- **Taste Skill (Leonxlnx):** Anti-slop frontend aesthetics, harmonic 4px/8px scales, and disciplined palettes.
- **Ruflo (Ruvnet):** Multi-agent swarm orchestration, SPARC development methodology, and role decomposition.
- **Emil Kowalski Skills:** UI motion physics, natural easing curves (ease-out for entry, ease-in for exit), and spring dynamics.
- **Impeccable (Pbakaus):** Durable product truth (`PRODUCT.md`), design system specification (`DESIGN.md`), and 23 precision design craft commands.
- **Humanizer (Blader):** Elimination of 25 synthetic AI clichés to ensure natural, engineer-to-engineer communication.
- **Anthropic Cybersecurity Skills:** 800+ security skills, OWASP Top 10 mitigation, and boundary defense.

## The 6-Phase Pipeline
Every task follows this immutable progression:
```
[1. ALIGN]     --> Verify intent, update CONTEXT.md & PRODUCT.md
      ↓
[2. ARCHITECT] --> Consult graph.json, map god nodes, document ADR
      ↓
[3. SWARM]     --> Decompose subtasks across specialized agent personas
      ↓
[4. CRAFT]     --> Apply anti-slop design, harmonic scales & spring physics
      ↓
[5. SECURE]    --> Validate input boundaries & run security audit
      ↓
[6. HUMANIZE]  --> Strip robotic fluff, state facts directly
```

## Consequences
- **Positive:** Single-command installation (`npx smileu-code-skill init`) configures any workspace for all major editors (Cursor, Claude, Antigravity, Windsurf).
- **Positive:** Built-in terminal CLI provides immediate access to all tools (`smileu audit`, `smileu craft`, `smileu graph`, `smileu swarm`, `smileu motion`, `smileu humanize`).
- **Positive:** Zero external runtime dependencies required for the core CLI. Safe fallbacks ensure graceful degradation if optional tools like Graphify or Python are unavailable.
- **Trade-off:** High skill volume (800+ cybersecurity skills) requires intelligent cataloging so editors remain responsive. Core meta-skills are prioritized by default.
