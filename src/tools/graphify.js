import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { checkTooling } from './doctor.js';
import { logSuccess, logInfo, logWarn, logError } from '../ui.js';
import { ensureOutputDir } from '../utils/output.js';

/**
 * Resolves the command prefix to execute graphify.
 */
export function getGraphifyCommand() {
  const status = checkTooling();
  if (status.graphifyMethod === 'direct') {
    return 'graphify';
  }
  if (status.uv) {
    return 'uv tool run --from graphifyy graphify';
  }
  return null;
}

/**
 * Validates that a path is safe and free of command injection attempts.
 */
function sanitizePath(dirPath) {
  if (/[;&|`$<>]/.test(dirPath)) {
    throw new Error('Invalid characters detected in target path');
  }
  return path.resolve(dirPath);
}

/**
 * Moves a stray `graphify-out` folder from the target root into .smileu/graph.
 * The native engine emits it next to the scanned target regardless of cwd.
 */
function relocateStrayOutput(targetDir, graphDir) {
  const stray = path.join(targetDir, 'graphify-out');
  const desired = path.join(graphDir, 'graphify-out');
  if (!fs.existsSync(stray) || path.resolve(stray) === path.resolve(desired)) return;
  try {
    fs.rmSync(desired, { recursive: true, force: true });
    fs.renameSync(stray, desired);
  } catch {
    // Best-effort: leave the folder in place rather than crash the command.
  }
}

/**
 * Runs Graphify on the target directory.
 * Reports paths relative to the current workspace root.
 */
export function runGraphify({ targetDir = process.cwd(), codeOnly = true } = {}) {
  const safeTarget = sanitizePath(targetDir);
  const displayTarget = path.relative(process.cwd(), safeTarget) || '.';
  logInfo(`Analyzing codebase knowledge graph for workspace: ${displayTarget}`);

  const cmdPrefix = getGraphifyCommand();

  if (cmdPrefix) {
    // The native engine writes its graphify-out folder next to the scanned
    // target, so we run it, then relocate that folder into .smileu/graph to keep
    // the project root clean — whether the run succeeds or fails.
    const graphDir = ensureOutputDir(safeTarget, 'graph');
    let nativeOk = false;
    try {
      logInfo(`Running native Graphify engine (${cmdPrefix})...`);
      const flag = codeOnly ? '--code-only' : '';
      execSync(`${cmdPrefix} extract "${safeTarget}" ${flag}`.trim(), {
        stdio: 'inherit',
        cwd: graphDir
      });

      try {
        execSync(`${cmdPrefix} cluster-only "${safeTarget}"`, { stdio: 'inherit', cwd: graphDir });
      } catch (clusterErr) {
        logWarn(`Clustering notice: ${clusterErr.message}`);
      }

      try {
        execSync(`${cmdPrefix} tree`, { stdio: 'inherit', cwd: graphDir });
      } catch {}

      nativeOk = true;
    } catch (err) {
      logWarn(`Native Graphify run encountered an error: ${err.message}`);
      logInfo('Falling back to built-in JavaScript graph generator...');
    } finally {
      relocateStrayOutput(safeTarget, graphDir);
    }

    if (nativeOk) {
      logSuccess(`Graph generated in ${path.relative(safeTarget, graphDir).replace(/\\/g, '/')}`);
      return { success: true, engine: 'native' };
    }
  }

  // Fallback pure JS graph analyzer
  return runBuiltinJsGraph(safeTarget);
}

/**
 * Built-in JS dependency scanner when python/graphify is unavailable.
 */
export function runBuiltinJsGraph(targetDir) {
  const safeTarget = sanitizePath(targetDir);
  const displayTarget = path.relative(process.cwd(), safeTarget) || '.';
  logInfo('Running built-in JavaScript graph extractor...');
  const outDir = ensureOutputDir(safeTarget, 'graph');

  const nodes = [];
  const edges = [];

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
        entry.name === 'graphify-out' ||
        entry.name === 'skills' ||
        entry.name === 'dist'
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(js|jsx|ts|tsx|mjs|cjs|json|md)$/i.test(entry.name)) {
        const relPath = path.relative(safeTarget, fullPath).replace(/\\/g, '/');
        let content;
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }

        nodes.push({
          id: relPath,
          label: entry.name,
          type: path.extname(entry.name).replace('.', ''),
          size: content.length
        });

        // Parse import statements
        const importMatches = content.matchAll(/(?:import|from|require)\s*\(?['"]([^'"]+)['"]\)?/g);
        for (const match of importMatches) {
          edges.push({
            source: relPath,
            target: match[1],
            relation: 'imports'
          });
        }
      }
    }
  }

  scanDir(safeTarget);

  const graphData = { nodes, edges, generatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, 'graph.json'), JSON.stringify(graphData, null, 2), 'utf-8');

  const report = `# Codebase Knowledge Graph Report

Generated: ${new Date().toISOString()}
Scan Root: \`./${displayTarget === '.' ? '' : displayTarget}\`
Total Nodes: ${nodes.length}
Total Edges: ${edges.length}

## Top Connected Files
${nodes
  .slice(0, 10)
  .map((n, i) => `${i + 1}. **${n.id}** (${n.type}, ${n.size} bytes)`)
  .join('\n')}
`;

  fs.writeFileSync(path.join(outDir, 'GRAPH_REPORT.md'), report, 'utf-8');
  logSuccess(`Built-in graph generated in ${path.relative(safeTarget, outDir).replace(/\\/g, '/')}`);
  return { success: true, engine: 'builtin-js' };
}
