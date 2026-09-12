import { execSync } from 'node:child_process';
import { logSuccess, logInfo, logWarn, logError } from '../ui.js';

function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

export function checkTooling() {
  const status = {
    node: false,
    git: false,
    python: false,
    uv: false,
    graphify: false,
    graphifyMethod: null
  };

  // Node
  const nodeVer = runCmd('node -v');
  if (nodeVer) {
    status.node = nodeVer;
  }

  // Git
  const gitVer = runCmd('git --version');
  if (gitVer) {
    status.git = gitVer;
  }

  // Python
  const pyVer = runCmd('python --version') || runCmd('python3 --version');
  if (pyVer) {
    status.python = pyVer;
  }

  // uv
  const uvVer = runCmd('uv --version');
  if (uvVer) {
    status.uv = uvVer;
  }

  // Graphify
  if (runCmd('graphify --help')) {
    status.graphify = true;
    status.graphifyMethod = 'direct';
  } else if (status.uv && runCmd('uv tool run --from graphifyy graphify --help')) {
    status.graphify = true;
    status.graphifyMethod = 'uv-tool';
  }

  return status;
}

export function printDoctorReport() {
  console.log('Running Smileu System Diagnostic (Doctor):\n');
  const status = checkTooling();

  if (status.node) {
    logSuccess(`Node.js   : ${status.node}`);
  } else {
    logError('Node.js   : Not found in PATH');
  }

  if (status.git) {
    logSuccess(`Git       : ${status.git}`);
  } else {
    logWarn('Git       : Not found in PATH');
  }

  if (status.python) {
    logSuccess(`Python    : ${status.python}`);
  } else {
    logWarn('Python    : Not found (required for native Graphify engine)');
  }

  if (status.uv) {
    logSuccess(`uv        : ${status.uv}`);
  } else {
    logInfo('uv        : Not installed (optional fast Python runner)');
  }

  if (status.graphify) {
    logSuccess(`Graphify  : Ready via ${status.graphifyMethod}`);
  } else {
    logWarn('Graphify  : Not detected. Run "smileu setup-tools" to auto-install.');
  }

  console.log('');
  return status;
}

export function setupTools() {
  console.log('Auto-configuring external tools for Smileu Code Skill...\n');
  const status = checkTooling();

  if (!status.graphify) {
    if (status.uv) {
      logInfo('Installing Graphify via uv tool (graphifyy)...');
      try {
        execSync('uv tool install --upgrade graphifyy', { stdio: 'inherit' });
        logSuccess('Graphify successfully installed via uv tool!');
      } catch (err) {
        logError(`Failed to install graphifyy via uv: ${err.message}`);
      }
    } else if (status.python) {
      logInfo('Installing Graphify via pip (graphifyy)...');
      try {
        execSync('pip install --upgrade graphifyy', { stdio: 'inherit' });
        logSuccess('Graphify successfully installed via pip!');
      } catch (err) {
        logError(`Failed to install graphifyy via pip: ${err.message}`);
      }
    } else {
      logWarn('Python or uv is required to install the native Graphify engine.');
      logInfo('Smileu will fall back to its embedded lightweight dependency scanner.');
    }
  } else {
    logSuccess('All tools including Graphify are already set up and ready!');
  }
}
