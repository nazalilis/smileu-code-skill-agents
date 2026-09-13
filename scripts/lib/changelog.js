/**
 * Keep a Changelog reader and writer.
 *
 * The release pipeline uses this in two places: the release script stamps the
 * `[Unreleased]` section with the version being cut, and the GitHub workflow
 * reads the stamped section back to use as the release body. Both directions
 * are pure string transforms so they can be tested without touching disk.
 */

const HEADING = /^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/;
const UNRELEASED = 'Unreleased';

/**
 * Splits a changelog into an ordered list of `## [version]` sections.
 * Text before the first heading (title, format note) is returned as `preamble`.
 */
export function parseChangelog(text) {
  const lines = String(text).split(/\r?\n/);
  const sections = [];
  const preamble = [];

  let current = null;
  for (const line of lines) {
    const match = HEADING.exec(line);
    if (match) {
      if (current) sections.push(current);
      current = { version: match[1], date: match[2] || null, heading: line, body: [] };
      continue;
    }
    if (current) current.body.push(line);
    else preamble.push(line);
  }
  if (current) sections.push(current);

  return { preamble: preamble.join('\n'), sections };
}

/**
 * Strips the horizontal rules and blank padding that separate sections, leaving
 * the notes themselves.
 */
function cleanBody(body) {
  return body
    .join('\n')
    .trim()
    .replace(/(?:^|\n)[ \t]*-{3,}$/, '')
    .trim();
}

/**
 * Returns the release notes for `version`, or null when the changelog has no
 * section for it. Accepts both "1.2.3" and "v1.2.3".
 */
export function extractNotes(text, version) {
  const wanted = String(version).replace(/^v/, '');
  const { sections } = parseChangelog(text);
  const section = sections.find((s) => s.version.replace(/^v/, '') === wanted);
  if (!section) return null;

  const body = cleanBody(section.body);
  return body.length ? body : null;
}

/**
 * Returns true when `[Unreleased]` holds at least one real entry, which is the
 * signal that there is something worth releasing.
 */
export function hasUnreleasedEntries(text) {
  const { sections } = parseChangelog(text);
  const unreleased = sections.find((s) => s.version === UNRELEASED);
  if (!unreleased) return false;
  return cleanBody(unreleased.body).length > 0;
}

/**
 * Moves everything under `[Unreleased]` into a dated `[version]` section and
 * leaves a fresh, empty `[Unreleased]` heading at the top.
 *
 * Returns the rewritten changelog. Throws when there is no `[Unreleased]`
 * section or when it is empty, so a release never ships with blank notes.
 */
export function stampRelease(text, version, date = new Date()) {
  const target = String(version).replace(/^v/, '');
  const { preamble, sections } = parseChangelog(text);
  const idx = sections.findIndex((s) => s.version === UNRELEASED);

  if (idx === -1) {
    throw new Error('CHANGELOG.md has no "## [Unreleased]" section to stamp.');
  }

  const notes = cleanBody(sections[idx].body);
  if (!notes.length) {
    throw new Error(
      'CHANGELOG.md "[Unreleased]" section is empty. Document the changes before releasing.'
    );
  }

  if (sections.some((s, i) => i !== idx && s.version.replace(/^v/, '') === target)) {
    throw new Error(`CHANGELOG.md already contains a section for ${target}.`);
  }

  const stamp =
    date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);

  const rebuilt = [
    `## [${UNRELEASED}]`,
    '',
    '---',
    '',
    `## [${target}] - ${stamp}`,
    '',
    notes,
    '',
    '---',
    ''
  ].join('\n');

  const rest = sections
    .slice(idx + 1)
    .map((s) => [s.heading, ...s.body].join('\n').replace(/\s+$/, ''))
    .join('\n\n');

  const head = preamble.replace(/\s+$/, '');
  return `${head}\n\n${rebuilt}\n${rest}\n`.replace(/\n{4,}/g, '\n\n\n');
}

/**
 * The most recent released version in the changelog, ignoring `[Unreleased]`.
 * Returns null for a changelog that has never been stamped.
 */
export function latestReleasedVersion(text) {
  const { sections } = parseChangelog(text);
  const released = sections.find((s) => s.version !== UNRELEASED);
  return released ? released.version.replace(/^v/, '') : null;
}
