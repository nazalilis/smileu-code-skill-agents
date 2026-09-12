import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
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
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    logWarn('--latest requires git, which was not found. Falling back to the bundled library.');
    return bundled;
  }

  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smileu-latest-'));
  } catch (err) {
    logWarn(`Could not create a temp directory (${err.message}). Using the bundled library.`);
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
    logInfo(`Fetching the latest reference library from ${UPSTREAM_REPO} ...`);
    execSync(`git clone --depth 1 --quiet "${UPSTREAM_REPO}" "${tmpDir}"`, { stdio: 'ignore' });

    if (!fs.existsSync(path.join(tmpDir, 'skills'))) {
      throw new Error('cloned repository does not contain a skills/ directory');
    }
    return { root: tmpDir, engine: 'latest', cleanup };
  } catch (err) {
    cleanup();
    logWarn(`--latest fetch failed (${err.message}). Falling back to the bundled library.`);
    return bundled;
  }
}
