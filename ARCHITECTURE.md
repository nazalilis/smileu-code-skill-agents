# Architecture: Smileu Code Skill

How the CLI is put together: the modules, what each one owns, and how releases are produced.

---

## 1. Command flow

```
smileu <command>  (bin/cli.js)
       │
       ▼
[ src/cli.js ] ─── option parsing, exit codes, command routing
       │
       ├─► init / add ──► src/installer.js ──► .claude/, .cursor/, .agent/, .skills/ + templates
       │                  src/tools/source.js (bundled library or --latest clone)
       │                  src/utils/manifest.js (.smileu/manifest.json)
       │
       ├─► update ──────► src/tools/update.js ──► refresh changed files, --include-new, --check
       │
       ├─► audit ───────► src/tools/security.js ─► .smileu/reports/SECURITY_AUDIT.md
       ├─► craft ───────► src/tools/design.js ───► .smileu/reports/DESIGN_AUDIT.md
       ├─► humanize ────► src/tools/humanizer.js ► .smileu/reports/HUMANIZER_AUDIT.md
       ├─► graph ───────► src/tools/graphify.js ─► .smileu/graph/
       ├─► run-all ─────► src/tools/pipeline.js ─► all of the above, in order
       │
       ├─► grill ───────► src/tools/grill.js ────► PRODUCT.md, CONTEXT.md (+ .smileu/backups/)
       ├─► swarm ───────► src/tools/swarm.js ────► .smileu/tasks/
       ├─► motion ──────► src/tools/motion.js
       └─► doctor / setup-tools ► src/tools/doctor.js
```

---

## 2. Modules

- **`bin/cli.js`**: executable entry. Reports unexpected errors and sets exit code 1.
- **`src/cli.js`**: parses options for every command, rejects unknown options and missing values with exit code 2, and turns tool results into exit codes (0 success, 1 failure or blocking finding, 2 usage error).
- **`src/config.js`**: the core skill catalog, upstream projects, editor layouts (`EDITOR_TARGETS`), and the package and repository names used by `--latest` and `update --check`.
- **`src/installer.js`**: copies skills, agent personas and templates. Skill names must match a library folder exactly and cannot contain path separators or `..`. Existing templates and persona files are kept; write errors are recorded per skill instead of aborting the whole install.
- **`src/ui.js`**: output helpers. Results go to stdout, warnings and errors to stderr. Colour follows `NO_COLOR`, `FORCE_COLOR`, `--no-color` and TTY detection.
- **`src/utils/output.js`**: creates `.smileu/<sub>/` and adds `.smileu/` to `.gitignore`.
- **`src/utils/manifest.js`**: reads and merges `.smileu/manifest.json` (CLI version, source, scope, editors, skills).
- **`src/utils/semver.js`**: version parsing, bumping and comparison, shared by the CLI and the release scripts.
- **`src/tools/update.js`**: finds installed skills per editor layout, rewrites files whose sha256 differs, never writes through symlinks, and queries the GitHub Releases API for `--check`.
- **`src/tools/source.js`**: returns the bundled library, or a temporary shallow clone for `--latest` that is deleted afterwards.
- **`src/tools/security.js`**, **`design.js`**, **`humanizer.js`**: regex-based scans that write Markdown reports. Only the security scan can fail a command.
- **`src/tools/graphify.js`**: runs native Graphify when available, otherwise a built-in scanner that records files and their import specifiers.
- **`src/tools/grill.js`**: reads answers line by line from stdin, so answers can be typed or piped.
- **`skills/`**: the bundled skill library. **`templates/`**: project documents and the 12 agent personas.

---

## 3. External commands

Every external program (`git`, `graphify`, `uv`, `python`) is started with an argument array and no shell, so file and folder names are never parsed as shell syntax. The single exception is `npm` on Windows, which is a `.cmd` shim that only a shell can start; it is always called with a fixed command string.

---

## 4. Fallbacks

1. **No Python or Graphify:** the built-in import scanner writes `.smileu/graph/graph.json`.
2. **No git or network with `--latest`:** a warning is printed and the bundled library is used.
3. **No `picocolors` or `prompts`:** output is uncoloured and `init` uses its defaults.
4. **Paths:** all path handling goes through `node:path`; paths shown to users are relative and use `/`.

---

## 5. Release pipeline

- **`scripts/release.js`** cuts a release locally: checks the tree, runs the tests, bumps `package.json` and `package-lock.json`, moves `[Unreleased]` in `CHANGELOG.md` into a dated section, commits, tags, and optionally pushes.
- **`scripts/release-notes.js`** prints one version's changelog section.
- **`.github/workflows/release.yml`** plans the release (from a chosen type, a pushed tag, or a version change on `main`), runs the tests, tags, creates or updates the GitHub Release, and publishes to GitHub Packages and, with `NPM_TOKEN`, to npm. Already-published versions are skipped.
- **`.github/workflows/ci.yml`** runs the tests on Linux, Windows and macOS with Node.js 18, 20 and 22, and checks the contents of the publishable tarball.
- **`.github/dependabot.yml`** opens weekly update pull requests for npm dependencies and GitHub Actions.
