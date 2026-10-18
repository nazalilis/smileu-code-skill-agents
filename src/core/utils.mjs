import path from 'node:path';
import { execa } from 'execa';

/**
 * Checks whether a given binary/command exists in the operating system PATH.
 *
 * @param {string} command
 * @returns {Promise<boolean>}
 */
export async function isCommandInPath(command) {
  try {
    const checker = process.platform === 'win32' ? 'where.exe' : 'which';
    await execa(checker, [command], { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Robust copy filter that excludes .git, .github, and node_modules by path segment,
 * avoiding accidental false positives on paths containing 'git'.
 *
 * @param {string} src
 * @returns {boolean}
 */
export function isSafeCopyFile(src) {
  const segments = path.normalize(src).split(path.sep);
  return !segments.some((seg) => seg === '.git' || seg === '.github' || seg === 'node_modules');
}

/**
 * Normalizes logger interface for console or Clack prompts.
 *
 * @param {object} [logger=console]
 * @returns {object}
 */
export function createLogger(logger = console) {
  return {
    info: (msg) => (typeof logger.info === 'function' ? logger.info(msg) : logger.log(msg)),
    warn: (msg) => (typeof logger.warn === 'function' ? logger.warn(msg) : logger.log(msg)),
    error: (msg) => (typeof logger.error === 'function' ? logger.error(msg) : logger.log(msg)),
    success: (msg) => (typeof logger.log === 'function' ? logger.log(msg) : console.log(msg)),
  };
}

export default {
  isCommandInPath,
  isSafeCopyFile,
  createLogger,
};
