import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { logSuccess, logInfo } from '../ui.js';

function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * Conducts an interactive grilling session (Matt Pocock & Impeccable style).
 */
export async function runGrillingSession(targetDir = process.cwd(), options = {}) {
  console.log('\n======================================================');
  console.log('   SMILEU GRILLING SESSION (ALIGNMENT & CLARITY)');
  console.log('   Inspired by mattpocock/skills & pbakaus/impeccable');
  console.log('======================================================\n');
  logInfo('Never build on ambiguous assumptions. Clarify product truth and domain rules.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const featureName = (await askQuestion(rl, '1. Project / Feature Name: ')).trim() || 'Core Feature';
    const audience = (await askQuestion(rl, '2. Target Audience (Who will use this?): ')).trim() || 'End users and developers';
    const corePurpose = (await askQuestion(rl, '3. Single Main Job / Purpose (What problem does this solve?): ')).trim() || 'Provide reliable functionality';
    const invariants = (await askQuestion(rl, '4. Non-negotiable Rules / Invariants (e.g., must use UTC, zero raw SQL): ')).trim() || 'Strict type safety and zero hardcoded secrets';
    const edgeCases = (await askQuestion(rl, '5. Critical Edge Cases / Error Scenarios: ')).trim() || 'Network timeout, unauthenticated access, invalid input';

    rl.close();

    console.log('\n------------------------------------------------------');
    logInfo('Recording Durable Truth to PRODUCT.md & CONTEXT.md...');

    // Update or generate PRODUCT.md
    const productPath = path.join(targetDir, 'PRODUCT.md');
    const productContent = `# Product Truth: ${featureName}

## 1. Audience
- **Primary Users:** ${audience}
- **Operating Context:** Web / Node.js / Multi-agent coding harness

## 2. Core Purpose
- **Mission:** ${corePurpose}
- **Target Outcome:** High reliability, zero ambiguity, production quality

## 3. Boundary Invariants
- ${invariants}

## 4. Edge Cases & Error Boundaries
- ${edgeCases}

## 5. Voice & Tone
- Direct, concise, precise, no AI boilerplate.
`;
    fs.writeFileSync(productPath, productContent, 'utf-8');
    logSuccess(`Saved product truth to: ${path.relative(targetDir, productPath) || 'PRODUCT.md'}`);

    // Update or generate CONTEXT.md
    const contextPath = path.join(targetDir, 'CONTEXT.md');
    const contextContent = `# Domain Context & Dictionary: ${featureName}

## 1. Ubiquitous Vocabulary
- **${featureName}**: The primary capability under active development.
- **Grilling Session**: Pre-coding alignment to eliminate ambiguity.
- **Invariants**: Rules that must never be broken by an AI agent.

## 2. Invariant Rules
1. ${invariants}
2. All errors must be handled gracefully without silent failures.

## 3. Known Edge Cases
1. ${edgeCases}
`;
    fs.writeFileSync(contextPath, contextContent, 'utf-8');
    logSuccess(`Saved domain dictionary to: ${path.relative(targetDir, contextPath) || 'CONTEXT.md'}`);

    console.log('------------------------------------------------------');
    logSuccess('Grilling session complete! AI agents now share durable project truth.\n');
  } catch (err) {
    rl.close();
    throw err;
  }
}
