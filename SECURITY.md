# Security Policy: Smileu Code Skill

How to report a vulnerability, which versions receive fixes, and what the CLI does and does not protect against.

---

## 1. Supported versions

| Version | Supported |
|---|---|
| 1.x (latest minor) | Yes |
| Older | No |

---

## 2. Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately instead:

- **GitHub:** [Report a vulnerability](https://github.com/nazalilis/smileu-code-skill-agents/security/advisories/new) (private advisory)
- **Email:** security@smileu.dev

You should receive an initial assessment within 48 hours.

---

## 3. What the CLI protects against

1. **Command injection:** external programs (`git`, `graphify`, `uv`, `python`) are started with argument arrays and no shell, so a folder name containing quotes, `;`, `&`, `$` or newlines is treated as a path. `npm` on Windows is the one shell call, and it uses a fixed command string.
2. **Path traversal:** skill names passed to `add` must match a library folder exactly and cannot contain `/`, `\` or `..`. Skills are only ever written inside the chosen editor folder.
3. **Symlinks:** installs do not follow symlinks in the source library, and `update` never writes through a symlink in the workspace.
4. **Overwriting user files:** `init` never replaces existing `PRODUCT.md`, `CONTEXT.md`, `DESIGN.md`, `AGENTS.md`, rules files or agent persona files (unless `--force` is given for personas). `grill` replaces `PRODUCT.md` and `CONTEXT.md` by design and backs up the previous copies to `.smileu/backups/` first.
5. **Leaking data in output:** reports show paths relative to the project. Secret scan findings name the pattern and the file, never the matched value.
6. **Network access:** the CLI only goes online for `--latest` (git clone from GitHub), `update --check` (GitHub Releases API) and `audit` (`npm audit`). Nothing else is sent anywhere.

---

## 4. What `smileu audit` checks

- 11 credential patterns (cloud keys, GitHub and npm tokens, private keys, Stripe, Slack, OpenAI, Google, Tailscale, bearer tokens, quoted API keys) in code, config, `.env` and `.npmrc` files.
- Unquoted `KEY=value` secrets in `.env` files (not in `.env.example`, `.sample` or `.template`).
- `eval()`, `new Function()` and `child_process` calls with `shell: true`.
- `npm audit`, when a `package.json` is present.

Test and fixture folders are exempt. The command exits with code 1 when there is a critical or high finding, so it can gate a CI job. It is a pattern scan, not a full OWASP Top 10 review, and a clean result does not prove the absence of vulnerabilities.

---

## 5. Supply chain

- Releases are built and published by GitHub Actions from tagged commits; workflows request only the permissions they use.
- CodeQL scans every push and pull request to `main`.
