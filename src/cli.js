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
  NPM_PACKAGE_NAME,
  PACKAGE_NAME,
  REPOSITORIES,
  SKILLS_CATALOG,
  EDITOR_TARGETS,
  ALL_EDITORS,
  ALWAYS_INSTALLED_SKILLS,
  CORE_SKILL_COUNT,
  resolveEditors
} from './config.js';
import { installSkills, listAvailableSkills, resolveLayout } from './installer.js';
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
import {
  checkForUpdate,
  compareToLatest,
  detectInstalledSkills,
  readCliVersion,
  updateWorkspace
} from './tools/update.js';
import { detectLegacyInstall, removeLegacyInstall } from './tools/legacy.js';
import { readManifest, writeManifest } from './utils/manifest.js';
import { CLI, RUNNING_VIA_NPX } from './utils/invocation.js';

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
  // -v / --version work anywhere on the command line, like --help. A quoted
  // argument such as "fix the -v flag" is one token and does not match.
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
        logError(`"swarm" needs a task, for example: ${CLI} swarm "add rate limiting to the login endpoint"`);
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
      console.error(`Run "${CLI} --help" to see every command.`);
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
    removeOldLayout: false,
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
      case '--remove-old-layout':
        opts.removeOldLayout = true;
        break;
      case '--no-color':
        break;
      default:
        if (arg.startsWith('-')) {
          opts.errors.push(`Unknown option "${arg}". Run "${CLI} --help" to see valid options.`);
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

/**
 * Tells the user about skills that versions 1.1.1 and earlier put into folders
 * the editors do not read.
 */
function printLegacyNotice(detection) {
  if (!detection.locations.length) return;

  const where = detection.locations
    .map((l) => `${l.dir} (${plural(l.entries.length, l.kind === 'skills' ? 'skill' : 'persona file')})`)
    .join(', ');
  console.log('');
  logNotice(`Found copies from an older Smileu version in folders your editors do not read: ${where}.`);
  console.log(`  Remove them with "${CLI} update --remove-old-layout". Your own files in those folders are kept.`);
  if (detection.ruleFiles.length) {
    console.log(
      `  ${detection.ruleFiles.join(' and ')} ${detection.ruleFiles.length === 1 ? 'is' : 'are'} no longer written by Smileu. ` +
        'Delete it yourself if it only holds the old Smileu rules.'
    );
  }
}

async function runInstall(command, args) {
  const opts = parseOptions(args);
  if (opts.core && opts.full) opts.errors.push('Use either --core or --full, not both.');
  if (opts.includeNew) opts.errors.push(`--include-new only works with "${CLI} update".`);
  if (opts.check) opts.errors.push(`--check only works with "${CLI} update".`);
  if (opts.removeOldLayout) opts.errors.push(`--remove-old-layout only works with "${CLI} update".`);
  if (opts.errors.length) return reportUsageErrors(opts.errors);

  const targetDir = process.cwd();
  let scope = opts.core ? 'core' : 'full';
  let editor = opts.editor;
  let latest = opts.latest;

  if (command === 'add') {
    if (!opts.positional.length) {
      logError(`"add" needs a skill name, for example: ${CLI} add domain-modeling`);
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
        `No install scope given and no terminal to ask. Run "${CLI} init -y" for the full library in every editor, ` +
          `or pick one, for example "${CLI} init claude --core".`
      );
      return EXIT_USAGE;
    }
  }

  const source = resolveSourceRoot({ latest });
  try {
    const editors = resolveEditors(editor);
    const layout = resolveLayout(editors);
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
      Array.isArray(scope) ? scope.join(', ') : scope === 'core' ? `Core (${CORE_SKILL_COUNT} skills)` : 'Full library'
    );
    logRow('Skill folders', layout.skillDirs.join(', '));
    logRow('Mode', opts.dryRun ? 'Dry run, no files written' : 'Writing files');

    // When every name given to `add` is unknown, stop before anything is written:
    // no always-installed skills, no manifest, no .gitignore entry.
    if (command === 'add') {
      const preview = installSkills({ targetDir, sourceRoot: source.root, scope, editor, includeTemplates: false, dryRun: true });
      if (scope.every((id) => !preview.skills.includes(id))) {
        printInstallSummary(preview, { dryRun: true, command, requested: scope });
        return EXIT_FAILURE;
      }
    }

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

    if (command === 'init') printLegacyNotice(detectLegacyInstall(targetDir));

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
          { title: `All editors (${ALL_EDITORS.map((e) => EDITOR_TARGETS[e].label).join(', ')})`, value: 'all' },
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
          { title: `Core (${CORE_SKILL_COUNT} skills)`, value: 'core' },
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
        message: `Select skills (${available.length} available; ${ALWAYS_INSTALLED_SKILLS.join(' and ')} are always included)`,
        choices: available.map((id) => ({ title: id, value: id })),
        min: 0
      },
      { onCancel }
    );
    if (cancelled) return null;

    if (!picked.skills || !picked.skills.length) {
      logNotice(`No skills were picked, so the core set (${CORE_SKILL_COUNT} skills) will be installed.`);
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
    console.error(`Run "${CLI} list --all" to see every skill name.`);
    return false;
  }

  const target = plural(result.destinations.length, 'skill folder');
  console.log('');
  if (dryRun) console.log(`Would install: ${plural(result.skills.length, 'skill')} into ${target}`);

  const preview = result.skills.slice(0, 12);
  preview.forEach((name) => console.log(`  - ${name}`));
  if (result.skills.length > preview.length) {
    console.log(`  ... and ${result.skills.length - preview.length} more`);
  }

  if (result.agents.length) {
    const agentDirs = resolveLayout(result.editors).agentDirs;
    console.log(`\nAgent personas (${agentDirs.join(', ')}): ${result.agents.join(', ')}`);
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
    console.log('  1. Open this folder in your editor. If it is already open, reload the window so it picks up the new skills.');
    console.log('  2. In the editor chat, type /smileu to see the phases, or /smileu secure to run the security check.');
    if (result.templates.includes('PRODUCT.md')) {
      console.log('  3. Describe the project in PRODUCT.md and CONTEXT.md, or type /smileu align and answer the questions.');
    } else {
      console.log('  3. Keep PRODUCT.md and CONTEXT.md current; /smileu align helps update them.');
    }
    console.log('  4. From a terminal (reports go to .smileu/reports/):');
    console.log(`       ${CLI} audit      secrets, eval/new Function, npm audit`);
    console.log(`       ${CLI} run-all    every check in order`);
    console.log(`       ${CLI} update     refresh the installed skills later`);

    if (RUNNING_VIA_NPX) {
      console.log(`\nThis run used npx, so no "smileu" command was installed. Keep typing "${CLI} <command>",`);
      console.log(`or install it once with "npm install -g ${NPM_PACKAGE_NAME}" to type "smileu <command>".`);
    }
    console.log('');
  }

  return problems.length === 0;
}

async function runUpdate(args) {
  const opts = parseOptions(args);
  if (opts.core || opts.full) opts.errors.push('--core and --full only apply to "init". "update" refreshes what is already installed.');
  if (opts.force) opts.errors.push('--force only applies to "init". "update" always refreshes changed files.');
  if (opts.check && opts.removeOldLayout) opts.errors.push('Use --check on its own; it does not change any files.');
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
  if (!current) {
    logError(`Could not read this CLI's version from its package.json. Reinstall it with "npm install -g ${NPM_PACKAGE_NAME}".`);
    return EXIT_FAILURE;
  }

  if (opts.check) {
    logInfo('Checking for a newer release...');
    const latest = await checkForUpdate();
    if (!latest.ok) {
      logWarn(`Could not check for updates. ${latest.reasons.join(' ')}`);
      return EXIT_FAILURE;
    }

    const state = compareToLatest(current, latest.version);
    if (state === 'outdated') {
      logNotice(`Version ${latest.version} is available (you have ${current}).`);
      // Only suggest the registry the newest version was actually found on.
      if (latest.source === 'npm') {
        console.log(`  Upgrade: npm install -g ${NPM_PACKAGE_NAME}@latest`);
        console.log(`  Or run it once: npx ${NPM_PACKAGE_NAME}@latest update`);
      } else {
        console.log(`  Upgrade from GitHub Packages (needs npm login): npm install -g ${PACKAGE_NAME}@latest`);
      }
      if (latest.url) console.log(`  Details: ${latest.url}`);
    } else if (state === 'ahead') {
      logInfo(`This build (${current}) is newer than the latest release (${latest.version}).`);
    } else {
      logSuccess(`You have the latest release (${current}).`);
    }
    return EXIT_OK;
  }

  const targetDir = process.cwd();
  const legacy = detectLegacyInstall(targetDir, { editor });
  const installed = detectInstalledSkills(targetDir).filter((t) => editor === 'all' || t.editors.includes(editor));

  if (!installed.length) {
    if (legacy.locations.length) {
      logError(
        `Skills were found only in folders that older Smileu versions used, which your editors do not read (${legacy.locations
          .map((l) => l.dir)
          .join(', ')}). Run "${CLI} init <editor>" to install them where your editor looks, then "${CLI} update --remove-old-layout".`
      );
    } else {
      logError(
        editor === 'all'
          ? `No installed skills found in this folder. Run "${CLI} init" first.`
          : `No installed skills found for ${EDITOR_TARGETS[editor].label}. Run "${CLI} init ${editor}" first.`
      );
    }
    return EXIT_FAILURE;
  }

  let legacyFailed = false;
  if (opts.removeOldLayout) {
    logHeading('Removing copies from older Smileu versions');
    if (!legacy.locations.length) {
      logInfo('Nothing to remove: no copies from older versions were found.');
    } else {
      const { removed, failed } = removeLegacyInstall(targetDir, legacy, { dryRun: opts.dryRun });
      legacy.locations.forEach((l) => logRow(l.dir, plural(l.entries.length, l.kind === 'skills' ? 'skill' : 'persona file')));
      failed.forEach((f) => logNotice(`${f.path}: could not remove (${f.reason})`));
      legacyFailed = failed.length > 0;
      if (opts.dryRun) {
        logInfo(`Would remove ${plural(removed.length, 'old copy', 'old copies')}. Your own files in those folders are kept.`);
      } else {
        logSuccess(`Removed ${plural(removed.length, 'old copy', 'old copies')}. Your own files in those folders were kept.`);
      }
      if (legacy.ruleFiles.length) {
        logInfo(`${legacy.ruleFiles.join(' and ')} ${legacy.ruleFiles.length === 1 ? 'was' : 'were'} left in place. Delete them yourself if they only hold the old Smileu rules.`);
      }
    }
    legacy.kept.forEach((k) =>
      logNotice(`${k.dir}: kept ${k.names.join(', ')}, which ${k.names.length === 1 ? 'does' : 'do'} not match the Smileu version.`)
    );
  }

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
        logInfo(`${plural(newSkills.length, 'new skill')} are in the library. Add them with "${CLI} update --include-new".`);
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

    if (!opts.removeOldLayout) printLegacyNotice(legacy);

    return legacyFailed ? EXIT_FAILURE : EXIT_OK;
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
      logError(`No skill names contain "${filter}". Run "${CLI} list --all" to see every name.`);
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

  console.log(`\nEvery install also includes the "smileu" skill, which provides the /smileu command in your editor.`);
  console.log(`The bundled library has ${listAvailableSkills().length} skills in total.`);
  console.log('\nInstall:');
  console.log(`  Full library      ${CLI} init`);
  console.log(`  Core skills only  ${CLI} init --core`);
  console.log(`  One skill         ${CLI} add <skill-name>`);
  console.log(`  Every skill name  ${CLI} list --all [filter]\n`);
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
       npx ${NPM_PACKAGE_NAME} <command> [options]

"smileu" is available after "npm install -g ${NPM_PACKAGE_NAME}". Without a global
install, type "npx ${NPM_PACKAGE_NAME}" instead.

Install
  init [editor]          Install skills, agent personas, project documents and editor files (default command)
  add <skill...>         Install one or more skills by name
  update                 Refresh installed skills and personas from the library

Checks (reports are written to .smileu/reports/)
  audit                  Scan for hardcoded secrets, eval/new Function and npm audit issues
                         (exits 1 on critical or high findings)
  craft                  Flag pure black, bounce/elastic easing and nested cards in UI files
  humanize               Flag common AI phrases in Markdown files
  graph                  Build a file and import graph in .smileu/graph/
  run-all                Project documents, graph, craft, audit and humanize, in order

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

Editors (init, add, update)
  claude                 .claude/skills, .claude/agents, CLAUDE.md
  cursor                 .agents/skills, .cursor/agents, .cursor/rules/smileu.mdc
  windsurf               .agents/skills, .windsurf/rules/smileu.md, .windsurf/workflows/smileu.md
  antigravity            .agents/skills, .agents/rules/smileu.md
  universal              .agents/skills only
  all                    claude, cursor, windsurf and antigravity (default)

Install options (init, add)
  -e, --editor <name>    ${EDITOR_NAMES} (default: all)
  --core                 Install the ${CORE_SKILL_COUNT} core skills instead of the full library
  --latest               Use the current library on GitHub instead of the bundled copy (needs git)
  --force                Replace agent persona files that already exist
  --dry-run              Show what would be installed without writing files
  -y, --yes              Skip prompts and use the defaults

Update options
  -e, --editor <name>    Only update this editor's folders
  --latest               Update from the current library on GitHub
  --include-new          Also install library skills this project does not have yet
  --remove-old-layout    Remove the copies older versions put in .cursor/rules/, .agent/ and .skills/
  --check                Check npm and GitHub for a newer release of this CLI (writes nothing)
  --dry-run              Show what would change without writing files

Global options
  --no-color             Turn off colour (NO_COLOR is also respected)
  -v, --version          Print the version
  -h, --help             Print this help

In your editor
  /smileu [phase]        align, graph, swarm <task>, craft, polish, secure, humanize, motion, all, update

Aliases:     install = init, align = grill, secure = audit, polish = craft, pipeline = run-all
Exit codes:  0 success, 1 the command failed or found a blocking problem, 2 invalid usage

Examples
  ${CLI} init claude                 Install everything for Claude Code
  ${CLI} init --core -e cursor -y    Install the core skills for Cursor without prompts
  ${CLI} add domain-modeling         Add one skill
  ${CLI} update --include-new        Refresh skills and add new ones from the library
  ${CLI} update --check              See whether a newer release exists
  ${CLI} audit                       Write .smileu/reports/SECURITY_AUDIT.md
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
