#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const releaseType = process.argv[2] || 'patch';

function run(cmd, options = {}) {
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR, ...options });
}

console.log('\n======================================================');
console.log(`   SMILEU CODE SKILL - AUTOMATED RELEASE RUNNER`);
console.log('======================================================\n');

// 1. Run full test suite
console.log('Step 1: Running automated test suite & sandboxes...');
try {
  run('npm test');
  console.log('✔ All tests passed!\n');
} catch (err) {
  console.error('❌ Test suite failed. Release aborted.');
  process.exit(1);
}

// 2. Read package.json & bump version
const pkgPath = path.join(ROOT_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);

let newVersion;
if (releaseType === 'major') {
  newVersion = `${major + 1}.0.0`;
} else if (releaseType === 'minor') {
  newVersion = `${major}.${minor + 1}.0`;
} else {
  newVersion = `${major}.${minor}.${patch + 1}`;
}

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(`Step 2: Bumped version: ${pkg.version} -> ${newVersion}`);

// 3. Stage & commit
console.log('Step 3: Staging release commit...');
run('git add package.json CHANGELOG.md');
run(`git commit -m "chore(release): v${newVersion}"`);

// 4. Create git tag
const tag = `v${newVersion}`;
console.log(`Step 4: Creating git tag ${tag}...`);
run(`git tag -a ${tag} -m "Release ${tag}"`);

console.log('\n======================================================');
console.log(`✔ Release ${tag} prepared successfully!`);
console.log('======================================================\n');
console.log('To publish the release, run:');
console.log('  git push origin main --follow-tags');
console.log('  npm publish --access public\n');
