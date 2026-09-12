# Security Policy & Defensive Model: Smileu Code Skill

Security is a foundational pillar of the Smileu Code Skill framework. This document outlines vulnerability reporting, defensive boundaries, and our security gates.

---

## 1. Supported Versions

| Version | Supported |
|---|---|
| 1.0.x | Yes |

---

## 2. Defensive Model & Guardrails

Smileu enforces strict defensive coding standards across all AI coding operations:

1. **Zero Hardcoded Secrets:**
   - No API keys, JWT secrets, or tokens in source code.
   - Built-in static secret detection flags potential leaks before commits.
2. **Safe Code Execution:**
   - No usage of `eval()`.
   - Command executions sanitize arguments and avoid shell interpolation where possible.
3. **Safe File Operations:**
   - Path resolution uses strict bounds to prevent path traversal (`../`) attacks outside the workspace directory.
   - User template files (`PRODUCT.md`, `CONTEXT.md`) are never overwritten silently.
4. **Dependency Auditing:**
   - Automated checks against known vulnerabilities in dependencies via `npm audit`.

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability within Smileu Code Skill, please do not open a public GitHub issue. Instead, report it directly:

- **Email:** security@smileu.dev
- **Response SLA:** Within 48 hours with an initial assessment.
