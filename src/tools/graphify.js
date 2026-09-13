import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkTooling } from './doctor.js';
import { logSuccess, logInfo, logWarn } from '../ui.js';
import { ensureOutputDir } from '../utils/output.js';

/**
 * Resolves how to launch the native Graphify engine, or null when it is not
 * available. Commands are returned as an executable plus an argument prefix so
 * they can run without a shell.
 */
export function getGraphifyCommand() {
  const status = checkTooling();
  if (status.graphifyMethod === 'direct') {
    return { cmd: 'graphify', prefix: [], label: 'graphify' };
  }
  if (status.graphifyMethod === 'uv-tool') {
    return {
      cmd: 'uv',
      prefix: ['tool', 'run', '--from', 'graphifyy', 'graphify'],
      label: 'uv tool run --from graphifyy graphify'
    };
  }
  return null;
}

/**
 * Runs one Graphify subcommand. Arguments are passed as an array with no shell,
 * so a folder name containing quotes, `;`, `&`, `$` or newlines is just a path.
 */
function runGraphifyStep(command, args, cwd) {
  execFileSync(command.cmd, [...command.prefix, ...args], { stdio: 'inherit', cwd, shell: false });
}

function describeFailure(err) {
  if (err && err.code === 'ENOENT') return 'command not found';
  if (err && typeof err.status === 'number') return `exit code ${err.status}`;
  return (err && err.message) || 'unknown error';
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
 * Builds the knowledge graph for the target directory, using native Graphify
 * when it is installed and the built-in import scanner otherwise.
 */
export function runGraphify({ targetDir = process.cwd(), codeOnly = true } = {}) {
  const target = path.resolve(targetDir);
  const displayTarget = path.relative(process.cwd(), target) || '.';
  logInfo(`Building the knowledge graph for ${displayTarget}`);

  const command = getGraphifyCommand();

  if (command) {
    const graphDir = ensureOutputDir(target, 'graph');
    let nativeOk = false;
    try {
      logInfo(`Running Graphify (${command.label})...`);
      runGraphifyStep(command, ['extract', target, ...(codeOnly ? ['--code-only'] : [])], graphDir);

      try {
        runGraphifyStep(command, ['cluster-only', target], graphDir);
      } catch (err) {
        logWarn(`Graphify clustering skipped (${describeFailure(err)}).`);
      }

      // `tree` reads graphify-out/graph.json relative to its working directory,
      // so the output has to be moved into .smileu/graph before it runs.
      relocateStrayOutput(target, graphDir);
      try {
        runGraphifyStep(command, ['tree'], graphDir);
      } catch (err) {
        logWarn(`Graphify tree view skipped (${describeFailure(err)}).`);
      }

      nativeOk = true;
    } catch (err) {
      logWarn(`Graphify failed (${describeFailure(err)}). Using the built-in import scanner instead.`);
    } finally {
      relocateStrayOutput(target, graphDir);
    }

    if (nativeOk) {
      logSuccess(`Graph written to ${path.relative(target, graphDir).replace(/\\/g, '/')}/`);
      return { success: true, engine: 'native' };
    }
  }

  return runBuiltinJsGraph(target);
}

/**
 * Built-in scanner used when Graphify is not installed. It records files and
 * the import/require specifiers each one uses; it does not resolve modules.
 */
export function runBuiltinJsGraph(targetDir) {
  const target = path.resolve(targetDir);
  const displayTarget = path.relative(process.cwd(), target) || '.';
  logInfo('Running the built-in import scanner...');
  const outDir = ensureOutputDir(target, 'graph');

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
        const relPath = path.relative(target, fullPath).replace(/\\/g, '/');
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

        const importMatches = content.matchAll(/(?:import|from|require)\s*\(?['"]([^'"]+)['"]\)?/g);
        for (const match of importMatches) {
          edges.push({ source: relPath, target: match[1], relation: 'imports' });
        }
      }
    }
  }

  scanDir(target);

  const graphData = { nodes, edges, generatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, 'graph.json'), JSON.stringify(graphData, null, 2), 'utf-8');

  const importCounts = new Map();
  for (const edge of edges) {
    importCounts.set(edge.source, (importCounts.get(edge.source) || 0) + 1);
  }
  const mostConnected = nodes
    .map((n) => ({ ...n, imports: importCounts.get(n.id) || 0 }))
    .filter((n) => n.imports > 0)
    .sort((a, b) => b.imports - a.imports || a.id.localeCompare(b.id))
    .slice(0, 10);

  const report = `# Codebase Knowledge Graph Report

Generated: ${new Date().toISOString()}
Scan root: \`./${displayTarget === '.' ? '' : displayTarget}\`
Files: ${nodes.length}
Import edges: ${edges.length}

## Files with the most imports
${
  mostConnected.length
    ? mostConnected.map((n, i) => `${i + 1}. **${n.id}** (${n.imports} imports)`).join('\n')
    : 'No import statements were found.'
}
`;

  fs.writeFileSync(path.join(outDir, 'GRAPH_REPORT.md'), report, 'utf-8');
  logSuccess(`Graph written to ${path.relative(target, outDir).replace(/\\/g, '/')}/`);
  return { success: true, engine: 'builtin-js' };
}
