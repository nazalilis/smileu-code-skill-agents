---
name: agent-orchestration
description: "Multi-agent swarm coordination, task decomposition, SPARC workflows, and autonomous execution harnesses inspired by ruvnet/ruflo."
---

# Agent Orchestration & Swarm Skill

Inspired by `ruvnet/ruflo` (Claude-Flow).

Orchestrate complex coding tasks by decomposing work across specialized agent personas, establishing quality gates, and persisting structured memory.

## 1. Agent Swarm Archetypes

1. **The Lead Architect:**
   - Evaluates system impact, sets interface contracts, drafts schemas, and coordinates sub-tasks.
2. **The Feature Engineer:**
   - Implements business logic, API handlers, UI components, and state transforms according to the Architect's specification.
3. **The Quality Reviewer:**
   - Writes unit, integration, and property-based tests. Verifies edge cases, null checks, and error pathways.
4. **The Security Guardian:**
   - Scans code for vulnerability patterns, improper sanitization, and secret leaks.

## 2. The 5-Phase SPARC Methodology

Whenever tackling a non-trivial feature, execute in 5 distinct phases:

1. **S - Specification:**
   Write down exact requirements, input formats, output expectations, and error boundaries.
2. **P - Pseudocode:**
   Outline algorithms and data flows in clean, human-readable pseudocode before writing framework syntax.
3. **A - Architecture:**
   Identify module dependencies, file paths, database schemas, and shared utilities.
4. **R - Refinement:**
   Implement code incrementally. Run linting and static analysis after every atomic change.
5. **C - Completion & Verification:**
   Execute tests, verify build artifacts, and document user-facing notes.

## 3. Feedback & Learning Loops

- **Record Mistakes:** When a bug or build failure occurs, document the root cause and the fix in `.agents/learnings.md` or the session memory.
- **Fail Fast:** If a subagent encounters a blocker, it must halt and report immediately rather than hallucinating a workaround.
- **Context Compaction:** Only share relevant interfaces and contracts with child agents, keeping prompt context lean.
