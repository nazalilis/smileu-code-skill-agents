import fs from 'node:fs';
import path from 'node:path';
import { logSuccess, logInfo, logNotice, plural } from '../ui.js';
import { outputPath } from '../utils/output.js';

// Common stock AI phrases (after blader/humanizer).
const AI_PATTERNS = [
  { id: 'banned_word_delve', name: 'Overused word "delve"', regex: /\bdelv(?:e|es|ed|ing)\b/i, advice: 'Replace with explore, examine, or look at.' },
  { id: 'banned_word_testament', name: 'Overused word "testament"', regex: /\btestament\b/i, advice: 'Replace with proof, sign, or evidence.' },
  { id: 'banned_word_pivotal', name: 'Overused word "pivotal"', regex: /\bpivotal\b/i, advice: 'State the concrete fact without dramatic inflation.' },
  { id: 'banned_word_landscape', name: 'Overused word "landscape"', regex: /\b(?:digital|modern)\s+landscape\b/i, advice: 'Specify the exact industry, ecosystem, or market.' },
  { id: 'banned_word_showcasing', name: 'Overused word "showcasing"', regex: /\bshowcasing\b/i, advice: 'Replace with showing, presenting, or has.' },
  { id: 'staged_run_up', name: 'Fake run-up phrase', regex: /\b(?:let's dive in|honestly\? it depends|here's the thing)\b/i, advice: 'Remove the run-up and start directly with the point.' },
  { id: 'forced_triad', name: 'Forced triad phrase', regex: /\b(?:innovation,\s*inspiration,\s*and\s*insights|speed,\s*scalability,\s*and\s*security)\b/i, advice: 'Use the natural number of items needed by context.' },
  { id: 'chatbot_residue', name: 'Chatbot boilerplate residue', regex: /\b(?:certainly! here is|i hope this helps!|feel free to ask)\b/i, advice: 'Strip conversational bot filler.' }
];

// Files that define or document these patterns would always match themselves.
function isExcluded(relPath) {
  const segments = relPath.split('/');
  return segments.includes('humanizer-writing') || segments[segments.length - 1] === 'HUMANIZER_AUDIT.md';
}

/**
 * Scans Markdown files for stock AI phrases. Paths in the report are relative
 * to the workspace.
 */
export function runHumanizerCheck(targetDir = process.cwd()) {
  const displayTarget = path.relative(process.cwd(), targetDir) || '.';
  logInfo(`Scanning Markdown files for AI phrases in ${displayTarget}`);

  const issues = [];
  let scannedCount = 0;

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
        continue;
      }
      if (!/\.md$/i.test(entry.name)) continue;

      const relPath = path.relative(targetDir, fullPath).replace(/\\/g, '/');
      if (isExcluded(relPath)) continue;

      let lines;
      try {
        lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
      } catch {
        continue;
      }
      scannedCount += 1;

      lines.forEach((line, lineNum) => {
        const trimmed = line.trim();
        // Skip lines that discuss or ban these patterns (rules tables, style guides).
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
            issues.push({ file: relPath, line: lineNum + 1, content: trimmed, pattern: p.name, advice: p.advice });
          }
        }
      });
    }
  }

  scanDir(targetDir);

  const reportPath = outputPath(targetDir, 'reports', 'HUMANIZER_AUDIT.md');
  const reportContent = `# Prose Scan Report

**Date:** ${new Date().toISOString()}
**Target:** \`./${displayTarget === '.' ? '' : displayTarget}\`
**Markdown files scanned:** ${scannedCount}
**Matches:** ${issues.length}

---

## Matches

${
  issues.length === 0
    ? `No matches for the ${AI_PATTERNS.length} phrase patterns.`
    : issues
        .map(
          (iss, idx) => `### ${idx + 1}. [${iss.pattern}] in \`${iss.file}:${iss.line}\`
- **Line:** \`"${iss.content}"\`
- **Advice:** ${iss.advice}
`
        )
        .join('\n')
}
`;

  fs.writeFileSync(reportPath, reportContent, 'utf-8');

  const relReport = path.relative(targetDir, reportPath).replace(/\\/g, '/');
  if (issues.length === 0) {
    logSuccess(`Prose scan: no AI phrases found in ${plural(scannedCount, 'Markdown file')}. Report: ${relReport}`);
  } else {
    logNotice(`Prose scan: ${plural(issues.length, 'match', 'matches')} in ${plural(scannedCount, 'Markdown file')}. Report: ${relReport}`);
  }

  return { issues, scannedCount, reportPath };
}
