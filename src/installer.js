import fs from 'node:fs';
import path from 'node:path';
import {
  PACKAGE_ROOT,
  SKILLS_CATALOG,
  EDITOR_TARGETS,
  ALWAYS_INSTALLED_SKILLS,
  resolveEditors
} from './config.js';

const IGNORED_ENTRIES = new Set(['node_modules', '.git', '.github']);
const INVALID_NAME_REASON = 'Skill names cannot contain "/", "\\" or "..".';

// Project documents every install creates when they are missing, whatever the
// editor. AGENTS.md is read by Cursor and Windsurf as well.
const PROJECT_DOCUMENTS = [
  { template: 'PRODUCT.md', dest: 'PRODUCT.md' },
  { template: 'CONTEXT.md', dest: 'CONTEXT.md' },
  { template: 'DESIGN.md', dest: 'DESIGN.md' },
  { template: 'AGENTS.md', dest: 'AGENTS.md' },
  { template: '../docs/adr/0001-unified-vibe-coding-harness.md', dest: 'docs/adr/0001-unified-vibe-coding-harness.md' }
];

/**
 * Validates that an untrusted relative path cannot traverse outside its base
 * directory. A folder legitimately named "..notes" is still allowed.
 */
function isSafeRelativePath(baseDir, relativePath) {
  const resolved = path.resolve(baseDir, relativePath);
  const rel = path.relative(baseDir, resolved);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/**
 * A skill id is a single folder name: no separators and no parent references.
 * Returns the reason it is invalid, or null.
 */
function invalidSkillIdReason(id) {
  if (typeof id !== 'string' || !id.trim()) return 'Skill names cannot be empty.';
  if (/[\\/]/.test(id) || id.includes('..')) return INVALID_NAME_REASON;
  return null;
}

/**
 * Lists the folders in `dir` that contain a SKILL.md, sorted by name.
 */
export function listSkillIds(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'SKILL.md')))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Lists installable skill ids from a source library.
 */
export function listAvailableSkills(sourceRoot = PACKAGE_ROOT) {
  return listSkillIds(path.join(sourceRoot, 'skills'));
}

/**
 * The distinct skill folders, agent folders and editor files for a set of
 * editors. Editors that share a folder (Cursor, Windsurf and Antigravity all
 * read `.agents/skills`) get it once.
 */
export function resolveLayout(editors) {
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const files = new Map();
  for (const editor of editors) {
    for (const file of EDITOR_TARGETS[editor].files) {
      if (!files.has(file.dest)) files.set(file.dest, file);
    }
  }

  return {
    skillDirs: unique(editors.map((e) => EDITOR_TARGETS[e].skills)),
    agentDirs: unique(editors.map((e) => EDITOR_TARGETS[e].agents)),
    files: [...files.values()]
  };
}

function copyFileSync(src, dest, dryRun = false) {
  if (dryRun) return 1;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return 1;
}

/**
 * Recursively copies a directory, skipping VCS and dependency folders. Symlinks
 * are neither followed nor copied. Throws on I/O errors so the caller can record
 * which skill failed. Returns the number of files written.
 */
function copyDirSync(srcDir, destDir, dryRun = false) {
  let count = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (IGNORED_ENTRIES.has(entry.name)) continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      count += copyDirSync(src, dest, dryRun);
    } else if (entry.isFile()) {
      count += copyFileSync(src, dest, dryRun);
    }
  }
  return count;
}

/**
 * Turns a filesystem error into a short reason. Paths are shown only when they
 * are inside the workspace, so package install locations never leak into output.
 */
function describeWriteError(err, targetDir) {
  const reasons = {
    EACCES: 'permission denied',
    EPERM: 'permission denied',
    ENOTDIR: 'a file is in the way of a folder',
    EEXIST: 'a file is in the way of a folder',
    EISDIR: 'a folder is in the way of a file',
    ENOSPC: 'the disk is full',
    EROFS: 'the file system is read-only',
    ENOENT: 'a source file is missing (an antivirus may have quarantined it)',
    UNKNOWN: 'the operating system or an antivirus blocked the file'
  };
  const reason = (err && reasons[err.code]) || (err && err.code) || 'could not write files';
  const where = err && (err.dest || err.path);
  if (!where) return reason;

  const rel = path.relative(targetDir, where);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? `${reason} (${rel.replace(/\\/g, '/')})` : reason;
}

/**
 * Builds the ordered, de-duplicated list of skill folders to install. Requested
 * ids must match a library folder exactly, so behaviour is the same on
 * case-insensitive (Windows, macOS) and case-sensitive file systems.
 */
function resolveSkillList(scope, skillsSourceDir, results) {
  const available = listSkillIds(skillsSourceDir);
  const availableSet = new Set(available);
  const selected = new Map();

  const add = (id) => {
    if (selected.has(id)) return;

    const invalid = invalidSkillIdReason(id);
    if (invalid || !isSafeRelativePath(skillsSourceDir, id)) {
      results.skipped.push({ skill: String(id), reason: invalid || INVALID_NAME_REASON });
      return;
    }

    if (!availableSet.has(id)) {
      const lower = id.toLowerCase();
      const suggestion =
        available.find((name) => name.toLowerCase() === lower) ||
        available.find((name) => name.includes(lower));
      results.skipped.push({
        skill: id,
        reason: suggestion
          ? `No skill with this name. Did you mean "${suggestion}"?`
          : 'No skill with this name in the library.'
      });
      return;
    }

    selected.set(id, { id, dir: id });
  };

  // The master skill and the /smileu command are present after any install.
  ALWAYS_INSTALLED_SKILLS.forEach(add);

  if (Array.isArray(scope)) {
    scope.forEach(add);
  } else if (scope === 'core') {
    SKILLS_CATALOG.forEach((s) => add(s.dir));
  } else {
    available.forEach(add);
  }

  return [...selected.values()];
}

/**
 * Installs skills, agent personas, project documents and editor files into the
 * target workspace for one or more editors.
 *
 * @param {object}   options
 * @param {string}   options.targetDir        Workspace to install into.
 * @param {string}   options.sourceRoot       Root holding skills/, templates/, docs/.
 * @param {'full'|'core'|string[]} options.scope  What to install.
 * @param {string}   options.editor           Editor id or 'all'.
 * @param {boolean}  options.includeTemplates Also write project documents, editor files and personas.
 * @param {boolean}  options.force            Replace agent persona files that already exist.
 * @param {boolean}  options.dryRun           Simulate without writing.
 * @param {function} options.onProgress       Called with (done, total) during copy.
 */
export function installSkills({
  targetDir = process.cwd(),
  sourceRoot = PACKAGE_ROOT,
  scope = 'full',
  editor = 'all',
  includeTemplates = true,
  force = false,
  dryRun = false,
  onProgress = null
} = {}) {
  const results = {
    skills: [],
    agents: [],
    agentsKept: 0,
    templates: [],
    skipped: [],
    failed: [],
    editors: [],
    destinations: [],
    filesWritten: 0
  };

  const editors = resolveEditors(editor);
  if (!editors) {
    results.skipped.push({ skill: '(editor)', reason: `Unknown editor "${editor}"` });
    return results;
  }
  results.editors = editors;

  const layout = resolveLayout(editors);
  const skillsSourceDir = path.join(sourceRoot, 'skills');
  const skillsToInstall = resolveSkillList(scope, skillsSourceDir, results);
  results.destinations = layout.skillDirs;

  const total = skillsToInstall.length * layout.skillDirs.length;
  let done = 0;

  for (const skill of skillsToInstall) {
    const srcSkillDir = path.join(skillsSourceDir, skill.dir);
    let failed = false;

    for (const dir of layout.skillDirs) {
      try {
        results.filesWritten += copyDirSync(srcSkillDir, path.join(targetDir, dir, skill.dir), dryRun);
      } catch (err) {
        failed = true;
        results.failed.push({ skill: skill.id, reason: describeWriteError(err, targetDir) });
      }
      done += 1;
      if (typeof onProgress === 'function') onProgress(done, total);
    }

    if (!failed) results.skills.push(skill.id);
  }

  if (includeTemplates) {
    copyTemplateFiles([...PROJECT_DOCUMENTS, ...layout.files], { targetDir, sourceRoot, dryRun, results });
    installAgents({ targetDir, sourceRoot, agentDirs: layout.agentDirs, force, dryRun, results });
  }

  return results;
}

/**
 * Copies template files that do not exist in the workspace yet. Existing files
 * are never replaced, so a re-run keeps user edits; a dry run reports exactly
 * what a real run would write.
 */
function copyTemplateFiles(files, { targetDir, sourceRoot, dryRun, results }) {
  for (const item of files) {
    const srcPath = path.join(sourceRoot, 'templates', item.template);
    const destPath = path.join(targetDir, item.dest);
    if (!fs.existsSync(srcPath) || fs.existsSync(destPath)) continue;

    try {
      copyFileSync(srcPath, destPath, dryRun);
      results.templates.push(item.dest);
    } catch (err) {
      results.failed.push({ skill: item.dest, reason: describeWriteError(err, targetDir) });
    }
  }
}

/**
 * Provisions the agent personas into each agents folder. Existing persona files
 * are kept unless `force` is set; `smileu update` is the command that refreshes
 * them.
 */
function installAgents({ targetDir, sourceRoot, agentDirs, force, dryRun, results }) {
  const agentsSrc = path.join(sourceRoot, 'templates', 'agents');
  if (!agentDirs.length || !fs.existsSync(agentsSrc)) return;

  const agentFiles = fs.readdirSync(agentsSrc).filter((f) => f.endsWith('.md'));
  const installed = new Set();

  for (const dir of agentDirs) {
    for (const file of agentFiles) {
      const name = file.replace(/\.md$/, '');
      const dest = path.join(targetDir, dir, file);

      if (!force && fs.existsSync(dest)) {
        results.agentsKept += 1;
        installed.add(name);
        continue;
      }

      try {
        copyFileSync(path.join(agentsSrc, file), dest, dryRun);
        installed.add(name);
      } catch (err) {
        results.failed.push({ skill: `agent ${name}`, reason: describeWriteError(err, targetDir) });
      }
    }
  }

  results.agents = [...installed];
}

/**
 * Ensures the project documents exist (PRODUCT.md, CONTEXT.md, DESIGN.md,
 * AGENTS.md and the seed ADR) without installing skills or editor files. Used
 * by the pipeline's align phase. Never overwrites.
 */
export function ensureTemplates({ targetDir = process.cwd(), sourceRoot = PACKAGE_ROOT, dryRun = false } = {}) {
  const results = { templates: [], skipped: [], failed: [] };
  copyTemplateFiles(PROJECT_DOCUMENTS, { targetDir, sourceRoot, dryRun, results });
  return results;
}
