#!/usr/bin/env node

/**
 * Release runner.
 *
 * Cuts a release locally: validates the tree, runs the suite, bumps the version,
 * stamps the changelog, commits and tags. Publishing is the CI pipeline's job:
 * pushing the bump commit (or the tag) is what triggers
 * `.github/workflows/release.yml`.
 *
 * Usage:
 *   node scripts/release.js [type|version] [options]
 *
 * Type is one of patch, minor, major, prepatch, preminor, premajor, prerelease,
 * or an explicit version such as 2.0.0. Default: patch.
 *
 * Options:
 *   --preid <id>   Prerelease channel for pre* bumps (default: beta)
 *   --dry-run      Print every step without writing, committing or tagging
 *   --push         Push the branch and the new tag once the release is prepared
 *   --skip-tests   Skip the test suite (for re-running an interrupted release)
 *   --any-branch   Allow releasing from a branch other than main
 *   --ci           Print machine-readable `version=` and `tag=` lines at the end,
 *                  for the release workflow to read
 *   -h, --help     Show this help
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { bumpVersion, isPrerelease, RELEASE_TYPES } from '../src/utils/semver.js';
import { stampRelease } from './lib/changelog.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG_PATH = path.join(ROOT_DIR, 'package.json');
const LOCK_PATH = path.join(ROOT_DIR, 'package-lock.json');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');

/**
 * Runs a command with an argument array rather than a shell string, so no part
 * of a version, branch name or tag can be interpreted as shell syntax.
 */
function run(cmd, args, { capture = false } = {}) {
  return execFileSync(cmd, args, {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false
  });
}

function git(args, opts) {
  return run('git', args, opts);
}

function step(n, message) {
  console.log(`\nStep ${n}: ${message}`);
}

function fail(message, hint) {
  console.error(`\nRelease aborted: ${message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    type: 'patch',
    preid: 'beta',
    dryRun: false,
    push: false,
    skipTests: false,
    anyBranch: false,
    ci: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--push':
        opts.push = true;
        break;
      case '--skip-tests':
        opts.skipTests = true;
        break;
      case '--any-branch':
        opts.anyBranch = true;
        break;
      case '--ci':
        opts.ci = true;
        break;
      case '--preid':
        i += 1;
        if (!argv[i] || argv[i].startsWith('-')) {
          fail('--preid needs a value.', 'Example: --preid rc');
        }
        opts.preid = argv[i];
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          fail(`Unknown option: ${arg}`, 'Run with --help to see valid options.');
        }
        opts.type = arg;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/release.js [type|version] [options]

Types:    ${RELEASE_TYPES.join(', ')}, or an explicit version like 2.0.0
Default:  patch

Options:
  --preid <id>   Prerelease channel for pre* bumps (default: beta)
  --dry-run      Show every step without writing, committing or tagging
  --push         Push the branch and tag once the release is prepared
  --skip-tests   Skip the test suite
  --any-branch   Allow releasing from a branch other than main
  --ci           CI mode: machine-readable version=/tag= output at the end
  -h, --help     Show this help

Examples:
  npm run release                                  patch release, no push
  npm run release:minor -- --push                  minor release, pushed
  node scripts/release.js prerelease --preid rc --dry-run
  node scripts/release.js 2.0.0 --push
`);
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

console.log('======================================================');
console.log('   SMILEU CODE SKILL - RELEASE RUNNER');
console.log('======================================================');
if (options.dryRun) console.log('\nDRY RUN: nothing will be written, committed or pushed.');

// --- Step 1: validate the repository state ---------------------------------
step(1, 'Validating the repository state...');

let branch;
try {
  branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }).trim();
} catch {
  fail('This directory is not a git repository.');
}

if (branch !== 'main' && !options.anyBranch) {
  fail(
    `Releases are cut from main; you are on "${branch}".`,
    'Switch to main, or pass --any-branch if this is deliberate.'
  );
}

// Untracked files never end up in the release commit (only the version files
// are staged), so only changes to tracked files block a release.
const dirty = git(['status', '--porcelain', '--untracked-files=no'], { capture: true }).trim();
if (dirty && !options.dryRun) {
  fail(
    'The working tree has uncommitted changes.',
    'Commit or stash them first so the release commit contains only the version bump.'
  );
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
const currentVersion = pkg.version;

let newVersion;
try {
  newVersion = bumpVersion(currentVersion, options.type, options.preid);
} catch (err) {
  fail(err.message, `Valid types: ${RELEASE_TYPES.join(', ')}, or an explicit version.`);
}

if (newVersion === currentVersion) {
  fail(`The target version ${newVersion} equals the current version.`);
}

const tag = `v${newVersion}`;
if (git(['tag', '--list', tag], { capture: true }).trim()) {
  fail(`Tag ${tag} already exists.`, 'Pick a different version, or delete the tag first.');
}

console.log(`  Branch  : ${branch}`);
console.log(`  Version : ${currentVersion} -> ${newVersion}`);
console.log(`  Tag     : ${tag}${isPrerelease(newVersion) ? ' (pre-release)' : ''}`);

// --- Step 2: test suite ----------------------------------------------------
if (options.skipTests) {
  step(2, 'Skipping the test suite (--skip-tests).');
} else {
  step(2, 'Running the test suite and sandboxes...');
  try {
    // npm is a .cmd shim on Windows and needs a shell there; the command is a
    // fixed string, so nothing user-controlled reaches it.
    if (process.platform === 'win32') {
      execSync('npm test', { cwd: ROOT_DIR, stdio: 'inherit' });
    } else {
      execFileSync('npm', ['test'], { cwd: ROOT_DIR, stdio: 'inherit' });
    }
  } catch {
    fail('The test suite failed.', 'Fix the failures before cutting a release.');
  }
  console.log('  All tests passed.');
}

// --- Step 3: version bump --------------------------------------------------
step(3, `Bumping the version to ${newVersion}...`);
pkg.version = newVersion;
const pkgContent = JSON.stringify(pkg, null, 2) + '\n';

let lockContent = null;
if (fs.existsSync(LOCK_PATH)) {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf-8'));
  lock.version = newVersion;
  if (lock.packages && lock.packages['']) lock.packages[''].version = newVersion;
  lockContent = JSON.stringify(lock, null, 2) + '\n';
}

// --- Step 4: changelog -----------------------------------------------------
step(4, 'Stamping CHANGELOG.md...');
let changelogContent;
try {
  changelogContent = stampRelease(fs.readFileSync(CHANGELOG_PATH, 'utf-8'), newVersion);
} catch (err) {
  fail(err.message, 'Add entries under "## [Unreleased]" describing what changed.');
}
console.log(`  Moved [Unreleased] into [${newVersion}].`);

if (options.dryRun) {
  console.log('\n======================================================');
  console.log(`Dry run complete. ${tag} was not written, committed or tagged.`);
  console.log('======================================================\n');
  if (options.ci) console.log(`version=${newVersion}\ntag=${tag}`);
  process.exit(0);
}

fs.writeFileSync(PKG_PATH, pkgContent, 'utf-8');
if (lockContent) fs.writeFileSync(LOCK_PATH, lockContent, 'utf-8');
fs.writeFileSync(CHANGELOG_PATH, changelogContent, 'utf-8');

// --- Step 5: commit and tag ------------------------------------------------
step(5, 'Committing and tagging...');
const staged = ['package.json', 'CHANGELOG.md'];
if (lockContent) staged.push('package-lock.json');

try {
  git(['add', ...staged]);
  git(['commit', '-m', `chore(release): ${tag}`]);
  git(['tag', '-a', tag, '-m', `Release ${tag}`]);
} catch {
  fail(
    'git could not commit or tag the release.',
    `The version files were already rewritten. Inspect "git status", then either finish by hand ` +
      `or restore them with "git checkout -- ${staged.join(' ')}".`
  );
}
console.log(`  Committed and tagged ${tag}.`);

// --- Step 6: push ----------------------------------------------------------
if (options.push) {
  step(6, 'Pushing the branch and tag...');
  try {
    git(['push', 'origin', branch, '--follow-tags']);
  } catch {
    fail(
      'git push failed.',
      `The release commit and tag exist locally. Retry with "git push origin ${branch} --follow-tags".`
    );
  }
  console.log('  Pushed. The release workflow takes over from here.');
} else {
  step(6, 'Skipping push (pass --push to publish immediately).');
}

console.log('\n======================================================');
console.log(`Release ${tag} prepared.`);
console.log('======================================================');

if (!options.push) {
  console.log('\nTo publish, run:');
  console.log(`  git push origin ${branch} --follow-tags`);
}
console.log(
  '\nThe release workflow creates the GitHub Release and publishes the package.\n' +
    'Nothing needs to be published by hand.\n'
);

if (options.ci) console.log(`version=${newVersion}\ntag=${tag}`);
