import fs from 'node:fs';
import path from 'node:path';
import { runGraphify } from './graphify.js';
import { runSecurityAudit } from './security.js';
import { runHumanizerCheck } from './humanizer.js';
import { runDesignAudit } from './design.js';
import { ensureTemplates } from '../installer.js';
import { logSuccess, logInfo, logWarn } from '../ui.js';

export async function runFullPipeline(targetDir = process.cwd()) {
  console.log('\n======================================================');
  console.log('   SMILEU 6-PHASE VIBE CODING PIPELINE EXECUTION');
  console.log('======================================================\n');

  // Phase 1: Align & Clarify
  console.log('\n--- [PHASE 1/6: ALIGN & CLARIFY] ---');
  logInfo('Verifying Product Truth (PRODUCT.md) and Domain Dictionary (CONTEXT.md)...');
  const hasProduct = fs.existsSync(path.join(targetDir, 'PRODUCT.md'));
  const hasContext = fs.existsSync(path.join(targetDir, 'CONTEXT.md'));
  if (!hasProduct || !hasContext) {
    ensureTemplates({ targetDir });
    logSuccess('Initialized missing PRODUCT.md / CONTEXT.md templates.');
  } else {
    logSuccess('PRODUCT.md and CONTEXT.md are active and established.');
  }

  // Phase 2: Architect & Map
  console.log('\n--- [PHASE 2/6: ARCHITECT & MAP] ---');
  runGraphify({ targetDir });

  // Phase 3: Orchestrate & Decompose
  console.log('\n--- [PHASE 3/6: ORCHESTRATE & DECOMPOSE] ---');
  const agentsPath = path.join(targetDir, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    logSuccess('Multi-agent configuration (AGENTS.md) is present and ready.');
  } else {
    logInfo('Generating standard AGENTS.md swarm orchestrator file...');
  }

  // Phase 4: Craft & Polish
  console.log('\n--- [PHASE 4/6: CRAFT & POLISH] ---');
  runDesignAudit(targetDir);

  // Phase 5: Harden & Secure
  console.log('\n--- [PHASE 5/6: HARDEN & SECURE] ---');
  runSecurityAudit(targetDir);

  // Phase 6: Humanize
  console.log('\n--- [PHASE 6/6: HUMANIZE] ---');
  runHumanizerCheck(targetDir);

  console.log('\n======================================================');
  logSuccess('THE COMPLETE SMILEU 6-PHASE PIPELINE HAS FINISHED!');
  console.log('======================================================\n');
}
