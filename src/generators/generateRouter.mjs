import path from 'node:path';
import fs from 'fs-extra';
import pc from 'picocolors';

/**
 * Reads and formats lockfile entries into a Markdown table for AGENTS.md.
 *
 * @param {string} workspaceRoot
 * @returns {Promise<string>}
 */
async function formatLockfileTable(workspaceRoot) {
  const lockfilePath = path.join(workspaceRoot, '.agent', 'code-skill-agents-lock.json');
  if (!(await fs.pathExists(lockfilePath))) {
    return '_Lockfile `.agent/code-skill-agents-lock.json` will be populated upon completing package synchronization._';
  }

  try {
    const lockData = await fs.readJson(lockfilePath);
    const packages = lockData.packages || lockData.dependencies || {};
    const entries = Object.entries(packages);

    if (entries.length === 0) {
      return '_No installed packages recorded in lockfile yet._';
    }

    const rows = entries.map(([slug, meta]) => {
      const commitOrVer = meta.commit || meta.version || meta.tag || 'latest';
      const shortSha = commitOrVer.length === 40 ? commitOrVer.slice(0, 7) : commitOrVer;
      const url = meta.url || `https://github.com/${slug}`;
      const installedAt = meta.installedAt ? new Date(meta.installedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'Recent';
      const method = meta.method || meta.component || 'synced';
      return `| [\`${slug}\`](${url}) | \`${shortSha}\` | \`${installedAt}\` | \`${method}\` |`;
    });

    return [
      `| Repository / Package | Resolved Version / Commit | Installed At | Method / Component |`,
      `| :--- | :--- | :--- | :--- |`,
      ...rows,
      '',
      `*Total tracked components: ${entries.length} (Last updated: ${lockData.updatedAt || new Date().toISOString()})*`,
    ].join('\n');
  } catch (err) {
    return `_Error reading lockfile: ${err.message}_`;
  }
}

/**
 * Generates the 4 orchestration and rule files in the workspace:
 * 1. .agent/rules/code-skill-agents.md (Active Antigravity Rule)
 * 2. AGENTS.md (Universal standard for Antigravity, Codex, Cursor with Lockfile Table)
 * 3. CLAUDE.md (Claude Code & Ruflo Swarm Framework Standard)
 * 4. .mcp.json (Ruflo MCP Server configuration)
 *
 * @param {string} [workspaceRoot=process.cwd()] Target project workspace
 * @returns {Promise<{ success: boolean, files: string[] }>}
 */
export async function generateOrchestrationFiles(workspaceRoot = process.cwd()) {
  const root = path.resolve(workspaceRoot);
  const createdFiles = [];

  // =========================================================================
  // 1. .agent/rules/code-skill-agents.md (Antigravity Rule Contract)
  // =========================================================================
  const agentRulesDir = path.join(root, '.agent', 'rules');
  await fs.ensureDir(agentRulesDir);

  const agentRulePath = path.join(agentRulesDir, 'code-skill-agents.md');
  const agentRuleContent = `# Antigravity Orchestration Rules: Code Skill Agents

This active rule file coordinates all installed skills, personas, harnesses, and CLI security tools within this workspace.

---

## 1. Architecture, PRD & TDD Discipline (Graphify & Matt Pocock)
- **Codebase Mapping**: Before executing complex architectural refactors, writing specifications, or implementing multi-file features, inspect or generate the codebase knowledge graph via **Graphify** (\`graphify-out/\`).
- **PRD & Spec Authoring**: Use \`mattpocock--to-spec\`, \`mattpocock--to-tickets\`, and \`mattpocock--codebase-design\` to establish clear Product Requirement Documents (PRD) and architecture contracts before coding.
- **Strict TDD Practice**: Follow **Matt Pocock (\`mattpocock--*\`)** patterns (\`mattpocock--tdd\`, \`mattpocock--diagnosing-bugs\`). Enforce London School outside-in test-driven development, boundary separation, and type safety before writing production code.

---

## 2. Specialist Persona Delegation (Agency Agents)
- **Role Activation**: Never attempt complex tasks with generic prompting. Select and adopt the specialized mental model from \`.agent/personas/agency-agents/\` (or \`.agent/personas/agency/\`) matching the task domain:
  - Architecture & Systems: \`agency-software-architect\`, \`agency-platform-engineer\`, \`agency-database-reliability-engineer\`
  - Frontend & Experience: \`agency-frontend-developer\`, \`agency-ux-architect\`, \`agency-technical-artist\`
  - Defensive Security: \`agency-application-security-engineer\`, \`agency-penetration-tester\`, \`agency-compliance-auditor\`
  - Quality & Validation: \`agency-code-reviewer\`, \`agency-evidence-collector\`, \`agency-reality-checker\`
- Ground all advice and implementation decisions strictly in the assigned specialist persona.

---

## 3. High-Craft Frontend Synergy: The 4-Pillar Standard
Every visual component, Tailwind CSS layout, micro-interaction, GSAP animation, or Three.js/WebGL scene MUST combine the 4 design skills to guarantee high craftsmanship and eliminate generic AI slop:
1. **\`pbakaus/impeccable\` (\`pbakaus--*\`)**: Enforce elite frontend craftsmanship, pixel-perfect layout stability, strict WCAG accessibility, and zero tolerance for AI design slop.
2. **\`Leonxlnx/taste-skill\` (\`leonxlnx--*\`)**: Apply curated aesthetic taste, intentional whitespace, refined typographic hierarchies, and restrained palette harmonies.
3. **\`MengTo/skills\` (\`mengto--*\`)**: Implement modern layout systems, split panels, responsive cards, glassmorphic shells, and structured CSS design systems.
4. **\`emilkowalski/skills\` (\`emilkowalski--*\`)**: Deliver delightful micro-interactions, physics-based springs, GSAP timelines, and high-performance WebGL/Three.js visual moments.

---

## 4. Humanizer Communication & Tone
- **Zero-Jargon Heuristic**: Filter all user-facing copy, onboarding guides, dialogs, error messages, and documentation through **\`blader/humanizer\` (\`blader--humanizer\`)**.
- **Human Voice**: Strip out corporate clichés, buzzwords, artificial transitions ("In summary", "Delve into", "Furthermore"), and robotically generated phrasing. Write direct, crisp, empathetic, and human-grade communication.

---

## 5. Defensive Security & Pre-Release Verification Gates
Never ship or commit code without executing the 3-step defensive security verification:
1. **\`cybersec-gateway\`**: Route to \`.agent/catalog/cybersec/\` to check relevant threat models, OWASP checklists, and pentesting verification patterns.
2. **\`strix\`**: Run autonomous defensive web application security testing on critical application workflows and API routes.
3. **\`nuclei\`**: Run template-based vulnerability scans using \`.agent/bin/nuclei\` against endpoints, exposed headers, credentials, and infrastructure configurations to catch misconfigurations and regressions.
`;

  await fs.writeFile(agentRulePath, agentRuleContent, 'utf-8');
  createdFiles.push(agentRulePath);

  // =========================================================================
  // 2. AGENTS.md (Universal Standard with Lockfile Table)
  // =========================================================================
  const lockfileTable = await formatLockfileTable(root);
  const agentsMdPath = path.join(root, 'AGENTS.md');
  const agentsMdContent = `# Agent Orchestration Guidelines (AGENTS.md)

Welcome to this workspace. This project is powered by **Code Skill Agents**, orchestrating 13 official AI harnesses, personas, engineering skills, and security tooling into a cohesive development workflow.

---

## Workspace Layout
- \`.agent/skills/\` — Active skill specifications for Antigravity agents
- \`.claude/skills/\` — Active skill specifications for Claude Code & Ruflo
- \`.agent/personas/agency-agents/\` — 90+ specialized multidisciplinary AI personas
- \`.claude/agents/agency-agents/\` — Claude Code agency persona mirror
- \`.agent/catalog/cybersec/\` — Anthropic Cybersecurity skills catalog (lazy-loaded on demand via \`cybersec-gateway\`)
- \`.agent/bin/\` — Workspace binaries (e.g., \`nuclei\`)
- \`graphify-out/\` — Codebase knowledge graph and dependency maps generated by Graphify
- \`.agent/code-skill-agents-lock.json\` — Real-time commit SHA & version lockfile

---

## Core Agent Operating Principles

### 1. Architecture, PRD & TDD (Graphify & Matt Pocock)
- **Knowledge Graph**: Prior to major refactoring or implementing complex features, inspect or generate architecture maps using **Graphify** (\`graphify-out/\`).
- **PRD Creation**: Structure product specifications and technical requirements using \`mattpocock--to-spec\` and \`mattpocock--to-tickets\`.
- **Test-Driven Discipline**: Practice outside-in TDD using **Matt Pocock (\`mattpocock--*\`)** patterns. Write failing unit and integration tests before writing implementation code. Ensure strict TypeScript type safety without loose \`any\`.

### 2. Specialist Persona Selection (Agency Agents)
- Choose and embody domain specialist personas from \`.agent/personas/agency-agents/\` based on the active task:
  - System Design: \`agency-software-architect\`, \`agency-platform-engineer\`
  - Frontend: \`agency-frontend-developer\`, \`agency-ux-architect\`
  - Security: \`agency-application-security-engineer\`, \`agency-penetration-tester\`
  - Review: \`agency-code-reviewer\`, \`agency-reality-checker\`

### 3. Frontend & UX Excellence: 4-Pillar Synergy
Whenever creating or updating UI/UX components, Tailwind CSS styling, GSAP animations, or Three.js/WebGL scenes, you MUST combine:
- **\`pbakaus/impeccable\`**: High-craft frontend execution, pixel-perfect layouts, strict accessibility, zero AI design slop.
- **\`Leonxlnx/taste-skill\`**: Refined aesthetic curation, intentional white space, clean typography, harmonious color palettes.
- **\`MengTo/skills\`**: Modern layout structures, split-screen containers, glassmorphism, responsive cards.
- **\`emilkowalski/skills\`**: Delightful micro-interactions, spring physics, GSAP timeline choreography, fluid WebGL effects.

### 4. Humanizer Copywriting & Documentation
- Filter all copywriting, button labels, modal dialogs, error messages, PRDs, and documentation through **\`blader/humanizer\`**.
- Keep copy authentic, clear, concise, and free from repetitive AI jargon or mechanical pleasantries.

### 5. Defensive Security & Pre-Release Gates
Before approving changes or preparing a release:
1. **\`cybersec-gateway\`**: Check security requirements against \`.agent/catalog/cybersec/\`.
2. **\`strix\`**: Audit application logic for common vulnerabilities and permission bypasses.
3. **\`nuclei\`**: Run \`.agent/bin/nuclei\` against local services and configurations to verify security posture.

---

## Installed Ecosystem & Commit Lock

Below are the latest verified commits and versions synchronized from the upstream repositories:

${lockfileTable}
`;

  await fs.writeFile(agentsMdPath, agentsMdContent, 'utf-8');
  createdFiles.push(agentsMdPath);

  // =========================================================================
  // 3. CLAUDE.md (Claude Code & Ruflo Swarm Framework Standard)
  // =========================================================================
  const claudeMdPath = path.join(root, 'CLAUDE.md');
  const claudeMdContent = `# Claude Code & Ruflo Swarm Framework (CLAUDE.md)

This workspace is configured with **Code Skill Agents** for Claude Code and the Ruflo multi-agent swarm platform.

---

## Swarm Topology & Directory Mapping
- **Swarm Harness**: Ruflo Framework (\`ruvnet/ruflo\`) configured via \`.mcp.json\`.
- **Autonomous Bridge**: Hermes Agent (\`NousResearch/hermes-agent\`) configured at \`.agent/hermes-agent.json\`.
- **Skills Directory**: \`.claude/skills/\` (mirrored from \`.agent/skills/\`).
- **Personas Directory**: \`.claude/agents/agency-agents/\` and \`.agent/personas/agency-agents/\`.
- **Security Catalog**: \`.agent/catalog/cybersec/\` (lazy-loaded via \`cybersec-gateway\`).
- **Local Binaries**: \`.agent/bin/\` (e.g. \`nuclei\`).

---

## Agent Instructions & Development Workflows

### 1. Architecture, PRD & TDD Discipline
- Use **Graphify** (\`graphify-out/\`) to trace dependencies and visualize the AST before making structural modifications.
- Craft PRDs and task tickets using \`mattpocock--to-spec\` and \`mattpocock--to-tickets\`.
- Apply strict outside-in TDD using **Matt Pocock** skills (\`mattpocock--tdd\`, \`mattpocock--diagnosing-bugs\`). Never commit untested code.

### 2. Specialist Persona Selection
- Select and adopt the specialized mental model from \`.claude/agents/agency-agents/\` matching your current objective before beginning execution.

### 3. Frontend & UX: The 4-Pillar Synergy
For all frontend development, Tailwind CSS layouts, GSAP animations, and Three.js/WebGL visual effects, enforce the synergy of all 4 pillars:
- **Impeccable** (\`pbakaus--*\`): Eliminates AI design slop; mandates responsiveness and accessibility.
- **Taste** (\`leonxlnx--*\`): Guides typographic restraint, contrast, and refined aesthetics.
- **MengTo** (\`mengto--*\`): Delivers battle-tested card systems, split layouts, and modern container designs.
- **Emil Kowalski** (\`emilkowalski--*\`): Guides spring physics, micro-interactions, GSAP timelines, and WebGL polish.

### 4. Humanizer Filter
- All user-facing copywriting, UI labels, tooltips, error messages, and documentation must pass through **\`blader--humanizer\`** to maintain a natural, human voice.

### 5. Defensive Security Verifications
Before marking any feature as ready for production:
- Query \`cybersec-gateway\` (\`.agent/catalog/cybersec/\`) for domain-specific security checklists.
- Execute \`strix\` defensive audit checks.
- Run \`nuclei\` (\`.agent/bin/nuclei\` or PATH) vulnerability scans to detect misconfigurations and regressions.
`;

  await fs.writeFile(claudeMdPath, claudeMdContent, 'utf-8');
  createdFiles.push(claudeMdPath);

  // =========================================================================
  // 4. .mcp.json (Ruflo MCP Server Configuration)
  // =========================================================================
  const mcpJsonPath = path.join(root, '.mcp.json');
  let mcpConfig = {};

  if (await fs.pathExists(mcpJsonPath)) {
    try {
      mcpConfig = await fs.readJson(mcpJsonPath);
    } catch {
      mcpConfig = {};
    }
  }

  mcpConfig.mcpServers = mcpConfig.mcpServers || {};
  mcpConfig.mcpServers.ruflo = {
    command: 'npx',
    args: ['-y', 'ruflo@latest'],
  };

  await fs.writeJson(mcpJsonPath, mcpConfig, { spaces: 2 });
  createdFiles.push(mcpJsonPath);

  return {
    success: true,
    files: createdFiles,
  };
}

export default {
  generateOrchestrationFiles,
};
