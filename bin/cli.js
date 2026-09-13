#!/usr/bin/env node

import { runCli } from '../src/cli.js';

// runCli sets process.exitCode itself. Anything that reaches this handler is an
// unexpected failure, so point the user at the issue tracker.
runCli().catch((err) => {
  console.error(`error: ${(err && err.message) || err}`);
  console.error('If this looks like a bug, please report it at https://github.com/nazalilis/smileu-code-skill-agents/issues');
  process.exitCode = 1;
});
