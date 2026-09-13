import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = path.join(ROOT, 'bin', 'cli.js');

// The repository-level scans below write reports into .smileu/. Remove the
// folder again afterwards, unless it already existed before the tests ran.
const REPO_OUTPUT_DIR = path.join(ROOT, '.smileu');
const repoOutputExisted = fs.existsSync(REPO_OUTPUT_DIR);
after(() => {
  if (!repoOutputExisted) fs.rmSync(REPO_OUTPUT_DIR, { recursive: true, force: true });
});

// A predictable environment: no colour, CI mode, and no npm_command, so the CLI
// behaves as if it was started directly rather than through npm or npx.
function testEnv(extra = {}) {
  const env = { ...process.env, NO_COLOR: '1', CI: 'true' };
  delete env.FORCE_COLOR;
  delete env.npm_command;
  return { ...env, ...extra };
}

// Runs the CLI without a shell and captures stdout, stderr and the exit code.
// stdin is a pipe, never a TTY, so no command can stop to prompt.
function cli(args, { cwd = ROOT, input = '', env = {} } = {}) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    input,
    encoding: 'utf-8',
    env: testEnv(env)
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smileu-cli-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('--version prints only the version line', () => {
  const { status, stdout } = cli(['--version']);
  assert.equal(status, 0);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  assert.equal(stdout.trim(), `smileu-code-skill version ${pkg.version}`);
});

test('-v and --version work anywhere on the command line and never run the command', () => {
  withTempDir((dir) => {
    for (const args of [['swarm', 'Build login', '-v'], ['init', '--dry-run', '--version', '-y']]) {
      const { status, stdout } = cli(args, { cwd: dir });
      assert.equal(status, 0, args.join(' '));
      assert.match(stdout, /^smileu-code-skill version \d+\.\d+\.\d+\s*$/, args.join(' '));
    }
    assert.deepEqual(fs.readdirSync(dir), [], 'the command itself did not run');

    const quoted = cli(['swarm', 'fix the -v flag'], { cwd: dir });
    assert.match(quoted.stdout, /Task plan: fix the -v flag/, 'a quoted task containing -v is not the flag');
  });
});

test('--help documents every command, the update options and exit codes', () => {
  const { status, stdout } = cli(['--help']);
  assert.equal(status, 0);
  assert.match(stdout, /Usage: smileu <command> \[options\]/);
  assert.match(stdout, /npx smileu-code-skill <command>/);
  for (const command of ['init', 'add', 'update', 'audit', 'craft', 'humanize', 'graph', 'run-all', 'grill', 'swarm', 'motion', 'doctor', 'list', 'repos']) {
    assert.match(stdout, new RegExp(`\\n  ${command}\\b`), `help lists "${command}"`);
  }
  assert.match(stdout, /--include-new/);
  assert.match(stdout, /--check/);
  assert.match(stdout, /Exit codes:/);
});

test('doctor reports the runtimes it checked', () => {
  const { status, stdout } = cli(['doctor']);
  assert.equal(status, 0);
  assert.match(stdout, /Node\.js\s+v\d+/);
  assert.match(stdout, /Git/);
});

test('list shows the core skills and the library size', () => {
  const { status, stdout } = cli(['list']);
  assert.equal(status, 0);
  for (const id of ['smileu-code-skill', 'engineering-alignment', 'codebase-knowledge-graph', 'frontend-taste', 'cybersecurity-hardening']) {
    assert.match(stdout, new RegExp(`\\b${id}\\b`));
  }
  const librarySize = fs.readdirSync(path.join(ROOT, 'skills')).filter((d) => fs.existsSync(path.join(ROOT, 'skills', d, 'SKILL.md'))).length;
  assert.match(stdout, new RegExp(`The bundled library has ${librarySize} skills in total`));
});

test('list --all prints skill names, filters them, and fails when nothing matches', () => {
  const found = cli(['list', '--all', 'frontend-taste']);
  assert.equal(found.status, 0);
  assert.ok(found.stdout.split(/\r?\n/).includes('frontend-taste'));

  const none = cli(['list', '--all', 'no-such-skill-zzz']);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /No skill names contain "no-such-skill-zzz"/);
});

test('repos lists the upstream projects', () => {
  const { status, stdout } = cli(['repos']);
  assert.equal(status, 0);
  for (const repo of ['mattpocock/skills', 'Graphify-Labs/graphify', 'Leonxlnx/taste-skill', 'ruvnet/ruflo', 'emilkowalski/skills', 'pbakaus/impeccable', 'blader/humanizer', 'mukul975/Anthropic-Cybersecurity-Skills']) {
    assert.ok(stdout.includes(repo), `repos lists ${repo}`);
  }
});

test('motion prints presets, one preset on request, and rejects unknown names', () => {
  const all = cli(['motion']);
  assert.equal(all.status, 0);
  assert.match(all.stdout, /\[enter\][\s\S]*ease-out/);
  assert.match(all.stdout, /\[exit\][\s\S]*ease-in/);
  assert.match(all.stdout, /Framer Motion/);

  const one = cli(['motion', 'enter']);
  assert.equal(one.status, 0);
  assert.match(one.stdout, /\[enter\]/);
  assert.doesNotMatch(one.stdout, /\[exit\]/);

  const bogus = cli(['motion', 'bogus']);
  assert.equal(bogus.status, 2);
  assert.match(bogus.stderr, /Unknown preset "bogus"/);
});

test('audit finds nothing in this repository and exits 0', () => {
  const { status, stdout, stderr } = cli(['audit']);
  assert.equal(status, 0, stdout + stderr);
  assert.match(stdout, /Security scan: no findings in \d+ files/);
});

test('humanize finds no AI phrases in this repository', () => {
  const { status, stdout } = cli(['humanize']);
  assert.equal(status, 0);
  assert.match(stdout, /Prose scan: no AI phrases found/);
});

test('craft finds no design anti-patterns in this repository', () => {
  const { status, stdout } = cli(['craft']);
  assert.equal(status, 0);
  assert.match(stdout, /Design scan: no findings/);
});

test('swarm writes a five-role plan and requires a task', () => {
  withTempDir((dir) => {
    const { status, stdout } = cli(['swarm', 'Test task'], { cwd: dir });
    assert.equal(status, 0);
    for (const role of ['Lead Architect', 'Feature Engineer', 'Design & Motion Specialist', 'Security Guardian', 'Humanizer Editor']) {
      assert.ok(stdout.includes(role), `plan includes ${role}`);
    }
    assert.match(stdout, /Task plan saved to \.smileu\/tasks\/task-/);
    const plans = fs.readdirSync(path.join(dir, '.smileu', 'tasks'));
    assert.equal(plans.length, 1);
    assert.match(fs.readFileSync(path.join(dir, '.smileu', 'tasks', plans[0]), 'utf-8'), /^# Task Plan: Test task/);

    const missing = cli(['swarm'], { cwd: dir });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /"swarm" needs a task/);
  });
});

test('unknown commands exit 2 and suggest the closest command', () => {
  const typo = cli(['updat']);
  assert.equal(typo.status, 2);
  assert.match(typo.stderr, /Unknown command "updat"\. Did you mean "update"\?/);

  const nonsense = cli(['frobnicate']);
  assert.equal(nonsense.status, 2);
  assert.match(nonsense.stderr, /Unknown command "frobnicate"\./);
  assert.doesNotMatch(nonsense.stderr, /Did you mean/);
});

test('install flags parse in any order and dry runs write nothing', () => {
  withTempDir((dir) => {
    const flagsFirst = cli(['--core', '--dry-run', '-e', 'claude'], { cwd: dir });
    assert.equal(flagsFirst.status, 0, flagsFirst.stderr);
    assert.match(flagsFirst.stdout, /Editors:\s+Claude Code/);
    assert.match(flagsFirst.stdout, /Scope:\s+Core \(10 skills\)/);

    const editorAfterFlags = cli(['init', '--dry-run', '-y', 'cursor'], { cwd: dir });
    assert.equal(editorAfterFlags.status, 0, editorAfterFlags.stderr);
    assert.match(editorAfterFlags.stdout, /Editors:\s+Cursor IDE/);

    const addWithEditor = cli(['add', '-e', 'cursor', '--dry-run', 'frontend-taste'], { cwd: dir });
    assert.equal(addWithEditor.status, 0, addWithEditor.stderr);
    assert.match(addWithEditor.stdout, /Scope:\s+frontend-taste/);
    assert.match(addWithEditor.stdout, /Editors:\s+Cursor IDE/);

    const install = cli(['install', '--core', '--dry-run', '-e', 'claude'], { cwd: dir });
    assert.equal(install.status, 0, install.stderr);
    assert.match(install.stdout, /Would create: .*PRODUCT\.md/, '"install" is a full alias of "init"');

    assert.deepEqual(fs.readdirSync(dir), [], 'dry runs must not write anything');
  });
});

test('install usage errors exit 2 with a message on stderr', () => {
  withTempDir((dir) => {
    const cases = [
      [['init', '--dry-run', '-e'], /--editor needs a value/],
      [['init', 'notaneditor', '--dry-run'], /Unknown editor "notaneditor"/],
      [['init', '--frobnicate'], /Unknown option "--frobnicate"/],
      [['init', '--core', '--full', '--dry-run'], /either --core or --full/],
      [['init', 'claude', 'cursor', '--dry-run'], /Unexpected argument "cursor"/],
      [['add'], /"add" needs a skill name/],
      [['add', '--core', 'frontend-taste'], /--core and --full only apply to "init"/],
      [['init', '--include-new', '-y'], /--include-new only works with "smileu update"/],
      [[], /No install scope given and no terminal to ask/]
    ];

    for (const [args, message] of cases) {
      const result = cli(args, { cwd: dir });
      assert.equal(result.status, 2, `smileu ${args.join(' ')} should exit 2`);
      assert.match(result.stderr, message, `smileu ${args.join(' ')}`);
    }

    assert.deepEqual(fs.readdirSync(dir), [], 'usage errors must not write anything');
  });
});

test('editor names that are Object prototype keys are rejected, not crashed on', () => {
  withTempDir((dir) => {
    for (const name of ['constructor', '__proto__', 'toString']) {
      const init = cli(['init', '-e', name, '--dry-run', '-y'], { cwd: dir });
      assert.equal(init.status, 2, `init -e ${name}`);
      assert.match(init.stderr, new RegExp(`Unknown editor "${name.toLowerCase()}"`));
      assert.doesNotMatch(init.stderr, /argument must be of type string/);

      const update = cli(['update', '-e', name, '--dry-run'], { cwd: dir });
      assert.equal(update.status, 2, `update -e ${name}`);
    }
  });
});

test('design and prose scans avoid known false positives and catch real patterns', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'Search.jsx'), "import debounce from 'lodash.debounce';\nexport const s = debounce(() => {}, 200);\n");
    fs.writeFileSync(path.join(dir, 'Card.html'), '<div class="card card-body">\n  <h2 class="card-title">Title</h2>\n</div>\n');
    fs.writeFileSync(path.join(dir, 'SelfClosing.jsx'), 'export const S = () => (\n  <>\n    <div className="card" />\n    <div className="card">Sibling, not nested</div>\n  </>\n);\n');
    fs.writeFileSync(path.join(dir, 'Void.html'), '<img class="card" src="a.png">\n<div class="card">Sibling</div>\n');
    fs.writeFileSync(path.join(dir, 'Toggle.vue'), '<template>\n  <span :class="{ card: false }"><div class="card">Only one card</div></span>\n</template>\n');
    const clean = cli(['craft'], { cwd: dir });
    assert.equal(clean.status, 0);
    assert.match(
      clean.stdout,
      /Design scan: no findings in 5 UI files/,
      '"debounce", "card-body", self-closing tags, void elements and Vue :class bindings are not nested cards'
    );

    fs.writeFileSync(path.join(dir, 'Nested.jsx'), 'export const N = () => (\n  <div className="card">\n    <div className="card">Inner</div>\n  </div>\n);\n');
    const nested = cli(['craft'], { cwd: dir });
    assert.match(nested.stdout, /Design scan: 1 finding in 6 UI files/);
    const report = fs.readFileSync(path.join(dir, '.smileu', 'reports', 'DESIGN_AUDIT.md'), 'utf-8');
    assert.match(report, /\[Nested Card Container Pattern\] in `Nested\.jsx`/);

    fs.writeFileSync(path.join(dir, 'NOTES.md'), 'We are delving into the details.\n');
    const prose = cli(['humanize'], { cwd: dir });
    assert.equal(prose.status, 0);
    assert.match(prose.stdout, /Prose scan: 1 match in 1 Markdown file/);
  });
});

test('security scan catches a multi-line shell: true and reports one finding per secret file', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'run.js'), "const cp = require('child_process');\ncp.exec(command, {\n  shell: true\n});\n");
    fs.writeFileSync(path.join(dir, '.env'), 'API_KEY="abcdefghijklmnop1234"\n');

    const audit = cli(['audit'], { cwd: dir });
    assert.equal(audit.status, 1);
    assert.match(audit.stdout, /Security scan: 2 findings in 2 files/);

    const report = fs.readFileSync(path.join(dir, '.smileu', 'reports', 'SECURITY_AUDIT.md'), 'utf-8');
    assert.match(report, /\[HIGH\] Unsafe shell spawn/);
    assert.equal((report.match(/\*\*File:\*\* `\.env`/g) || []).length, 1);
  });
});

test('security scan reports shell commands built from strings but ignores comments and non-secret .env keys', () => {
  withTempDir((dir) => {
    fs.writeFileSync(
      path.join(dir, 'safe.js'),
      [
        "import { execFileSync } from 'node:child_process';",
        '// Never call eval() here, and never pass shell: true to spawn.',
        '/* new Function() is not allowed either. */',
        "execFileSync('git', ['status'], { shell: false });",
        'const pattern = /x/;',
        'pattern.exec(input);',
        ''
      ].join('\n')
    );
    fs.writeFileSync(
      path.join(dir, '.env'),
      ['TOKEN_URL=https://example.com/oauth/token', 'JWT_TOKEN_TTL_SECONDS=86400000000', 'SECRET_FILE=/run/secrets/app', 'API_KEY=${VAULT_API_KEY}', ''].join('\n')
    );
    const clean = cli(['audit'], { cwd: dir });
    assert.equal(clean.status, 0, clean.stdout);
    assert.match(clean.stdout, /Security scan: no findings in 2 files/);

    fs.writeFileSync(
      path.join(dir, 'deploy.js'),
      "const { exec } = require('child_process');\nexec(`git checkout ${branch}`);\n"
    );
    fs.writeFileSync(path.join(dir, 'auth.js'), `export const header = "Bearer ghp_${'a'.repeat(36)}";\n`);
    const flagged = cli(['audit'], { cwd: dir });
    assert.equal(flagged.status, 1);
    const report = fs.readFileSync(path.join(dir, '.smileu', 'reports', 'SECURITY_AUDIT.md'), 'utf-8');
    assert.match(report, /\[HIGH\] Shell command built from a string\n- \*\*File:\*\* `deploy\.js`/);
    assert.match(report, /Potential Hardcoded Secret \(Bearer Token, GitHub Personal Token\)/);
    assert.equal((report.match(/Potential Hardcoded Secret/g) || []).length, 1, 'overlapping patterns give one finding');
    assert.doesNotMatch(report, /\*\*File:\*\* `(?:safe\.js|\.env)`/);
  });
});

test('add reports unknown or unsafe skill names and exits 1', () => {
  withTempDir((dir) => {
    const wrongCase = cli(['add', 'Frontend-Taste', '--dry-run'], { cwd: dir });
    assert.equal(wrongCase.status, 1);
    assert.match(wrongCase.stderr, /Did you mean "frontend-taste"\?/);
    assert.doesNotMatch(wrongCase.stdout, /Would install/);

    const traversal = cli(['add', '../../etc/passwd', '--dry-run'], { cwd: dir });
    assert.equal(traversal.status, 1);
    assert.match(traversal.stderr, /Skill names cannot contain/);

    const live = cli(['add', 'no-such-skill-zzz'], { cwd: dir });
    assert.equal(live.status, 1);
    assert.match(live.stderr, /no-such-skill-zzz: No skill with this name/);
    assert.deepEqual(fs.readdirSync(dir), [], 'an add with only unknown names writes nothing');
  });
});

test('hints repeat "npx smileu-code-skill" when the CLI was started through npx', () => {
  withTempDir((dir) => {
    const viaNpx = { npm_command: 'exec' };

    const missing = cli(['update'], { cwd: dir, env: viaNpx });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Run "npx smileu-code-skill init" first/);

    const install = cli(['init', 'claude', '--core', '-y'], { cwd: dir, env: viaNpx });
    assert.equal(install.status, 0, install.stderr);
    assert.match(install.stdout, /npx smileu-code-skill audit/);
    assert.match(install.stdout, /no "smileu" command was installed/);
    assert.match(install.stdout, /npm install -g smileu-code-skill/);
    assert.doesNotMatch(install.stdout, /^\s+smileu audit/m);
  });

  withTempDir((dir) => {
    const direct = cli(['init', 'claude', '--core', '-y'], { cwd: dir });
    assert.equal(direct.status, 0, direct.stderr);
    assert.match(direct.stdout, /^\s+smileu audit/m, 'a global install keeps the short command');
    assert.doesNotMatch(direct.stdout, /no "smileu" command was installed/);
  });
});

test('help documents editors, /smileu and --remove-old-layout; install rejects update-only options', () => {
  const help = cli(['--help']);
  assert.match(help.stdout, /cursor\s+\.agents\/skills, \.cursor\/agents, \.cursor\/rules\/smileu\.mdc/);
  assert.match(help.stdout, /\/smileu \[phase\]/);
  assert.match(help.stdout, /--remove-old-layout/);
  assert.match(help.stdout, /"smileu" is available after "npm install -g smileu-code-skill"/);

  withTempDir((dir) => {
    const wrong = cli(['init', '--remove-old-layout', '-y'], { cwd: dir });
    assert.equal(wrong.status, 2);
    assert.match(wrong.stderr, /--remove-old-layout only works with "smileu update"/);

    const dry = cli(['init', 'cursor', '--dry-run', '-y'], { cwd: dir });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /Skill folders:\s+\.agents\/skills/);
    assert.match(dry.stdout, /Would create: .*\.cursor\/rules\/smileu\.mdc/);
    assert.deepEqual(fs.readdirSync(dir), []);
  });
});

test('packaged templates are loadable by the editors: frontmatter, command skill and editor files', async () => {
  const { EDITOR_TARGETS, ALWAYS_INSTALLED_SKILLS } = await import('../src/config.js');
  const frontmatter = (file) => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(file, 'utf-8'));
    assert.ok(match, `${path.relative(ROOT, file)} starts with frontmatter`);
    return match[1];
  };

  const agentsDir = path.join(ROOT, 'templates', 'agents');
  const personas = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
  assert.equal(personas.length, 12);
  for (const file of personas) {
    const head = frontmatter(path.join(agentsDir, file));
    assert.match(head, new RegExp(`^name: ${file.replace(/\.md$/, '')}$`, 'm'), `${file} name matches the file name`);
    assert.match(head, /^description: \S/m, `${file} has a description`);
  }

  for (const id of ALWAYS_INSTALLED_SKILLS) {
    const head = frontmatter(path.join(ROOT, 'skills', id, 'SKILL.md'));
    assert.match(head, new RegExp(`^name: ${id}$`, 'm'));
    assert.match(head, /^description: \S/m);
  }

  for (const [editor, cfg] of Object.entries(EDITOR_TARGETS)) {
    for (const file of cfg.files) {
      assert.ok(fs.existsSync(path.join(ROOT, 'templates', file.template)), `${editor}: templates/${file.template} exists`);
    }
  }
  assert.match(frontmatter(path.join(ROOT, 'templates', 'editors', 'cursor-rule.mdc')), /^alwaysApply: true$/m);
  assert.match(frontmatter(path.join(ROOT, 'templates', 'editors', 'windsurf-rule.md')), /^trigger: always_on$/m);
  assert.match(frontmatter(path.join(ROOT, 'templates', 'editors', 'antigravity-rule.md')), /^trigger: always_on$/m);
  assert.match(fs.readFileSync(path.join(ROOT, 'templates', 'CLAUDE.md'), 'utf-8'), /^@AGENTS\.md$/m, 'CLAUDE.md imports AGENTS.md');
  assert.match(frontmatter(path.join(ROOT, 'templates', 'editors', 'windsurf-workflow.md')), /^description: \S/m);
});

test('detectCliCommand recognises npx by npm_command or by the npx cache path', async () => {
  const { detectCliCommand } = await import('../src/utils/invocation.js');
  assert.equal(detectCliCommand({ env: { npm_command: 'exec' }, script: '/usr/lib/node_modules/x/bin/cli.js' }), 'npx smileu-code-skill');
  assert.equal(detectCliCommand({ env: {}, script: 'C:\\Users\\me\\AppData\\Local\\npm-cache\\_npx\\1a2b\\node_modules\\smileu-code-skill\\bin\\cli.js' }), 'npx smileu-code-skill');
  assert.equal(detectCliCommand({ env: {}, script: '/home/me/.npm/_npx/1a2b/node_modules/smileu-code-skill/bin/cli.js' }), 'npx smileu-code-skill');
  assert.equal(detectCliCommand({ env: { npm_command: 'test' }, script: '/usr/local/lib/node_modules/smileu-code-skill/bin/cli.js' }), 'smileu');

  // A devDependency started through an npm script: npm_command is "run", and
  // "smileu" is not on the PATH, so hints must use npx.
  const project = path.join(os.tmpdir(), 'smileu-invocation-project');
  assert.equal(
    detectCliCommand({ env: { npm_command: 'run' }, script: path.join(project, 'node_modules', 'smileu-code-skill', 'bin', 'cli.js'), cwd: path.join(project, 'src') }),
    'npx smileu-code-skill'
  );
  // A global install started from an unrelated npm script keeps the short command.
  assert.equal(
    detectCliCommand({ env: { npm_command: 'run' }, script: path.join(os.tmpdir(), 'global-prefix', 'lib', 'node_modules', 'smileu-code-skill', 'bin', 'cli.js'), cwd: project }),
    'smileu'
  );
  assert.equal(detectCliCommand({ env: {}, script: '/home/me/.local/share/pnpm/store/v3/dlx/abc/node_modules/smileu-code-skill/bin/cli.js', cwd: '/home/me/app' }), 'npx smileu-code-skill');
  assert.equal(detectCliCommand({ env: {}, script: '/home/me/.bun/install/cache/smileu-code-skill@1.2.0/bin/cli.js', cwd: '/home/me/app' }), 'npx smileu-code-skill');
});
