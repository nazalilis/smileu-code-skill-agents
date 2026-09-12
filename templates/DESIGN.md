# Design System & Visual Guidelines: [Project Name]

## 1. Aesthetic Direction
- **Style:** Clean, intentional, modern, high-contrast, distraction-free terminal & UI craft.
- **Anti-Patterns:** Avoid generic AI slop: no purple-to-blue gradient borders on cards, no rounded-square icon tiles above every heading, no nested cards, no slow cartoonish bounces.

## 2. Typography Ramps
- **Primary Font:** Geist, Plus Jakarta Sans, SF Pro (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`)
- **Monospace Font:** Geist Mono, JetBrains Mono, Fira Code
- **Tracking Rules:** Tighten headings (`-0.025em`), open small text slightly (`+0.015em`).
- **Scale:**
  - Display: `32px / line-height 1.15 / tracking -0.03em / font-weight 700`
  - Heading: `20px / line-height 1.25 / tracking -0.02em / font-weight 600`
  - Body: `14px / line-height 1.5 / tracking normal / font-weight 400`
  - Caption / Code: `12px / line-height 1.4 / tracking +0.01em / font-mono`

## 3. Color Tokens
- **Background:** `#0d1117` (Dark Canvas) / `#f8fafc` (Light Canvas) — *Never pure `#000000` or `#ffffff`*.
- **Surface / Card:** `#161b22` (Tinted neutral with subtle slate hue).
- **Border:** `1px solid rgba(255, 255, 255, 0.08)` (Dark) / `1px solid rgba(0, 0, 0, 0.08)` (Light).
- **Primary Accent:** `#38bdf8` (Cyan/Sky 400).
- **Success Accent:** `#4ade80` (Emerald 400).
- **Warning Accent:** `#fbbf24` (Amber 400).
- **Error Accent:** `#f87171` (Rose 400).

## 4. Motion Guidelines (Emil Kowalski Physics)
- **Entering Elements:** `ease-out` (200ms) — `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Exiting Elements:** `ease-in` (150ms) — `cubic-bezier(0.7, 0, 0.84, 0)`.
- **Interactive Feedback (Buttons / Taps):** `100ms` snappy response, active `scale(0.97)`.
- **Modals / Sheets:** Transform origin centered, scale up `0.96 -> 1.0` with damped spring (`stiffness: 350, damping: 30`).
