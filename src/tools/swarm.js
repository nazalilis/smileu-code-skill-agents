import fs from 'node:fs';
import path from 'node:path';
import { logSuccess, logInfo } from '../ui.js';
import { ensureOutputDir } from '../utils/output.js';

/**
 * Decomposes a task across specialized agent swarm personas (Ruflo SPARC).
 */
export function runSwarmDecomposition(task = 'Implement feature', targetDir = process.cwd()) {
  console.log('\n======================================================');
  console.log('   SMILEU MULTI-AGENT SWARM ORCHESTRATOR');
  console.log('   Inspired by ruvnet/ruflo (Claude-Flow)');
  console.log('======================================================\n');
  logInfo(`Decomposing Task: "${task}"\n`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const plan = {
    task,
    timestamp: new Date().toISOString(),
    methodology: 'SPARC (Specification, Pseudocode, Architecture, Refinement, Completion)',
    swarm: [
      {
        role: 'Lead Architect (@architect)',
        mission: 'Define system interfaces, schema boundaries, and map dependency graph.',
        actions: [
          `Inspect existing graphify-out/graph.json to trace blast radius.`,
          `Draft data contracts and interface types for "${task}".`,
          `Record non-obvious design choices in docs/adr/ if necessary.`
        ]
      },
      {
        role: 'Feature Engineer (@engineer)',
        mission: 'Implement atomic logic, API handlers, and pure functions.',
        actions: [
          `Write modular, strictly typed code satisfying the Architect specification.`,
          `Implement pure data transformations and robust error pathways.`,
          `Ensure no unhandled promise rejections or silent failures.`
        ]
      },
      {
        role: 'Design & Motion Specialist (@craft)',
        mission: 'Apply anti-slop frontend standards and natural motion physics.',
        actions: [
          `Ensure typography follows harmonic scales (Geist, Plus Jakarta Sans, SF Pro).`,
          `Apply ease-out (200ms) for entering elements and ease-in (150ms) for exiting elements.`,
          `Prevent nested cards, raw #000000 black, or generic AI purple-gradient tropes.`
        ]
      },
      {
        role: 'Security Guardian (@guardian)',
        mission: 'Enforce OWASP Top 10 defenses and boundary security.',
        actions: [
          `Sanitize and validate all external inputs with schema validators (Zod/Valibot).`,
          `Verify zero hardcoded API keys, JWT secrets, or tokens in source.`,
          `Prevent SQL injection, command execution concatenation, and XSS.`
        ]
      },
      {
        role: 'Humanizer Editor (@editor)',
        mission: 'Eliminate robot writing patterns, clichés, and fake drama.',
        actions: [
          `Scan commit message, PR description, and docs against 25 AI cliché tells.`,
          `Strip "delve", "testament", "pivotal moment", "showcasing", and forced triads.`,
          `Ensure communication is direct, authentic, and engineer-to-engineer.`
        ]
      }
    ]
  };

  // Render in terminal
  plan.swarm.forEach((agent, i) => {
    console.log(`[Agent ${i + 1}] ${agent.role}`);
    console.log(`  🎯 Mission: ${agent.mission}`);
    agent.actions.forEach(act => {
      console.log(`     • ${act}`);
    });
    console.log('');
  });

  // Save to .smileu/tasks/ (kept out of the project root, git-ignored)
  const tasksDir = ensureOutputDir(targetDir, 'tasks');
  const taskFilePath = path.join(tasksDir, `task-${timestamp}.md`);
  const markdownContent = `# Swarm Task Decomposition: ${task}

**Generated:** ${plan.timestamp}  
**Methodology:** ${plan.methodology}

---

${plan.swarm
  .map(
    (a, i) => `## ${i + 1}. ${a.role}
**Mission:** ${a.mission}

**Action Plan:**
${a.actions.map(act => `- [ ] ${act}`).join('\n')}
`
  )
  .join('\n')}

---
*Orchestrated by Smileu Multi-Agent Harness (ruvnet/ruflo framework)*
`;

  fs.writeFileSync(taskFilePath, markdownContent, 'utf-8');
  logSuccess(`Swarm task plan saved to: ${path.relative(targetDir, taskFilePath) || taskFilePath}`);
  return plan;
}
