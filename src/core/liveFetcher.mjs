import path from 'node:path';
import fs from 'fs-extra';
import { execa } from 'execa';
import { downloadTemplate } from 'giget';
import { isCommandInPath } from './utils.mjs';

/**
 * Clean and normalize a repository slug or URL to "owner/repo".
 *
 * @param {string} repo
 * @returns {string}
 */
export function normalizeRepoSlug(repo) {
  return repo
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/^(gh:|github:)/, '')
    .trim();
}

/**
 * Checks the latest commit SHA (HEAD) from GitHub remote using git ls-remote.
 * This runs in <1.5s and consumes ZERO GitHub REST API rate-limit quota.
 *
 * @param {string} repoSlug Repository slug e.g. "MengTo/skills"
 * @returns {Promise<string | null>} Commit SHA (40 chars) or null if unable to resolve
 */
export async function getLatestCommitSha(repoSlug) {
  const cleanRepo = normalizeRepoSlug(repoSlug);
  const gitUrl = `https://github.com/${cleanRepo}.git`;

  try {
    const hasGit = await isCommandInPath('git');
    if (hasGit) {
      const { stdout } = await execa('git', ['ls-remote', gitUrl, 'HEAD'], {
        stdio: 'pipe',
        timeout: 15000,
      });

      const match = stdout.trim().match(/^([a-f0-9]{40})/);
      if (match) {
        return match[1];
      }
    }
  } catch {
    // If git ls-remote fails (firewall, network glitch), continue to fallback
  }

  // Fallback: Attempt GitHub public API with short timeout
  try {
    const res = await fetch(`https://api.github.com/repos/${cleanRepo}/commits/HEAD`, {
      headers: {
        'User-Agent': 'code-skill-agents-fetcher',
        Accept: 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.sha) {
        return data.sha;
      }
    }
  } catch {
    // Silent ignore to allow download to proceed
  }

  return null;
}

/**
 * Records or updates repository commit metadata into .agent/code-skill-agents-lock.json.
 *
 * @param {string} workspaceRoot
 * @param {string} repoSlug
 * @param {string | null} commitSha
 * @param {object} [metadata={}]
 * @returns {Promise<string>} Path to the updated lockfile
 */
export async function recordLockEntry(workspaceRoot, repoSlug, commitSha, metadata = {}) {
  const cleanRepo = normalizeRepoSlug(repoSlug);
  const lockDir = path.join(path.resolve(workspaceRoot), '.agent');
  const lockFilePath = path.join(lockDir, 'code-skill-agents-lock.json');

  await fs.ensureDir(lockDir);

  let lockData = {
    version: '1.0.0',
    description: 'Manifest tracking real-time latest commits installed by code-skill-agents',
    updatedAt: new Date().toISOString(),
    packages: {},
  };

  if (await fs.pathExists(lockFilePath)) {
    try {
      const existing = await fs.readJson(lockFilePath);
      if (existing && typeof existing === 'object') {
        lockData = {
          ...existing,
          updatedAt: new Date().toISOString(),
          packages: existing.packages || {},
        };
      }
    } catch {
      // If corrupted, initialize fresh
    }
  }

  lockData.packages[cleanRepo] = {
    commit: commitSha || 'latest',
    installedAt: new Date().toISOString(),
    url: `https://github.com/${cleanRepo}`,
    ...metadata,
  };

  await fs.writeJson(lockFilePath, lockData, { spaces: 2 });
  return lockFilePath;
}

/**
 * Fetches the absolute latest commit/release of a repository:
 * 1. Resolves latest commit SHA via `git ls-remote HEAD`.
 * 2. Downloads repository contents using shallow `git clone --depth 1` (removing .git),
 *    with automatic fallback to `giget` (preferOffline: false) for cache-bypassing tarball download.
 * 3. Records entry in `.agent/code-skill-agents-lock.json`.
 *
 * @param {string} repoSlug Repository slug e.g. "MengTo/skills"
 * @param {string} targetDir Destination folder for downloaded files
 * @param {object} [options={}] Options
 * @param {string} [options.workspaceRoot=process.cwd()] Workspace root containing .agent/
 * @param {boolean} [options.recordLock=true] Whether to record in lockfile
 * @returns {Promise<{ dir: string, commitSha: string | null, method: 'git-clone' | 'giget', repo: string }>}
 */
export async function fetchLatestRepo(repoSlug, targetDir, options = {}) {
  const cleanRepo = normalizeRepoSlug(repoSlug);
  const resolvedTarget = path.resolve(targetDir);
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const gitUrl = `https://github.com/${cleanRepo}.git`;

  await fs.ensureDir(resolvedTarget);

  // Step 1: Detect latest remote commit SHA
  const commitSha = await getLatestCommitSha(cleanRepo);

  let downloadMethod = 'git-clone';

  // Step 2: Download repository
  const hasGit = await isCommandInPath('git');
  let gitSuccess = false;

  if (hasGit) {
    try {
      await fs.emptyDir(resolvedTarget);
      await execa('git', ['clone', '--depth', '1', gitUrl, resolvedTarget], {
        stdio: 'ignore',
        timeout: 90000,
      });

      // Remove .git to leave clean template code
      await fs.remove(path.join(resolvedTarget, '.git')).catch(() => {});
      gitSuccess = true;
      downloadMethod = 'git-clone';
    } catch {
      gitSuccess = false;
    }
  }

  if (!gitSuccess) {
    // Fallback: giget with cache bypass
    downloadMethod = 'giget';
    await downloadTemplate(`github:${cleanRepo}`, {
      dir: resolvedTarget,
      force: true,
      forceClean: true,
      preferOffline: false,
      auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined,
    });
  }

  // Step 3: Record lockfile manifest
  if (options.recordLock !== false) {
    await recordLockEntry(workspaceRoot, cleanRepo, commitSha, {
      method: downloadMethod,
    }).catch(() => {});
  }

  return {
    dir: resolvedTarget,
    commitSha,
    method: downloadMethod,
    repo: cleanRepo,
  };
}

export default {
  normalizeRepoSlug,
  getLatestCommitSha,
  recordLockEntry,
  fetchLatestRepo,
};
