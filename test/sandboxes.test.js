import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(ROOT, 'bin', 'cli.js');
const LIBRARY_DIR = path.join(ROOT, 'skills');

// Sandboxes live in the OS temp directory and are removed after the run, so the
// test suite never leaves folders behind in the repository.
const SANDBOX_BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'smileu-sandboxes-'));
after(() => {
  fs.rmSync(SANDBOX_BASE, { recursive: true, force: true });
});

function run(args, cwd, input = '') {
  const env = { ...process.env, NO_COLOR: '1', CI: 'true' };
  delete env.FORCE_COLOR;
  delete env.npm_command;
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], { cwd, input, encoding: 'utf-8', env });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function makeSandbox(name) {
  const dir = path.join(SANDBOX_BASE, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const exists = (sandbox, rel) => fs.existsSync(path.join(sandbox, rel));
const read = (sandbox, rel) => fs.readFileSync(path.join(sandbox, rel), 'utf-8');
const markdownFiles = (sandbox, rel) => fs.readdirSync(path.join(sandbox, rel)).filter((f) => f.endsWith('.md'));

test('Sandbox 1: Cursor install uses the folders Cursor reads, keeps the root clean, and scans UI files', () => {
  const sandbox = makeSandbox('sandbox-1-cursor');

  const init = run(['init', 'cursor', '--core', '-y'], sandbox);
  assert.equal(init.status, 0, init.stderr);
  assert.match(init.stdout, /Installed 10 skills into 1 skill folder\./);
  assert.match(init.stdout, /type \/smileu to see the phases/);

  assert.ok(exists(sandbox, '.agents/skills/smileu-code-skill/SKILL.md'), 'master skill in .agents/skills');
  assert.ok(exists(sandbox, '.agents/skills/smileu/SKILL.md'), 'the /smileu command skill is installed');
  assert.equal(fs.readdirSync(path.join(sandbox, '.agents', 'skills')).length, 10, '9 core skills plus /smileu');
  assert.deepEqual(fs.readdirSync(path.join(sandbox, '.cursor', 'rules')), ['smileu.mdc'], 'only the rule file goes in .cursor/rules');
  assert.match(read(sandbox, '.cursor/rules/smileu.mdc'), /^---\ndescription: .+\nalwaysApply: true\n---/);
  assert.equal(markdownFiles(sandbox, '.cursor/agents').length, 12);
  for (const doc of ['PRODUCT.md', 'CONTEXT.md', 'DESIGN.md', 'AGENTS.md', '.smileu/manifest.json']) {
    assert.ok(exists(sandbox, doc), `${doc} is created`);
  }

  for (const other of ['.claude', 'CLAUDE.md', '.windsurf', '.agents/rules', '.agent', '.skills', '.cursorrules', '.windsurfrules']) {
    assert.ok(!exists(sandbox, other), `${other} must not be created for a Cursor install`);
  }

  assert.match(run(['motion'], sandbox).stdout, /ease-out/);

  // A clean scan writes its report into .smileu/, never the root.
  const craftClean = run(['craft'], sandbox);
  assert.equal(craftClean.status, 0);
  assert.match(craftClean.stdout, /Design scan: no findings/);
  assert.ok(exists(sandbox, '.smileu/reports/DESIGN_AUDIT.md'));
  assert.ok(!exists(sandbox, 'DESIGN_AUDIT.md'), 'root must stay clean');

  // Running scans again does not add the .gitignore rule twice.
  run(['craft'], sandbox);
  assert.equal((read(sandbox, '.gitignore').match(/^\.smileu\/$/gm) || []).length, 1);

  // Inject two design anti-patterns and confirm both are flagged.
  fs.writeFileSync(
    path.join(sandbox, 'Hero.jsx'),
    `export default function Hero() {
      return <div style={{ backgroundColor: "#000000", animation: "bounce 1s infinite" }}>Hero</div>;
    }`
  );
  const craftFlagged = run(['craft'], sandbox);
  assert.equal(craftFlagged.status, 0, 'design findings are advisory');
  assert.match(craftFlagged.stdout, /Design scan: 2 findings in 1 UI file/);
  const designAudit = read(sandbox, '.smileu/reports/DESIGN_AUDIT.md');
  assert.match(designAudit, /Pure Untinted Black/);
  assert.match(designAudit, /Sluggish Bouncy Animation/);
  fs.unlinkSync(path.join(sandbox, 'Hero.jsx'));
});

test('Sandbox 2: Claude Code install, loadable personas, persona preservation, swarm, and security scan', () => {
  const sandbox = makeSandbox('sandbox-2-claude');

  const init = run(['init', 'claude', '--core', '-y'], sandbox);
  assert.equal(init.status, 0, init.stderr);
  assert.match(init.stdout, /Installed 10 skills into 1 skill folder\./);
  assert.ok(exists(sandbox, '.claude/skills/smileu-code-skill/SKILL.md'));
  assert.ok(exists(sandbox, '.claude/skills/smileu/SKILL.md'), '/smileu is available in Claude Code');
  assert.match(read(sandbox, 'CLAUDE.md'), /\/smileu/);
  assert.ok(!exists(sandbox, '.agents'), 'a Claude-only install does not write .agents/');

  // Claude Code ignores agent files without name/description frontmatter.
  for (const file of markdownFiles(sandbox, '.claude/agents')) {
    const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(read(sandbox, `.claude/agents/${file}`));
    assert.ok(head, `${file} starts with frontmatter`);
    assert.match(head[1], new RegExp(`^name: ${file.replace(/\.md$/, '')}$`, 'm'), `${file} name matches the file`);
    assert.match(head[1], /^description: \S/m, `${file} has a description`);
  }

  // Re-running init keeps edited persona files unless --force is given.
  fs.writeFileSync(path.join(sandbox, '.claude', 'agents', 'guardian.md'), 'my team rules\n');
  const rerun = run(['init', 'claude', '--core', '-y'], sandbox);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.match(rerun.stdout, /Kept 12 existing persona files\. Use --force to replace them\./);
  assert.equal(read(sandbox, '.claude/agents/guardian.md'), 'my team rules\n');

  // The swarm plan lands in .smileu/tasks, not the root.
  const swarm = run(['swarm', 'Design JWT authentication with rate limiting'], sandbox);
  assert.equal(swarm.status, 0);
  assert.match(swarm.stdout, /Lead Architect/);
  assert.match(swarm.stdout, /Security Guardian/);
  assert.equal(fs.readdirSync(path.join(sandbox, '.smileu', 'tasks')).length, 1);

  // A hardcoded secret plus eval() fails the scan with exit code 1.
  fs.writeFileSync(
    path.join(sandbox, 'server.js'),
    `const apiKey = "sk-1234567890abcdef1234567890abcdef";
     eval("console.log('unsafe execution')");`
  );
  const flagged = run(['audit'], sandbox);
  assert.equal(flagged.status, 1);
  assert.match(flagged.stdout, /Security scan: \d+ findings/);
  const auditReport = read(sandbox, '.smileu/reports/SECURITY_AUDIT.md');
  // One finding for the file, naming both patterns the same value matched.
  assert.match(auditReport, /Potential Hardcoded Secret \(Generic API Key, OpenAI API Key\)/);
  assert.equal((auditReport.match(/Potential Hardcoded Secret/g) || []).length, 1);
  assert.match(auditReport, /eval\(\) Execution/);
  assert.ok(!exists(sandbox, 'SECURITY_AUDIT.md'), 'root must stay clean');
  fs.unlinkSync(path.join(sandbox, 'server.js'));

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
  const envReport = read(sandbox, '.smileu/reports/SECURITY_AUDIT.md');
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
  assert.match(add.stdout, /into 2 skill folders/);
  for (const skillsDir of ['.claude/skills', '.agents/skills']) {
    for (const id of ['domain-modeling', 'smileu-code-skill', 'smileu']) {
      assert.ok(exists(sandbox, `${skillsDir}/${id}/SKILL.md`), `${skillsDir} has ${id}`);
    }
  }
  for (const other of ['PRODUCT.md', 'CLAUDE.md', '.cursor', '.windsurf', '.agent', '.skills']) {
    assert.ok(!exists(sandbox, other), `"add" does not write ${other}`);
  }

  const traversal = run(['add', '../../etc/passwd'], sandbox);
  assert.equal(traversal.status, 1);
  assert.match(traversal.stderr, /Skill names cannot contain/);

  const pipeline = run(['run-all'], sandbox);
  assert.equal(pipeline.status, 0, pipeline.stdout + pipeline.stderr);
  assert.match(pipeline.stdout, /\[Phase 1\/6: Align\]/);
  assert.match(pipeline.stdout, /\[Phase 6\/6: Humanize\]/);
  assert.match(pipeline.stdout, /All checks finished\. Reports are in \.smileu\/reports\//);

  for (const doc of ['PRODUCT.md', 'CONTEXT.md', 'AGENTS.md', 'docs/adr/0001-unified-vibe-coding-harness.md']) {
    assert.ok(exists(sandbox, doc), `run-all creates ${doc}`);
  }
  assert.ok(!exists(sandbox, '.cursor'), 'run-all writes project documents only, not editor files');
  const graphDir = path.join(sandbox, '.smileu', 'graph');
  assert.ok(
    fs.existsSync(path.join(graphDir, 'graph.json')) || fs.existsSync(path.join(graphDir, 'graphify-out', 'graph.json')),
    'a graph is written by the native engine or the built-in scanner'
  );
  assert.ok(!exists(sandbox, 'graphify-out'), 'root must stay clean');
});

test('Sandbox 4: Full library dry-run resolves the whole catalog without writing', () => {
  const sandbox = makeSandbox('sandbox-4-dryrun');

  const out = run(['init', '--full', '--dry-run', '-y', '-e', 'universal'], sandbox);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /Would install: \d{3,} skills into 1 skill folder/);
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

  const manifest = JSON.parse(read(sandbox, '.smileu/manifest.json'));
  assert.equal(manifest.scope, 'core');
  assert.ok(manifest.skills.includes('frontend-taste'));
  assert.ok(manifest.editors.includes('claude'));

  const withNew = run(['update', '--include-new', '--dry-run'], sandbox);
  assert.equal(withNew.status, 0, withNew.stderr);
  assert.match(withNew.stdout, /Added:\s+\d{3,} skills/);
  assert.ok(!exists(sandbox, '.claude/skills/domain-modeling'), 'a dry run adds nothing');

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

  const product = read(sandbox, 'PRODUCT.md');
  assert.match(product, /# Product Truth: Checkout/);
  assert.match(product, /Store money as integer cents/);
  assert.ok(exists(sandbox, 'CONTEXT.md'));

  const backups = fs.readdirSync(path.join(sandbox, '.smileu', 'backups'));
  assert.equal(backups.length, 1);
  assert.equal(read(sandbox, `.smileu/backups/${backups[0]}`), '# My hand-written product doc\n');

  // The same answers again change nothing and create no second backup.
  const repeat = run(['grill'], sandbox, answers);
  assert.equal(repeat.status, 0);
  assert.match(repeat.stdout, /PRODUCT\.md already matches these answers/);
  assert.equal(fs.readdirSync(path.join(sandbox, '.smileu', 'backups')).length, 1);

  const short = run(['grill'], sandbox, 'Only one answer\n');
  assert.equal(short.status, 2);
  assert.match(short.stderr, /Input ended before question 2 of 5 was answered/);
  assert.match(read(sandbox, 'PRODUCT.md'), /# Product Truth: Checkout/, 'nothing is written');
});

test('Sandbox 7: Windsurf, Antigravity and all-editor installs share .agents/skills and write each editor file once', () => {
  const windsurf = makeSandbox('sandbox-7-windsurf');
  const ws = run(['init', 'windsurf', '--core', '-y'], windsurf);
  assert.equal(ws.status, 0, ws.stderr);
  assert.ok(exists(windsurf, '.agents/skills/smileu/SKILL.md'));
  assert.match(read(windsurf, '.windsurf/rules/smileu.md'), /^---\ntrigger: always_on\n/);
  assert.match(read(windsurf, '.windsurf/workflows/smileu.md'), /\.agents\/skills\/smileu\/SKILL\.md/);
  for (const other of ['.claude', '.cursor', '.agents/rules', '.windsurfrules', '.agent']) {
    assert.ok(!exists(windsurf, other), `${other} must not be created for a Windsurf install`);
  }

  const antigravity = makeSandbox('sandbox-7-antigravity');
  const ag = run(['init', 'antigravity', '--core', '-y'], antigravity);
  assert.equal(ag.status, 0, ag.stderr);
  assert.ok(exists(antigravity, '.agents/skills/smileu/SKILL.md'));
  assert.match(read(antigravity, '.agents/rules/smileu.md'), /\/smileu <phase>/);
  for (const other of ['.claude', '.cursor', '.windsurf', '.agent']) {
    assert.ok(!exists(antigravity, other), `${other} must not be created for an Antigravity install`);
  }

  const all = makeSandbox('sandbox-7-all');
  const everything = run(['init', '--core', '-y'], all);
  assert.equal(everything.status, 0, everything.stderr);
  assert.match(everything.stdout, /Installed 10 skills into 2 skill folders\./);
  for (const file of ['CLAUDE.md', '.cursor/rules/smileu.mdc', '.windsurf/rules/smileu.md', '.windsurf/workflows/smileu.md', '.agents/rules/smileu.md']) {
    assert.ok(exists(all, file), `${file} is created`);
  }
  assert.equal(fs.readdirSync(path.join(all, '.claude', 'skills')).length, 10);
  assert.equal(fs.readdirSync(path.join(all, '.agents', 'skills')).length, 10);
  assert.equal(markdownFiles(all, '.claude/agents').length, 12);
  assert.equal(markdownFiles(all, '.cursor/agents').length, 12);
  for (const other of ['.cursor/skills', '.windsurf/skills', '.agent', '.skills', '.cursorrules', '.windsurfrules']) {
    assert.ok(!exists(all, other), `${other} must not be created`);
  }

  const update = run(['update'], all);
  assert.equal(update.status, 0, update.stderr);
  assert.match(update.stdout, /Everything is already up to date/);

  // --editor limits which persona folders are written, and a deleted persona stays deleted.
  fs.writeFileSync(path.join(all, '.cursor', 'agents', 'architect.md'), 'edited in cursor\n');
  fs.rmSync(path.join(all, '.claude', 'agents', 'tester.md'));
  const windsurfOnly = run(['update', '-e', 'windsurf'], all);
  assert.equal(windsurfOnly.status, 0, windsurfOnly.stderr);
  assert.equal(read(all, '.cursor/agents/architect.md'), 'edited in cursor\n', 'update -e windsurf does not write .cursor/agents');
  const refreshAll = run(['update'], all);
  assert.equal(refreshAll.status, 0, refreshAll.stderr);
  assert.notEqual(read(all, '.cursor/agents/architect.md'), 'edited in cursor\n', 'update for all editors refreshes it');
  assert.ok(!exists(all, '.claude/agents/tester.md'), 'a deleted persona is not added back');
});

test('Sandbox 8: copies left in pre-1.2 folders are recognised by content, removed on request, and user files are kept', () => {
  const sandbox = makeSandbox('sandbox-8-legacy');
  const seedSkill = (dir, id) => fs.cpSync(path.join(LIBRARY_DIR, id), path.join(sandbox, dir, id), { recursive: true });
  const write = (rel, content) => {
    fs.mkdirSync(path.dirname(path.join(sandbox, rel)), { recursive: true });
    fs.writeFileSync(path.join(sandbox, rel), content);
  };

  // Smileu copies as older versions installed them.
  seedSkill('.cursor/rules', 'frontend-taste');
  write(
    '.cursor/rules/smileu-code-skill/SKILL.md',
    '---\nname: smileu-code-skill\ndescription: "The ultimate unified vibe coding super-skill combining engineering alignment, knowledge graphs, anti-slop design taste, impeccable craft, UI motion physics, agent swarms, humanized writing, and cybersecurity hardening."\n---\n\n# Smileu Code Skill\n'
  );
  seedSkill('.agent/skills', 'frontend-taste');
  seedSkill('.skills', 'domain-modeling');
  fs.mkdirSync(path.join(sandbox, '.agent', 'agents'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'templates', 'agents', 'architect.md'), path.join(sandbox, '.agent', 'agents', 'architect.md'));
  write('.skills/agents/craft.md', '# Role: Design & Motion Specialist (@craft)\r\n\r\nPersona text from before 1.2.\r\n');

  // The user's own files, two of them sharing a name with the library.
  write('.cursor/rules/domain-modeling/SKILL.md', '---\nname: domain-modeling\ndescription: Our team notes on modelling\n---\n');
  write('.agent/agents/guardian.md', '# Our own guardian persona\n');
  write('.cursor/rules/team.mdc', '---\nalwaysApply: true\n---\nTeam rule\n');
  write('.cursor/rules/my-own-skill/SKILL.md', '---\nname: my-own-skill\ndescription: mine\n---\n');
  write('.cursorrules', 'old rules\n');

  const onlyOld = run(['update'], sandbox);
  assert.equal(onlyOld.status, 1);
  assert.match(onlyOld.stderr, /older Smileu versions used/);
  assert.match(onlyOld.stderr, /init <editor>/);

  const wrongEditor = run(['update', '-e', 'claude'], sandbox);
  assert.equal(wrongEditor.status, 1);
  assert.match(wrongEditor.stderr, /No installed skills found for Claude Code/, 'old Cursor copies are not blamed on Claude Code');

  const removeFirst = run(['update', '--remove-old-layout'], sandbox);
  assert.equal(removeFirst.status, 1, 'old copies are not removed before the new layout is installed');
  assert.ok(exists(sandbox, '.cursor/rules/frontend-taste/SKILL.md'));

  const init = run(['init', 'cursor', '--core', '-y'], sandbox);
  assert.equal(init.status, 0, init.stderr);
  assert.match(
    init.stdout,
    /Found copies from an older Smileu version in folders your editors do not read: \.cursor\/rules \(2 skills\), \.agent\/skills \(1 skill\), \.skills \(1 skill\), \.agent\/agents \(1 persona file\), \.skills\/agents \(1 persona file\)/
  );
  assert.match(init.stdout, /update --remove-old-layout/);
  assert.match(init.stdout, /\.cursorrules is no longer written by Smileu/);

  const scoped = run(['update', '-e', 'cursor', '--remove-old-layout', '--dry-run'], sandbox);
  assert.equal(scoped.status, 0, scoped.stderr);
  assert.match(scoped.stdout, /Would remove 2 old copies/, '--editor limits the old folders that are checked');

  const dry = run(['update', '--remove-old-layout', '--dry-run'], sandbox);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Would remove 6 old copies/);
  assert.ok(exists(sandbox, '.skills/domain-modeling/SKILL.md'), 'a dry run removes nothing');

  const live = run(['update', '--remove-old-layout'], sandbox);
  assert.equal(live.status, 0, live.stderr);
  assert.match(live.stdout, /Removed 6 old copies/);
  assert.match(live.stdout, /\.cursor\/rules: kept domain-modeling/);
  assert.match(live.stdout, /\.agent\/agents: kept guardian\.md/);
  for (const gone of ['.cursor/rules/frontend-taste', '.cursor/rules/smileu-code-skill', '.agent/skills', '.agent/agents/architect.md', '.skills']) {
    assert.ok(!exists(sandbox, gone), `${gone} is removed`);
  }
  for (const kept of [
    '.cursor/rules/team.mdc',
    '.cursor/rules/my-own-skill/SKILL.md',
    '.cursor/rules/domain-modeling/SKILL.md',
    '.agent/agents/guardian.md',
    '.cursor/rules/smileu.mdc',
    '.cursorrules',
    '.agents/skills/frontend-taste/SKILL.md'
  ]) {
    assert.ok(exists(sandbox, kept), `${kept} is kept`);
  }

  const after = run(['update'], sandbox);
  assert.equal(after.status, 0, after.stderr);
  assert.doesNotMatch(after.stdout, /older Smileu version/);
});
