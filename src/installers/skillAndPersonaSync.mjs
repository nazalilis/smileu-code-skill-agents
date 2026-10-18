import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import pc from 'picocolors';
import { VIBE_REGISTRY } from '../registry.mjs';
import { fetchLatestRepo } from '../core/liveFetcher.mjs';
import { isSafeCopyFile } from '../core/utils.mjs';

/**
 * Scan a directory recursively to identify all skill folders containing `SKILL.md` (or `skill.md`).
 * Dynamic recursive scan ensures future skills added upstream are automatically discovered.
 *
 * @param {string} dir Root directory of the downloaded repository
 * @param {string} fallbackName Name to use if the skill is at the root level
 * @returns {Promise<Array<{ dirPath: string, skillName: string, isRoot: boolean }>>}
 */
async function scanForSkills(dir, fallbackName) {
  const skills = [];

  async function walk(currentDir, depth = 0) {
    if (depth > 6) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name;
        if (name === '.git' || name === '.github' || name === 'node_modules' || name === '.cache') {
          continue;
        }

        const subDirPath = path.join(currentDir, name);
        const hasSkillMd =
          (await fs.pathExists(path.join(subDirPath, 'SKILL.md'))) ||
          (await fs.pathExists(path.join(subDirPath, 'skill.md')));

        if (hasSkillMd) {
          skills.push({
            dirPath: subDirPath,
            skillName: name,
            isRoot: false,
          });
        } else {
          await walk(subDirPath, depth + 1);
        }
      }
    }
  }

  await walk(dir);

  if (skills.length > 0) {
    return skills;
  }

  const rootSkillMd =
    (await fs.pathExists(path.join(dir, 'SKILL.md'))) ||
    (await fs.pathExists(path.join(dir, 'skill.md')));

  if (rootSkillMd) {
    return [
      {
        dirPath: dir,
        skillName: fallbackName,
        isRoot: true,
      },
    ];
  }

  return [];
}

/**
 * Generates lightweight gateway SKILL.md content for cybersecurity skills.
 *
 * @returns {string}
 */
function generateCybersecGatewayContent() {
  return `---
name: cybersec-gateway
description: Lightweight gateway for on-demand access to Anthropic cybersecurity audit, threat modeling, and pentesting skills cataloged in .agent/catalog/cybersec/
---

# Anthropic Cybersecurity Skills Gateway

This gateway provides on-demand routing to the Anthropic Cybersecurity Skills collection stored in \`.agent/catalog/cybersec/\`.

## Purpose
To optimize startup performance and prevent agent context window exhaustion, cybersecurity skills are cataloged separately and loaded dynamically when required.

## Catalog Location
- Primary Catalog Directory: \`.agent/catalog/cybersec/\`
- Compatibility Mirror: \`.vibe-catalog/cybersec/\`

## Instructions for Agents
1. When assigned a security analysis, penetration test, vulnerability audit, or compliance review task:
   - Search the local catalog in \`.agent/catalog/cybersec/\` for the matching skill or checklist.
2. Read the specific skill file (\`SKILL.md\`) directly from that path.
3. Follow the security instructions, rules, and scripts defined within that skill.

## Key Capabilities Available On-Demand
- Static code analysis & SAST reviews
- Vulnerability triage & exploitation risk modeling
- Security policy & CIS/NIST compliance auditing
- Cloud & container hardening verifications
- Incident response playbooks
`;
}

/**
 * Synchronize all skill repositories defined in VIBE_REGISTRY.skills.
 *
 * @param {string} [targetDir=process.cwd()] Project target directory
 * @param {object} [options={}] Configuration options
 * @param {Array} [options.skills] Optional custom list of skills to sync
 * @param {boolean} [options.silent=false] Suppress console logs
 * @param {boolean} [options.continueOnError=true] Continue sync if one repository fails
 * @param {function} [options.onProgress] Optional progress callback
 * @returns {Promise<{ success: boolean, syncedCount: number, syncedSkills: Array, catalogSkills: Array, errors: Array }>}
 */
export async function syncSkills(targetDir = process.cwd(), options = {}) {
  const resolvedTarget = path.resolve(targetDir);
  const skillsToSync = options.skills || VIBE_REGISTRY.skills || [];
  const silent = Boolean(options.silent);
  const continueOnError = options.continueOnError !== false;

  const agentSkillsDir = path.join(resolvedTarget, '.agent', 'skills');
  const claudeSkillsDir = path.join(resolvedTarget, '.claude', 'skills');
  const catalogCybersecDir = path.join(resolvedTarget, '.agent', 'catalog', 'cybersec');
  const vibeCatalogDir = path.join(resolvedTarget, '.vibe-catalog', 'cybersec');

  await fs.ensureDir(agentSkillsDir);
  await fs.ensureDir(claudeSkillsDir);

  const syncedSkills = [];
  const catalogSkills = [];
  const errors = [];

  const baseTempDir = path.join(
    os.tmpdir(),
    `csa-skills-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  try {
    if (!silent) {
      console.log(pc.cyan(`\n📦 Synchronizing skills (${skillsToSync.length} repositories)...`));
    }

    for (let i = 0; i < skillsToSync.length; i++) {
      const skillEntry = skillsToSync[i];
      const repo = skillEntry.repo;
      const isLazy = Boolean(skillEntry.lazyLoadCatalog || skillEntry.lazyLoadIndexOnly);
      const [owner, repoName] = repo.split('/');
      const namespace = (owner || skillEntry.name || 'skill').toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const tempRepoDir = path.join(baseTempDir, `${namespace}_${repoName || 'repo'}`);

      if (!silent) {
        console.log(
          pc.blue(`\n[${i + 1}/${skillsToSync.length}] `) +
            pc.bold(repo) +
            (isLazy ? pc.yellow(' (lazyLoadCatalog: true)') : '')
        );
      }

      if (typeof options.onProgress === 'function') {
        options.onProgress({
          stage: 'download',
          current: i + 1,
          total: skillsToSync.length,
          repo,
          entry: skillEntry,
        });
      }

      try {
        const fetchResult = await fetchLatestRepo(repo, tempRepoDir, {
          workspaceRoot: resolvedTarget,
          ...options,
        });

        // Special handling for lazyLoadCatalog repositories (anthropic-cybersecurity-skills)
        if (isLazy) {
          if (!silent) {
            console.log(pc.dim(`  ↳ Storing complete catalog in ${path.relative(resolvedTarget, catalogCybersecDir)}`));
          }

          await fs.ensureDir(catalogCybersecDir);
          await fs.copy(tempRepoDir, catalogCybersecDir, {
            overwrite: true,
            filter: isSafeCopyFile,
          });

          // Also mirror to .vibe-catalog/cybersec for dual compatibility
          await fs.ensureDir(vibeCatalogDir);
          await fs.copy(tempRepoDir, vibeCatalogDir, {
            overwrite: true,
            filter: isSafeCopyFile,
          });

          // Generate lightweight gateway SKILL.md in both .agent/skills and .claude/skills
          const gatewayContent = generateCybersecGatewayContent();
          const agentGatewayDir = path.join(agentSkillsDir, 'cybersec-gateway');
          const claudeGatewayDir = path.join(claudeSkillsDir, 'cybersec-gateway');

          await fs.ensureDir(agentGatewayDir);
          await fs.ensureDir(claudeGatewayDir);

          await fs.writeFile(path.join(agentGatewayDir, 'SKILL.md'), gatewayContent, 'utf-8');
          await fs.writeFile(path.join(claudeGatewayDir, 'SKILL.md'), gatewayContent, 'utf-8');

          catalogSkills.push({
            repo,
            commitSha: fetchResult.commitSha,
            catalogDir: catalogCybersecDir,
            gatewayPath: ['cybersec-gateway/SKILL.md'],
          });

          if (!silent) {
            console.log(
              pc.green(
                `  ✔ Catalog saved (${fetchResult.commitSha?.slice(0, 7) || 'latest'}) & cybersec-gateway registered.`
              )
            );
          }
        } else {
          // Dynamic recursive scan: finds all subdirectories containing SKILL.md
          const discovered = await scanForSkills(tempRepoDir, repoName || namespace);

          if (discovered.length === 0) {
            if (!silent) {
              console.log(pc.yellow(`  ⚠ No SKILL.md found in ${repo}, skipping installation.`));
            }
            continue;
          }

          for (const item of discovered) {
            const folderSlug = item.skillName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            const targetFolderName = `${namespace}--${folderSlug}`;

            const destAgent = path.join(agentSkillsDir, targetFolderName);
            const destClaude = path.join(claudeSkillsDir, targetFolderName);

            await fs.ensureDir(destAgent);
            await fs.ensureDir(destClaude);

            await fs.copy(item.dirPath, destAgent, {
              overwrite: true,
              filter: isSafeCopyFile,
            });

            await fs.copy(item.dirPath, destClaude, {
              overwrite: true,
              filter: isSafeCopyFile,
            });

            syncedSkills.push({
              repo,
              commitSha: fetchResult.commitSha,
              namespace,
              skillName: item.skillName,
              targetName: targetFolderName,
            });
          }

          if (!silent) {
            console.log(
              pc.green(
                `  ✔ Synced ${discovered.length} skill(s) [${fetchResult.commitSha?.slice(0, 7) || 'latest'}] as ${pc.bold(
                  `${namespace}--<nama-skill>`
                )}`
              )
            );
          }
        }
      } catch (err) {
        errors.push({ repo, error: err.message });
        if (!silent) {
          console.error(pc.red(`  ✖ Failed to process ${repo}: ${err.message}`));
        }
        if (!continueOnError) {
          throw err;
        }
      }
    }

    if (!silent) {
      console.log(pc.green(`\n✔ Skills synchronization completed!`));
      console.log(pc.dim(`  - Active skills synced: ${syncedSkills.length}`));
      console.log(pc.dim(`  - Lazy-loaded catalog repos: ${catalogSkills.length}`));
      if (errors.length > 0) {
        console.log(pc.yellow(`  - Repositories with notices: ${errors.length}`));
      }
    }

    return {
      success: errors.length === 0,
      syncedCount: syncedSkills.length,
      syncedSkills,
      catalogSkills,
      errors,
    };
  } finally {
    await fs.remove(baseTempDir).catch(() => {});
  }
}

/**
 * Install agency personas from msitarzewski/agency-agents to .agent/personas/agency-agents/ and .claude/agents/agency-agents/.
 *
 * @param {string} [targetDir=process.cwd()] Project target directory
 * @param {object} [options={}] Configuration options
 * @param {string} [options.repo='msitarzewski/agency-agents'] Repository identifier
 * @param {boolean} [options.silent=false] Suppress console logs
 * @returns {Promise<{ success: boolean, repo: string, commitSha: string | null, destinations: string[] }>}
 */
export async function syncPersonas(targetDir = process.cwd(), options = {}) {
  const resolvedTarget = path.resolve(targetDir);
  const repo = options.repo || VIBE_REGISTRY.personas?.[0]?.repo || 'msitarzewski/agency-agents';
  const silent = Boolean(options.silent);

  const tempPersonaDir = path.join(
    os.tmpdir(),
    `csa-personas-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  const agentPersonasDir = path.join(resolvedTarget, '.agent', 'personas', 'agency-agents');
  const claudeAgentsDir = path.join(resolvedTarget, '.claude', 'agents', 'agency-agents');

  // Compatibility mirrors for existing agent configurations
  const legacyAgentPersonasDir = path.join(resolvedTarget, '.agent', 'personas', 'agency');
  const legacyClaudeAgentsDir = path.join(resolvedTarget, '.claude', 'agents', 'agency');

  try {
    if (!silent) {
      console.log(pc.cyan(`\n👥 Synchronizing Agency Personas from ${pc.bold(repo)}...`));
    }

    await fs.ensureDir(agentPersonasDir);
    await fs.ensureDir(claudeAgentsDir);

    const fetchResult = await fetchLatestRepo(repo, tempPersonaDir, {
      workspaceRoot: resolvedTarget,
      ...options,
    });

    // Copy to primary agency-agents directories
    await fs.copy(tempPersonaDir, agentPersonasDir, {
      overwrite: true,
      filter: isSafeCopyFile,
    });

    await fs.copy(tempPersonaDir, claudeAgentsDir, {
      overwrite: true,
      filter: isSafeCopyFile,
    });

    // Copy to legacy compatibility directories
    await fs.ensureDir(legacyAgentPersonasDir);
    await fs.ensureDir(legacyClaudeAgentsDir);
    await fs.copy(tempPersonaDir, legacyAgentPersonasDir, {
      overwrite: true,
      filter: isSafeCopyFile,
    });
    await fs.copy(tempPersonaDir, legacyClaudeAgentsDir, {
      overwrite: true,
      filter: isSafeCopyFile,
    });

    if (!silent) {
      console.log(
        pc.green(`✔ Agency personas successfully installed [${fetchResult.commitSha?.slice(0, 7) || 'latest'}]:`)
      );
      console.log(pc.dim(`  - ${path.relative(resolvedTarget, agentPersonasDir) || agentPersonasDir}`));
      console.log(pc.dim(`  - ${path.relative(resolvedTarget, claudeAgentsDir) || claudeAgentsDir}`));
    }

    return {
      success: true,
      repo,
      commitSha: fetchResult.commitSha,
      destinations: [agentPersonasDir, claudeAgentsDir],
    };
  } finally {
    await fs.remove(tempPersonaDir).catch(() => {});
  }
}

/**
 * Convenience helper to synchronize both skills and agency personas.
 *
 * @param {string} [targetDir=process.cwd()]
 * @param {object} [options={}]
 * @returns {Promise<{ skills: object, personas: object }>}
 */
export async function syncAllSkillsAndPersonas(targetDir = process.cwd(), options = {}) {
  const skillsResult = await syncSkills(targetDir, options);
  const personasResult = await syncPersonas(targetDir, options);
  return { skills: skillsResult, personas: personasResult };
}

export { syncSkills as installSkills, syncPersonas as installPersonas };

export default {
  syncSkills,
  syncPersonas,
  syncAllSkillsAndPersonas,
  installSkills: syncSkills,
  installPersonas: syncPersonas,
};
