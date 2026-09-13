import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PACKAGE_ROOT, UPSTREAM_REPO } from '../config.js';
import { logInfo, logWarn } from '../ui.js';

/**
 * Resolves the root directory that holds `skills/`, `templates/`, and `docs/`.
 *
 * - Default: the bundled library shipped inside this package (offline, pinned).
 * - `--latest`: shallow-clones the reference repository into an OS temp folder,
 *   installs from there, and removes the clone afterwards. The project workspace
 *   is never touched, so no cache is left behind.
 *
 * Always returns a `cleanup()` function; callers must invoke it in a finally block.
 */
export function resolveSourceRoot({ latest = false } = {}) {
  const bundled = { root: PACKAGE_ROOT, engine: 'bundle', cleanup: () => {} };
  if (!latest) return bundled;

  try {
    execFileSync('git', ['--version'], { stdio: 'ignore', windowsHide: true });
  } catch {
    logWarn('--latest needs git, which was not found. Using the bundled library instead.');
    return bundled;
  }

  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smileu-latest-'));
  } catch (err) {
    logWarn(`Could not create a temp directory (${err.code || err.message}). Using the bundled library instead.`);
    return bundled;
  }

  const cleanup = () => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup of the temp clone.
    }
  };

  try {
    logInfo(`Fetching the current library from ${UPSTREAM_REPO} ...`);
    execFileSync('git', ['clone', '--depth', '1', '--quiet', UPSTREAM_REPO, tmpDir], {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 300000,
      // Fail instead of waiting for credentials if the repository is unreachable.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });

    if (!fs.existsSync(path.join(tmpDir, 'skills'))) {
      throw new Error('the repository has no skills/ folder');
    }
    return { root: tmpDir, engine: 'latest', cleanup };
  } catch (err) {
    cleanup();
    let reason = (err && err.message) || 'unknown error';
    if (err && err.code === 'ETIMEDOUT') reason = 'timed out';
    else if (err && typeof err.status === 'number') reason = `git exited with code ${err.status}`;
    logWarn(`Could not fetch the current library (${reason}). Using the bundled library instead.`);
    return bundled;
  }
}
