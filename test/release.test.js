import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

import {
  bumpVersion,
  compareVersions,
  formatVersion,
  isPrerelease,
  parseVersion
} from '../src/utils/semver.js';
import {
  extractNotes,
  hasUnreleasedEntries,
  latestReleasedVersion,
  parseChangelog,
  stampRelease
} from '../scripts/lib/changelog.js';

const RELEASE_SCRIPT = path.resolve('scripts/release.js');
const NOTES_SCRIPT = path.resolve('scripts/release-notes.js');

const FIXTURE = [
  '# Changelog',
  '',
  'Intro line.',
  '',
  '---',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '- New thing.',
  '',
  '---',
  '',
  '## [1.0.0] - 2026-01-01',
  '',
  '### Added',
  '- First release.',
  ''
].join('\n');

const EMPTY_UNRELEASED = FIXTURE.replace('### Added\n- New thing.\n', '');
const STAMP_DATE = new Date('2026-09-13T00:00:00Z');

// --- semver ----------------------------------------------------------------

test('semver parses and formats versions, dropping build metadata', () => {
  assert.deepEqual(parseVersion('1.2.3-rc.1+build.5'), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: ['rc', '1'],
    build: 'build.5'
  });
  assert.equal(formatVersion(parseVersion('1.2.3-rc.1+build.5')), '1.2.3-rc.1');
});

test('semver rejects malformed versions', () => {
  for (const bad of ['1.2', 'v1.2.3', '1.2.3.4', '01.a.3', '', 'banana']) {
    assert.throws(() => parseVersion(bad), /Invalid semantic version/, `expected "${bad}" to be rejected`);
  }
  assert.throws(() => parseVersion(123), TypeError);
});

test('semver bumps stable versions for every release type', () => {
  const cases = [
    ['patch', '1.0.5'],
    ['minor', '1.1.0'],
    ['major', '2.0.0'],
    ['prepatch', '1.0.5-beta.0'],
    ['preminor', '1.1.0-beta.0'],
    ['premajor', '2.0.0-beta.0'],
    ['prerelease', '1.0.5-beta.0']
  ];
  for (const [type, expected] of cases) {
    assert.equal(bumpVersion('1.0.4', type), expected, `1.0.4 + ${type}`);
  }
});

test('semver graduates a prerelease instead of skipping a version', () => {
  assert.equal(bumpVersion('1.1.0-beta.3', 'patch'), '1.1.0');
  assert.equal(bumpVersion('1.1.0-beta.3', 'minor'), '1.1.0');
  assert.equal(bumpVersion('1.1.1-beta.0', 'minor'), '1.2.0');
  assert.equal(bumpVersion('2.0.0-rc.1', 'major'), '2.0.0');
  assert.equal(bumpVersion('2.1.0-rc.1', 'major'), '3.0.0');
});

test('semver increments prerelease counters and switches channels', () => {
  assert.equal(bumpVersion('1.0.5-beta.0', 'prerelease'), '1.0.5-beta.1');
  assert.equal(bumpVersion('1.0.5-beta.9', 'prerelease'), '1.0.5-beta.10');
  assert.equal(bumpVersion('1.0.5-beta.1', 'prerelease', 'rc'), '1.0.5-rc.0');
  assert.equal(bumpVersion('1.0.5-beta', 'prerelease'), '1.0.5-beta.0');
  assert.equal(bumpVersion('1.0.4', 'prerelease', 'rc'), '1.0.5-rc.0');
});

test('semver accepts an explicit target version, with or without a v prefix', () => {
  assert.equal(bumpVersion('1.0.4', '2.5.0'), '2.5.0');
  assert.equal(bumpVersion('1.0.4', 'v3.0.0-rc.1'), '3.0.0-rc.1');
  assert.throws(() => bumpVersion('1.0.4', 'banana'), /Invalid semantic version/);
  assert.throws(() => bumpVersion('1.0.4', 'prerelease', 'be ta'), /Invalid prerelease identifier/);
});

test('semver orders versions per the spec, prereleases below their release', () => {
  assert.equal(compareVersions('1.2.0', '1.10.0'), -1);
  assert.equal(compareVersions('1.1.0-beta.1', '1.1.0'), -1);
  assert.equal(compareVersions('1.1.0', '1.1.0-beta.1'), 1);
  assert.equal(compareVersions('1.0.0-beta.2', '1.0.0-beta.10'), -1);
  assert.equal(compareVersions('1.0.0-alpha', '1.0.0-beta'), -1);
  assert.equal(compareVersions('1.0.0-beta', '1.0.0-beta.1'), -1);
  assert.equal(compareVersions('1.0.0-1', '1.0.0-alpha'), -1);
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
  assert.deepEqual(
    ['1.0.0', '1.0.0-rc.1', '0.9.9', '1.0.0-beta.2'].sort(compareVersions),
    ['0.9.9', '1.0.0-beta.2', '1.0.0-rc.1', '1.0.0']
  );
  assert.equal(isPrerelease('1.0.0-rc.1'), true);
  assert.equal(isPrerelease('1.0.0'), false);
});

// --- changelog -------------------------------------------------------------

test('changelog parses sections, versions and dates', () => {
  const { preamble, sections } = parseChangelog(FIXTURE);
  assert.match(preamble, /Intro line\./);
  assert.deepEqual(
    sections.map((s) => [s.version, s.date]),
    [
      ['Unreleased', null],
      ['1.0.0', '2026-01-01']
    ]
  );
});

test('changelog extracts notes without separators, accepting a v prefix', () => {
  assert.equal(extractNotes(FIXTURE, '1.0.0'), '### Added\n- First release.');
  assert.equal(extractNotes(FIXTURE, 'v1.0.0'), '### Added\n- First release.');
  assert.equal(extractNotes(FIXTURE, 'Unreleased'), '### Added\n- New thing.');
  assert.equal(extractNotes(FIXTURE, '9.9.9'), null);
});

test('changelog detects whether [Unreleased] has entries', () => {
  assert.equal(hasUnreleasedEntries(FIXTURE), true);
  assert.equal(hasUnreleasedEntries(EMPTY_UNRELEASED), false);
  assert.equal(hasUnreleasedEntries('# Changelog\n\n## [1.0.0] - 2026-01-01\n- x\n'), false);
});

test('changelog stamps [Unreleased] into a dated version section', () => {
  const stamped = stampRelease(FIXTURE, '1.1.0', STAMP_DATE);

  assert.match(stamped, /^## \[1\.1\.0\] - 2026-09-13$/m);
  assert.deepEqual(
    parseChangelog(stamped).sections.map((s) => s.version),
    ['Unreleased', '1.1.0', '1.0.0']
  );
  assert.equal(extractNotes(stamped, '1.1.0'), '### Added\n- New thing.');
  assert.equal(extractNotes(stamped, 'Unreleased'), null, 'a fresh [Unreleased] must be empty');
  assert.equal(extractNotes(stamped, '1.0.0'), '### Added\n- First release.', 'older sections are preserved');
  assert.match(stamped, /Intro line\./, 'the preamble is preserved');
  assert.equal(latestReleasedVersion(stamped), '1.1.0');
});

test('changelog stamping handles CRLF files and string dates', () => {
  const stamped = stampRelease(FIXTURE.replace(/\n/g, '\r\n'), 'v1.1.0', '2026-09-13');
  assert.equal(extractNotes(stamped, '1.1.0'), '### Added\n- New thing.');
  assert.match(stamped, /^## \[1\.1\.0\] - 2026-09-13$/m);
});

test('changelog refuses to stamp an empty, missing or duplicate release', () => {
  assert.throws(() => stampRelease(EMPTY_UNRELEASED, '1.1.0', STAMP_DATE), /is empty/);
  assert.throws(
    () => stampRelease('# Changelog\n\n## [1.0.0] - 2026-01-01\n- x\n', '1.1.0', STAMP_DATE),
    /no "## \[Unreleased\]" section/
  );
  assert.throws(() => stampRelease(FIXTURE, '1.0.0', STAMP_DATE), /already contains a section for 1\.0\.0/);
});

test('the project CHANGELOG.md parses and has at least one released version', () => {
  const text = fs.readFileSync(path.resolve('CHANGELOG.md'), 'utf-8');
  const latest = latestReleasedVersion(text);
  assert.ok(latest, 'CHANGELOG.md should contain a released version section');
  assert.doesNotThrow(() => parseVersion(latest));
  assert.ok(extractNotes(text, latest), `CHANGELOG.md section ${latest} should have notes`);
});

// --- release scripts -------------------------------------------------------

test('release script prints help and rejects invalid input without touching git', () => {
  const help = spawnSync(process.execPath, [RELEASE_SCRIPT, '--help'], { encoding: 'utf-8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: node scripts\/release\.js/);
  assert.match(help.stdout, /prerelease/);

  const badType = spawnSync(
    process.execPath,
    [RELEASE_SCRIPT, 'banana', '--dry-run', '--skip-tests', '--any-branch'],
    { encoding: 'utf-8' }
  );
  assert.equal(badType.status, 1);
  assert.match(badType.stderr, /Release aborted: Invalid semantic version: "banana"/);

  const badFlag = spawnSync(process.execPath, [RELEASE_SCRIPT, '--frobnicate'], { encoding: 'utf-8' });
  assert.equal(badFlag.status, 1);
  assert.match(badFlag.stderr, /Unknown option: --frobnicate/);
});

test('release notes script prints a section and fails cleanly for unknown versions', () => {
  const text = fs.readFileSync(path.resolve('CHANGELOG.md'), 'utf-8');
  const latest = latestReleasedVersion(text);

  const found = spawnSync(process.execPath, [NOTES_SCRIPT, latest], { encoding: 'utf-8' });
  assert.equal(found.status, 0);
  assert.equal(found.stdout.trim(), extractNotes(text, latest));

  const missing = spawnSync(process.execPath, [NOTES_SCRIPT, '999.0.0'], { encoding: 'utf-8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /No CHANGELOG\.md section found for 999\.0\.0/);

  const usage = spawnSync(process.execPath, [NOTES_SCRIPT], { encoding: 'utf-8' });
  assert.equal(usage.status, 2);
});
