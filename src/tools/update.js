import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PACKAGE_ROOT, EDITOR_TARGETS, GITHUB_REPO, NPM_PACKAGE_NAME } from '../config.js';
import { listSkillIds } from '../installer.js';
import { compareVersions, parseVersion } from '../utils/semver.js';

/**
 * Workspace updater.
 *
 * Refreshes the skills and agent personas a workspace already has from a source
 * library (the bundled one, or a fresh upstream clone with --latest). It is
 * deliberately conservative:
 *
 * - Only skills that are already installed are refreshed, unless the caller
 *   opts in to adding new ones. A core install never silently becomes 889 skills.
 * - A file is rewritten only when its content differs (sha256), so an update
 *   that finds nothing new writes nothing.
 * - Files that exist only in the workspace are left alone; users may have added
 *   their own notes next to a skill.
 * - Symlinks in the workspace are never written through.
 * - Project documents (PRODUCT.md, CONTEXT.md, rules files) are never touched.
 */

const IGNORED_ENTRIES = new Set(['node_modules', '.git', '.github']);

export function readCliVersion(root = PACKAGE_ROOT) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')).version || null;
  } catch {
    return null;
  }
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * True when `candidate` is strictly inside `base`. Unlike a bare
 * `startsWith('..')` check, a folder legitimately named "..notes" is allowed.
 */
function isInside(base, candidate) {
  const rel = path.relative(base, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/**
 * Lists the skill folders installed for each editor layout in `targetDir`.
 * Editors that share a layout (Antigravity and Windsurf both use .agent/) are
 * reported as one target so the same folder is never updated twice.
 */
export function detectInstalledSkills(targetDir = process.cwd()) {
  const targets = new Map();

  for (const [editor, cfg] of Object.entries(EDITOR_TARGETS)) {
    const existing = targets.get(cfg.skills);
    if (existing) {
      existing.editors.push(editor);
      continue;
    }
    targets.set(cfg.skills, {
      skillsDir: cfg.skills,
      agentsDir: cfg.agents,
      editors: [editor],
      skills: listSkillIds(path.join(targetDir, cfg.skills))
    });
  }

  return [...targets.values()].filter((t) => t.skills.length > 0);
}

/**
 * Mirrors `srcDir` into `destDir`, writing only files whose content changed.
 * Mutates `stats` ({ written, unchanged, skipped }).
 */
function syncDirectory(srcDir, destDir, dryRun, stats) {
  try {
    if (!fs.lstatSync(destDir).isDirectory()) {
      stats.skipped.push(destDir);
      return;
    }
  } catch {
    // Destination does not exist yet; it will be created on the first write.
  }

  let entries;
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORED_ENTRIES.has(entry.name)) continue;

    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      syncDirectory(src, dest, dryRun, stats);
      continue;
    }
    if (!entry.isFile()) continue;

    let destStat = null;
    try {
      destStat = fs.lstatSync(dest);
    } catch {
      destStat = null;
    }

    if (destStat && !destStat.isFile()) {
      stats.skipped.push(dest);
      continue;
    }

    if (destStat && destStat.size === fs.statSync(src).size && hashFile(src) === hashFile(dest)) {
      stats.unchanged += 1;
      continue;
    }

    stats.written += 1;
    if (!dryRun) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

/**
 * Refreshes installed skills and agent personas in `targetDir`.
 *
 * @param {object}  options
 * @param {string}  options.targetDir   Workspace to update.
 * @param {string}  options.sourceRoot  Library root holding skills/ and templates/agents/.
 * @param {string}  options.editor      Editor id, or 'all' for every detected layout.
 * @param {boolean} options.includeNew  Also install library skills the workspace lacks.
 * @param {boolean} options.dryRun      Report what would change without writing.
 */
export function updateWorkspace({
  targetDir = process.cwd(),
  sourceRoot = PACKAGE_ROOT,
  editor = 'all',
  includeNew = false,
  dryRun = false
} = {}) {
  const skillsSource = path.join(sourceRoot, 'skills');
  const agentsSource = path.join(sourceRoot, 'templates', 'agents');
  const librarySkills = includeNew ? listSkillIds(skillsSource) : [];

  const result = {
    targets: [],
    filesWritten: 0,
    skippedPaths: []
  };

  const targets = detectInstalledSkills(targetDir).filter(
    (t) => editor === 'all' || t.editors.includes(editor)
  );

  for (const target of targets) {
    const entry = {
      skillsDir: target.skillsDir,
      editors: target.editors,
      updated: [],
      added: [],
      unchanged: [],
      missing: [],
      agentFilesWritten: 0
    };
    const destBase = path.join(targetDir, target.skillsDir);

    const installed = new Set(target.skills);
    const queue = [
      ...target.skills.map((id) => ({ id, isNew: false })),
      ...librarySkills.filter((id) => !installed.has(id)).map((id) => ({ id, isNew: true }))
    ];

    for (const { id, isNew } of queue) {
      const src = path.join(skillsSource, id);
      const dest = path.join(destBase, id);

      if (
        !isInside(skillsSource, src) ||
        !isInside(destBase, dest) ||
        !fs.existsSync(path.join(src, 'SKILL.md'))
      ) {
        entry.missing.push(id);
        continue;
      }

      const stats = { written: 0, unchanged: 0, skipped: [] };
      syncDirectory(src, dest, dryRun, stats);
      result.filesWritten += stats.written;
      result.skippedPaths.push(...stats.skipped);

      if (isNew) entry.added.push(id);
      else if (stats.written > 0) entry.updated.push(id);
      else entry.unchanged.push(id);
    }

    // Personas are refreshed only where the editor already has an agents folder,
    // so an update never adds agent files the user chose not to install.
    const agentsDest = path.join(targetDir, target.agentsDir);
    if (fs.existsSync(agentsSource) && fs.existsSync(agentsDest)) {
      const stats = { written: 0, unchanged: 0, skipped: [] };
      syncDirectory(agentsSource, agentsDest, dryRun, stats);
      entry.agentFilesWritten = stats.written;
      result.filesWritten += stats.written;
      result.skippedPaths.push(...stats.skipped);
    }

    result.targets.push(entry);
  }

  return result;
}

function isTimeout(err) {
  return Boolean(err && (err.name === 'TimeoutError' || err.name === 'AbortError'));
}

// Text that came from a server is printed in the terminal. Control characters are
// dropped so a response cannot move the cursor, change colours or clear the screen.
function printable(value) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, 100);
}

function safeUrl(value, prefix) {
  return typeof value === 'string' && value.startsWith(prefix) && !/[\s\u0000-\u001f\u007f-\u009f]/.test(value)
    ? value
    : null;
}

/**
 * Looks up the latest published GitHub Release. Never throws: every failure
 * (offline, rate-limited, private repository, no release yet) comes back as
 * `{ ok: false, reason }` so the caller can print it and carry on.
 */
export async function fetchLatestRelease({
  repo = GITHUB_REPO,
  timeoutMs = 5000,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return { ok: false, reason: 'This Node.js runtime has no fetch API. Use Node.js 18 or newer.' };
  }

  let response;
  try {
    response = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'smileu-code-skill'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      ok: false,
      reason: timedOut
        ? `GitHub did not answer within ${Math.round(timeoutMs / 1000)}s.`
        : 'Could not reach GitHub. Check your network connection.'
    };
  }

  if (response.status === 404) {
    return { ok: false, reason: 'No published release was found for this project yet.' };
  }
  if (response.status === 403 || response.status === 429) {
    return { ok: false, reason: 'GitHub rate-limited the request. Try again in a few minutes.' };
  }
  if (!response.ok) {
    return { ok: false, reason: `GitHub responded with HTTP ${response.status}.` };
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    return {
      ok: false,
      reason: isTimeout(err)
        ? `GitHub did not finish answering within ${Math.round(timeoutMs / 1000)}s.`
        : 'GitHub returned a response that was not valid JSON.'
    };
  }

  const tag = String((body && body.tag_name) || '');
  const version = tag.replace(/^v/, '');
  try {
    parseVersion(version);
  } catch {
    return { ok: false, reason: `The latest release tag "${printable(tag)}" is not a version.` };
  }

  return { ok: true, version, url: safeUrl(body.html_url, 'https://github.com/') };
}

/**
 * Classifies the running CLI against the latest release.
 * Returns 'outdated', 'current' or 'ahead' (a local build newer than any release).
 */
export function compareToLatest(current, latest) {
  const order = compareVersions(current, latest);
  if (order < 0) return 'outdated';
  if (order > 0) return 'ahead';
  return 'current';
}

/**
 * Looks up the `latest` dist-tag on the public npm registry. The registry is
 * readable without credentials, so this works even when the GitHub repository
 * is private. Never throws; failures come back as `{ ok: false, reason }`.
 */
export async function fetchLatestNpmVersion({
  name = NPM_PACKAGE_NAME,
  timeoutMs = 5000,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return { ok: false, reason: 'This Node.js runtime has no fetch API. Use Node.js 18 or newer.' };
  }

  // Scoped names are requested as "@scope%2Fname".
  const encoded = encodeURIComponent(name).replace(/^%40/, '@');
  let response;
  try {
    response = await fetchImpl(`https://registry.npmjs.org/${encoded}/latest`, {
      headers: { Accept: 'application/json', 'User-Agent': 'smileu-code-skill' },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      ok: false,
      reason: timedOut
        ? `The npm registry did not answer within ${Math.round(timeoutMs / 1000)}s.`
        : 'Could not reach the npm registry. Check your network connection.'
    };
  }

  if (response.status === 404) {
    return { ok: false, reason: `${name} is not published on the npm registry yet.` };
  }
  if (!response.ok) {
    return { ok: false, reason: `The npm registry responded with HTTP ${response.status}.` };
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    return {
      ok: false,
      reason: isTimeout(err)
        ? `The npm registry did not finish answering within ${Math.round(timeoutMs / 1000)}s.`
        : 'The npm registry returned a response that was not valid JSON.'
    };
  }

  const version = String((body && body.version) || '');
  try {
    parseVersion(version);
  } catch {
    return { ok: false, reason: `The npm registry reported "${printable(version)}", which is not a version.` };
  }

  return { ok: true, version, url: `https://www.npmjs.com/package/${name}` };
}

/**
 * Finds the newest published version by asking the npm registry and GitHub
 * Releases at the same time, and reports the higher of the two. npm wins a tie,
 * because its install command needs no login. Returns
 * `{ ok, version, url, source }`, or `{ ok: false, reasons }` with one reason per
 * source.
 */
export async function checkForUpdate({ fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const [npm, github] = await Promise.all([
    fetchLatestNpmVersion({ fetchImpl, timeoutMs }),
    fetchLatestRelease({ fetchImpl, timeoutMs })
  ]);

  if (npm.ok && github.ok) {
    return compareVersions(github.version, npm.version) > 0
      ? { ...github, source: 'github' }
      : { ...npm, source: 'npm' };
  }
  if (npm.ok) return { ...npm, source: 'npm' };
  if (github.ok) return { ...github, source: 'github' };

  return { ok: false, reasons: [npm.reason, github.reason] };
}
