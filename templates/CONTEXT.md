# Domain Context & Dictionary: [Project Name]

## 1. Ubiquitous Vocabulary
*Map terms used across the codebase and team so agents never confuse concepts.*

- **[Term 1]**: Definition. (Example: "Session Token: Ephemeral HMAC-signed string valid for 15 minutes.")
- **[Term 2]**: Definition.

## 2. Invariant Rules
*Non-negotiable technical and business truths that must never be broken.*

1. All monetary calculations must use integer cents (never floating-point).
2. Dates and timestamps must strictly be formatted in ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`).
3. Every write operation must be authenticated and audited.

## 3. Architecture Decisions & Conventions
- **State Management:** (e.g. Zustand / Redux / Context / Signals)
- **Styling:** (e.g. Tailwind CSS / CSS Modules / Vanilla CSS)
- **API Pattern:** (e.g. RESTful JSON / tRPC / GraphQL)
