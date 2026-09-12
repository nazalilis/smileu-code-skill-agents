import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ROOT_DIR = path.resolve('.');
const CLI_PATH = path.resolve('bin/cli.js');
const SANDBOX_BASE = path.join(ROOT_DIR, '.test-sandboxes');

// Ensure clean sandbox base directory
if (fs.existsSync(SANDBOX_BASE)) {
  fs.rmSync(SANDBOX_BASE, { recursive: true, force: true });
}
fs.mkdirSync(SANDBOX_BASE, { recursive: true });

const run = (cmd, cwd) => execSync(`node "${CLI_PATH}" ${cmd}`, { cwd, encoding: 'utf-8' });

test('Sandbox 1: Frontend workspace install, clean root, and anti-slop audit', () => {
  const sandbox = path.join(SANDBOX_BASE, 'sandbox-1-frontend');
  fs.mkdirSync(sandbox, { recursive: true });

  // Install the core suite for Cursor (fast, deterministic).
  const initOutput = run('init cursor --core -y', sandbox);
  assert.match(initOutput, /Smileu Code Skill successfully installed and activated!/);
  assert.ok(fs.existsSync(path.join(sandbox, '.cursor', 'rules', 'smileu-code-skill', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(sandbox, '.cursorrules')));
  assert.ok(fs.existsSync(path.join(sandbox, 'PRODUCT.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'DESIGN.md')));

  // Motion curves.
  assert.match(run('motion', sandbox), /ease-out/);

  // Clean design passes and writes into .smileu/, never the root.
  const craftClean = run('craft', sandbox);
  assert.match(craftClean, /High aesthetic craft verified/);
  assert.ok(fs.existsSync(path.join(sandbox, '.smileu', 'reports', 'DESIGN_AUDIT.md')));
  assert.ok(!fs.existsSync(path.join(sandbox, 'DESIGN_AUDIT.md')), 'root must stay clean');

  // .gitignore is created and ignores .smileu/.
  const gitignore = fs.readFileSync(path.join(sandbox, '.gitignore'), 'utf-8');
  assert.match(gitignore, /\.smileu\//);

  // Inject an anti-slop violation and confirm it is flagged.
  const badComponent = path.join(sandbox, 'Hero.jsx');
  fs.writeFileSync(
    badComponent,
    `export default function Hero() {
      return <div style={{ backgroundColor: "#000000", animation: "bounce 1s infinite" }}>Hero</div>;
    }`
  );
  const craftFlagged = run('craft', sandbox);
  assert.match(craftFlagged, /item\(s\) noted/);
  const designAudit = fs.readFileSync(path.join(sandbox, '.smileu', 'reports', 'DESIGN_AUDIT.md'), 'utf-8');
  assert.match(designAudit, /Pure Untinted Black/);
  assert.match(designAudit, /Sluggish Bouncy Animation/);
  fs.unlinkSync(badComponent);
});

test('Sandbox 2: Backend workspace install, swarm, and security audit', () => {
  const sandbox = path.join(SANDBOX_BASE, 'sandbox-2-backend');
  fs.mkdirSync(sandbox, { recursive: true });

  const initOutput = run('init claude --core -y', sandbox);
  assert.match(initOutput, /Smileu Code Skill successfully installed and activated!/);
  assert.ok(fs.existsSync(path.join(sandbox, '.claude', 'skills', 'smileu-code-skill', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(sandbox, '.claude', 'agents', 'guardian.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'CLAUDE.md')));

  // Swarm plan lands in .smileu/tasks, not .agent/tasks or the root.
  const swarmOutput = run('swarm "Design JWT authentication with rate limiting"', sandbox);
  assert.match(swarmOutput, /Lead Architect/);
  assert.match(swarmOutput, /Security Guardian/);
  assert.ok(fs.existsSync(path.join(sandbox, '.smileu', 'tasks')));
  assert.ok(!fs.existsSync(path.join(sandbox, '.agent', 'tasks')));

  // Inject a hardcoded secret + eval and confirm detection.
  const vulnerable = path.join(sandbox, 'server.js');
  fs.writeFileSync(
    vulnerable,
    `const apiKey = "sk-1234567890abcdef1234567890abcdef";
     eval("console.log('unsafe execution')");`
  );
  const flagged = run('audit', sandbox);
  assert.match(flagged, /finding\(s\) discovered/);
  const auditReport = fs.readFileSync(path.join(sandbox, '.smileu', 'reports', 'SECURITY_AUDIT.md'), 'utf-8');
  assert.match(auditReport, /Potential Hardcoded Secret/);
  assert.match(auditReport, /eval\(\) Execution/);
  assert.ok(!fs.existsSync(path.join(sandbox, 'SECURITY_AUDIT.md')), 'root must stay clean');

  fs.unlinkSync(vulnerable);
  assert.match(run('audit', sandbox), /0 vulnerabilities found/);
});

test('Sandbox 3: Single-skill add, path-traversal guard, and full pipeline', () => {
  const sandbox = path.join(SANDBOX_BASE, 'sandbox-3-fullstack');
  fs.mkdirSync(sandbox, { recursive: true });

  // Add a specific skill by name.
  const addOutput = run('add domain-modeling', sandbox);
  assert.match(addOutput, /domain-modeling/);
  assert.ok(fs.existsSync(path.join(sandbox, '.claude', 'skills', 'domain-modeling', 'SKILL.md')));

  // Path traversal attempt is rejected.
  const traversal = run('add ../../etc/passwd', sandbox);
  assert.match(traversal, /Invalid or unsafe path traversal detected/);

  // Full 6-phase pipeline.
  const pipeline = run('run-all', sandbox);
  assert.match(pipeline, /PHASE 1\/6: ALIGN & CLARIFY/);
  assert.match(pipeline, /PHASE 6\/6: HUMANIZE/);
  assert.match(pipeline, /THE COMPLETE SMILEU 6-PHASE PIPELINE HAS FINISHED!/);

  assert.ok(fs.existsSync(path.join(sandbox, 'PRODUCT.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'CONTEXT.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(sandbox, 'docs', 'adr', '0001-unified-vibe-coding-harness.md')));
  assert.ok(fs.existsSync(path.join(sandbox, '.smileu', 'graph', 'graph.json')));
  assert.ok(!fs.existsSync(path.join(sandbox, 'graphify-out')), 'root must stay clean');
});

test('Sandbox 4: Full library dry-run resolves the whole catalog without writing', () => {
  const sandbox = path.join(SANDBOX_BASE, 'sandbox-4-dryrun');
  fs.mkdirSync(sandbox, { recursive: true });

  const out = run('init --full --dry-run -y -e universal', sandbox);
  assert.match(out, /Would install: \d{3,} skill/); // hundreds of skills
  assert.match(out, /No files were written/);

  // Dry-run must not create anything on disk.
  assert.ok(!fs.existsSync(path.join(sandbox, '.skills')));
  assert.ok(!fs.existsSync(path.join(sandbox, 'PRODUCT.md')));
});
