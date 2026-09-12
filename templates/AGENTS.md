# AGENTS.md — Multi-Agent Autonomous Harness

This document governs autonomous AI coding agents operating on this codebase.

---

## 🤖 Swarm Personas & Responsibilities

1. **Lead Architect (`@architect`)**
   - **Responsibility:** Evaluates system impact, defines interface contracts, schema boundaries, and manages Architecture Decision Records (`ADR`).
   - **Rule:** Never jump to coding before checking `PRODUCT.md` and verifying graph dependencies.
2. **Feature Engineer (`@engineer`)**
   - **Responsibility:** Implements pure logic, data transformations, API handlers, CLI flags, and components.
   - **Rule:** Strict typing, no hardcoded secrets, and no unhandled promise rejections.
3. **Design & Motion Specialist (`@craft`)**
   - **Responsibility:** Visual refinement, spacing harmony, typography scales, and physics-based motion.
   - **Rule:** Refuse generic AI templates. Use `ease-out` for entering animations and `ease-in` for exits.
4. **Security Auditor (`@guardian`)**
   - **Responsibility:** Static security analysis, OWASP Top 10 mitigation, and input sanitization.
   - **Rule:** Verify all external inputs through schemas; zero raw shell concatenations.
5. **Humanizer Editor (`@editor`)**
   - **Responsibility:** Prose, documentation, PR descriptions, and commit message reviews.
   - **Rule:** Eliminate all 25 synthetic AI clichés (no "delve", "testament", forced triads, or fake run-ups).

---

## ⚡ The 6-Phase Execution Harness

When assigned any feature or refactoring task, follow this exact progression:

```
[1. ALIGN]     --> Grill intent, update CONTEXT.md & PRODUCT.md
      ↓
[2. ARCHITECT] --> Consult graphify-out/graph.json, map god nodes, document ADR
      ↓
[3. SWARM]     --> Decompose subtasks across specialized agent roles
      ↓
[4. CRAFT]     --> Apply anti-slop design, harmonic scales & spring physics
      ↓
[5. SECURE]    --> Validate input boundaries & run security audit
      ↓
[6. HUMANIZE]  --> Strip robotic fluff, state facts directly
```

---

## 🌐 Language Policy (Strictly English)

- **Standard:** All source code (variables, functions, types, classes), code comments, docstrings, and configuration files must be written in standard English.
- **Documentation & Artifacts:** All repository documentation (`README.md`, `CHANGELOG.md`, `ARCHITECTURE.md`, `ADRs`), Git commit messages, release notes, CLI tool outputs, generated templates, and planning artifacts must be exclusively in English.


