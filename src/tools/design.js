import fs from 'node:fs';
import path from 'node:path';
import { logSuccess, logInfo, logNotice, plural } from '../ui.js';
import { outputPath } from '../utils/output.js';

// Design anti-pattern heuristics (after pbakaus/impeccable and Leonxlnx/taste-skill).
const DESIGN_CHECKS = [
  {
    id: 'untinted_black',
    name: 'Pure Untinted Black (#000000)',
    regex: /#(?:000000|000)\b/i,
    advice: 'Tint dark surfaces with 1-3% brand hue (e.g. #0d1117 or #0b0f19) rather than harsh pure black.'
  },
  {
    id: 'bouncy_easing',
    name: 'Sluggish Bouncy Animation',
    // Leading \b so identifiers like "debounce" are not flagged.
    regex: /\b(?:bounce|elastic)\b/i,
    advice: 'Use ease-out for entering elements (e.g. cubic-bezier(0.16, 1, 0.3, 1)) and keep durations between 150ms and 250ms.'
  },
  {
    id: 'nested_cards',
    name: 'Nested Card Container Pattern',
    // An element with the class token "card" whose first child element also has
    // the token "card". Tokens like "card-body" or "card-title" do not count.
    // Static class= (HTML, Vue, Svelte) and className= (JSX) attributes are read;
    // bound expressions such as Vue's :class="{ card: ok }", Svelte's class:card
    // directive, self-closing tags and void elements like <img> are ignored. A
    // card nested deeper than the first child is not detected.
    regex: /<(?!(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b)[a-z][\w.-]*\b[^>]*?(?<![:\w-])class(?:Name)?=["'][^"']*(?<![\w-])card(?![\w-])[^"']*["'][^>]*(?<!\/)>\s*<[a-z][\w.-]*\b[^>]*(?<![:\w-])class(?:Name)?=["'][^"']*(?<![\w-])card(?![\w-])/i,
    advice: 'Avoid nesting cards inside cards. Use whitespace, 1px divider lines, or a light background tint.'
  }
];

/**
 * Scans UI files for a small set of design anti-patterns. Paths in the report
 * are relative to the workspace.
 */
export function runDesignAudit(targetDir = process.cwd()) {
  const displayTarget = path.relative(process.cwd(), targetDir) || '.';
  logInfo(`Scanning UI files for design anti-patterns in ${displayTarget}`);

  const findings = [];
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
      } else if (/\.(css|scss|html|jsx|tsx|vue|svelte)$/i.test(entry.name)) {
        let content;
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }
        scannedCount += 1;
        const relPath = path.relative(targetDir, fullPath).replace(/\\/g, '/');

        for (const check of DESIGN_CHECKS) {
          if (check.regex.test(content)) {
            findings.push({ file: relPath, name: check.name, advice: check.advice });
          }
        }
      }
    }
  }

  scanDir(targetDir);

  const reportPath = outputPath(targetDir, 'reports', 'DESIGN_AUDIT.md');
  const reportContent = `# Design Scan Report

**Date:** ${new Date().toISOString()}
**Target:** \`./${displayTarget === '.' ? '' : displayTarget}\`
**UI files scanned:** ${scannedCount}
**Findings:** ${findings.length}

---

## Findings

${
  findings.length === 0
    ? `No findings. Checked ${scannedCount} files for pure black (#000), bounce or elastic easing, and nested card classes.`
    : findings
        .map(
          (f, idx) => `### ${idx + 1}. [${f.name}] in \`${f.file}\`
- **Recommendation:** ${f.advice}
`
        )
        .join('\n')
}

---

## Checks run
- **Surface tint:** pure black \`#000\` / \`#000000\` in styles
- **Motion:** \`bounce\` or \`elastic\` easing
- **Card hierarchy:** a \`card\` class nested inside another \`card\` class

Files scanned: .css, .scss, .html, .jsx, .tsx, .vue and .svelte.
`;

  fs.writeFileSync(reportPath, reportContent, 'utf-8');

  const relReport = path.relative(targetDir, reportPath).replace(/\\/g, '/');
  if (findings.length === 0) {
    logSuccess(`Design scan: no findings in ${plural(scannedCount, 'UI file')}. Report: ${relReport}`);
  } else {
    logNotice(`Design scan: ${plural(findings.length, 'finding')} in ${plural(scannedCount, 'UI file')}. Report: ${relReport}`);
  }

  return { findings, scannedCount, reportPath };
}
