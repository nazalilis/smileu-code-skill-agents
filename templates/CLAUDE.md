# Claude Code Guidelines: Smileu Code Skill

This project is governed by the **Smileu Code Skill** engineering, design, and security principles.

## Skills and commands:
- Skills are in `.claude/skills/` and subagent personas in `.claude/agents/`.
- Type `/smileu` to see the phases, or `/smileu <phase>` to run one (for example `/smileu secure`).
- Read `PRODUCT.md`, `CONTEXT.md` and `DESIGN.md` before larger changes.
- Agent roles and the six phases, shared with other editors:

@AGENTS.md

## Core Rules:
1. **Grilling & Alignment:** Clarify ambiguous requirements first. Ask direct questions before making architectural modifications.
2. **Domain Model:** Respect terms and invariant rules defined in `CONTEXT.md`.
3. **Frontend Craft:** Reject generic AI templates. Apply strict typography scales, proper contrast, and physics-based motion (`ease-out` on enter, `ease-in` on exit).
4. **Security Hardening:** Enforce OWASP Top 10 defenses. Never leak secrets or detailed error traces to clients.
5. **No AI Clichés:** Keep explanations, commit messages, and documentation free of synthetic fluff ("delve", "testament", "pivotal", forced triads).
6. **Language Policy:** All source code, docstrings, Git commits, PRs, CLI outputs, templates, and repository documentation MUST be written in standard English.

