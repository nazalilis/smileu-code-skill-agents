import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR } from '../config.js';
import { ensureOutputDir } from './output.js';

/**
 * Install manifest: a small record of what Smileu put into a workspace, kept at
 * `.smileu/manifest.json` (git-ignored with the rest of `.smileu/`).
 *
 * `update` does not depend on it — the skill folders on disk are the source of
 * truth — but it lets `update` report which CLI version did the last install and
 * whether the workspace was provisioned with the full library.
 */

export const MANIFEST_FILE = 'manifest.json';
const SCHEMA = 1;

export function manifestPath(targetDir = process.cwd()) {
  return path.join(targetDir, OUTPUT_DIR, MANIFEST_FILE);
}

/**
 * Returns the parsed manifest, or null when it is missing, unreadable, or was
 * written by an incompatible schema.
 */
export function readManifest(targetDir = process.cwd()) {
  try {
    const data = JSON.parse(fs.readFileSync(manifestPath(targetDir), 'utf-8'));
    if (!data || typeof data !== 'object' || data.schema !== SCHEMA) return null;
    return data;
  } catch {
    return null;
  }
}

function uniqueSorted(values) {
  return [...new Set(values.filter((v) => typeof v === 'string' && v.length))].sort();
}

/**
 * Merges `fields` into the existing manifest and writes it back.
 *
 * Skill and editor lists only ever grow: installing a single skill into a
 * workspace that already has the full library must not make the manifest
 * forget the rest. Returns the written manifest, or null when the workspace is
 * not writable (never throws — a manifest is bookkeeping, not a requirement).
 */
export function writeManifest(targetDir = process.cwd(), fields = {}) {
  const previous = readManifest(targetDir) || {};
  const now = new Date().toISOString();

  const scope =
    previous.scope === 'full' || fields.scope === 'full'
      ? 'full'
      : fields.scope || previous.scope || 'custom';

  const next = {
    schema: SCHEMA,
    cliVersion: fields.cliVersion || previous.cliVersion || null,
    source: fields.source || previous.source || 'bundle',
    scope,
    installedAt: previous.installedAt || now,
    updatedAt: now,
    editors: uniqueSorted([...(previous.editors || []), ...(fields.editors || [])]),
    skills: uniqueSorted([...(previous.skills || []), ...(fields.skills || [])])
  };

  try {
    ensureOutputDir(targetDir);
    fs.writeFileSync(manifestPath(targetDir), JSON.stringify(next, null, 2) + '\n', 'utf-8');
    return next;
  } catch {
    return null;
  }
}
