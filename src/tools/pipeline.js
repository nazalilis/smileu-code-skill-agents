import fs from 'node:fs';
import path from 'node:path';
import { runGraphify } from './graphify.js';
import { runSecurityAudit } from './security.js';
import { runHumanizerCheck } from './humanizer.js';
import { runDesignAudit } from './design.js';
import { ensureTemplates } from '../installer.js';
import { logSuccess, logNotice, logWarn, logHeading } from '../ui.js';

/**
 * Runs every check in order. A failing step is reported and the remaining
 * steps still run; `failed` is true when any step failed or the security scan
 * found critical or high issues.
 */
export async function runFullPipeline(targetDir = process.cwd()) {
  logHeading('Running all checks');
  const outcome = { failed: false };

  console.log('\n[Phase 1/6: Align] Project documents');
  const templates = ensureTemplates({ targetDir });
  if (templates.templates.length) {
    logSuccess(`Created ${templates.templates.join(', ')}.`);
  } else {
    logSuccess('Found PRODUCT.md and CONTEXT.md.');
  }
  if (templates.failed && templates.failed.length) {
    templates.failed.forEach((f) => logWarn(`${f.skill}: ${f.reason}`));
    outcome.failed = true;
  }

  console.log('\n[Phase 2/6: Map] Knowledge graph');
  try {
    runGraphify({ targetDir });
  } catch (err) {
    logWarn(`The graph step failed: ${err.message}`);
    outcome.failed = true;
  }

  console.log('\n[Phase 3/6: Orchestrate] Agent configuration');
  if (fs.existsSync(path.join(targetDir, 'AGENTS.md'))) {
    logSuccess('Found AGENTS.md.');
  } else {
    logNotice('AGENTS.md not found. Run "smileu init" to create it.');
  }

  console.log('\n[Phase 4/6: Craft] Design scan');
  runDesignAudit(targetDir);

  console.log('\n[Phase 5/6: Harden] Security scan');
  if (runSecurityAudit(targetDir).failed) outcome.failed = true;

  console.log('\n[Phase 6/6: Humanize] Prose scan');
  runHumanizerCheck(targetDir);

  console.log('');
  if (outcome.failed) {
    logNotice('All checks finished with problems. Reports are in .smileu/reports/.');
  } else {
    logSuccess('All checks finished. Reports are in .smileu/reports/.');
  }

  return outcome;
}
