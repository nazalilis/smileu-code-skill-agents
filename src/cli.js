import {
  printBanner,
  logSuccess,
  logInfo,
  logNotice,
  logWarn,
  logError,
  logHeading,
  logRow,
  plural
} from './ui.js';
import {
  PACKAGE_NAME,
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
import { compareToLatest, fetchLatestRelease, readCliVersion, updateWorkspace } from './tools/update.js';
import { readManifest, writeManifest } from './utils/manifest.js';

// Exit codes: 0 success, 1 the command ran but failed or found a blocking
// problem, 2 the command was used incorrectly.
const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const ALIASES = { install: 'init', align: 'grill', secure: 'audit', polish: 'craft', pipeline: 'run-all' };
const COMMANDS = [
  'init', 'add', 'update', 'list', 'repos', 'doctor', 'setup-tools', 'grill',
  'swarm', 'motion', 'graph', 'audit', 'humanize', 'craft', 'run-all', 'help'
];
const EDITOR_NAMES = `${Object.keys(EDITOR_TARGETS).join(', ')} or all`;

function finish(code) {
  process.exitCode = code;
  return code;
}

export async function runCli(argv = process.argv.slice(2)) {
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(`smileu-code-skill version ${readCliVersion()}`);
    return finish(EXIT_OK);
  }

  // `smileu --core -y` means `smileu init --core -y`: init is the default command.
  const first = argv[0];
  const flagsFirst = first === undefined || first.startsWith('-');
  const typed = flagsFirst ? 'init' : first.toLowerCase();
  const command = ALIASES[typed] || typed;
  const args = flagsFirst ? argv : argv.slice(1);

  if (command === 'help' || argv.includes('--help') || argv.includes('-h')) {
    printBanner();
    printHelp();
    return finish(EXIT_OK);
  }

  const cwd = process.cwd();
  const positional = args.filter((a) => !a.startsWith('-'));

  switch (command) {
    case 'init':
    case 'add':
      return finish(await runInstall(command, args));

    case 'update':
      return finish(await runUpdate(args));

    case 'list':
      return finish(printList(args));

    case 'repos':
      printRepos();
      return finish(EXIT_OK);

    case 'doctor':
      printDoctorReport();
      return finish(EXIT_OK);

    case 'setup-tools':
      return finish(setupTools() ? EXIT_OK : EXIT_FAILURE);

    case 'grill':
      return finish(await runGrill(cwd));

    case 'swarm': {
      const task = positional.join(' ').trim();
      if (!task) {
        logError('"swarm" needs a task, for example: smileu swarm "add rate limiting to the login endpoint"');
        return finish(EXIT_USAGE);
      }
      runSwarmDecomposition(task, cwd);
      return finish(EXIT_OK);
    }

    case 'motion':
      return finish(showMotionPresets(positional[0] || 'all') ? EXIT_OK : EXIT_USAGE);

    case 'graph':
      runGraphify({ targetDir: cwd });
      return finish(EXIT_OK);

    case 'audit':
      return finish(runSecurityAudit(cwd).failed ? EXIT_FAILURE : EXIT_OK);

    case 'humanize':
      runHumanizerCheck(cwd);
      return finish(EXIT_OK);

    case 'craft':
      runDesignAudit(cwd);
      return finish(EXIT_OK);

    case 'run-all': {
      const outcome = await runFullPipeline(cwd);
      return finish(outcome.failed ? EXIT_FAILURE : EXIT_OK);
    }

    default: {
      const guess = closestCommand(typed);
      logError(`Unknown command "${typed}".${guess ? ` Did you mean "${guess}"?` : ''}`);
      console.error('Run "smileu --help" to see every command.');
      return finish(EXIT_USAGE);
    }
  }
}

/**
 * Parses the options shared by init, add and update. Unknown options and
 * missing values are collected as errors instead of being silently ignored.
 */
function parseOptions(args) {
  const opts = {
    editor: null,
    core: false,
    full: false,
    latest: false,
    dryRun: false,
    yes: false,
    force: false,
    includeNew: false,
    check: false,
    positional: [],
    errors: []
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '-e' || arg === '--editor') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        opts.errors.push(`--editor needs a value: ${EDITOR_NAMES}.`);
      } else {
        opts.editor = value.toLowerCase();
        i += 1;
      }
      continue;
    }

    if (arg.startsWith('--editor=')) {
      const value = arg.slice('--editor='.length);
      if (value) opts.editor = value.toLowerCase();
      else opts.errors.push(`--editor needs a value: ${EDITOR_NAMES}.`);
      continue;
    }

    switch (arg) {
      case '--core':
        opts.core = true;
        break;
      case '--full':
      case '--all-skills':
        opts.full = true;
        break;
      case '--latest':
        opts.latest = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '-y':
      case '--yes':
      case '-a':
      case '--all':
        opts.yes = true;
        break;
      case '--force':
        opts.force = true;
        break;
      case '--include-new':
        opts.includeNew = true;
        break;
      case '--check':
        opts.check = true;
        break;
      case '--no-color':
        break;
      default:
        if (arg.startsWith('-')) {
          opts.errors.push(`Unknown option "${arg}". Run "smileu --help" to see valid options.`);
        } else {
          opts.positional.push(arg);
        }
    }
  }

  return opts;
}

function reportUsageErrors(errors) {
  errors.forEach((message) => logError(message));
  return EXIT_USAGE;
}

async function runInstall(command, args) {
  const opts = parseOptions(args);
  if (opts.core && opts.full) opts.errors.push('Use either --core or --full, not both.');
  if (opts.includeNew) opts.errors.push('--include-new only works with "smileu update".');
  if (opts.check) opts.errors.push('--check only works with "smileu update".');
  if (opts.errors.length) return reportUsageErrors(opts.errors);

  const targetDir = process.cwd();
  let scope = opts.core ? 'core' : 'full';
  let editor = opts.editor;
  let latest = opts.latest;

  if (command === 'add') {
    if (!opts.positional.length) {
      logError('"add" needs a skill name, for example: smileu add domain-modeling');
      return EXIT_USAGE;
    }
    if (opts.core || opts.full) {
      logError('"add" installs the skills you name. --core and --full only apply to "init".');
      return EXIT_USAGE;
    }
    scope = opts.positional;
  } else if (opts.positional.length) {
    if (editor || opts.positional.length > 1) {
      const extra = editor ? opts.positional[0] : opts.positional[1];
      logError(`Unexpected argument "${extra}". Name the editor once, as "init <editor>" or with --editor.`);
      return EXIT_USAGE;
    }
    editor = opts.positional[0].toLowerCase();
  }
  editor = editor || 'all';

  if (!resolveEditors(editor)) {
    logError(`Unknown editor "${editor}". Use ${EDITOR_NAMES}.`);
    return EXIT_USAGE;
  }

  const explicit = opts.core || opts.full || opts.editor || opts.positional.length > 0 || opts.yes;
  const canPrompt = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (command === 'init' && !explicit) {
    if (canPrompt) {
      printBanner();
      const choice = await runInteractiveSelect(latest);
      if (!choice) {
        logNotice('Installation cancelled. Nothing was written.');
        return EXIT_OK;
      }
      ({ scope, editor, latest } = choice);
    } else if (!opts.dryRun) {
      // Without a terminal there is nobody to confirm a full install into the
      // current folder, so require the choice to be spelled out.
      logError(
        'No install scope given and no terminal to ask. Run "smileu init -y" for the full library in every editor, ' +
          'or pick one, for example "smileu init claude --core".'
      );
      return EXIT_USAGE;
    }
  }

  const source = resolveSourceRoot({ latest });
  try {
    const editors = resolveEditors(editor);
    logHeading('Installing Smileu Code Skill');
    logRow(
      'Editors',
      editor === 'all'
        ? `All (${editors.map((e) => EDITOR_TARGETS[e].label).join(', ')})`
        : EDITOR_TARGETS[editor].label
    );
    logRow('Source', source.engine === 'latest' ? 'Latest from GitHub' : 'Bundled library');
    logRow(
      'Scope',
      Array.isArray(scope) ? scope.join(', ') : scope === 'core' ? `Core (${SKILLS_CATALOG.length} skills)` : 'Full library'
    );
    logRow('Mode', opts.dryRun ? 'Dry run, no files written' : 'Writing files');

    const useProgress = !opts.dryRun && process.stdout.isTTY && !Array.isArray(scope);
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
      force: opts.force,
      dryRun: opts.dryRun,
      onProgress
    });
    if (useProgress) process.stdout.write('\r' + ' '.repeat(48) + '\r');

    const ok = printInstallSummary(result, {
      dryRun: opts.dryRun,
      command,
      requested: Array.isArray(scope) ? scope : []
    });

    if (!opts.dryRun && result.skills.length) {
      writeManifest(targetDir, {
        cliVersion: readCliVersion(),
        source: source.engine,
        scope: Array.isArray(scope) ? 'custom' : scope,
        editors: result.editors,
        skills: result.skills
      });
    }

    return ok ? EXIT_OK : EXIT_FAILURE;
  } finally {
    source.cleanup();
  }
}

async function runInteractiveSelect(latestFlag) {
  let prompts;
  try {
    prompts = (await import('prompts')).default;
  } catch {
    logWarn('Interactive prompts are unavailable; using the defaults (full library, all editors).');
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
        message: 'Which editor should Smileu install into?',
        choices: [
          { title: 'All editors (Claude Code, Cursor, Antigravity, Universal)', value: 'all' },
          ...Object.entries(EDITOR_TARGETS).map(([value, cfg]) => ({ title: cfg.label, value }))
        ],
        initial: 0
      },
      {
        type: 'select',
        name: 'scope',
        message: 'How much of the library?',
        choices: [
          { title: 'Full library (every skill and agent persona)', value: 'full' },
          { title: `Core (${SKILLS_CATALOG.length} skills)`, value: 'core' },
          { title: 'Pick specific skills...', value: 'select' }
        ],
        initial: 0
      },
      {
        type: latestFlag ? null : 'toggle',
        name: 'latest',
        message: 'Use the current library from GitHub instead of the bundled copy (needs git and internet)?',
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

    if (!picked.skills || !picked.skills.length) {
      logNotice(`No skills were picked, so the core set (${SKILLS_CATALOG.length} skills) will be installed.`);
      scope = 'core';
    } else {
      scope = picked.skills;
    }
  }

  return { scope, editor: base.editor, latest };
}

/**
 * Prints what an install did and returns true when nothing was skipped or failed.
 */
function printInstallSummary(result, { dryRun, command, requested }) {
  const problems = [...result.skipped, ...result.failed];

  if (command === 'add' && requested.length && requested.every((id) => !result.skills.includes(id))) {
    result.skipped.forEach((s) => logError(`${s.skill}: ${s.reason}`));
    result.failed.forEach((f) => logError(`${f.skill}: ${f.reason}`));
    console.error('Run "smileu list --all" to see every skill name.');
    return false;
  }

  const target = plural(result.editors.length, 'editor folder');
  console.log('');
  if (dryRun) console.log(`Would install: ${plural(result.skills.length, 'skill')} into ${target}`);

  const preview = result.skills.slice(0, 12);
  preview.forEach((name) => console.log(`  - ${name}`));
  if (result.skills.length > preview.length) {
    console.log(`  ... and ${result.skills.length - preview.length} more`);
  }

  if (result.agents.length) {
    console.log(`\nAgent personas: ${result.agents.join(', ')}`);
    if (result.agentsKept) {
      console.log(`  Kept ${plural(result.agentsKept, 'existing persona file')}. Use --force to replace them.`);
    }
  }

  if (result.templates.length) {
    console.log(`\n${dryRun ? 'Would create' : 'Created'}: ${result.templates.join(', ')}`);
  }

  problems.forEach((p) => logNotice(`${p.skill}: ${p.reason}`));

  console.log('');
  if (dryRun) {
    logInfo('Dry run complete. No files were written.');
  } else if (!problems.length) {
    logSuccess(`Installed ${plural(result.skills.length, 'skill')} into ${target}.`);
  } else {
    logNotice(`Installed ${plural(result.skills.length, 'skill')} into ${target}, with ${plural(problems.length, 'problem')} listed above.`);
  }

  if (command === 'init' && !dryRun) {
    console.log('\nNext steps:');
    console.log('  1. Open the project in your AI editor.');
    if (result.templates.includes('PRODUCT.md')) {
      console.log('  2. Fill in PRODUCT.md and CONTEXT.md, or run "smileu grill" to answer 5 questions.');
    } else {
      console.log('  2. Keep PRODUCT.md and CONTEXT.md current, or run "smileu grill" to rewrite them.');
    }
    console.log('  3. Run the checks (reports go to .smileu/reports/):');
    console.log('       smileu audit      secrets, eval/new Function, npm audit');
    console.log('       smileu run-all    every check in order');
    console.log('  4. Refresh skills later with "smileu update".\n');
  }

  return problems.length === 0;
}

async function runUpdate(args) {
  const opts = parseOptions(args);
  if (opts.core || opts.full) opts.errors.push('--core and --full only apply to "init". "update" refreshes what is already installed.');
  if (opts.force) opts.errors.push('--force only applies to "init". "update" always refreshes changed files.');
  if (opts.positional.length) {
    opts.errors.push(`Unexpected argument "${opts.positional[0]}". Use --editor <name> to update one editor.`);
  }
  if (opts.errors.length) return reportUsageErrors(opts.errors);

  const editor = opts.editor || 'all';
  if (!resolveEditors(editor)) {
    logError(`Unknown editor "${editor}". Use ${EDITOR_NAMES}.`);
    return EXIT_USAGE;
  }

  const current = readCliVersion();

  if (opts.check) {
    logInfo(`Checking GitHub for a newer release of ${PACKAGE_NAME}...`);
    const latest = await fetchLatestRelease();
    if (!latest.ok) {
      logWarn(`Could not check for updates. ${latest.reason}`);
      return EXIT_FAILURE;
    }

    const state = compareToLatest(current, latest.version);
    if (state === 'outdated') {
      logNotice(`Version ${latest.version} is available (you have ${current}).`);
      console.log(`  Upgrade: npm install -g ${PACKAGE_NAME}@latest`);
      console.log(`  Or run it once: npx ${PACKAGE_NAME}@latest update`);
      if (latest.url) console.log(`  Release notes: ${latest.url}`);
    } else if (state === 'ahead') {
      logInfo(`This build (${current}) is newer than the latest release (${latest.version}).`);
    } else {
      logSuccess(`You have the latest release (${current}).`);
    }
    return EXIT_OK;
  }

  const targetDir = process.cwd();
  const manifest = readManifest(targetDir);
  const source = resolveSourceRoot({ latest: opts.latest });

  try {
    logHeading('Updating installed skills');
    logRow('Source', source.engine === 'latest' ? 'Latest from GitHub' : `Bundled library (v${current})`);
    if (manifest && manifest.cliVersion && manifest.cliVersion !== current) {
      logRow('Last install', `v${manifest.cliVersion}`);
    }
    logRow('Mode', opts.dryRun ? 'Dry run, no files written' : 'Writing changed files only');

    const result = updateWorkspace({
      targetDir,
      sourceRoot: source.root,
      editor,
      includeNew: opts.includeNew,
      dryRun: opts.dryRun
    });

    if (!result.targets.length) {
      logError(
        editor === 'all'
          ? 'No installed skills found in this folder. Run "smileu init" first.'
          : `No installed skills found for ${EDITOR_TARGETS[editor].label}. Run "smileu init ${editor}" first.`
      );
      return EXIT_FAILURE;
    }

    const installedIds = new Set();
    const missing = new Set();

    for (const t of result.targets) {
      [...t.updated, ...t.unchanged, ...t.missing, ...t.added].forEach((id) => installedIds.add(id));
      t.missing.forEach((id) => missing.add(id));

      console.log(`\n${t.skillsDir}/ (${t.editors.map((e) => EDITOR_TARGETS[e].label).join(', ')})`);
      logRow('Updated', t.updated.length <= 5 && t.updated.length ? t.updated.join(', ') : plural(t.updated.length, 'skill'));
      logRow('Unchanged', plural(t.unchanged.length, 'skill'));
      if (opts.includeNew) logRow('Added', plural(t.added.length, 'skill'));
      logRow('Agent files', `${t.agentFilesWritten} ${opts.dryRun ? 'to update' : 'updated'}`);
    }

    console.log('');
    if (missing.size) {
      logNotice(
        `${plural(missing.size, 'installed skill')} no longer exist in the library and were left as they are: ${[...missing].slice(0, 5).join(', ')}${missing.size > 5 ? ', ...' : ''}`
      );
    }
    if (result.skippedPaths.length) {
      logNotice(`Skipped ${plural(result.skippedPaths.length, 'path')} that are symlinks or not regular files.`);
    }

    if (!opts.includeNew && manifest && manifest.scope === 'full') {
      const newSkills = listAvailableSkills(source.root).filter((id) => !installedIds.has(id));
      if (newSkills.length) {
        logInfo(`${plural(newSkills.length, 'new skill')} are in the library. Add them with "smileu update --include-new".`);
      }
    }

    if (opts.dryRun) {
      logInfo(`Dry run complete. Would write ${plural(result.filesWritten, 'file')}.`);
    } else {
      writeManifest(targetDir, {
        cliVersion: current,
        source: source.engine,
        scope: opts.includeNew ? 'full' : undefined,
        editors: manifest ? [] : result.targets.flatMap((t) => t.editors),
        skills: [...installedIds].filter((id) => !missing.has(id))
      });
      if (result.filesWritten === 0) {
        logSuccess('Everything is already up to date.');
      } else {
        logSuccess(`Wrote ${plural(result.filesWritten, 'file')}.`);
      }
    }

    return EXIT_OK;
  } finally {
    source.cleanup();
  }
}

async function runGrill(cwd) {
  try {
    await runGrillingSession(cwd);
    return EXIT_OK;
  } catch (err) {
    if (err && err.code === 'SMILEU_INPUT_ENDED') {
      logError(err.message);
      return EXIT_USAGE;
    }
    throw err;
  }
}

function printList(args) {
  const showAll = args.includes('--all');
  const filter = args
    .filter((a) => !a.startsWith('-'))
    .join(' ')
    .trim()
    .toLowerCase();

  if (showAll || filter) {
    const ids = listAvailableSkills();
    const matches = filter ? ids.filter((id) => id.includes(filter)) : ids;
    if (!matches.length) {
      logError(`No skill names contain "${filter}". Run "smileu list --all" to see every name.`);
      return EXIT_FAILURE;
    }
    matches.forEach((id) => console.log(id));
    if (process.stdout.isTTY) console.log(`\n${matches.length} of ${ids.length} skills.`);
    return EXIT_OK;
  }

  logHeading('Core skills (installed with --core)');
  SKILLS_CATALOG.forEach((skill, idx) => {
    console.log(`\n${idx + 1}. ${skill.id}: ${skill.name}`);
    console.log(`   ${skill.description}`);
  });

  console.log(`\nThe bundled library has ${listAvailableSkills().length} skills in total.`);
  console.log('\nInstall:');
  console.log('  Full library      smileu init');
  console.log('  Core skills only  smileu init --core');
  console.log('  One skill         smileu add <skill-name>');
  console.log('  Every skill name  smileu list --all [filter]\n');
  return EXIT_OK;
}

function printRepos() {
  logHeading('Upstream projects');
  REPOSITORIES.forEach((repo, idx) => {
    console.log(`\n${idx + 1}. ${repo.name} (${repo.title})`);
    console.log(`   URL: ${repo.url}`);
    console.log(`   Covers: ${repo.features.join('; ')}`);
  });
  console.log('');
}

function printHelp() {
  console.log(`Usage: smileu <command> [options]
       npx ${PACKAGE_NAME} <command> [options]

Install
  init [editor]          Install skills, agent personas and project templates (default command)
  add <skill...>         Install one or more skills by name
  update                 Refresh installed skills and personas from the library

Checks (reports are written to .smileu/reports/)
  audit                  Scan for hardcoded secrets, eval/new Function and npm audit issues
                         (exits 1 on critical or high findings)
  craft                  Flag pure black, bounce/elastic easing and nested cards in UI files
  humanize               Flag common AI phrases in Markdown files
  graph                  Build a file and import graph in .smileu/graph/
  run-all                Templates, graph, craft, audit and humanize, in order

Planning
  grill                  Ask 5 questions, then write PRODUCT.md and CONTEXT.md
                         (existing copies are backed up to .smileu/backups/)
  swarm "<task>"         Save a 5-role task checklist to .smileu/tasks/
  motion [preset]        Print easing presets: enter, exit, hover, modal (default: all)

Setup
  doctor                 Check Node.js, Git, Python, uv and Graphify
  setup-tools            Install Graphify with uv, or with pip when uv is missing
  list [--all] [filter]  List the core skills, or every skill name
  repos                  List the upstream projects

Install options (init, add)
  -e, --editor <name>    ${EDITOR_NAMES} (default: all)
  --core                 Install the ${SKILLS_CATALOG.length} core skills instead of the full library
  --latest               Use the current library on GitHub instead of the bundled copy (needs git)
  --force                Replace agent persona files that already exist
  --dry-run              Show what would be installed without writing files
  -y, --yes              Skip prompts and use the defaults

Update options
  -e, --editor <name>    Only update this editor's folders
  --latest               Update from the current library on GitHub
  --include-new          Also install library skills this project does not have yet
  --check                Check GitHub for a newer release of this CLI (writes nothing)
  --dry-run              Show what would change without writing files

Global options
  --no-color             Turn off colour (NO_COLOR is also respected)
  -v, --version          Print the version
  -h, --help             Print this help

Aliases:     install = init, align = grill, secure = audit, polish = craft, pipeline = run-all
Exit codes:  0 success, 1 the command failed or found a blocking problem, 2 invalid usage

Examples
  smileu init claude                 Install everything for Claude Code
  smileu init --core -e cursor -y    Install the core skills for Cursor without prompts
  smileu add domain-modeling         Add one skill
  smileu update --include-new        Refresh skills and add new ones from the library
  smileu update --check              See whether a newer release exists
  smileu audit                       Write .smileu/reports/SECURITY_AUDIT.md
  smileu motion enter                Print the enter preset
`);
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

function closestCommand(typed) {
  let best = null;
  let bestDistance = Infinity;
  for (const name of [...COMMANDS, ...Object.keys(ALIASES)]) {
    const d = editDistance(typed, name);
    if (d < bestDistance) {
      best = name;
      bestDistance = d;
    }
  }
  return bestDistance <= 2 ? best : null;
}
