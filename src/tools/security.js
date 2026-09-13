import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { logInfo, logNotice, logSuccess, plural } from '../ui.js';
import { outputPath } from '../utils/output.js';

// Credential and token shapes. A match reports the pattern name and the file;
// the matched text itself never reaches the terminal or the report.
export const SECRET_PATTERNS = [
  { name: 'Generic API Key', regex: /(?:api[_-]?key|apikey|secret)[ \t]*[:=][ \t]*['"][a-zA-Z0-9_\-]{16,}['"]/i },
  { name: 'Bearer Token', regex: /bearer[ \t]+[a-zA-Z0-9_\-\.]{20,}/i },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub Personal Token', regex: /\bgh[pousr]_[a-zA-Z0-9]{36}\b/ },
  { name: 'npm Access Token', regex: /\bnpm_[a-zA-Z0-9]{36}\b/ },
  { name: 'OpenAI API Key', regex: /\bsk-[a-zA-Z0-9]{20,}\b/ },
  { name: 'Google API Key', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: 'Tailscale Auth Key', regex: /\btskey-(?:auth-)?[a-zA-Z0-9_-]{10,}\b/i },
  { name: 'Stripe Secret Key', regex: /\bsk_live_[a-zA-Z0-9]{24,}\b/ },
  { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/i }
];

// Names of .env keys that usually hold secrets, and suffixes that mark a key as
// configuration about a secret (where to find it, how long it lives) instead.
const SECRET_KEY = /(?:API_?KEY|SECRET|TOKEN|PASSW(?:OR)?D)/i;
const NON_SECRET_SUFFIX = /_(?:URL|URI|ENDPOINT|HOST|PORT|PATH|FILE|DIR|NAME|TYPE|HEADER|TTL|SECONDS|MS|EXPIRES|EXPIRY|LENGTH)$/i;
const ENV_LINE = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/;

/**
 * True when a dotenv-style file assigns what looks like a real secret value to
 * a secret-sounding key. Values that reference another variable ($VAR, ${VAR})
 * and short placeholder values are ignored.
 */
function envFileHasSecret(content) {
  return content.split(/\r?\n/).some((line) => {
    const match = ENV_LINE.exec(line);
    if (!match) return false;
    const [, key, rawValue] = match;
    if (!SECRET_KEY.test(key) || NON_SECRET_SUFFIX.test(key)) return false;

    const value = rawValue
      .replace(/[ \t]+#.*$/, '')
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    return value.length >= 12 && !value.startsWith('$') && !/\s/.test(value);
  });
}

/**
 * Drops lines that are comments (// ..., /* ..., * ...), so a call mentioned in
 * a comment or doc block is not reported as a call.
 */
function withoutCommentLines(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join('\n');
}

// Code execution vectors (OWASP A03: Injection). Each check runs on the file
// with comment lines removed.
export const DANGEROUS_CALLS = [
  { name: 'eval() Execution', test: (code) => /\beval\s*\(/.test(code) },
  { name: 'Unsafe Function constructor', test: (code) => /\bnew\s+Function\s*\(/.test(code) },
  {
    // A child process call whose options set `shell` to anything but false,
    // including the `{ shell }` shorthand, even when the options span lines.
    name: 'Unsafe shell spawn',
    test: (code) =>
      /\b(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\s*\([^;]{0,400}?\bshell\s*(?::\s*(?!false\b)[\w'"`]|[,}])/.test(code)
  },
  {
    // exec/execSync always go through a shell, so a command assembled from a
    // template string or concatenation is an injection point.
    name: 'Shell command built from a string',
    test: (code) => /\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|['"][^'"\n]*['"]\s*\+)/.test(code)
  }
];

// Dependencies, build output and installed skill libraries. Every other
// dot-directory is skipped as well, except .github, where workflow files can
// carry credentials.
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', 'vendor', 'skills', 'graphify-out', '__pycache__']);
const SCANNED_DOT_DIRS = new Set(['.github']);

const SOURCE_FILES = /\.(js|jsx|ts|tsx|mjs|cjs|json|yml|yaml|toml)$/i;
const CODE_FILES = /\.(js|jsx|ts|tsx|mjs|cjs)$/i;
const ENV_FILES = /(?:^\.env(?:\.[\w.-]+)?$|\.env$)/i;
const CREDENTIAL_DOTFILES = /^\.(npmrc|pypirc)$/i;
const EXAMPLE_FILES = /\.(example|sample|template|dist)$/i;

// Test fixtures legitimately contain fake credentials. Matching whole path
// segments keeps "latest/" or "contest/" from being exempted by accident.
const EXEMPT_SEGMENTS = new Set(['test', 'tests', '__tests__', '__mocks__', 'fixtures']);
const SELF_PATH = fileURLToPath(import.meta.url);

function isExempt(fullPath, relPath, content) {
  if (path.resolve(fullPath) === SELF_PATH) return true;
  // Another copy of this scanner (for example a project that vendors this
  // package) describes every pattern it looks for; do not report it.
  if (content.includes('export const SECRET_PATTERNS') && content.includes('export const DANGEROUS_CALLS')) return true;
  return relPath.split('/').some((seg) => EXEMPT_SEGMENTS.has(seg));
}

/**
 * Runs `npm audit` and reads its JSON. npm exits non-zero whenever it finds
 * vulnerabilities, so the output of a "failed" run is parsed too; only output
 * that is not an audit result counts as the audit not having run.
 */
function runNpmAudit(targetDir) {
  if (!fs.existsSync(path.join(targetDir, 'package.json'))) {
    return { ran: false, label: 'Not run (no package.json)' };
  }

  const options = { cwd: targetDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 };
  let raw = '';
  try {
    // npm is a .cmd shim on Windows and can only be started through a shell.
    // The command is a fixed string, so nothing user-controlled reaches it.
    raw =
      process.platform === 'win32'
        ? execSync('npm audit --json', options)
        : execFileSync('npm', ['audit', '--json'], options);
  } catch (err) {
    raw = err && typeof err.stdout === 'string' ? err.stdout : '';
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    return { ran: false, label: 'Not run (npm audit failed; it needs a lockfile and network access)' };
  }

  const counts = report && report.metadata && report.metadata.vulnerabilities;
  if (!counts) {
    const code = report && report.error && report.error.code;
    return { ran: false, label: `Not run (${code || 'npm audit returned no results'})` };
  }

  const { critical = 0, high = 0, moderate = 0, low = 0 } = counts;
  const total = critical + high + moderate + low;
  return {
    ran: true,
    counts: { critical, high, moderate, low },
    label: total === 0 ? 'No known vulnerabilities' : `${critical} critical, ${high} high, ${moderate} moderate, ${low} low`
  };
}

/**
 * Scans the target directory for hardcoded secrets and dangerous calls, then
 * runs npm audit. Reported paths are relative to the workspace.
 *
 * `failed` is true when there is at least one critical or high finding; the CLI
 * turns that into exit code 1 so the audit can gate a CI job.
 */
export function runSecurityAudit(targetDir = process.cwd()) {
  const displayTarget = path.relative(process.cwd(), targetDir) || '.';
  logInfo(`Scanning for secrets and unsafe calls in ${displayTarget}`);

  const findings = [];
  let scannedCount = 0;

  function report(severity, file, issue, recommendation) {
    findings.push({ severity, file, issue, recommendation });
  }

  function scanFile(fullPath, name) {
    const relPath = path.relative(targetDir, fullPath).replace(/\\/g, '/');
    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      return;
    }
    scannedCount += 1;
    if (isExempt(fullPath, relPath, content)) return;

    // One finding per file lists every credential pattern that matched, so a
    // value that fits several patterns is not reported several times.
    const matched = SECRET_PATTERNS.filter((pattern) => pattern.regex.test(content)).map((pattern) => pattern.name);
    if (!matched.length && ENV_FILES.test(name) && !EXAMPLE_FILES.test(name) && envFileHasSecret(content)) {
      matched.push('Secret in environment file');
    }
    if (matched.length) {
      report(
        'CRITICAL',
        relPath,
        `Potential Hardcoded Secret (${matched.join(', ')})`,
        'Move the value into an environment variable, keep .env files out of git, and rotate the credential if it was ever committed.'
      );
    }

    if (CODE_FILES.test(name)) {
      const code = withoutCommentLines(content);
      for (const danger of DANGEROUS_CALLS) {
        if (danger.test(code)) {
          report(
            'HIGH',
            relPath,
            danger.name,
            'Avoid evaluating strings as code. Pass arguments as arrays (execFile/spawn without a shell) instead of building command strings.'
          );
        }
      }
    }
  }

  function scanDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.') && !SCANNED_DOT_DIRS.has(entry.name)) continue;
        scanDir(fullPath);
      } else if (entry.isFile()) {
        const name = entry.name;
        if (SOURCE_FILES.test(name) || ENV_FILES.test(name) || CREDENTIAL_DOTFILES.test(name)) {
          scanFile(fullPath, name);
        }
      }
    }
  }

  scanDir(targetDir);

  const npmAudit = runNpmAudit(targetDir);
  if (npmAudit.ran && (npmAudit.counts.critical > 0 || npmAudit.counts.high > 0)) {
    report(
      'HIGH',
      'package.json',
      `npm audit found ${npmAudit.counts.high} high and ${npmAudit.counts.critical} critical vulnerabilities in dependencies.`,
      'Run "npm audit" for details, then "npm audit fix" or upgrade the affected packages.'
    );
  }

  const reportPath = outputPath(targetDir, 'reports', 'SECURITY_AUDIT.md');
  const reportContent = `# Security Scan Report

**Date:** ${new Date().toISOString()}
**Target:** \`./${displayTarget === '.' ? '' : displayTarget}\`
**Files scanned:** ${scannedCount}
**Findings:** ${findings.length}
**npm audit:** ${npmAudit.label}

---

## Findings

${
  findings.length === 0
    ? `No findings. Checked ${scannedCount} files for ${SECRET_PATTERNS.length} secret patterns and ${DANGEROUS_CALLS.length} kinds of dangerous calls.`
    : findings
        .map(
          (f, idx) => `### ${idx + 1}. [${f.severity}] ${f.issue}
- **File:** \`${f.file}\`
- **Recommendation:** ${f.recommendation}
`
        )
        .join('\n')
}

---

## Checks run
- **Secrets:** ${SECRET_PATTERNS.length} credential patterns in code, config, \`.env\` and \`.npmrc\` files, plus unquoted secret values in \`.env\` files
- **Dangerous calls:** \`eval()\`, \`new Function()\`, child process calls with a \`shell\` option, and \`exec\`/\`execSync\` commands built from template strings or concatenation (comment lines are ignored)
- **Dependencies:** \`npm audit\` when a \`package.json\` is present

Test and fixture folders are exempt from these checks. This is a pattern scan, not a full OWASP Top 10 review.
`;

  fs.writeFileSync(reportPath, reportContent, 'utf-8');

  const relReport = path.relative(targetDir, reportPath).replace(/\\/g, '/');
  if (findings.length === 0) {
    logSuccess(`Security scan: no findings in ${plural(scannedCount, 'file')}. Report: ${relReport}`);
  } else {
    logNotice(
      `Security scan: ${plural(findings.length, 'finding')} in ${plural(scannedCount, 'file')}. Report: ${relReport}`
    );
  }

  const failed = findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  return { findings, scannedFiles: scannedCount, reportPath, npmAudit, failed };
}
