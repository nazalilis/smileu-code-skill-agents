import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PACKAGE_ROOT = path.resolve(__dirname, '..');

// The master meta-skill. Always installed so the `/smileu` workflow is available
// regardless of which subset the user selects.
export const MASTER_SKILL_ID = 'smileu-code-skill';

// The published package and the GitHub repository it is built from. Releases
// are read from this repository by `smileu update --check`.
// The GitHub Packages name matches this repository: GITHUB_TOKEN may only publish
// packages that are linked to the repository the workflow runs in.
export const PACKAGE_NAME = '@nazalilis/smileu-code-skill-agents';

// GitHub Packages only accepts scoped names, so the public npm registry gets an
// unscoped name instead. That is what makes `npx smileu-code-skill` work.
export const NPM_PACKAGE_NAME = 'smileu-code-skill';
export const GITHUB_REPO = 'nazalilis/smileu-code-skill-agents';

// Reference library used by the `--latest` flag. Skills and agents are pulled
// from here into an OS temp directory, installed, then the temp clone is removed.
export const UPSTREAM_REPO = `https://github.com/${GITHUB_REPO}.git`;

// Folder where every command writes its generated artifacts (audit reports,
// knowledge graphs, swarm task plans, the install manifest). Kept out of the
// project root and added to .gitignore automatically.
export const OUTPUT_DIR = '.smileu';

export const REPOSITORIES = [
  {
    name: 'mattpocock/skills',
    title: 'Engineering Rigor & Pre-Coding Alignment',
    url: 'https://github.com/mattpocock/skills',
    features: ['Grilling session (/grill-me)', 'Domain context dictionary (CONTEXT.md)', 'Architecture Decision Records (ADR)']
  },
  {
    name: 'Graphify-Labs/graphify',
    title: 'Codebase Knowledge Graph & Topology',
    url: 'https://github.com/Graphify-Labs/graphify',
    features: ['AST & semantic relationship extraction', 'God node detection', 'GraphRAG querying']
  },
  {
    name: 'Leonxlnx/taste-skill',
    title: 'Anti-Slop Frontend Taste',
    url: 'https://github.com/Leonxlnx/taste-skill',
    features: ['Anti-slop typography', 'Harmonic 4px/8px grid system', 'Restrained modern color palettes']
  },
  {
    name: 'ruvnet/ruflo',
    title: 'Multi-Agent Swarm Orchestration',
    url: 'https://github.com/ruvnet/ruflo',
    features: ['Agent swarm coordination', 'SPARC development methodology', 'Structured memory loops']
  },
  {
    name: 'pbakaus/impeccable',
    title: 'Impeccable Design Craft & 23 Commands',
    url: 'https://github.com/pbakaus/impeccable',
    features: ['23 precision commands (/impeccable polish, craft, audit, etc.)', 'Durable product truth (PRODUCT.md)', 'Design guidelines (DESIGN.md)']
  },
  {
    name: 'emilkowalski/skills',
    title: 'UI Motion Physics & Micro-Interactions',
    url: 'https://github.com/emilkowalski/skills',
    features: ['Ease-out for entering, ease-in for exiting', 'Natural spring dynamics', 'Subtle border & elevation treatment']
  },
  {
    name: 'blader/humanizer',
    title: 'Humanized Tone & AI Cliché Elimination',
    url: 'https://github.com/blader/humanizer',
    features: ['25 anti-AI writing patterns', 'Removal of robot clichés (delve, testament, etc.)', 'Natural humanized documentation']
  },
  {
    name: 'mukul975/Anthropic-Cybersecurity-Skills',
    title: 'Cybersecurity Hardening & OWASP Gates',
    url: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills',
    features: ['OWASP Top 10 mitigation', 'Strict input validation & sanitization', 'Zero secrets in source code']
  }
];

export const SKILLS_CATALOG = [
  {
    id: 'smileu-code-skill',
    name: 'Smileu Code Skill (Master Skill)',
    dir: 'smileu-code-skill',
    description: 'Entry skill for the /smileu workflow. Always installed.'
  },
  {
    id: 'engineering-alignment',
    name: 'Engineering Alignment',
    dir: 'engineering-alignment',
    description: 'Grilling sessions, domain dictionary (CONTEXT.md), and ADR documentation.'
  },
  {
    id: 'codebase-knowledge-graph',
    name: 'Codebase Knowledge Graph',
    dir: 'codebase-knowledge-graph',
    description: 'Architecture topology, god node detection, and GraphRAG.'
  },
  {
    id: 'frontend-taste',
    name: 'Frontend Taste',
    dir: 'frontend-taste',
    description: 'Anti-slop aesthetics, typography scales, and color discipline.'
  },
  {
    id: 'design-craft-impeccable',
    name: 'Design Craft',
    dir: 'design-craft-impeccable',
    description: '23 design craft commands, PRODUCT.md, and DESIGN.md.'
  },
  {
    id: 'motion-physics',
    name: 'UI Motion Physics',
    dir: 'motion-physics',
    description: 'Spring physics, easing curves, and micro-interaction timing.'
  },
  {
    id: 'agent-orchestration',
    name: 'Agent Orchestration',
    dir: 'agent-orchestration',
    description: 'Multi-agent swarms, SPARC workflow, and task decomposition.'
  },
  {
    id: 'humanizer-writing',
    name: 'Humanizer Writing',
    dir: 'humanizer-writing',
    description: 'Removes 25 AI clichés and robotic writing patterns.'
  },
  {
    id: 'cybersecurity-hardening',
    name: 'Cybersecurity Hardening',
    dir: 'cybersecurity-hardening',
    description: 'OWASP Top 10 defenses, input sanitization, and secret protection.'
  }
];

// The `/smileu <phase>` command. It is a skill so every supported editor can
// invoke it by folder name, and it is always installed with the master skill.
export const COMMAND_SKILL_ID = 'smileu';
export const ALWAYS_INSTALLED_SKILLS = [MASTER_SKILL_ID, COMMAND_SKILL_ID];

// How many skills `--core` installs: the catalog plus the always-installed skills.
export const CORE_SKILL_COUNT = new Set([...ALWAYS_INSTALLED_SKILLS, ...SKILLS_CATALOG.map((s) => s.dir)]).size;

// Per-editor install layout, matching the folders each tool reads:
// - skills:  folder of <skill>/SKILL.md packages
// - agents:  folder of subagent persona files, or null when the tool has none
// - files:   editor-specific rule and command files, copied from templates/
//            only when they do not exist yet
//
// Cursor, Windsurf and Antigravity all read the shared `.agents/skills` folder,
// so installing for several of them writes the library once. Claude Code only
// reads `.claude/skills`, so an install that includes Claude writes a second
// copy; Cursor reads both folders and can then list each skill twice.
export const EDITOR_TARGETS = {
  claude: {
    label: 'Claude Code',
    skills: '.claude/skills',
    agents: '.claude/agents',
    files: [{ template: 'CLAUDE.md', dest: 'CLAUDE.md' }]
  },
  cursor: {
    label: 'Cursor IDE',
    skills: '.agents/skills',
    agents: '.cursor/agents',
    files: [{ template: 'editors/cursor-rule.mdc', dest: '.cursor/rules/smileu.mdc' }]
  },
  windsurf: {
    label: 'Windsurf',
    skills: '.agents/skills',
    agents: null,
    files: [
      { template: 'editors/windsurf-rule.md', dest: '.windsurf/rules/smileu.md' },
      { template: 'editors/windsurf-workflow.md', dest: '.windsurf/workflows/smileu.md' }
    ]
  },
  antigravity: {
    label: 'Antigravity',
    skills: '.agents/skills',
    agents: null,
    files: [{ template: 'editors/antigravity-rule.md', dest: '.agents/rules/smileu.md' }]
  },
  universal: {
    label: 'Other agents (.agents/skills)',
    skills: '.agents/skills',
    agents: null,
    files: []
  }
};

// Which editors `--editor all` expands to. `universal` uses the same skills
// folder as Cursor, Windsurf and Antigravity, so it adds nothing here.
export const ALL_EDITORS = ['claude', 'cursor', 'windsurf', 'antigravity'];

// Where versions 1.1.1 and earlier put files that the editors do not read, and
// which editor each location belonged to. `update --remove-old-layout` removes
// the Smileu copies found there.
export const LEGACY_LOCATIONS = [
  { dir: '.cursor/rules', kind: 'skills', editors: ['cursor'] },
  { dir: '.agent/skills', kind: 'skills', editors: ['windsurf', 'antigravity'] },
  { dir: '.skills', kind: 'skills', editors: ['universal'] },
  { dir: '.agent/agents', kind: 'agents', editors: ['windsurf', 'antigravity'] },
  { dir: '.skills/agents', kind: 'agents', editors: ['universal'] }
];
export const LEGACY_RULE_FILES = [
  { file: '.cursorrules', editors: ['cursor'] },
  { file: '.windsurfrules', editors: ['windsurf'] }
];

export function resolveEditors(editor = 'all') {
  if (editor === 'all') return [...ALL_EDITORS];
  // hasOwnProperty, so names like "constructor" or "__proto__" are rejected
  // instead of resolving to Object.prototype members.
  if (Object.prototype.hasOwnProperty.call(EDITOR_TARGETS, editor)) return [editor];
  return null;
}
