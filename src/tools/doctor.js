import { execFileSync } from 'node:child_process';
import { logSuccess, logInfo, logNotice, logError, logHeading } from '../ui.js';

/**
 * Runs a command without a shell and reports whether it exited 0, plus its
 * first line of output. Never throws.
 */
function probe(cmd, args) {
  try {
    const out = execFileSync(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      timeout: 30000,
      windowsHide: true
    });
    return { ok: true, firstLine: String(out).trim().split(/\r?\n/)[0] || '' };
  } catch {
    return { ok: false, firstLine: '' };
  }
}

function versionOf(cmd, args = ['--version']) {
  const result = probe(cmd, args);
  return result.ok ? result.firstLine || 'installed' : null;
}

export function checkTooling() {
  const status = {
    node: process.version,
    git: versionOf('git'),
    python: null,
    pythonCmd: null,
    uv: versionOf('uv'),
    graphify: false,
    graphifyMethod: null
  };

  const pythonCandidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const cmd of pythonCandidates) {
    const version = versionOf(cmd);
    if (version) {
      status.python = version;
      status.pythonCmd = cmd;
      break;
    }
  }

  if (probe('graphify', ['--help']).ok) {
    status.graphify = true;
    status.graphifyMethod = 'direct';
  } else if (status.uv && probe('uv', ['tool', 'run', '--from', 'graphifyy', 'graphify', '--help']).ok) {
    status.graphify = true;
    status.graphifyMethod = 'uv-tool';
  }

  return status;
}

export function printDoctorReport() {
  logHeading('Checking tools');
  const status = checkTooling();

  logSuccess(`Node.js   ${status.node}`);

  if (status.git) logSuccess(`Git       ${status.git}`);
  else logNotice('Git       not found. Needed for --latest.');

  if (status.python) logSuccess(`Python    ${status.python}`);
  else logNotice('Python    not found. Needed for the native Graphify engine.');

  if (status.uv) logSuccess(`uv        ${status.uv}`);
  else logInfo('uv        not installed (optional; installs Graphify faster than pip).');

  if (status.graphify) {
    logSuccess(`Graphify  ${status.graphifyMethod === 'direct' ? 'found on PATH' : 'available through uv'}`);
  } else {
    logNotice('Graphify  not found. Run "smileu setup-tools" to install it, or keep using the built-in scanner.');
  }

  console.log('');
  return status;
}

/**
 * Installs the native Graphify engine with uv, or with pip when uv is missing.
 * Returns true when Graphify is available afterwards.
 */
export function setupTools() {
  logHeading('Installing optional tools');
  const status = checkTooling();

  if (status.graphify) {
    logSuccess('Graphify is already installed.');
    return true;
  }

  const attempt = (label, cmd, args, hint) => {
    logInfo(`Installing Graphify with ${label}...`);
    try {
      execFileSync(cmd, args, { stdio: 'inherit', windowsHide: true });
      logSuccess(`Installed Graphify with ${label}.`);
      return true;
    } catch {
      logError(`Graphify install with ${label} failed (see the output above). Try "${hint}" yourself, or keep using the built-in scanner.`);
      return false;
    }
  };

  if (status.uv) {
    return attempt('uv', 'uv', ['tool', 'install', '--upgrade', 'graphifyy'], 'uv tool install graphifyy');
  }

  if (status.pythonCmd) {
    // `python -m pip` guarantees pip belongs to the interpreter that was found.
    return attempt(
      'pip',
      status.pythonCmd,
      ['-m', 'pip', 'install', '--upgrade', 'graphifyy'],
      `${status.pythonCmd} -m pip install graphifyy`
    );
  }

  logError('Graphify needs Python or uv, and neither was found. The built-in import scanner will be used instead.');
  return false;
}
