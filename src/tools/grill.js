import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { logSuccess, logInfo, logHeading } from '../ui.js';
import { ensureOutputDir } from '../utils/output.js';

const QUESTIONS = [
  { key: 'featureName', prompt: '1. Project or feature name: ', fallback: 'Core Feature' },
  { key: 'audience', prompt: '2. Who will use it? ', fallback: 'End users and developers' },
  { key: 'corePurpose', prompt: '3. What single problem does it solve? ', fallback: 'Provide reliable functionality' },
  {
    key: 'invariants',
    prompt: '4. Rules that must never be broken (e.g. store times in UTC, no raw SQL): ',
    fallback: 'Strict type safety and no hardcoded secrets'
  },
  {
    key: 'edgeCases',
    prompt: '5. Critical edge cases and error scenarios: ',
    fallback: 'Network timeout, unauthenticated access, invalid input'
  }
];

/**
 * Writes `content` to `name` in the target directory. An existing file with
 * different content is copied to .smileu/backups/ first, so answering the
 * questions again never destroys earlier edits.
 */
function writeWithBackup(targetDir, name, content) {
  const dest = path.join(targetDir, name);
  let backup = null;

  if (fs.existsSync(dest)) {
    const current = fs.readFileSync(dest, 'utf-8');
    if (current === content) return { status: 'unchanged', backup: null };

    const backupDir = ensureOutputDir(targetDir, 'backups');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backup = path.join(backupDir, `${name}.${stamp}.bak`);
    fs.writeFileSync(backup, current, 'utf-8');
  }

  fs.writeFileSync(dest, content, 'utf-8');
  return { status: backup ? 'replaced' : 'created', backup };
}

function reportWrite(targetDir, name, result) {
  if (result.status === 'unchanged') {
    logInfo(`${name} already matches these answers.`);
  } else if (result.status === 'replaced') {
    const rel = path.relative(targetDir, result.backup).replace(/\\/g, '/');
    logSuccess(`Replaced ${name} (previous copy saved to ${rel})`);
  } else {
    logSuccess(`Created ${name}`);
  }
}

/**
 * Asks the alignment questions and records the answers in PRODUCT.md and
 * CONTEXT.md.
 *
 * Answers are read line by line, so they can be typed or piped in
 * (`printf 'Name\nAudience\n...' | smileu grill`). If input ends early, an error
 * with code SMILEU_INPUT_ENDED is thrown and nothing is written.
 */
export async function runGrillingSession(
  targetDir = process.cwd(),
  { input = process.stdin, output = process.stdout } = {}
) {
  logHeading('Grilling session');
  logInfo('Answer 5 questions. Press Enter to accept the suggested default.');
  logInfo('The answers are written to PRODUCT.md and CONTEXT.md; existing copies are backed up to .smileu/backups/.\n');

  const interactive = Boolean(input.isTTY);
  const rl = readline.createInterface({ input, output, terminal: interactive });
  // Created before the first prompt so lines that arrive early are buffered,
  // not dropped (rl.question discards lines that arrive between questions).
  const lines = rl[Symbol.asyncIterator]();
  const answers = {};

  try {
    for (const [idx, question] of QUESTIONS.entries()) {
      output.write(question.prompt);
      const { value, done } = await lines.next();
      if (done) {
        const err = new Error(
          `Input ended before question ${idx + 1} of ${QUESTIONS.length} was answered. ` +
            'Run "smileu grill" in a terminal, or pipe one answer per line.'
        );
        err.code = 'SMILEU_INPUT_ENDED';
        throw err;
      }
      if (!interactive) output.write('\n');
      answers[question.key] = String(value).trim() || question.fallback;
    }
  } finally {
    rl.close();
  }

  const { featureName, audience, corePurpose, invariants, edgeCases } = answers;

  const productContent = `# Product Truth: ${featureName}

## 1. Audience
- **Primary users:** ${audience}

## 2. Core Purpose
- **Mission:** ${corePurpose}

## 3. Boundary Invariants
- ${invariants}

## 4. Edge Cases & Error Boundaries
- ${edgeCases}

## 5. Voice & Tone
- Direct, concise and precise.
`;

  const contextContent = `# Domain Context & Dictionary: ${featureName}

## 1. Ubiquitous Vocabulary
- **${featureName}**: The primary capability under active development.
- **Grilling Session**: Pre-coding alignment to remove ambiguity.
- **Invariants**: Rules that must never be broken by an AI agent.

## 2. Invariant Rules
1. ${invariants}
2. All errors must be handled without silent failures.

## 3. Known Edge Cases
1. ${edgeCases}
`;

  console.log('');
  reportWrite(targetDir, 'PRODUCT.md', writeWithBackup(targetDir, 'PRODUCT.md', productContent));
  reportWrite(targetDir, 'CONTEXT.md', writeWithBackup(targetDir, 'CONTEXT.md', contextContent));
  logSuccess('Grilling session complete.');

  return answers;
}
