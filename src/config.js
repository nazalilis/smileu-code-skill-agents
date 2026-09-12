import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PACKAGE_ROOT = path.resolve(__dirname, '..');

// The master meta-skill. Always installed so the `/smileu` workflow is available
// regardless of which subset the user selects.
export const MASTER_SKILL_ID = 'smileu-code-skill';

// Reference library used by the `--latest` flag. Skills and agents are pulled
// from here into an OS temp directory, installed, then the temp clone is removed.
export const UPSTREAM_REPO = 'https://github.com/nazalilis/smileu-code-skill.git';

// Folder where every command writes its generated artifacts (audit reports,
// knowledge graphs, swarm task plans). Kept out of the project root and added
// to .gitignore automatically so commands never litter the workspace.
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
    description: 'The composite super-skill combining all 8 frameworks into a single unified 6-phase pipeline.'
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

// Per-editor install layout: where skills, agent personas, and the root rules
// file live for each supported AI coding tool.
export const EDITOR_TARGETS = {
  claude: {
    label: 'Claude Code',
    skills: '.claude/skills',
    agents: '.claude/agents',
    rules: 'CLAUDE.md'
  },
  cursor: {
    label: 'Cursor IDE',
    skills: '.cursor/rules',
    agents: '.cursor/agents',
    rules: '.cursorrules'
  },
  antigravity: {
    label: 'Antigravity / Gemini CLI',
    skills: '.agent/skills',
    agents: '.agent/agents',
    rules: null
  },
  windsurf: {
    label: 'Windsurf',
    skills: '.agent/skills',
    agents: '.agent/agents',
    rules: '.windsurfrules'
  },
  universal: {
    label: 'Universal Markdown (.skills/)',
    skills: '.skills',
    agents: '.skills/agents',
    rules: null
  }
};

// Which concrete editors `--editor all` expands to. Windsurf shares the
// `.agent` layout with Antigravity, so it is covered without duplication.
export const ALL_EDITORS = ['claude', 'cursor', 'antigravity', 'universal'];

export function resolveEditors(editor = 'all') {
  if (editor === 'all') return [...ALL_EDITORS];
  if (EDITOR_TARGETS[editor]) return [editor];
  return null;
}
