import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { execa } from 'execa';
import pc from 'picocolors';
import { isCommandInPath, isSafeCopyFile, createLogger } from '../core/utils.mjs';
import { fetchLatestRepo, getLatestCommitSha, recordLockEntry } from '../core/liveFetcher.mjs';

/**
 * Resolves the latest Nuclei release metadata, version, and download URL with rate-limit resilience.
 *
 * @param {string} osName OS identifier (windows, macOS, linux)
 * @param {string} archName CPU architecture (amd64, arm64, 386)
 * @returns {Promise<{ version: string, tag: string, downloadUrl: string, assetName: string }>}
 */
async function resolveLatestNucleiRelease(osName, archName) {
  // Strategy 1: GitHub REST API (if available and not rate limited)
  try {
    const apiUrl = 'https://api.github.com/repos/projectdiscovery/nuclei/releases/latest';
    const headers = {
      'User-Agent': 'code-skill-agents-installer',
      Accept: 'application/vnd.github.v3+json',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    };

    const res = await fetch(apiUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      const tag = data.tag_name || 'v3.11.1';
      const cleanVer = tag.replace(/^v/, '');
      const assets = data.assets || [];

      const matched =
        assets.find((a) => {
          const n = a.name.toLowerCase();
          return n.includes(osName.toLowerCase()) && n.includes(archName.toLowerCase()) && n.endsWith('.zip');
        }) ||
        assets.find((a) => {
          const n = a.name.toLowerCase();
          return n.includes(osName.toLowerCase()) && n.endsWith('.zip');
        });

      if (matched) {
        return {
          version: cleanVer,
          tag,
          downloadUrl: matched.browser_download_url,
          assetName: matched.name,
        };
      }
    }
  } catch {
    // Continue to fallback
  }

  // Strategy 2: HTTP redirect on releases/latest (Zero REST API rate limit impact)
  try {
    const redirectRes = await fetch('https://github.com/projectdiscovery/nuclei/releases/latest', {
      redirect: 'manual',
    });
    const location = redirectRes.headers.get('location') || '';
    const tagMatch = location.match(/releases\/tag\/(v?[0-9]+\.[0-9]+\.[0-9]+)/);
    const tag = tagMatch ? tagMatch[1] : 'v3.11.1';
    const cleanVer = tag.replace(/^v/, '');
    const assetName = `nuclei_${cleanVer}_${osName}_${archName}.zip`;
    const downloadUrl = `https://github.com/projectdiscovery/nuclei/releases/download/${tag}/${assetName}`;

    return {
      version: cleanVer,
      tag,
      downloadUrl,
      assetName,
    };
  } catch {
    // Strategy 3: Pinned stable fallback URL
    const fallbackTag = 'v3.11.1';
    const fallbackVer = '3.11.1';
    const assetName = `nuclei_${fallbackVer}_${osName}_${archName}.zip`;
    return {
      version: fallbackVer,
      tag: fallbackTag,
      downloadUrl: `https://github.com/projectdiscovery/nuclei/releases/download/${fallbackTag}/${assetName}`,
      assetName,
    };
  }
}

/**
 * Installs or updates the 5 core tools and harnesses to their absolute latest versions:
 * 1. ruvnet/ruflo: npx -y ruflo@latest init & .mcp.json ruflo@latest configuration
 * 2. Graphify-Labs/graphify: uv tool install --upgrade "graphifyy[leiden]" -> pipx install --force graphifyy -> graphify install
 * 3. usestrix/strix: npx -y skills@latest add usestrix/strix & live fetch to .agent/skills/strix/
 * 4. projectdiscovery/nuclei: query latest GitHub release, download & extract to .agent/bin/ with rate-limit fallback
 * 5. NousResearch/hermes-agent: live commit check & .agent/hermes-agent.json bridge configuration
 *
 * @param {string} [workspaceRoot=process.cwd()]
 * @param {object} [logger=console]
 * @returns {Promise<{ success: boolean, results: object }>}
 */
export async function syncToolsAndHarnesses(workspaceRoot = process.cwd(), logger = console) {
  const root = path.resolve(workspaceRoot);
  const log = createLogger(logger);

  const results = {
    ruflo: { initialized: false, method: null },
    graphify: { installed: false, method: null },
    strix: { installed: false, syncedSkill: false },
    nuclei: { installed: false, version: null, path: null },
    hermes: { configured: false, configPath: null },
  };

  log.info(pc.bold(pc.cyan('\n🔧 Synchronizing CLI Tools & Harnesses to Latest Versions...')));

  // =========================================================================
  // 1. ruvnet/ruflo
  // =========================================================================
  try {
    log.info(pc.cyan('\n[1/5] Updating Ruflo harness (ruvnet/ruflo)...'));
    let rufloSuccess = false;

    try {
      log.info(pc.dim('  ↳ Running: npx -y ruflo@latest init...'));
      await execa('npx', ['-y', 'ruflo@latest', 'init'], {
        cwd: root,
        stdio: 'ignore',
        timeout: 15000,
      });
      rufloSuccess = true;
      results.ruflo.initialized = true;
      results.ruflo.method = 'cli-init';
      log.success(pc.green('  ✔ Ruflo harness initialized via CLI.'));
    } catch (cliErr) {
      log.warn(pc.yellow(`  ⚠ Ruflo CLI init notice (${cliErr.message}). Ensuring .mcp.json uses ruflo@latest...`));
    }

    // Always ensure .mcp.json has ruflo@latest
    const mcpPath = path.join(root, '.mcp.json');
    let mcpConfig = {};

    if (await fs.pathExists(mcpPath)) {
      try {
        mcpConfig = await fs.readJson(mcpPath);
      } catch {
        mcpConfig = {};
      }
    }

    mcpConfig.mcpServers = mcpConfig.mcpServers || {};
    mcpConfig.mcpServers.ruflo = {
      command: 'npx',
      args: ['-y', 'ruflo@latest'],
    };

    await fs.writeJson(mcpPath, mcpConfig, { spaces: 2 });
    results.ruflo.initialized = true;
    if (!rufloSuccess) results.ruflo.method = 'mcp-json';
    log.success(pc.green(`  ✔ Ruflo MCP configuration updated in ${path.relative(root, mcpPath) || '.mcp.json'}`));

    await recordLockEntry(root, 'ruvnet/ruflo', 'latest', {
      method: results.ruflo.method,
      component: 'harness',
    }).catch(() => {});
  } catch (err) {
    results.ruflo.error = err.message;
    log.warn(pc.yellow(`  ⚠ Ruflo setup notice: ${err.message}`));
  }

  // =========================================================================
  // 2. Graphify-Labs/graphify
  // =========================================================================
  try {
    log.info(pc.cyan('\n[2/5] Installing/Upgrading Graphify (Graphify-Labs/graphify)...'));
    let graphifyReady = false;

    const hasUv = await isCommandInPath('uv');
    const hasPipx = await isCommandInPath('pipx');
    const hasPip = await isCommandInPath('pip');

    // Attempt 1: uv tool install --upgrade
    if (hasUv) {
      try {
        log.info(pc.dim('  ↳ Running: uv tool install --upgrade "graphifyy[leiden]"...'));
        await execa('uv', ['tool', 'install', '--upgrade', 'graphifyy[leiden]'], {
          stdio: 'ignore',
          timeout: 45000,
        });
        graphifyReady = true;
        results.graphify.method = 'uv tool install --upgrade';
      } catch {}
    }

    // Attempt 2: pipx install --force graphifyy
    if (!graphifyReady && hasPipx) {
      try {
        log.info(pc.dim('  ↳ Fallback: running pipx install --force graphifyy...'));
        await execa('pipx', ['install', '--force', 'graphifyy'], {
          stdio: 'ignore',
          timeout: 45000,
        });
        graphifyReady = true;
        results.graphify.method = 'pipx install --force';
      } catch {}
    }

    // Attempt 3: pip install --upgrade graphifyy
    if (!graphifyReady && hasPip) {
      try {
        log.info(pc.dim('  ↳ Fallback: running pip install --upgrade graphifyy...'));
        await execa('pip', ['install', '--upgrade', 'graphifyy'], {
          stdio: 'ignore',
          timeout: 45000,
        });
        graphifyReady = true;
        results.graphify.method = 'pip install --upgrade';
      } catch {}
    }

    // If still not ready, check if graphify binary is already in PATH
    if (!graphifyReady) {
      graphifyReady = await isCommandInPath('graphify');
      if (graphifyReady) {
        results.graphify.method = 'existing-in-path';
      } else {
        log.warn(
          pc.yellow(
            '  ⚠ Python / uv / pipx not detected or installation skipped. You can install Graphify later with: uv tool install "graphifyy[leiden]"'
          )
        );
      }
    }

    if (graphifyReady) {
      try {
        log.info(pc.dim('  ↳ Running: graphify install in workspace...'));
        await execa('graphify', ['install'], {
          cwd: root,
          stdio: 'ignore',
          timeout: 30000,
        });
        results.graphify.installed = true;
        log.success(pc.green(`  ✔ Graphify installed and initialized (${results.graphify.method}).`));
      } catch (err) {
        results.graphify.installed = true;
        log.warn(pc.yellow(`  ⚠ graphify install command note: ${err.message}`));
      }

      await recordLockEntry(root, 'Graphify-Labs/graphify', 'latest', {
        method: results.graphify.method,
        component: 'cliTool',
      }).catch(() => {});
    }
  } catch (err) {
    results.graphify.error = err.message;
    log.warn(pc.yellow(`  ⚠ Graphify setup notice: ${err.message}`));
  }

  // =========================================================================
  // 3. usestrix/strix
  // =========================================================================
  try {
    log.info(pc.cyan('\n[3/5] Installing Strix defensive security audit skill (usestrix/strix)...'));

    // Step A: Run npx -y skills@latest add usestrix/strix
    try {
      log.info(pc.dim('  ↳ Running: npx -y skills@latest add usestrix/strix...'));
      await execa('npx', ['-y', 'skills@latest', 'add', 'usestrix/strix'], {
        cwd: root,
        stdio: 'ignore',
        timeout: 20000,
      });
      results.strix.installed = true;
      log.success(pc.green('  ✔ Strix skill added via skills CLI.'));
    } catch (cliErr) {
      log.warn(pc.yellow(`  ⚠ skills CLI note: ${cliErr.message}. Syncing latest repo files directly...`));
    }

    // Step B: Live fetch repo directly to .agent/skills/strix/ and .claude/skills/strix/
    const tempStrixDir = path.join(
      os.tmpdir(),
      `csa-strix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    );

    try {
      const fetchResult = await fetchLatestRepo('usestrix/strix', tempStrixDir, {
        workspaceRoot: root,
      });

      const agentStrixDest = path.join(root, '.agent', 'skills', 'strix');
      const claudeStrixDest = path.join(root, '.claude', 'skills', 'strix');

      await fs.ensureDir(agentStrixDest);
      await fs.ensureDir(claudeStrixDest);

      await fs.copy(tempStrixDir, agentStrixDest, { overwrite: true, filter: isSafeCopyFile });
      await fs.copy(tempStrixDir, claudeStrixDest, { overwrite: true, filter: isSafeCopyFile });

      results.strix.syncedSkill = true;
      results.strix.installed = true;
      log.success(
        pc.green(`  ✔ Strix latest security skill synced [${fetchResult.commitSha?.slice(0, 7) || 'latest'}] to .agent/skills/strix/`)
      );
    } finally {
      await fs.remove(tempStrixDir).catch(() => {});
    }
  } catch (err) {
    results.strix.error = err.message;
    log.warn(pc.yellow(`  ⚠ Strix setup notice: ${err.message}`));
  }

  // =========================================================================
  // 4. projectdiscovery/nuclei
  // =========================================================================
  try {
    log.info(pc.cyan('\n[4/5] Checking latest Nuclei vulnerability scanner (projectdiscovery/nuclei)...'));

    const platformMap = {
      win32: 'windows',
      darwin: 'macOS',
      linux: 'linux',
    };
    const archMap = {
      x64: 'amd64',
      arm64: 'arm64',
      ia32: '386',
      arm: 'arm',
    };

    const osName = platformMap[process.platform] || process.platform;
    const archName = archMap[process.arch] || process.arch;

    const binDir = path.join(root, '.agent', 'bin');
    const binaryName = process.platform === 'win32' ? 'nuclei.exe' : 'nuclei';
    const localBinaryPath = path.join(binDir, binaryName);

    // Resolve latest release info (with rate-limit fallback)
    const release = await resolveLatestNucleiRelease(osName, archName);
    log.info(pc.dim(`  ↳ Latest remote version: ${release.tag}`));

    let currentVersion = null;

    if (await fs.pathExists(localBinaryPath)) {
      try {
        const { stdout } = await execa(localBinaryPath, ['-version'], { stdio: 'pipe', timeout: 5000 });
        const m = stdout.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
        if (m) currentVersion = m[1];
      } catch {}
    } else if (await isCommandInPath('nuclei')) {
      try {
        const { stdout } = await execa('nuclei', ['-version'], { stdio: 'pipe', timeout: 5000 });
        const m = stdout.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
        if (m) currentVersion = m[1];
      } catch {}
    }

    const needsDownload = !currentVersion || currentVersion !== release.version;

    if (!needsDownload) {
      results.nuclei.installed = true;
      results.nuclei.version = currentVersion;
      results.nuclei.path = localBinaryPath;
      log.success(pc.green(`  ✔ Nuclei is already up-to-date (v${currentVersion}).`));
    } else {
      log.info(
        pc.dim(
          `  ↳ Downloading Nuclei ${release.tag} (${release.assetName}) from GitHub...`
        )
      );

      const downloadRes = await fetch(release.downloadUrl);
      if (!downloadRes.ok) {
        throw new Error(`Failed to download Nuclei asset: HTTP ${downloadRes.status}`);
      }

      const zipBuffer = Buffer.from(await downloadRes.arrayBuffer());
      const tempZipPath = path.join(
        os.tmpdir(),
        `nuclei-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.zip`
      );

      await fs.writeFile(tempZipPath, zipBuffer);
      await fs.ensureDir(binDir);

      // Extract archive
      try {
        await execa('tar', ['-xf', tempZipPath, '-C', binDir], {
          stdio: 'ignore',
          timeout: 20000,
        });
      } catch {
        if (process.platform === 'win32') {
          await execa(
            'powershell',
            [
              '-NoProfile',
              '-Command',
              `Expand-Archive -Path "${tempZipPath}" -DestinationPath "${binDir}" -Force`,
            ],
            { stdio: 'ignore', timeout: 30000 }
          );
        } else {
          await execa('unzip', ['-o', tempZipPath, '-d', binDir], {
            stdio: 'ignore',
            timeout: 20000,
          });
        }
      } finally {
        await fs.remove(tempZipPath).catch(() => {});
      }

      if (process.platform !== 'win32' && (await fs.pathExists(localBinaryPath))) {
        await fs.chmod(localBinaryPath, 0o755).catch(() => {});
      }

      results.nuclei.installed = true;
      results.nuclei.version = release.version;
      results.nuclei.path = localBinaryPath;

      log.success(
        pc.green(
          `  ✔ Nuclei ${release.tag} installed successfully to ${path.relative(root, localBinaryPath) || localBinaryPath}`
        )
      );
    }

    await recordLockEntry(root, 'projectdiscovery/nuclei', release.version, {
      tag: release.tag,
      binaryPath: path.relative(root, localBinaryPath) || localBinaryPath,
      component: 'cliTool',
    }).catch(() => {});
  } catch (err) {
    results.nuclei.error = err.message;
    log.warn(pc.yellow(`  ⚠ Nuclei setup notice: ${err.message}`));
  }

  // =========================================================================
  // 5. NousResearch/hermes-agent
  // =========================================================================
  try {
    log.info(pc.cyan('\n[5/5] Configuring Hermes Agent integration (NousResearch/hermes-agent)...'));

    const agentDir = path.join(root, '.agent');
    await fs.ensureDir(agentDir);

    const latestCommit = await getLatestCommitSha('NousResearch/hermes-agent').catch(() => null);

    const hermesConfig = {
      name: 'hermes-agent',
      repository: 'NousResearch/hermes-agent',
      url: 'https://github.com/NousResearch/hermes-agent',
      latestCommit: latestCommit || 'latest',
      mode: 'bridge',
      updatedAt: new Date().toISOString(),
      docker: {
        image: 'nousresearch/hermes-agent:latest',
        containerName: 'hermes-agent-bridge',
        ports: ['8000:8000'],
        volumes: [
          '.:/workspace',
          '.agent:/workspace/.agent',
          '.claude:/workspace/.claude',
        ],
        environment: {
          HERMES_ENV: 'production',
          WORKSPACE_ROOT: '/workspace',
          SKILLS_PATH: '/workspace/.agent/skills',
          PERSONAS_PATH: '/workspace/.agent/personas/agency-agents',
          CATALOG_PATH: '/workspace/.agent/catalog/cybersec',
        },
      },
      python: {
        package: 'hermes-agent',
        entrypoint: 'hermes_agent.main:app',
        host: '127.0.0.1',
        port: 8000,
      },
      bridge: {
        protocol: 'http',
        endpoint: 'http://127.0.0.1:8000',
        skillsDirectory: '.agent/skills',
        personasDirectory: '.agent/personas/agency-agents',
        catalogDirectory: '.agent/catalog/cybersec',
      },
    };

    const hermesAgentPath = path.join(agentDir, 'hermes-agent.json');
    const hermesConfigPath = path.join(agentDir, 'hermes-config.json');

    await fs.writeJson(hermesAgentPath, hermesConfig, { spaces: 2 });
    await fs.writeJson(hermesConfigPath, hermesConfig, { spaces: 2 });

    results.hermes.configured = true;
    results.hermes.configPath = hermesAgentPath;

    log.success(
      pc.green(
        `  ✔ Hermes Agent integration configured [${latestCommit?.slice(0, 7) || 'latest'}] at ${path.relative(root, hermesAgentPath)}`
      )
    );

    await recordLockEntry(root, 'NousResearch/hermes-agent', latestCommit || 'latest', {
      configPath: path.relative(root, hermesAgentPath),
      component: 'harness',
    }).catch(() => {});
  } catch (err) {
    results.hermes.error = err.message;
    log.warn(pc.yellow(`  ⚠ Hermes Agent configuration notice: ${err.message}`));
  }

  const allCompleted =
    results.ruflo.initialized &&
    results.graphify.installed &&
    results.strix.installed &&
    results.nuclei.installed &&
    results.hermes.configured;

  return {
    success: allCompleted,
    results,
  };
}

export { syncToolsAndHarnesses as installCliAndHarnesses };

export default {
  syncToolsAndHarnesses,
  installCliAndHarnesses: syncToolsAndHarnesses,
};
