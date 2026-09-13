import path from 'node:path';
import { NPM_PACKAGE_NAME } from '../config.js';

/**
 * True when `scriptPath` sits in the `node_modules` folder of `cwd` or one of
 * its parent folders, which is where a project-local install lives. A global
 * install lives under npm's global prefix, which is not a parent of a project.
 */
function isInProjectNodeModules(scriptPath, cwd, platform) {
  const normalize = (p) => (platform === 'win32' ? p.toLowerCase() : p);
  const target = normalize(scriptPath);
  let dir = path.resolve(cwd);

  for (;;) {
    if (target.startsWith(normalize(path.join(dir, 'node_modules')) + path.sep)) return true;
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

/**
 * Returns the command a user should type to run this CLI again.
 *
 * The short `smileu` command only exists after `npm install -g`. Every other way
 * of starting the CLI needs the npx form in hints, or users get
 * "smileu: command not found":
 * - `npx` / `npm exec`: npm sets `npm_command=exec`, and the package sits in a
 *   `_npx` folder of the npm cache.
 * - `pnpm dlx` and `bunx`: the package runs from those tools' caches.
 * - a project-local install started through an npm script: the package sits in
 *   the project's `node_modules`, and `npx smileu-code-skill` finds it there.
 */
export function detectCliCommand({
  env = process.env,
  script = process.argv[1] || '',
  cwd = process.cwd(),
  platform = process.platform
} = {}) {
  const npx = `npx ${NPM_PACKAGE_NAME}`;
  const segments = String(script).split(/[\\/]+/);

  if (env.npm_command === 'exec' || segments.includes('_npx')) return npx;
  if (segments.includes('dlx') || (segments.includes('.bun') && segments.includes('cache'))) return npx;
  if (script && isInProjectNodeModules(path.resolve(script), cwd, platform)) return npx;
  return 'smileu';
}

export const CLI = detectCliCommand();
export const RUNNING_VIA_NPX = CLI !== 'smileu';
