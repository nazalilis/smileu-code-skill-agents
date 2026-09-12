---
name: motion-physics
description: "UI motion physics, animation principles, natural easing curves, spring dynamics, and micro-interactions inspired by Emil Kowalski."
---

# UI Motion & Physics Skill

Inspired by `emilkowalski/skills` and `animations.dev`.

Great interfaces feel alive because their motion mimics physical reality. Bad AI-generated interfaces either lack motion or use sluggish, cartoonish bounces. This skill sets the physical laws for interface movement.

## 1. The Core Easing Rules

1. **Entering Elements (Enter = Decelerate):**
   - When an element enters the screen, it must enter with speed and slow down as it arrives.
   - Use **`ease-out`** (e.g. `cubic-bezier(0.16, 1, 0.3, 1)`).
   - *Never use `ease-in` for an entering element.* Elements shouldn't start standing still and speed up right into the user's face.

2. **Exiting Elements (Exit = Accelerate):**
   - When an element leaves, it should start moving and accelerate away out of view.
   - Use **`ease-in`** (e.g. `cubic-bezier(0.7, 0, 0.84, 0)`).

3. **In-Screen Choreography:**
   - For elements already on screen moving from Position A to B:
   - Use **`ease-in-out`** or a balanced spring (`stiffness: 300, damping: 30`).

## 2. Timing & Duration Benchmarks

- **Hover & Button Feedback:** `100ms - 150ms`. Instant response, no lag.
- **Dropdowns & Popovers:** `150ms - 200ms`.
- **Modals & Dialogs:** `200ms - 300ms`.
- **Page Transitions:** `300ms - 400ms`.
- *Anything over 400ms feels sluggish and frustrates power users.*

## 3. Natural Spring Physics

When using Framer Motion, React Spring, or CSS transitions:
- **Mass:** Default to `1`.
- **Stiffness & Damping:** High stiffness with critical damping prevents wobbling.
  - Snappy: `stiffness: 400, damping: 35`
  - Gentle: `stiffness: 200, damping: 25`
- Avoid underdamped bouncy springs (`damping < 10`) unless creating playful game-like elements.

## 4. Transform Origin & Direction
- Always animate `transform` (scale, translate) and `opacity`. Never animate `width`, `height`, `top`, or `margin` directly (which cause expensive browser layout recalculations).
- Align `transform-origin` to where the interaction triggered (e.g., a dropdown expands from its parent button).
