# Domain Context & Dictionary: Smileu Code Skill

## 1. Ubiquitous Vocabulary
- **Smileu Pipeline:** The standard 6-phase engineering workflow: Align, Architect, Orchestrate, Craft, Secure, Humanize.
- **Grilling Session:** A structured interview conducted by the AI before writing code to resolve ambiguity and clarify edge cases.
- **Anti-Slop:** Design standards that eliminate generic AI-generated interface tropes (e.g. purple gradient cards, nested boxes, generic icon badges).
- **God Node:** A file or module with excessively high architectural centrality, carrying elevated blast radius.
- **SPARC:** Specification, Pseudocode, Architecture, Refinement, Completion workflow.
- **Humanizer Pattern:** A stock AI phrasing pattern catalogued by blader/humanizer. The `humanize` command checks 8 of the most common.
- **Install Manifest:** `.smileu/manifest.json`, the record of what `init`, `add` and `update` put into a workspace.

## 2. Invariant Rules
1. Every skill must have a valid YAML frontmatter block with `name` and `description`.
2. The CLI must remain functional without its npm dependencies installed (plain output in `src/ui.js`, default choices when `prompts` is missing).
3. Never overwrite user files like `PRODUCT.md` or `CONTEXT.md` without a copy: `init` skips files that exist, and `grill` backs them up to `.smileu/backups/` before replacing them.
4. All file paths must be handled safely across operating systems (Windows `\` and POSIX `/`).
5. External programs are started with argument arrays, never with shell strings built from user input.
6. Commands exit 0 on success, 1 on failure or a blocking finding, and 2 on invalid usage.

## 3. Architecture & Structure
- `bin/cli.js`: Executable entry point (`smileu`).
- `src/tools/update.js`: Refreshes installed skills and checks for new releases.
- `src/config.js`: Catalogs of skills, upstream repositories, and editor mappings.
- `src/installer.js`: Core file copying and project initialization engine.
- `skills/`: The master and component skill definitions.
- `templates/`: Project configuration templates (`PRODUCT.md`, `CONTEXT.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, per-editor rule and command files in `templates/editors/`, and agent personas).
