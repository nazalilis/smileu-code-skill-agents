import fs from 'node:fs';
import path from 'node:path';
import { logSuccess, logInfo, logWarn } from '../ui.js';
import { outputPath } from '../utils/output.js';

// Common synthetic AI writing patterns & robot clichés (inspired by Blader Humanizer)
const AI_PATTERNS = [
  { id: 'banned_word_delve', name: 'Overused word "delve"', regex: /\bdelve(?:s|d|ing)?\b/i, advice: 'Replace with explore, examine, or look at.' },
  { id: 'banned_word_testament', name: 'Overused word "testament"', regex: /\btestament\b/i, advice: 'Replace with proof, sign, or evidence.' },
  { id: 'banned_word_pivotal', name: 'Overused word "pivotal"', regex: /\bpivotal\b/i, advice: 'State the concrete fact without dramatic inflation.' },
  { id: 'banned_word_landscape', name: 'Overused word "landscape"', regex: /\b(?:digital|modern)\s+landscape\b/i, advice: 'Specify the exact industry, ecosystem, or market.' },
  { id: 'banned_word_showcasing', name: 'Overused word "showcasing"', regex: /\bshowcasing\b/i, advice: 'Replace with showing, presenting, or has.' },
  { id: 'staged_run_up', name: 'Fake run-up phrase', regex: /\b(?:let's dive in|honestly\? it depends|here's the thing)\b/i, advice: 'Remove the run-up and start directly with the point.' },
  { id: 'forced_triad', name: 'Forced triad phrase', regex: /\b(?:innovation,\s*inspiration,\s*and\s*insights|speed,\s*scalability,\s*and\s*security)\b/i, advice: 'Use the natural number of items needed by context.' },
  { id: 'chatbot_residue', name: 'Chatbot boilerplate residue', regex: /\b(?:certainly! here is|i hope this helps!|feel free to ask)\b/i, advice: 'Strip conversational bot filler.' }
];

/**
 * Scans markdown files for robotic phrasing and synthetic AI clichés.
 * Reports paths relative to the current workspace root.
 */
export function runHumanizerCheck(targetDir = process.cwd()) {
  const displayTarget = path.relative(process.cwd(), targetDir) || '.';
  logInfo(`Scanning Markdown files for AI cliches & robot patterns: ${displayTarget}`);

  const issues = [];
  const scannedFiles = [];

  function scanDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === 'skills' ||
        entry.name === 'graphify-out'
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.md$/i.test(entry.name)) {
        // Exclude audits and the humanizer skill definition itself
        if (
          fullPath.includes('HUMANIZER_AUDIT') ||
          fullPath.includes('humanizer-writing')
        ) {
          continue;
        }

        scannedFiles.push(fullPath);
        let lines;
        try {
          lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
        } catch {
          continue;
        }
        const relPath = path.relative(targetDir, fullPath).replace(/\\/g, '/');

        lines.forEach((line, lineNum) => {
          const trimmed = line.trim();
          // Skip lines that explicitly discuss or ban these patterns (e.g. `no "delve"`, rules tables)
          if (
            trimmed.startsWith('|') ||
            trimmed.startsWith('- NO ') ||
            trimmed.includes('Eliminate all 25') ||
            trimmed.includes('Ban the 25') ||
            trimmed.includes('Strip out') ||
            trimmed.includes('free of synthetic fluff') ||
            trimmed.includes('anti-AI writing patterns') ||
            trimmed.includes('synthetic AI clichés')
          ) {
            return;
          }

          for (const p of AI_PATTERNS) {
            if (p.regex.test(line)) {
              issues.push({
                file: relPath,
                line: lineNum + 1,
                content: trimmed,
                pattern: p.name,
                advice: p.advice
              });
            }
          }
        });
      }
    }
  }

  scanDir(targetDir);

  const reportPath = outputPath(targetDir, 'reports', 'HUMANIZER_AUDIT.md');
  const reportContent = `# Humanizer Writing Quality Report

**Scan Date:** ${new Date().toISOString()}  
**Target:** \`./${displayTarget === '.' ? '' : displayTarget}\`  
**Files Inspected:** ${scannedFiles.length}  
**AI Pattern Violations Found:** ${issues.length}

---

## 📝 Analysis

${
  issues.length === 0
    ? '✅ **Clean Prose.** Zero AI cliché patterns or synthetic filler detected. All documentation and explanations read naturally and human-crafted.'
    : issues
        .map(
          (iss, idx) => `### ${idx + 1}. [${iss.pattern}] in \`${iss.file}:${iss.line}\`
- **Snippet:** \`"${iss.content}"\`
- **Advice:** ${iss.advice}
`
        )
        .join('\n')
}
`;

  fs.writeFileSync(reportPath, reportContent, 'utf-8');

  const relReport = path.relative(targetDir, reportPath).replace(/\\/g, '/');
  if (issues.length === 0) {
    logSuccess(`Humanizer Check: 0 AI cliches found! Report written to ${relReport}`);
  } else {
    logWarn(`Humanizer Check: ${issues.length} pattern(s) identified. See ${relReport}`);
  }

  return { issues, scannedCount: scannedFiles.length, reportPath };
}
