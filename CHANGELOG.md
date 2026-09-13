# Changelog

All notable changes to **Smileu Code Skill** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **`smileu update`.** Refreshes installed skills and agent personas from the bundled
  library, or from GitHub with `--latest`. Only files whose content changed are
  rewritten; files you added are kept and symlinks are never written through.
  `--include-new` installs skills added to the library since the last install,
  `--dry-run` previews, and `--check` compares the CLI with the latest GitHub Release.
- **Install manifest.** `.smileu/manifest.json` records the CLI version, source, scope,
  editors and skills of each install and update.
- **Release automation.** A push to `main` that changes the version in `package.json`,
  or a pushed `vX.Y.Z` tag, is tagged, released on GitHub with notes from this
  changelog, and published. The workflow never commits to the repository. Re-runs
  update the existing GitHub Release and skip versions already on the registry;
  prereleases are marked as such and published with the `next` dist-tag.
- **Release script.** `scripts/release.js` supports prerelease types, `--preid`,
  explicit versions, `--dry-run` and `--push`, and moves `[Unreleased]` into a dated
  section. It refuses to run on a dirty tree, off `main`, with an empty `[Unreleased]`
  section, or when the tag already exists. New npm scripts: `release:pre`,
  `release:dry`, `release:notes`.
- **CI.** Tests run on Linux, Windows and macOS with Node.js 18, 20 and 22, and the
  publishable tarball is checked for missing and unwanted files.
- **`smileu list --all [filter]`** prints every skill name.
- **`smileu add`** accepts several skill names and suggests the correct name for near
  misses. `init --force` replaces existing agent persona files.
- **Full library by default.** `init` installs all 889 skills plus the 12 agent
  personas; `--core` installs the 9 core skills. In a terminal, `init` without options
  shows an interactive picker (editor and scope).
- **`--latest`** installs from a temporary clone of the GitHub repository, then
  deletes it. Falls back to the bundled library when git or the network is unavailable.
- **Master skill always included**, so the `/smileu` workflow works after any install.
- **`npx smileu-code-skill`.** Releases are also published to the public npm registry
  under the unscoped name `smileu-code-skill` when the `NPM_TOKEN` secret is set, so the
  CLI runs without any registry setup. GitHub Packages keeps
  `@nazalilis/smileu-code-skill`. GitHub Release notes include the install command.

### Changed
- **Exit codes:** 0 success, 1 failure or blocking finding, 2 invalid usage. Before,
  almost every failure exited 0. `smileu audit` exits 1 on critical or high findings,
  so it can gate a CI job.
- **Output:** warnings and errors go to stderr. Colour is off when output is not a
  terminal, with `NO_COLOR`, or with `--no-color`. The banner is no longer printed for
  `--version`, piped output or CI.
- **`init` without a terminal** and without `-y`, an editor or a scope now stops with
  an explanation instead of installing the full library into the current folder.
- **Re-running `init`** keeps existing agent persona files (use `--force` or
  `smileu update` to refresh them). Agent personas and rules files are written only to
  the editors you select.
- **`grill`** backs up existing `PRODUCT.md` and `CONTEXT.md` to `.smileu/backups/`
  before replacing them, and accepts answers piped in one per line.
- **`swarm`** requires a task description.
- **Unknown commands** suggest the closest command; unknown options and missing option
  values are reported instead of ignored.
- **Generated files** live under `.smileu/` (reports, graph, task plans, backups,
  manifest), and `.smileu/` is added to `.gitignore` on first use. Native Graphify
  output is moved there too. `grill` still writes `PRODUCT.md` and `CONTEXT.md` at the
  project root on purpose.
- **Scan reports** state exactly which checks ran and no longer claim full OWASP Top 10
  coverage.
- **Documentation:** README, ARCHITECTURE and SECURITY describe the actual behaviour,
  including how to install from npm or from GitHub Packages.
- **`update --check`** reads the npm registry first and falls back to GitHub Releases,
  so it also works when the repository is private.
- **Workflow actions** are pinned to full commit SHAs.
- **Version parsing** follows the semver grammar strictly: leading zeros and empty
  identifiers are rejected, and a mistyped release type gets its own error message.
- **Tests** run their sandboxes in the OS temp directory and remove the reports they
  create, so a test run leaves nothing behind in the repository.

### Fixed
- Running the CLI with no arguments crashed, and a flags-only call such as
  `smileu --core -y` was treated as an unknown command.
- `--editor` swallowed the next flag, `add -e cursor <skill>` took `cursor` as the
  skill name, and `init <editor>` was ignored when it came after a flag.
- `install` skipped templates and agent personas although it is an alias of `init`.
- Editor names such as `constructor` crashed the installer.
- `--latest` always fell back to the bundled library because it cloned a repository
  that does not exist.
- The security scan never read `.env` files, reported `npm audit` failures and found
  vulnerabilities as "Clean", and exempted any path containing `test/` as a substring
  (for example `latest/`).
- Graphify ran through a shell guarded by a character blocklist that missed quotes
  and newlines; it now runs without a shell. The `tree` step always failed, and uv was
  used even when it could not run Graphify.
- The graph report listed the first files scanned as the "top connected files".
- A dry run listed templates that a real install would skip, skill names matched
  case-insensitively only on Windows and macOS, and one unwritable file aborted the
  whole install.
- `grill` lost piped answers and overwrote `PRODUCT.md` and `CONTEXT.md` without a copy.
- The prose scan's exclusion used absolute paths, so projects inside a folder named
  `humanizer-writing` were skipped entirely; inflected forms of flagged words were missed.
- The design scan flagged identifiers such as `debounce` as bounce animations.
- An unknown `motion` preset printed nothing and exited 0.
- `setup-tools` could run `pip` from a different interpreter than the Python it found.
- The npm publish step in `release.yml` never ran: the `secrets` context is not
  available in a step-level `if`. The secret is now mapped into the job environment
  and checked there.
- `scripts/release.js` produced `NaN` versions for prereleases, treated unknown types
  as `patch`, and left a bumped `package.json` behind when git failed.
- Stamping the changelog dropped release sections placed above `[Unreleased]`, collapsed
  blank lines inside notes, ignored `[YANKED]` releases and lowercase `[unreleased]`,
  and accepted invalid versions and dates.
- The security scan missed a `shell` option written on a different line from the call
  and shell commands built from template strings, flagged `eval()` mentioned only in
  comments, reported one secret several times when patterns overlapped, and treated
  `.env` keys such as `TOKEN_URL` as secrets.
- The release workflow could not publish to npm (the token line was appended to the
  last line of the generated `.npmrc`), could not be retried once the tag existed,
  exposed the npm token to every step, and left git credentials in the checkout.
- The design scan flagged `class="card card-body"` as a nested card and missed nested
  cards written with `className`. It now also ignores self-closing tags, void elements
  such as `<img>`, and Vue `:class` bindings.

---

## [1.0.4] - 2026-09-11

### Packaging & Security Automation
- **Configured `.npmrc`:** Added project `.npmrc` file configured for `@nazalilis:registry=https://npm.pkg.github.com`.
- **CodeQL Advanced Analysis:** Added automated `.github/workflows/codeql.yml` workflow to satisfy GitHub Code scanning requirements.
- **Documentation Polish:** Streamlined `README.md` and removed explicit Language Policy sections for maximum professional presentation.

---

## [1.0.3] - 2026-09-11

### CI/CD & Publishing Workflow Fixes
- **Committed `package-lock.json`:** Created reproducible npm lockfile and added `npm ci || npm install` fallback in CI/CD pipeline to ensure deterministic build success.
- **GitHub Packages Native Publishing:** Configured `actions/setup-node@v4` with `registry-url: 'https://npm.pkg.github.com'` and `@nazalilis` scope for zero-configuration authenticated package deployment.


---

## [1.0.2] - 2026-09-11

### Security & Secret Scanning Remediation
- **Secret Scanning Remediation:** Defanged dummy `tskey-auth-xxxxx` and `tskey-auth-xxxxx-ephemeral` tokens in `skills/deploying-tailscale-for-zero-trust-vpn/SKILL.md` to resolve GitHub public leak alert.
- **Enhanced Scanner Gates:** Added automated Tailscale auth key (`tskey-`) and Stripe secret key (`sk_live_`) regex patterns to `src/tools/security.js` to prevent accidental credential leakage in user projects.

### Packaging & GitHub Packages Support
- **GitHub Packages Scope:** Configured scoped package name `@nazalilis/smileu-code-skill` targeting `https://npm.pkg.github.com`.
- **Automated Workflow Publishing:** Enhanced `.github/workflows/release.yml` to automatically publish packages to GitHub Packages registry via `${{ secrets.GITHUB_TOKEN }}` on tag push.

### Visual Branding & Documentation
- **Hero Banner Illustration:** Created and embedded high-resolution cyberpunk multi-agent visual banner (`assets/banner.png`) at the top of `README.md`.
- **Isolated Terminal Commands:** Restructured `README.md` into single-line, dedicated copy-paste command blocks for effortless developer usage.

---

## [1.0.1] - 2026-09-11

### Security Hardening & Privacy
- **Sanitized Machine Paths:** Stripped all host filesystem paths (`D:\...`, `C:\...`, personal drive letters) from static audit reports (`SECURITY_AUDIT.md`, `DESIGN_AUDIT.md`, `HUMANIZER_AUDIT.md`).
- **Path Traversal Barrier:** Hardened `installSkills` against directory traversal attacks (e.g. `../../etc/passwd`), ensuring skill resolutions cannot escape canonical library boundaries.
- **Git Protection:** Ignored runtime test sandboxes (`.test-sandboxes/`), dynamic swarm tasks (`.agent/tasks/`), and local audit outputs in `.gitignore`.
- **Command Sanitization:** Validated CLI directory arguments in `graphify.js` to eliminate shell metacharacter injection.

### Architecture & Optimization
- **Deduplication:** Removed redundant 30 MB `data/` duplicate directory, reducing package size and boosting installation speed.
- **Full Library Cataloging:** Integrated comprehensive support for all 889 skills across 8 frameworks with `--full` flag or single-skill addition (`smileu add <skill>`).
- **12 Autonomous Agent Personas:** Synchronized complete agent suite across `.agent/agents/`, `.claude/agents/`, `.cursor/agents/`, and `templates/agents/`.
- **Three Isolated Sandboxes:** Created automated test suite (`test/sandboxes.test.js`) validating Frontend, Backend, and Fullstack scenarios with penetration testing.

### Developer Experience
- **English Refactor:** Standardized all instructions, comments, CLI banners, logs, and diagnostic messages to clear, relaxed-formal English.
- **Automated Publishing Workflow:** Added `.github/workflows/release.yml` for automated GitHub Releases and npm registry publishing on tag push.

---

## [1.0.0] - 2026-09-10

### Initial Release
- Synthesized 8 upstream repositories:
  - `mattpocock/skills` (Engineering alignment, grilling sessions, ubiquitous dictionary, ADR)
  - `Graphify-Labs/graphify` (Codebase AST topology, god node detection, GraphRAG)
  - `Leonxlnx/taste-skill` (Anti-slop frontend taste, typography ramps, harmonic spacing)
  - `ruvnet/ruflo` (Multi-agent swarm orchestration, SPARC workflow)
  - `emilkowalski/skills` (UI motion physics, natural easing curves, spring dynamics)
  - `pbakaus/impeccable` (Product truth `PRODUCT.md`, `DESIGN.md`, 23 precision commands)
  - `blader/humanizer` (Eliminating 25 synthetic AI clichés, natural humanized tone)
  - `mukul975/Anthropic-Cybersecurity-Skills` (800+ cybersecurity skills, OWASP Top 10)
- Unified **Smileu 6-Phase Pipeline** (`smileu run-all`).
- Cross-platform CLI executable via `npx smileu-code-skill`.
