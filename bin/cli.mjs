#!/usr/bin/env node

import path from 'node:path';
import fs from 'fs-extra';
import {
  intro,
  outro,
  select,
  multiselect,
  spinner,
  note,
  isCancel,
  cancel,
  log,
} from '@clack/prompts';
import pc from 'picocolors';

import { getAllRepositories, VIBE_REGISTRY } from '../src/registry.mjs';
import { isCommandInPath } from '../src/core/utils.mjs';
import { syncSkills, syncPersonas as installPersonas } from '../src/installers/skillAndPersonaSync.mjs';
import { installCliAndHarnesses } from '../src/installers/toolAndHarnessSync.mjs';
import { generateOrchestrationFiles } from '../src/generators/generateRouter.mjs';

const VERSION = '1.0.0';

/**
 * Print CLI help documentation.
 */
function printHelp() {
  console.log(`
${pc.bold(pc.cyan('code-skill-agents'))} v${VERSION}
Real-time orchestrator & installer for 13 official AI harnesses, personas, skills & security tools.

${pc.bold('USAGE:')}
  npx code-skill-agents [command] [target-dir] [options]
  npx github:nazalilis/smileu-code-skill-agents [command] [target-dir] [options]
  npx smileu-code-skill-agents [command] [target-dir] [options]
  npm create code-skill-agents [target-dir] [options]

${pc.bold('COMMANDS:')}
  init (default)     Install all 13 agents, skills, and tools into workspace
  update             Force re-fetch latest commits & releases from GitHub
  status, doctor     Check status and installed commit versions of all 13 components

${pc.bold('OPTIONS:')}
  -y, --yes          Directly install or update without interactive prompts (one-command setup)
  --skills-only      Install only skills, personas, and rules (bypasses external CLI binaries)
  -h, --help         Display this help message
  -v, --version      Display version information

${pc.bold('EXAMPLES:')}
  npx github:nazalilis/smileu-code-skill-agents --yes
  npx code-skill-agents@latest --yes
  npx code-skill-agents init ./my-project -y
  npx code-skill-agents update --yes
  npx code-skill-agents doctor
`);
}

/**
 * Status & Doctor command handler:
 * Inspects the workspace, verifies presence of all 13 components and contracts,
 * and prints a clean diagnostic report with resolved commit SHAs.
 *
 * @param {string} targetDir
 */
async function handleDoctor(targetDir) {
  intro(pc.bgCyan(pc.black(' 🩺 CODE SKILL AGENTS DOCTOR & STATUS ')));
  log.info(`Workspace: ${pc.bold(pc.cyan(targetDir))}`);

  const lockPath = path.join(targetDir, '.agent', 'code-skill-agents-lock.json');
  let lockData = { packages: {} };
  if (await fs.pathExists(lockPath)) {
    try {
      lockData = await fs.readJson(lockPath);
    } catch {}
  }
  const packages = lockData.packages || lockData.dependencies || {};

  const allRepos = getAllRepositories();
  let healthyCount = 0;

  console.log('\n' + pc.bold('📦 13 Official Repositories & Components:'));
  console.log('─'.repeat(80));

  for (const item of allRepos) {
    const slug = item.repo;
    const lockEntry = packages[slug];
    const commitOrVer = lockEntry?.commit || lockEntry?.version || lockEntry?.tag;
    const shortVer = commitOrVer
      ? commitOrVer.length === 40
        ? commitOrVer.slice(0, 7)
        : commitOrVer
      : pc.dim('not recorded');

    // Check disk presence
    let isPresent = false;
    if (slug === 'ruvnet/ruflo') {
      const mcpPath = path.join(targetDir, '.mcp.json');
      isPresent =
        (await fs.pathExists(mcpPath)) &&
        Boolean((await fs.readJson(mcpPath).catch(() => ({})))?.mcpServers?.ruflo);
    } else if (slug === 'NousResearch/hermes-agent') {
      isPresent =
        (await fs.pathExists(path.join(targetDir, '.agent', 'hermes-agent.json'))) ||
        (await fs.pathExists(path.join(targetDir, '.agent', 'hermes-config.json')));
    } else if (slug === 'msitarzewski/agency-agents') {
      isPresent =
        (await fs.pathExists(path.join(targetDir, '.agent', 'personas', 'agency-agents'))) ||
        (await fs.pathExists(path.join(targetDir, '.agent', 'personas', 'agency')));
    } else if (slug === 'mukul975/anthropic-cybersecurity-skills') {
      isPresent =
        (await fs.pathExists(path.join(targetDir, '.agent', 'catalog', 'cybersec'))) ||
        (await fs.pathExists(path.join(targetDir, '.agent', 'skills', 'cybersec-gateway')));
    } else if (slug === 'projectdiscovery/nuclei') {
      const exeName = process.platform === 'win32' ? 'nuclei.exe' : 'nuclei';
      isPresent =
        (await fs.pathExists(path.join(targetDir, '.agent', 'bin', exeName))) ||
        (await isCommandInPath('nuclei'));
    } else if (slug === 'Graphify-Labs/graphify') {
      isPresent =
        (await isCommandInPath('graphify')) ||
        (await fs.pathExists(path.join(targetDir, 'graphify-out')));
    } else if (slug === 'usestrix/strix') {
      isPresent = await fs.pathExists(path.join(targetDir, '.agent', 'skills', 'strix'));
    } else {
      // General skills: check if any skill exists with prefix
      const prefix = item.name.split('/')[0].toLowerCase();
      const agentSkills = path.join(targetDir, '.agent', 'skills');
      if (await fs.pathExists(agentSkills)) {
        const files = await fs.readdir(agentSkills);
        isPresent = files.some((f) => f.toLowerCase().startsWith(prefix));
      }
    }

    if (isPresent) healthyCount++;

    const statusBadge = isPresent ? pc.green('✔ Installed') : pc.yellow('○ Missing');
    const catBadge = pc.cyan(`[${item.category}]`.padEnd(12));
    const namePadded = pc.bold(slug.padEnd(42));
    const verPadded = shortVer.padEnd(14);

    console.log(`  ${catBadge} ${namePadded} ${verPadded} ${statusBadge}`);
  }

  console.log('─'.repeat(80));

  // Check orchestration files
  console.log('\n' + pc.bold('📜 Orchestration Contracts:'));
  const contracts = [
    { name: '.agent/rules/code-skill-agents.md', desc: 'Antigravity Rule Contract' },
    { name: 'AGENTS.md', desc: 'Universal Multi-Agent Standard (with Lockfile Table)' },
    { name: 'CLAUDE.md', desc: 'Claude Code & Ruflo Standard' },
    { name: '.mcp.json', desc: 'Ruflo MCP Server Configuration' },
    { name: '.agent/code-skill-agents-lock.json', desc: 'Git Commit SHA Lockfile' },
  ];

  let contractCount = 0;
  for (const c of contracts) {
    const exists = await fs.pathExists(path.join(targetDir, c.name));
    if (exists) contractCount++;
    console.log(
      `  ${exists ? pc.green('✔') : pc.red('✖')} ${pc.bold(c.name.padEnd(38))} ${pc.dim(c.desc)}`
    );
  }

  console.log('');
  if (healthyCount === allRepos.length && contractCount === contracts.length) {
    outro(
      pc.bold(
        pc.green(
          `🎉 All 13 components & contracts are fully installed and healthy! (${healthyCount}/${allRepos.length})`
        )
      )
    );
  } else {
    outro(
      pc.yellow(
        `⚡ Status: ${healthyCount}/${allRepos.length} components, ${contractCount}/${contracts.length} contracts present.\n   Run 'npx code-skill-agents init --yes' to install missing components.`
      )
    );
  }
}

/**
 * Main execution routine for init and update commands.
 */
async function runInstaller({ targetDir, isUpdate, isYes, isSkillsOnlyFlag }) {
  await fs.ensureDir(targetDir);

  let installSkillsFlag = true;
  let installPersonasFlag = true;
  let installToolsFlag = !isSkillsOnlyFlag;
  let generateRulesFlag = true;

  if (!isYes && !isSkillsOnlyFlag) {
    console.clear();
    intro(
      pc.bgCyan(
        pc.black(
          isUpdate ? ' 🔄 CODE SKILL AGENTS UPDATER ' : ' 🤖 CODE SKILL AGENTS INSTALLER '
        )
      )
    );

    log.info(`Target workspace: ${pc.bold(pc.cyan(targetDir))}`);

    const selectedMode = await select({
      message: isUpdate
        ? 'Choose update configuration:'
        : 'Choose installation configuration:',
      options: [
        {
          value: 'full',
          label: 'Full Agentic Stack (Recommended)',
          hint: '13 skills, agency personas, CLI tools & orchestration rules',
        },
        {
          value: 'skills-only',
          label: 'Skills & Personas Only',
          hint: 'Lightweight: SKILL.md, personas, and rules without CLI binaries',
        },
        {
          value: 'custom',
          label: 'Custom Selection',
          hint: 'Pick specific modules to synchronize',
        },
      ],
    });

    if (isCancel(selectedMode)) {
      cancel('Operation cancelled.');
      process.exit(0);
    }

    if (selectedMode === 'skills-only') {
      installToolsFlag = false;
    } else if (selectedMode === 'custom') {
      const chosen = await multiselect({
        message: 'Select components to synchronize:',
        options: [
          { value: 'skills', label: 'Skills (.agent/skills & .claude/skills)', initialValue: true },
          { value: 'personas', label: 'Agency Personas (.agent/personas & .claude/agents)', initialValue: true },
          { value: 'tools', label: 'CLI Tools & Harnesses (Graphify, Strix, Nuclei, Ruflo, Hermes)', initialValue: true },
          { value: 'rules', label: 'Orchestration Rules (AGENTS.md, CLAUDE.md, .agent/rules)', initialValue: true },
        ],
      });

      if (isCancel(chosen)) {
        cancel('Operation cancelled.');
        process.exit(0);
      }

      installSkillsFlag = chosen.includes('skills');
      installPersonasFlag = chosen.includes('personas');
      installToolsFlag = chosen.includes('tools');
      generateRulesFlag = chosen.includes('rules');
    }
  } else {
    // Non-interactive or skills-only banner
    intro(
      pc.bgCyan(
        pc.black(
          isUpdate ? ' 🔄 CODE SKILL AGENTS UPDATER ' : ' 🤖 CODE SKILL AGENTS INSTALLER '
        )
      )
    );
    log.info(`Target workspace: ${pc.bold(pc.cyan(targetDir))}`);
    if (isSkillsOnlyFlag) {
      log.info(pc.dim('Mode: --skills-only (bypassing external CLI binaries)'));
    }
  }

  const s = spinner();
  console.log('');

  // 1. Install / Synchronize Skills
  let skillsStats = { syncedCount: 0, catalogSkills: [] };
  if (installSkillsFlag) {
    s.start(
      isUpdate
        ? 'Re-fetching latest commits for all skills from GitHub...'
        : 'Synchronizing latest skills from GitHub registry...'
    );
    try {
      skillsStats = await syncSkills(targetDir, {
        silent: true,
        continueOnError: true,
        force: isUpdate,
        onProgress: ({ current, total, repo }) => {
          s.message(`Downloading skill [${current}/${total}]: ${repo}`);
        },
      });
      s.stop(
        `Skills synced (${skillsStats.syncedCount} active, ${skillsStats.catalogSkills.length} lazy-loaded catalog).`
      );
    } catch (err) {
      s.stop(pc.yellow(`Skill sync notice: ${err.message}`));
    }
  }

  // 2. Install Agency Personas
  if (installPersonasFlag) {
    s.start(
      isUpdate
        ? 'Updating Agency personas (msitarzewski/agency-agents)...'
        : 'Installing Agency personas (msitarzewski/agency-agents)...'
    );
    try {
      await installPersonas(targetDir, { silent: true, force: isUpdate });
      s.stop('Agency personas installed in .agent/personas/agency-agents/ & .claude/agents/agency-agents/.');
    } catch (err) {
      s.stop(pc.yellow(`Personas installation notice: ${err.message}`));
    }
  }

  // 3. Install CLI Tools and Harnesses
  let toolsResults = null;
  if (installToolsFlag) {
    s.start(
      isUpdate
        ? 'Updating CLI tools and harnesses (Graphify, Strix, Nuclei, Ruflo, Hermes)...'
        : 'Installing CLI tools and harnesses (Graphify, Strix, Nuclei, Ruflo, Hermes)...'
    );
    const toolLogger = {
      info: (msg) => {
        const clean = msg.replace(/\n/g, '').trim();
        if (clean) s.message(clean);
      },
      warn: () => {},
      error: () => {},
      log: () => {},
    };

    try {
      toolsResults = await installCliAndHarnesses(targetDir, toolLogger);
      s.stop('CLI tools and harnesses configured successfully.');
    } catch (err) {
      s.stop(pc.yellow(`CLI tools notice: ${err.message}`));
    }
  }

  // 4. Generate Orchestration Files & Rules (injecting lockfile table into AGENTS.md)
  let orchestrationResult = null;
  if (generateRulesFlag) {
    s.start(
      'Generating orchestration contracts & commit lock table (AGENTS.md, CLAUDE.md, .agent/rules)...'
    );
    try {
      orchestrationResult = await generateOrchestrationFiles(targetDir);
      s.stop('Orchestration contracts generated with latest commit locks.');
    } catch (err) {
      s.stop(pc.yellow(`Orchestration generation notice: ${err.message}`));
    }
  }

  // Final Summary Note
  const summaryLines = [
    `${pc.bold('Workspace:')} ${targetDir}`,
    installSkillsFlag
      ? `${pc.green('✔')} Skills: .agent/skills/ & .claude/skills/ (${skillsStats.syncedCount} skills)`
      : `${pc.dim('○')} Skills: skipped`,
    installSkillsFlag && skillsStats.catalogSkills.length > 0
      ? `${pc.green('✔')} Cybersecurity Gateway: .agent/catalog/cybersec/ & cybersec-gateway`
      : '',
    installPersonasFlag
      ? `${pc.green('✔')} Personas: .agent/personas/agency-agents/ & .claude/agents/agency-agents/`
      : `${pc.dim('○')} Personas: skipped`,
    installToolsFlag
      ? `${pc.green('✔')} Tools: Graphify, Strix, Nuclei (.agent/bin), Ruflo (.mcp.json), Hermes`
      : `${pc.dim('○')} Tools: skipped (--skills-only)`,
    generateRulesFlag
      ? `${pc.green('✔')} Rules: AGENTS.md, CLAUDE.md, .agent/rules/code-skill-agents.md`
      : `${pc.dim('○')} Rules: skipped`,
  ]
    .filter(Boolean)
    .join('\n');

  note(summaryLines, isUpdate ? 'Update Summary' : 'Installation Summary');

  outro(
    pc.bold(
      pc.green(
        isUpdate
          ? '🚀 Code Skill Agents successfully updated to latest commits!'
          : '🚀 Code Skill Agents is ready! Happy building.'
      )
    )
  );
}

/**
 * Entry point.
 */
async function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  if (rawArgs.includes('-v') || rawArgs.includes('--version')) {
    console.log(`code-skill-agents v${VERSION}`);
    process.exit(0);
  }

  const isYes = rawArgs.includes('-y') || rawArgs.includes('--yes');
  const isSkillsOnlyFlag = rawArgs.includes('--skills-only');

  const knownSubcommands = ['init', 'update', 'status', 'doctor'];
  const positionalArgs = rawArgs.filter((arg) => !arg.startsWith('-'));

  let command = 'init';
  let targetDirArg = null;

  if (positionalArgs.length > 0) {
    const first = positionalArgs[0].toLowerCase();
    if (knownSubcommands.includes(first)) {
      command = first;
      targetDirArg = positionalArgs[1] || null;
    } else {
      command = 'init';
      targetDirArg = positionalArgs[0];
    }
  }

  const targetDir = targetDirArg ? path.resolve(targetDirArg) : process.cwd();

  if (command === 'status' || command === 'doctor') {
    await handleDoctor(targetDir);
    return;
  }

  const isUpdate = command === 'update';
  await runInstaller({
    targetDir,
    isUpdate,
    isYes,
    isSkillsOnlyFlag,
  });
}

main().catch((err) => {
  console.error(pc.red(`\n✖ Fatal error: ${err.message}`));
  process.exit(1);
});
