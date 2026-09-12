# AGENTS.md — Smileu Multi-Agent Autonomous Harness

This document governs autonomous AI agents (Codex, Claude Code, Cursor, Antigravity, Windsurf, Aider) operating on this codebase.

---

## 🤖 Agent Personas & Swarm Roles

1. **Lead Architect (`@architect`)**
   - **Responsibility:** System topology, interface definitions, schemas, and `ADR` management.
   - **Rule:** Never jump to coding before checking `PRODUCT.md` and verifying graph dependencies.
2. **Feature Engineer (`@engineer`)**
   - **Responsibility:** Implements pure logic, data transformations, CLI handlers, and UI components.
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

## ⚡ The Smileu 6-Phase Execution Harness

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

## 🛠️ CLI Tool Invocation

Agents have direct access to these CLI commands:

- `smileu init [editor]` — Provision skills and configuration files for an editor.
- `smileu graph` — Run the codebase knowledge graph generator.
- `smileu audit` — Run cybersecurity and OWASP compliance scans.
- `smileu craft` — Run design craft and anti-slop audit.
- `smileu humanize` — Scan documentation for synthetic AI patterns.
- `smileu run-all` — Execute the entire 6-Phase Pipeline end-to-end.
- `smileu doctor` — Check environment runtimes (Node, Git, Python, uv, Graphify).
- `smileu setup-tools` — Automatically install and configure missing external engines.

---

## 🌐 Language Policy (Strictly English)

- **International Standard:** All source code (variables, functions, types, classes), code comments, docstrings, and configuration files must be written in standard English.
- **Documentation & Artifacts:** All repository documentation (`README.md`, `CHANGELOG.md`, `ARCHITECTURE.md`, `ADRs`), Git commit messages, release notes, CLI tool outputs, generated templates, and user-facing CLI messages must be exclusively in English.
- **Internal Maintenance Note:** Internal chat communications between the AI assistant and the repository owner may use Bahasa Indonesia during local pairing sessions.


---

## 🚫 Non-Negotiable Invariants

- **No Secrets in Repositories:** Never write API keys, tokens, or credentials into tracked files.
- **No Hallucinated Edges:** In architectural mappings, only report verified static or dynamic calls.
- **Safe Fallbacks:** Any tool invocation must fail gracefully and provide clear remediation steps.

