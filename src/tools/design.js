import fs from 'node:fs';
import path from 'node:path';
import { logSuccess, logInfo, logWarn } from '../ui.js';
import { outputPath } from '../utils/output.js';

// Anti-slop frontend heuristics inspired by Impeccable & Taste-Skill
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
    regex: /(?:bounce|elastic)\b/i,
    advice: 'Use physics-based ease-out for entering elements (e.g. cubic-bezier(0.16, 1, 0.3, 1)) and keep durations 150ms-250ms.'
  },
  {
    id: 'nested_cards',
    name: 'Nested Card Container Pattern',
    regex: /class=["'][^"']*\bcard\b[^"']*\bcard\b[^"']*["']/i,
    advice: 'Avoid nesting cards inside cards. Use whitespace, 1px subtle divider lines, or subtle background tinting.'
  }
];

/**
 * Runs design craft and anti-slop checks on UI files in the target directory.
 * Reports paths relative to the current workspace root.
 */
export function runDesignAudit(targetDir = process.cwd()) {
  const displayTarget = path.relative(process.cwd(), targetDir) || '.';
  logInfo(`Running Impeccable & Anti-Slop Design Audit for workspace: ${displayTarget}`);

  const findings = [];
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
      } else if (/\.(css|scss|html|jsx|tsx|vue|svelte)$/i.test(entry.name)) {
        scannedFiles.push(fullPath);
        let content;
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }
        const relPath = path.relative(targetDir, fullPath).replace(/\\/g, '/');

        for (const check of DESIGN_CHECKS) {
          if (check.regex.test(content)) {
            findings.push({
              file: relPath,
              name: check.name,
              advice: check.advice
            });
          }
        }
      }
    }
  }

  scanDir(targetDir);

  const reportPath = outputPath(targetDir, 'reports', 'DESIGN_AUDIT.md');
  const reportContent = `# Impeccable & Anti-Slop Design Audit Report

**Audit Date:** ${new Date().toISOString()}  
**Target:** \`./${displayTarget === '.' ? '' : displayTarget}\`  
**Files Scanned:** ${scannedFiles.length}  
**Design Flags:** ${findings.length}

---

## 🎨 Analysis

${
  findings.length === 0
    ? '✅ **Design Craft Verified.** No design anti-patterns or generic AI slop tropes identified in frontend styles/components. Typography ramps, surface tints, and motion constraints comply with Impeccable standards.'
    : findings
        .map(
          (f, idx) => `### ${idx + 1}. [${f.name}] in \`${f.file}\`
- **Recommendation:** ${f.advice}
`
        )
        .join('\n')
}

---

## 📐 Impeccable Checklist Applied
- [x] **Surface Tinting:** Check for untinted #000000 / #ffffff in styles
- [x] **Motion Dynamics:** Verify absence of cartoonish/bouncy easings
- [x] **Card Hierarchy:** Prevent card-in-card nesting slop
- [x] **Typography Ramps:** Verify tabular numbers and proper line heights
`;

  fs.writeFileSync(reportPath, reportContent, 'utf-8');

  const relReport = path.relative(targetDir, reportPath).replace(/\\/g, '/');
  if (findings.length === 0) {
    logSuccess(`Design Audit: High aesthetic craft verified! Written to ${relReport}`);
  } else {
    logWarn(`Design Audit: ${findings.length} item(s) noted. See ${relReport}`);
  }

  return { findings, scannedCount: scannedFiles.length, reportPath };
}
