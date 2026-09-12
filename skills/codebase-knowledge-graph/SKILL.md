---
name: codebase-knowledge-graph
description: "Turn any codebase or repository into an interactive knowledge graph, detect god nodes, trace architectural dependencies, and navigate code via GraphRAG, based on Graphify."
---

# Codebase Knowledge Graph Skill

Inspired by `Graphify-Labs/graphify`.

Understand any codebase from the top down by modeling files, functions, classes, and modules as a knowledge graph with community clusters and centrality metrics.

## 1. Core Principles

1. **Topological Understanding:** Before modifying a module, know what imports it and what it depends on.
2. **Honesty Rules:**
   - Never hallucinate an edge or relationship. If unsure, mark as `AMBIGUOUS` or `INFERRED`.
   - Distinguish strictly between direct static imports (AST) and dynamic runtime dependencies.
3. **Identify God Nodes:**
   - A *God Node* is a file or class with disproportionately high degree centrality (in-degree + out-degree).
   - Touching a God Node has a high blast radius. Never refactor a God Node without comprehensive tests.

## 2. Graph Navigation Patterns

When answering questions about the architecture:
- **Trace Paths (`/graph path <Source> <Target>`):**
  Identify the shortest sequence of function calls or module imports between two disparate systems (e.g. `AuthForm` to `DatabasePool`).
- **Community Detection:**
  Group related components into functional communities (e.g. *Data Ingestion*, *Rendering Engine*, *Billing Gateway*).
- **Explain Module (`/graph explain <Node>`):**
  Summarize a node by its incoming dependencies (who relies on it) and outgoing dependencies (what it needs to function).

## 3. Recommended Artifact: `GRAPH_REPORT.md`

Maintain an architecture summary containing:
- **Top 5 Central Nodes (God Nodes)**
- **Surprising / Cross-Cutting Connections**
- **Circular Dependency Warnings**
- **Orphaned / Unused Modules**
