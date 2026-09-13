import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ROOT_DIR = path.resolve('.');
const CLI_PATH = path.resolve('bin/cli.js');
const LIBRARY_DIR = path.join(ROOT_DIR, 'skills');
const SANDBOX_BASE = path.join(ROOT_DIR, '.test-sandboxes');

// Ensure a clean sandbox base directory.
if (fs.existsSync(SANDBOX_BASE)) {
  fs.rmSync(SANDBOX_BASE, { recursive: true, force: true });
}
fs.mkdirSync(SANDBOX_BASE, { recursive: true });

function run(args, cwd, input = '') {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    input,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: undefined, CI: 'true' }
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function makeSandbox(name) {
  const dir = path.join(SANDBOX_BASE, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('Sandbox 1: Frontend workspace install, clean root, and design scan', () => {
  const sandbox = makeSandbox('sandbox-1-frontend');

  // Install the core suite for Cursor (fast, deterministic).
  const init = run(['init', 'cursor', '--core', '-y'], sandbox);
  assert.equal(init.status, 0, init.stderr);
  assert.match(init.stdout, /Installed \d+ skills into 1 editor folder\./);
  assert.ok(fs.existsSync(path.join(sandbox, '.cursor', 'rules', 'smileu-code-skill', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(sandbox, '.cursorrules')));
  assert.ok(fs.existsSync(path.join(sandbox, 'PRODUCT.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'DESIGN.md')));
  assert.ok(fs.existsSync(path.join(sandbox, '.smileu', 'manifest.json')), 'install records a manifest');

  assert.match(run(['motion'], sandbox).stdout, /ease-out/);

  // A clean scan writes its report into .smileu/, never the root.
  const craftClean = run(['craft'], sandbox);
  assert.equal(craftClean.status, 0);
  assert.match(craftClean.stdout, /Design scan: no findings/);
  assert.ok(fs.existsSync(path.join(sandbox, '.smileu', 'reports', 'DESIGN_AUDIT.md')));
  assert.ok(!fs.existsSync(path.join(sandbox, 'DESIGN_AUDIT.md')), 'root must stay clean');

  const gitignore = fs.readFileSync(path.join(sandbox, '.gitignore'), 'utf-8');
  assert.match(gitignore, /\.smileu\//);

  // Inject two design anti-patterns and confirm both are flagged.
  const badComponent = path.join(sandbox, 'Hero.jsx');
  fs.writeFileSync(
    badComponent,
    `export default function Hero() {
      return <div style={{ backgroundColor: "#000000", animation: "bounce 1s infinite" }}>Hero</div>;
    }`
  );
  const craftFlagged = run(['craft'], sandbox);
  assert.equal(craftFlagged.status, 0, 'design findings are advisory');
  assert.match(craftFlagged.stdout, /Design scan: 2 findings in 1 UI file/);
  const designAudit = fs.readFileSync(path.join(sandbox, '.smileu', 'reports', 'DESIGN_AUDIT.md'), 'utf-8');
  assert.match(designAudit, /Pure Untinted Black/);
  assert.match(designAudit, /Sluggish Bouncy Animation/);
  fs.unlinkSync(badComponent);
});

test('Sandbox 2: Backend workspace install, persona preservation, swarm, and security scan', () => {
  const sandbox = makeSandbox('sandbox-2-backend');

  const init = run(['init', 'claude', '--core', '-y'], sandbox);
  assert.equal(init.status, 0, init.stderr);
  assert.match(init.stdout, /Installed \d+ skills into 1 editor folder\./);
  assert.ok(fs.existsSync(path.join(sandbox, '.claude', 'skills', 'smileu-code-skill', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(sandbox, '.claude', 'agents', 'guardian.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'CLAUDE.md')));

  // Re-running init keeps edited persona files unless --force is given.
  const guardian = path.join(sandbox, '.claude', 'agents', 'guardian.md');
  fs.writeFileSync(guardian, 'my team rules\n');
  const rerun = run(['init', 'claude', '--core', '-y'], sandbox);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.match(rerun.stdout, /Kept 12 existing persona files\. Use --force to replace them\./);
  assert.equal(fs.readFileSync(guardian, 'utf-8'), 'my team rules\n');

  // The swarm plan lands in .smileu/tasks, not .agent/tasks or the root.
  const swarm = run(['swarm', 'Design JWT authentication with rate limiting'], sandbox);
  assert.equal(swarm.status, 0);
  assert.match(swarm.stdout, /Lead Architect/);
  assert.match(swarm.stdout, /Security Guardian/);
  assert.ok(fs.existsSync(path.join(sandbox, '.smileu', 'tasks')));
  assert.ok(!fs.existsSync(path.join(sandbox, '.agent', 'tasks')));

  // A hardcoded secret plus eval() fails the scan with exit code 1.
  const vulnerable = path.join(sandbox, 'server.js');
  fs.writeFileSync(
    vulnerable,
    `const apiKey = "sk-1234567890abcdef1234567890abcdef";
     eval("console.log('unsafe execution')");`
  );
  const flagged = run(['audit'], sandbox);
  assert.equal(flagged.status, 1);
  assert.match(flagged.stdout, /Security scan: \d+ findings/);
  const auditReport = fs.readFileSync(path.join(sandbox, '.smileu', 'reports', 'SECURITY_AUDIT.md'), 'utf-8');
  assert.match(auditReport, /Potential Hardcoded Secret/);
  assert.match(auditReport, /eval\(\) Execution/);
  assert.ok(!fs.existsSync(path.join(sandbox, 'SECURITY_AUDIT.md')), 'root must stay clean');
  fs.unlinkSync(vulnerable);

  // .env files are scanned; example files and test fixtures are not flagged;
  // a folder whose name merely contains "test" is not exempt.
  const secretFiles = {
    '.env': 'DATABASE_PASSWORD=hunter2hunter2hunter2\n',
    '.env.example': 'DATABASE_PASSWORD=change-me-to-a-real-value\n',
    'latest/config.js': `export const key = "AKIA${'Q'.repeat(16)}";\n`,
    'test/fixture.js': `export const key = "AKIA${'Z'.repeat(16)}";\n`
  };
  for (const [rel, content] of Object.entries(secretFiles)) {
    fs.mkdirSync(path.dirname(path.join(sandbox, rel)), { recursive: true });
    fs.writeFileSync(path.join(sandbox, rel), content);
  }
  const envScan = run(['audit'], sandbox);
  assert.equal(envScan.status, 1);
  const envReport = fs.readFileSync(path.join(sandbox, '.smileu', 'reports', 'SECURITY_AUDIT.md'), 'utf-8');
  assert.match(envReport, /\*\*File:\*\* `\.env`/);
  assert.match(envReport, /\*\*File:\*\* `latest\/config\.js`/);
  assert.doesNotMatch(envReport, /`\.env\.example`/);
  assert.doesNotMatch(envReport, /`test\/fixture\.js`/);
  assert.doesNotMatch(envReport, /hunter2/, 'secret values never appear in the report');
  for (const rel of Object.keys(secretFiles)) fs.rmSync(path.join(sandbox, rel));

  const clean = run(['audit'], sandbox);
  assert.equal(clean.status, 0);
  assert.match(clean.stdout, /Security scan: no findings/);
});

test('Sandbox 3: Single-skill add, path-traversal guard, and full pipeline', () => {
  const sandbox = makeSandbox('sandbox-3-fullstack');

  const add = run(['add', 'domain-modeling'], sandbox);
  assert.equal(add.status, 0, add.stderr);
  assert.match(add.stdout, /domain-modeling/);
  assert.ok(fs.existsSync(path.join(sandbox, '.claude', 'skills', 'domain-modeling', 'SKILL.md')));

  const traversal = run(['add', '../../etc/passwd'], sandbox);
  assert.equal(traversal.status, 1);
  assert.match(traversal.stderr, /Skill names cannot contain/);

  const pipeline = run(['run-all'], sandbox);
  assert.equal(pipeline.status, 0, pipeline.stdout + pipeline.stderr);
  assert.match(pipeline.stdout, /\[Phase 1\/6: Align\]/);
  assert.match(pipeline.stdout, /\[Phase 6\/6: Humanize\]/);
  assert.match(pipeline.stdout, /All checks finished\. Reports are in \.smileu\/reports\//);

  assert.ok(fs.existsSync(path.join(sandbox, 'PRODUCT.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'CONTEXT.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'docs', 'adr', '0001-unified-vibe-coding-harness.md')));
  const graphDir = path.join(sandbox, '.smileu', 'graph');
  assert.ok(
    fs.existsSync(path.join(graphDir, 'graph.json')) || fs.existsSync(path.join(graphDir, 'graphify-out', 'graph.json')),
    'a graph is written by the native engine or the built-in scanner'
  );
  assert.ok(!fs.existsSync(path.join(sandbox, 'graphify-out')), 'root must stay clean');
});

test('Sandbox 4: Full library dry-run resolves the whole catalog without writing', () => {
  const sandbox = makeSandbox('sandbox-4-dryrun');

  const out = run(['init', '--full', '--dry-run', '-y', '-e', 'universal'], sandbox);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /Would install: \d{3,} skills into 1 editor folder/);
  assert.match(out.stdout, /No files were written/);

  assert.deepEqual(fs.readdirSync(sandbox), [], 'a dry run must not create anything');
});

test('Sandbox 5: update refreshes changed files, keeps user files, and adds new skills on request', () => {
  const sandbox = makeSandbox('sandbox-5-update');

  const init = run(['init', 'claude', '--core', '-y'], sandbox);
  assert.equal(init.status, 0, init.stderr);

  const skillFile = path.join(sandbox, '.claude', 'skills', 'frontend-taste', 'SKILL.md');
  const libraryCopy = fs.readFileSync(path.join(LIBRARY_DIR, 'frontend-taste', 'SKILL.md'), 'utf-8');
  const personaFile = path.join(sandbox, '.claude', 'agents', 'architect.md');
  const notesFile = path.join(sandbox, '.claude', 'skills', 'frontend-taste', 'MY_NOTES.md');
  fs.writeFileSync(skillFile, 'locally edited\n');
  fs.writeFileSync(personaFile, 'locally edited persona\n');
  fs.writeFileSync(notesFile, 'keep me\n');

  const dry = run(['update', '--dry-run'], sandbox);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Would write 2 files/);
  assert.equal(fs.readFileSync(skillFile, 'utf-8'), 'locally edited\n', 'a dry run changes nothing');

  const live = run(['update'], sandbox);
  assert.equal(live.status, 0, live.stderr);
  assert.match(live.stdout, /Updated:\s+frontend-taste/);
  assert.match(live.stdout, /Wrote 2 files/);
  assert.equal(fs.readFileSync(skillFile, 'utf-8'), libraryCopy);
  assert.notEqual(fs.readFileSync(personaFile, 'utf-8'), 'locally edited persona\n');
  assert.equal(fs.readFileSync(notesFile, 'utf-8'), 'keep me\n', 'files the user added are kept');

  const again = run(['update'], sandbox);
  assert.equal(again.status, 0);
  assert.match(again.stdout, /Everything is already up to date/);

  const manifest = JSON.parse(fs.readFileSync(path.join(sandbox, '.smileu', 'manifest.json'), 'utf-8'));
  assert.equal(manifest.scope, 'core');
  assert.ok(manifest.skills.includes('frontend-taste'));
  assert.ok(manifest.editors.includes('claude'));

  const withNew = run(['update', '--include-new', '--dry-run'], sandbox);
  assert.equal(withNew.status, 0, withNew.stderr);
  assert.match(withNew.stdout, /Added:\s+\d{3,} skills/);
  assert.ok(!fs.existsSync(path.join(sandbox, '.claude', 'skills', 'domain-modeling')), 'a dry run adds nothing');

  const wrongEditor = run(['update', '-e', 'cursor'], sandbox);
  assert.equal(wrongEditor.status, 1);
  assert.match(wrongEditor.stderr, /No installed skills found for Cursor IDE/);

  const extraArg = run(['update', 'frontend-taste'], sandbox);
  assert.equal(extraArg.status, 2);

  const empty = makeSandbox('sandbox-5-empty');
  const nothing = run(['update'], empty);
  assert.equal(nothing.status, 1);
  assert.match(nothing.stderr, /No installed skills found in this folder/);
});

test('Sandbox 6: grill reads piped answers, backs up existing documents, and stops on short input', () => {
  const sandbox = makeSandbox('sandbox-6-grill');
  fs.writeFileSync(path.join(sandbox, 'PRODUCT.md'), '# My hand-written product doc\n');

  const answers = ['Checkout', 'Shoppers', 'Pay in one step', 'Store money as integer cents', 'Card declined'].join('\n') + '\n';
  const grill = run(['grill'], sandbox, answers);
  assert.equal(grill.status, 0, grill.stderr);
  assert.match(grill.stdout, /Replaced PRODUCT\.md \(previous copy saved to \.smileu\/backups\/PRODUCT\.md\./);
  assert.match(grill.stdout, /Created CONTEXT\.md/);

  const product = fs.readFileSync(path.join(sandbox, 'PRODUCT.md'), 'utf-8');
  assert.match(product, /# Product Truth: Checkout/);
  assert.match(product, /Store money as integer cents/);
  assert.ok(fs.existsSync(path.join(sandbox, 'CONTEXT.md')));

  const backups = fs.readdirSync(path.join(sandbox, '.smileu', 'backups'));
  assert.equal(backups.length, 1);
  assert.equal(
    fs.readFileSync(path.join(sandbox, '.smileu', 'backups', backups[0]), 'utf-8'),
    '# My hand-written product doc\n'
  );

  const short = run(['grill'], sandbox, 'Only one answer\n');
  assert.equal(short.status, 2);
  assert.match(short.stderr, /Input ended before question 2 of 5 was answered/);
  assert.match(fs.readFileSync(path.join(sandbox, 'PRODUCT.md'), 'utf-8'), /# Product Truth: Checkout/, 'nothing is written');
});
