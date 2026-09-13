import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  checkForUpdate,
  compareToLatest,
  detectInstalledSkills,
  fetchLatestNpmVersion,
  fetchLatestRelease,
  updateWorkspace
} from '../src/tools/update.js';
import { manifestPath, readManifest, writeManifest } from '../src/utils/manifest.js';

// Removes a folder without following symlinks or junctions inside it, so a link
// that points outside the temp folder can never cause files there to be deleted.
function removeTree(target) {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch {
    return;
  }

  if (stat.isSymbolicLink()) {
    try {
      fs.unlinkSync(target);
    } catch {
      fs.rmdirSync(target);
    }
    return;
  }

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) removeTree(path.join(target, entry));
    fs.rmdirSync(target);
    return;
  }

  fs.unlinkSync(target);
}

// Every temp folder created here is removed when the file finishes. Each folder
// is removed on its own, so one failure cannot leave the others behind.
const createdDirs = [];
after(() => {
  for (const dir of createdDirs) {
    try {
      removeTree(dir);
    } catch (err) {
      console.error(`could not remove temp folder ${dir}: ${err.code || err.message}`);
    }
  }
});

function tempDir(prefix = 'smileu-unit-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// A small library: skill "alpha" (two files), skill "beta", one persona.
function makeLibrary() {
  const root = tempDir('smileu-lib-');
  writeFile(path.join(root, 'skills', 'alpha', 'SKILL.md'), 'alpha v2\n');
  writeFile(path.join(root, 'skills', 'alpha', 'refs', 'guide.md'), 'guide v2\n');
  writeFile(path.join(root, 'skills', 'beta', 'SKILL.md'), 'beta v1\n');
  writeFile(path.join(root, 'templates', 'agents', 'architect.md'), 'architect v2\n');
  return root;
}

function fakeResponse(status, body, { invalidJson = false } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (invalidJson) throw new SyntaxError('Unexpected token');
      return body;
    }
  };
}

// --- fetchLatestRelease ------------------------------------------------------

test('fetchLatestRelease reads the latest release from the GitHub API', async () => {
  let requested;
  const result = await fetchLatestRelease({
    fetchImpl: async (url, init) => {
      requested = { url, init };
      return fakeResponse(200, { tag_name: 'v1.2.3', html_url: 'https://github.com/nazalilis/smileu-code-skill-agents/releases/tag/v1.2.3' });
    }
  });

  assert.deepEqual(result, {
    ok: true,
    version: '1.2.3',
    url: 'https://github.com/nazalilis/smileu-code-skill-agents/releases/tag/v1.2.3'
  });
  assert.equal(requested.url, 'https://api.github.com/repos/nazalilis/smileu-code-skill-agents/releases/latest');
  assert.equal(requested.init.headers['User-Agent'], 'smileu-code-skill');
  assert.ok(requested.init.signal, 'the request has a timeout signal');
});

test('fetchLatestRelease turns every failure into a readable reason instead of throwing', async () => {
  const cases = [
    [async () => fakeResponse(404, {}), /No published release/],
    [async () => fakeResponse(403, {}), /rate-limited/],
    [async () => fakeResponse(429, {}), /rate-limited/],
    [async () => fakeResponse(500, {}), /HTTP 500/],
    [async () => fakeResponse(200, null, { invalidJson: true }), /not valid JSON/],
    [async () => fakeResponse(200, { tag_name: 'nightly' }), /"nightly" is not a version/],
    [async () => { throw new TypeError('fetch failed'); }, /Could not reach GitHub/],
    [async () => { throw Object.assign(new Error('aborted'), { name: 'TimeoutError' }); }, /did not answer within 5s/]
  ];

  for (const [fetchImpl, reason] of cases) {
    const result = await fetchLatestRelease({ fetchImpl });
    assert.equal(result.ok, false);
    assert.match(result.reason, reason);
  }

  const noFetch = await fetchLatestRelease({ fetchImpl: null });
  assert.equal(noFetch.ok, false);
  assert.match(noFetch.reason, /no fetch API/);
});

// --- npm registry and checkForUpdate -----------------------------------------

test('fetchLatestNpmVersion reads the latest dist-tag and encodes scoped names', async () => {
  let requested;
  const result = await fetchLatestNpmVersion({
    fetchImpl: async (url) => {
      requested = url;
      return fakeResponse(200, { version: '1.1.0' });
    }
  });
  assert.deepEqual(result, { ok: true, version: '1.1.0', url: 'https://www.npmjs.com/package/smileu-code-skill' });
  assert.equal(requested, 'https://registry.npmjs.org/smileu-code-skill/latest');

  const scoped = await fetchLatestNpmVersion({
    name: '@nazalilis/smileu-code-skill',
    fetchImpl: async (url) => {
      requested = url;
      return fakeResponse(404, {});
    }
  });
  assert.equal(requested, 'https://registry.npmjs.org/@nazalilis%2Fsmileu-code-skill/latest');
  assert.equal(scoped.ok, false);
  assert.match(scoped.reason, /not published on the npm registry yet/);

  const badVersion = await fetchLatestNpmVersion({ fetchImpl: async () => fakeResponse(200, { version: 'latest' }) });
  assert.match(badVersion.reason, /"latest", which is not a version/);

  const timeout = await fetchLatestNpmVersion({
    fetchImpl: async () => {
      throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    }
  });
  assert.match(timeout.reason, /npm registry did not answer within 5s/);
});

test('checkForUpdate reports the higher of npm and GitHub, and cleans text that came from the server', async () => {
  const staleNpm = await checkForUpdate({
    fetchImpl: async (url) =>
      url.includes('registry.npmjs.org')
        ? fakeResponse(200, { version: '1.1.0' })
        : fakeResponse(200, { tag_name: 'v1.2.0', html_url: 'https://github.com/nazalilis/smileu-code-skill-agents/releases/tag/v1.2.0' })
  });
  assert.equal(staleNpm.source, 'github');
  assert.equal(staleNpm.version, '1.2.0');

  const tie = await checkForUpdate({
    fetchImpl: async (url) =>
      url.includes('registry.npmjs.org') ? fakeResponse(200, { version: '1.2.0' }) : fakeResponse(200, { tag_name: 'v1.2.0' })
  });
  assert.equal(tie.source, 'npm', 'npm wins a tie because installing from it needs no login');

  const hostile = await fetchLatestRelease({
    fetchImpl: async () => fakeResponse(200, { tag_name: 'v9\u001b[2J', html_url: 'https://evil.example/phish' })
  });
  assert.equal(hostile.ok, false);
  assert.doesNotMatch(hostile.reason, /[\u0000-\u001f\u007f-\u009f]/);

  const offsiteLink = await fetchLatestRelease({
    fetchImpl: async () => fakeResponse(200, { tag_name: 'v1.0.0', html_url: 'https://evil.example/phish' })
  });
  assert.equal(offsiteLink.ok, true);
  assert.equal(offsiteLink.url, null, 'only github.com release links are shown');

  const slowBody = await fetchLatestNpmVersion({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
      }
    })
  });
  assert.match(slowBody.reason, /did not finish answering within 5s/);
});

test('checkForUpdate prefers npm, falls back to GitHub, and reports both reasons when neither answers', async () => {
  const fromNpm = await checkForUpdate({
    fetchImpl: async (url) => (url.includes('registry.npmjs.org') ? fakeResponse(200, { version: '2.0.0' }) : fakeResponse(500, {}))
  });
  assert.equal(fromNpm.ok, true);
  assert.equal(fromNpm.source, 'npm');
  assert.equal(fromNpm.version, '2.0.0');

  const fromGithub = await checkForUpdate({
    fetchImpl: async (url) =>
      url.includes('registry.npmjs.org') ? fakeResponse(404, {}) : fakeResponse(200, { tag_name: 'v1.9.0', html_url: 'https://github.com/x' })
  });
  assert.equal(fromGithub.ok, true);
  assert.equal(fromGithub.source, 'github');
  assert.equal(fromGithub.version, '1.9.0');

  const neither = await checkForUpdate({ fetchImpl: async () => fakeResponse(404, {}) });
  assert.equal(neither.ok, false);
  assert.equal(neither.reasons.length, 2);
  assert.match(neither.reasons[0], /npm registry/);
  assert.match(neither.reasons[1], /No published release/);
});

test('compareToLatest classifies the running version against the latest release', () => {
  assert.equal(compareToLatest('1.0.4', '1.1.0'), 'outdated');
  assert.equal(compareToLatest('1.1.0-beta.1', '1.1.0'), 'outdated');
  assert.equal(compareToLatest('1.1.0', '1.1.0'), 'current');
  assert.equal(compareToLatest('1.2.0-beta.1', '1.1.0'), 'ahead');
});

// --- detectInstalledSkills ---------------------------------------------------

test('detectInstalledSkills finds skill folders per editor layout, merging shared layouts', () => {
  const ws = tempDir();
  writeFile(path.join(ws, '.claude', 'skills', 'beta', 'SKILL.md'), 'beta\n');
  writeFile(path.join(ws, '.claude', 'skills', 'not-a-skill', 'readme.txt'), 'no SKILL.md here\n');
  writeFile(path.join(ws, '.agent', 'skills', 'alpha', 'SKILL.md'), 'alpha\n');

  const targets = detectInstalledSkills(ws);
  assert.deepEqual(
    targets.map((t) => [t.skillsDir, t.editors, t.skills]),
    [
      ['.claude/skills', ['claude'], ['beta']],
      ['.agent/skills', ['antigravity', 'windsurf'], ['alpha']]
    ]
  );
});

// --- updateWorkspace ---------------------------------------------------------

test('updateWorkspace rewrites only changed files and leaves user files and removed skills alone', () => {
  const lib = makeLibrary();
  const ws = tempDir();
  writeFile(path.join(ws, '.claude', 'skills', 'alpha', 'SKILL.md'), 'alpha v1\n');
  writeFile(path.join(ws, '.claude', 'skills', 'alpha', 'NOTES.md'), 'mine\n');
  writeFile(path.join(ws, '.claude', 'skills', 'gone', 'SKILL.md'), 'removed upstream\n');
  writeFile(path.join(ws, '.claude', 'agents', 'architect.md'), 'architect v1\n');

  const dry = updateWorkspace({ targetDir: ws, sourceRoot: lib, dryRun: true });
  assert.equal(dry.filesWritten, 3, 'SKILL.md, the new refs/guide.md, and the persona');
  assert.equal(fs.readFileSync(path.join(ws, '.claude', 'skills', 'alpha', 'SKILL.md'), 'utf-8'), 'alpha v1\n');
  assert.ok(!fs.existsSync(path.join(ws, '.claude', 'skills', 'alpha', 'refs')));

  const live = updateWorkspace({ targetDir: ws, sourceRoot: lib });
  const [target] = live.targets;
  assert.equal(live.filesWritten, 3);
  assert.deepEqual(target.updated, ['alpha']);
  assert.deepEqual(target.missing, ['gone']);
  assert.deepEqual(target.added, []);
  assert.equal(target.agentFilesWritten, 1);
  assert.equal(fs.readFileSync(path.join(ws, '.claude', 'skills', 'alpha', 'SKILL.md'), 'utf-8'), 'alpha v2\n');
  assert.equal(fs.readFileSync(path.join(ws, '.claude', 'skills', 'alpha', 'refs', 'guide.md'), 'utf-8'), 'guide v2\n');
  assert.equal(fs.readFileSync(path.join(ws, '.claude', 'skills', 'alpha', 'NOTES.md'), 'utf-8'), 'mine\n');
  assert.ok(fs.existsSync(path.join(ws, '.claude', 'skills', 'gone', 'SKILL.md')));
  assert.ok(!fs.existsSync(path.join(ws, '.claude', 'skills', 'beta')), 'new skills are not added by default');

  const again = updateWorkspace({ targetDir: ws, sourceRoot: lib });
  assert.equal(again.filesWritten, 0);
  assert.deepEqual(again.targets[0].unchanged, ['alpha']);

  const withNew = updateWorkspace({ targetDir: ws, sourceRoot: lib, includeNew: true });
  assert.deepEqual(withNew.targets[0].added, ['beta']);
  assert.ok(fs.existsSync(path.join(ws, '.claude', 'skills', 'beta', 'SKILL.md')));

  assert.deepEqual(updateWorkspace({ targetDir: ws, sourceRoot: lib, editor: 'cursor' }).targets, []);
});

test('updateWorkspace never writes through a symlinked folder', (t) => {
  const lib = makeLibrary();
  const ws = tempDir();
  const outside = tempDir('smileu-outside-');
  writeFile(path.join(ws, '.claude', 'skills', 'alpha', 'SKILL.md'), 'alpha v1\n');

  try {
    fs.symlinkSync(outside, path.join(ws, '.claude', 'skills', 'alpha', 'refs'), 'junction');
  } catch {
    t.skip('this platform does not allow creating symlinks');
    return;
  }

  const result = updateWorkspace({ targetDir: ws, sourceRoot: lib });
  assert.ok(!fs.existsSync(path.join(outside, 'guide.md')), 'nothing is written outside the workspace');
  assert.ok(result.skippedPaths.length >= 1);
  assert.equal(fs.readFileSync(path.join(ws, '.claude', 'skills', 'alpha', 'SKILL.md'), 'utf-8'), 'alpha v2\n');
});

// --- manifest ----------------------------------------------------------------

test('writeManifest merges lists, keeps the first install time, and never downgrades a full install', () => {
  const ws = tempDir();

  const first = writeManifest(ws, { cliVersion: '1.0.0', source: 'bundle', scope: 'full', editors: ['claude'], skills: ['b', 'a'] });
  const second = writeManifest(ws, { cliVersion: '1.1.0', scope: 'custom', editors: ['cursor'], skills: ['c', 'a'] });

  assert.deepEqual(second.skills, ['a', 'b', 'c']);
  assert.deepEqual(second.editors, ['claude', 'cursor']);
  assert.equal(second.scope, 'full');
  assert.equal(second.cliVersion, '1.1.0');
  assert.equal(second.installedAt, first.installedAt);
  assert.deepEqual(readManifest(ws), second);
  assert.match(fs.readFileSync(path.join(ws, '.gitignore'), 'utf-8'), /\.smileu\//);

  fs.writeFileSync(manifestPath(ws), '{not json');
  assert.equal(readManifest(ws), null);
});
