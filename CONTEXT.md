# Domain Context & Dictionary: Smileu Code Skill

## 1. Ubiquitous Vocabulary
- **Smileu Pipeline:** The standard 6-phase engineering workflow: Align, Architect, Orchestrate, Craft, Secure, Humanize.
- **Grilling Session:** A structured interview conducted by the AI before writing code to resolve ambiguity and clarify edge cases.
- **Anti-Slop:** Design standards that eliminate generic AI-generated interface tropes (e.g. purple gradient cards, nested boxes, generic icon badges).
- **God Node:** A file or module with excessively high architectural centrality, carrying elevated blast radius.
- **SPARC:** Specification, Pseudocode, Architecture, Refinement, Completion workflow.
- **Humanizer Pattern:** Eliminating 25 identified patterns of robotic, cliché-ridden AI prose.

## 2. Invariant Rules
1. Every skill must have a valid YAML frontmatter block with `name` and `description`.
2. The CLI must remain functional with zero external npm dependencies installed (graceful fallback in `src/ui.js`).
3. Never overwrite user files like `PRODUCT.md` or `CONTEXT.md` without confirmation if they already exist in the target directory.
4. All file paths must be handled safely across operating systems (Windows `\` and POSIX `/`).

## 3. Architecture & Structure
- `bin/cli.js`: Executable entrypoint for `npx`.
- `src/config.js`: Catalogs of skills, upstream repositories, and editor mappings.
- `src/installer.js`: Core file copying and project initialization engine.
- `skills/`: The master and component skill definitions.
- `templates/`: Project configuration templates (`PRODUCT.md`, `CONTEXT.md`, `DESIGN.md`, `.cursorrules`, `CLAUDE.md`).
