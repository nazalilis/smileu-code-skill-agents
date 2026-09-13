<div align="center">
  <img src="assets/banner.png" alt="Smileu Code Skill logo" width="100%" />
</div>

# Smileu Code Skill

A CLI that installs AI coding skills and agent personas into Claude Code, Cursor, Antigravity and Windsurf, keeps them up to date, and runs local checks for hardcoded secrets, UI anti-patterns and stock AI phrasing.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![Package](https://img.shields.io/badge/package-%40nazalilis%2Fsmileu--code--skill-blue.svg)](https://github.com/nazalilis/smileu-code-skill-agents/pkgs/npm/smileu-code-skill)
[![Skills](https://img.shields.io/badge/skills-889-purple.svg)](skills/)
[![Agents](https://img.shields.io/badge/agent%20personas-12-orange.svg)](templates/agents/)
[![CI](https://github.com/nazalilis/smileu-code-skill-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/nazalilis/smileu-code-skill-agents/actions/workflows/ci.yml)

---

## Contents

- [Why it exists](#why-it-exists)
- [Install](#install)
- [Quick start](#quick-start)
- [Keeping skills up to date](#keeping-skills-up-to-date)
- [Commands](#commands)
- [The six-phase workflow](#the-six-phase-workflow)
- [Agent personas](#agent-personas)
- [Upstream projects](#upstream-projects)
- [In-editor prompts](#in-editor-prompts)
- [Repository structure](#repository-structure)
- [Releases and publishing](#releases-and-publishing)
- [License](#license)

---

## Why it exists

AI coding agents write code quickly, but without guidance they tend to produce:

- invented endpoints and tangled dependencies,
- generic UI: purple gradients, cards nested in cards, bouncy animation,
- hardcoded tokens, `eval()` calls and shell commands built from strings,
- documentation padded with stock AI phrasing.

Smileu packages 889 skills and 12 agent personas drawn from eight open-source projects, installs them into the folders your editor reads, and adds commands that check a project for the problems above. It needs Node.js 18 or later. Git, Python and uv are optional.

---

## Install

The package is published to GitHub Packages as `@nazalilis/smileu-code-skill`. Pick one of the options below.

#### Option 1: run straight from GitHub (no registry setup)
```bash
npx github:nazalilis/smileu-code-skill-agents init
```

#### Option 2: install from GitHub Packages
GitHub Packages needs a one-time login, even for public packages. Create a personal access token with the `read:packages` scope, then:
```bash
npm config set @nazalilis:registry https://npm.pkg.github.com
```
```bash
npm login --scope=@nazalilis --auth-type=legacy --registry=https://npm.pkg.github.com
```
```bash
npm install -g @nazalilis/smileu-code-skill
```
After a global install the command is `smileu`. Without installing, use `npx @nazalilis/smileu-code-skill <command>`.

#### Option 3: from a clone
```bash
git clone https://github.com/nazalilis/smileu-code-skill-agents.git
```
```bash
cd smileu-code-skill-agents && npm install && npm link
```

The examples below use `smileu`. Substitute the `npx` form if you did not install globally.

---

## Quick start

#### Install everything (interactive)
In a terminal, `init` asks which editor and how much of the library to install:
```bash
smileu init
```

#### Install without prompts
`-y` takes the defaults: the full library in every editor. In CI or other non-terminal runs, `init` refuses to guess and asks for `-y` or an explicit editor or scope.
```bash
smileu init -y
```

#### Install for one editor
```bash
smileu init claude
```
Editors: `claude` (`.claude/skills`, `.claude/agents`, `CLAUDE.md`), `cursor` (`.cursor/rules`, `.cursor/agents`, `.cursorrules`), `antigravity` (`.agent/skills`, `.agent/agents`), `windsurf` (`.agent/` plus `.windsurfrules`), `universal` (`.skills/`), or `all`.

#### Install only the 9 core skills
```bash
smileu init --core -e cursor
```

#### Add individual skills
```bash
smileu add domain-modeling tdd
```

#### Find a skill name
```bash
smileu list --all security
```

#### Preview without writing anything
```bash
smileu init --dry-run
```

`init` creates `PRODUCT.md`, `CONTEXT.md`, `DESIGN.md`, `AGENTS.md`, the editor rules file and a seed ADR only when they do not exist yet, so re-running it never overwrites your edits. Agent persona files that already exist are kept too; pass `--force` to replace them.

---

## Keeping skills up to date

#### Refresh installed skills from the library
`update` rewrites only the skill and persona files whose content changed. Files you added next to a skill are kept, symlinks are never written through, and project documents are not touched.
```bash
smileu update
```

#### Pull the current library from GitHub
```bash
smileu update --latest
```

#### Also install skills that were added to the library since your last install
```bash
smileu update --include-new
```

#### See what would change
```bash
smileu update --dry-run
```

#### Check whether a newer CLI release exists
Asks the GitHub Releases API and prints the upgrade command. It writes nothing.
```bash
smileu update --check
```

Each install and update records what it did in `.smileu/manifest.json`, which `update` uses to tell you when a full install is missing newly published skills.

---

## Commands

| Command | What it does | Exit code |
|---|---|---|
| `init [editor]` | Install skills, agent personas and project templates. The default command. | 1 if anything failed |
| `add <skill...>` | Install skills by name. Names must match a library folder exactly. | 1 if a skill was not found |
| `update` | Refresh installed skills and personas. See [Keeping skills up to date](#keeping-skills-up-to-date). | 1 if nothing is installed |
| `audit` | Scan for hardcoded secrets (including `.env` files), `eval()`, `new Function()`, `shell: true`, and run `npm audit`. | 1 on critical or high findings |
| `craft` | Flag pure `#000` black, `bounce`/`elastic` easing and nested `card` classes in UI files. | 0 (advisory) |
| `humanize` | Flag 8 common AI phrases in Markdown files. | 0 (advisory) |
| `graph` | Build a file and import graph with Graphify, or with the built-in import scanner when Graphify is not installed. | 0 |
| `run-all` | Templates, graph, craft, audit and humanize, in that order. | 1 if a step failed |
| `grill` | Ask 5 questions and write `PRODUCT.md` and `CONTEXT.md`. Existing copies are backed up to `.smileu/backups/`. Answers can be piped in, one per line. | 2 if input ends early |
| `swarm "<task>"` | Save a checklist for five agent roles to `.smileu/tasks/`. It writes a plan; it does not run agents. | 2 without a task |
| `motion [preset]` | Print CSS, Tailwind and Framer Motion easing for `enter`, `exit`, `hover` or `modal`. | 2 for an unknown preset |
| `doctor` | Show which of Node.js, Git, Python, uv and Graphify are available. | 0 |
| `setup-tools` | Install Graphify with uv, or with pip when uv is missing. | 1 if the install failed |
| `list [--all] [filter]` | List the core skills, or every skill name. | 1 if the filter matches nothing |
| `repos` | List the upstream projects. | 0 |

Aliases: `install` = `init`, `align` = `grill`, `secure` = `audit`, `polish` = `craft`, `pipeline` = `run-all`.

Usage errors (unknown command or option, missing value) exit with code 2 and suggest the closest command. Warnings and errors go to stderr. Colour is off when output is not a terminal, when `NO_COLOR` is set, or with `--no-color`.

All reports, graphs, task plans, backups and the manifest are written under `.smileu/`, which is added to your `.gitignore` automatically. The one exception is `grill`, which writes `PRODUCT.md` and `CONTEXT.md` at the project root on purpose.

`audit` is a pattern scan, not a full OWASP Top 10 review. Test and fixture folders are exempt from it.

---

## The six-phase workflow

The master skill asks agents to work through six phases in order instead of jumping straight to code:

```
[1. ALIGN]     --> Clarify intent, scope and domain terms (PRODUCT.md, CONTEXT.md)
      |
[2. ARCHITECT] --> Map dependencies (.smileu/graph/) and record decisions (docs/adr/)
      |
[3. SWARM]     --> Split the work across agent personas using SPARC
      |
[4. CRAFT]     --> Apply the design rules: type scale, 4px/8px spacing, restrained motion
      |
[5. SECURE]    --> Validate input, pass command arguments as arrays, keep secrets out of code
      |
[6. HUMANIZE]  --> Remove stock AI phrasing and state facts plainly
```

`smileu run-all` runs the checks that back phases 1, 2, 4, 5 and 6.

---

## Agent personas

`init` copies these personas into the agents folder of each editor you choose (`.claude/agents/`, `.cursor/agents/`, `.agent/agents/` or `.skills/agents/`):

| Persona | Role | Guiding rule |
|---|---|---|
| `architect` | Lead system architect | Reads `PRODUCT.md` and the dependency graph first; records decisions as ADRs. |
| `engineer` | Feature engineer | Strict typing, explicit error handling, no unhandled promise rejections. |
| `craft` | Design and motion specialist | No template UI; 200ms `ease-out` to enter, 150ms `ease-in` to exit. |
| `guardian` | Security guardian | No shell string concatenation; validates input with schemas; keeps credentials out of code. |
| `editor` | Prose editor | Removes stock AI phrasing from docs, commits and PR descriptions. |
| `orchestrator` | Swarm lead | Splits feature requests into SPARC tasks across the other personas. |
| `sparc-coder` | Implementation | Implements pure logic units without architectural side effects. |
| `tester` | Test specialist | Builds unit, regression and integration tests. |
| `impeccable-asset-producer` | Visual assets | Produces UI assets and SVGs. |
| `impeccable-documenter` | Design system documentation | Writes component specifications in `DESIGN.md`. |
| `impeccable-finish-reviewer` | Finish review | Reviews alignment, rhythm and type scale before release. |
| `impeccable-manual-edit-applier` | Targeted edits | Applies small edits without disturbing surrounding code. |

---

## Upstream projects

Smileu includes material from these projects (run `smileu repos` for the list in your terminal):

| Project | Author | What Smileu uses |
|---|---|---|
| [mattpocock/skills](https://github.com/mattpocock/skills) | Matt Pocock | Grilling sessions, domain vocabulary (`CONTEXT.md`), ADRs, TDD. |
| [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | Graphify Labs | Codebase graph extraction. |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | Leonxlnx | Frontend taste: type scales, 4px/8px grids, colour palettes. |
| [ruvnet/ruflo](https://github.com/ruvnet/ruflo) | rUv | Multi-agent swarms and the SPARC workflow. |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Paul Bakaus | `PRODUCT.md`, `DESIGN.md` and design craft commands. |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | Emil Kowalski | Motion timing and easing for entering and exiting elements. |
| [blader/humanizer](https://github.com/blader/humanizer) | Blader | Writing patterns to avoid. The `humanize` command checks 8 of the most common. |
| [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | Mukul | Security skills; 818 of the 889 bundled skills come from here. |

---

## In-editor prompts

After `init`, you can ask your assistant to follow a phase directly:

- `/smileu align`: run a grilling session and settle the domain vocabulary.
- `/smileu graph`: map the codebase and its import dependencies.
- `/smileu swarm "<task>"`: split a feature into SPARC tasks across the five core personas.
- `/smileu craft`: write or review frontend components against the design rules.
- `/smileu polish`: tighten type hierarchy, spacing, micro-interactions and contrast.
- `/smileu secure`: review code for injection points, hardcoded secrets and unsafe calls.
- `/smileu humanize`: edit docs, commit messages and PR descriptions to remove stock phrasing.
- `/smileu all`: go through all six phases in order.

---

## Repository structure

```text
smileu-code-skill-agents/
├── .github/
│   ├── dependabot.yml             # Weekly npm and GitHub Actions update PRs
│   └── workflows/
│       ├── ci.yml                 # Tests on Linux, Windows, macOS x Node 18/20/22
│       ├── codeql.yml             # CodeQL code scanning
│       └── release.yml            # Tag, GitHub Release and package publish
├── bin/cli.js                     # Executable entry point
├── src/
│   ├── cli.js                     # Command router and option parsing
│   ├── config.js                  # Skill catalog, editor layouts, repository names
│   ├── installer.js               # Skill, persona and template installation
│   ├── ui.js                      # Terminal output (colour, stdout/stderr)
│   ├── index.js                   # Library entry
│   ├── utils/
│   │   ├── manifest.js            # .smileu/manifest.json
│   │   ├── output.js              # .smileu/ folders and .gitignore entry
│   │   └── semver.js              # Version parsing, bumping and comparison
│   └── tools/
│       ├── update.js              # smileu update and update --check
│       ├── source.js              # Bundled library or --latest clone
│       ├── grill.js               # Alignment questions
│       ├── graphify.js            # Graphify runner and built-in import scanner
│       ├── swarm.js               # Five-role task plans
│       ├── motion.js              # Easing presets
│       ├── design.js              # UI anti-pattern scan
│       ├── security.js            # Secret, unsafe call and npm audit scan
│       ├── humanizer.js           # AI phrase scan
│       ├── doctor.js              # Tool detection and Graphify install
│       └── pipeline.js            # run-all
├── scripts/
│   ├── release.js                 # Cut a release: bump, stamp changelog, commit, tag
│   ├── release-notes.js           # Print a version's CHANGELOG section
│   └── lib/changelog.js           # Keep a Changelog parser and stamper
├── skills/                        # 889 skills
├── templates/                     # Project templates and the 12 agent personas
├── docs/adr/                      # Architecture decision records
├── test/
│   ├── cli.test.js                # Commands, options and exit codes
│   ├── sandboxes.test.js          # End-to-end workspaces (install, update, audit, grill)
│   ├── release.test.js            # Versioning, changelog and release scripts
│   └── update.test.js             # update, release check and manifest units
├── AGENTS.md, ARCHITECTURE.md, CHANGELOG.md, CONTEXT.md, DESIGN.md, PRODUCT.md, SECURITY.md
├── package.json
└── LICENSE
```

---

## Releases and publishing

Versions follow [Semantic Versioning](https://semver.org/), and every release has a section in [CHANGELOG.md](CHANGELOG.md) in [Keep a Changelog](https://keepachangelog.com/) format. Write entries under `## [Unreleased]` as you work; cutting a release moves them into a dated version section.

There are three ways to release. All of them end in the same place: a `vX.Y.Z` tag, a GitHub Release whose notes come from the changelog, and the package published to GitHub Packages (and to npm when an `NPM_TOKEN` secret is configured).

#### 1. Choose a release in GitHub (no local setup)
Open **Actions → Release & Publish Package → Run workflow**, then pick `patch`, `minor`, `major`, `prepatch`, `preminor`, `premajor` or `prerelease`, or type an exact version. Tick **dry run** to see the plan without releasing. The workflow runs the tests, bumps `package.json`, stamps `CHANGELOG.md`, commits to `main`, tags, creates the release and publishes.

#### 2. Cut a release locally
```bash
npm run release:dry -- minor
```
```bash
npm run release:minor -- --push
```
Other types: `npm run release` (patch), `npm run release:major`, `npm run release:pre -- --preid rc`, or `node scripts/release.js 2.0.0 --push`. The script refuses to run on a dirty tree, off `main`, with an empty `[Unreleased]` section, or when the tag already exists.

#### 3. Bump the version in a commit
Any push to `main` that changes the `version` in `package.json` to one that has no tag yet is released automatically. Pushes that change `package.json` without changing the version do not release anything.

**What updates on its own**

- Re-running a release is safe: an existing GitHub Release is updated in place, and a version that is already on the registry is skipped.
- Prerelease versions (`1.2.0-rc.0`) are marked as pre-releases on GitHub and published with the `next` dist-tag, so `@latest` stays on the last stable version.
- Dependabot opens weekly pull requests for npm dependencies and GitHub Actions versions; CI tests each one.
- Users pick up new skills with `smileu update --latest --include-new` and new CLI versions with `smileu update --check`.

**Repository settings the workflow relies on**

- Under **Settings → Actions → General → Workflow permissions**, the organisation must allow workflows to request write access. The workflow asks for `contents: write` and `packages: write` itself.
- If `main` is branch-protected, allow GitHub Actions to push to it, or release with option 2 or 3 instead of option 1.
- `NPM_TOKEN` is optional. Without it, only GitHub Packages is published.

---

## License

MIT License © 2026 Smileu
