import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const CLI_PATH = path.resolve('bin/cli.js');

// Runs the CLI without a shell and captures stdout, stderr and the exit code.
// stdin is a pipe, never a TTY, so no command can stop to prompt.
function cli(args, { cwd = process.cwd(), input = '' } = {}) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    input,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: undefined, CI: 'true' }
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
  assert.match(stdout, /^smileu-code-skill version \d+\.\d+\.\d+/);
  assert.equal(stdout.trim().split(/\r?\n/).length, 1, 'no banner or extra lines');
});

test('--help documents every command, the update options and exit codes', () => {
  const { status, stdout } = cli(['--help']);
  assert.equal(status, 0);
  assert.match(stdout, /Usage: smileu <command> \[options\]/);
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
  assert.match(stdout, /The bundled library has \d{3,} skills in total/);
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
  assert.match(all.stdout, /ease-out/);
  assert.match(all.stdout, /ease-in/);
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
    assert.match(flagsFirst.stdout, /Scope:\s+Core \(9 skills\)/);

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

test('scanners avoid known false positives and catch word variants', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'Search.jsx'), "import debounce from 'lodash.debounce';\nexport const s = debounce(() => {}, 200);\n");
    const craft = cli(['craft'], { cwd: dir });
    assert.equal(craft.status, 0);
    assert.match(craft.stdout, /Design scan: no findings in 1 UI file/, '"debounce" is not a bounce animation');

    fs.writeFileSync(path.join(dir, 'NOTES.md'), 'We are delving into the details.\n');
    const prose = cli(['humanize'], { cwd: dir });
    assert.equal(prose.status, 0);
    assert.match(prose.stdout, /Prose scan: 1 match in 1 Markdown file/);
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
  });
});
