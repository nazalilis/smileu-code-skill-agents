import path from 'node:path';
import fs from 'fs-extra';
import { downloadTemplate } from 'giget';
import { execa } from 'execa';
import { isCommandInPath } from './utils.mjs';

/**
 * Downloads the latest commit/release of a repository in real time.
 * Employs a dual-strategy approach:
 * 1. Primary: giget with preferOffline=false and auth token support.
 * 2. Fallback: Shallow git clone (`git clone --depth 1`) to bypass GitHub API rate limits.
 *
 * @param {string} repo Repository slug e.g. "MengTo/skills"
 * @param {string} destination Destination directory
 * @param {object} [options={}] Additional download options
 * @returns {Promise<{ dir: string, strategy: 'giget' | 'git' }>}
 */
export async function downloadLatestRepo(repo, destination, options = {}) {
  const cleanRepo = repo.replace(/^(gh:|github:)/, '');
  const destDir = path.resolve(destination);

  await fs.ensureDir(destDir);

  const authToken =
    options.auth ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    undefined;

  // Strategy 1: giget (fast tarball stream)
  try {
    const input = repo.includes(':') ? repo : `gh:${repo}`;
    await downloadTemplate(input, {
      dir: destDir,
      force: true,
      forceClean: true,
      preferOffline: false,
      auth: authToken,
    });

    return { dir: destDir, strategy: 'giget' };
  } catch (gigetErr) {
    // Strategy 2: Git shallow clone fallback (Zero GitHub REST API Rate Limit impact)
    const hasGit = await isCommandInPath('git');
    if (hasGit) {
      try {
        await fs.emptyDir(destDir);
        const cloneUrl = `https://github.com/${cleanRepo}.git`;
        await execa('git', ['clone', '--depth', '1', cloneUrl, destDir], {
          stdio: 'ignore',
          timeout: 90000,
        });

        // Remove .git directory to keep the downloaded template clean
        const gitDir = path.join(destDir, '.git');
        await fs.remove(gitDir).catch(() => {});

        return { dir: destDir, strategy: 'git' };
      } catch (gitErr) {
        throw new Error(
          `Failed to download ${repo}. giget error: [${gigetErr.message}], git fallback error: [${gitErr.message}]`
        );
      }
    }

    throw new Error(`Failed to download ${repo} via giget: ${gigetErr.message}`);
  }
}

export default {
  downloadLatestRepo,
};
