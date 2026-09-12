import fs from 'node:fs';
import path from 'node:path';
import {
  PACKAGE_ROOT,
  SKILLS_CATALOG,
  EDITOR_TARGETS,
  MASTER_SKILL_ID,
  resolveEditors
} from './config.js';

/**
 * Ensures a directory exists synchronously.
 */
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Validates that an untrusted relative path cannot traverse outside its base directory.
 */
function isSafeRelativePath(baseDir, relativePath) {
  const resolved = path.resolve(baseDir, relativePath);
  const rel = path.relative(baseDir, resolved);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Copies a single file, creating parent directories as needed.
 */
function copyFileSync(src, dest, dryRun = false) {
  if (dryRun) return 1;
  ensureDirSync(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return 1;
}

/**
 * Recursively copies a directory, skipping VCS and dependency noise. Returns the
 * number of files written.
 */
function copyDirSync(srcDir, destDir, dryRun = false) {
  let count = 0;
  let entries;
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.github') {
      continue;
    }
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
 * Builds the ordered, de-duplicated list of skill directories to install.
 * The master skill is always included first.
 */
function resolveSkillList(scope, skillsSourceDir, results) {
  const selected = new Map();

  const add = (id) => {
    if (!id || selected.has(id)) return;
    if (!isSafeRelativePath(skillsSourceDir, id)) {
      results.skipped.push({ skill: id, reason: 'Invalid or unsafe path traversal detected' });
      return;
    }
    if (!fs.existsSync(path.join(skillsSourceDir, id, 'SKILL.md'))) {
      results.skipped.push({ skill: id, reason: 'Skill folder not found in library' });
      return;
    }
    selected.set(id, { id, dir: id });
  };

  // The master skill is always present so `/smileu` works after any install.
  add(MASTER_SKILL_ID);

  if (Array.isArray(scope)) {
    scope.forEach(add);
  } else if (scope === 'core') {
    SKILLS_CATALOG.forEach((s) => add(s.dir));
  } else {
    // 'full' — every directory in the library that exposes a SKILL.md.
    let dirs = [];
    try {
      dirs = fs
        .readdirSync(skillsSourceDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(skillsSourceDir, d.name, 'SKILL.md')))
        .map((d) => d.name)
        .sort();
    } catch {
      dirs = [];
    }
    dirs.forEach(add);
  }

  return [...selected.values()];
}

/**
 * Installs skills, agent personas, and architecture templates into the target
 * workspace for one or more editors.
 *
 * @param {object}   options
 * @param {string}   options.targetDir        Workspace to install into.
 * @param {string}   options.sourceRoot       Root holding skills/, templates/, docs/.
 * @param {'full'|'core'|string[]} options.scope  What to install.
 * @param {string}   options.editor           Editor id or 'all'.
 * @param {boolean}  options.includeTemplates Copy PRODUCT/CONTEXT/DESIGN/AGENTS + ADR.
 * @param {boolean}  options.dryRun           Simulate without writing.
 * @param {function} options.onProgress       Called with (done, total) during copy.
 */
export function installSkills({
  targetDir = process.cwd(),
  sourceRoot = PACKAGE_ROOT,
  scope = 'full',
  editor = 'all',
  includeTemplates = true,
  dryRun = false,
  onProgress = null
} = {}) {
  const results = {
    skills: [],
    agents: [],
    templates: [],
    skipped: [],
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

  const skillsSourceDir = path.join(sourceRoot, 'skills');
  const skillsToInstall = resolveSkillList(scope, skillsSourceDir, results);
  const skillDestBases = editors.map((e) => path.join(targetDir, EDITOR_TARGETS[e].skills));
  results.destinations = skillDestBases.map((d) => path.relative(targetDir, d));

  const total = skillsToInstall.length * skillDestBases.length;
  let done = 0;

  for (const skill of skillsToInstall) {
    const srcSkillDir = path.join(skillsSourceDir, skill.dir);
    for (const base of skillDestBases) {
      const destSkillDir = path.join(base, skill.dir);
      results.filesWritten += copyDirSync(srcSkillDir, destSkillDir, dryRun);
      done += 1;
      if (typeof onProgress === 'function') onProgress(done, total);
    }
    results.skills.push(skill.id);
  }

  if (includeTemplates) {
    installTemplates({ targetDir, sourceRoot, editors, dryRun, results });
    installAgents({ targetDir, sourceRoot, editors, dryRun, results });
  }

  return results;
}

/**
 * Copies root documents (PRODUCT/CONTEXT/DESIGN/AGENTS), editor rules files, and
 * the seed ADR. Existing files are preserved so a re-run never clobbers user edits.
 */
function installTemplates({ targetDir, sourceRoot, editors, dryRun, results }) {
  const templateFiles = [
    { name: 'PRODUCT.md', dest: 'PRODUCT.md' },
    { name: 'CONTEXT.md', dest: 'CONTEXT.md' },
    { name: 'DESIGN.md', dest: 'DESIGN.md' },
    { name: 'AGENTS.md', dest: 'AGENTS.md' }
  ];

  for (const e of editors) {
    const rules = EDITOR_TARGETS[e].rules;
    if (!rules) continue;
    // Cursor and Windsurf both derive from the .cursorrules template.
    const srcName = rules === '.windsurfrules' ? '.cursorrules' : rules;
    if (!templateFiles.some((t) => t.dest === rules)) {
      templateFiles.push({ name: srcName, dest: rules });
    }
  }

  for (const item of templateFiles) {
    const srcPath = path.join(sourceRoot, 'templates', item.name);
    const destPath = path.join(targetDir, item.dest);
    if (fs.existsSync(srcPath) && (!fs.existsSync(destPath) || dryRun)) {
      copyFileSync(srcPath, destPath, dryRun);
      results.templates.push(item.dest);
    }
  }

  const srcAdr = path.join(sourceRoot, 'docs', 'adr', '0001-unified-vibe-coding-harness.md');
  const destAdr = path.join(targetDir, 'docs', 'adr', '0001-unified-vibe-coding-harness.md');
  if (fs.existsSync(srcAdr) && (!fs.existsSync(destAdr) || dryRun)) {
    copyFileSync(srcAdr, destAdr, dryRun);
    results.templates.push(path.relative(targetDir, destAdr).replace(/\\/g, '/'));
  }
}

/**
 * Provisions the autonomous agent personas into each selected editor's agents dir.
 */
function installAgents({ targetDir, sourceRoot, editors, dryRun, results }) {
  const agentsSrc = path.join(sourceRoot, 'templates', 'agents');
  if (!fs.existsSync(agentsSrc)) return;

  const agentFiles = fs.readdirSync(agentsSrc).filter((f) => f.endsWith('.md'));
  const installed = new Set();

  for (const e of editors) {
    const destDir = path.join(targetDir, EDITOR_TARGETS[e].agents);
    for (const file of agentFiles) {
      copyFileSync(path.join(agentsSrc, file), path.join(destDir, file), dryRun);
      installed.add(file.replace(/\.md$/, ''));
    }
  }

  results.agents = [...installed];
}

/**
 * Ensures the base project documents and editor rules exist, without installing
 * the full skill library. Used by the pipeline's align phase. Never overwrites.
 */
export function ensureTemplates({
  targetDir = process.cwd(),
  sourceRoot = PACKAGE_ROOT,
  editor = 'all',
  dryRun = false
} = {}) {
  const results = { templates: [], skipped: [] };
  const editors = resolveEditors(editor) || resolveEditors('all');
  installTemplates({ targetDir, sourceRoot, editors, dryRun, results });
  return results;
}

/**
 * Lists installable skill ids from a source library (used by interactive select).
 */
export function listAvailableSkills(sourceRoot = PACKAGE_ROOT) {
  const skillsSourceDir = path.join(sourceRoot, 'skills');
  try {
    return fs
      .readdirSync(skillsSourceDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(skillsSourceDir, d.name, 'SKILL.md')))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}
