# 🤖 Code Skill Agents (`code-skill-agents`)

> **One-command CLI installer and live synchronizer for 13 official AI agent harnesses, personas, engineering skills, and security tools.**

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/package/code-skill-agents)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Quick Start (One Command)

Install or update the complete multi-agent engineering stack directly into any workspace:

```bash
# Direct from GitHub repository (always the latest release):
npx github:nazalilis/smileu-code-skill-agents --yes

# Or via npm registry:
npx code-skill-agents@latest --yes

# Or create command:
npm create code-skill-agents --yes
```

---

## 🕹️ CLI Commands & Sub-commands

`code-skill-agents` provides sub-commands and flags for every workflow:

```bash
# 1. Interactive Installer (Prompt mode to pick components)
npx code-skill-agents

# 2. Non-Interactive One-Command Install (Full stack)
npx code-skill-agents init --yes
# Atau langsung:
npx github:nazalilis/smileu-code-skill-agents -y

# 3. Lightweight Skills & Personas Only (No external binaries required)
npx code-skill-agents init --yes --skills-only

# 4. Target a Specific Workspace
npx code-skill-agents init ./my-project --yes

# 5. Update / Re-fetch to Latest Commits & Releases
npx code-skill-agents update --yes

# 6. Check Health, Status & Installed Commit SHAs
npx code-skill-agents doctor
# Atau:
npx code-skill-agents status
```

---

## 🧩 The 13 Real-Time Repositories

`code-skill-agents` queries GitHub in real-time (`git ls-remote HEAD` & latest release tags) to fetch the absolute latest commits on every run, saving exact commit hashes into `.agent/code-skill-agents-lock.json`.

| Category | Repository | Integration Path | Purpose |
| :--- | :--- | :--- | :--- |
| **Harness** | [`ruvnet/ruflo`](https://github.com/ruvnet/ruflo) | `.mcp.json` | Multi-agent swarm orchestration & MCP tools |
| **Harness** | [`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) | `.agent/hermes-agent.json` | Autonomous Hermes model container/python bridge |
| **Personas** | [`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents) | `.agent/personas/agency-agents/`<br/>`.claude/agents/agency-agents/` | 90+ specialized multidisciplinary AI personas |
| **Skills** | [`MengTo/skills`](https://github.com/MengTo/skills) | `.agent/skills/mengto--*` | UI/UX layout systems & modern web components |
| **Skills** | [`emilkowalski/skills`](https://github.com/emilkowalski/skills) | `.agent/skills/emilkowalski--*` | Micro-interactions, GSAP timelines & animation polish |
| **Skills** | [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) | `.agent/skills/leonxlnx--*` | Aesthetic curation & typographic harmony |
| **Skills** | [`pbakaus/impeccable`](https://github.com/pbakaus/impeccable) | `.agent/skills/pbakaus--*` | Frontend design craftsmanship & anti-slop rules |
| **Skills** | [`mattpocock/skills`](https://github.com/mattpocock/skills) | `.agent/skills/mattpocock--*` | TypeScript patterns, TDD discipline & type safety |
| **Skills** | [`blader/humanizer`](https://github.com/blader/humanizer) | `.agent/skills/blader--*` | Anti-AI copywriting, tone heuristics & clear prose |
| **Catalog** | [`mukul975/anthropic-cybersecurity-skills`](https://github.com/mukul975/anthropic-cybersecurity-skills) | `.agent/catalog/cybersec/`<br/>`.agent/skills/cybersec-gateway/` | Lazy-loaded cybersecurity audit & threat models |
| **CLI Tool** | [`Graphify-Labs/graphify`](https://github.com/Graphify-Labs/graphify) | `graphify-out/` | Codebase architecture knowledge graph builder |
| **CLI Tool** | [`usestrix/strix`](https://github.com/usestrix/strix) | `.agent/skills/strix/` | Autonomous defensive web application security testing |
| **CLI Tool** | [`projectdiscovery/nuclei`](https://github.com/projectdiscovery/nuclei) | `.agent/bin/nuclei` | Fast, template-based vulnerability scanning binary |

---

## 🏗️ Workspace Layout

After running `code-skill-agents`, your workspace is fully dual-compatible with **Google Antigravity**, **Claude Code**, **Codex**, and **Cursor**:

```text
my-project/
├── .agent/
│   ├── rules/
│   │   └── code-skill-agents.md       # Antigravity active rule contract
│   ├── skills/                        # Antigravity active skill directory (248+ skills)
│   │   ├── mengto--*
│   │   ├── emilkowalski--*
│   │   ├── leonxlnx--*
│   │   ├── pbakaus--*
│   │   ├── mattpocock--*
│   │   ├── blader--*
│   │   ├── strix/
│   │   └── cybersec-gateway/          # Lightweight router for security skills
│   ├── personas/agency-agents/        # 90+ specialist personas
│   ├── catalog/cybersec/              # Full cybersecurity catalog (lazy-loaded)
│   ├── bin/                           # Local binaries (e.g. nuclei)
│   ├── hermes-agent.json              # Hermes agent integration config
│   └── code-skill-agents-lock.json    # Exact Git commit SHA lockfile
├── .claude/
│   ├── skills/                        # Claude Code / Ruflo skill mirror
│   └── agents/agency-agents/          # Claude Code persona mirror
├── AGENTS.md                          # Universal standard orchestration guide (with commit lock table)
├── CLAUDE.md                          # Claude Code & Ruflo swarm configuration
└── .mcp.json                          # Ruflo MCP Server configuration
```

---

## 🎯 Orchestration Guidelines

Agents operating in this workspace automatically adhere to a 5-pillar standard:

1. **Architecture, PRD & TDD First**: Inspect the codebase with **Graphify** (`graphify-out/`), generate specs via `mattpocock--to-spec`, and practice outside-in TDD (`mattpocock--tdd`).
2. **Specialist Persona Delegation**: Embody specialized personas from **Agency Agents** (`.agent/personas/agency-agents/`) for architectural, frontend, security, and review tasks.
3. **Frontend 4-Pillar Synergy (Anti-Slop)**: Every UI/UX component, Tailwind layout, GSAP animation, or Three.js/WebGL scene must combine **Impeccable** (craft & accessibility), **Taste** (aesthetic restraint), **MengTo** (modern layouts), and **Emil Kowalski** (micro-interactions & spring motion).
4. **Human Tone**: Polish all user-facing copy, labels, and documentation through **Humanizer** heuristics.
5. **Defensive Pre-Release Gate**: Audit security with **Strix**, run vulnerability checks with **Nuclei**, and reference **Anthropic Cybersecurity** threat models via `cybersec-gateway`.

---

## 🔒 Lockfile (`.agent/code-skill-agents-lock.json`)

To guarantee reproducible builds and auditable dependency tracking, every installation or update records the resolved commit SHA:

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-10-18T16:02:04.613Z",
  "packages": {
    "MengTo/skills": {
      "commit": "398cd41c86ba42fbb30e944ae507f463648f08b7",
      "installedAt": "2026-10-18T16:00:36.805Z",
      "url": "https://github.com/MengTo/skills",
      "method": "git-clone"
    },
    "projectdiscovery/nuclei": {
      "commit": "3.11.1",
      "version": "3.11.1",
      "tag": "v3.11.1",
      "binaryPath": ".agent/bin/nuclei.exe",
      "component": "cliTool"
    }
  }
}
```

The resolved versions are also automatically rendered into the **Installed Ecosystem & Commit Lock** table at the bottom of `AGENTS.md`.

---

## 🛠️ Options & Flags Reference

| Option | Shorthand | Description |
| :--- | :--- | :--- |
| `init` | *(default)* | Install all 13 agents, skills, and tools into the workspace |
| `update` | — | Force re-fetch latest commits & releases from GitHub and update lockfile |
| `status`, `doctor` | — | Check status and installed commit versions of all 13 components |
| `--yes` | `-y` | Run without interactive prompts (ideal for scripts & CI/CD) |
| `--skills-only` | — | Install only skills, personas, and rule files (bypasses external CLI tools) |
| `--help` | `-h` | Display CLI help menu |
| `--version` | `-v` | Display installed version |

---

## 📄 License

MIT © [Nazal Ilis](https://github.com/nazalilis)
