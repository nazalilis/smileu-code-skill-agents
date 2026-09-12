let pc;
try {
  pc = (await import('picocolors')).default;
} catch {
  // Fallback if dependencies aren't yet installed
  pc = {
    cyan: (s) => s,
    green: (s) => s,
    yellow: (s) => s,
    magenta: (s) => s,
    blue: (s) => s,
    red: (s) => s,
    bold: (s) => s,
    dim: (s) => s
  };
}

export function printBanner() {
  console.log('\n' + pc.cyan(pc.bold('  ███████╗███╗   ███╗██╗██╗     ███████╗██╗   ██╗')));
  console.log(pc.cyan(pc.bold('  ██╔════╝████╗ ████║██║██║     ██╔════╝██║   ██║')));
  console.log(pc.cyan(pc.bold('  ███████╗██╔████╔██║██║██║     █████╗  ██║   ██║')));
  console.log(pc.cyan(pc.bold('  ╚════██║██║╚██╔╝██║██║██║     ██╔══╝  ██║   ██║')));
  console.log(pc.cyan(pc.bold('  ███████║██║ ╚═╝ ██║██║███████╗███████╗╚██████╔╝')));
  console.log(pc.cyan(pc.bold('  ╚══════╝╚═╝     ╚═╝╚═╝╚══════╝╚══════╝ ╚═════╝ ')));
  console.log(pc.magenta(pc.bold('         C O D E   S K I L L   E C O S Y S T E M')));
  console.log(pc.dim('     One command. Every AI agent & skill. Under one brand.\n'));
}

export function logSuccess(msg) {
  console.log(pc.green('✔ ') + pc.bold(msg));
}

export function logInfo(msg) {
  console.log(pc.blue('ℹ ') + msg);
}

export function logWarn(msg) {
  console.log(pc.yellow('⚠ ') + msg);
}

export function logError(msg) {
  console.log(pc.red('✖ ') + msg);
}
