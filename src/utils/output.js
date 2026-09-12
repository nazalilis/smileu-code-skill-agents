import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR } from '../config.js';

/**
 * Central place for every generated artifact. All commands write here instead of
 * scattering files across the project root, so running Smileu never litters a
 * workspace. The folder is added to .gitignore on first use.
 *
 * Layout:
 *   .smileu/reports/   audit reports (security, humanizer, design)
 *   .smileu/graph/     knowledge graph output (graph.json, GRAPH_REPORT.md)
 *   .smileu/tasks/     swarm task decomposition plans
 */

export function outputRoot(targetDir = process.cwd()) {
  return path.join(targetDir, OUTPUT_DIR);
}

/**
 * Ensures `.smileu/<sub>` exists and that `.smileu/` is git-ignored, then returns
 * the absolute path to the subdirectory.
 */
export function ensureOutputDir(targetDir = process.cwd(), sub = '') {
  const dir = path.join(outputRoot(targetDir), sub);
  fs.mkdirSync(dir, { recursive: true });
  ensureGitignore(targetDir);
  return dir;
}

/**
 * Returns the absolute path for an artifact inside `.smileu/<sub>/<name>`,
 * creating the directory as a side effect.
 */
export function outputPath(targetDir, sub, name) {
  return path.join(ensureOutputDir(targetDir, sub), name);
}

/**
 * Adds `.smileu/` to the project's .gitignore exactly once. Creates the file if
 * it does not exist. Never throws: a read-only workspace must not break a command.
 */
export function ensureGitignore(targetDir = process.cwd(), entry = `${OUTPUT_DIR}/`) {
  const giPath = path.join(targetDir, '.gitignore');
  const normalized = entry.replace(/\/+$/, '');

  let content = '';
  try {
    content = fs.readFileSync(giPath, 'utf-8');
  } catch {
    // No .gitignore yet — it will be created below.
  }

  const already = content
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\/+$/, ''))
    .includes(normalized);
  if (already) return;

  const prefix = content.length === 0 ? '' : content.endsWith('\n') ? '' : '\n';
  const block = `${prefix}\n# Smileu Code Skill generated artifacts\n${entry}\n`;
  try {
    fs.appendFileSync(giPath, block, 'utf-8');
  } catch {
    // Ignore: writing the ignore rule is best-effort, never fatal.
  }
}
