---
name: design-craft-impeccable
description: "Durable product truth (PRODUCT.md), design system documentation (DESIGN.md), and 23 precision design craft commands inspired by pbakaus/impeccable."
---

# Impeccable Design Craft Skill

Inspired by `pbakaus/impeccable`.

Bridge the gap between product strategy and UI execution through durable product documentation and specialized design actions.

## 1. Durable Documentation

### `PRODUCT.md` (Product Truth)
Keep this at the root of the project to ground the AI in facts:
- **Audience**: Who uses this?
- **Purpose**: What single job does this tool accomplish?
- **Operating Context**: Browser, desktop, mobile, embedded?
- **Constraints**: Bandwidth, accessibility targets, regulatory constraints.
- **Voice & Tone**: Precise, playful, minimalist, authoritative?

### `DESIGN.md` (Visual System Record)
- Typography scales and token names.
- Surface color ramps (Background, Card, Muted, Border, Accent).
- Component variants and interactive states.

## 2. The 23 Design Commands

Use these commands to direct UI iteration:

| Command | Objective |
|---|---|
| `/impeccable init` | Inspect project and write `PRODUCT.md` |
| `/impeccable craft` | Shape-then-build full feature workflow |
| `/impeccable shape` | Plan UX/UI wireframes before writing code |
| `/impeccable audit` | Audit a11y, performance, and responsive breakpoints |
| `/impeccable polish` | Final pass before release: alignment, padding, token check |
| `/impeccable critique` | Review hierarchy, emotional resonance, and visual weight |
| `/impeccable harden` | Add error states, empty states, text overflow, and fallbacks |
| `/impeccable distill` | Strip unnecessary fluff and complexity down to the essence |
| `/impeccable bolder` | Amplify contrast, presence, and visual hierarchy |
| `/impeccable quieter` | Tone down loud elements, high saturated fills, and clutter |
| `/impeccable animate` | Add purposeful, non-distracting motion |
| `/impeccable typeset` | Correct font sizes, line heights, and letter spacing |
| `/impeccable layout` | Fix visual rhythm, padding, and flex/grid alignment |
| `/impeccable delight` | Introduce subtle micro-interactions or unexpected craft |
| `/impeccable clarify` | Rewrite confusing UX microcopy |
| `/impeccable onboard` | Design first-run experiences and empty state guidance |
| `/impeccable adapt` | Test and adapt layout across extreme screen aspect ratios |

## 3. The 61 Deterministic Rule Checklist
- Ensure focus rings are accessible on keyboard navigation (`:focus-visible`).
- Never truncate vital content without full tooltip or expanded view.
- Maintain a minimum tap target of 44x44px for touch interfaces.
- Ensure text contrast meets WCAG 2.1 AA standard (4.5:1 for body, 3:1 for large text).
