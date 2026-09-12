---
name: frontend-taste
description: "Anti-slop frontend engineering standards: intentional typography, spacing harmony, restrained palettes, and elimination of generic AI-generated interface tropes."
---

# Frontend Taste Skill

Inspired by `Leonxlnx/taste-skill`.

AI models default to the average of everything they've seen: Inter font, purple-indigo gradients, pill badges everywhere, cards inside cards, and generic icon tiles. This skill provides explicit rules to ensure frontend code exhibits high craft and aesthetic distinction.

## 1. Visual Anti-Patterns (The AI Tells)

- ❌ **Do not** put an icon in a rounded square container above every heading.
- ❌ **Do not** use raw purple-to-blue gradient borders on cards by default.
- ❌ **Do not** wrap everything in a `<div class="card p-6 rounded-xl border">`. Use whitespace, subtle divider rules, or alternating background tints.
- ❌ **Do not** use pure gray text on colored backgrounds; contrast is ruined.
- ❌ **Do not** make every button look identical with pill radius (`rounded-full`) unless that is the system's deliberate language.

## 2. Typography Rules

1. **Hierarchy over Size:** Create hierarchy with weight, opacity, and letter-spacing rather than jumping 4 font size steps.
2. **Tabular Figures:** Always use `font-variant-numeric: tabular-nums` (or `font-mono` / `tabular-nums` in Tailwind) for prices, dates, times, and tabular counters.
3. **Leading & Tracking:**
   - Large headings (24px+): Tighten letter-spacing (`tracking-tight` / `-0.02em`) and reduce line-height (`leading-tight`).
   - Small body copy (12-14px): Open tracking slightly (`tracking-wide` / `+0.01em`) and increase line-height for legibility.

## 3. Surface & Spacing Discipline

1. **4px / 8px Grid Alignment:** Maintain strict mathematical multiples for padding and margins (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).
2. **Tinted Neutrals:** Never use pure `#000000` or `#ffffff`. Dark themes should use deep warm slate or obsidian with a 1-3% color tint.
3. **Subtle Elevation:** Prefer 1px subtle borders (`border-white/10` or `border-black/5`) with diffused ambient shadows over harsh drop shadows.
