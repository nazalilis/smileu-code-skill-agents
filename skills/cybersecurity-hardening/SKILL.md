---
name: cybersecurity-hardening
description: "Vulnerability analysis, OWASP Top 10 mitigation, secure coding guidelines, threat modeling, and defensive architecture from Anthropic Cybersecurity Skills."
---

# Cybersecurity Hardening Skill

Inspired by `mukul975/Anthropic-Cybersecurity-Skills`.

Ensure that code generated during vibe-coding sessions is robust, defended against common exploits, and adheres to the highest industry security benchmarks (OWASP, MITRE ATT&CK, NIST CSF).

## 1. The Core Security Gates

Before submitting or approving code, check against these 5 gates:

### Gate 1: Input Validation & Sanitization
- **Strict Typing:** All boundary inputs (HTTP requests, query parameters, CLI args, WebSockets) must be parsed through strict schemas (e.g. Zod, Yup, Pydantic).
- **Injection Defense:**
  - SQL: Never concatenate user input into raw queries. Always use parameterized queries or ORM abstractions.
  - Command: Never pass unsanitized input to `exec()`, `spawn(..., { shell: true })`, or `eval()`.
  - HTML/DOM: Sanitize user input before rendering with `DOMPurify` to prevent Cross-Site Scripting (XSS).

### Gate 2: Secrets & Credentials
- **Zero Secrets in Source:** Never hardcode API keys, passwords, JWT secrets, or private certificates.
- **Environment Isolation:** Use `.env` with strict `.gitignore` rules. Check git history for accidental secret leaks before push.
- **Client Bundles:** Never expose `process.env` server variables to client-side bundles (e.g. Next.js `NEXT_PUBLIC_` should only contain non-sensitive identifiers).

### Gate 3: Broken Access Control & Auth
- Enforce authorization checks on the server side for **every** request, never relying on client-side routing guards alone.
- Use secure HTTP-only, SameSite, and Secure flags on session cookies.

### Gate 4: Safe Error Handling
- Never leak stack traces, internal paths, or database schema information in API responses. Return generic, safe error messages to clients while logging detailed traces to internal structured logs.

### Gate 5: Dependency & Supply Chain
- Regularly run `npm audit` or equivalent dependency scanners.
- Pin versions of critical security packages.
