import fs from 'node:fs';
import path from 'node:path';
import { printBanner, logSuccess, logInfo, logWarn, logError } from './ui.js';
import {
  PACKAGE_ROOT,
  REPOSITORIES,
  SKILLS_CATALOG,
  EDITOR_TARGETS,
  MASTER_SKILL_ID,
  resolveEditors
} from './config.js';
import { installSkills, listAvailableSkills } from './installer.js';
import { resolveSourceRoot } from './tools/source.js';
import { runGraphify } from './tools/graphify.js';
import { runSecurityAudit } from './tools/security.js';
import { runHumanizerCheck } from './tools/humanizer.js';
import { runDesignAudit } from './tools/design.js';
import { printDoctorReport, setupTools } from './tools/doctor.js';
import { runFullPipeline } from './tools/pipeline.js';
import { runGrillingSession } from './tools/grill.js';
import { runSwarmDecomposition } from './tools/swarm.js';
import { showMotionPresets } from './tools/motion.js';

export async function runCli(argv = process.argv.slice(2)) {
  printBanner();

  const command = (argv[0] || 'init').toLowerCase();
  const args = argv.slice(1);

  const isHelp = argv.includes('--help') || argv.includes('-h');
  const isVersion = argv.includes('--version') || argv.includes('-v');

  if (isVersion) {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf-8'));
    console.log(`smileu-code-skill version ${pkg.version}\n`);
    return;
  }

  if (isHelp || command === 'help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'list':
      printList(argv);
      return;
    case 'repos':
      printRepos();
      return;
    case 'doctor':
      printDoctorReport();
      return;
    case 'setup-tools':
      setupTools();
      return;
    case 'grill':
    case 'align':
      await runGrillingSession(process.cwd());
      return;
    case 'swarm':
      runSwarmDecomposition(args.filter((a) => !a.startsWith('-')).join(' ') || 'Implement core application feature', process.cwd());
      return;
    case 'motion':
      showMotionPresets(args[0] && !args[0].startsWith('-') ? args[0] : 'all');
      return;
    case 'graph':
      runGraphify({ targetDir: process.cwd() });
      return;
    case 'audit':
    case 'secure':
      runSecurityAudit(process.cwd());
      return;
    case 'humanize':
      runHumanizerCheck(process.cwd());
      return;
    case 'craft':
    case 'polish':
      runDesignAudit(process.cwd());
      return;
    case 'run-all':
    case 'pipeline':
      await runFullPipeline(process.cwd());
      return;
    case 'init':
    case 'install':
    case 'add':
      await runInstall(command, argv);
      return;
    default:
      logWarn(`Unknown command: ${command}`);
      printHelp();
  }
}

/**
 * Parses flags shared by init / install / add.
 */
function parseInstallFlags(argv) {
  const args = argv.slice(1);

  let editor = null;
  const eIdx = argv.findIndex((a) => a === '--editor' || a === '-e');
  if (eIdx !== -1 && argv[eIdx + 1]) editor = argv[eIdx + 1].toLowerCase();

  // `init cursor` shorthand: first positional (non-flag) is the editor.
  if (!editor && argv[0].toLowerCase() !== 'add' && args[0] && !args[0].startsWith('-')) {
    editor = args[0].toLowerCase();
  }

  return {
    editor,
    core: argv.includes('--core'),
    full: argv.includes('--full') || argv.includes('--all-skills'),
    latest: argv.includes('--latest'),
    dryRun: argv.includes('--dry-run'),
    yes: argv.includes('-y') || argv.includes('--yes') || argv.includes('-a') || argv.includes('--all'),
    positional: args.filter((a) => !a.startsWith('-'))
  };
}

async function runInstall(command, argv) {
  const flags = parseInstallFlags(argv);
  const targetDir = process.cwd();

  // Determine scope, editor, and interactivity.
  let scope = flags.core ? 'core' : 'full';
  let editor = flags.editor || 'all';
  let latest = flags.latest;

  if (command === 'add') {
    const skillId = flags.positional[0];
    if (!skillId) {
      logWarn('Please specify a skill to add. Example: npx smileu-code-skill add domain-modeling');
      return;
    }
    scope = [skillId];
  }

  // Interactive selection only when attached to a TTY and the user gave no
  // scope/editor flags. CI and piped runs get sane defaults with zero prompts.
  const explicit = flags.core || flags.full || flags.editor || flags.yes || command === 'add';
  const interactive = command !== 'add' && process.stdin.isTTY && !explicit;

  if (interactive) {
    const choice = await runInteractiveSelect(latest);
    if (!choice) {
      logWarn('Installation cancelled.');
      return;
    }
    ({ scope, editor, latest } = choice);
  }

  if (!resolveEditors(editor)) {
    logError(`Unknown editor "${editor}". Valid: ${Object.keys(EDITOR_TARGETS).join(', ')}, all`);
    return;
  }

  const source = resolveSourceRoot({ latest });
  try {
    const scopeLabel = Array.isArray(scope)
      ? `Single Skill [${scope.join(', ')}]`
      : scope === 'core'
        ? 'Core Suite (9 meta-skills + 12 agents)'
        : 'FULL Library (all skills + 12 agents)';

    console.log('Setting up Smileu Code Skill suite...');
    console.log(`Editor Target : ${editor === 'all' ? 'All editors' : EDITOR_TARGETS[editor].label}`);
    console.log(`Source        : ${source.engine === 'latest' ? 'Latest from upstream' : 'Bundled library'}`);
    console.log(`Scope         : ${scopeLabel}`);
    console.log(`Mode          : ${flags.dryRun ? 'DRY-RUN (simulation)' : 'LIVE INSTALL'}\n`);

    const useProgress = !flags.dryRun && process.stdout.isTTY && !Array.isArray(scope);
    let lastPct = -1;
    const onProgress = useProgress
      ? (done, total) => {
          const pct = Math.floor((done / total) * 100);
          if (pct !== lastPct && pct % 5 === 0) {
            lastPct = pct;
            process.stdout.write(`\r  Installing skills... ${pct}% (${done}/${total})   `);
          }
        }
      : null;

    const result = installSkills({
      targetDir,
      sourceRoot: source.root,
      scope,
      editor,
      includeTemplates: command === 'init',
      dryRun: flags.dryRun,
      onProgress
    });
    if (useProgress) process.stdout.write('\r' + ' '.repeat(48) + '\r');

    printInstallSummary(result, flags.dryRun);
  } finally {
    source.cleanup();
  }
}

async function runInteractiveSelect(latestFlag) {
  let prompts;
  try {
    prompts = (await import('prompts')).default;
  } catch {
    logWarn('Interactive prompts unavailable; using defaults (full library, all editors).');
    return { scope: 'full', editor: 'all', latest: latestFlag };
  }

  let cancelled = false;
  const onCancel = () => {
    cancelled = true;
    return false;
  };

  const base = await prompts(
    [
      {
        type: 'select',
        name: 'editor',
        message: 'Which editor(s) should Smileu install into?',
        choices: [
          { title: 'All editors (Claude, Cursor, Antigravity, Universal)', value: 'all' },
          ...Object.entries(EDITOR_TARGETS).map(([value, cfg]) => ({ title: cfg.label, value }))
        ],
        initial: 0
      },
      {
        type: 'select',
        name: 'scope',
        message: 'How much of the library?',
        choices: [
          { title: 'Full library (every skill + agents)', value: 'full' },
          { title: 'Core suite (9 curated meta-skills)', value: 'core' },
          { title: 'Pick specific skills...', value: 'select' }
        ],
        initial: 0
      },
      {
        type: latestFlag ? null : 'toggle',
        name: 'latest',
        message: 'Fetch the latest version from upstream (needs git + internet)?',
        initial: false,
        active: 'yes',
        inactive: 'no'
      }
    ],
    { onCancel }
  );

  if (cancelled) return null;

  const latest = latestFlag || base.latest || false;
  let scope = base.scope;

  if (scope === 'select') {
    const source = resolveSourceRoot({ latest });
    let available;
    try {
      available = listAvailableSkills(source.root);
    } finally {
      source.cleanup();
    }

    const picked = await prompts(
      {
        type: 'autocompleteMultiselect',
        name: 'skills',
        message: `Select skills (${available.length} available; ${MASTER_SKILL_ID} is always included)`,
        choices: available.map((id) => ({ title: id, value: id })),
        min: 0
      },
      { onCancel }
    );
    if (cancelled) return null;
    scope = picked.skills && picked.skills.length ? picked.skills : 'core';
  }

  return { scope, editor: base.editor, latest };
}

function printInstallSummary(result, dryRun) {
  console.log('----------------------------------------------------');
  const verb = dryRun ? 'Would install' : 'Installed';
  console.log(`${verb}: ${result.skills.length} skill(s) into ${result.editors.length} editor target(s)`);

  const preview = result.skills.slice(0, 12);
  preview.forEach((name) => console.log(`  ✔ ${name}`));
  if (result.skills.length > preview.length) {
    console.log(`  ... and ${result.skills.length - preview.length} more.`);
  }

  if (result.agents.length) {
    console.log(`\nAgent personas: ${result.agents.length}`);
    console.log(`  ${result.agents.join(', ')}`);
  }

  if (result.templates.length) {
    console.log('\nProject documents & rules:');
    result.templates.forEach((t) => console.log(`  ✔ ${t}`));
  }

  if (result.skipped.length) {
    result.skipped.forEach((s) => logWarn(`Skipped [${s.skill}]: ${s.reason}`));
  }

  console.log('----------------------------------------------------');
  if (!dryRun) {
    logSuccess('Smileu Code Skill successfully installed and activated!');
  } else {
    logInfo('Dry-run complete. No files were written.');
  }

  console.log('\nNext steps:');
  console.log('  1. Open your AI editor (Cursor, Claude Code, Antigravity, Windsurf).');
  console.log('  2. Review PRODUCT.md, CONTEXT.md, and AGENTS.md in your project root.');
  console.log('  3. Run tools (artifacts land in .smileu/, never the project root):');
  console.log('     - npx smileu-code-skill grill      (interactive alignment session)');
  console.log('     - npx smileu-code-skill graph      (knowledge graph)');
  console.log('     - npx smileu-code-skill audit      (OWASP security audit)');
  console.log('     - npx smileu-code-skill run-all    (full 6-phase pipeline)\n');
}

function printHelp() {
  console.log(`Usage:
  npx smileu-code-skill [command] [options]

Install commands:
  init [editor]        Install the full skill library + agents (default command)
  add <skill>          Install a single skill by name
  install              Alias for init

Workflow commands:
  run-all / pipeline   Execute the complete 6-Phase Pipeline end-to-end
  grill / align        Interactive grilling session (writes PRODUCT.md / CONTEXT.md)
  graph                Generate the codebase knowledge graph (Graphify)
  swarm "<task>"       Decompose a task across specialized agent personas (Ruflo)
  motion [preset]      Print physics-based UI motion curves (Emil Kowalski)
  audit / secure       Run the cybersecurity & OWASP Top 10 audit
  craft / polish       Run the anti-slop design & motion audit
  humanize             Scan docs for AI cliches and robot phrasing

Diagnostics:
  doctor               Check runtimes (Node, Git, Python, uv, Graphify)
  setup-tools          Auto-install the optional native Graphify engine
  list                 List the core meta-skills and library size
  repos                List the 8 upstream reference frameworks

Install options:
  -e, --editor <name>  cursor | claude | antigravity | windsurf | universal | all
  --core               Install only the 9 curated meta-skills (default: full library)
  --full               Force the full library (default for init)
  --latest             Pull skills from the upstream repo instead of the bundle
  -y, --yes, -a        Skip interactive prompts and use defaults
  --dry-run            Simulate the install without writing files
  -v, --version        Print the version
  -h, --help           Show this help

Notes:
  - Running with a TTY and no flags starts an interactive picker.
  - Every command writes reports/graphs/tasks into .smileu/ (auto-gitignored).

Examples:
  npx smileu-code-skill init
  npx smileu-code-skill init claude --full
  npx smileu-code-skill init --core -e cursor
  npx smileu-code-skill add domain-modeling
  npx smileu-code-skill init --latest -y
`);
}

function printList() {
  console.log('Core Meta-Skills in the Smileu Code Skill Suite:\n');
  SKILLS_CATALOG.forEach((skill, idx) => {
    console.log(`${idx + 1}. [${skill.id}] - ${skill.name}`);
    console.log(`   ${skill.description}\n`);
  });

  const skillsDir = path.join(PACKAGE_ROOT, 'skills');
  let totalSkills = 0;
  if (fs.existsSync(skillsDir)) {
    totalSkills = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md'))).length;
  }

  console.log('----------------------------------------------------');
  console.log(`Total installable skills in the bundled library: ${totalSkills}`);
  console.log('Categories:');
  console.log('  - Anthropic Cybersecurity Skills (OWASP, AD, Cloud, Network, IR)');
  console.log('  - Matt Pocock Engineering (alignment, domain modeling, ADR, TDD)');
  console.log('  - Blader Humanizer prose, Emil Kowalski motion physics');
  console.log('  - Leonxlnx Taste, Impeccable design craft, Graphify, Ruflo swarms\n');
  console.log('Install:');
  console.log('  - Full library (default) : npx smileu-code-skill init');
  console.log('  - Core suite only        : npx smileu-code-skill init --core');
  console.log('  - A single skill         : npx smileu-code-skill add <skill-name>\n');
}

function printRepos() {
  console.log('Upstream Frameworks & Repositories Synthesized:\n');
  REPOSITORIES.forEach((repo, idx) => {
    console.log(`${idx + 1}. ${repo.name} (${repo.title})`);
    console.log(`   URL: ${repo.url}`);
    console.log(`   Key Features: ${repo.features.join(' · ')}\n`);
  });
}
