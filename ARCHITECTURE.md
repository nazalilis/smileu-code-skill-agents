# Architecture: Smileu Code Skill

This document details the system design, directory topology, and component interactions of **Smileu Code Skill**.

---

## 1. High-Level System Architecture

```
User Terminal (npx smileu-code-skill)
       │
       ▼
[ bin/cli.js ] ─── (Executable Entry Point)
       │
       ▼
[ src/cli.js ] ─── (Command Dispatcher & Argument Parser)
       │
       ├───► [ src/installer.js ] ────► Copies skills to .agent/, .cursor/, .claude/
       │
       ├───► [ src/tools/doctor.js ] ─► Checks runtimes (Node, Git, Python, uv, Graphify)
       │
       ├───► [ src/tools/graphify.js ]► Native Graphify or Built-in JS dependency graph
       │
       ├───► [ src/tools/security.js ]► OWASP & static secret scanner (SECURITY_AUDIT.md)
       │
       ├───► [ src/tools/humanizer.js]► 25 AI cliché scanner (HUMANIZER_AUDIT.md)
       │
       ├───► [ src/tools/design.js ] ─► Impeccable & anti-slop audit (DESIGN_AUDIT.md)
       │
       └───► [ src/tools/pipeline.js ]► 6-Phase Master Pipeline Orchestrator
```

---

## 2. Directory Layout & Module Roles

- **`bin/cli.js`**: Lightweight Node.js executable wrapper containing shebang `#!/usr/bin/env node`.
- **`src/config.js`**: Data repository storing skill definitions, upstream repo references, and editor target paths.
- **`src/installer.js`**: Core distribution engine that safely provisions skill files and templates across project folders.
- **`src/ui.js`**: Terminal logging, colorization, and ASCII banner renderer with zero-dependency fallback.
- **`src/tools/`**:
  - `doctor.js`: Environment runtime diagnostics and automated installation of external tools.
  - `graphify.js`: Executes knowledge graph generation via native Graphify engine (using `uv tool`) or pure JS AST fallback.
  - `security.js`: Static AST security checks and OWASP compliance auditing.
  - `humanizer.js`: Natural language scanner targeting synthetic AI phrases.
  - `design.js`: CSS and markup anti-slop design checks.
  - `pipeline.js`: Full-pipeline runner orchestrating all 6 phases.
- **`skills/`**: The master skill and component skill markdown definitions.
- **`templates/`**: Project governance templates (`PRODUCT.md`, `CONTEXT.md`, `DESIGN.md`, `.cursorrules`, `CLAUDE.md`).

---

## 3. Resilience & Zero-Dependency Fallbacks

1. **No External Runtime Requirement:** While Graphify benefits from Python/uv, Smileu features an embedded JavaScript dependency analyzer so users without Python can still map codebase relationships.
2. **Graceful Color Fallbacks:** If `picocolors` is missing, `src/ui.js` automatically falls back to uncolored plain text rather than crashing.
3. **Cross-Platform Compatibility:** All path handling uses `node:path` and handles Windows backslashes (`\`) and POSIX slashes (`/`) transparently.
