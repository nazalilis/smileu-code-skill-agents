import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_LOCATIONS, LEGACY_RULE_FILES, PACKAGE_ROOT } from '../config.js';
import { listSkillIds } from '../installer.js';

/**
 * Versions 1.1.1 and earlier installed skills into folders that the editors do
 * not read (`.cursor/rules/<skill>/`, `.agent/skills/`, `.skills/`). This module
 * finds the Smileu copies left there and removes them on request.
 *
 * An entry counts as a Smileu copy only when its content identifies it, not
 * when its name merely matches:
 * - a skill folder whose SKILL.md has the library skill's `name` and one of the
 *   `description` lines that skill has had in a release;
 * - a persona file whose `name` and `description` match a released persona, or,
 *   for personas that had no frontmatter before 1.2, whose first heading does.
 * Anything else with a library name is reported as kept. Other files in those
 * folders (a team's own `.mdc` rules, custom skills) are never touched.
 */

// Identifying lines that earlier releases shipped and the current library no
// longer has, so copies installed by those releases are still recognised.
const PREVIOUS_SKILL_DESCRIPTIONS = {
  'smileu-code-skill': [
    'The ultimate unified vibe coding super-skill combining engineering alignment, knowledge graphs, anti-slop design taste, impeccable craft, UI motion physics, agent swarms, humanized writing, and cybersecurity hardening.'
  ]
};

const PREVIOUS_PERSONA_SIGNATURES = {
  'architect.md': [{ heading: '# Role: Lead Architect (@architect)' }],
  'craft.md': [{ heading: '# Role: Design & Motion Specialist (@craft)' }],
  'editor.md': [{ heading: '# Role: Humanizer Editor (@editor)' }],
  'engineer.md': [{ heading: '# Role: Feature Engineer (@engineer)' }],
  'guardian.md': [{ heading: '# Role: Security Guardian (@guardian)' }],
  'orchestrator.md': [
    {
      name: 'orchestrator',
      description:
        'Multi-Agent Swarm Orchestrator responsible for SPARC workflow coordination, task decomposition, and agent handoffs. Inspired by ruvnet/ruflo.'
    }
  ],
  'sparc-coder.md': [
    { name: 'sparc-coder', description: 'Ruflo SPARC methodology coder focusing on high-rigor modular implementations.' }
  ],
  'tester.md': [
    {
      name: 'tester',
      description: 'Ruflo & Matt Pocock test verification engineer enforcing robust unit and integration test coverage.'
    }
  ]
};

/**
 * Reads the frontmatter `name` and `description` and the first `# ` heading of
 * a Markdown file. Returns null when the file cannot be read.
 */
function readSignature(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n').replace(/^﻿/, '');
  } catch {
    return null;
  }

  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text);
  const field = (key) => {
    if (!frontmatter) return null;
    const match = new RegExp(`^${key}:[ \\t]*(.+)$`, 'm').exec(frontmatter[1]);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  const body = frontmatter ? text.slice(frontmatter[0].length) : text;
  const heading = (/^# .+$/m.exec(body) || [null])[0];

  return { name: field('name'), description: field('description'), heading: heading && heading.trim() };
}

/**
 * True when every folder from `base` down to `base/rel` is a real directory, so
 * a symlink or junction anywhere on the way can never redirect a deletion.
 */
function isRealPathInside(base, rel) {
  let current = base;
  for (const segment of rel.split('/')) {
    current = path.join(current, segment);
    try {
      if (!fs.lstatSync(current).isDirectory()) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function isSmileuSkillCopy(folder, id, sourceRoot) {
  const candidate = readSignature(path.join(folder, 'SKILL.md'));
  const library = readSignature(path.join(sourceRoot, 'skills', id, 'SKILL.md'));
  if (!candidate || !library || candidate.name !== id) return false;

  const known = [library.description, ...(PREVIOUS_SKILL_DESCRIPTIONS[id] || [])].filter(Boolean);
  return known.includes(candidate.description);
}

function isSmileuPersonaCopy(file, name, sourceRoot) {
  const candidate = readSignature(file);
  if (!candidate) return false;

  const current = readSignature(path.join(sourceRoot, 'templates', 'agents', name));
  const known = [...(current ? [current] : []), ...(PREVIOUS_PERSONA_SIGNATURES[name] || [])];

  return known.some((sig) => {
    if (sig.name && sig.description) {
      return candidate.name === sig.name && candidate.description === sig.description;
    }
    return !candidate.name && Boolean(sig.heading) && candidate.heading === sig.heading;
  });
}

function libraryPersonaFiles(sourceRoot) {
  try {
    return new Set(fs.readdirSync(path.join(sourceRoot, 'templates', 'agents')).filter((f) => f.endsWith('.md')));
  } catch {
    return new Set();
  }
}

/**
 * Returns `{ locations, kept, ruleFiles }`:
 * - `locations`: `{ dir, kind: 'skills' | 'agents', entries }` for each old folder
 *   that holds Smileu copies;
 * - `kept`: `{ dir, names }` for entries that share a library name but whose
 *   content is not a Smileu copy;
 * - `ruleFiles`: old single-file rules that still exist. Those are reported but
 *   never removed, because users often edit them.
 *
 * With `editor`, only the old locations of that editor are checked.
 */
export function detectLegacyInstall(targetDir = process.cwd(), { sourceRoot = PACKAGE_ROOT, editor = 'all' } = {}) {
  const applies = (item) => editor === 'all' || item.editors.includes(editor);
  const skills = new Set(listSkillIdsSafe(sourceRoot));
  const personas = libraryPersonaFiles(sourceRoot);
  const locations = [];
  const kept = [];

  for (const location of LEGACY_LOCATIONS.filter(applies)) {
    if (!isRealPathInside(targetDir, location.dir)) continue;
    const full = path.join(targetDir, location.dir);
    const entries = [];
    const keptNames = [];

    if (location.kind === 'skills') {
      for (const id of listSkillIds(full)) {
        if (!skills.has(id) || !isRealPathInside(full, id)) continue;
        if (isSmileuSkillCopy(path.join(full, id), id, sourceRoot)) entries.push(id);
        else keptNames.push(id);
      }
    } else {
      for (const dirent of fs.readdirSync(full, { withFileTypes: true })) {
        if (!dirent.isFile() || !personas.has(dirent.name)) continue;
        if (isSmileuPersonaCopy(path.join(full, dirent.name), dirent.name, sourceRoot)) entries.push(dirent.name);
        else keptNames.push(dirent.name);
      }
    }

    if (entries.length) locations.push({ dir: location.dir, kind: location.kind, entries: entries.sort() });
    if (keptNames.length) kept.push({ dir: location.dir, names: keptNames.sort() });
  }

  const ruleFiles = LEGACY_RULE_FILES.filter(applies)
    .map((rule) => rule.file)
    .filter((file) => {
      try {
        return fs.lstatSync(path.join(targetDir, file)).isFile();
      } catch {
        return false;
      }
    });

  return { locations, kept, ruleFiles };
}

function listSkillIdsSafe(sourceRoot) {
  return listSkillIds(path.join(sourceRoot, 'skills'));
}

/**
 * Deletes a file or folder without following symlinks or junctions, so a link
 * inside an old skill folder can never cause files elsewhere to be deleted.
 */
function removeTree(target) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) {
    try {
      fs.unlinkSync(target);
    } catch {
      fs.rmdirSync(target);
    }
    return;
  }
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target)) removeTree(path.join(target, name));
    fs.rmdirSync(target);
    return;
  }
  fs.unlinkSync(target);
}

/**
 * Removes an empty folder and then its empty parents, stopping at `stopAt`.
 */
function pruneEmptyParents(dir, stopAt) {
  const root = path.resolve(stopAt);
  let current = path.resolve(dir);
  while (current !== root && current.startsWith(root + path.sep)) {
    try {
      if (fs.readdirSync(current).length) return;
      fs.rmdirSync(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

/**
 * Removes the Smileu copies found by `detectLegacyInstall`. Returns
 * `{ removed, failed }`, where each item is a workspace-relative path.
 */
export function removeLegacyInstall(targetDir, detection, { dryRun = false } = {}) {
  const removed = [];
  const failed = [];

  for (const location of detection.locations) {
    const base = path.join(targetDir, location.dir);
    for (const entry of location.entries) {
      const rel = `${location.dir}/${entry}`;
      try {
        if (!dryRun) removeTree(path.join(base, entry));
        removed.push(rel);
      } catch (err) {
        failed.push({ path: rel, reason: err.code || err.message });
      }
    }
    if (!dryRun) pruneEmptyParents(base, targetDir);
  }

  return { removed, failed };
}
