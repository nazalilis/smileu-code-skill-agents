/**
 * Keep a Changelog reader and writer.
 *
 * The release pipeline uses this in two places: the release script stamps the
 * `[Unreleased]` section with the version being cut, and the GitHub workflow
 * reads the stamped section back to use as the release body. Both directions
 * are pure string transforms so they can be tested without touching disk.
 */

import { parseVersion } from '../../src/utils/semver.js';

// "## [1.2.3] - 2026-01-01", optionally followed by "[YANKED]" or "(yanked)".
const HEADING = /^##[ \t]+\[([^\]]+)\](?:[ \t]+-[ \t]+(\d{4}-\d{2}-\d{2}))?([ \t]+(?:\[YANKED\]|\(yanked\)))?[ \t]*$/i;
// A link reference definition, e.g. "[1.0.0]: https://example.com/compare/...".
const LINK_REF = /^\[[^\]]+\]:[ \t]*\S+/;
const RULE = /^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;
const COMMENT = /^[ \t]*<!--.*-->[ \t]*$/;

function isUnreleased(version) {
  return String(version).toLowerCase() === 'unreleased';
}

function sameVersion(a, b) {
  return String(a).replace(/^v/, '') === String(b).replace(/^v/, '');
}

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
      current = { version: match[1], date: match[2] || null, yanked: Boolean(match[3]), heading: line, body: [] };
      continue;
    }
    if (current) current.body.push(line);
    else preamble.push(line);
  }
  if (current) sections.push(current);

  return { preamble: preamble.join('\n'), sections };
}

/**
 * Returns a section's notes without surrounding blank lines, trailing
 * horizontal rules, placeholder HTML comments, or trailing link reference
 * definitions. Indentation and
 * blank lines inside the notes are kept as written.
 */
function cleanBody(body) {
  const lines = [...body];
  while (
    lines.length &&
    (!lines[lines.length - 1].trim() ||
      RULE.test(lines[lines.length - 1]) ||
      COMMENT.test(lines[lines.length - 1]) ||
      LINK_REF.test(lines[lines.length - 1]))
  ) {
    lines.pop();
  }
  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }
  return lines.join('\n');
}

/**
 * True when a section body contains at least one real entry: something other
 * than blank lines, headings, horizontal rules, HTML comments or link references.
 */
function hasEntries(body) {
  return body.some((line) => {
    const t = line.trim();
    return t && !t.startsWith('#') && !RULE.test(t) && !COMMENT.test(t) && !LINK_REF.test(t);
  });
}

/**
 * Removes the link reference definitions at the very end of the file (they
 * belong to the whole changelog, not to its last section) and returns them.
 */
function takeFooterLinks(sections) {
  const last = sections[sections.length - 1];
  if (!last) return [];

  const body = [...last.body];
  const footer = [];
  while (body.length && (!body[body.length - 1].trim() || LINK_REF.test(body[body.length - 1]))) {
    const line = body.pop();
    if (line.trim()) footer.unshift(line);
  }
  if (footer.length) last.body = body;
  return footer;
}

function formatDate(date) {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) throw new Error('The release date is not a valid date.');
    return date.toISOString().slice(0, 10);
  }
  const value = String(date);
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    throw new Error(`The release date must be YYYY-MM-DD, received "${value}".`);
  }
  return value.slice(0, 10);
}

/**
 * Returns the release notes for `version`, or null when the changelog has no
 * section for it or the section is empty. Accepts both "1.2.3" and "v1.2.3".
 */
export function extractNotes(text, version) {
  const { sections } = parseChangelog(text);
  const section = sections.find((s) => sameVersion(s.version, version));
  if (!section) return null;

  const notes = cleanBody(section.body);
  return notes.length ? notes : null;
}

/**
 * Returns true when `[Unreleased]` holds at least one real entry, which is the
 * signal that there is something worth releasing.
 */
export function hasUnreleasedEntries(text) {
  const { sections } = parseChangelog(text);
  const unreleased = sections.find((s) => isUnreleased(s.version));
  return Boolean(unreleased && hasEntries(unreleased.body));
}

/**
 * Moves everything under `[Unreleased]` into a dated `[version]` section and
 * leaves a fresh, empty `[Unreleased]` heading at the top. Every other section
 * keeps its content and order, and link references at the end of the file stay
 * at the end.
 *
 * Throws when the version or date is invalid, when there is no `[Unreleased]`
 * section, when it has no entries, or when the version already has a section,
 * so a release never ships with blank or duplicated notes.
 */
export function stampRelease(text, version, date = new Date()) {
  const target = String(version).trim().replace(/^v/, '');
  parseVersion(target);
  const stamp = formatDate(date);

  const { preamble, sections } = parseChangelog(text);
  const footer = takeFooterLinks(sections);
  const idx = sections.findIndex((s) => isUnreleased(s.version));

  if (idx === -1) {
    throw new Error('CHANGELOG.md has no "## [Unreleased]" section to stamp.');
  }
  if (!hasEntries(sections[idx].body)) {
    throw new Error('CHANGELOG.md "[Unreleased]" section is empty. Document the changes before releasing.');
  }
  if (sections.some((s, i) => i !== idx && sameVersion(s.version, target))) {
    throw new Error(`CHANGELOG.md already contains a section for ${target}.`);
  }

  const others = sections
    .filter((_, i) => i !== idx)
    .map((s) => [s.heading, ...s.body].join('\n').replace(/\s+$/, ''));

  const stamped = ['## [Unreleased]', '', '---', '', `## [${target}] - ${stamp}`, '', cleanBody(sections[idx].body)];
  if (others.length) stamped.push('', '---');

  const parts = [];
  const head = preamble.replace(/\s+$/, '');
  if (head) parts.push(head);
  parts.push(stamped.join('\n'), ...others);
  if (footer.length) parts.push(footer.join('\n'));

  return `${parts.join('\n\n')}\n`;
}

/**
 * The most recent released version in the changelog, ignoring `[Unreleased]`.
 * Keep a Changelog lists the newest release first, so this is the first
 * version section in the file. Returns null for a changelog with no releases.
 */
export function latestReleasedVersion(text) {
  const { sections } = parseChangelog(text);
  const released = sections.find((s) => !isUnreleased(s.version));
  return released ? released.version.replace(/^v/, '') : null;
}
